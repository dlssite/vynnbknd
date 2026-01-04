const express = require('express');
const router = express.Router();
const Frame = require('../models/Frame');
const { optionalAuth, auth } = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/frames
// @desc    Get all active frames (Shop View)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
    try {
        const frames = await Frame.find({ isActive: true }).sort({ rarity: 1, name: 1 });

        // If user is logged in, mark which ones they own
        let framesWithOwnership = frames.map(frame => ({
            ...frame.toObject(),
            owned: false
        }));

        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                framesWithOwnership = frames.map(frame => ({
                    ...frame.toObject(),
                    owned: user.inventory.frames.includes(frame._id) || frame.type === 'free'
                }));
            }
        }

        res.json(framesWithOwnership);
    } catch (error) {
        console.error('Get Frames Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/frames/owned
// @desc    Get frames owned by the user
// @access  Private
router.get('/owned', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('inventory.frames');
        const freeFrames = await Frame.find({ type: 'free', isActive: true });

        // Combine free frames and owned frames
        // Deduplicate in case a free frame is somehow in inventory
        const allFrames = [...freeFrames, ...user.inventory.frames];
        const uniqueFrames = Array.from(new Set(allFrames.map(a => a._id.toString())))
            .map(id => allFrames.find(a => a._id.toString() === id));

        res.json(uniqueFrames);
    } catch (error) {
        console.error('Get Owned Frames Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/frames/:id/buy
// @desc    Buy or Claim a frame
// @access  Private
router.post('/:id/buy', auth, async (req, res) => {
    try {
        const frame = await Frame.findById(req.params.id);
        if (!frame) return res.status(404).json({ error: 'Frame not found' });
        if (!frame.isActive) return res.status(400).json({ error: 'Frame is not active' });

        const user = await User.findById(req.user.id);

        // Check ownership
        if (user.inventory.frames.includes(frame._id)) {
            return res.status(400).json({ error: 'You already own this frame' });
        }

        // Logic for different types
        if (frame.type === 'premium' && !user.isPremium) {
            return res.status(403).json({ error: 'This frame requires a Premium subscription' });
        }

        if (frame.type === 'purchase') {
            // Placeholder for currency check
            // if (user.balance < frame.price) return res.status(400).json({ error: 'Insufficient funds' });
            // user.balance -= frame.price;
        }

        if (frame.type === 'exclusive') {
            // Placeholder for exclusive logic (e.g. event only)
            // return res.status(403).json({ error: 'This frame is exclusive' });
        }

        // Add to inventory
        user.inventory.frames.push(frame._id);
        await user.save();

        res.json({ message: 'Frame acquired!', frame });
    } catch (error) {
        console.error('Buy Frame Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
