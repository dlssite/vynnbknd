const express = require('express');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/check-username/:username
// @desc    Check if username is available
// @access  Public
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Basic validation regex matches model
        if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) {
            return res.json({ available: false, message: 'Invalid characters' });
        }
        if (username.length < 3 || username.length > 20) {
            return res.json({ available: false, message: 'Invalid length' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        res.json({ available: !user });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/users/:username
// @desc    Get user public info by username
// @access  Public
router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toLowerCase() })
            .select('username displayName level createdAt');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
