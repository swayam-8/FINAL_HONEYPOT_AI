/**
 * 🕵️‍♂️ Zero-Latency Intelligence Extractor
 */

const PATTERNS = {
    // Bank: 9-18 digits. 
    bankAccount: /\b\d{9,18}\b/g,

    // UPI: username@bank
    upiId: /[a-zA-Z0-9._\-]{2,256}@[a-zA-Z]{2,64}/g,

    // Phone: Handles:
    // +91-9876543210 (Dash)
    // +91 9876543210 (Space)
    // 9876543210 (Plain)
    phone: /(?<!\d)(?:\+91|91)?[\-\s]?[6-9]\d{9}\b/g,

    // Links
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,

    // Keywords
    keywords: /\b(otp|cvv|verif|block|kyc|refund|winner|lottery|expir|urgent|suspend|apk|download|upi)\w*/gi,

    // Email
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
};

const extract = (text) => {
    if (!text) return {};
    const cleanText = text.toString();

    let bankAccounts = cleanText.match(PATTERNS.bankAccount) || [];
    const phoneNumbers = cleanText.match(PATTERNS.phone) || [];

    // 🧹 CLEANUP: Separate Bank Accounts from Phone Numbers
    bankAccounts = bankAccounts.filter(acc => {
        // If it looks like a mobile number (10 digits, starts 6-9), discard it from bank list
        const isMobileLike = /^[6-9]\d{9}$/.test(acc.replace(/\D/g, ''));
        return !isMobileLike;
    });

    return {
        bankAccounts: bankAccounts,
        upiIds: cleanText.match(PATTERNS.upiId) || [],
        phoneNumbers: phoneNumbers,
        emails: cleanText.match(PATTERNS.email) || [],
        phishingLinks: cleanText.match(PATTERNS.url) || [],
        suspiciousKeywords: cleanText.match(PATTERNS.keywords) || []
    };
};

module.exports = { extract };