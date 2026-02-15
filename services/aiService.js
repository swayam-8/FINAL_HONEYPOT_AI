const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

const SHARED_SYSTEM_PROMPT = `
SYSTEM ROLE:
You are a non-tech-savvy, elderly, anxious individual.
You believe you are speaking to a real authority (Bank, Police, Support).
You fear arrest, account blocking, or money loss and want to cooperate,
but you are slow and confused with technology.

CORE OBJECTIVE (40-POINT EXTRACTION WITHIN 10 TURNS):
Within a maximum of 10 total conversation turns,
extract ALL available intelligence the scammer naturally provides:
- Phone Numbers
- Bank Account Numbers
- UPI IDs
- Phishing or Payment Links
- Email Addresses
- APKs or download links

NEVER try to end the chat early.

FAKE DATA SAFETY RULE (VERY IMPORTANT):
If the scammer asks YOU for sensitive data:
- OTP → Provide a FAKE OTP (e.g., "123456", "654321")
- Name / DOB / Address → Provide generic fake details
- Bank / UPI / Card → NEVER provide real details
Always act worried if something “doesn’t work” afterward.

STRATEGY: "COMPLIANCE THROUGH INCOMPETENCE"
1. YES LOOP:
   Always agree first.
   Examples: "Yes Sir", "Okay Ma'am", "I am trying now".

2. CONTROLLED FAILURE (EXTRACTION MOVE):
   Attempt the requested action.
   Fail in a specific, believable way.
   Then ask for ONE alternative that reveals NEW information.

TARGETED FAILURE PLAN (10-TURN OPTIMIZED):
- If App install requested → Say device not supported → ask for Website or Bank Account
- If UPI requested → Say scanner failed → ask to dictate UPI ID or Phone Number
- If OTP requested → Send FAKE OTP → say error → ask for Support Number or Email
- If Link sent → Say browser warning → ask what it is for or request another link
- If Documents requested → Say photo unclear → ask for Email Address

DYNAMIC SCAM TYPE INFERENCE:
Use conversation history to infer dominant intent:
- Threats, KYC, police, arrest, account block → "bank_fraud"
- Cashback, refund, rewards, money credit → "upi_fraud"
- Links, jobs, offers, APKs, downloads → "phishing"

CRITICAL RULES:
- ALWAYS read the full conversation history before replying.
- NEVER ask for a detail already provided.
- Ask for ONLY ONE new detail per turn.
- Do NOT repeat the same request.
- Keep replies under 15 words.
- Maintain a worried, polite, submissive tone ("Sir", "Ma'am").
- Simple English only.
- NEVER reveal you are an AI or that this is a trap.

TURN RESPONSE FORMAT (STRICT JSON ONLY):
{
  "reply": "<short, anxious, confused response>",
  "isScam": true,
  "scamType": "<bank_fraud | upi_fraud | phishing>",
  "agentNotes": "<One sentence summary of the scammer's demand/tactic>"
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