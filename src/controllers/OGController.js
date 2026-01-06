const { createCanvas, loadImage, registerFont } = require('canvas');
const Profile = require('../models/Profile');
const path = require('path');
const fs = require('fs');

// Register font (optional, if you have custom fonts)
// registerFont(path.join(__dirname, '../assets/fonts/Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });

exports.generateProfileImage = async (req, res) => {
    try {
        const username = req.params.username;
        const profile = await Profile.findOne({ username });

        if (!profile) {
            return res.status(404).send('Profile not found');
        }

        // 1. Setup Canvas
        const width = 1200;
        const height = 630;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 2. Background
        // Create a rich dark gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0f0c29');
        gradient.addColorStop(0.5, '#302b63');
        gradient.addColorStop(1, '#24243e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add subtle overlay pattern or noise if desired
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        // 3. User Avatar
        const avatarSize = 250;
        const avatarX = (width / 2) - (avatarSize / 2);
        const avatarY = (height / 2) - (avatarSize / 2) - 40;

        try {
            // Use default if no avatar
            const avatarUrl = profile.avatar || 'https://vynn.io/logo.png';
            const avatar = await loadImage(avatarUrl);

            // Circular clipping for avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // 4. User Frame (if applicable)
            // Assuming profile.equippedFrame is a URL or we map IDs to local paths
            // For now, let's assume it's a URL in profile.equippedFrameUrl or similar
            if (profile.frame) {
                // If frame logic is complex (e.g. mapping ID to asset), handle here.
                // Assuming raw URL for simplicity or skipping if specific logic needed.
                // const frame = await loadImage(profile.frame);
                // ctx.drawImage(frame, avatarX - 20, avatarY - 20, avatarSize + 40, avatarSize + 40);
            }
        } catch (err) {
            console.error('Error loading avatar:', err);
            // Fallback circle if image load fails
            ctx.fillStyle = '#FF4500';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.fill();
        }

        // 5. Border/Glow around avatar (if no frame)
        if (!profile.frame) {
            ctx.strokeStyle = '#FF4500'; // Vynn Orange
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.stroke();
        }

        // 6. Text: Display Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px Sans-serif'; // Use 'Inter' if registered
        ctx.textAlign = 'center';
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 20;

        const displayName = profile.displayName || profile.username;
        ctx.fillText(displayName, width / 2, avatarY + avatarSize + 90);

        // 7. Text: Username (@username)
        ctx.fillStyle = '#cccccc';
        ctx.font = '40px Sans-serif';
        ctx.fillText(`@${profile.username}`, width / 2, avatarY + avatarSize + 150);

        // 8. Branding (Bottom)
        ctx.fillStyle = '#FF4500';
        ctx.font = 'bold 30px Sans-serif';
        ctx.fillText('Vynn.io', width / 2, height - 40);

        // Response
        res.set('Content-Type', 'image/png');
        // Cache for performance (e.g., 1 hour)
        res.set('Cache-Control', 'public, max-age=3600');

        const buffer = canvas.toBuffer('image/png');
        res.send(buffer);

    } catch (error) {
        console.error('OG Generation Error:', error);
        res.status(500).send('Error generating image');
    }
};
