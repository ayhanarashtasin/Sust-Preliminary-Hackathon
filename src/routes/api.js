const express = require("express");
const router = express.Router();
const { healthCheck, analyzeTicket } = require("../controllers/ticketController");

// GET /health — Judge harness readiness check
router.get("/health", healthCheck);

// POST /analyze-ticket — Main analysis endpoint
router.post("/analyze-ticket", analyzeTicket);

module.exports = router;
