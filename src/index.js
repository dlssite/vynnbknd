require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const device = require('express-device');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const profileRoutes = require('./routes/profile');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Nginx/Netlify/Cloudflare)


// Connect to MongoDB
connectDB().then(() => {
  const { initSystemBadges } = require('./services/badgeService');
  initSystemBadges();
});

// Middleware
// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(device.capture());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/profiles', require('./routes/profile'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/store', require('./routes/store'));
app.use('/api/badges', require('./routes/badge'));
app.use('/api/discord', require('./routes/discord'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/config', require('./routes/config'));
app.use('/api/og', require('./routes/og'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vynn API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Vynn API running on port ${PORT}`);
});
