const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Auth
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },

    // Roles & Permissions
    role: {
        type: String,
        enum: ['user', 'admin', 'super_admin'],
        default: 'user'
    },

    // Profile Identity
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
        match: /^[a-z0-9_]+$/
    },
    displayName: {
        type: String,
        maxlength: 50,
        default: ''
    },
    tag: {
        type: String,
        default: '0000',
        match: /^[0-9]{4}$/
    },

    // Discord Connection (optional)
    discord: {
        id: String,
        username: String,
        discriminator: String,
        avatar: String,
        avatarUrl: String,
        banner: String,
        bannerUrl: String,
        bannerColor: String,
        decoration: String,
        decorationUrl: String,
        profileEffectId: String,
        accessToken: String,
        refreshToken: String,
        connectedAt: Date,
        isBooster: { type: Boolean, default: false }
    },

    isEarlySupporter: {
        type: Boolean,
        default: false
    },

    // XP & Leveling
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    badges: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge'
    }],

    // Account Status
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: Date,
    isPremium: {
        type: Boolean,
        default: false
    },
    isLifetimePremium: {
        type: Boolean,
        default: false
    },
    premiumUntil: Date,
    uploadCount: {
        type: Number,
        default: 0
    },

    // Inventory
    inventory: {
        items: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StoreItem'
        }]
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLoginAt: Date
}, {
    timestamps: true
});

// Set verifiedAt when isVerified becomes true
userSchema.pre('save', async function (next) {
    // Generate random 4-digit tag for new users if not set
    if (this.isNew && (!this.tag || this.tag === '0000')) {
        let isUnique = false;
        let newTag;

        while (!isUnique) {
            newTag = Math.floor(1000 + Math.random() * 9000).toString();
            const existing = await this.constructor.findOne({ username: this.username, tag: newTag });
            if (!existing) isUnique = true;
        }
        this.tag = newTag;
    }

    if (this.isModified('isVerified') && this.isVerified && !this.verifiedAt) {
        this.verifiedAt = new Date();
    }
    next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Calculate level from XP
userSchema.methods.calculateLevel = function () {
    // Level formula: level = floor(sqrt(xp / 100)) + 1
    return Math.floor(Math.sqrt(this.xp / 100)) + 1;
};

// Add XP and update level
userSchema.methods.addXP = async function (amount) {
    this.xp += amount;
    this.level = this.calculateLevel();
    await this.save();
    return { xp: this.xp, level: this.level };
};

module.exports = mongoose.model('User', userSchema);
