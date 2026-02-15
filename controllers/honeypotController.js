const sessionManager = require('../services/sessionManager');
const logger = require('../utils/logger');

exports.processMessage = async (req, res) => {
    try {
        // ✅ FIXED: Extract conversationHistory
        const { sessionId, message, conversationHistory } = req.body;

        if (!sessionId || !message || !message.text) {
            return res.status(400).json({ error: "Invalid Payload" });
        }

        // ⏱️ 15s Hard Timeout Protection (Accommodates 3-6s delay + AI time)
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 15000)
        );

        // ✅ FIXED: Pass history to the manager
        const processing = sessionManager.handleSession(sessionId, message.text, conversationHistory || [], message.timestamp);

        const reply = await Promise.race([processing, timeout]);

        res.json({
            status: "success",
            reply: reply
        });

    } catch (error) {
        logger.error(`Controller Error: ${error.message}`);

        // Fail-safe response
        res.status(200).json({
            status: "success",
            reply: "I didn't understand that, sorry."
        });
    }
};

const guviCallback = require('../services/guviCallback');
const Session = require('../models/Session');

exports.getCallbackPreview = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        const payload = guviCallback.generatePayload(session);
        res.json(payload);
    } catch (error) {
        logger.error(`Preview Error: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
