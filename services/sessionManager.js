const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

/**
 * ⚙️ CORE LOGIC
 */
const handleSession = async (sessionId, incomingText) => {
    
    // 1. Load Session (Read-Through pattern)
    let session = await Session.findOne({ sessionId });
    
    if (!session) {
        session = new Session({ sessionId, history: [] });
    }

    // 2. Key Assignment (Sticky)
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);
    if (!session.assignedKey) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
    }

    // 3. Intelligence Extraction (Sync)
    const intel = intelService.extract(incomingText);
    Object.keys(intel).forEach(k => {
        if(intel[k].length) {
            session.intelligence[k] = [...new Set([...session.intelligence[k], ...intel[k]])];
        }
    });

    // 4. Update History
    session.history.push({ role: "user", content: incomingText });
    session.turnCount += 1;

    // 5. AI Processing (FastRouter Priority)
    let aiResult = await aiService.processWithFastRouter(keyData.key, session.history, incomingText);
    
    // Fallback if FastRouter fails
    if (!aiResult) {
        // Grab an OpenAI key strictly for fallback
        const backupKey = (process.env.OPENAI_KEYS || "").split(',')[0]; 
        aiResult = await aiService.fallbackOpenAI(backupKey, session.history, incomingText);
    }

    // 6. Update State
    const { reply, isScam } = aiResult;
    session.history.push({ role: "assistant", content: reply });
    
    if (isScam) {
        session.scamDetected = true;
        session.riskScore = "HIGH";
    }

    // 7. Save State (Async)
    await session.save();

    // 8. CHECK TERMINATION / CALLBACK
    const hasIntel = Object.values(session.intelligence).some(arr => arr.length > 0);
    const isMature = session.turnCount >= 2;

    if (session.scamDetected && (isMature || hasIntel)) {
        // Fire Callback
        await guviCallback.sendReport(session);
        
        // CLEANUP
        await Session.deleteOne({ sessionId });
        keyPool.releaseKey(sessionId);
    }

    return reply;
};

module.exports = { handleSession };