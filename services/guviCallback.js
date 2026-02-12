const axios = require('axios');
const logger = require('../utils/logger');

const sendReport = async (session) => {
    const payload = {
        sessionId: session.sessionId,
        scamDetected: session.scamDetected,
        totalMessagesExchanged: session.turnCount,
        extractedIntelligence: {
            bankAccounts: session.intelligence.bankAccounts,
            upiIds: session.intelligence.upiIds,
            phishingLinks: session.intelligence.phishingLinks,
            phoneNumbers: session.intelligence.phoneNumbers,
            suspiciousKeywords: session.intelligence.suspiciousKeywords
        },
        agentNotes: `Scam detected. Risk: ${session.riskScore}.`
    };

    try {
        await axios.post('https://hackathon.guvi.in/api/updateHoneyPotFinalResult', payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        logger.info(`✅ [CALLBACK SENT] Session ${session.sessionId}`);
        return true;
    } catch (error) {
        logger.error(`❌ [CALLBACK FAILED] ${error.message}`);
        return false;
    }
};

module.exports = { sendReport };