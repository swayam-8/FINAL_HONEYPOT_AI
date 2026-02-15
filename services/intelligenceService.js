/**
 * 🕵️‍♂️ Zero-Latency Intelligence Extractor
 */

const PATTERNS = {
    // Bank: 9-18 digits. 
    bankAccount: /\b\d{9,18}\b/g,

    // Email: Standard email pattern
    email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,

    // UPI: username@bank
    upiId: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,

    // Phone: Matches +91-98... or 98...
    phone: /(?<!\d)(?:\+91|91)?[\-\s]?[6-9]\d{9}\b/g,

    // Links
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,

    // Keywords (General)
    keywords: /\b(otp|cvv|verif|block|kyc|refund|winner|lottery|expir|urgent|suspend|apk|download|upi|cashback|claim)\w*/gi,

    // Classification Categories
    typeBank: /\b(sbi|hdfc|icici|bank|account|blocked|kyc|pan|debit|credit|card|statement|otp)\b/i,
    typeUPI: /\b(upi|paytm|gpay|phonepe|cashback|reward|wallet|pin|receive|scan)\b/i,
    typePhish: /\b(click|link|http|win|offer|deal|expire|free|iphone|lottery|spin)\b/i
};

const extract = (text) => {
    if (!text) return {};
    const cleanText = text.toString();

    let bankAccounts = cleanText.match(PATTERNS.bankAccount) || [];
    let emails = cleanText.match(PATTERNS.email) || [];
    let upis = cleanText.match(PATTERNS.upiId) || [];
    const phoneNumbers = cleanText.match(PATTERNS.phone) || [];

    // 🧹 CLEANUP 1: Remove phone numbers from bank account list
    bankAccounts = bankAccounts.filter(acc => {
        const isMobileLike = /^[6-9]\d{9}$/.test(acc.replace(/\D/g, ''));
        return !isMobileLike;
    });

    // 🧹 CLEANUP 2: Separate Emails from UPIs
    // If a string is already identified as an email, remove it from UPIs
    upis = upis.filter(u => !emails.includes(u));

    // 🧠 CLASSIFICATION: Determine Scam Type
    let detectedType = "unknown";
    if (PATTERNS.typeBank.test(cleanText)) detectedType = "bank_fraud";
    else if (PATTERNS.typeUPI.test(cleanText)) detectedType = "upi_fraud";
    else if (PATTERNS.typePhish.test(cleanText)) detectedType = "phishing";

    return {
        bankAccounts: bankAccounts,
        upiIds: upis,
        emailAddresses: emails, // Matches Schema & PDF
        phoneNumbers: phoneNumbers,
        phishingLinks: cleanText.match(PATTERNS.url) || [],
        suspiciousKeywords: cleanText.match(PATTERNS.keywords) || [],
        scamType: detectedType // Returns the classified type
    };
};

module.exports = { extract };