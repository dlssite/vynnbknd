const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    url: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: 'Untitled Asset'
    },
    publicId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['image', 'video', 'audio', 'other'],
        default: 'image'
    },
    folder: {
        type: String,
        default: 'forge'
    },
    metadata: {
        size: Number,
        format: String,
        width: Number,
        height: Number
    }
}, {
    timestamps: true
});

// Index for faster user-specific lookups
assetSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Asset', assetSchema);
