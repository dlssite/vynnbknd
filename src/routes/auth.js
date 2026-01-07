const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { auth } = require('../middleware/auth');

const router = express.Router();

const axios = require('axios');

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Discord Constants
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
    '/register',
    [
        body('email')
            .trim()
            .toLowerCase()
            .isEmail()
            .withMessage('Valid email required'),

        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters'),

        body('username')
            .trim()
            .toLowerCase()
            .isLength({ min: 3, max: 20 })
            .matches(/^[a-z0-9_]+$/)
            .withMessage('Username must be 3-20 characters, lowercase letters, numbers, and underscores only'),

        body('referralCode')
            .optional()
            .trim()
            .toLowerCase()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('❌ Validation errors:', errors.array());
                return res.status(400).json({
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const email = req.body.email;
            const password = req.body.password;
            const username = req.body.username;
            const referralCode = req.body.referralCode || null;

            // Check email
            if (await User.findOne({ email })) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            // Check username
            if (await User.findOne({ username })) {
                return res.status(400).json({ error: 'Username already taken' });
            }

            // Validate referral code
            let referrer = null;
            if (referralCode) {
                referrer = await User.findOne({
                    $or: [
                        { referralCode: referralCode.toUpperCase() },
                        { premiumReferralCode: referralCode.toUpperCase() }
                    ]
                });

                if (!referrer) {
                    return res.status(400).json({ error: 'Invalid referral code' });
                }
            }

            // Create user
            const user = new User({
                email,
                password,
                username,
                displayName: username,
                referredBy: referrer?._id || null,
                referredByCode: referralCode
            });

            await user.save();

            // Create profile
            await new Profile({ user: user._id }).save();

            // Process referral rewards if exists
            if (referrer) {
                // Add referral to referrer's list
                await referrer.addReferral(user._id, referralCode);

                // Grant rewards to referee (new user)
                await user.addXP(50); // Bonus XP
                await user.addCredits(25, 'signup_bonus', 'Referral signup bonus');

                // Grant rewards to referrer
                await referrer.addXP(100); // Referral XP
                await referrer.addCredits(50, 'referral', `Referred ${user.username}`);

                // Check for referral milestone badges
                const { checkReferralBadges } = require('../services/badgeService');
                await checkReferralBadges(referrer._id);
            }

            // Token
            const token = generateToken(user._id);

            res.status(201).json({
                message: 'Account created successfully',
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    displayName: user.displayName,
                    level: user.level,
                    xp: user.xp
                }
            });
        } catch (err) {
            console.error('🔥 Registration error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);


// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                tag: user.tag,
                level: user.level,
                xp: user.xp,
                role: user.role,
                isPremium: user.isPremium,
                discord: user.discord ? {
                    username: user.discord.username,
                    avatar: user.discord.avatar
                } : null
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const { checkAutomaticBadges } = require('../services/badgeService');

        const user = await User.findById(req.user._id).select('-password');
        await checkAutomaticBadges(user._id);

        let profile = await Profile.findOne({ user: req.user._id });

        // Self-healing: Create profile if missing (e.g. from partial registration)
        if (!profile) {
            profile = new Profile({ user: req.user._id });
            await profile.save();
        }

        res.json({
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                tag: user.tag,
                level: user.level,
                xp: user.xp,
                credits: user.credits,
                role: user.role,
                isPremium: user.isPremium,
                discord: user.discord ? {
                    id: user.discord.id,
                    username: user.discord.username,
                    avatar: user.discord.avatar
                } : null,
                createdAt: user.createdAt
            },
            profile: profile ? {
                bio: profile.bio,
                avatar: profile.avatar,
                banner: profile.banner,
                isNSFW: profile.isNSFW,
                views: profile.views
            } : null
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/auth/check-username
// @desc    Check if username is available
// @access  Public
router.post('/check-username', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .matches(/^[a-z0-9_]+$/)
], async (req, res) => {
    try {
        const { username } = req.body;
        const exists = await User.findOne({ username: username.toLowerCase() });
        res.json({ available: !exists });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/auth/discord/unlink
// @desc    Unlink Discord account
// @access  Private
router.post('/discord/unlink', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.discord = undefined;
        await user.save();
        res.json({ message: 'Discord unlinked successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/auth/discord
// @desc    Redirect to Discord OAuth
// @access  Public (can include token in state for connecting)
router.get('/discord', (req, res) => {
    const { token } = req.query; // Optional token for connecting
    const state = token || 'login';

    // identify, email, guilds (optional)
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${state}`;
    res.redirect(url);
});

// @route   GET /api/auth/discord/callback
// @desc    Discord OAuth callback
// @access  Public
router.get('/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=discord_denied`);
    }

    try {
        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        // Get user data
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        const discordUser = userResponse.data;

        // Construct Discord asset URLs
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith('a_') ? 'gif' : 'png'}?size=512`
            : null;

        const bannerUrl = discordUser.banner
            ? `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.${discordUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=1024`
            : null;

        const decorationUrl = discordUser.avatar_decoration_data?.asset
            ? `https://cdn.discordapp.com/avatar-decoration-presets/${discordUser.avatar_decoration_data.asset}.png`
            : null;

        const discordData = {
            id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
            avatarUrl: avatarUrl,
            banner: discordUser.banner,
            bannerUrl: bannerUrl,
            bannerColor: discordUser.banner_color,
            decoration: discordUser.avatar_decoration,
            decorationUrl: decorationUrl,
            profileEffectId: discordUser.profile_effect_id,
            accessToken: access_token,
            refreshToken: refresh_token,
            connectedAt: new Date()
        };

        let user;

        // Flow 1: Connect Discord (User is already logged in)
        if (state && state !== 'login') {
            try {
                const decoded = jwt.verify(state, process.env.JWT_SECRET);
                user = await User.findById(decoded.userId);

                if (user) {
                    // Check if this Discord account is already linked to ANOTHER user
                    const existingLink = await User.findOne({ 'discord.id': discordUser.id, _id: { $ne: user._id } });
                    if (existingLink) {
                        return res.redirect(`${process.env.FRONTEND_URL}/account/settings?error=discord_already_linked`);
                    }

                    user.discord = discordData;
                    await user.save();
                    return res.redirect(`${process.env.FRONTEND_URL}/account/settings?success=discord_connected`);
                }
            } catch (jwtError) {
                console.error('Discord state JWT error:', jwtError);
                // Fallback to login flow if token expired
            }
        }

        // Flow 2: Login / Register with Discord
        // Find existing user by discord id OR email
        user = await User.findOne({ $or: [{ 'discord.id': discordUser.id }, { email: discordUser.email }] });

        if (user) {
            // Update discord info if it's the same or link if email matched
            user.discord = discordData;
            user.lastLoginAt = new Date();
            await user.save();
        } else {
            // Register new user
            const username = discordUser.username.toLowerCase().replace(/[^a-z0-9_]/g, '') + Math.floor(1000 + Math.random() * 9000);
            user = new User({
                email: discordUser.email,
                username: username,
                displayName: discordUser.username,
                password: Math.random().toString(36).slice(-16), // Random password
                discord: discordData,
                isVerified: false
            });
            await user.save();

            // Create default profile
            const profile = new Profile({
                user: user._id,
                avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            });
            await profile.save();
        }

        // Generate JWT
        const token = generateToken(user._id);
        res.redirect(`${process.env.FRONTEND_URL}/login/callback?token=${token}`);

    } catch (error) {
        console.error('Discord Auth Error:', error.response?.data || error.message);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=discord_auth_failed`);
    }
});

module.exports = router;
