/**
 * Rule Engine — Deterministic evidence matcher.
 *
 * Runs BEFORE Gemini to provide reliable, deterministic facts
 * about the ticket (matched transaction, likely case type, department).
 * Gemini then uses these facts to generate human-readable text.
 */

// ─── Keyword lists for pattern detection ──────────────────────────────────────

const PHISHING_KEYWORDS = [
  "otp",
  "pin",
  "password",
  "scam",
  "fraud",
  "phishing",
  "suspicious",
  "hacker",
  "hack",
  "stolen",
  "unauthorized",
  "blocked",
  "block",
  // Bangla keywords
  "ওটিপি",
  "পিন",
  "পাসওয়ার্ড",
  "প্রতারণা",
  "হ্যাক",
];

const WRONG_TRANSFER_KEYWORDS = [
  "wrong number",
  "wrong person",
  "wrong transfer",
  "wrong recipient",
  "wrong account",
  "by mistake",
  "mistakenly",
  "ভুল নম্বর",
  "ভুল ট্রান্সফার",
];

const FAILED_PAYMENT_KEYWORDS = [
  "failed",
  "not working",
  "error",
  "deducted",
  "balance deducted",
  "ব্যর্থ",
  "কাটা গেছে",
];

const REFUND_KEYWORDS = [
  "refund",
  "return my money",
  "give back",
  "changed my mind",
  "don't want",
  "রিফান্ড",
  "টাকা ফেরত",
];

const DUPLICATE_KEYWORDS = [
  "twice",
  "double",
  "duplicate",
  "two times",
  "deducted twice",
  "charged twice",
  "দুইবার",
];

const MERCHANT_SETTLEMENT_KEYWORDS = [
  "settlement",
  "not settled",
  "merchant",
  "sales",
  "সেটেলমেন্ট",
];

const AGENT_CASH_IN_KEYWORDS = [
  "cash in",
  "cash-in",
  "cashin",
  "agent",
  "deposit",
  "not reflected",
  "ক্যাশ ইন",
  "এজেন্ট",
  "ব্যালেন্সে আসেনি",
];

// ─── Helper: extract numbers from complaint text ──────────────────────────────
function extractAmounts(text) {
  // Match numbers that look like monetary amounts (e.g., 5000, 1,200, ৫০০০)
  const englishAmounts = text.match(/\b\d{1,3}(?:,?\d{3})*(?:\.\d+)?\b/g) || [];
  // Convert Bangla digits to English
  const banglaDigitMap = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
  const banglaConverted = (text.match(/[০-৯]+/g) || []).map((s) =>
    s.replace(/[০-৯]/g, (d) => banglaDigitMap[d])
  );
  // Strip thousands separators so "5,000" parses to 5000 instead of NaN.
  return [...englishAmounts, ...banglaConverted]
    .map((s) => Number(String(s).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// ─── Helper: check if text contains any keyword ───────────────────────────────
function containsAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ─── Main rule engine ─────────────────────────────────────────────────────────
function analyzeWithRules(ticket) {
  const { complaint, transaction_history = [], user_type } = ticket;
  const complaintLower = complaint.toLowerCase();
  const amounts = extractAmounts(complaint);

  let result = {
    matchedTransaction: null,
    matchedTransactionId: null,
    possibleCaseType: null,
    possibleDepartment: null,
    possibleSeverity: null,
    evidenceVerdict: null,
    humanReviewRequired: false,
    ruleReasonCodes: [],
    ambiguousMatch: false,
    // ─── Confidence flags ────────────────────────────────────────────────────
    // When a flag is true, the rule engine is asserting a DETERMINISTIC fact and
    // the AI layer must not override it. When false, the rule engine is only
    // guessing and the AI's (schema-validated) decision is preferred instead.
    matchConfident: false,        // we are sure which txn (or that it's null) the complaint refers to
    classificationConfident: false, // a keyword branch positively identified the case_type
    verdictConfident: false,      // the evidence_verdict is deterministically known
  };

  // ─── 1. Phishing detection (highest priority) ──────────────────────────────
  const isPhishing = containsAny(complaint, PHISHING_KEYWORDS) &&
    (complaintLower.includes("call") ||
      complaintLower.includes("sms") ||
      complaintLower.includes("কল") ||
      complaintLower.includes("someone") ||
      complaintLower.includes("asking") ||
      complaintLower.includes("asked") ||
      complaintLower.includes("share") ||
      complaintLower.includes("block") ||
      complaintLower.includes("blocked"));

  if (isPhishing) {
    result.possibleCaseType = "phishing_or_social_engineering";
    result.possibleDepartment = "fraud_risk";
    result.possibleSeverity = "critical";
    result.humanReviewRequired = true;
    result.evidenceVerdict = "insufficient_data";
    result.matchedTransactionId = null; // phishing is about the contact, not a txn
    result.ruleReasonCodes.push("phishing", "credential_protection", "critical_escalation");

    // Phishing is safety-critical and deterministic — lock everything.
    result.matchConfident = true;
    result.classificationConfident = true;
    result.verdictConfident = true;
    return result;
  }

  // ─── 2. Match transactions by amount ────────────────────────────────────────
  if (transaction_history.length > 0 && amounts.length > 0) {
    const matchingTxns = transaction_history.filter((txn) =>
      amounts.includes(txn.amount)
    );

    if (matchingTxns.length === 1) {
      result.matchedTransaction = matchingTxns[0];
      result.matchedTransactionId = matchingTxns[0].transaction_id;
      result.matchConfident = true; // exact, unique amount match
      result.ruleReasonCodes.push("transaction_match");
    } else if (matchingTxns.length > 1) {
      // Check for duplicate payment pattern (same amount, same counterparty, very close timestamps)
      const isDuplicate = containsAny(complaint, DUPLICATE_KEYWORDS);
      if (isDuplicate) {
        // For duplicates, the second transaction is the relevant one
        const sorted = [...matchingTxns].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        result.matchedTransaction = sorted[sorted.length - 1]; // Last one = duplicate
        result.matchedTransactionId = sorted[sorted.length - 1].transaction_id;
        result.matchConfident = true; // duplicate pattern resolved deterministically
        result.ruleReasonCodes.push("duplicate_payment", "transaction_match");
      } else {
        // Multiple equally-plausible matches → genuinely ambiguous. We are
        // CONFIDENT that the right answer is "cannot tell" → null + insufficient.
        result.ambiguousMatch = true;
        result.matchedTransactionId = null;
        result.evidenceVerdict = "insufficient_data";
        result.matchConfident = true;
        result.verdictConfident = true;
        result.ruleReasonCodes.push("ambiguous_match", "needs_clarification");
      }
    }
  }

  // If no amount match, try matching by transaction type keywords
  if (!result.matchedTransaction && !result.ambiguousMatch && transaction_history.length > 0) {
    // Try to find by type
    if (containsAny(complaint, FAILED_PAYMENT_KEYWORDS)) {
      const failedTxn = transaction_history.find((t) => t.status === "failed");
      if (failedTxn) {
        result.matchedTransaction = failedTxn;
        result.matchedTransactionId = failedTxn.transaction_id;
        result.matchConfident = true;
        result.ruleReasonCodes.push("transaction_match");
      }
    }
    if (!result.matchedTransaction && containsAny(complaint, AGENT_CASH_IN_KEYWORDS)) {
      const cashInTxn = transaction_history.find((t) => t.type === "cash_in");
      if (cashInTxn) {
        result.matchedTransaction = cashInTxn;
        result.matchedTransactionId = cashInTxn.transaction_id;
        result.matchConfident = true;
        result.ruleReasonCodes.push("transaction_match");
      }
    }
    if (!result.matchedTransaction && containsAny(complaint, MERCHANT_SETTLEMENT_KEYWORDS)) {
      const settlementTxn = transaction_history.find((t) => t.type === "settlement");
      if (settlementTxn) {
        result.matchedTransaction = settlementTxn;
        result.matchedTransactionId = settlementTxn.transaction_id;
        result.matchConfident = true;
        result.ruleReasonCodes.push("transaction_match");
      }
    }
    // Fallback: if only one transaction, it is almost certainly the referent.
    if (!result.matchedTransaction && transaction_history.length === 1) {
      result.matchedTransaction = transaction_history[0];
      result.matchedTransactionId = transaction_history[0].transaction_id;
      result.matchConfident = true;
      result.ruleReasonCodes.push("single_transaction_match");
    }
  }

  // ─── 3. Classify case type ──────────────────────────────────────────────────
  if (containsAny(complaint, DUPLICATE_KEYWORDS)) {
    result.possibleCaseType = "duplicate_payment";
    result.possibleDepartment = "payments_ops";
    result.possibleSeverity = "high";
    result.humanReviewRequired = true;
    result.classificationConfident = true;
    result.ruleReasonCodes.push("duplicate_payment");
  } else if (containsAny(complaint, WRONG_TRANSFER_KEYWORDS)) {
    result.possibleCaseType = "wrong_transfer";
    result.possibleDepartment = "dispute_resolution";
    result.possibleSeverity = "high";
    result.humanReviewRequired = true;
    result.classificationConfident = true;
    result.ruleReasonCodes.push("wrong_transfer");
  } else if (containsAny(complaint, FAILED_PAYMENT_KEYWORDS) && result.matchedTransaction?.status === "failed") {
    result.possibleCaseType = "payment_failed";
    result.possibleDepartment = "payments_ops";
    result.possibleSeverity = "high";
    result.classificationConfident = true;
    result.ruleReasonCodes.push("payment_failed");
  } else if (containsAny(complaint, AGENT_CASH_IN_KEYWORDS)) {
    result.possibleCaseType = "agent_cash_in_issue";
    result.possibleDepartment = "agent_operations";
    result.possibleSeverity = "high";
    result.humanReviewRequired = true;
    result.classificationConfident = true;
    result.ruleReasonCodes.push("agent_cash_in");
  } else if (containsAny(complaint, MERCHANT_SETTLEMENT_KEYWORDS) && user_type === "merchant") {
    result.possibleCaseType = "merchant_settlement_delay";
    result.possibleDepartment = "merchant_operations";
    result.possibleSeverity = "medium";
    result.classificationConfident = true;
    result.ruleReasonCodes.push("merchant_settlement");
  } else if (containsAny(complaint, REFUND_KEYWORDS)) {
    result.possibleCaseType = "refund_request";
    result.possibleDepartment = "customer_support";
    result.possibleSeverity = "low";
    result.classificationConfident = true;
    result.ruleReasonCodes.push("refund_request");
  }

  // ─── 4. Evidence verdict ────────────────────────────────────────────────────
  if (!result.evidenceVerdict) {
    if (!result.matchedTransaction) {
      if (transaction_history.length === 0) {
        // No history at all → genuinely impossible to verify. Deterministic.
        result.evidenceVerdict = "insufficient_data";
        result.verdictConfident = true;
      } else {
        // History exists but our rules found no match. We are NOT confident —
        // the AI may spot a semantic match (by counterparty, type, context),
        // so defer the verdict (and the relevant_transaction_id) to it.
        result.evidenceVerdict = "insufficient_data";
        result.matchedTransactionId = null;
        result.verdictConfident = false;
      }
    } else {
      // We matched a transaction. "consistent" is the baseline, but the AI may
      // detect a contradiction (e.g. reversed/failed status vs the claim), so
      // do not lock the verdict here.
      result.evidenceVerdict = "consistent";
      result.verdictConfident = false;
    }
  }

  // ─── 5. Check for inconsistency patterns (deterministic) ────────────────────
  if (
    result.possibleCaseType === "wrong_transfer" &&
    result.matchedTransaction
  ) {
    // If recipient appears multiple times, it is an established pattern: a
    // "wrong transfer" to a repeat recipient contradicts the complaint.
    const recipientCount = transaction_history.filter(
      (t) => t.counterparty === result.matchedTransaction.counterparty
    ).length;
    if (recipientCount > 1) {
      result.evidenceVerdict = "inconsistent";
      result.verdictConfident = true; // deterministic contradiction
      result.ruleReasonCodes.push("established_recipient_pattern", "evidence_inconsistent");
      result.humanReviewRequired = true;
    }
  }

  // ─── 6. Handle complaints the keyword rules could not classify ──────────────
  if (!result.possibleCaseType) {
    // Provide a safe default, but mark classification as NOT confident so the
    // AI's (enum-validated) case_type is preferred over this fallback.
    result.possibleCaseType = "other";
    result.possibleDepartment = "customer_support";
    result.possibleSeverity = "low";
    result.classificationConfident = false;
    if (!result.matchConfident) {
      // No reliable transaction either → truly insufficient.
      result.evidenceVerdict = "insufficient_data";
      result.matchedTransactionId = null;
      result.verdictConfident = true;
    }
    result.ruleReasonCodes.push("vague_complaint", "needs_clarification");
  }

  return result;
}

module.exports = { analyzeWithRules };
