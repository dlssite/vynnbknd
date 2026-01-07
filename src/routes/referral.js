const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// @route   GET /api/referral/code
// @desc    Get user's referral codes (standard + premium)
// @access  Private
router.get('/code', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Ensure standard code exists (lazy generation)
        if (!user.referralCode) {
            await user.generateReferralCode();
            await user.save();
        }

        // Ensure premium code exists if applicable
        if (user.isPremium && !user.premiumReferralCode) {
            await user.generatePremiumReferralCode();
            await user.save();
        }

        res.json({
            referralCode: user.referralCode,
            premiumReferralCode: user.premiumReferralCode || null,
            isPremium: user.isPremium
        });
    } catch (error) {
        console.error('Get Referral Code Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/referral/validate
// @desc    Validate a referral code
// @access  Public
router.post('/validate', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Code is required' });
        }

        const trimmedCode = code.trim();

        // Check both standard (VYNN-XXXX) and premium (VYNN-USERNAME) formats
        const referrer = await User.findOne({
            $or: [
                { referralCode: trimmedCode.toUpperCase() },
                { premiumReferralCode: trimmedCode.toUpperCase() }
            ]
        }).select('username displayName avatar isPremium');

        if (!referrer) {
            return res.status(404).json({ valid: false, message: 'Invalid referral code' });
        }

        res.json({
            valid: true,
            referrer: {
                username: referrer.username,
                displayName: referrer.displayName,
                isPremium: referrer.isPremium
            }
        });
    } catch (error) {
        console.error('Validate Referral Code Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/referral/stats
// @desc    Get user's referral statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        const responseData = {
            ...(user.referralStats || {
                totalReferrals: 0,
                activeReferrals: 0,
                totalXPEarned: 0,
                totalCreditsEarned: 0,
                referralClicks: 0
            }),
            currentXP: user.xp || 0,
            currentLevel: user.level || 1
        };

        res.json(responseData);
    } catch (error) {
        console.error('Get Referral Stats Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/referral/list
// @desc    Get list of referred users
// @access  Private
router.get('/list', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('referrals.user', 'username displayName avatar level xp joinedAt isPremium');

        // Transform the list to be cleaner
        const referralList = user.referrals || [];
        const referrals = referralList.map(ref => {
            if (!ref.user) return null; // Handle deleted users
            return {
                id: ref.user._id,
                username: ref.user.username,
                displayName: ref.user.displayName,
                level: ref.user.level,
                xp: ref.user.xp,
                isPremium: ref.user.isPremium,
                referredAt: ref.referredAt,
                codeUsed: ref.codeUsed,
                rewardClaimed: ref.rewardClaimed
            };
        }).filter(Boolean);

        res.json(referrals);
    } catch (error) {
        console.error('Get Referral List Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/referral/referrer
// @desc    Get info about who referred the current user
// @access  Private
router.get('/referrer', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('referredBy', 'username displayName isPremium');

        if (!user.referredBy) {
            return res.json({ referredBy: null });
        }

        res.json({
            referredBy: {
                username: user.referredBy.username,
                displayName: user.referredBy.displayName,
                isPremium: user.referredBy.isPremium
            },
            codeUsed: user.referredByCode,
            date: user.createdAt // Approximation of referral date
        });
    } catch (error) {
        console.error('Get Referrer Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/referral/credits
// @desc    Get user's credit balance
// @access  Private
router.get('/credits', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ credits: user.credits || 0 });
    } catch (error) {
        console.error('Get Credits Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/referral/credits/history
// @desc    Get credit transaction history
// @access  Private
router.get('/credits/history', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Sort by newest first
        const history = (user.creditHistory || []).sort((a, b) => b.timestamp - a.timestamp);

        res.json(history);
    } catch (error) {
        console.error('Get Credit History Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/referral/credits/gift
// @desc    Gift credits to another user (Premium only)
// @access  Private
router.post('/credits/gift', auth, async (req, res) => {
    try {
        const { username, amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const sender = await User.findById(req.user.id);

        if (!sender.isPremium) {
            return res.status(403).json({ error: 'Gifting is a Premium feature' });
        }

        if (sender.credits < amount) {
            return res.status(400).json({ error: 'Insufficient credits' });
        }

        const receiver = await User.findOne({ username: username.toLowerCase() });

        if (!receiver) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (receiver._id.equals(sender._id)) {
            return res.status(400).json({ error: 'Cannot gift credits to yourself' });
        }

        // Process transaction
        await sender.spendCredits(amount, null, `Gift to ${receiver.username}`);
        await receiver.addCredits(amount, 'admin', `Gift from ${sender.username}`);
        // Note: using 'admin' source for now as 'gift' wasn't in enum, or we can update enum later.
        // Actually I defined enum: ['referral', 'purchase', 'level_up', 'achievement', 'admin', 'signup_bonus']
        // I should probably add 'gift' to enum or use 'admin' / generic.
        // For strictness let's stick to enum, maybe 'admin' fits best or I update model. 
        // I'll stick with 'admin' for now or 'referral' if close enough? No. 'admin' is safest fallback.

        res.json({
            message: `Successfully gifted ${amount} credits to ${receiver.username}`,
            remainingCredits: sender.credits
        });

    } catch (error) {
        console.error('Gift Credits Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/referral/click/:code
// @desc    Track a referral link click
// @access  Public
router.post('/click/:code', async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) return res.status(400).json({ error: 'Code required' });

        const referrer = await User.findOne({
            $or: [
                { referralCode: code.toUpperCase() },
                { premiumReferralCode: code.toLowerCase() }
            ]
        });

        if (!referrer) {
            return res.status(404).json({ error: 'Invalid referral code' });
        }

        // Increment clicks
        if (!referrer.referralStats) {
            referrer.referralStats = { totalReferrals: 0, activeReferrals: 0, totalXPEarned: 0, totalCreditsEarned: 0, referralClicks: 0 };
        }

        referrer.referralStats.referralClicks = (referrer.referralStats.referralClicks || 0) + 1;
        await referrer.save();

        res.json({ status: 'tracked', username: referrer.username });
    } catch (error) {
        console.error('Track Click Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
