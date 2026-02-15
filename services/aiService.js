const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_MODEL = "meta-llama/llama-3.1-8b-instant"; 
const FAST_ROUTER_URL = "https://go.fastrouter.ai/api/v1";

/**
 * 🚀 Primary: FastRouter (Llama-3)
 * ONE-PASS Strategy: Asks for Reply AND Classification in one go to save time.
 */
const processWithFastRouter = async (apiKey, history, incomingMsg) => {
  
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

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-4), // Keep context minimal
        { role: "user", content: incomingMsg }
    ];

    try {
        const response = await axios.post(
            FAST_ROUTER_URL,
            {
                model: "meta-llama/llama-3.1-8b-instant",
                messages: messages,
                response_format: { type: "json_object" }, // Force JSON if supported, else prompt injects it
                temperature: 0.7,
                max_tokens: 150
            },
            {
                headers: { 
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://hackathon.guvi.in"
                },
                timeout: 3000
            }
        );

        const content = response.data.choices[0].message.content;
        
        // Parse JSON output
        try {
            const parsed = JSON.parse(content);
            return { reply: parsed.reply, isScam: parsed.isScam };
        } catch (e) {
            // Fallback if model returns plain text
            return { reply: content, isScam: false };
        }

    } catch (error) {
        logger.warn(`FastRouter Failed: ${error.message}. Switching to Backup...`);
        return null; // Trigger fallback
    }
};

/**
 * 🛡️ Secondary: OpenAI (Backup Classifier)
 * Used ONLY if FastRouter fails or logic is ambiguous.
 */
const fallbackOpenAI = async (apiKey, history, incomingMsg) => {
    const openai = new OpenAI({ apiKey: apiKey });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost effective backup
            messages: [
                { role: "system", content: "You are a naive elderly victim. Reply naturally." },
                ...history.slice(-2),
                { role: "user", content: incomingMsg }
            ],
            max_tokens: 60
        });
        
        // Simple heuristic for scam detection in fallback mode
        const isScam = /urgent|verify|block|otp/i.test(incomingMsg);
        
        return { 
            reply: completion.choices[0].message.content, 
            isScam: isScam 
        };

    } catch (e) {
        logger.error(`OpenAI Backup Failed: ${e.message}`);
        return { reply: "I am having trouble hearing you. Can you text later?", isScam: false };
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };