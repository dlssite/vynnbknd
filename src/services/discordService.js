const axios = require('axios');
const SystemConfig = require('../models/SystemConfig');

/**
 * Helper to get the current bot configuration
 */
const getBotConfig = async () => {
    const config = await SystemConfig.getOrCreate();
    return {
        url: config.botApiUrl || process.env.BOT_API_URL || 'http://localhost:6000',
        guildId: config.primaryGuildId || process.env.PRIMARY_GUILD_ID
    };
};

/**
 * Fetches Discord presence using Bot API.
 */
const getDiscordPresence = async (discordId) => {
    try {
        if (!discordId) return null;

        const config = await getBotConfig();
        const response = await axios.get(`${config.url}/presence/${discordId}`);

        if (response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error('Discord Bot API Error:', error.message);
        return null;
    }
};

/**
 * Fetches Discord member info from the bot API.
 */
const getDiscordMemberInfo = async (discordId) => {
    try {
        if (!discordId) return null;

        const config = await getBotConfig();
        const response = await axios.get(`${config.url}/member/${discordId}`, {
            params: { guildId: config.guildId }
        });

        if (response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return { is_member: false, is_booster: false };
        }
        console.error('Discord Bot Member API Error:', error.message);
        return null;
    }
};

/**
 * Fetches Discord server information from the bot API.
 */
const getDiscordServerInfo = async (inviteOrId) => {
    try {
        if (!inviteOrId) return null;

        const config = await getBotConfig();
        const response = await axios.get(`${config.url}/server/${inviteOrId}`);

        if (response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error('Discord Bot Server API Error:', error.message);
        return null;
    }
};

module.exports = {
    getDiscordPresence,
    getDiscordMemberInfo,
    getDiscordServerInfo
};
