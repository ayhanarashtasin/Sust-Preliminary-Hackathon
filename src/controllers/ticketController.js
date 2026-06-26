/**
 * Ticket Controller — Orchestrates the full analysis pipeline.
 *
 * Flow:
 * 1. Validate request with Zod
 * 2. Run rule-based evidence matcher
 * 3. Call Gemini for text generation
 * 4. Zod validates Gemini output
 * 5. Safety checker sanitizes output
 * 6. Return response (or deterministic fallback on failure)
 */
const { requestSchema } = require("../schemas/validation");
const { analyzeWithRules } = require("../services/ruleEngine");
const { analyzeWithGemini } = require("../services/aiService");

// ─── Deterministic fallback response ──────────────────────────────────────────
function buildFallbackResponse(ticketId, ruleResult) {
  return {
    ticket_id: ticketId,
    relevant_transaction_id: ruleResult?.matchedTransactionId || null,
    evidence_verdict: ruleResult?.evidenceVerdict || "insufficient_data",
    case_type: ruleResult?.possibleCaseType || "other",
    severity: ruleResult?.possibleSeverity || "medium",
    department: ruleResult?.possibleDepartment || "customer_support",
    agent_summary:
      "The complaint could not be fully analyzed from the available information. Manual review is required.",
    recommended_next_action:
      "Escalate to a support agent for manual review and verify the available transaction details.",
    customer_reply:
      "We have received your concern. Our support team will review the details and contact you through official channels. Please do not share your PIN, OTP, or password with anyone.",
    human_review_required: ruleResult?.humanReviewRequired !== undefined ? ruleResult.humanReviewRequired : true,
    confidence: 0.3,
    reason_codes: ruleResult?.ruleReasonCodes 
      ? [...ruleResult.ruleReasonCodes, "fallback_response"] 
      : ["fallback_response", "manual_review_required"],
  };
}

// ─── Health check handler ─────────────────────────────────────────────────────
function healthCheck(req, res) {
  return res.status(200).json({ status: "ok" });
}

// ─── Main ticket analysis handler ─────────────────────────────────────────────
async function analyzeTicket(req, res) {
  try {
    // ─── Step 1: Validate request with Zod ────────────────────────────────────
    const parseResult = requestSchema.safeParse(req.body);

    // Check for semantically invalid input (422) — complaint exists but is empty
    if (req.body && typeof req.body.complaint === "string" && req.body.complaint.trim() === "") {
      return res.status(422).json({
        error: "Semantically invalid input",
        details: [{ field: "complaint", message: "Complaint text cannot be empty." }],
      });
    }

    if (!parseResult.success) {
      const issues = parseResult.error.issues || [];
      const errors = issues.map((e) => ({
        field: (e.path || []).join("."),
        message: e.message,
      }));

      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    const ticket = parseResult.data;

    // ─── Step 2: Run rule-based evidence matcher ──────────────────────────────
    const ruleResult = analyzeWithRules(ticket);

    // ─── Step 3: Call Gemini (with fallback) ──────────────────────────────────
    let response;
    try {
      response = await analyzeWithGemini(ticket, ruleResult);
    } catch (aiError) {
      console.error("Gemini analysis failed, using fallback:", aiError.message);
      response = buildFallbackResponse(ticket.ticket_id, ruleResult);
    }

    // ─── Step 4: Return validated, safe response ──────────────────────────────
    return res.status(200).json(response);
  } catch (error) {
    console.error("Unexpected error in analyzeTicket:", error.message);

    // Never expose stack traces or internal details
    return res.status(500).json({
      error: "Internal server error. Please try again later.",
    });
  }
}

module.exports = { healthCheck, analyzeTicket };
