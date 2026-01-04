const mongoose = require('mongoose');

const visitSessionSchema = new mongoose.Schema({
    profileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
        index: true
    },
    // We store a unique token for the visitor (generated on frontend)
    // allowing us to count "Unique Visitors" without storing PII like raw IPs permanently
    visitorId: {
        type: String,
        required: true,
        index: true
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    lastPingAt: {
        type: Date,
        default: Date.now
    },
    duration: {
        type: Number,
        default: 0 // In seconds
    },

    // Metadata (Captured at start of session)
    country: {
        type: String,
        default: 'Unknown'
    },
    countryCode: {
        type: String,
        default: 'UN' // 'US', 'DE', etc.
    },
    deviceType: {
        type: String,
        default: 'desktop' // 'mobile', 'tablet', 'desktop'
    },
    browser: {
        type: String,
        default: 'Unknown'
    },
    os: {
        type: String,
        default: 'Unknown'
    },
    referrer: {
        type: String,
        default: 'Direct'
    },

    // Event Tracking
    // We'll store clicks as an array of objects to calculate CTR per link
    clicks: [{
        linkId: String,
        url: String,
        type: { type: String, enum: ['link', 'social', 'music', 'other'] },
        timestamp: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// Index for efficient querying of analytics (e.g. "Get stats for Profile X in last 7 days")
visitSessionSchema.index({ profileId: 1, startedAt: -1 });

module.exports = mongoose.model('VisitSession', visitSessionSchema);
