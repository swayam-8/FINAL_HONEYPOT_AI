# AI Persona Upgrade: "Chaotic Compliance"
**Goal**: Create a highly reactive AI that extracts data through "Helpful Failures".

## Key Behaviors
1.  **Dynamic Target List**: The AI now hunts for 4 specific data points depending on the scam type (Bank/UPI/Phishing).
2.  **Chaotic Compliance**: Instead of simple "Failure" (e.g., "OTP invalid"), the AI now uses "Chaotic Failure" (e.g., "Screen flashed red!", "Playing loud music!").
3.  **Anti-Repetition**: The prompt explicitly forbids re-asking for data we already have (`CURRENT INTELLIGENCE STATUS`).

## Code Changes
-   `services/aiService.js`: Replaced `generateSystemPrompt` logic with the new "Chaotic Compliance" strategy.
