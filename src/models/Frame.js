const mongoose = require('mongoose');

const frameSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    imageUrl: {
        type: String, // Can be a URL to a PNG, GIF, or APNG
        required: true
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary', 'event'],
        default: 'common'
    },
    type: {
        type: String,
        enum: ['free', 'premium', 'purchase', 'exclusive'],
        default: 'free'
    },
    price: {
        type: Number, // In virtual currency if applicable, otherwise 0
        default: 0
    },
    currency: {
        type: String,
        enum: ['credits', 'points'], // Example currencies
        default: 'credits'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Frame', frameSchema);
