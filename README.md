# QueueStorm Investigator

> AI-powered support ticket investigator for digital finance — SUST CSE Carnival 2026 Hackathon

## Overview

QueueStorm Investigator is an internal copilot API for support agents at a digital finance platform. It receives one customer complaint at a time along with the customer's recent transaction history, investigates the evidence, classifies the issue, routes it to the appropriate department, and drafts a safe reply — all within 30 seconds.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Validation | Zod (v4) — strict request & response schema enforcement |
| AI/LLM | Google Gemini via `@google/genai` SDK |
| Security | Helmet, express-rate-limit, CORS |
| Frontend | Static HTML/CSS/JS (minimal, for testing only) |

## Architecture

The service uses a **hybrid rule-based + AI approach**:

```
Request → Zod Validation → Rule Engine → Gemini AI → Zod Output Validation → Safety Checker → Response
                                 ↓                         ↓
                          (deterministic              (if Gemini fails,
                           evidence matching)          use fallback response)
```

1. **Zod Validation**: Strictly validates incoming JSON against the defined schema. Returns 400 for malformed input, 422 for empty complaints.
2. **Rule Engine** (`ruleEngine.js`): Deterministic evidence matcher that runs *before* the AI. Matches transactions by amount/type/status, detects phishing keywords, identifies ambiguous matches, and checks for inconsistency patterns (e.g., repeated transfers to an "unknown" recipient).
3. **Gemini AI** (`aiService.js`): Uses the rule engine's findings as context to generate high-quality `agent_summary`, `recommended_next_action`, and `customer_reply`. Uses structured JSON output mode.
4. **Safety Checker** (`safetyChecker.js`): Checks for dangerous *phrases* (not just words) to prevent credential requests, unauthorized refund promises, and third-party redirects.
5. **Fallback Response**: If Gemini fails or times out, the API returns a deterministic safe response using the rule engine's classifications. The API never crashes.

## MODELS Section

| Model | Where it runs | Why it was chosen |
|---|---|---|
| `gemini-2.0-flash` (primary) | Google Cloud (via API) | Fast, cost-effective, supports structured JSON output. Ideal for classification and text generation within the 30-second timeout. |
| `gemini-2.0-flash-lite` (fallback) | Google Cloud (via API) | Cheaper alternative if primary model is rate-limited. |
| `gemini-1.5-flash` (fallback) | Google Cloud (via API) | Stable fallback if newer models are unavailable. |

**Cost Reasoning**: The free tier of Gemini API is sufficient for evaluation purposes. The service uses minimal tokens per request (~500 input, ~300 output) and includes retry/fallback logic to handle rate limits gracefully.

## Safety Logic

The service implements strict safety guardrails:

1. **Never asks for credentials**: The `customer_reply` never requests PIN, OTP, password, or card numbers — checked via phrase-level regex, not word-level blocking.
2. **Never promises unauthorized actions**: Uses safe language like "any eligible amount will be returned through official channels" instead of "we will refund you".
3. **Never redirects to third parties**: Only directs customers to official support channels.
4. **Prompt injection resistant**: The system prompt instructs the model to treat complaint text as data only. The rule engine provides deterministic classifications that override AI hallucinations.

## Setup Instructions

### Prerequisites
- Node.js 18+
- A Google Gemini API key

### Installation

```bash
git clone <repository-url>
cd Sust-hackathon-Preli
npm install
```

### Configuration

Create a `.env` file (see `.env.example`):

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status":"ok"}` |
| POST | `/analyze-ticket` | Analyzes a support ticket |

### Testing

Visit `http://localhost:3000` in your browser for the minimal testing frontend. You can load any of the 10 sample cases from the dropdown and submit them.

## Assumptions and Known Limitations

1. **Gemini API dependency**: If the API key is rate-limited or unavailable, the service gracefully falls back to deterministic responses using the rule engine. All classification fields remain correct.
2. **Language support**: The service handles English, Bangla, and Banglish complaints. The AI model replies in the same language as the complaint.
3. **Transaction matching**: The rule engine matches by amount, type, and status. In ambiguous cases (multiple matching transactions), it returns `insufficient_data` and asks for clarification rather than guessing.
4. **No real financial operations**: This is a copilot only. It never executes refunds, reversals, or account changes.
