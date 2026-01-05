const express = require('express');
const router = express.Router();
const StoreItem = require('../models/StoreItem');
const User = require('../models/User');
const { optionalAuth, auth } = require('../middleware/auth');

// @route   GET /api/store
// @desc    Get store items (optionally filtered by ?type=frame)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { type } = req.query;
        let query = { isActive: true };

        if (type) {
            query.itemType = type;
        }

        const items = await StoreItem.find(query).sort({ rarity: 1, price: 1 });

        // Check ownership if logged in
        let itemsWithStatus = items.map(item => ({
            ...item.toObject(),
            owned: false
        }));

        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                // Check if item ID is in user inventory array
                const inventoryIds = user.inventory.items.map(i => i.toString());
                itemsWithStatus = items.map(item => ({
                    ...item.toObject(),
                    owned: inventoryIds.includes(item._id.toString()) || item.type === 'free'
                }));
            }
        }

        res.json(itemsWithStatus);
    } catch (error) {
        console.error('Get Store Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/store/owned
// @desc    Get user's owned items
// @access  Private
router.get('/owned', auth, async (req, res) => {
    try {
        const { type } = req.query;
        const user = await User.findById(req.user.id).populate('inventory.items');

        // Populate creates objects, so user.inventory.items is an array of StoreItem docs
        let ownedItems = user.inventory.items || [];

        // Also fetch global free items of this type
        let freeQuery = { type: 'free', isActive: true };
        if (type) freeQuery.itemType = type;
        const freeItems = await StoreItem.find(freeQuery);

        // Combine and deduplicate
        const allItems = [...freeItems, ...ownedItems];

        // Filter by type if requested
        let filtered = allItems;
        if (type) {
            filtered = allItems.filter(i => i.itemType === type);
        }

        // Deduplicate by ID
        const unique = Array.from(new Set(filtered.map(a => a._id.toString())))
            .map(id => filtered.find(a => a._id.toString() === id));

        res.json(unique);
    } catch (error) {
        console.error('Get Owned Items Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/store/:id/buy
// @desc    Buy/Claim an item
// @access  Private
router.post('/:id/buy', auth, async (req, res) => {
    try {
        const item = await StoreItem.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (!item.isActive) return res.status(400).json({ error: 'Item not active' });

        const user = await User.findById(req.user.id);

        if (user.inventory.items.includes(item._id)) {
            return res.status(400).json({ error: 'You already own this item' });
        }

        // Check conditions
        if (item.type === 'premium' && !user.isPremium) {
            return res.status(403).json({ error: 'Requires Premium' });
        }

        // Credit check for 'purchase' type items or items with credit price
        if ((item.type === 'purchase' || item.price > 0) && item.currency === 'credits') {
            if (!user.credits || user.credits < item.price) {
                return res.status(400).json({
                    error: 'Insufficient credits',
                    required: item.price,
                    current: user.credits || 0
                });
            }

            // Deduct credits
            await user.spendCredits(item.price, item._id, `Purchased ${item.name}`);
        } else if (item.type === 'purchase' && item.currency !== 'credits') {
            // For now, if currency isn't credits, we might need other logic (e.g. stripe in future)
            // But for validation, if it's 'purchase' and not 'credits', maybe we just let it pass 
            // or block it if we don't have other payment methods yet.
            // Assuming credits is default for 'purchase' type for now.
            // If price > 0 but currency is different, handle it.
        }

        user.inventory.items.push(item._id);

        // Mark as early supporter if it was a purchase or premium item
        if (item.type === 'purchase' || item.type === 'premium') {
            user.isEarlySupporter = true;
        }

        await user.save();

        // Check for automatic badges (supporter badge etc)
        const { checkAutomaticBadges } = require('../services/badgeService');
        await checkAutomaticBadges(user._id);

        res.json({
            message: 'Item acquired!',
            item,
            newBalance: user.credits
        });
    } catch (error) {
        console.error('Buy Item Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
