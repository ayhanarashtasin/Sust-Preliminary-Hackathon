/**
 * QueueStorm Investigator — Minimal Frontend JS
 *
 * Handles: sample case loading, API submission, result display, health check.
 */

// ─── Sample Cases ─────────────────────────────────────────────────────────────
const SAMPLE_CASES = [
  {
    label: "SAMPLE-01: Wrong transfer with matching evidence",
    input: {"ticket_id":"TKT-001","complaint":"I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong. The person isn't responding to my call. Please help me get my money back.","language":"en","channel":"in_app_chat","user_type":"customer","campaign_context":"boishakh_bonanza_day_1","transaction_history":[{"transaction_id":"TXN-9101","timestamp":"2026-04-14T14:08:22Z","type":"transfer","amount":5000,"counterparty":"+8801719876543","status":"completed"},{"transaction_id":"TXN-9087","timestamp":"2026-04-13T18:12:00Z","type":"cash_in","amount":10000,"counterparty":"AGENT-512","status":"completed"}]}
  },
  {
    label: "SAMPLE-02: Wrong transfer claim with inconsistent evidence",
    input: {"ticket_id":"TKT-002","complaint":"I sent 2000 to the wrong person by mistake. Please reverse it.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9202","timestamp":"2026-04-14T11:30:00Z","type":"transfer","amount":2000,"counterparty":"+8801812345678","status":"completed"},{"transaction_id":"TXN-9180","timestamp":"2026-04-10T09:15:00Z","type":"transfer","amount":2500,"counterparty":"+8801812345678","status":"completed"},{"transaction_id":"TXN-9145","timestamp":"2026-04-05T17:45:00Z","type":"transfer","amount":1500,"counterparty":"+8801812345678","status":"completed"}]}
  },
  {
    label: "SAMPLE-03: Failed payment with balance deducted",
    input: {"ticket_id":"TKT-003","complaint":"I tried to pay 1200 taka for my mobile recharge but the app showed failed. But my balance was deducted! Please refund my money.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9301","timestamp":"2026-04-14T16:00:00Z","type":"payment","amount":1200,"counterparty":"MERCHANT-MOBILE-OP","status":"failed"}]}
  },
  {
    label: "SAMPLE-04: Refund request requiring safe handling",
    input: {"ticket_id":"TKT-004","complaint":"I paid 500 to a merchant for a product but I changed my mind and don't want it anymore. Please refund my 500 taka.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9401","timestamp":"2026-04-14T13:00:00Z","type":"payment","amount":500,"counterparty":"MERCHANT-7821","status":"completed"}]}
  },
  {
    label: "SAMPLE-05: Phishing or social engineering report",
    input: {"ticket_id":"TKT-005","complaint":"Someone called me saying they are from bKash and asked for my OTP. They said my account will be blocked if I don't share it. Is this real? I haven't shared anything yet.","language":"en","channel":"call_center","user_type":"customer","transaction_history":[]}
  },
  {
    label: "SAMPLE-06: Vague complaint, insufficient evidence",
    input: {"ticket_id":"TKT-006","complaint":"Something is wrong with my money. Please check.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9601","timestamp":"2026-04-13T10:00:00Z","type":"cash_in","amount":3000,"counterparty":"AGENT-220","status":"completed"},{"transaction_id":"TXN-9602","timestamp":"2026-04-12T15:30:00Z","type":"transfer","amount":800,"counterparty":"+8801911223344","status":"completed"}]}
  },
  {
    label: "SAMPLE-07: Agent cash-in issue (Bangla)",
    input: {"ticket_id":"TKT-007","complaint":"আমি আজ সকালে এজেন্টের কাছে ২০০০ টাকা ক্যাশ ইন করেছি কিন্তু আমার ব্যালেন্সে টাকা আসেনি। এজেন্ট বলছে টাকা পাঠিয়েছে কিন্তু আমি দেখছি না।","language":"bn","channel":"call_center","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9701","timestamp":"2026-04-14T09:30:00Z","type":"cash_in","amount":2000,"counterparty":"AGENT-318","status":"pending"}]}
  },
  {
    label: "SAMPLE-08: Multiple plausible transactions, ambiguous",
    input: {"ticket_id":"TKT-008","complaint":"I sent 1000 to my brother yesterday but he says he didn't get it. Please check.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-9801","timestamp":"2026-04-13T11:20:00Z","type":"transfer","amount":1000,"counterparty":"+8801712001122","status":"completed"},{"transaction_id":"TXN-9802","timestamp":"2026-04-13T19:45:00Z","type":"transfer","amount":1000,"counterparty":"+8801812334455","status":"completed"},{"transaction_id":"TXN-9803","timestamp":"2026-04-13T20:10:00Z","type":"transfer","amount":1000,"counterparty":"+8801712001122","status":"failed"}]}
  },
  {
    label: "SAMPLE-09: Merchant settlement delay",
    input: {"ticket_id":"TKT-009","complaint":"I am a merchant. My yesterday's sales of 15000 taka have not been settled to my account. Settlement usually happens by 11am next day. Please check.","language":"en","channel":"merchant_portal","user_type":"merchant","transaction_history":[{"transaction_id":"TXN-9901","timestamp":"2026-04-13T18:00:00Z","type":"settlement","amount":15000,"counterparty":"MERCHANT-SELF","status":"pending"}]}
  },
  {
    label: "SAMPLE-10: Duplicate payment claim",
    input: {"ticket_id":"TKT-010","complaint":"I paid my electricity bill 850 taka but it deducted twice from my account. Please check, I only paid once.","language":"en","channel":"in_app_chat","user_type":"customer","transaction_history":[{"transaction_id":"TXN-10001","timestamp":"2026-04-14T08:15:30Z","type":"payment","amount":850,"counterparty":"BILLER-DESCO","status":"completed"},{"transaction_id":"TXN-10002","timestamp":"2026-04-14T08:15:42Z","type":"payment","amount":850,"counterparty":"BILLER-DESCO","status":"completed"}]}
  },
];

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const requestInput = document.getElementById("request-input");
const charCount = document.getElementById("char-count");
const btnSubmit = document.getElementById("btn-submit");
const btnClear = document.getElementById("btn-clear");
const btnCopy = document.getElementById("btn-copy");
const sampleSelect = document.getElementById("sample-select");
const healthBadge = document.getElementById("health-badge");
const statusCards = document.getElementById("status-cards");
const responseOutput = document.getElementById("response-output");
const placeholderMsg = document.getElementById("placeholder-msg");
const errorBanner = document.getElementById("error-banner");
const errorMessage = document.getElementById("error-message");

// Status card values
const valVerdict = document.getElementById("val-verdict");
const valCase = document.getElementById("val-case");
const valSeverity = document.getElementById("val-severity");
const valDepartment = document.getElementById("val-department");

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Populate sample dropdown
  SAMPLE_CASES.forEach((sc, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = sc.label;
    sampleSelect.appendChild(opt);
  });

  // Event listeners
  requestInput.addEventListener("input", updateCharCount);
  sampleSelect.addEventListener("change", loadSample);
  btnSubmit.addEventListener("click", submitTicket);
  btnClear.addEventListener("click", clearAll);
  btnCopy.addEventListener("click", copyResponse);

  // Health check
  checkHealth();

  updateCharCount();
}

// ─── Health Check ─────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    if (data.status === "ok") {
      healthBadge.className = "health-badge online";
      healthBadge.innerHTML = '<span class="health-dot"></span>API Online';
    } else {
      throw new Error("Unhealthy");
    }
  } catch {
    healthBadge.className = "health-badge offline";
    healthBadge.innerHTML = '<span class="health-dot"></span>API Offline';
  }
}

// ─── Load Sample ──────────────────────────────────────────────────────────────
function loadSample() {
  const idx = sampleSelect.value;
  if (idx === "") return;
  requestInput.value = JSON.stringify(SAMPLE_CASES[idx].input, null, 2);
  updateCharCount();
  hideError();
}

// ─── Submit Ticket ────────────────────────────────────────────────────────────
async function submitTicket() {
  hideError();
  const raw = requestInput.value.trim();

  if (!raw) {
    showError("Please paste a JSON request payload.");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    showError("Invalid JSON. Please check your input.");
    return;
  }

  // Show loading state
  setLoading(true);

  try {
    const res = await fetch("/analyze-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(`Server returned ${res.status}: ${data.error || JSON.stringify(data)}`);
      setLoading(false);
      return;
    }

    displayResult(data);
  } catch (err) {
    showError(`Network error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ─── Display Result ───────────────────────────────────────────────────────────
function displayResult(data) {
  // Show status cards
  statusCards.style.display = "grid";

  valVerdict.textContent = data.evidence_verdict || "—";
  valVerdict.className = `card-value verdict-${data.evidence_verdict}`;

  valCase.textContent = (data.case_type || "—").replace(/_/g, " ");
  valCase.className = "card-value";

  valSeverity.textContent = (data.severity || "—").toUpperCase();
  valSeverity.className = `card-value severity-${data.severity}`;

  valDepartment.textContent = (data.department || "—").replace(/_/g, " ");
  valDepartment.className = "card-value";

  // Show JSON
  placeholderMsg.style.display = "none";
  responseOutput.style.display = "block";
  responseOutput.textContent = JSON.stringify(data, null, 2);

  // Show copy button
  btnCopy.style.display = "inline-flex";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function updateCharCount() {
  charCount.textContent = `${requestInput.value.length} characters`;
}

function clearAll() {
  requestInput.value = "";
  sampleSelect.value = "";
  statusCards.style.display = "none";
  responseOutput.style.display = "none";
  placeholderMsg.style.display = "flex";
  btnCopy.style.display = "none";
  hideError();
  updateCharCount();
}

function setLoading(isLoading) {
  btnSubmit.disabled = isLoading;
  btnSubmit.querySelector(".btn-text").textContent = isLoading ? "Analyzing..." : "Analyze Ticket";
  btnSubmit.querySelector(".btn-loader").style.display = isLoading ? "inline-block" : "none";
}

function showError(msg) {
  errorBanner.style.display = "flex";
  errorMessage.textContent = msg;
}

function hideError() {
  errorBanner.style.display = "none";
}

function copyResponse() {
  const text = responseOutput.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btnCopy.textContent;
    btnCopy.textContent = "Copied!";
    setTimeout(() => { btnCopy.textContent = original; }, 1500);
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
