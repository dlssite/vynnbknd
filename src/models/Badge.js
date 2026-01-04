const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    // Identity
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true
    },

    // Visual
    icon: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: '#6366f1'
    },

    // Classification
    category: {
        type: String,
        enum: ['achievement', 'supporter', 'verified', 'community', 'event', 'custom'],
        default: 'achievement'
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        default: 'common'
    },

    // System Control
    isSystem: {
        type: Boolean,
        default: false
    },
    systemKey: {
        type: String,
        unique: true,
        sparse: true
    },

    // Unlock Criteria
    unlockType: {
        type: String,
        enum: ['auto', 'manual', 'purchase', 'event'],
        default: 'auto'
    },
    unlockCriteria: {
        type: {
            type: String,
            enum: ['views', 'level', 'links', 'socials', 'days_active', 'none'],
            default: 'none'
        },
        value: {
            type: Number,
            default: 0
        }
    },

    // Availability
    isActive: {
        type: Boolean,
        default: true
    },
    isPremiumOnly: {
        type: Boolean,
        default: false
    },
    isLimitedEdition: {
        type: Boolean,
        default: false
    },
    availableUntil: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('Badge', badgeSchema);
