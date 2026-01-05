const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Profile = require('../models/Profile');
const Badge = require('../models/Badge');
const SystemConfig = require('../models/SystemConfig');
const VisitSession = require('../models/VisitSession');
const { requireAdmin, requireSuperAdmin } = require('../middleware/adminAuth');

// @route   GET /api/admin/stats
// @desc    Get dashboard overview stats
// @access  Admin
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProfiles = await Profile.countDocuments();
        const totalBadges = await Badge.countDocuments();

        // Get recent users (last 5)
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('-password');

        res.json({
            counts: {
                users: totalUsers,
                profiles: totalProfiles,
                badges: totalBadges
            },
            recentUsers
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/analytics
// @desc    Get chart data for the main dashboard (Compatible format)
// @access  Admin
router.get('/analytics', requireAdmin, async (req, res) => {
    try {
        // Last 7 days labels
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayIdx = new Date().getDay();
        const orderedLabels = [];
        for (let i = 0; i < 7; i++) {
            orderedLabels.push(labels[(todayIdx - 6 + i + 7) % 7]);
        }

        // Fetch real growth data for last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const growthData = await User.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Map to labels (simplified for compatibility)
        const userGrowthMapped = orderedLabels.map((name, i) => {
            const dateStr = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const match = growthData.find(d => d._id === dateStr);
            return { name, users: match ? match.count : 0 };
        });

        // Activity (Views + Simulated Revenue for UI)
        const activityMapped = orderedLabels.map((name, i) => ({
            name,
            views: Math.floor(Math.random() * 200) + 50, // We don't track historical view counts per day yet
            revenue: Math.floor(Math.random() * 50) + 10
        }));

        res.json({
            userGrowth: userGrowthMapped,
            activity: activityMapped
        });
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/analytics/detailed
// @desc    Get comprehensive metrics and leaderboards
// @access  Admin
router.get('/analytics/detailed', requireAdmin, async (req, res) => {
    try {
        // 1. Top Users by Profile Views
        const topViewedProfiles = await Profile.find()
            .sort({ views: -1 })
            .limit(10)
            .populate('user', 'username displayName avatar email');

        // 2. Deep Metrics (Technical, Social, Health)
        const profiles = await Profile.find().select('themeConfig frame socials isNSFW views');
        const users = await User.find().select('xp level isPremium isLifetimePremium lastLoginAt inventory badges');

        const itemUsage = {
            frames: {},
            cursors: {},
            audio: {},
            bgEffects: {},
            bgTypes: { color: 0, image: 0, video: 0 },
            socialPlatforms: {}
        };

        profiles.forEach(p => {
            // Asset Usage
            if (p.frame) itemUsage.frames[p.frame] = (itemUsage.frames[p.frame] || 0) + 1;
            if (p.themeConfig?.cursorUrl) itemUsage.cursors[p.themeConfig.cursorUrl] = (itemUsage.cursors[p.themeConfig.cursorUrl] || 0) + 1;
            if (p.themeConfig?.audio?.url) itemUsage.audio[p.themeConfig.audio.url] = (itemUsage.audio[p.themeConfig.audio.url] || 0) + 1;

            // Technical Preference
            const bgType = p.themeConfig?.background?.type || 'color';
            itemUsage.bgTypes[bgType] = (itemUsage.bgTypes[bgType] || 0) + 1;

            // Visual Effects
            if (p.themeConfig?.effects?.background) {
                const effect = p.themeConfig.effects.background;
                itemUsage.bgEffects[effect] = (itemUsage.bgEffects[effect] || 0) + 1;
            }

            // Social Ecosystem
            p.socials?.forEach(s => {
                itemUsage.socialPlatforms[s.platform] = (itemUsage.socialPlatforms[s.platform] || 0) + 1;
            });
        });

        // 3. User Health & Tier Distribution
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const health = {
            avgLevel: users.length ? (users.reduce((acc, u) => acc + (u.level || 1), 0) / users.length).toFixed(1) : 1,
            avgXP: users.length ? Math.floor(users.reduce((acc, u) => acc + (u.xp || 0), 0) / users.length) : 0,
            activeSevenDays: users.filter(u => u.lastLoginAt && u.lastLoginAt >= sevenDaysAgo).length,
            nsfwProfiles: profiles.filter(p => p.isNSFW).length,
            totalInventoryItems: users.reduce((acc, u) => acc + (u.inventory?.items?.length || 0), 0),
            totalBadgesEarned: users.reduce((acc, u) => acc + (u.badges?.length || 0), 0)
        };

        const tiers = {
            free: users.filter(u => !u.isPremium && !u.isLifetimePremium).length,
            pro: users.filter(u => u.isPremium && !u.isLifetimePremium).length,
            lifetime: users.filter(u => u.isLifetimePremium).length
        };

        // 4. User Growth (Real data)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const growth = await User.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json({
            leaderboard: topViewedProfiles.map(p => ({
                username: p.user?.username,
                displayName: p.user?.displayName,
                views: p.views,
                userId: p.user?._id
            })),
            itemMetrics: itemUsage,
            healthMetrics: health,
            tierBreakdown: tiers,
            growth: growth.map(g => ({ date: g._id, users: g.count }))
        });
    } catch (error) {
        console.error('Detailed Analytics Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/users/:id/metrics
// @desc    Get specific user's metrics
// @access  Admin
router.get('/users/:id/metrics', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('inventory.items')
            .populate('badges')
            .populate('referredBy', 'username email');

        if (!user) return res.status(404).json({ error: 'User not found' });

        const profile = await Profile.findOne({ user: req.params.id })
            .populate('frame')
            .populate('displayedBadges');

        // Get people this user referred
        const referrals = await User.find({ referredBy: user._id })
            .select('username email createdAt referralStats');

        // Aggregated Visit Analytics for this specific profile
        let analytics = {
            totalUniqueVisitors: 0,
            deviceBreakdown: {},
            countryBreakdown: {},
            referrerBreakdown: {}
        };

        if (profile) {
            const visitorStats = await VisitSession.aggregate([
                { $match: { profileId: profile._id } },
                {
                    $group: {
                        _id: null,
                        uniqueVisitors: { $addToSet: "$visitorId" },
                        devices: { $push: "$deviceType" },
                        countries: { $push: "$country" },
                        referrers: { $push: "$referrer" }
                    }
                }
            ]);

            if (visitorStats.length > 0) {
                const stats = visitorStats[0];
                analytics.totalUniqueVisitors = stats.uniqueVisitors.length;

                // Simple frequency counts
                const countOccurrences = (arr) => arr.reduce((acc, curr) => {
                    acc[curr] = (acc[curr] || 0) + 1;
                    return acc;
                }, {});

                analytics.deviceBreakdown = countOccurrences(stats.devices);
                analytics.countryBreakdown = countOccurrences(stats.countries);
                analytics.referrerBreakdown = countOccurrences(stats.referrers);
            }
        }

        res.json({
            // Core Identity Mirror
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            isOnline: user.lastLoginAt && (new Date() - new Date(user.lastLoginAt) < 1000 * 60 * 5),
            avatar: profile?.avatar,
            banner: profile?.banner,

            // Progression
            xp: user.xp,
            level: user.level,
            badges: user.badges,

            // Economy
            credits: user.credits,
            creditHistory: user.creditHistory || [],

            // Assets
            inventory: user.inventory?.items || [],
            frame: profile?.frame,
            displayedBadges: profile?.displayedBadges,

            // Profile Config
            bio: profile?.bio,
            themeConfig: profile?.themeConfig,
            links: profile?.links,
            socials: profile?.socials,

            // Engagement & Analytics
            views: profile?.views || 0,
            analytics,

            // System Stats
            joinedAt: user.createdAt,
            lastLogin: user.lastLoginAt,
            uploadCount: user.uploadCount || 0,

            // Referral Network
            referralStats: user.referralStats,
            referredBy: user.referredBy,
            codeUsed: user.referredByCode,
            referralNetwork: referrals.map(r => ({
                id: r._id,
                username: r.username,
                email: r.email,
                joinedAt: r.createdAt,
                stats: r.referralStats
            }))
        });
    } catch (error) {
        console.error('User metrics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/premium
// @desc    Manage user premium status
// @access  Super Admin
router.put('/users/:id/premium', requireSuperAdmin, async (req, res) => {
    try {
        const { type, months } = req.body; // type: 'none', 'limited', 'lifetime'

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (type === 'none') {
            user.isPremium = false;
            user.isLifetimePremium = false;
            user.premiumUntil = null;
        } else if (type === 'lifetime') {
            user.isPremium = true;
            user.isLifetimePremium = true;
            user.premiumUntil = null;
        } else if (type === 'limited') {
            user.isPremium = true;
            user.isLifetimePremium = false;

            const currentExpiry = user.premiumUntil && user.premiumUntil > new Date()
                ? new Date(user.premiumUntil)
                : new Date();

            currentExpiry.setMonth(currentExpiry.getMonth() + (months || 1));
            user.premiumUntil = currentExpiry;
        }

        await user.save();

        // Check for premium badge immediately
        const { checkAutomaticBadges } = require('../services/badgeService');
        await checkAutomaticBadges(user._id);

        res.json({
            message: 'Premium status updated',
            isPremium: user.isPremium,
            isLifetime: user.isLifetimePremium,
            premiumUntil: user.premiumUntil
        });
    } catch (error) {
        console.error('Premium Management Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users (paginated + search)
// @access  Admin
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const query = {};
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalUsers: total
        });
    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Super Admin
router.put('/users/:id/role', requireSuperAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent modifying other super admins unless self (optional, but good practice)
        // For now, let's just allow it for simplicity as per "Super Admin" power.

        user.role = role;
        await user.save();

        res.json({ message: 'User role updated', user: { _id: user._id, role: user.role } });
    } catch (error) {
        console.error('Update Role Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});



// @route   PUT /api/admin/users/:id/verify
// @desc    Toggle user verification
// @access  Admin
router.put('/users/:id/verify', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isVerified = !user.isVerified;
        await user.save();

        // Check for automatic badges (Early Adopter)
        const { checkAutomaticBadges } = require('../services/badgeService');
        await checkAutomaticBadges(user._id);

        res.json({ message: `User ${user.isVerified ? 'verified' : 'unverified'}`, isVerified: user.isVerified });
    } catch (error) {
        console.error('Verify User Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/profiles
// @desc    Get all profiles (paginated + search by username)
// @access  Admin
router.get('/profiles', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = req.query.search || '';

        let query = {};
        if (search) {
            // Find users matching search first, then find profiles for those users
            const users = await User.find({ username: { $regex: search, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            query.user = { $in: userIds };
        }

        const profiles = await Profile.find(query)
            .populate('user', 'username email isVerified')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Profile.countDocuments(query);

        res.json({
            profiles,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalProfiles: total
        });
    } catch (error) {
        console.error('Get Profiles Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/admin/badges
// @desc    Get all badges
// @access  Admin
router.get('/badges', requireAdmin, async (req, res) => {
    try {
        const badges = await Badge.find().sort({ createdAt: -1 });
        res.json(badges);
    } catch (error) {
        console.error('Get Badges Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/badges
// @desc    Create a new badge
// @access  Super Admin
router.post('/badges', requireSuperAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, rarity, category } = req.body;

        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        // Check if slug exists
        const existingBadge = await Badge.findOne({ slug });
        if (existingBadge) {
            return res.status(400).json({ error: 'Badge with this name already exists' });
        }

        const badge = new Badge({
            name,
            slug,
            description,
            icon,
            color,
            rarity,
            category,
            isSystem: false // Manual badges can never be system badges
        });

        await badge.save();
        res.json(badge);
    } catch (error) {
        console.error('Create Badge Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/badges/:id
// @desc    Update a badge
// @access  Super Admin
router.put('/badges/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { name, description, icon, color, rarity, category } = req.body;

        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ error: 'Badge not found' });

        // Protect system badges: only allow icon and color updates
        if (badge.isSystem) {
            if (icon) badge.icon = icon;
            if (color) badge.color = color;
            if (description) badge.description = description;
            // Name and Slug are locked for system badges
        } else {
            if (name) {
                badge.name = name;
                badge.slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            }
            if (description) badge.description = description;
            if (icon) badge.icon = icon;
            if (color) badge.color = color;
            if (rarity) badge.rarity = rarity;
            if (category) badge.category = category;
        }

        await badge.save();
        res.json(badge);
    } catch (error) {
        console.error('Update Badge Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/admin/badges/:id
// @desc    Delete a badge
// @access  Super Admin
router.delete('/badges/:id', requireSuperAdmin, async (req, res) => {
    try {
        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ error: 'Badge not found' });

        if (badge.isSystem) {
            return res.status(403).json({ error: 'System badges cannot be deleted' });
        }

        await badge.deleteOne();
        res.json({ message: 'Badge removed' });
    } catch (error) {
        console.error('Delete Badge Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/badges/assign
// @desc    Assign badge to user
// @access  Admin
router.post('/badges/assign', requireAdmin, async (req, res) => {
    try {
        const { userId, badgeId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const badge = await Badge.findById(badgeId);
        if (!badge) return res.status(404).json({ error: 'Badge not found' });

        if (user.badges.includes(badgeId)) {
            return res.status(400).json({ error: 'User already has this badge' });
        }

        user.badges.push(badgeId);
        await user.save();

        res.json({ message: 'Badge assigned successfully', userBadges: user.badges });
    } catch (error) {
        console.error('Assign Badge Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// ---------------------------------------------------------------------
// FRAME MANAGEMENT
// ---------------------------------------------------------------------
const Frame = require('../models/Frame');

// @route   GET /api/admin/frames
// @desc    Get all frames
// @access  Admin
router.get('/frames', requireAdmin, async (req, res) => {
    try {
        const frames = await Frame.find().sort({ createdAt: -1 });
        res.json(frames);
    } catch (error) {
        console.error('Get Frames Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/frames
// @desc    Create a new frame
// @access  Super Admin
router.post('/frames', requireSuperAdmin, async (req, res) => {
    try {
        const { name, imageUrl, rarity, isPremium } = req.body;

        const existing = await Frame.findOne({ name });
        if (existing) return res.status(400).json({ error: 'Frame name exists' });

        const frame = new Frame({ name, imageUrl, rarity, isPremium });
        await frame.save();
        res.json(frame);
    } catch (error) {
        console.error('Create Frame Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------------------------------------------------------------------
// STORE MANAGEMENT
// ---------------------------------------------------------------------
const StoreItem = require('../models/StoreItem');

// @route   GET /api/admin/store-items
// @desc    Get all store items
// @access  Admin
router.get('/store-items', requireAdmin, async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};
        if (type && type !== 'all') {
            query.itemType = type;
        }

        const items = await StoreItem.find(query).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        console.error('Get Store Items Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/admin/store-items
// @desc    Create a new store item
// @access  Super Admin
router.post('/store-items', requireSuperAdmin, async (req, res) => {
    try {
        const { name, imageUrl, rarity, type, price, itemType, metadata } = req.body;

        const existing = await StoreItem.findOne({ name });
        if (existing) return res.status(400).json({ error: 'Item name exists' });

        const item = new StoreItem({ name, imageUrl, rarity, type, price, itemType, metadata });
        await item.save();
        res.json(item);
    } catch (error) {
        console.error('Create Store Item Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/store-items/:id
// @desc    Update a store item
// @access  Super Admin
router.put('/store-items/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { name, imageUrl, rarity, type, price, itemType, metadata, isActive } = req.body;

        const item = await StoreItem.findByIdAndUpdate(
            req.params.id,
            { name, imageUrl, rarity, type, price, itemType, metadata, isActive },
            { new: true }
        );

        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (error) {
        console.error('Update Store Item Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/admin/store-items/:id
// @desc    Delete a store item
// @access  Super Admin
router.delete('/store-items/:id', requireSuperAdmin, async (req, res) => {
    try {
        await StoreItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Delete Item Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------------------------------------------------------------------
// SYSTEM CONFIGURATION
// ---------------------------------------------------------------------

// @route   GET /api/admin/config
// @desc    Get full system configuration
// @access  Super Admin
router.get('/config', requireSuperAdmin, async (req, res) => {
    try {
        const config = await SystemConfig.getOrCreate();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/admin/config
// @desc    Update system configuration
// @access  Super Admin
router.put('/config', requireSuperAdmin, async (req, res) => {
    try {
        const { serverInviteLink, botInviteLink, announcement, botApiUrl, primaryGuildId } = req.body;
        const config = await SystemConfig.getOrCreate();

        if (serverInviteLink !== undefined) config.serverInviteLink = serverInviteLink;
        if (botInviteLink !== undefined) config.botInviteLink = botInviteLink;
        if (announcement !== undefined) config.announcement = announcement;
        if (botApiUrl !== undefined) config.botApiUrl = botApiUrl;
        if (primaryGuildId !== undefined) config.primaryGuildId = primaryGuildId;
        config.updatedBy = req.user._id;

        await config.save();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
