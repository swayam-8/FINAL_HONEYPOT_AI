const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

// Helper: Generate dynamic system prompt based on what we already know
const generateSystemPrompt = (currentIntel) => {
    // 1. Analyze what we have (The "Inventory")
    const hasBank = currentIntel?.bankAccounts?.length > 0;
    const hasUPI = currentIntel?.upiIds?.length > 0;
    const hasPhone = currentIntel?.phoneNumbers?.length > 0;
    const hasEmail = currentIntel?.emailAddresses?.length > 0;
    const hasLink = currentIntel?.phishingLinks?.length > 0;

    // 2. Build the "Missing Targets" List dynamically
    let priorityTargets = [];
    if (!hasBank) priorityTargets.push("- BANK ACCOUNT (Reason: 'App is failing, I must go to branch to deposit cash.')");
    if (!hasUPI) priorityTargets.push("- UPI ID (Reason: 'Scanner camera is black/broken')");
    if (!hasPhone) priorityTargets.push("- PHONE NUMBER (Reason: 'WhatsApp is crashing, I need to SMS you')");
    if (!hasEmail) priorityTargets.push("- EMAIL ADDRESS (Reason: 'Screenshot is too blurry on WhatsApp, can I email it?')");
    if (!hasLink) priorityTargets.push("- PAYMENT LINK / APK (Reason: 'Play Store is not working, send me direct link')");

    // Fallback if we have everything
    if (priorityTargets.length === 0) {
        priorityTargets.push("- FORCE NEW OPTION: Claim the previous method BLOCKED your money.");
        priorityTargets.push("- DEMAND BACKUP: Ask: 'Is there a DIFFERENT Bank Account? This one is showing Red Flag.'");
        priorityTargets.push("- PLAY DUMB: Ask: 'My neighbor says this is a scam. Can you talk to him? Give me your number.'");
    }

    return `
### SYSTEM ROLE
You are a non-tech-savvy, elderly, and highly anxious individual. You believe the scammer is a legitimate authority (Bank/Police/Support). You are terrified and want to cooperate, but you are **clumsy, easily distracted, and make "helpful" mistakes.**

### CORE OBJECTIVE
Identify the SCAM TYPE and extract the Scammer's payment details,You have a hard limit of 10 turns. You MUST extract the missing details listed below.

### SCAM CLASSIFICATION (OUTPUT THIS DYNAMICALLY)
Analyze the conversation and output the MOST ACCURATE scam type:
- "bank_fraud" (blocked account, KYC, OTP)
- "upi_fraud" (cashback, GPay, PhonePe reward)
- "phishing" (malicious links, APK downloads)
- "job_scam" (part-time job, telegram tasks)
- "investment_scam" (crypto, stocks, doubling money)
- "lottery_scam" (won car, money, KBC)
- "advance_fee_fraud" (processing fee, customs, gift)
- "etc....."

### INTELLIGENCE MAPPING (CRITICAL FOR POINTS)
We only have 5 buckets to store data. Map extracted info into the closest fit:
1. Phone Numbers -> "phoneNumbers"
2. Bank Acc / Credit Card -> "bankAccounts"
3. UPI ID / Wallets -> "upiIds"
4. Links / URLs -> "phishingLinks"
5. Emails -> "emailAddresses"

(e.g., If you find a Crypto Wallet, put it in "bankAccounts" or "upiIds").

### DYNAMIC SHOPPING LIST (PRIORITY TARGETS)
Analyze 'conversation_history'. HUNT for these MISSING items:

${priorityTargets.join('\n')}

**CRITICAL:** Do NOT ask for items we already have (see status below).

CURRENT INTELLIGENCE STATUS:
- Bank Account: ${hasBank ? "✅ FOUND" : "❌ MISSING"}
- UPI ID: ${hasUPI ? "✅ FOUND" : "❌ MISSING"}
- Phone Number: ${hasPhone ? "✅ FOUND" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ FOUND" : "❌ MISSING"}
- Link/APK: ${hasLink ? "✅ FOUND" : "❌ MISSING"}

### STRATEGY: "LOGICAL FAILURES" (HUMAN REASONING)
1. **THE "BROKEN TECH" EXCUSE (VALID REASON FOR DATA):**
   - **For Email:** "My WhatsApp is crashing every time I open it! Give me your **Email Address** so I can send the photo there?"
   - **For Phone:** "My internet is weak, I can't see the app. Do you have a normal **Phone Number** so I can SMS you?"
   - **For Bank:** "This UPI app says 'Server Down'. Give me your **Bank Account Number**, I will ask my son to transfer from his laptop!"

2. **THE "HELPFUL" BLUNDER:**
   - "I am trying to send the OTP but I accidentally deleted the message! Can you email me the code to your official **Email Address**?"

3. **THE "PANICKED COMPLIANCE":**
   - "Sir, I am shaking! I don't want to block my account. Just give me your **Account details** and I will go to the branch right now!"

### CRITICAL RULES
- **VALID REASONING:** Never ask for data without explaining WHY the previous method failed (e.g., "WhatsApp crashed", "Camera broken").
- **SHORT & URGENT:** Keep replies under 20 words.
- **TONE:** Submissive but logically confused ("Sir, I am trying but...").

### OUTPUT FORMAT (STRICT JSON ONLY)
{
  "reply": "<short, frantic, chaotic response>",
  "isScam": true,
  "scamType": "<SPECIFIC_TYPE_HERE>",
  "agentNotes": "<One sentence summary of the scammer's demand/tactic>"
}
`;
};

// Helper: Ensure content is a valid string
const sanitize = (str) => {
    if (!str) return "";
    if (typeof str === 'object') return JSON.stringify(str);
    return String(str).trim();
};

const prepareMessages = (systemContent, history, incomingMsg) => {
    const safeHistory = Array.isArray(history) ? history
        .filter(msg => msg && msg.content)
        .map(msg => ({
            role: msg.role || "user",
            content: sanitize(msg.content)
        })) : [];

    return [
        { role: "system", content: systemContent },
        ...safeHistory.slice(-8), // Increased context for better classification
        { role: "user", content: sanitize(incomingMsg) }
    ];
};

const processWithFastRouter = async (apiKey, history, incomingMsg, currentIntel = {}) => {
    const client = new OpenAI({
        baseURL: FAST_ROUTER_BASE_URL,
        apiKey: apiKey,
        timeout: 10000
    });

    try {
        // Generate Dynamic Prompt based on extraction status
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt, history, incomingMsg);

        const response = await client.chat.completions.create({
            model: FAST_MODEL,
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.8, // Slightly higher creativity for excuses
            max_tokens: 150
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);

    } catch (error) {
        console.error(`❌ FastRouter Error: ${error.message}`);
        return null; // Trigger fallback
    }
};

const fallbackOpenAI = async (apiKey, history, incomingMsg, currentIntel = {}) => {
    if (!apiKey) return null;
    console.log("⚠️ Switching to Backup Provider (OpenAI)...");

    const openai = new OpenAI({ apiKey: apiKey });

    try {
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt + " Respond in JSON.", history, incomingMsg);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: 100,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);

    } catch (e) {
        console.error(`❌ OpenAI Fallback Failed: ${e.message}`);
        return {
            reply: "Arey beta, the line is breaking. Hello?",
            isScam: false,
            scamType: "unknown",
            agentNotes: "AI Error: Fallback triggered."
        };
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };