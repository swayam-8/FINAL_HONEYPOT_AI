const express = require('express');
const router = express.Router();
const controller = require('../controllers/honeypotController');

router.post('/honeypot', controller.processMessage);

module.exports = router;