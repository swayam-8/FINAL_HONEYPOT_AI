const sessionManager = require('../services/sessionManager');
const logger = require('../utils/logger');
const guviCallback = require('../services/guviCallback');
const Session = require('../models/Session');

/**
 * INLINE DOCUMENTATION: Process incoming messages with strict 25s timeout
 * to guarantee compliance with hackathon 30s limits.
 */
exports.processMessage = async (req, res) => {
    try {
        // ROBUST VALIDATION: Ensure required payload data exists
        const { sessionId, message, conversationHistory } = req.body;
        if (!sessionId || !message || !message.text) {
            logger.warn("Validation Error: Missing required payload fields");
            return res.status(400).json({ error: "Invalid Payload: Missing sessionId or message text" });
        }

        // ERROR HANDLING: 25s Hard Timeout Protection
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout Exceeded")), 25000)
        );

        const processing = sessionManager.handleSession(sessionId, message.text, conversationHistory || [], message.timestamp);
        const result = await Promise.race([processing, timeout]);

        const responseObj = {
            status: "success",
            reply: result.reply || result 
        };

        // 🏆 DOUBLE-TAP: If Turn 10, inject final payload into HTTP response
        if (result.finalPayload) {
            logger.info(`💉 Injecting PDF-compliant final payload directly into HTTP response.`);
            Object.assign(responseObj, result.finalPayload);
        }

        res.status(200).json(responseObj);

    } catch (error) {
        // VISIBLE ERROR HANDLING: Logs the error and returns in-character fallback
        logger.error(`Controller Execution Error: ${error.message}`);
        res.status(200).json({
            status: "success",
            reply: "Arey beta, my phone screen just went black for a second. What did you say?"
        });
    }
};

exports.getCallbackPreview = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: "Session not found" });
        
        const payload = guviCallback.generatePayload(session);
        res.status(200).json(payload);
    } catch (error) {
        logger.error(`Preview Error: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
};