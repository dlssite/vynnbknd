const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    serverInviteLink: {
        type: String,
        default: 'https://discord.gg/vynn'
    },
    botInviteLink: {
        type: String,
        default: 'https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot'
    },
    announcement: {
        type: String,
        default: ''
    },
    botApiUrl: {
        type: String,
        default: null // Fallback to process.env.BOT_API_URL
    },
    primaryGuildId: {
        type: String,
        default: null // Fallback to process.env.PRIMARY_GUILD_ID
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure only one config document exists
systemConfigSchema.statics.getOrCreate = async function () {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({});
    }
    return config;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
