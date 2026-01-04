const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Badge = require('../src/models/Badge');

const badges = [
    {
        name: 'Verified',
        description: 'Official verified account status.',
        icon: 'FaCheckCircle',
        color: '#3b82f6', // Blue
        rarity: 'rare',
        category: 'verified',
        slug: 'verified'
    },
    {
        name: 'Staff',
        description: 'Official Vynn Staff member.',
        icon: 'FaShieldAlt',
        color: '#ef4444', // Red
        rarity: 'legendary',
        category: 'supporter',
        slug: 'staff'
    },
    {
        name: 'Premium',
        description: 'Vynn Premium subscriber.',
        icon: 'FaGem',
        color: '#a78bfa', // Purple
        rarity: 'epic',
        category: 'supporter',
        slug: 'premium'
    },
    {
        name: 'Early Adopter',
        description: 'Joined Vynn during the beta phase.',
        icon: 'FaRocket',
        color: '#10b981', // Green
        rarity: 'epic',
        category: 'community',
        slug: 'early-adopter'
    },
    {
        name: 'Bug Hunter',
        description: 'Helped identify and fix bugs on Vynn.',
        icon: 'FaBug',
        color: '#f59e0b', // Amber
        rarity: 'rare',
        category: 'community',
        slug: 'bug-hunter'
    },
    {
        name: 'Content Creator',
        description: 'Official Content Creator on Vynn.',
        icon: 'FaVideo',
        color: '#ec4899', // Pink
        rarity: 'rare',
        category: 'community',
        slug: 'content-creator'
    }
];

const seedBadges = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB...');

        for (const badgeData of badges) {
            const exists = await Badge.findOne({ slug: badgeData.slug });
            if (!exists) {
                await Badge.create(badgeData);
                console.log(`Created badge: ${badgeData.name}`);
            } else {
                console.log(`Badge exists: ${badgeData.name}`);
            }
        }

        console.log('Badge seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding badges:', error);
        process.exit(1);
    }
};

seedBadges();
