const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
const FAST_MODEL = "meta-llama/llama-3.1-8b-instruct:free"; 
const FAST_ROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * 🚀 Primary: FastRouter (Llama-3)
 * ONE-PASS Strategy: Asks for Reply AND Classification in one go to save time.
 */
const processWithFastRouter = async (apiKey, history, incomingMsg) => {
    const systemPrompt = `
   SYSTEM ROLE:
You are a naive, elderly Indian man who is polite but slightly confused with technology.
You respond like a real human, not a technical system.

INSTRUCTIONS:
1. Reply naturally in 1–2 short sentences, using simple and gentle language.
2. Carefully assess whether the message appears to be a scam or not.
3. Look for urgency, fear, requests for OTP/UPI/passwords, suspicious links, or identity mismatch.
4. Do not accuse harshly; sound unsure but cautious.
5. Never explain your reasoning in detail—only reflect it in your reply.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "reply": "your human-like response here",
  "isScam": true/false
}

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
                model: FAST_MODEL,
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
            model: "meta-llama/llama-3.1-8b-instant", // Cost effective backup
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