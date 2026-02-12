
---

# 🍯 Scam Honeypot AI (Project Antigravity)

**An autonomous AI agent designed to trap scammers, waste their time, and extract critical intelligence (Bank Accounts, UPI, Phone Numbers) using a "Naive Grandmother" persona.**

---

## 🚀 Project Overview

This project is a **Honeypot API** that receives messages from scammers (via SMS/WhatsApp bridges) and responds using an AI persona named **"Mrs. Sharma"**.

### **Core Objectives:**

1. **Engage:** Keep the scammer talking as long as possible (Time Wasting).
2. **Extract:** Identify Bank Accounts, UPI IDs, Phone Numbers, and Phishing Links using regex.
3. **Report:** Send real-time intelligence to the Central Command (Guvi Hackathon Endpoint).

---

## 🧠 How It Works (The Logic Flow)

1. **Incoming Message:** The system receives a JSON payload with the scammer's message and a `sessionId`.
2. **Intelligence Scan:**
* The `intelligenceService` scans the *scammer's text* (ignoring the AI's own text) for "Hard Intel" (Bank, Phone, UPI) using optimized Regex.
* It filters out false positives (e.g., ensuring a mobile number isn't logged as a bank account).


3. **AI Processing:**
* **Persona:** Mrs. Sharma (75-year-old Indian grandmother).
* **Strategy:** "Compliance with Obstacles." She tries to help but "fails" due to bad eyesight, broken phone, or confusion.
* **Dynamic Prompting:** The AI checks conversation history. If it already has the OTP, it asks for the App Name. It never asks for the same data twice.
* **Model Routing:** Uses **FastRouter (Llama-3)** for speed, falls back to **OpenAI (GPT-4o)** if FastRouter fails.


4. **Callback Reporting (Live Updates):**
* If "Hard Intel" is found (or the chat is long enough), the system triggers a POST request to the Callback URL.
* **Update Logic:** Unlike standard honeypots, this system sends **Live Updates**. If the scammer sends a Bank Account *after* the first report, a *new* report is sent immediately.



---

## 🛠️ Tech Stack

* **Runtime:** Node.js (Express)
* **Database:** MongoDB Atlas (Mongoose) - Stores Session logs and Extracted Intel.
* **AI Layer:**
* Primary: Llama-3-8b-instant (via FastRouter)
* Backup: GPT-4o-mini (via OpenAI)


* **Documentation:** Swagger UI (`/api-docs`)
* **Hosting:** Render (API) + MongoDB Atlas (DB)

---

## 📂 Project Structure

```bash
FINAL_HONEYPOT_AI/
├── config/
│   ├── db.js             # MongoDB Connection
│   └── keyPool.js        # Manages API Key rotation & Sticky Sessions
├── controllers/
│   └── honeypotController.js # Handles the API request/response cycle
├── models/
│   └── Session.js        # Mongoose Schema (History, Intel, Turn Count)
├── routes/
│   └── apiRoutes.js      # Endpoint definitions
├── services/
│   ├── aiService.js          # AI Persona & Model Routing (Mrs. Sharma)
│   ├── guviCallback.js       # Handles POST requests to the Reporting Server
│   ├── intelligenceService.js# Regex patterns for extracting data
│   └── sessionManager.js     # CORE LOGIC: Orchestrates AI, DB, and Reporting
├── utils/
│   └── logger.js         # Standardized logging
├── server.js             # Entry point & Swagger Config
└── .env                  # Secrets (Not committed)

```

---

## ✨ Recent Changes & Fixes (Current Status)

We have optimized the system for the Hackathon environment. Here is what is new:

### **1. Intelligence Extraction**

* **Fix:** Added Negative Lookbehind Regex `(?<!\d)` to phone numbers.
* **Feature:** Now supports `+91-` (dash) and space-separated Indian numbers.
* **Fix:** Added logic to **prevent Mobile Numbers (10 digits starting 6-9) from appearing in the Bank Account list**.
* **Fix:** The scanner now ignores `assistant` (Mrs. Sharma's) messages to prevent self-hallucination (e.g., extracted "987654321" which was fake).

### **2. AI Persona (Mrs. Sharma)**

* **Smart Context:** The System Prompt now includes a **"Memory Check"**.
* *Rule:* "IF you have Bank Account, ASK for IFSC."
* *Rule:* "IF you have Phone, ASK for App Link."


* **Behavior:** She no longer gets stuck on one joke (e.g., "UPS vs OTP"). She is fluid and creates new problems (Screen blank, Battery low, Glasses lost) to force the scammer to repeat info.

### **3. Callback Logic (Critical)**

* **Live Updates Enabled:** Removed the `!reportSent` lock. The system now re-sends reports if **new** intel is found.
* **Spam Prevention:** It will *not* send a callback for just keywords (e.g., "URGENT"). It waits for **Hard Intel** (Bank/Phone/Link) OR **3+ turns** of conversation.

### **4. Server Stability**

* **Swagger:** Fixed "Failed to fetch" on Render by using relative paths (`/`).
* **Logging:** Added verbose logging. You can now see:
* `📩 Incoming Scammer Message`
* `🔍 New Bank Account Found`
* `🤖 AI Reply`
* `🚨 SCAM UPDATE (Sending Callback)`



---

## 🔌 API Endpoints

### **1. Process Message**

* **URL:** `POST /api/honeypot`
* **Headers:** `x-api-key: <YOUR_SECRET>`
* **Body:**
```json
{
  "sessionId": "unique_session_id",
  "message": { "text": "Send money to 1234567890" },
  "conversationHistory": [ ... ]
}

```



### **2. Health Check**

* **URL:** `GET /health`
* **Response:** `OK`

### **3. Documentation**

* **URL:** `GET /api-docs` (Swagger UI)

---

## ⚙️ Setup & Installation

1. **Clone the Repo**
```bash
git clone <repo_url>
cd FINAL_HONEYPOT_AI

```


2. **Install Dependencies**
```bash
npm install

```


3. **Environment Variables (`.env`)**
```env
PORT=8080
MONGO_URI=mongodb+srv://admin:PASSWORD@cluster0.mongodb.net/honeypot?retryWrites=true&w=majority
FASTROUTER_API_KEY=sk-fastrouter...
OPENAI_KEYS=sk-proj-backup...
API_SECRET_KEY=my_secure_password

```


4. **Run Server**
```bash
npm start

```



---

## 🧪 Testing Intelligence (Regex)

The system currently detects:

* **Bank Accounts:** 9-18 digits (Filters out mobile numbers).
* **UPI IDs:** `name@bank`, `number@ybl`, etc.
* **Phone Numbers:** `+91-98...`, `9198...`, `98...`.
* **Keywords:** `OTP`, `CVV`, `KYC`, `Blocked`, `Urgent`.

---

**Ready for deployment on Render! 🚀**