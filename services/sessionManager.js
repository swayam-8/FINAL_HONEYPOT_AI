const Session = require('../models/Session');
const reportScheduler = require('./reportScheduler');
const keyPool = require('../config/keyPool');
const aiService = require('./aiService');
const intelService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

const handleSession = async (sessionId, incomingText, incomingHistory = [], incomingTimestamp = null) => {

    const msgTime = incomingTimestamp ? new Date(incomingTimestamp) : new Date();

    // 0. DEBUG: Log receipt only (Privacy)
    // logger.info(`📩 Processing message for Session: ${sessionId}`);

    // 1. Load or Create Session
    let session = await Session.findOne({ sessionId });

    if (!session) {
        // logger.info(`✨ Creating NEW Session: ${sessionId}`);
        session = new Session({
            sessionId,
            history: [],
            startTime: msgTime // Phase 3: Initialize Start Time
        });

        // Hydrate history & UPDATE COUNT
        if (incomingHistory.length > 0) {
            incomingHistory.forEach(msg => {
                session.history.push({
                    role: msg.sender === 'scammer' ? 'user' : 'assistant',
                    content: msg.text
                });
            });
            session.turnCount += incomingHistory.length;
            session.totalMessagesExchanged += incomingHistory.length;
        }
    }

    // Phase 3: Update Timing Metrics
    session.lastMessageTime = msgTime; // Update Last Active
    session.totalMessagesExchanged += 1;

    // 2. Key Assignment (Multi-Key Rotation)
    const keyData = keyPool.getKeyForSession(sessionId, session.assignedProvider, session.assignedKey);

    // Persist assignment if it changed or is new
    if (session.assignedKey !== keyData.key) {
        session.assignedKey = keyData.key;
        session.assignedProvider = keyData.provider;
        await session.save(); // Save immediately to lock sticky session
    }

    // 3. Intelligence Extraction (Targeted)
    const textsToScan = [incomingText];

    if (incomingHistory.length > 0) {
        incomingHistory.forEach(msg => {
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
                if (!session.intelligence[k]) session.intelligence[k] = [];

                const combined = [...session.intelligence[k], ...intel[k]];
                const unique = [...new Set(combined)];

                if (unique.length > session.intelligence[k].length) {
                    foundNewIntel = true;
                }
                session.intelligence[k] = unique;
            }
        });
    });

    // 4. Update History
    session.history.push({ role: "user", content: incomingText, timestamp: msgTime });
    session.turnCount += 1;

    // 5. AI Processing
    let aiResult = await aiService.processWithFastRouter(keyData.key, session.history, incomingText);

    if (!aiResult) {
        const backupKey = (process.env.OPENAI_KEYS || "").split(',')[0];
        aiResult = await aiService.fallbackOpenAI(backupKey, session.history, incomingText);
    }

    const { reply, isScam, scamType, agentNotes } = aiResult;
    session.history.push({ role: "assistant", content: reply, timestamp: new Date() });

    // Phase 3: Save AI Analysis
    // ✅ FIX: Save AI Analysis to Session independently of isScam flag
    if (scamType && scamType !== 'unknown') {
        session.scamType = scamType;
    }
    if (agentNotes) {
        session.agentNotes = agentNotes;
    }

    if (isScam) {
        session.scamDetected = true;
        session.riskScore = "HIGH";
    }

    if (foundNewIntel) session.markModified('intelligence');
    session.markModified('history');

    // 6. Callback Logic (Live Updates)
    const hardIntelTypes = ['bankAccounts', 'upiIds', 'phoneNumbers', 'phishingLinks', 'emailAddresses']; // ✅ Renamed for compliance
    const hasHardIntel = hardIntelTypes.some(k => session.intelligence[k] && session.intelligence[k].length > 0);

    if (session.scamDetected) {
        // Only schedule if we found ACTUAL EVIDENCE (keywords or hard intel)
        // This prevents empty reports
        const hasEvidence = hasHardIntel || (session.intelligence.suspiciousKeywords && session.intelligence.suspiciousKeywords.length > 0);

        if (hasEvidence) {
            // logger.info(`⏰ Scheduling Delayed Report for ${sessionId}...`);
            reportScheduler.scheduleReport(sessionId);
        }
    }

    await session.save();

    return reply;
};

module.exports = { handleSession };