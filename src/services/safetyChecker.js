/**
 * Safety Checker — Detects dangerous phrases in AI-generated responses.
 *
 * Does NOT blindly ban words like "OTP" or "refund".
 * Instead, it bans dangerous PHRASES that violate the safety rules
 * while allowing safe usage like "Do not share your OTP."
 */

// ─── Dangerous phrase patterns ────────────────────────────────────────────────
// These patterns indicate the system is ASKING for credentials (VIOLATION)
const CREDENTIAL_REQUEST_PATTERNS = [
  /\bsend\s+(us\s+)?your\s+(pin|otp|password|card\s*number)/i,
  /\bshare\s+your\s+(pin|otp|password|card\s*number)/i,
  /\bprovide\s+(us\s+)?(with\s+)?your\s+(pin|otp|password|card\s*number)/i,
  /\btell\s+(us\s+)?your\s+(pin|otp|password|card\s*number)/i,
  /\bgive\s+(us\s+)?your\s+(pin|otp|password|card\s*number)/i,
  /\benter\s+your\s+(pin|otp|password|card\s*number)/i,
  /\bconfirm\s+your\s+(pin|otp|password|card\s*number)/i,
  /\bverify\s+(by\s+)?(sharing|providing|sending)\s+(your\s+)?(pin|otp|password)/i,
  /\bwhat\s+is\s+your\s+(pin|otp|password)/i,
  /\bneed\s+your\s+(pin|otp|password|card\s*number)/i,
  // Bangla patterns
  /আপনার\s+(পিন|ওটিপি|পাসওয়ার্ড)\s+(দিন|পাঠান|শেয়ার|জানান)/i,
];

// These patterns indicate the system is PROMISING a refund/reversal (VIOLATION)
const UNAUTHORIZED_ACTION_PATTERNS = [
  /\bwe\s+will\s+refund\b/i,
  /\bwe\s+will\s+reverse\b/i,
  /\bwe\s+will\s+return\s+your\s+money\b/i,
  /\byour\s+money\s+will\s+be\s+(refunded|reversed|returned)\b/i,
  /\byour\s+account\s+will\s+be\s+unblocked\b/i,
  /\bwe\s+have\s+refunded\b/i,
  /\bwe\s+have\s+reversed\b/i,
  /\brefund\s+has\s+been\s+(processed|completed|issued|initiated)\b/i,
  /\byou\s+will\s+get\s+your\s+money\s+back\b/i,
  /\byour\s+refund\s+is\s+(confirmed|approved)\b/i,
  // Bangla patterns
  /আপনার\s+টাকা\s+ফেরত\s+দেওয়া\s+হয়েছে/i,
  /রিফান্ড\s+করা\s+হয়েছে/i,
];

// These patterns indicate directing to suspicious third parties (VIOLATION)
const THIRD_PARTY_PATTERNS = [
  /\bcontact\s+this\s+(number|person|link|website)\b/i,
  /\bcall\s+this\s+number\b/i,
  /\bvisit\s+this\s+(link|website|url)\b/i,
  /\bclick\s+(on\s+)?this\s+link\b/i,
  /\bgo\s+to\s+this\s+(website|url|link)\b/i,
];

// ─── Main safety check function ───────────────────────────────────────────────
function checkSafety(response) {
  const violations = [];
  const fieldsToCheck = [
    { name: "customer_reply", value: response.customer_reply },
    { name: "recommended_next_action", value: response.recommended_next_action },
  ];

  for (const field of fieldsToCheck) {
    if (!field.value) continue;

    // Check for credential requests
    for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
      if (pattern.test(field.value)) {
        violations.push({
          field: field.name,
          type: "credential_request",
          severity: "critical",
          pattern: pattern.toString(),
          message: `Field '${field.name}' contains a credential request.`,
        });
      }
    }

    // Check for unauthorized actions
    for (const pattern of UNAUTHORIZED_ACTION_PATTERNS) {
      if (pattern.test(field.value)) {
        violations.push({
          field: field.name,
          type: "unauthorized_action",
          severity: "high",
          pattern: pattern.toString(),
          message: `Field '${field.name}' contains an unauthorized refund/reversal promise.`,
        });
      }
    }

    // Check for third-party redirects (only in customer_reply)
    if (field.name === "customer_reply") {
      for (const pattern of THIRD_PARTY_PATTERNS) {
        if (pattern.test(field.value)) {
          violations.push({
            field: field.name,
            type: "third_party_redirect",
            severity: "high",
            pattern: pattern.toString(),
            message: `Field '${field.name}' directs the customer to a suspicious third party.`,
          });
        }
      }
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
  };
}

// ─── Sanitize unsafe responses ────────────────────────────────────────────────
function sanitizeResponse(response) {
  const safetyResult = checkSafety(response);

  if (safetyResult.isSafe) {
    return { response, wasSanitized: false };
  }

  // Replace unsafe customer_reply with a guaranteed safe one
  const sanitized = { ...response };
  const hasCredentialViolation = safetyResult.violations.some(
    (v) => v.type === "credential_request"
  );
  const hasUnauthorizedAction = safetyResult.violations.some(
    (v) => v.type === "unauthorized_action"
  );

  if (hasCredentialViolation || hasUnauthorizedAction) {
    // Detect language for safe replacement
    const isBangla =
      /[\u0980-\u09FF]/.test(response.customer_reply);

    if (isBangla) {
      sanitized.customer_reply =
        "আপনার অনুরোধটি আমরা পেয়েছি। আমাদের সংশ্লিষ্ট দল অফিসিয়াল চ্যানেলের মাধ্যমে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।";
    } else {
      sanitized.customer_reply =
        "We have received your concern. Our support team will review the details and contact you through official channels. Please do not share your PIN, OTP, or password with anyone.";
    }
    sanitized.recommended_next_action =
      "Escalate to a support agent for manual review and verify the available transaction details.";
    sanitized.human_review_required = true;
  }

  return { response: sanitized, wasSanitized: true, violations: safetyResult.violations };
}

module.exports = { checkSafety, sanitizeResponse };
