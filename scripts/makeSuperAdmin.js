const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const email = process.argv[2];

if (!email) {
    console.error('❌ Please provide an email address as an argument.');
    console.log('Usage: node scripts/makeSuperAdmin.js <email>');
    process.exit(1);
}

const makeSuperAdmin = async () => {
    try {
        await connectDB();

        const user = await User.findOne({ email });

        if (!user) {
            console.error(`❌ User not found with email: ${email}`);
            process.exit(1);
        }

        user.role = 'super_admin';
        await user.save();

        console.log(`✅ Successfully made ${user.username} (${user.email}) a SUPER ADMIN.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

makeSuperAdmin();
