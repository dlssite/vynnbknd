const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/discord/assets
// @desc    Get Discord profile assets (avatar, banner, decorations)
// @access  Private
router.get('/assets', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.discord || !user.discord.id) {
            return res.json({ assets: [] });
        }

        const assets = [];

        // Add Discord Avatar
        if (user.discord.avatarUrl) {
            assets.push({
                type: 'avatar',
                name: 'Discord Avatar',
                url: user.discord.avatarUrl,
                source: 'discord'
            });
        }

        // Add Discord Banner
        if (user.discord.bannerUrl) {
            assets.push({
                type: 'banner',
                name: 'Discord Banner',
                url: user.discord.bannerUrl,
                source: 'discord'
            });
        }

        // Add Profile Decoration
        if (user.discord.decorationUrl) {
            assets.push({
                type: 'decoration',
                name: 'Discord Profile Effect',
                url: user.discord.decorationUrl,
                source: 'discord'
            });
        }

        res.json({ assets });
    } catch (error) {
        console.error('Discord Assets Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const { getDiscordServerInfo } = require('../services/discordService');

// @route   GET /api/discord/server/:inviteOrId
// @desc    Get Discord server information
// @access  Public
router.get('/server/:inviteOrId', async (req, res) => {
    try {
        const { inviteOrId } = req.params;
        const serverInfo = await getDiscordServerInfo(inviteOrId);

        if (!serverInfo) {
            return res.status(404).json({ error: 'Server not found or bot not in server' });
        }

        res.json(serverInfo);
    } catch (error) {
        console.error('Discord Server Route Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
