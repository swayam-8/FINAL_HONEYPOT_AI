# Enhanced AI Prompt Strategy
**Goal**: Maximize intelligence extraction (40/40 points) within 10 turns.

Your newly implemented strategy focuses on:

### 1. "Compliance Through Incompetence"
-   The persona acts eagerly submissive ("Yes Sir") but fails technically.
-   **Why**: Scammers are patient with victims who *want* to pay but "can't". This keeps the conversation alive.

### 2. Controlled Failure Loops (The Extraction Engine)
-   **App Install** -> "Device not supported" -> **Ask for Bank Account**.
-   **UPI Scanner** -> "Screen is black" -> **Ask for Phone Number**.
-   **OTP** -> "Not arriving" -> **Ask for Support Email**.
-   **Link** -> "Unsafe warning" -> **Ask for another link**.

### 3. Agent Notes
-   **Fix**: Added `agentNotes` back to the JSON output schema.
-   **Why**: Critical for the final report payload. Without it, the report lacks context on the scam type.
