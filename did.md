# Context-Aware AI Strategy
**Goal**: Make the AI "Self-Aware" of what intelligence it has already extracted.

## Features
1.  **Dynamic System Prompt**: The prompt is generated *on the fly* for each turn.
2.  **Missing Intel prioritization**:
    -   If `!hasBank` -> "Ask for Bank Account"
    -   If `hasBank && !hasUPI` -> "Claim scanner broken, ask for UPI"
    -   If `hasAll` -> "Waste time/Stall"
3.  **Anti-Detection**: Specific instructions on how to handle "Wrong OTP" accusations (e.g., "I read the time instead of code").
4.  **Hinglish Tone**: Enforced "Arey beta", "Sir ji" for local context.

## Code Changes
-   `services/aiService.js`: Implemented `generateSystemPrompt(currentIntel)`.
-   `services/sessionManager.js`: Updated to pass `session.intelligence` to the AI service.
