const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');

// @route   GET /api/config/public
// @desc    Get non-sensitive global settings
// @access  Public
router.get('/public', async (req, res) => {
    try {
        const config = await SystemConfig.getOrCreate();
        res.json({
            serverInviteLink: config.serverInviteLink,
            botInviteLink: config.botInviteLink,
            announcement: config.announcement
        });
    } catch (error) {
        console.error('Config Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
