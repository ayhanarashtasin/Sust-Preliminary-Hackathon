/**
 * QueueStorm Investigator — Express Server
 *
 * AI-powered support ticket investigator for digital finance.
 * Exposes GET /health and POST /analyze-ticket.
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow inline scripts for the minimal frontend
  })
);
app.disable("x-powered-by");

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(limiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// Handle JSON parse errors gracefully
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  next(err);
});

// ─── Static Frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/", apiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   QueueStorm Investigator                        ║
║   Running on http://localhost:${PORT}               ║
║                                                  ║
║   GET  /health          → Readiness check        ║
║   POST /analyze-ticket  → Ticket analysis        ║
║                                                  ║
║   Frontend → http://localhost:${PORT}               ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
