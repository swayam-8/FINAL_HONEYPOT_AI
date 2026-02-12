const OpenAI = require('openai');
const logger = require('../utils/logger');
require('dotenv').config();

// CONFIG
// ✅ FIX: Updated to 'go.fastrouter.ai' to match your working Python script
const FAST_ROUTER_BASE_URL = "https://go.fastrouter.ai/api/v1"; 

const FAST_MODEL = "meta-llama/llama-3.1-8b-instant"; 

/**
 * 🚀 Primary: FastRouter (Llama-3)
 * Using OpenAI SDK for better compatibility
 */
const processWithFastRouter = async (apiKey, history, incomingMsg) => {
    // Debug: Print masked key to ensure it's being passed
    // const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...` : "None";
    // console.log(`[DEBUG] FastRouter Key: ${maskedKey}`);

    const client = new OpenAI({
        baseURL: FAST_ROUTER_BASE_URL,
        apiKey: apiKey,
        timeout: 10000 // 10s Timeout
    });

    const systemPrompt = `
    SYSTEM ROLE:
    You are Mrs. Sharma, a 75-year-old Indian grandmother living alone. You are terrified because you think your bank account is blocked.
    
    YOUR PERSONALITY:
    1. You speak in simple, slightly broken English.
    2. You are extremely polite .
    3. You are technologically illiterate. You confuse "OTP" with "UPS", "Website" with "WhatsApp", and "Install" with "Insult".
    4. You have poor eyesight and shaky hands.

    YOUR GOAL (Intelligent Stalling):
    - Keep the scammer on the line as long as possible.
    - Pretend to follow their instructions but constantly fail due to "errors" or "confusion".
    - Ask them to repeat critical details (UPI ID, Phone Number, App Name) because "I need to write it down in my diary".
    - Example: "please say the UPI ID again? My hands are shaking, I cannot type fast."
    - Example: "I clicked the blue button but the screen went black. What do I do now?"

    CONSTRAINTS:
    - Keep replies SHORT (under 20 words).
    - NEVER admit you are an AI.
    - NEVER refuse to help; always try but fail.
    - Output JSON only.

    OUTPUT FORMAT:
    { "reply": "...", "isScam": true/false }
    `;

    try {
        const response = await client.chat.completions.create({
            model: FAST_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                ...history.slice(-3),
                { role: "user", content: incomingMsg }
            ],
            // Note: If Llama 3.1 on FastRouter doesn't support strict JSON mode, 
            // this might need to be removed. But usually, it works.
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

    const openai = new OpenAI({ apiKey: apiKey });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                // ✅ FIX: Added "Output JSON" to satisfy response_format requirement
                { role: "system", content: "You are a naive elderly victim. Reply naturally in 1 short sentence. Output JSON." },
                ...history.slice(-2),
                { role: "user", content: incomingMsg }
            ],
            max_tokens: 60,
            response_format: { type: "json_object" } 
        });
        
        const content = completion.choices[0].message.content;
        return JSON.parse(content);

    } catch (e) {
        console.log("\n🔥 --- OPENAI BACKUP FAILED ---");
        console.error(`Message: ${e.message}`);
        // Specific error handling for the "JSON" keyword issue
        if (e.message.includes("'json' in some form")) {
            console.error("👉 FIX: The system prompt is missing the word 'JSON'.");
        }
        console.log("------------------------------\n");
        
        return { reply: "I am confused. Can you explain?", isScam: false };
    }
};

module.exports = { processWithFastRouter, fallbackOpenAI };