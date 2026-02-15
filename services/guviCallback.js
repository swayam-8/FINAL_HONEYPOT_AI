const axios = require('axios');
const logger = require('../utils/logger');

const sendReport = async (session) => {
    // Calculate Duration
    const startTime = new Date(session.startTime).getTime();
    const endTime = new Date(session.lastMessageTime).getTime();
    let durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    // Fallback: If duration is 0 but we have messages, default to minimal human delay (e.g. 5s per turn)
    if (durationSeconds === 0 && session.turnCount > 0) {
        durationSeconds = session.turnCount * 5;
    }

    // 1. STRICT DISPLAY FORMAT (For Terminal Logs)
    // This matches the PDF documentation exactly for your visual verification.
    const logPayload = {
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

    // 2. SERVER COMPLIANT PAYLOAD (For API Call)
    // This includes the root-level fields required to avoid the 422 Error.
    const serverPayload = {
        sessionId: session.sessionId, // Required by Server
        ...logPayload,                // Includes all the nested data above
        totalMessagesExchanged: session.turnCount,    // Root level (Required)
        engagementDurationSeconds: durationSeconds    // Root level (Required)
    };

    try {
        // ✅ Log the STRICT format you asked for
        logger.info(`📤 Callback Data: ${JSON.stringify(logPayload, null, 2)}`);

        // 🚀 Send the WORKING format to the server
        const response = await axios.post('https://hackathon.guvi.in/api/updateHoneyPotFinalResult', serverPayload, {
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