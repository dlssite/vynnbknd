const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Frame = require('../src/models/Frame');
const StoreItem = require('../src/models/StoreItem');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const frames = await Frame.find({});
        console.log(`Found ${frames.length} frames to migrate.`);

        let count = 0;
        for (const frame of frames) {
            // Check if exists
            const existing = await StoreItem.findOne({ name: frame.name, itemType: 'frame' });
            if (existing) {
                console.log(`Skipping ${frame.name} (already exists)`);
                continue;
            }

            const newItem = new StoreItem({
                name: frame.name,
                imageUrl: frame.imageUrl,
                rarity: frame.rarity || 'common',
                type: frame.type || (frame.isPremium ? 'premium' : 'free'),
                price: frame.price || 0,
                itemType: 'frame',
                isActive: true
            });

            await newItem.save();
            console.log(`Migrated: ${frame.name}`);
            count++;
        }

        console.log(`Migration Complete. Moved ${count} frames.`);
        process.exit();
    } catch (error) {
        console.error('Migration Error:', error);
        process.exit(1);
    }
};

migrate();
