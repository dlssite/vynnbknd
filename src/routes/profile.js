const express = require('express');
const { body, validationResult } = require('express-validator');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const { getDiscordPresence } = require('../services/discordService');
const { syncUserDiscordBadges } = require('../services/badgeService');

const router = express.Router();

// Routes moved to bottom to prevent shadowing specific paths like /@me

// @route   GET /api/profiles/@me
// @desc    Get own profile (for editing)
// @access  Private
router.get('/@me', auth, async (req, res) => {
    try {
        let profile = await Profile.findOne({ user: req.user._id }).populate('frame');

        if (!profile) {
            // Create profile if doesn't exist
            profile = new Profile({ user: req.user._id });
            await profile.save();
        }

        // Sync Discord Badges
        await syncUserDiscordBadges(req.user);

        res.json({
            profile,
            user: {
                username: req.user.username,
                displayName: req.user.displayName,
                level: req.user.level,
                isVerified: req.user.isVerified,
                badges: req.user.badges, // Populated via middleware or manually
                discord: req.user.discord ? {
                    id: req.user.discord.id,
                    username: req.user.discord.username,
                    avatar: req.user.discord.avatar,
                    decoration: req.user.discord.decoration
                } : null
            }
        });
    } catch (error) {
        console.error('Get my profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/profiles/@me
// @desc    Update own profile
// @access  Private
router.put('/@me', auth, [
    body('bio').optional().isLength({ max: 500 }),
    body('displayName').optional().isLength({ max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const allowedUpdates = [
            'bio', 'avatar', 'banner', 'themeConfig', 'links', 'socials',
            'frame', 'commissionStatus', 'isNSFW', 'showViewCount', 'isPublic'
        ];

        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Update display name on user model if provided
        if (req.body.displayName) {
            await User.findByIdAndUpdate(req.user._id, {
                displayName: req.body.displayName
            });
        }

        const profile = await Profile.findOneAndUpdate(
            { user: req.user._id },
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('frame');

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({
            message: 'Profile updated',
            profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/profiles/@me/templates
// @desc    Get user's saved templates
// @access  Private
router.get('/@me/templates', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({ templates: profile.templates });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/profiles/@me/templates
// @desc    Save a new template
// @access  Private
router.post('/@me/templates', auth, async (req, res) => {
    try {
        const { name, config } = req.body;
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const newTemplate = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            config
        };

        profile.templates.push(newTemplate);
        await profile.save();
        res.status(201).json({ message: 'Template saved', template: newTemplate });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/profiles/@me/templates/:templateId
// @desc    Delete a template
// @access  Private
router.delete('/@me/templates/:templateId', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        profile.templates = profile.templates.filter(t => t.id !== req.params.templateId);
        await profile.save();
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/profiles/@me/links
// @desc    Add a new link
// @access  Private
router.post('/@me/links', auth, [
    body('title').isLength({ min: 1, max: 100 }).withMessage('Title is required'),
    body('url').isLength({ min: 1 }).withMessage('URL is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, url, icon } = req.body;

        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Enforce Limits: 1 for Free, 3 for Pro
        const linkLimit = req.user.isPremium ? 3 : 1;
        if (profile.links.length >= linkLimit) {
            return res.status(403).json({
                error: `Link limit reached. ${req.user.isPremium ? 'Pro' : 'Free'} users are limited to ${linkLimit} custom links.`
            });
        }

        // Add link
        profile.links.push({
            title,
            url,
            icon: icon || 'link',
            order: profile.links.length
        });
        await profile.save();

        res.status(201).json({
            message: 'Link added',
            links: profile.links
        });
    } catch (error) {
        console.error('Add link error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/profiles/@me/links/:linkId
// @desc    Delete a link
// @access  Private
router.delete('/@me/links/:linkId', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        profile.links = profile.links.filter(
            link => link._id.toString() !== req.params.linkId
        );
        await profile.save();

        res.json({
            message: 'Link deleted',
            links: profile.links
        });
    } catch (error) {
        console.error('Delete link error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/profiles/:username/presence
// @desc    Get Discord presence for a user
// @access  Public
router.get('/:username/presence', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username.toLowerCase() });
        if (!user || !user.discord || !user.discord.id) {
            return res.status(404).json({ error: 'Discord not linked' });
        }

        const presence = await getDiscordPresence(user.discord.id);
        res.json(presence);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/profiles/:username
// @desc    Get public profile by username
// @access  Public
router.get('/:username', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toLowerCase() })
            .select('username displayName level xp discord createdAt badges isVerified')
            .populate('badges');

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profile = await Profile.findOne({ user: user._id }).populate('frame');

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if profile is public or viewer is owner
        const isOwner = req.user && req.user._id.toString() === user._id.toString();
        if (!profile.isPublic && !isOwner) {
            return res.status(403).json({ error: 'This profile is private' });
        }

        // Increment views if not owner
        if (!isOwner) {
            await profile.incrementViews();
            // Add XP to profile owner for view
            await user.addXP(1);
        }

        res.json({
            user: {
                username: user.username,
                displayName: user.displayName,
                level: user.level,
                isVerified: user.isVerified,
                badges: user.badges, // Included populated badges
                discord: user.discord ? {
                    id: user.discord.id,
                    username: user.discord.username,
                    avatar: user.discord.avatar,
                    decoration: user.discord.decoration
                } : null,
                createdAt: user.createdAt
            },
            profile: {
                _id: profile._id,
                bio: profile.bio,
                avatar: profile.avatar,
                banner: profile.banner,
                themeConfig: profile.themeConfig,
                links: profile.links.filter(l => l.isVisible),
                socials: profile.socials.filter(s => s.isVisible),
                frame: profile.frame,
                commissionStatus: profile.commissionStatus,
                isNSFW: profile.isNSFW,
                views: profile.showViewCount ? profile.views : null
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
