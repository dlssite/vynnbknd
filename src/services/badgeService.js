const Badge = require('../models/Badge');
const User = require('../models/User');
const { getDiscordMemberInfo } = require('./discordService');

/**
 * Initializes system badges if they don't exist.
 */
const initSystemBadges = async () => {
    const systemBadges = [
        {
            name: 'Discord Member',
            slug: 'discord-member',
            description: 'A dedicated member of the Vynn Official Server.',
            icon: 'FaDiscord',
            color: '#5865F2',
            category: 'community',
            isSystem: true,
            systemKey: 'discord_member'
        },
        {
            name: 'Server Booster',
            slug: 'discord-booster',
            description: 'Supporting the Vynn community through Nitro Boosting.',
            icon: 'FaFire',
            color: '#ff73fa',
            category: 'supporter',
            isSystem: true,
            systemKey: 'discord_booster'
        },
        {
            name: 'Verified',
            slug: 'verified',
            description: 'This user has been officially verified by the Vynn team.',
            icon: 'FaCheckCircle',
            color: '#3b82f6',
            category: 'verified',
            isSystem: true,
            systemKey: 'verified'
        }
    ];

    for (const badgeData of systemBadges) {
        await Badge.findOneAndUpdate(
            { name: badgeData.name },
            badgeData,
            { upsert: true, new: true }
        );
    }
};

/**
 * Syncs Discord-related badges for a user.
 * @param {Object} user - The user document.
 */
const syncUserDiscordBadges = async (user) => {
    if (!user.discord || !user.discord.id) return;

    try {
        const memberInfo = await getDiscordMemberInfo(user.discord.id);
        if (!memberInfo) return;

        // Fetch the system badges
        const badges = await Badge.find({ systemKey: { $in: ['discord_member', 'discord_booster'] } });
        const memberBadge = badges.find(b => b.systemKey === 'discord_member');
        const boosterBadge = badges.find(b => b.systemKey === 'discord_booster');

        const currentBadgeIds = user.badges.map(b => b.toString());
        let updated = false;

        // Handle Membership
        if (memberInfo.is_member && memberBadge) {
            if (!currentBadgeIds.includes(memberBadge._id.toString())) {
                user.badges.push(memberBadge._id);
                updated = true;
            }
        } else if (!memberInfo.is_member && memberBadge) {
            if (currentBadgeIds.includes(memberBadge._id.toString())) {
                user.badges = user.badges.filter(id => id.toString() !== memberBadge._id.toString());
                updated = true;
            }
        }

        // Handle Boosting
        if (memberInfo.is_booster && boosterBadge) {
            if (!currentBadgeIds.includes(boosterBadge._id.toString())) {
                user.badges.push(boosterBadge._id);
                updated = true;
            }
        } else if (!memberInfo.is_booster && boosterBadge) {
            if (currentBadgeIds.includes(boosterBadge._id.toString())) {
                user.badges = user.badges.filter(id => id.toString() !== boosterBadge._id.toString());
                updated = true;
            }
        }

        if (updated) {
            await user.save();
        }
    } catch (error) {
        console.error('Error syncing Discord badges:', error);
    }
};

module.exports = {
    initSystemBadges,
    syncUserDiscordBadges
};
