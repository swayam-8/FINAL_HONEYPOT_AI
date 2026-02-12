/**
 * 🕵️‍♂️ Zero-Latency Intelligence Extractor
 */

const PATTERNS = {
    // Bank: 9-18 digits. 
    bankAccount: /\b\d{9,18}\b/g,
    
    // UPI: username@bank
    upiId: /[a-zA-Z0-9._\-]{2,256}@[a-zA-Z]{2,64}/g,
    
    // Phone: Matches +91-98... or 98...
    // Negative lookbehind (?<!\d) ensures we don't grab part of a longer number
    phone: /(?<!\d)(?:\+91|91)?[\-\s]?[6-9]\d{9}\b/g,
    
    // Links
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    
    // Keywords
    keywords: /\b(otp|cvv|verif|block|kyc|refund|winner|lottery|expir|urgent|suspend|apk|download|upi)\w*/gi
};

const extract = (text) => {
    if (!text) return {};
    const cleanText = text.toString();
    
    let bankAccounts = cleanText.match(PATTERNS.bankAccount) || [];
    const phoneNumbers = cleanText.match(PATTERNS.phone) || [];
    
    // 🧹 CLEANUP: If a "Bank Account" looks like a Phone Number (10 digits starting with 6-9), remove it.
    // This fixes the issue where "9876543210" appears in both lists.
    bankAccounts = bankAccounts.filter(acc => {
        const isMobileLike = /^[6-9]\d{9}$/.test(acc);
        return !isMobileLike;
    });

    return {
        bankAccounts: bankAccounts,
        upiIds: cleanText.match(PATTERNS.upiId) || [],
        phoneNumbers: phoneNumbers,
        phishingLinks: cleanText.match(PATTERNS.url) || [],
        suspiciousKeywords: cleanText.match(PATTERNS.keywords) || [] 
    };
};

module.exports = { extract };