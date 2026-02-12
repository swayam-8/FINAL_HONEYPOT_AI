const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

/**
 * ⚙️ CORE LOGIC: Handles the entire lifecycle of a request
 */
const handleSession = async (sessionId, incomingText) => {
    
    // ============================================================
    // 1. INTELLIGENT LOAD (Update vs Create Logic)
    // ============================================================
    
    // Check if this session ID already exists in MongoDB
    let session = await Session.findOne({ sessionId });
    
    if (session) {
        // ✅ FOUND! We will update this EXISTING document.
        // We do NOT create a new one. We just append to this.
        logger.info(`🔄 Updating OLD Session: ${sessionId}`);
    } else {
        // ❌ NOT FOUND! This is a brand new user. Create fresh.
        logger.info(`✨ Creating NEW Session: ${sessionId}`);
        session = new Session({ sessionId, history: [] });
    }

    // ============================================================
    // 2. ASSIGN API KEY (Sticky Session)
    // ============================================================
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);
    if (!session.assignedKey) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
    }

    // ============================================================
    // 3. EXTRACT INTELLIGENCE (And Merge with Old Data)
    // ============================================================
    const intel = intelService.extract(incomingText);
    
    Object.keys(intel).forEach(k => {
        if (intel[k].length > 0) {
            // Logic: Take (Old Database Data) + (New Chat Data) -> Remove Duplicates
            // This UPDATES the existing arrays in the database
            session.intelligence[k] = [...new Set([...session.intelligence[k], ...intel[k]])];
        }
    });

    // ============================================================
    // 4. UPDATE HISTORY
    // ============================================================
    session.history.push({ role: "user", content: incomingText });
    session.turnCount += 1;

    // ============================================================
    // 5. AI PROCESSING
    // ============================================================
    let aiResult = await aiService.processWithFastRouter(keyData.key, session.history, incomingText);
    
    // Fallback if FastRouter fails
    if (!aiResult) {
        const backupKey = (process.env.OPENAI_KEYS || "").split(',')[0]; 
        aiResult = await aiService.fallbackOpenAI(backupKey, session.history, incomingText);
    }

    // ============================================================
    // 6. UPDATE STATE & SAVE
    // ============================================================
    const { reply, isScam } = aiResult;
    
    session.history.push({ role: "assistant", content: reply });
    
    if (isScam) {
        session.scamDetected = true;
        session.riskScore = "HIGH";
    }

    session.lastActive = new Date();

    // ⚠️ CRITICAL: This line UPDATES the record if it existed, 
    // or INSERTS it if it was new. Mongoose handles this automatically.
    await session.save(); 

    // ============================================================
    // 7. CHECK FOR SCAM REPORT (But Keep Data)
    // ============================================================
    const hasIntel = Object.values(session.intelligence).some(arr => arr.length > 0);
    const isMature = session.turnCount >= 2;

    // Only report if we haven't reported recently (optional check) or on every detection
    if (session.scamDetected && (isMature || hasIntel)) {
        
        logger.warn(`🚨 SCAM DETECTED (${sessionId}). Reporting...`);
        
        // Send Report to GUVI
        await guviCallback.sendReport(session);
        
        // ❌ REMOVED: await Session.deleteOne({ sessionId }); 
        // ✅ We KEEP the data in MongoDB.
        
        // Release the key for others to use, but keep the chat logs in DB
        keyPool.releaseKey(sessionId);
    }

    return reply;
};

module.exports = { handleSession };