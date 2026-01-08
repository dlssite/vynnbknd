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

    // Credit System
    credits: {
        type: Number,
        default: 0,
        min: 0
    },
    creditHistory: [{
        amount: Number,
        type: {
            type: String,
            enum: ['earned', 'spent', 'refund', 'admin']
        },
        source: {
            type: String,
            enum: ['referral', 'purchase', 'level_up', 'achievement', 'admin', 'signup_bonus', 'daily', 'transfer']
        },
        description: String,
        relatedItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StoreItem'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Referral System
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        index: true
    },
    premiumReferralCode: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        index: true
        // Format: vynn+username
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referredByCode: String, // Track which code was used
    referrals: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        codeUsed: String, // Track which code they used
        referredAt: {
            type: Date,
            default: Date.now
        },
        rewardClaimed: {
            type: Boolean,
            default: false
        }
    }],
    referralStats: {
        totalReferrals: {
            type: Number,
            default: 0
        },
        activeReferrals: {
            type: Number,
            default: 0
        },
        totalXPEarned: {
            type: Number,
            default: 0
        },
        totalCreditsEarned: {
            type: Number,
            default: 0
        },
        referralClicks: {
            type: Number,
            default: 0
        }
    },

    onboardingCompleted: {
        type: Boolean,
        default: true
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLoginAt: Date,
    lastDaily: Date
}, {
    timestamps: true
});

// Generate unique referral code
userSchema.methods.generateReferralCode = async function () {
    if (this.referralCode) return this.referralCode;

    let isUnique = false;
    let newCode;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    while (!isUnique) {
        newCode = 'VYNN-';
        for (let i = 0; i < 4; i++) {
            newCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existing = await this.constructor.findOne({ referralCode: newCode });
        if (!existing) isUnique = true;
    }

    this.referralCode = newCode;
    return newCode;
};

// Generate premium referral code
userSchema.methods.generatePremiumReferralCode = async function () {
    if (!this.isPremium || !this.username) return null;

    // VYNN-USERNAME format (Uppercase)
    const code = `VYNN-${this.username.toUpperCase()}`;

    // Check if taken (unlikely unless username collision logic failed elsewhere)
    const existing = await this.constructor.findOne({ premiumReferralCode: code });
    if (existing && existing._id.toString() !== this._id.toString()) {
        return null; // Should handle this edge case if it ever happens
    }

    this.premiumReferralCode = code;
    return code;
};

// Add Credits
userSchema.methods.addCredits = async function (amount, source, description, relatedItem = null) {
    if (this.credits === undefined) this.credits = 0;
    if (!this.creditHistory) this.creditHistory = [];
    if (!this.referralStats) this.referralStats = { totalReferrals: 0, activeReferrals: 0, totalXPEarned: 0, totalCreditsEarned: 0 };

    this.credits += amount;
    this.creditHistory.push({
        amount,
        type: 'earned',
        source,
        description,
        relatedItem
    });

    if (source === 'referral') {
        this.referralStats.totalCreditsEarned += amount;
    }

    await this.save();
    return this.credits;
};

// Spend Credits
userSchema.methods.spendCredits = async function (amount, relatedItem, description) {
    if (this.credits === undefined) this.credits = 0;
    if (!this.creditHistory) this.creditHistory = [];

    if (this.credits < amount) {
        throw new Error('Insufficient credits');
    }

    this.credits -= amount;
    this.creditHistory.push({
        amount,
        type: 'spent',
        source: 'purchase',
        description,
        relatedItem
    });

    await this.save();
    return this.credits;
};

// Add Referral
userSchema.methods.addReferral = async function (userId, codeUsed) {
    if (!this.referrals) this.referrals = [];
    if (!this.referralStats) this.referralStats = { totalReferrals: 0, activeReferrals: 0, totalXPEarned: 0, totalCreditsEarned: 0 };

    // Check if already referred
    if (this.referrals.some(r => r.user.toString() === userId.toString())) {
        return;
    }

    this.referrals.push({
        user: userId,
        codeUsed,
        rewardClaimed: true // Rewards are given immediately in this implementation
    });

    this.referralStats.totalReferrals += 1;
    this.referralStats.activeReferrals += 1; // Initially active

    await this.save();
};

// Pre-save to handle premium code generation
userSchema.pre('save', async function (next) {
    // Initialize missing fields for legacy users to prevent crashes
    if (this.credits === undefined) this.credits = 0;
    if (!this.creditHistory) this.creditHistory = [];
    if (!this.referrals) this.referrals = [];
    if (!this.referralStats) {
        this.referralStats = {
            totalReferrals: 0,
            activeReferrals: 0,
            totalXPEarned: 0,
            totalCreditsEarned: 0,
            referralClicks: 0
        };
    }

    if (this.referralStats.referralClicks === undefined) {
        this.referralStats.referralClicks = 0;
    }

    // Ensure premium code exists if user is premium
    if (this.isPremium && !this.premiumReferralCode) {
        if (!this.username) {
            // If username not set yet (creation), wait for it? 
        } else {
            // VYNN-USERNAME format (Uppercase)
            const code = `VYNN-${this.username.toUpperCase()}`;
            // Check if exists
            const existing = await this.constructor.findOne({ premiumReferralCode: code });
            if (!existing) {
                this.premiumReferralCode = code;
            }
        }
    }

    // Generate standard code if missing (auto-migrate existing users)
    if (!this.referralCode) {
        let isUnique = false;
        let newCode;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        while (!isUnique) {
            newCode = 'VYNN-';
            for (let i = 0; i < 4; i++) {
                newCode += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            const existing = await this.constructor.findOne({ referralCode: newCode });
            if (!existing) isUnique = true;
        }
        this.referralCode = newCode;
    }

    next();
});

// Set verifiedAt when isVerified becomes true
userSchema.pre('save', async function (next) {
    // Generate random 4-digit tag for any user if missing or default
    if (!this.tag || this.tag === '0000') {
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
