const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

/**
 * ⚙️ CORE LOGIC
 */
// ✅ FIXED: Accepting 'incomingHistory' argument
const handleSession = async (sessionId, incomingText, incomingHistory = []) => {
    
    // 1. Load Session
    let session = await Session.findOne({ sessionId });
    
    if (session) {
        logger.info(`🔄 Updating OLD Session: ${sessionId}`);
    } else {
        logger.info(`✨ Creating NEW Session: ${sessionId}`);
        session = new Session({ sessionId, history: [] });
        
        // ✅ NEW: If it's a new session, hydrate DB with provided history
        if (incomingHistory.length > 0) {
            incomingHistory.forEach(msg => {
                session.history.push({ 
                    role: msg.sender === 'scammer' ? 'user' : 'assistant', 
                    content: msg.text 
                });
            });
        }
    }

    // 2. Key Assignment
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);
    if (!session.assignedKey) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
    }

    // 3. Intelligence Extraction (Deep Scan)
    // ✅ FIXED: Scan BOTH the new message AND the provided history
    const textsToScan = [incomingText];
    if (incomingHistory.length > 0) {
        incomingHistory.forEach(msg => textsToScan.push(msg.text));
    }

    textsToScan.forEach(text => {
        const intel = intelService.extract(text);
        Object.keys(intel).forEach(k => {
            if (intel[k].length > 0) {
                // Merge and dedup
                session.intelligence[k] = [...new Set([...session.intelligence[k], ...intel[k]])];
            }
        });
    });

    // 4. Update History (New Message)
    session.history.push({ role: "user", content: incomingText });
    session.turnCount += 1;

    // 5. AI Processing
    let aiResult = await aiService.processWithFastRouter(keyData.key, session.history, incomingText);
    
    if (!aiResult) {
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

    // 7. Check Callback (Prevent Duplicates)
    const hasIntel = Object.values(session.intelligence).some(arr => arr.length > 0);
    const isMature = session.turnCount >= 1; // Lowered threshold for testing

    if (session.scamDetected && (isMature || hasIntel) && !session.reportSent) {
        logger.warn(`🚨 SCAM CONFIRMED (${sessionId}). Triggering Callback...`);
        const success = await guviCallback.sendReport(session);
        if (success) session.reportSent = true;
        keyPool.releaseKey(sessionId);
    }

    await session.save(); 
    return reply;
};

module.exports = { handleSession };