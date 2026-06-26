const { z } = require("zod");

// ─── Enums (must match exactly) ───────────────────────────────────────────────
const CASE_TYPES = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other",
];

const DEPARTMENTS = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk",
];

const EVIDENCE_VERDICTS = ["consistent", "inconsistent", "insufficient_data"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const LANGUAGES = ["en", "bn", "mixed"];
const CHANNELS = [
  "in_app_chat",
  "call_center",
  "email",
  "merchant_portal",
  "field_agent",
];
const USER_TYPES = ["customer", "merchant", "agent", "unknown"];
const TRANSACTION_TYPES = [
  "transfer",
  "payment",
  "cash_in",
  "cash_out",
  "settlement",
  "refund",
];
const TRANSACTION_STATUSES = ["completed", "failed", "pending", "reversed"];

// ─── Transaction History Entry Schema ─────────────────────────────────────────
const transactionEntrySchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string(),
  type: z.enum(TRANSACTION_TYPES),
  amount: z.number(),
  counterparty: z.string(),
  status: z.enum(TRANSACTION_STATUSES),
});

// ─── Request Schema ───────────────────────────────────────────────────────────
const requestSchema = z.object({
  ticket_id: z.string().min(1, "ticket_id is required"),
  complaint: z.string().min(1, "complaint is required"),
  language: z.enum(LANGUAGES).optional(),
  channel: z.enum(CHANNELS).optional(),
  user_type: z.enum(USER_TYPES).optional(),
  campaign_context: z.string().optional(),
  transaction_history: z.array(transactionEntrySchema).optional().default([]),
  metadata: z.record(z.any()).optional(),
});

// ─── Response Schema (validates Gemini output) ────────────────────────────────
const responseSchema = z.object({
  ticket_id: z.string(),
  relevant_transaction_id: z.string().nullable(),
  evidence_verdict: z.enum(EVIDENCE_VERDICTS),
  case_type: z.enum(CASE_TYPES),
  severity: z.enum(SEVERITIES),
  department: z.enum(DEPARTMENTS),
  agent_summary: z.string().min(1),
  recommended_next_action: z.string().min(1),
  customer_reply: z.string().min(1),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason_codes: z.array(z.string()).optional(),
});

module.exports = {
  requestSchema,
  responseSchema,
  CASE_TYPES,
  DEPARTMENTS,
  EVIDENCE_VERDICTS,
  SEVERITIES,
  LANGUAGES,
  CHANNELS,
  USER_TYPES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
};
