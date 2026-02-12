const sessionManager = require('../services/sessionManager');
const logger = require('../utils/logger');

exports.processMessage = async (req, res) => {
    try {
        // ✅ FIXED: Extract conversationHistory
        const { sessionId, message, conversationHistory } = req.body;

        if (!sessionId || !message || !message.text) {
            return res.status(400).json({ error: "Invalid Payload" });
        }

        // ⏱️ 4.5s Hard Timeout Protection
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 4500)
        );

        // ✅ FIXED: Pass history to the manager
        const processing = sessionManager.handleSession(sessionId, message.text, conversationHistory || []);

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