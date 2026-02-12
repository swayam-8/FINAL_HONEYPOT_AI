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
        
        // Hydrate history if provided
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

    // 3. INTELLIGENCE EXTRACTION (Deep Scan)
    const textsToScan = [incomingText];
    if (incomingHistory.length > 0) {
        incomingHistory.forEach(msg => textsToScan.push(msg.text));
    }

    let foundNewIntel = false;
    textsToScan.forEach(text => {
        const intel = intelService.extract(text);
        Object.keys(intel).forEach(k => {
            if (intel[k].length > 0) {
                const combined = [...session.intelligence[k], ...intel[k]];
                session.intelligence[k] = [...new Set(combined)];
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

    const { reply, isScam } = aiResult;
    session.history.push({ role: "assistant", content: reply });
    
    if (isScam) {
        session.scamDetected = true;
        session.riskScore = "HIGH";
    }

    // Tell Mongoose data changed
    if (foundNewIntel) session.markModified('intelligence');
    session.markModified('history');

    // =================================================================
    // 6. IMPROVED CALLBACK LOGIC (The Fix)
    // =================================================================
    
    // Definition of "High Value" Data
    const hardIntelTypes = ['bankAccounts', 'upiIds', 'phoneNumbers', 'phishingLinks'];
    const hasHardIntel = hardIntelTypes.some(k => session.intelligence[k] && session.intelligence[k].length > 0);
    
    // Wait for at least 3 turns unless we found hard intel immediately
    const isMature = session.turnCount >= 3; 

    // Trigger ONLY if we haven't sent a report yet AND (We have Hard Intel OR Chat is deep)
    if (session.scamDetected && (hasHardIntel || isMature) && !session.reportSent) {
        
        logger.warn(`🚨 SCAM CONFIRMED (${sessionId}). Sending Callback...`);
        
        await session.save(); // Save first

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