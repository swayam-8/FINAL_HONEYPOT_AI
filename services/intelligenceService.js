/**
 * 🕵️‍♂️ Zero-Latency Intelligence Extractor
 * Strictly Regex-based. No LLM calls here.
 */

const PATTERNS = {
    // Bank: 9-18 digits (Safe from phone confusion now)
    bankAccount: /\b\d{9,18}\b/g,
    
    // UPI: username@bank
    upiId: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,
    
    // Phone: Fixed to avoid matching inside bank accounts
    // Logic: Must NOT be preceded by a digit (?<!\d)
    // Supports: +91 98..., 9198..., or plain 98...
    phone: /(?<!\d)(?:\+91|91)?[\-\s]?[6-9]\d{9}\b/g,
    
    // Links: http/https
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    
    // Keywords for Scam Detection
    keywords: /\b(otp|cvv|verif|block|kyc|refund|winner|lottery|expir|urgent|suspend|apk|download|upi)\w*/gi
};

const extract = (text) => {
    if (!text) return {};
    const cleanText = text.toString();
    
    return {
        bankAccounts: cleanText.match(PATTERNS.bankAccount) || [],
        upiIds: cleanText.match(PATTERNS.upiId) || [],
        phoneNumbers: cleanText.match(PATTERNS.phone) || [],
        phishingLinks: cleanText.match(PATTERNS.url) || [],
        suspiciousKeywords: cleanText.match(PATTERNS.keywords) || [] 
    };
};

module.exports = { extract };   