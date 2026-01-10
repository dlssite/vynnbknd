const express = require('express');
const Badge = require('../models/Badge');
const router = express.Router();

// @route   GET /api/badges
// @desc    Get all active badges
// @access  Public
router.get('/', async (req, res) => {
    try {
        const badges = await Badge.find({ isActive: true }).sort({ category: 1, rarity: 1 });
        res.json(badges);
    } catch (error) {
        console.error('Get Active Badges Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/badges/my
// @desc    Get user's owned badges
// @access  Private
router.get('/my', require('../middleware/auth').auth, async (req, res) => {
    try {
        // req.user.badges is already populated by auth middleware
        res.json(req.user.badges);
    } catch (error) {
        console.error('Get My Badges Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
