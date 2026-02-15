# Phase 2.5: Intelligence Service Upgrade
**Goal**: Correct extraction logic for Hackathon Evaluation.

## Changes

### 1. Enhanced `services/intelligenceService.js`
-   **UPI/Email Separation**: Added logic to remove items detected as Emails from the UPI list (`upis.filter(u => !emails.includes(u))`). This prevents double-counting.
-   **Scam Classification (Regex Base)**: Added regex-based classification for `bank_fraud`, `upi_fraud`, and `phishing`. This acts as a robust first layer of classification alongside the AI.
-   **Compliance**: field `emailAddresses` is correctly used.

## Why?
-   The evaluation system penalizes incorrect extraction.
-   We need to ensure we don't accidentally report an email as a UPI ID.
