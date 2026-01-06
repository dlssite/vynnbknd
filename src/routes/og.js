const express = require('express');
const router = express.Router();
const OGController = require('../controllers/OGController');

router.get('/profile/:username', OGController.generateProfileImage);

module.exports = router;
