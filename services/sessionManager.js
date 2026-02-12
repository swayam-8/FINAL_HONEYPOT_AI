const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

const handleSession = async (sessionId, incomingText, incomingHistory = []) => {
    
    // 1. Load or Create Session
    let session = await Session.findOne({ sessionId });
    
    if (!session) {
        logger.info(`✨ Creating NEW Session: ${sessionId}`);
        session = new Session({ sessionId, history: [] });
        
        // Hydrate history if provided in the first request
        if (incomingHistory.length > 0) {
            incomingHistory.forEach(msg => {
                session.history.push({ 
                    role: msg.sender === 'scammer' ? 'user' : 'assistant', 
                    content: msg.text 
                });
            });
        }
    } else {
        logger.info(`🔄 Updating OLD Session: ${sessionId}`);
    }

    // 2. Key Assignment
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);
    if (!session.assignedKey) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
    }

    // 3. INTELLIGENCE EXTRACTION (Deep Scan)
    // Scan both the new message AND any history passed in the request
    const textsToScan = [incomingText];
    if (incomingHistory.length > 0) {
        incomingHistory.forEach(msg => textsToScan.push(msg.text));
    }

    let foundNewIntel = false;
    textsToScan.forEach(text => {
        const intel = intelService.extract(text);
        Object.keys(intel).forEach(k => {
            if (intel[k].length > 0) {
                // Merge new findings with existing data (Deduplicate)
                const combined = [...session.intelligence[k], ...intel[k]];
                session.intelligence[k] = [...new Set(combined)]; // Remove duplicates
                foundNewIntel = true;
            }
        });
    });

    // 4. Update History
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

    // ✅ CRITICAL FIX: Tell Mongoose that arrays have changed!
    // Without this, Mongoose ignores changes to 'intelligence' and 'history'
    if (foundNewIntel) session.markModified('intelligence');
    session.markModified('history');

    // 7. Check Callback
    const hasIntel = Object.values(session.intelligence).some(arr => arr.length > 0);
    
    // Trigger if Scam Detected AND (We found Data OR The conversation is long enough)
    if (session.scamDetected && (hasIntel || session.turnCount >= 2) && !session.reportSent) {
        
        logger.warn(`🚨 SCAM CONFIRMED (${sessionId}). Sending Callback...`);
        
        // Save BEFORE sending to ensure Callback gets the latest data
        await session.save(); 

        const success = await guviCallback.sendReport(session);
        if (success) {
            session.reportSent = true;
            await session.save(); // Save the sent flag
        }
        keyPool.releaseKey(sessionId);
    } else {
        // Save normal turn
        await session.save(); 
    }

    return reply;
};

module.exports = { handleSession };