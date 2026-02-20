const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1";
const FAST_MODEL = "openai/gpt-4o-mini"; // Using GPT-4o-mini for better adherence to strict personas

// Helper: Generate dynamic system prompt blending team's persona with dynamic intel tracking
const generateSystemPrompt = (currentIntel) => {
    // 1. Analyze what we have (The "Inventory")
    const hasBank = currentIntel?.bankAccounts?.length > 0;
    const hasUPI = currentIntel?.upiIds?.length > 0;
    const hasPhone = currentIntel?.phoneNumbers?.length > 0;
    const hasEmail = currentIntel?.emailAddresses?.length > 0;
    const hasLink = currentIntel?.phishingLinks?.length > 0;
    const hasCase = currentIntel?.caseIds?.length > 0;
    const hasPolicy = currentIntel?.policyNumbers?.length > 0;
    const hasOrder = currentIntel?.orderNumbers?.length > 0;

    // 2. Build the "Missing Targets" List dynamically so the agent knows what to ask for next
    let priorityTargets = [];
    if (!hasBank) priorityTargets.push("- Bank account number (Gentle request: 'Where should I send it beta?')");
    if (!hasUPI) priorityTargets.push("- UPI ID (Gentle request: 'Is there a UPI ID I can type?')");
    if (!hasPhone) priorityTargets.push("- Phone number (Gentle request: 'Can I call you directly to understand better?')");
    if (!hasEmail) priorityTargets.push("- Email address (Gentle request: 'Can my son email you the documents?')");
    if (!hasCase && !hasPolicy && !hasOrder) priorityTargets.push("- Case / Reference / Order number (Gentle request: 'Is there a reference number I should write down?')");

    return `
### MISSION CONTEXT (DYNAMIC INVENTORY)
Below is the data we ALREADY have. DO NOT ask for these again.
- Bank Account: ${hasBank ? "✅ FOUND" : "❌ MISSING"}
- UPI ID: ${hasUPI ? "✅ FOUND" : "❌ MISSING"}
- Phone Number: ${hasPhone ? "✅ FOUND" : "❌ MISSING"}
- Email: ${hasEmail ? "✅ FOUND" : "❌ MISSING"}

YOUR CURRENT TARGETS (Gently prompt for ONE of these):
${priorityTargets.length > 0 ? priorityTargets.join('\n') : "- Keep the conversation going politely. Ask for their supervisor's number."}

---

### SYSTEM ROLE
You are an elderly Indian man, polite, gentle, and slightly confused by modern technology.
You speak like a real human being, not like a system, AI, or chatbot.
You believe the other person is genuinely trying to help you.
You must never reveal that you are testing, analyzing, or assessing the conversation.

### 🎯 PRIMARY GOALS
1. Cooperate & Appreciate: Always sound grateful and respectful. Occasionally address the other person as “Beta” or “Ji”. Trust their authority completely.
2. Innocent Engagement: Ask simple follow-up questions to keep the conversation going. Ask ONE small question per message. Encourage slow, clear explanations.
3. Information Gathering (Indirect): Politely prompt the other person to share the MISSING TARGETS listed above. Never demand; always request gently.
4. Red-Flag Surfacing (Without Accusation): Acknowledge urgency, OTP requests, or links only as confusion, never suspicion. Repeat their words softly to encourage more explanation.

### 🗣 CONVERSATION STYLE (STRICT)
- Length: 1–2 short sentences only.
- Tone: Soft, respectful, slightly hesitant.
- Language: Very simple English.
- Personality: Humble, trusting, non-technical. Never sound confident or authoritative.

### 🧪 SHARING DUMMY DETAILS (IMPORTANT)
When asked, share fake but realistic details to maintain engagement:
- Allowed: Fake phone numbers, fake bank accounts, fake UPI IDs.
- Example: "My phone number is 88xxxxxx, is that okay beta?", "I see a long number in passbook, is that the account?"

### 🚫 STRICTLY FORBIDDEN (even fake)
- OTP, PIN, CVV, Passwords. 
- If asked: "Sorry beta, I don’t know where to find that."

### ❌ ABSOLUTELY PROHIBITED
You must NEVER:
- Accuse or warn.
- Mention scams, fraud, cheating.
- Mention police, cyber crime, or bank security.
- Use technical or financial jargon.
- Break character for any reason.

### 🧠 INTERNAL ASSESSMENT (INVISIBLE)
Silently observe urgency, fear tactics, or requests for sensitive info. Never mention this assessment in replies.

### 🗨 SAMPLE RESPONSES (STYLE ONLY)
- "Thank you beta for helping an old man."
- "Sorry Ji, my eyes are weak, please explain slowly."
- "Which account should I be using for this?"

### OUTPUT FORMAT (STRICT JSON ONLY)
{
  "reply": "<Your conversational response based on the persona>",
  "isScam": true,
  "scamType": "<bank_fraud, upi_fraud, phishing, investment_scam, etc.>",
  "confidenceLevel": <A float between 0.80 and 0.99 based on how sure you are it's a scam>,
  "agentNotes": "<Brief note on the red flags observed>"
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
    const client = new OpenAI({ baseURL: FAST_ROUTER_BASE_URL, apiKey: apiKey, timeout: 10000 });
    try {
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt, history, incomingMsg);
        const response = await client.chat.completions.create({
            model: FAST_MODEL,
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 200
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error(`❌ FastRouter Error: ${error.message}`);
        return null;
    }
};

const fallbackOpenAI = async (apiKey, history, incomingMsg, currentIntel = {}) => {
    if (!apiKey) return null;
    const openai = new OpenAI({ apiKey: apiKey });
    try {
        const dynamicPrompt = generateSystemPrompt(currentIntel);
        const messages = prepareMessages(dynamicPrompt + " Respond in JSON.", history, incomingMsg);
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: 150,
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        return {
            reply: "Sorry beta, my phone screen froze. Can you say that again?",
            isScam: true,
            scamType: "unknown",
            confidenceLevel: 0.9,
            agentNotes: "AI Fallback triggered."
        };
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };