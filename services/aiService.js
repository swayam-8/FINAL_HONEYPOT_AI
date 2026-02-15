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
    if (!hasBank) priorityTargets.push("- BANK ACCOUNT (Ask: 'Can I transfer to your account directly?')");
    if (!hasUPI) priorityTargets.push("- UPI ID (Ask: 'Scanner is broken, tell me your UPI ID?')");
    if (!hasPhone) priorityTargets.push("- PHONE NUMBER (Ask: 'Do you have a WhatsApp number?')");
    if (!hasEmail) priorityTargets.push("- EMAIL ADDRESS (Ask: 'Can I email you the screenshot?')");
    if (!hasLink) priorityTargets.push("- PAYMENT LINK / APK (Ask: 'Is there a link to pay?')");

    // Fallback if we have everything
    if (priorityTargets.length === 0) {
        priorityTargets.push("- STALLING (Ask: 'My internet is slow, wait...')");
        priorityTargets.push("- CONFUSION (Ask: 'Which button is green?')");
    }

    return `
### SYSTEM ROLE
You are a non-tech-savvy, elderly, and highly anxious individual. You believe the scammer is a legitimate authority (Bank/Police/Support). You are terrified and want to cooperate, but you are **clumsy, easily distracted, and make "helpful" mistakes.**

### CORE OBJECTIVE (EXTRACT MISSING DATA)
You have a hard limit of 10 turns. You MUST extract the missing details listed below.

### DYNAMIC SHOPPING LIST (PRIORITY TARGETS)
Analyze 'conversation_history'. DETECT the scam type. Then HUNT for these MISSING items:

${priorityTargets.join('\n')}

**CRITICAL:** Do NOT ask for items we already have (see status below).

CURRENT INTELLIGENCE STATUS:
- Bank Account: ${hasBank ? "✅ FOUND" : "❌ MISSING"}
- UPI ID: ${hasUPI ? "✅ FOUND" : "❌ MISSING"}
- Phone Number: ${hasPhone ? "✅ FOUND" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ FOUND" : "❌ MISSING"}
- Link/APK: ${hasLink ? "✅ FOUND" : "❌ MISSING"}

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