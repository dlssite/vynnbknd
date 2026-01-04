const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    url: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: 'link'
    },
    order: {
        type: Number,
        default: 0
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    clicks: {
        type: Number,
        default: 0
    }
});

const socialSchema = new mongoose.Schema({
    platform: {
        type: String,
        required: true,
        enum: ['discord', 'twitter', 'instagram', 'youtube', 'twitch', 'spotify', 'github', 'tiktok', 'steam', 'other']
    },
    username: String,
    url: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    },
    isVisible: {
        type: Boolean,
        default: true
    }
});

const profileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // Bio
    bio: {
        type: String,
        maxlength: 500,
        default: ''
    },

    // Avatar & Banner
    avatar: {
        type: String,
        default: ''
    },
    banner: {
        type: String,
        default: ''
    },

    // Theme & Customization (Advanced - Aesthetic Forge)
    themeConfig: {
        colors: {
            primary: { type: String, default: '#FF4500' },
            secondary: { type: String, default: '#ffffff' },
            accent: { type: String, default: '#FF8C00' },
            background: { type: String, default: '#050505' },
            text: { type: String, default: '#ffffff' },
            cardBackground: { type: String, default: 'rgba(255, 255, 255, 0.05)' }
        },
        background: {
            type: { type: String, enum: ['color', 'image', 'video'], default: 'color' },
            url: { type: String, default: '' },
            opacity: { type: Number, default: 0.5 },
            blur: { type: Number, default: 0 },
            isMuted: { type: Boolean, default: true }
        },
        effects: {
            background: { type: String, default: 'none' }, // 'none', 'rain', 'snow', 'scanlines', 'vhs'
            username: { type: String, default: 'none' },   // 'none', 'glow', 'rainbow', 'sparkle'
        },
        glowSettings: {
            username: { type: Boolean, default: true },
            socials: { type: Boolean, default: true },
            badges: { type: Boolean, default: true }
        },
        appearance: {
            profileOpacity: { type: Number, default: 0.5 },
            profileBlur: { type: Number, default: 0 }
        },
        presence: {
            discord: { type: Boolean, default: false },
            type: { type: String, enum: ['user', 'server'], default: 'user' },
            serverId: { type: String, default: '' } // Can be Server ID or Invite Link
        },
        audio: {
            url: { type: String, default: '' },
            autoPlay: { type: Boolean, default: false }
        },
        cursorUrl: { type: String, default: '' }
    },

    // User Saved Templates
    templates: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        config: { type: Object, required: true }, // Snapshotted themeConfig
        createdAt: { type: Date, default: Date.now }
    }],

    // Links & Socials
    links: [linkSchema],
    socials: [socialSchema],

    // Frame
    frame: {
        type: mongoose.Schema.Types.Mixed, // Supports ObjectId ref or URL string
        default: null
    },

    // Badges to display
    displayedBadges: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge'
    }],

    // Creator Features
    commissionStatus: {
        isOpen: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            maxlength: 200,
            default: ''
        }
    },

    // Content Settings
    isNSFW: {
        type: Boolean,
        default: false
    },

    // Analytics
    views: {
        type: Number,
        default: 0
    },
    showViewCount: {
        type: Boolean,
        default: true
    },

    // Visibility
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Increment view count
profileSchema.methods.incrementViews = async function () {
    this.views += 1;
    await this.save();
    return this.views;
};

module.exports = mongoose.model('Profile', profileSchema);
