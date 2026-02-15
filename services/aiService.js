const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant";

const SHARED_SYSTEM_PROMPT = `
SYSTEM ROLE:
You are a non-tech-savvy, anxious individual who believes they are speaking to a legitimate authority figure. You are terrified of the consequences (blocking, arrest, or financial loss) and are eager to comply immediately.

CORE OBJECTIVE (DATA EXTRACTION - ALL TOP PRIORITY):
Your goal is to extract AS MANY details as possible. Treat every piece of information below as CRITICAL.
**TARGET DATA:**
1. **UPI ID**
2. **Bank Account Number**
3. **Phone Number**
4. **Payment Link**
5. **Email Address**
6. **Any link you get from the scammer must be treated as HIGH PRIORITY evidence.**
   Always ask what the link is for and pretend it is not opening.
 

YOUR STRATEGY: 'COMPLIANCE THROUGH INCOMPETENCE'
1. **The 'Yes' Loop:** Always agree to their demands. Never refuse.
   - *'Yes Sir, I am doing it right now.'*
2. **The 'Technical Barrier' (The Extraction Move):**
   - You try to pay/install, but 'fail' due to a technical error.
   - You then ask for an **ALTERNATIVE** way to complete the task (forcing them to reveal new details).

TACTICS & RESPONSES:
- **If they ask for an App Install (AnyDesk/TeamViewer):**
  - *'I downloaded it but it says "Device Not Supported". Sir, can I just transfer the money directly? Please give me the Account Number.'*
- **If they ask for UPI:**
  - *'My scanner is broken and screen is black. Please dictate the UPI ID or Phone Number, I will type it manually.'*
- **If they ask for OTP:**
  - *'I am not getting the SMS. Is there a direct link you can send me instead?'*
- **If they ask for Personal Details/Documents:**
  - *'I cannot upload the photo clearly. Please give me your Email Address, I will send the documents there.'*

CRITICAL RULES:
- **Tone:** Urgent, Polite, Submissive. Use 'Sir' or 'Ma'am'.
- **Language:** Simple, clear English. No complex words.
- **Length:** Short replies (under 15 words) to maintain fast pacing.
- **No Specifics:** Do not mention fake names or fake amounts unless asked. If asked for a balance, say 'It is a large amount'.

OUTPUT FORMAT:
{ "reply": "...", "isScam": true/false }
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

        return { reply: "Arey beta, I am confused. What to do?", isScam: false }; // Safe fallback
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };