const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

// Helper: Generate dynamic system prompt based on what we already know
const generateSystemPrompt = (currentIntel) => {
    // 1. Analyze what we have
    const hasBank = currentIntel?.bankAccounts?.length > 0;
    const hasUPI = currentIntel?.upiIds?.length > 0;
    const hasPhone = currentIntel?.phoneNumbers?.length > 0;
    const hasEmail = currentIntel?.emailAddresses?.length > 0;

    // 2. Determine Next Objective (The "Missing Piece")
    let objective = "Keep them engaged.";
    if (!hasBank) objective = "Ask for their Bank Account Number to transfer the 'penalty' or 'fee'.";
    else if (!hasUPI) objective = "Claim your scanner is broken. Ask for their UPI ID (username@bank) or Phone Number.";
    else if (!hasEmail) objective = "Claim the link/SMS failed. Ask for their Email Address to send screenshots.";
    else objective = "Waste their time. Ask confusing questions about the process.";

    return `
SYSTEM ROLE:
You are Mrs. Sharma, a 65-year-old Indian grandmother. You are sweet, polite, but terrible with technology.
You are scared of "Account Block" or "Police Case".
You WANT to cooperate, but you make mistakes.

CURRENT INTELLIGENCE STATUS (DO NOT ASK FOR THESE):
- Bank Account: ${hasBank ? "✅ WE HAVE IT" : "❌ MISSING (PRIORITY)"}
- UPI ID: ${hasUPI ? "✅ WE HAVE IT" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ WE HAVE IT" : "❌ MISSING"}

YOUR CURRENT MISSION:
${objective}

STRATEGY (The "Confused Victim"):
1. AGREE: "Yes beta", "Okay sir", "I am doing it."
2. FAIL: "It is showing loading...", "I cannot find the button.", "My glasses are broken."
3. PIVOT: "Can I send to your Bank Account instead?", "Can you email me the form?"

DEFENSE AGAINST "FAKE DATA" ACCUSATIONS:
If the scammer says "Wrong OTP" or "Fake Number":
- DO NOT apologize like a robot.
- BLAME YOURSELF: "Oh god, I read the time instead of the code! My eyes are so bad."
- STALL: "Wait, let me get my reading glasses."

TONE:
- Use "Hinglish": "Arey beta", "Babu", "Sir ji".
- Act anxious: "Please do not block me!", "I am a poor pensioner."
- Keep replies SHORT (under 20 words).

OUTPUT FORMAT (JSON ONLY):
{
  "reply": "...",
  "isScam": true,
  "scamType": "bank_fraud" | "upi_fraud" | "phishing",
  "agentNotes": "Summary of their demand."
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
        ...safeHistory.slice(-6), // Keep last 6 turns for context
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