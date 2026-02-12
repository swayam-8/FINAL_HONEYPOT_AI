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
        logger.info(`📤 Sending Callback Payload: ${JSON.stringify(payload, null, 2)}`);
        
        const response = await axios.post('https://hackathon.guvi.in/api/updateHoneyPotFinalResult', payload, {
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

module.exports = { sendReport };