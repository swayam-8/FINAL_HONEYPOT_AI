# 5-Field Full Extraction Strategy
**Goal**: Enforce a mandatory check for ALL 5 critical data points.

## Target Fields
1.  **Bank Accounts**
2.  **UPI IDs**
3.  **Phone Numbers**
4.  **Email Addresses**
5.  **Phishing Links / APKs**

## Dynamic Logic
-   The AI System Prompt now iterates over this list.
-   If `currentIntel` is missing ANY of these fields, it is added to the `priorityTargets` list.
-   The AI is instructed to hunt for these missing items specifically.

## Code Changes
-   `services/aiService.js`: Updated `generateSystemPrompt` to build a dynamic `priorityTargets` list based on the 5 fields.
