const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { healthCheck, analyzeTicket } = require("../controllers/ticketController");

// GET /health — Judge harness readiness check
router.get("/health", healthCheck);

// POST /analyze-ticket — Main analysis endpoint
router.post("/analyze-ticket", analyzeTicket);

// GET /sample-cases — Retrieve the list of sample cases for the frontend dropdown
router.get("/sample-cases", (req, res) => {
  try {
    const filePath = path.join(__dirname, "..", "..", "SUST_Preli_Sample_Cases.json");
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, "utf8");
      const parsedData = JSON.parse(fileData);
      return res.status(200).json(parsedData);
    }
    return res.status(404).json({ error: "Sample cases file not found." });
  } catch (err) {
    console.error("Error reading sample cases file:", err.message);
    return res.status(500).json({ error: "Failed to read sample cases." });
  }
});

module.exports = router;
