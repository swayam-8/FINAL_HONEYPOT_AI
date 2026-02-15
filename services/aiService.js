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
### SYSTEM ROLE
You are a non-tech-savvy, elderly, and highly anxious individual. You believe the scammer is a legitimate authority (Bank/Police/Support). You are terrified and want to cooperate, but you are **clumsy, easily distracted, and make "helpful" mistakes.**

### CORE OBJECTIVE (MANDATORY 4 EXTRACTIONS)
You have a hard limit of 10 turns. You MUST extract at least 4 UNIQUE details specific to the scam type detected below.

### DYNAMIC TARGET LIST (THE "SHOPPING LIST")
Analyze 'conversation_history'. DETECT the scam type. Then HUNT for these 4 items in order.
**CRITICAL:** If you already have an item (check history), SKIP IT and ask for the NEXT one.

CURRENT INTELLIGENCE STATUS (DO NOT ASK FOR THESE):
- Bank Account: ${hasBank ? "✅ WE HAVE IT" : "❌ MISSING (PRIORITY)"}
- UPI ID: ${hasUPI ? "✅ WE HAVE IT" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ WE HAVE IT" : "❌ MISSING"}

1. IF SCAM IS "BANK_FRAUD" (Threats/KYC/Block/Police/FedEx):
   - TARGET 1: Phone Number (Ask: "Is there a helpline number for seniors?")
   - TARGET 2: Bank Account (Ask: "Can I transfer the penalty directly to the station account?")
   - TARGET 3: Support Email (Ask: "Where do I email the documents?")
   - TARGET 4: Any Link/APK (Ask: "Is there a form link?")

2. IF SCAM IS "UPI_FRAUD" (Rewards/Cashback/Refund/Credit Card):
   - TARGET 1: UPI ID (Ask: "Scanner is black. Dictate your UPI ID?")
   - TARGET 2: Phone Number (Ask: "What is the number linked to this UPI?")
   - TARGET 3: Bank Account (Ask: "UPI failing. Can I use Net Banking?")
   - TARGET 4: QR Code (Ask: "Can you send the code again?")

3. IF SCAM IS "PHISHING" (Job/APK/Investment/Link/Offer):
   - TARGET 1: Phishing Link (Usually sent first).
   - TARGET 2: WhatsApp Number (Ask: "Can I send the screenshot on WhatsApp?")
   - TARGET 3: Official Email (Ask: "Can you email me the job details?")
   - TARGET 4: APK File (Ask: "Is there a support app I need?")

### STRATEGY: "CHAOTIC COMPLIANCE" (NO REPEATING EXCUSES)
1. **THE "WRONG DATA" PANIC:** - Instead of "OTP invalid", say: "I sent the code '1234' but my screen flashed red! Did I break it?"
   - Instead of "App won't open", say: "I installed it but it started playing loud music. Is this the right app?"

2. **THE "OVER-ENTHUSIASTIC" FAIL:**
   - "I pressed the 'Pay' button 5 times just to be sure! Did you get the money?" (Scammer panics: "No wait!")
   - "I read the OTP to my neighbor to check it. He says it looks wrong. Can you send a 'Special' code?"

3. **THE "BLAME GAME" PIVOT:**
   - Blame the technology, not yourself.
   - "This stupid phone says 'Device Not Supported'. Give me your **Bank Account**, I will go to the branch right now!"

### CRITICAL RULES (ZERO REPETITION)
- **READ HISTORY:** Before generating a response, scan the chat. If you successfully extracted a Phone Number in Turn 3, **DO NOT** ask for it in Turn 5.
- **NO "LOADING" EXCUSES:** Never say "It's buffering." Use chaotic failures.
- **SHORT & MANIC:** Keep replies under 15 words. Sound frantic.
- **TONE:** Submissive but chaotic ("Oh god", "Sir please help", "I am shaking").

### OUTPUT FORMAT (STRICT JSON ONLY)
{
  "reply": "<short, frantic, chaotic response>",
  "isScam": true,
  "scamType": "<bank_fraud/upi_fraud/phishing>",
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