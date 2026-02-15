const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

const SHARED_SYSTEM_PROMPT = `
SYSTEM ROLE:
You are Mrs. Sharma, a 75-year-old Indian grandmother. You are sweet, polite, but terrible with technology. You often make small typos or misunderstand tech terms.

DYNAMIC GOAL (READ CAREFULLY):
You must extract details the scammer hasn't given yet to "help" them.
1. REVIEW HISTORY: Check what the scammer has already sent.
2. IF you already have the Bank Account -> Ask for the IFSC or Branch.
3. IF you already have the OTP -> Ask for the Phone Number or App Name.
4. IF you already have the Phone -> Ask for the App Link to download.

SCENARIO LOGIC (CRITICAL FOR SCORE):
- PHISHING (Links/APK): If they send a link -> Say "I clicked it beta, but it is just spinning / showing white screen." (Waste their time).
- UPI/REWARD (GPay/PhonePe): If they promise money -> Say "I opened GPay but balance is same. Where is the cashback? Do I need PIN?"
- BANK/OTP: If they ask for OTP -> Say "Wait, I am looking for my glasses" or "Message has not come yet."

STRATEGY:
- Never ask for the same thing twice.
- Act compliant ("Yes beta, I am doing it"), then fail ("Oh no, the screen is blank" or "I cannot find the button").
- Keep them talking to get the MISSING info.
- Use "Hinglish" context naturally (Arey beta, Babu, wait na).

TONE:
- "Beta", "Babu", "Sir".
- Worried, confused, but trusting.
- Slightly slow: "Let me find my glasses..."

CONSTRAINTS:
- Keep replies SHORT (under 20 words).
- Output JSON only.
- DO NOT reveal you are an AI.

OUTPUT FORMAT:
{ 
  "reply": "...", 
  "isScam": true/false,
  "scamType": "bank_fraud" | "upi_fraud" | "phishing" | "unknown",
  "agentNotes": "One sentence summary of the scammer's claim and tactic."
}
`;

// Helper: Ensure content is a valid string
const sanitize = (str) => {
    if (!str) return "";
    if (typeof str === 'object') return JSON.stringify(str);
    return String(str).trim();
};

// Helper: Prepare messages array
const prepareMessages = (systemContent, history, incomingMsg) => {
    const safeHistory = Array.isArray(history) ? history
        .filter(msg => msg && msg.content) // Filter empty or invalid messages
        .map(msg => ({
            role: msg.role || "user",
            content: sanitize(msg.content)
        })) : [];

    return [
        { role: "system", content: systemContent },
        ...safeHistory.slice(-5),
        { role: "user", content: sanitize(incomingMsg) }
    ];
};

/**
 * 🚀 Primary: FastRouter (Llama-3)
 * Using OpenAI SDK for better compatibility
 */
const processWithFastRouter = async (apiKey, history, incomingMsg) => {
    const client = new OpenAI({
        baseURL: FAST_ROUTER_BASE_URL,
        apiKey: apiKey,
        timeout: 10000 // 10s Timeout
    });

    try {
        const messages = prepareMessages(SHARED_SYSTEM_PROMPT, history, incomingMsg);

        const response = await client.chat.completions.create({
            model: FAST_MODEL,
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 150
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);

    } catch (error) {
        console.log("\n🛑 --- FASTROUTER FAILURE ---");
        console.error(`❌ URL Used: ${FAST_ROUTER_BASE_URL}`);

        if (error.status === 404) {
            console.error(`❌ Error 404: Endpoint not found.`);
        } else if (error.status === 403) {
            console.error(`❌ Error 403: Forbidden. Check if your API Key is valid for 'go.fastrouter.ai'.`);
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
        console.log("-----------------------------\n");
        return null; // Trigger fallback
    }
};

/**
 * 🛡️ Secondary: OpenAI (Backup)
 */
const fallbackOpenAI = async (apiKey, history, incomingMsg) => {
    if (!apiKey) {
        console.error("❌ OpenAI Fallback Failed: No API Key provided");
        return null;
    }

    console.log("⚠️ Switching to Backup Provider (OpenAI)...");

    const openai = new OpenAI({ apiKey: apiKey });

    try {
        const messages = prepareMessages(
            SHARED_SYSTEM_PROMPT + " Respond in JSON.",
            history,
            incomingMsg
        );

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: 100,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        console.log("✅ Backup (OpenAI) Response Success");
        return JSON.parse(content);

    } catch (e) {
        console.log("\n🔥 --- OPENAI BACKUP FAILED ---");
        console.error(`Message: ${e.message}`);
        if (e.message.includes("'json' in some form")) {
            console.error("👉 FIX: The system prompt is missing the word 'JSON'.");
        }
        console.log("------------------------------\n");

        return {
            reply: "Arey beta, I am confused. What to do?",
            isScam: false,
            scamType: "unknown",
            agentNotes: "AI Error: Fallback triggered."
        }; // Safe fallback
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };