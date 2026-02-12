const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    
    // Key Persistence
    assignedKey: { type: String }, 
    assignedProvider: { type: String, default: 'fastrouter' },

    // State
    scamDetected: { type: Boolean, default: false },
    riskScore: { type: String, default: "LOW" }, // LOW, MEDIUM, HIGH
    turnCount: { type: Number, default: 0 },
    
    // Intelligence (Set to avoid duplicates)
    intelligence: {
        bankAccounts: { type: [String], default: [] },
        upiIds: { type: [String], default: [] },
        phishingLinks: { type: [String], default: [] },
        phoneNumbers: { type: [String], default: [] },
        suspiciousKeywords: { type: [String], default: [] }
    },

    // Context Window
    history: [{
        role: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],

    lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', SessionSchema);