# 🍯 Honeypot AI Server

A sophisticated, zero-latency honeypot system designed to engage scammers, waste their time, and extract actionable intelligence (Bank Accounts, UPI IDs, Phone Numbers, etc.) using AI personas.

## 🚀 Features

- **AI-Powered Personas**: Uses `Meta-Llama-3.1` (via FastRouter) with `GPT-4o-mini` fallback to simulate naive, elderly victims.
- **Zero-Latency Intelligence**: Regex-based extraction of sensitive data (UPI, Bank, Phishing Links) runs synchronously before AI processing.
- **Sticky Session Management**: Maintains conversation context and assigns consistent API keys per session using a deterministic hash.
- **Scam Detection**: Automatically classifies conversations as "Scam" or "Safe" and calculates risk scores.
- **Automated Reporting**: Triggers callbacks to external systems (Guvi) when a scam is confirmed and intelligence is gathered.
- **Resilient Architecture**: Handles timeouts (4.5s hard limit), API key exhaustion, and database connection failures.

## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v16+)
- MongoDB Instance

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=8080
MONGO_URI=mongodb://localhost:27017/honeypot
API_SECRET_KEY=your_secure_api_key
FAST_ROUTER_KEYS=key1,key2,key3
OPENAI_KEYS=sk-...,sk-...
```

### Installation
```bash
npm install
npm start
```

## 🔌 API Documentation

**Base URL**: `http://localhost:8080`

### Authentication
All endpoints (including health checks) require the following header:
- `x-api-key`: Must match `API_SECRET_KEY` defined in `.env`.

---

### 1. Health Check
**Endpoint**: `GET /health`

**Response**:
```text
OK
```

---

### 2. Process Message
**Endpoint**: `POST /api/chat` (or similar, configured in `routes/apiRoutes.js`)

**Description**: Processes an incoming message from a scammer, updates session history, extracts intelligence, and returns an AI-generated reply.

**Request Body**:
```json
{
  "sessionId": "unique_session_id_123",
  "message": {
    "text": "Hello sir, your bank account is blocked. Please verify OTP immediately."
  }
}
```

**Response**:
```json
{
  "status": "success",
  "reply": "Oh my, blocked? I am very worried. What should I do?"
}
```

**Behavior**:
- **Timeout**: The server enforces a 4.5s timeout. If the AI takes too long, it may return a fallback error or timeout response.
- **Intelligence**: The system automatically extracts patterns like `+91...`, `user@upi`, and `123456789012` from the input text.
- **Scam Detection**: If the AI detects a scam, it flags the session internally. If the session is mature (2+ turns) and intelligence is found, a report is sent to the callback URL.

## 📂 Project Structure

- **`config/`**: Database connection and Key Pool configuration (Load balancing).
- **`controllers/`**: Request handlers (`honeypotController`).
- **`models/`**: Mongoose schemas (`Session` for storing history and intel).
- **`services/`**: Core Business logic.
  - `aiService.js`: LLM integration (FastRouter/OpenAI).
  - `intelligenceService.js`: Regex extraction for Bank/UPI/Phone.
  - `sessionManager.js`: Orchestrates state, AI processing, and DB updates.
  - `guviCallback.js`: Reporting mechanism.
- **`utils/`**: Helpers (Logger).
- **`server.js`**: Application entry point and middleware setup.