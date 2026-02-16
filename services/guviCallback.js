const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const sendReport = async (session) => {
    // Calculate Duration
    const startTime = new Date(session.startTime).getTime();
    const endTime = new Date(session.lastMessageTime).getTime();
    let durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    // Fallback: If duration is 0 but we have messages, default to minimal human delay
    if (durationSeconds === 0 && session.turnCount > 0) {
        durationSeconds = session.turnCount * 5;
    }

    // STRICT PDF PAYLOAD [cite: 104-123]
    // This matches the documentation structure exactly.
    const payload = {
        sessionId: session.sessionId, // Necessary to identify the session
        status: "success",
        scamDetected: session.scamDetected,
        scamType: session.scamType || "unknown",
        extractedIntelligence: {
            phoneNumbers: session.intelligence.phoneNumbers || [],
            bankAccounts: session.intelligence.bankAccounts || [],
            upiIds: session.intelligence.upiIds || [],
            phishingLinks: session.intelligence.phishingLinks || [],
            emailAddresses: session.intelligence.emailAddresses || []
        },
        engagementMetrics: {
            totalMessagesExchanged: session.turnCount,
            engagementDurationSeconds: durationSeconds
        },
        agentNotes: session.agentNotes || `Scam detected. Risk: ${session.riskScore}.`
    };

    const targetUrl = process.env.CALLBACK_URL || 'https://hackathon.guvi.in/api/updateHoneyPotFinalResult';

    try {
        logger.info(`📤 Sending Callback to ${targetUrl}`);
        logger.info(`📄 Payload: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(targetUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });

        logger.info(`✅ CALLBACK SUCCESS: ${response.status} - ${response.statusText}`);
        return true;
    } catch (error) {
        logger.error(`❌ CALLBACK FAILED: ${error.message}`);
        if (error.response) {
            logger.error(`Server Response: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
};

module.exports = { sendReport };