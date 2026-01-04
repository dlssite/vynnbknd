const axios = require('axios');

/**
 * Fetches Discord presence using Lanyard API.
 * Lanyard requires the user to be in the Lanyard Discord server (discord.gg/lanyard)
 * to work automatically.
 * 
 * @param {string} discordId - The user's Discord ID.
 * @returns {Promise<Object|null>} - Presence data or null if not found.
 */
const getDiscordPresence = async (discordId) => {
    try {
        if (!discordId) return null;

        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:6000';
        const response = await axios.get(`${BOT_API_URL}/presence/${discordId}`);

        if (response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        // If 404, it means the user is not in any shared servers with the bot
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error('Discord Bot API Error:', error.message);
        return null;
    }
};

/**
 * Fetches Discord member info (membership & boosting status) from the bot API.
 * @param {string} discordId - The user's Discord ID.
 * @returns {Promise<Object|null>} - Member info or null if not found.
 */
const getDiscordMemberInfo = async (discordId) => {
    try {
        if (!discordId) return null;

        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:6000';
        const response = await axios.get(`${BOT_API_URL}/member/${discordId}`);

        if (response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        // If 404, user is not in the server
        if (error.response && error.response.status === 404) {
            return { is_member: false, is_booster: false };
        }
        console.error('Discord Bot Member API Error:', error.message);
        return null;
    }
};

/**
 * Fetches Discord server information (metadata) from the bot API.
 * @param {string} inviteOrId - The Discord Server ID or Invite Link.
 * @returns {Promise<Object|null>} - Server info or null if not found.
 */
const getDiscordServerInfo = async (inviteOrId) => {
    try {
        if (!inviteOrId) return null;

        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:6000';
        const response = await axios.get(`${BOT_API_URL}/server/${inviteOrId}`);

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
