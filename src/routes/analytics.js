const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const device = require('express-device');
const VisitSession = require('../models/VisitSession');
const Profile = require('../models/Profile');
const { auth: requireAuth } = require('../middleware/auth'); // Importing 'auth' as 'requireAuth'

// Helper to anonymize IP (optional, but good practice)
// For V1, we just use the IP for Geo lookup then discard it, identifying users by visitorId token
const getCountryFromIp = (ip) => {
    // Handle localhost/ipv6 loopback
    if (ip === '::1' || ip === '127.0.0.1') return { country: 'Local', code: 'LO' };

    const geo = geoip.lookup(ip);
    return geo ? { country: geo.country, code: geo.country } : { country: 'Unknown', code: 'UN' };
};

// @route   POST /api/analytics/start
// @desc    Start a new tracking session (Called when user clicks "Enter")
// @access  Public
router.post('/start', async (req, res) => {
    try {
        const { profileId, visitorId, referrer } = req.body;

        // Basic bot filtering
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('bot') || userAgent.includes('crawler')) {
            return res.status(200).json({ status: 'ignored' });
        }

        // Device Detection
        // express-device adds req.device
        const deviceType = req.device ? req.device.type : 'desktop';

        // Geo Location
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const { country, code } = getCountryFromIp(ip);

        // Create Session
        const session = new VisitSession({
            profileId,
            visitorId,
            deviceType,
            country: code, // Storing code (US, DE) for flags
            countryCode: code,
            referrer: referrer || req.headers['referer'] || 'Direct',
            browser: userAgent.split(' ')[0], // Simple browser grab
            os: 'Unknown' // Could parse further if needed
        });

        await session.save();

        // Increment total views on Profile immediately
        await Profile.findByIdAndUpdate(profileId, { $inc: { views: 1 } });

        res.json({ sessionId: session._id, status: 'started' });
    } catch (error) {
        console.error('Start Analytics Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/analytics/heartbeat
// @desc    Update session duration (Called every 15s)
// @access  Public
router.put('/heartbeat', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

        const session = await VisitSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const now = new Date();
        const start = new Date(session.startedAt);
        const durationSeconds = Math.floor((now - start) / 1000);

        session.lastPingAt = now;
        session.duration = durationSeconds;
        await session.save();

        res.json({ status: 'updated', duration: durationSeconds });
    } catch (error) {
        console.error('Heartbeat Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/analytics/click
// @desc    Track a link click
// @access  Public
router.post('/click', async (req, res) => {
    try {
        const { sessionId, linkId, url, type } = req.body;

        const session = await VisitSession.findById(sessionId);
        if (session) {
            session.clicks.push({
                linkId,
                url,
                type: type || 'link',
                timestamp: new Date()
            });
            await session.save();
        }

        // Also increment click count on the specific Link/Social in Profile model
        // This is complex because links/socials are subdocuments.
        // For V1, we just trust the aggregated VisitSession logs for deep analytics
        // But for the simple "click count" on the link itself:
        if (type === 'link') {
            await Profile.updateOne(
                { 'links._id': linkId },
                { $inc: { 'links.$.clicks': 1 } }
            );
        }

        res.json({ status: 'tracked' });
    } catch (error) {
        console.error('Click Track Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/analytics/stats
// @desc    Get aggregated stats for the Dashboard
// @access  Private (User/Admin)
router.get('/stats', requireAuth, async (req, res) => {
    try {
        // We assume the user wants stats for their own profile 
        // OR a specific profile if they are admin.
        // For now, let's find the profile owned by this user.
        const profile = await Profile.findOne({ user: req.user._id });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const profileId = profile._id;
        const { timeRange } = req.query; // '24h', '7d', '30d'

        // Date Filter
        let startDate = new Date();
        if (timeRange === '24h') startDate.setHours(startDate.getHours() - 24);
        else if (timeRange === '30d') startDate.setDate(startDate.getDate() - 30);
        else startDate.setDate(startDate.getDate() - 7); // Default 7d

        // 1. Core Counts
        const sessions = await VisitSession.find({
            profileId,
            startedAt: { $gte: startDate }
        });

        const totalViews = sessions.length;
        const uniqueVisitors = new Set(sessions.map(s => s.visitorId)).size;

        // Avg Time
        const totalDuration = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
        const avgTimeSeconds = totalViews ? Math.floor(totalDuration / totalViews) : 0;
        const avgTimeFormatted = `${Math.floor(avgTimeSeconds / 60)}m ${avgTimeSeconds % 60}s`;

        // CTR & Bounce
        const sessionsWithClicks = sessions.filter(s => s.clicks && s.clicks.length > 0).length;
        const totalClicks = sessions.reduce((acc, s) => acc + (s.clicks ? s.clicks.length : 0), 0);

        const ctr = totalViews ? ((sessionsWithClicks / totalViews) * 100).toFixed(1) + '%' : '0%';
        const bounceRate = totalViews ? (((totalViews - sessionsWithClicks) / totalViews) * 100).toFixed(0) + '%' : '0%';

        // Live Visitors (Active in last 30s)
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const liveVisitors = await VisitSession.countDocuments({
            profileId,
            lastPingAt: { $gte: thirtySecondsAgo }
        });

        // 2. Charts Data (Views per Day)
        // Group by day (YYYY-MM-DD)
        const viewsMap = {};
        sessions.forEach(s => {
            const dateStr = s.startedAt.toISOString().split('T')[0]; // YYYY-MM-DD
            viewsMap[dateStr] = (viewsMap[dateStr] || 0) + 1;
        });

        // Fill in missing days
        const viewsData = [];
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // If 7d or 30d, iterate backwards from today
        const daysToIterate = timeRange === '30d' ? 30 : 7;
        for (let i = daysToIterate - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = dayLabels[d.getDay()];

            viewsData.push({
                day: dayName,
                date: dateStr,
                views: viewsMap[dateStr] || 0
            });
        }

        // 3. Devices
        const deviceCounts = {};
        sessions.forEach(s => {
            const type = s.deviceType || 'unknown';
            deviceCounts[type] = (deviceCounts[type] || 0) + 1;
        });
        const devices = Object.keys(deviceCounts).map(key => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            count: deviceCounts[key],
            percent: Math.round((deviceCounts[key] / totalViews) * 100)
        }));

        // 4. Locations (Countries)
        const countryCounts = {};
        sessions.forEach(s => {
            const c = s.countryCode || 'UN';
            countryCounts[c] = (countryCounts[c] || 0) + 1;
        });
        // Sort by count
        const locations = Object.keys(countryCounts)
            .map(code => ({
                code,
                count: countryCounts[code],
                percent: Math.round((countryCounts[code] / totalViews) * 100)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5

        // 5. Sources (Referrers)
        const sourceCounts = {};
        sessions.forEach(s => {
            let ref = s.referrer;
            // Simplify source
            if (ref.includes('t.co') || ref.includes('twitter')) ref = 'Twitter / X';
            else if (ref.includes('discord')) ref = 'Discord';
            else if (ref.includes('instagram')) ref = 'Instagram';
            else if (ref.includes('google')) ref = 'Google';
            else if (ref.includes('Direct') || !ref) ref = 'Direct / None';
            else ref = 'Other';

            sourceCounts[ref] = (sourceCounts[ref] || 0) + 1;
        });
        const sources = Object.keys(sourceCounts).map(k => ({
            source: k,
            count: sourceCounts[k],
            percent: Math.round((sourceCounts[k] / totalViews) * 100)
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        // 6. Link Performance
        const linkStats = {};

        // Helper to find link title
        const findLinkTitle = (id, url, type) => {
            if (type === 'link') {
                const link = profile.links.find(l => l._id.toString() === id);
                return link ? link.title : url;
            } else if (type === 'social') {
                const social = profile.socials.find(s => s._id.toString() === id);
                if (!social) return url;

                // Format: "Platform (Username)" or just "Platform"
                const platform = social.platform.charAt(0).toUpperCase() + social.platform.slice(1); // Capitalize
                return social.username ? `${platform} (${social.username})` : platform;
            }
            return url;
        };

        sessions.forEach(s => {
            if (s.clicks && s.clicks.length > 0) {
                s.clicks.forEach(click => {
                    const key = click.linkId || click.url; // Group by ID if possible
                    if (!linkStats[key]) {
                        linkStats[key] = {
                            id: click.linkId,
                            url: click.url,
                            type: click.type,
                            label: findLinkTitle(click.linkId, click.url, click.type),
                            clicks: 0,
                            uniqueClickers: new Set()
                        };
                    }
                    linkStats[key].clicks += 1;
                    linkStats[key].uniqueClickers.add(s.visitorId);
                });
            }
        });

        // Format for frontend
        const linkPerformance = Object.values(linkStats).map(stat => ({
            label: stat.label,
            url: stat.url,
            clicks: stat.clicks,
            // Conversion Rate: Unique Clickers / Total Unique Visitors
            ctr: uniqueVisitors ? Math.round((stat.uniqueClickers.size / uniqueVisitors) * 100) : 0
        })).sort((a, b) => b.clicks - a.clicks);

        res.json({
            stats: {
                totalViews: totalViews.toLocaleString(),
                uniqueVisitors: uniqueVisitors.toLocaleString(),
                ctr,
                avgTime: avgTimeFormatted,
                bounceRate,
                liveVisitors
            },
            viewsData,
            devices,
            locations,
            referrers: sources,
            linkPerformance // New Data Field
        });

    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/analytics/sessions
// @desc    Get recent visitor sessions (Visitor Log)
// @access  Private
router.get('/sessions', requireAuth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user.id });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const limit = parseInt(req.query.limit) || 50;

        const sessions = await VisitSession.find({ profileId: profile._id })
            .sort({ startedAt: -1 })
            .limit(limit)
            .lean();

        // Format for frontend
        const formattedSessions = sessions.map(s => {
            // Calculate activity summary
            let activity = 'Viewed';
            if (s.clicks && s.clicks.length > 0) {
                activity = `Clicked ${s.clicks.length} Link${s.clicks.length > 1 ? 's' : ''}`;
            }

            return {
                id: s._id,
                visitorId: s.visitorId.substring(0, 8), // Shorten ID
                country: s.country || 'Unknown',
                countryCode: s.countryCode || 'UN',
                device: s.deviceType || 'desktop',
                browser: s.browser || 'Unknown',
                duration: s.duration || 0,
                startedAt: s.startedAt,
                activity,
                referrer: s.referrer
            };
        });

        res.json(formattedSessions);

    } catch (error) {
        console.error('Sessions Log Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
