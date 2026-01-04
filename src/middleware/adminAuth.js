const { auth } = require('./auth');

const requireAdmin = [
    auth,
    (req, res, next) => {
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }
        next();
    }
];

const requireSuperAdmin = [
    auth,
    (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied. Super Admins only.' });
        }
        next();
    }
];

module.exports = { requireAdmin, requireSuperAdmin };
