const axios = require('axios');
const logger = require('../utils/logger');

const generatePayload = (session) => {
    // Calculate Duration
    const startTime = new Date(session.startTime).getTime();
    const endTime = new Date(session.lastMessageTime).getTime();
    const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    return {
        sessionId: session.sessionId, // ✅ ADDED: Required by server
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
        // ✅ MOVED TO ROOT (Required by Server Error 422)
        totalMessagesExchanged: session.turnCount,
        engagementDurationSeconds: durationSeconds,

        // Keeping nested for compatibility if needed
        engagementMetrics: {
            totalMessagesExchanged: session.turnCount,
            engagementDurationSeconds: durationSeconds
        },
        agentNotes: session.agentNotes || `Scam detected. Risk: ${session.riskScore}.`
    };
};

const sendReport = async (session) => {
    const payload = generatePayload(session);

    try {
        const callbackUrl = process.env.CALLBACK_URL || 'https://hackathon.guvi.in/api/updateHoneyPotFinalResult';
        logger.info(`📤 Sending Callback Payload to ${callbackUrl}: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(callbackUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });

        logger.info(`✅ CALLBACK SUCCESS: ${response.status} - ${response.statusText}`);
        return true;
    } catch (error) {
        logger.error(`❌ CALLBACK FAILED: ${error.message}`);
        if (error.response) {
            logger.error(`Response Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
};

module.exports = { sendReport, generatePayload };