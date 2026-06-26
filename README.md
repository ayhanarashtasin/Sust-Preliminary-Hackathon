# QueueStorm Investigator

> AI-powered support ticket investigator for digital finance — SUST CSE Carnival 2026 Hackathon

## Overview

QueueStorm Investigator is an internal copilot API for support agents at a digital finance platform. It receives one customer complaint at a time along with the customer's recent transaction history, investigates the evidence, classifies the issue, routes it to the appropriate department, and drafts a safe reply — all within 30 seconds.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Validation | Zod (v4) — strict request & response schema enforcement |
| AI/LLM | Groq Cloud via `groq-sdk` (Llama 3.3 70B) |
| Security | Helmet, express-rate-limit, CORS |
| Frontend | Static HTML/CSS/JS (minimal, for testing only) |

## Architecture

The service uses a **hybrid rule-based + AI approach** with confidence-gated merging:

```
Request → Zod Validation → Rule Engine → LLM (Groq) → Confidence Merge → Zod Output Validation → Safety Checker → Response
                                ↓                              ↓
                         (deterministic                 (rules win where
                          evidence matching,             confident; LLM wins
                          confidence flags)               on the long tail)
```

### Pipeline Stages

1. **Zod Validation**: Strictly validates incoming JSON against the defined schema. Returns 400 for malformed input, 422 for empty complaints.
2. **Rule Engine** (`ruleEngine.js`): Deterministic evidence matcher that runs *before* the AI. Matches transactions by amount/type/status, detects phishing keywords, identifies ambiguous matches, and checks for inconsistency patterns (e.g., repeated transfers to an "unknown" recipient). Each decision is tagged with a **confidence flag** (`matchConfident`, `classificationConfident`, `verdictConfident`).
3. **LLM Analysis** (`aiService.js`): The LLM (Llama 3.3 70B on Groq) receives the complaint, transaction history, and rule engine hints. It produces a full structured JSON response including its own classification, evidence verdict, and human-readable text fields.
4. **Confidence-Gated Merge**: Where the rule engine is **confident** (e.g., unique amount match, phishing detection, established-recipient inconsistency), its value is kept. Where the rule engine is **only guessing** (e.g., vague complaints with no keyword match), the LLM's schema-validated value is preferred. Department routing is always enforced deterministically from the final `case_type`.
5. **Safety Checker** (`safetyChecker.js`): Checks for dangerous *phrases* (not just words) to prevent credential requests, unauthorized refund promises, and third-party redirects. Sanitizes violations by replacing unsafe text with guaranteed-safe alternatives.
6. **Fallback Response**: If the LLM fails or times out, the API returns a deterministic safe response using the rule engine's classifications. The API never crashes.

## MODELS Section

| Model | Where it runs | Why it was chosen |
|---|---|---|
| `llama-3.3-70b-versatile` (primary) | Groq Cloud (via API) | Extremely fast inference (~200ms), strong reasoning, supports JSON mode. Best balance of quality and speed for the 30s timeout. |
| `llama-3.1-8b-instant` (fallback) | Groq Cloud (via API) | Ultra-fast fallback if the primary model is rate-limited. Smaller but still capable for structured classification tasks. |

**Why Groq?** Groq's LPU inference engine delivers sub-second response times, which is critical for staying well within the 30-second endpoint timeout. The service includes per-call timeouts (8s), an overall deadline (12s), and automatic model fallback to maximize reliability.

**Cost Reasoning**: Groq's free tier provides generous rate limits sufficient for evaluation. The service uses minimal tokens per request (~600 input, ~400 output) and includes retry/fallback logic to handle rate limits gracefully.

## Safety Logic

The service implements strict safety guardrails:

1. **Never asks for credentials**: The `customer_reply` never requests PIN, OTP, password, or card numbers — checked via phrase-level regex, not word-level blocking.
2. **Never promises unauthorized actions**: Uses safe language like "any eligible amount will be returned through official channels" instead of "we will refund you". Catches 15+ refund-promise patterns.
3. **Never redirects to third parties**: Only directs customers to official support channels. Third-party redirect violations trigger the same sanitization as credential/refund violations.
4. **Prompt injection resistant**: The rule engine provides deterministic classifications with confidence flags. Safety-critical decisions (phishing, inconsistent evidence) cannot be overridden by the LLM.

## Setup Instructions

### Prerequisites
- Node.js 18+
- A Groq API key (get one free at https://console.groq.com)

### Installation

```bash
git clone https://github.com/ayhanarashtasin/Sust-Preliminary-Hackathon.git
cd Sust-Preliminary-Hackathon
npm install
```

### Configuration

Create a `.env` file (see `.env.example`):

```
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
```

### Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### Docker

```bash
docker build -t queuestorm-investigator .
docker run -p 3000:3000 -e GROQ_API_KEY=your_key queuestorm-investigator
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status":"ok"}` |
| POST | `/analyze-ticket` | Analyzes a support ticket |

### Testing

Visit `http://localhost:3000` in your browser for the minimal testing frontend. You can load any of the 10 sample cases from the dropdown and submit them.

## Assumptions and Known Limitations

1. **Groq API dependency**: If the API key is rate-limited or unavailable, the service gracefully falls back to deterministic responses using the rule engine. All classification fields remain correct; only the AI-generated text fields use generic fallback text.
2. **Language support**: The service handles English, Bangla, and Banglish complaints. The AI model replies in the same language as the complaint.
3. **Transaction matching**: The rule engine matches by amount (including comma-separated and Bangla numerals), type, and status. In ambiguous cases (multiple matching transactions), it returns `insufficient_data` and asks for clarification rather than guessing.
4. **No real financial operations**: This is a copilot only. It never executes refunds, reversals, or account changes.
