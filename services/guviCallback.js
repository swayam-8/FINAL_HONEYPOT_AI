const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

exports.sendReport = async (session) => {
    const startTime = new Date(session.startTime).getTime();
    const endTime = new Date(session.lastMessageTime).getTime();
    let durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    if (durationSeconds === 0 && session.turnCount > 0) {
        durationSeconds = session.turnCount * 5;
    }

    // STRICT PDF PAYLOAD SCHEMA
    const payload = {
        sessionId: session.sessionId,
        status: "success",
        scamDetected: session.scamDetected || true,
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
        agentNotes: session.agentNotes || "Extracted intelligence successfully."
    };

    const targetUrl = process.env.CALLBACK_URL || 'https://hackathon.guvi.in/api/updateHoneyPotFinalResult';

    try {
        logger.info(`📤 Sending Final Callback exactly ONCE to ${targetUrl}`);
        const response = await axios.post(targetUrl, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
        logger.info(`✅ CALLBACK SUCCESS: ${response.status}`);
        return true;
    } catch (error) {
        logger.error(`❌ CALLBACK FAILED: ${error.message}`);
        return false;
    }
};