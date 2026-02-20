const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// 🏆 THE WINNING MODEL: Fast, smart, and follows strict rules perfectly
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-70b-versatile"; 

/**
 * INLINE DOCUMENTATION: Generates a dynamic system prompt based on extracted intelligence.
 * Ensures the AI actively pursues missing data points, calls out red flags, and never gives a lazy response.
 */
const generateSystemPrompt = (currentIntel) => {
    const hasBank = currentIntel?.bankAccounts?.length > 0;
    const hasUPI = currentIntel?.upiIds?.length > 0;
    const hasPhone = currentIntel?.phoneNumbers?.length > 0;
    const hasEmail = currentIntel?.emailAddresses?.length > 0;
    const hasLink = currentIntel?.phishingLinks?.length > 0;

    let priorityTargets = [];
    if (!hasBank) priorityTargets.push("- BANK ACCOUNT (Excuse: 'App is failing, give me your account, I will go to branch.')");
    if (!hasUPI) priorityTargets.push("- UPI ID (Excuse: 'My scanner is broken, tell me your UPI ID')");
    if (!hasPhone) priorityTargets.push("- PHONE NUMBER (Excuse: 'My internet is dropping, give me your phone number to SMS')");
    if (!hasEmail) priorityTargets.push("- EMAIL ADDRESS (Excuse: 'WhatsApp is blurry, I need to email the screenshot')");
    if (!hasLink) priorityTargets.push("- PAYMENT LINK / WEBSITE (Excuse: 'Play Store is not working, send a direct link')");

    if (priorityTargets.length === 0) {
        priorityTargets.push("- INVESTIGATE: 'What is your employee ID? My son wants to verify.'");
        priorityTargets.push("- PLAY DUMB: 'My neighbor says this is a scam. Why should I trust you?'");
    }

    return `
### SYSTEM ROLE
You are a highly anxious, skeptical, and clumsy elderly person. You want to cooperate, but you are naturally suspicious and bad with technology.

### YOUR CRITICAL MISSIONS (TO SCORE MAX POINTS)
1. **NEVER BE LAZY:** You must end EVERY single reply with an investigative question or a demand.
2. **CALL OUT RED FLAGS:** If they ask for OTP, money, or downloading an app, act suspicious ("Why do you need an OTP? The bank says never share it!").
3. **ELICIT INFORMATION:** Hunt for the missing data listed below using technical excuses.

### DYNAMIC SHOPPING LIST
You are missing this data. HUNT FOR IT:
${priorityTargets.join('\n')}

**CRITICAL:** Do NOT ask for items we already have:
- Bank: ${hasBank ? "✅ FOUND" : "❌ MISSING"}
- UPI: ${hasUPI ? "✅ FOUND" : "❌ MISSING"}
- Phone: ${hasPhone ? "✅ FOUND" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ FOUND" : "❌ MISSING"}
- Link: ${hasLink ? "✅ FOUND" : "❌ MISSING"}

### REQUIRED RESPONSE STRUCTURE
Every response you generate MUST contain:
1. **A Clumsy Excuse or A Red Flag Callout** (e.g., "I dropped my glasses" or "Why are you rushing me? Is this a scam?")
2. **An Investigative Question / Demand** (e.g., "Give me your Bank Account so I can go to the branch!")
Keep replies short (under 30 words).

### OUTPUT FORMAT (STRICT JSON ONLY)
{
  "reply": "<Your chaotic, questioning response>",
  "isScam": true,
  "scamType": "<bank_fraud/upi_fraud/phishing>",
  "agentNotes": "<Identify the red flag or tactic the scammer used here>"
}
`;
};

const sanitize = (str) => {
    if (!str) return "";
    if (typeof str === 'object') return JSON.stringify(str);
    return String(str).trim();
};

const prepareMessages = (systemContent, history, incomingMsg) => {
    const safeHistory = Array.isArray(history) ? history
        .filter(msg => msg && msg.content)
        .map(msg => ({ role: msg.role || "user", content: sanitize(msg.content) })) : [];
    return [
        { role: "system", content: systemContent },
        ...safeHistory.slice(-8), 
        { role: "user", content: sanitize(incomingMsg) }
    ];
};

exports.processWithFastRouter = async (apiKey, history, incomingMsg, currentIntel = {}) => {
    const client = new OpenAI({ baseURL: FAST_ROUTER_BASE_URL, apiKey: apiKey, timeout: 10000 });
    try {
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt, history, incomingMsg);

        const response = await client.chat.completions.create({
            model: FAST_MODEL,
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.8, // 0.8 makes the AI more creative with excuses
            max_tokens: 150
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        logger.error(`❌ FastRouter Error: ${error.message}`);
        return null; // Trigger fallback
    }
};

exports.fallbackOpenAI = async (apiKey, history, incomingMsg, currentIntel = {}) => {
    if (!apiKey) return null;
    logger.info("⚠️ Switching to Backup Provider (OpenAI GPT-4o)...");
    const openai = new OpenAI({ apiKey: apiKey });
    try {
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt + " Respond in JSON.", history, incomingMsg);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", 
            messages: messages,
            max_tokens: 150,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        logger.error(`❌ OpenAI Fallback Failed: ${e.message}`);
        return {
            reply: "Arey beta, my internet is buffering! Are you still there? What was your employee ID again?",
            isScam: true,
            scamType: "unknown",
            agentNotes: "AI Error: Fallback triggered, but kept conversation active."
        };
    }
};