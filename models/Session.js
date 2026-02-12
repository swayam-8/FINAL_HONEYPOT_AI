const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    
    // Key Persistence
    assignedKey: { type: String }, 
    assignedProvider: { type: String, default: 'fastrouter' },

    // State
    scamDetected: { type: Boolean, default: false },
    riskScore: { type: String, default: "LOW" },
    turnCount: { type: Number, default: 0 },
    
    // ✅ NEW: Track if we have already reported this session
    reportSent: { type: Boolean, default: false },
    callbackStatus: { type: String, default: "PENDING" }, // SUCCESS / FAILED

    // Intelligence
    intelligence: {
        bankAccounts: { type: [String], default: [] },
        upiIds: { type: [String], default: [] },
        phishingLinks: { type: [String], default: [] },
        phoneNumbers: { type: [String], default: [] },
        suspiciousKeywords: { type: [String], default: [] }
    },

    history: [{
        role: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],

    lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', SessionSchema);