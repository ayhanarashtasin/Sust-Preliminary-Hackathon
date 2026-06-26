/**
 * QueueStorm Investigator — Minimal Frontend JS
 *
 * Handles: sample case loading, API submission, result display, health check.
 */

// ─── Sample Cases ─────────────────────────────────────────────────────────────
let SAMPLE_CASES = [];

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

// ─── Fetch and Load Sample Cases ──────────────────────────────────────────────
async function loadSampleCases() {
  try {
    const res = await fetch("/sample-cases");
    if (!res.ok) {
      throw new Error(`Failed to load: ${res.status}`);
    }
    const data = await res.json();
    if (data && Array.isArray(data.cases)) {
      SAMPLE_CASES = data.cases.map(c => ({
        label: `${c.id}: ${c.label}`,
        input: c.input
      }));

      // Populate sample dropdown
      sampleSelect.innerHTML = '<option value="">Load a sample case...</option>';
      SAMPLE_CASES.forEach((sc, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = sc.label;
        sampleSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error loading sample cases:", err.message);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Load sample cases dynamically
  await loadSampleCases();

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
