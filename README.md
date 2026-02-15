# 🦅 Agentic Honeypot AI (Hackathon Edition)

A high-performance, compliant Honeypot system designed to engage scammers, extract intelligence, and report findings in real-time.

## 🚀 Key Features
-   **Context-Aware AI Persona**: Acts as "Mrs. Sharma", a confused elderly victim, to extract data naturally.
-   **5-Field Intelligence Extraction**: Aggressively hunts for **Bank Accounts, UPI IDs, Phone Numbers, Emails, and Phishing Links**.
-   **Smart Throttle Reporting**: Reports to the central server only on key events (First Detection, New Intel, Turn 5, Turn 8+).
-   **Compliance-Ready**: Strictly adheres to the Hackathon Evaluation Documentation (Always HTTP 200, PDF-Compliant Payload).

---

## 🛠️ Setup & Installation

### 1. Prerequisites
-   Node.js (v18+)
-   MongoDB (Running locally or Atlas URI)

### 2. Environment Variables (.env)
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=8080

# Database
MONGO_URI=mongodb://localhost:27017/honeypot_db

# AI Prompts & Keys (Comma-separated for rotation)
OPENAI_KEYS=sk-proj-...,sk-proj-...
FAST_ROUTER_KEYS=sk-or-...,sk-or-...

# Security
API_SECRET_KEY=honeypot-secret-key-123

# Callback Configuration (Where reports are sent)
CALLBACK_URL=https://hackathon.guvi.in/api/updateHoneyPotFinalResult
```

### 3. Installation
```bash
npm install
npm start
``` 
Server will start on `http://localhost:8080`.

---

## 📡 API Documentation

### 1. Incoming Message (Scammer Input)
**Endpoint**: `POST /api/honeypot/incoming`  
**Headers**: `x-api-key: <API_SECRET_KEY>`

**Request Body**:
```json
{
  "sessionId": "unique-session-id-123",
  "message": {
    "text": "Hello, pay your electricity bill immediately.",
    "timestamp": "2024-10-25T10:00:00Z"
  },
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Who is this?" }
  ]
}
```

**Response (Always HTTP 200)**:
```json
{
  "status": "success",
  "reply": "Oh god, electricity bill? But I paid it yesterday! Is this the officer?"
}
```

### 2. Callback Report (Outgoing Intelligence)
The system automatically sends this payload to `CALLBACK_URL` when intelligence is found.

**Payload Structure**:
```json
{
  "sessionId": "unique-session-id-123",
  "status": "success",
  "scamDetected": true,
  "scamType": "bank_fraud",
  "extractedIntelligence": {
    "phoneNumbers": ["9876543210"],
    "bankAccounts": ["1234567890"],
    "upiIds": ["scammer@okaxis"],
    "phishingLinks": ["http://fake-sbi.com"],
    "emailAddresses": ["support@fake-sbi.com"]
  },
  "engagementMetrics": {
    "totalMessagesExchanged": 8,
    "engagementDurationSeconds": 75
  },
  "agentNotes": "Scammer demanded OTP. Extracted Bank Account and Phone.",
  "totalMessagesExchanged": 8,       // Root level for compatibility
  "engagementDurationSeconds": 75    // Root level for compatibility
}
```

### 3. Payload Preview (Testing Tool)
**Endpoint**: `GET /api/callback-preview/:sessionId`  
See exactly what will be sent to the server for a specific session.

---

## 🕵️ AI Strategy: "Aggressive Data Trading"
The AI uses a dynamic "Shopping List" strategy to ensure all 5 fields are extracted.

1.  **Analyze**: Checks what data is missing (e.g., Have Bank, need Email).
2.  **Excuse**: Generates a valid technical excuse (e.g., "WhatsApp crashing").
3.  **Demand**: Asks for the specific missing data to "solve" the problem.

**Example**:
> *Scammer*: "Send OTP."
> *AI*: "I am trying but the app is failing! Give me your **Bank Account Number** so I can go to the branch and deposit cash directly!"

---

## 🧪 How to Test
1.  **Start Server**: `node server.js`
2.  **Send Message**: use Postman or Curl to `POST /api/honeypot/incoming`.
3.  **Check Logs**: Terminal will show:
    -   `🧠 AI Decision`
    -   `🕵️ Intelligence Extracted`
    -   `📤 Callback Data` (in strict JSON format)
4.  **Verify Callback**: Ensure your `CALLBACK_URL` received the POST request.
