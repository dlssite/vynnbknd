const mongoose = require('mongoose');

const storeItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    imageUrl: {
        type: String,
        required: true
    },
    itemType: {
        type: String,
        required: true,
        enum: ['frame', 'cursor', 'background', 'audio', 'avatar', 'banner', 'badge', 'sticker', 'effect'],
        index: true
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary', 'event', 'mythic'],
        default: 'common'
    },
    type: {
        type: String,
        enum: ['free', 'premium', 'purchase', 'exclusive'],
        default: 'free'
    },
    price: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'credits'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {} // specific props like cursor hotspot { x: 0, y: 0 }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('StoreItem', storeItemSchema);
