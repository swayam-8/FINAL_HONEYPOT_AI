# Natural Interaction Strategy (Logical Excuses)
**Goal**: Make the AI's data requests sound like genuine human problems, not bot scripts.

## The Strategy
Instead of blindly asking "Give me your Email", the AI now provides a **Valid Technical Excuse** for needing that specific data.

-   **Extraction**: "I need your Email." -> **Excuse**: "WhatsApp is crashing, I can send the screenshot via Email."
-   **Extraction**: "I need your Phone." -> **Excuse**: "My internet is down, do you have a normal number for SMS?"
-   **Extraction**: "I need your Bank Account." -> **Excuse**: "This UPI app says 'Server Error'. I will transfer from the bank."

## Code Changes
-   `services/aiService.js`: Updated System Prompt to use "LOGICAL FAILURES" strategy.
