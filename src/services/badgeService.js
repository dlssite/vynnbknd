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
        },
        {
            name: 'Recruiter',
            slug: 'recruiter',
            description: 'Invited 5 friends to join the platform.',
            icon: 'FaUserPlus',
            color: '#10b981',
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_recruiter'
        },
        {
            name: 'Ambassador',
            slug: 'ambassador',
            description: 'Invited 25 friends. A true advocate for Vynn.',
            icon: 'FaBullhorn',
            color: '#f59e0b',
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_ambassador'
        },
        {
            name: 'Legend',
            slug: 'legend',
            description: 'Invited 100 friends. You are a community legend.',
            icon: 'FaCrown',
            color: '#a855f7',
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_legend'
        },
        // 500+ Milestones
        {
            name: 'Icon',
            slug: 'icon',
            description: 'Reached 500 referrals. You are an icon of the community.',
            icon: 'FaStar',
            color: '#3b82f6', // Blue
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_icon'
        },
        {
            name: 'Titan',
            slug: 'titan',
            description: 'Reached 1,000 referrals. A titanic effort.',
            icon: 'FaDumbbell',
            color: '#8b5cf6', // Violet
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_titan'
        },
        {
            name: 'Warlord',
            slug: 'warlord',
            description: 'Reached 2,500 referrals. You command an army.',
            icon: 'FaFistRaised',
            color: '#ef4444', // Red
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_warlord'
        },
        {
            name: 'Emperor',
            slug: 'emperor',
            description: 'Reached 5,000 referrals. You rule the realm.',
            icon: 'FaChessKing',
            color: '#eab308', // Yellow/Gold
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_emperor'
        },
        {
            name: 'Godlike',
            slug: 'godlike',
            description: 'Reached 10,000 referrals. Unstoppable.',
            icon: 'FaBolt',
            color: '#ec4899', // Pink/Neon
            category: 'achievement',
            isSystem: true,
            systemKey: 'referral_godlike'
        },
        // View Milestones
        {
            name: 'Observer',
            slug: 'observer',
            description: 'Reached 500 profile views. People are watching.',
            icon: 'FaEye',
            color: '#94a3b8',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_observer'
        },
        {
            name: 'Rising Star',
            slug: 'rising-star',
            description: 'Reached 1,000 profile views. You\'re gaining traction.',
            icon: 'FaChartLine',
            color: '#fbbf24',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_rising_star'
        },
        {
            name: 'Socialite',
            slug: 'socialite',
            description: 'Reached 2,500 profile views. A social butterfly.',
            icon: 'FaUsers',
            color: '#818cf8',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_socialite'
        },
        {
            name: 'Influencer',
            slug: 'influencer',
            description: 'Reached 5,000 profile views. Your voice matters.',
            icon: 'FaMicrophone',
            color: '#f472b6',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_influencer'
        },
        {
            name: 'Superstar',
            slug: 'superstar',
            description: 'Reached 10,000 profile views. A household name.',
            icon: 'FaStar',
            color: '#fb7185',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_superstar'
        },
        {
            name: 'Celebrity',
            slug: 'celebrity',
            description: 'Reached 25,000 profile views. Paparazzi everywhere!',
            icon: 'FaCamera',
            color: '#c084fc',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_celebrity'
        },
        {
            name: 'Internet Sensation',
            slug: 'internet-sensation',
            description: 'Reached 50,000 profile views. You\'ve gone viral.',
            icon: 'FaBolt',
            color: '#2dd4bf',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_sensation'
        },
        {
            name: 'World Class',
            slug: 'world-class',
            description: 'Reached 100,000 profile views. Known across the globe.',
            icon: 'FaGlobeAmericas',
            color: '#38bdf8',
            category: 'achievement',
            isSystem: true,
            systemKey: 'view_world_class'
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
    // ... (unchanged)
    if (!user.discord || !user.discord.id) return;

    try {
        const memberInfo = await getDiscordMemberInfo(user.discord.id);
        if (!memberInfo) return;

        // Fetch the system badges
        const badges = await Badge.find({ systemKey: { $in: ['discord_member', 'discord_booster'] } });
        const memberBadge = badges.find(b => b.systemKey === 'discord_member');
        const boosterBadge = badges.find(b => b.systemKey === 'discord_booster');

        if (!user.badges) user.badges = [];
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

/**
 * Checks and awards referral milestone badges and rewards.
 * @param {string} userId - The user ID.
 */
const checkReferralBadges = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const totalReferrals = user.referralStats?.totalReferrals || 0;

        // Define referral badges and rewards
        const referralBadges = [
            { count: 5, badgeId: 'recruiter', name: 'Recruiter', xp: 500, credits: 100 },
            { count: 25, badgeId: 'ambassador', name: 'Ambassador', xp: 2500, credits: 500 },
            { count: 100, badgeId: 'legend', name: 'Legend', xp: 10000, credits: 2000 },
            { count: 500, badgeId: 'icon', name: 'Icon', xp: 25000, credits: 5000 },
            { count: 1000, badgeId: 'titan', name: 'Titan', xp: 50000, credits: 10000 },
            { count: 2500, badgeId: 'warlord', name: 'Warlord', xp: 100000, credits: 25000 },
            { count: 5000, badgeId: 'emperor', name: 'Emperor', xp: 250000, credits: 50000 },
            { count: 10000, badgeId: 'godlike', name: 'Godlike', xp: 1000000, credits: 100000 }
        ];

        let updated = false;

        for (const milestone of referralBadges) {
            if (totalReferrals >= milestone.count) {
                const badge = await Badge.findOne({ slug: milestone.badgeId });
                // If badge exists and user doesn't have it yet -> Award it + Rewards
                if (badge && !user.badges.includes(badge._id)) {
                    user.badges.push(badge._id);

                    // Award Milestone Rewards
                    if (milestone.xp) {
                        await user.addXP(milestone.xp);
                        console.log(`User ${user.username} earned ${milestone.xp} XP for ${milestone.name} badge`);
                    }
                    if (milestone.credits) {
                        await user.addCredits(milestone.credits, 'achievement', `Milestone reward: ${milestone.name}`);
                        console.log(`User ${user.username} earned ${milestone.credits} credits for ${milestone.name} badge`);
                    }

                    updated = true;
                    console.log(`User ${user.username} earned ${milestone.name} badge!`);
                }
            }
        }

        if (updated) {
            await user.save();
        }
    } catch (error) {
        console.error('Error checking referral badges:', error);
    }
};

/**
 * Checks and awards view milestone badges and rewards.
 * @param {string} userId - The user ID.
 */
const checkViewBadges = async (userId) => {
    try {
        const Profile = require('../models/Profile'); // Lazy load to avoid circular dependency
        const user = await User.findById(userId);
        if (!user) return;

        const profile = await Profile.findOne({ user: userId });
        if (!profile) return;

        const totalViews = profile.views || 0;

        // Define view badges and rewards
        const viewMilestones = [
            { count: 500, badgeId: 'observer', name: 'Observer', xp: 500 },
            { count: 1000, badgeId: 'rising-star', name: 'Rising Star', xp: 1000 },
            { count: 2500, badgeId: 'socialite', name: 'Socialite', xp: 2500 },
            { count: 5000, badgeId: 'influencer', name: 'Influencer', xp: 5000 },
            { count: 10000, badgeId: 'superstar', name: 'Superstar', xp: 10000 },
            { count: 25000, badgeId: 'celebrity', name: 'Celebrity', xp: 25000 },
            { count: 50000, badgeId: 'internet-sensation', name: 'Internet Sensation', xp: 50000 },
            { count: 100000, badgeId: 'world-class', name: 'World Class', xp: 100000 }
        ];

        let updated = false;

        for (const milestone of viewMilestones) {
            if (totalViews >= milestone.count) {
                const badge = await Badge.findOne({ slug: milestone.badgeId });
                // If badge exists and user doesn't have it yet -> Award it + Rewards
                if (badge && !user.badges.some(b => b.equals(badge._id))) {
                    user.badges.push(badge._id);

                    // Award Milestone Rewards
                    if (milestone.xp) {
                        await user.addXP(milestone.xp);
                        console.log(`User ${user.username} earned ${milestone.xp} XP for ${milestone.name} badge (Views: ${totalViews})`);
                    }

                    updated = true;
                    console.log(`User ${user.username} earned ${milestone.name} badge for views!`);
                }
            }
        }

        if (updated) {
            await user.save();
        }
    } catch (error) {
        console.error('Error checking view badges:', error);
    }
};

// Also export a helper for checking all automated badges (referral + potentially others)
const checkAutomaticBadges = async (userId) => {
    await syncUserDiscordBadges(await User.findById(userId));
    await checkReferralBadges(userId);
    await checkViewBadges(userId);
};

module.exports = {
    initSystemBadges,
    syncUserDiscordBadges,
    syncUserDiscordBadges,
    checkReferralBadges,
    checkViewBadges,
    checkAutomaticBadges
};
