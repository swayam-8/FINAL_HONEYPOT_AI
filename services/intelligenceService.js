/**
 * 🕵️‍♂️ Zero-Latency Intelligence Extractor
 */

const PATTERNS = {
    // Bank: 9-18 digits. 
    // Captures even if inside brackets like (12345)
    bankAccount: /\b\d{9,18}\b/g,
    
    // UPI: username@bank
    // Now supports dots/underscores more robustly
    upiId: /[a-zA-Z0-9._\-]{2,256}@[a-zA-Z]{2,64}/g,
    
    // Phone: Indian +91 or 10-digit starting 6-9
    // Negative lookbehind (?<!\d) ensures we don't grab part of a bank account
    phone: /(?<!\d)(?:\+91|91)?[\-\s]?[6-9]\d{9}\b/g,
    
    // Links: http/https
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    
    // Keywords
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