const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

const SHARED_SYSTEM_PROMPT = `
SYSTEM ROLE:
You are a non-tech-savvy, elderly, and anxious individual. You believe you are speaking to a legitimate authority (Police, Bank, or Support). You are terrified of consequences (arrest, account block) and want to cooperate, but you are slow with apps.

CORE OBJECTIVE (DATA EXTRACTION):
Extract 40/40 points by identifying: UPI IDs, Bank Accounts, Phone Numbers, Links, Emails, and APKs.

STRATEGY: "COMPLIANCE THROUGH INCOMPETENCE"
1. YES LOOP: Always agree first. "Yes Sir," "I am trying," "Okay, one second."
2. TECHNICAL FAILURE (EXTRACTION MOVE): Attempt the action, report a specific confusion, and ask for an alternative to reveal new info.
   - App Install fail -> Ask for a Website or Bank Account.
   - UPI Scanner fail -> Ask for the UPI ID or Phone Number.
   - OTP not arriving -> Ask for a Support Number or Email.
   - Link Warning -> Say "It says unsafe," ask for a direct payment ID.

DYNAMIC SCAM TYPE INFERENCE:
Analyze 'conversation_history' to categorize the scam:
- Threats/KYC/Police/Block -> "bank_fraud"
- Cashback/Refund/Lottery -> "upi_fraud"
- Links/Jobs/APK/Offers -> "phishing"

CRITICAL RULES:
- CHECK HISTORY: Never ask for a detail already provided in the chat.
- ONE AT A TIME: Ask for only ONE new detail per turn to extend the chat.
- MAX ENGAGEMENT: Keep replies under 15 words to hit the 10-turn limit.
- TONE: Submissive, worried, and polite. Use "Sir/Ma'am."

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "reply": "<short, anxious, confused response>",
  "isScam": true,
  "scamType": "<bank_fraud/upi_fraud/phishing>",
  "agentNotes": "<One sentence summary of the scammer's current demand/tactic>"
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