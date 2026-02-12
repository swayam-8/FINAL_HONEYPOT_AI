const logger = require('../utils/logger');
require('dotenv').config();

// Load Keys
const FAST_KEYS = (process.env.FAST_ROUTER_KEYS || "").split(',').map(k => k.trim()).filter(k => k);
const OPEN_KEYS = (process.env.OPENAI_KEYS || "").split(',').map(k => k.trim()).filter(k => k);

// In-Memory Assignment Map: <SessionID, KeyObject>
// KeyObject: { key: string, provider: 'fastrouter' | 'openai' }
const activeAssignments = new Map();

/**
 * 🔑 Get a Sticky Key for a Session
 * Reuses the same key for the entire session lifecycle.
 */
const getKeyForSession = (sessionId, existingProvider = 'fastrouter', existingKey = null) => {
    // 1. Check Memory (Fastest)
    if (activeAssignments.has(sessionId)) {
        return activeAssignments.get(sessionId);
    }

    // 2. Reuse Persistence (If loaded from DB)
    if (existingKey) {
        const assignment = { key: existingKey, provider: existingProvider };
        activeAssignments.set(sessionId, assignment);
        return assignment;
    }

    // 3. Assign New Key (Load Balancing via Session Hash)
    // Deterministic assignment ensures we don't need complex locking
    let pool = FAST_KEYS;
    let provider = 'fastrouter';

    // Failover if FastRouter empty (unlikely given requirements)
    if (pool.length === 0) {
        pool = OPEN_KEYS;
        provider = 'openai';
    }

    if (pool.length === 0) {
        logger.error("CRITICAL: No Keys available!");
        return null; 
    }

    const index = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % pool.length;
    const assignedKey = pool[index];
    
    const assignment = { key: assignedKey, provider };
    activeAssignments.set(sessionId, assignment);
    
    return assignment;
};

/**
 * 🔓 Release Key (Cleanup)
 */
const releaseKey = (sessionId) => {
    activeAssignments.delete(sessionId);
};

module.exports = { getKeyForSession, releaseKey };