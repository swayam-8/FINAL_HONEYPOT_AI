const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

const handleSession = async (sessionId, incomingText, incomingHistory = []) => {
    
    // 0. DEBUG: See exactly what the scammer sent
    logger.info(`📩 Incoming Scammer Message: "${incomingText}"`);

    // 1. Load or Create Session
    let session = await Session.findOne({ sessionId });
    
    if (!session) {
        logger.info(`✨ Creating NEW Session: ${sessionId}`);
        session = new Session({ sessionId, history: [] });
        
        // Hydrate history & UPDATE COUNT
        if (incomingHistory.length > 0) {
            incomingHistory.forEach(msg => {
                session.history.push({ 
                    role: msg.sender === 'scammer' ? 'user' : 'assistant', 
                    content: msg.text 
                });
            });
            session.turnCount += incomingHistory.length;
        }
    }

    // 2. Key Assignment
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);
    if (!session.assignedKey) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
    }

    // 3. Intelligence Extraction (Targeted)
    // ✅ FIX: Only scan "user" (scammer) messages. Ignore "assistant" (Honeypot).
    const textsToScan = [incomingText];
    
    if (incomingHistory.length > 0) {
        incomingHistory.forEach(msg => {
            // Only add if it came from the scammer
            if (msg.sender === 'scammer' || msg.role === 'user') {
                textsToScan.push(msg.text);
            }
        });
    }

    let foundNewIntel = false;
    textsToScan.forEach(text => {
        const intel = intelService.extract(text);
        Object.keys(intel).forEach(k => {
            if (intel[k].length > 0) {
                const combined = [...session.intelligence[k], ...intel[k]];
                const unique = [...new Set(combined)];
                
                if (unique.length > session.intelligence[k].length) {
                    logger.info(`🔍 New ${k} Found: ${JSON.stringify(intel[k])}`);
                    foundNewIntel = true;
                }
                session.intelligence[k] = unique;
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

    const { reply, isScam } = aiResult;
    session.history.push({ role: "assistant", content: reply });
    
    // ✅ DEBUG LOG
    logger.info(`🤖 AI Reply: "${reply}" | Scam Detected: ${isScam}`);
    
    if (isScam) {
        session.scamDetected = true;
        session.riskScore = "HIGH";
    }

    if (foundNewIntel) session.markModified('intelligence');
    session.markModified('history');

    // 6. Callback Logic (Live Updates)
    const hardIntelTypes = ['bankAccounts', 'upiIds', 'phoneNumbers', 'phishingLinks'];
    const hasHardIntel = hardIntelTypes.some(k => session.intelligence[k] && session.intelligence[k].length > 0);
    const isMature = session.turnCount >= 2; 

    // ✅ FIX: Allow RE-SENDING if we found new hard intel (Live Update)
    const shouldReport = session.scamDetected && (hasHardIntel || isMature);
    
    // We report if:
    // 1. It's the first time (!reportSent)
    // 2. OR we found NEW hard intel (foundNewIntel) to update the dashboard
    if (shouldReport && (!session.reportSent || foundNewIntel)) {
        
        logger.warn(`🚨 SCAM UPDATE (${sessionId}). Sending Callback...`);
        await session.save(); 
        
        const success = await guviCallback.sendReport(session);
        if (success) {
            session.reportSent = true;
            await session.save(); 
        }
        keyPool.releaseKey(sessionId);

    } else {
        await session.save(); 
    }

    return reply;
};

module.exports = { handleSession };