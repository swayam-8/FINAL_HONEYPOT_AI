# Aggressive Data Trading Strategy
**Goal**: Get maximum intelligence in minimal time.

## Key Changes
1.  **Stop Wasting Time**: The AI no longer engages in small talk or "failure loops" unless it leads directly to data.
2.  **Bundled Requests**: The AI explicitly asks for multiple fields at once:
    -   "Give me your **Account Number AND IFSC**!"
    -   "I need your **WhatsApp Number AND Email** to send the screenshot!"
3.  **High Pressure Tone**: The AI acts panicked and urgent ("Sir hurry!", "Go check!"), forcing the scammer to comply faster.

## Code Changes
-   `services/aiService.js`: Updated System Prompt Strategy section to "AGGRESSIVE DATA TRADING".
