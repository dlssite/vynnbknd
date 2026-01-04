const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { parser, cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Profile = require('../models/Profile');

// ... (existing imports)

// @route   POST /api/upload/migrate
// @desc    Scan profile and recover active assets into the Vault
// @access  Private
router.post('/migrate', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const assetsToRecover = [];
        const pushIfValid = (url, type) => {
            if (url && typeof url === 'string' && url.startsWith('http')) {
                assetsToRecover.push({ url, type });
            }
        };

        // Scan potential asset fields
        pushIfValid(profile.avatar, 'image');
        pushIfValid(profile.banner, 'image');
        pushIfValid(profile?.themeConfig?.background?.url, profile?.themeConfig?.background?.type === 'video' ? 'video' : 'image');
        pushIfValid(profile?.themeConfig?.audio?.url, 'audio');
        pushIfValid(profile?.themeConfig?.cursorUrl, 'image'); // cursors are images

        let migratedCount = 0;

        for (const item of assetsToRecover) {
            // Check if already exists
            const existing = await Asset.findOne({ user: req.user._id, url: item.url });
            if (existing) continue;

            // Attempt to extract public ID from Cloudinary URL
            // Example: .../upload/v123456/folder/myimage.jpg -> folder/myimage
            let publicId = `legacy_recovered_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            try {
                if (item.url.includes('cloudinary')) {
                    const parts = item.url.split('/upload/');
                    if (parts.length > 1) {
                        const tail = parts[1]; // v12345/folder/id.jpg
                        const versionless = tail.replace(/^v\d+\//, ''); // folder/id.jpg
                        publicId = versionless.substring(0, versionless.lastIndexOf('.')); // folder/id
                    }
                }
            } catch (e) {
                console.warn('Failed to extract public ID, using fallback', e);
            }

            const newAsset = new Asset({
                user: req.user._id,
                url: item.url,
                publicId: publicId,
                type: item.type,
                folder: 'legacy_recovery',
                metadata: {
                    recovered: true,
                    originalSource: 'profile_migration'
                }
            });

            await newAsset.save();
            migratedCount++;
        }

        // Update user upload count
        if (migratedCount > 0) {
            const user = await User.findById(req.user._id);
            if (user && !['admin', 'super_admin'].includes(user.role)) {
                // We won't penalize them for legacy items, or should we?
                // Let's NOT increment uploadCount for recovered items to be nice, 
                // effectively giving them "free" slots for what they already had.
                // Or maybe we should? The prompt implies "it didn't fetch all my old uploads".
                // Let's increment to be consistent with the "Limit" logic, otherwise they have 105/100 files etc.
                // user.uploadCount += migratedCount; 
                // await user.save();

                // DECISION: Do NOT count recovered assets towards the limit. 
                // Treat them as "Legacy" bonus storage.
            }
        }

        res.json({
            message: `Migration complete. Recovered ${migratedCount} assets.`,
            migratedCount
        });

    } catch (error) {
        console.error('Migration Error:', error);
        res.status(500).json({ error: 'Server error during migration' });
    }
});

// @desc    Get all user assets
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const assets = await Asset.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(assets);
    } catch (error) {
        console.error('List Assets Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/upload
// @desc    Upload an asset to Cloudinary
// @access  Private
router.post('/', auth, parser.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findById(req.user._id);
        const limit = user.isPremium ? 100 : 5;
        const isAdmin = ['admin', 'super_admin'].includes(user.role);

        // Check limit for non-admins
        if (!isAdmin && user.uploadCount >= limit) {
            return res.status(403).json({
                error: `Upload limit reached (${limit} files). Upgrade to PRO for more storage.`
            });
        }

        // Create Asset record
        const asset = new Asset({
            user: user._id,
            url: req.file.path,
            name: req.body.name || req.file.originalname.split('.')[0],
            publicId: req.file.filename,
            type: req.file.mimetype.startsWith('image/') ? 'image' :
                req.file.mimetype.startsWith('video/') ? 'video' :
                    req.file.mimetype.startsWith('audio/') ? 'audio' : 'other',
            metadata: {
                size: req.file.size,
                format: req.file.mimetype.split('/')[1],
            }
        });
        await asset.save();

        // Increment upload count only for non-admins
        if (!isAdmin) {
            user.uploadCount += 1;
            await user.save();
        }

        res.json({
            asset,
            uploadCount: user.uploadCount,
            limit: isAdmin ? 'Unlimited' : limit
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// @route   DELETE /api/upload/:id
// @desc    Delete an asset
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const asset = await Asset.findOne({ _id: req.params.id, user: req.user._id });
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Delete from Cloudinary
        try {
            await cloudinary.uploader.destroy(asset.publicId);
        } catch (cloudinaryError) {
            console.error('Cloudinary Delete Error:', cloudinaryError);
            // Continue with DB deletion even if Cloudinary fails (maybe it was deleted manually)
        }

        // Delete from DB
        await Asset.findByIdAndDelete(asset._id);

        // Decrement upload count for non-admins
        const user = await User.findById(req.user._id);
        const isAdmin = ['admin', 'super_admin'].includes(user.role);

        if (!isAdmin && user.uploadCount > 0) {
            user.uploadCount -= 1;
            await user.save();
        }

        res.json({ message: 'Asset deleted successfully', uploadCount: user.uploadCount });
    } catch (error) {
        console.error('Delete Asset Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/upload/delete-batch
// @desc    Delete multiple assets
// @access  Private
router.post('/delete-batch', auth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs array required' });
        }

        const assets = await Asset.find({ _id: { $in: ids }, user: req.user._id });
        if (assets.length === 0) {
            return res.status(404).json({ error: 'No assets found' });
        }

        // Delete from Cloudinary
        for (const asset of assets) {
            try {
                await cloudinary.uploader.destroy(asset.publicId);
            } catch (err) {
                console.error(`Failed to delete asset ${asset.publicId} from Cloudinary`, err);
            }
        }

        // Delete from DB
        await Asset.deleteMany({ _id: { $in: assets.map(a => a._id) } });

        // Update user upload count
        const user = await User.findById(req.user._id);
        const isAdmin = ['admin', 'super_admin'].includes(user.role);

        if (!isAdmin) {
            const newCount = await Asset.countDocuments({ user: user._id });
            user.uploadCount = newCount;
            await user.save();
        }

        res.json({ message: 'Assets deleted successfully', uploadCount: user.uploadCount });
    } catch (error) {
        console.error('Batch Delete Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/upload/stats
// @desc    Get user upload stats
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const limit = user.isPremium ? 100 : 5;
        const isAdmin = ['admin', 'super_admin'].includes(user.role);

        res.json({
            uploadCount: user.uploadCount || 0,
            limit: isAdmin ? 999999 : limit,
            isAdmin
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
