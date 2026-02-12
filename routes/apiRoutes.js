const express = require('express');
const router = express.Router();
const controller = require('../controllers/honeypotController');

/**
 * @swagger
 * /api/honeypot:
 *   post:
 *     summary: Process a message from a scammer
 *     description: Processes an incoming message, updates session history, extracts intelligence, and returns an AI-generated reply.
 *     tags: [Honeypot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "session_12345"
 *               message:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *                     example: "Hello, your bank account is blocked."
 *     responses:
 *       200:
 *         description: AI generated reply
 *       401:
 *         description: Unauthorized
 */
router.post('/honeypot', controller.processMessage);

module.exports = router;