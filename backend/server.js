import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes, { seedDefaultUsers } from "./routes/auth.js";
import patientRoutes from "./routes/patients.js";
import opdRoutes from "./routes/opd.js";
import recordRoutes from "./routes/records.js";
import documentRoutes from "./routes/documents.js";
import aiRoutes from "./routes/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during local development
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

import { connectDatabase, getActiveDbEngine } from "./services/db.js";

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    name: "HealthConnect Healthcare Record & OPD Platform API",
    version: "2.0.0",
    status: "healthy",
    database: getActiveDbEngine(),
    timestamp: new Date().toISOString(),
  });
});

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/opd", opdRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/ai", aiRoutes);

// BACKWARD COMPATIBILITY
app.use("/api/appointments", opdRoutes);

// GLOBAL 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("Unhandled API Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5050;
  connectDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 HealthConnect Server running on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error("Fatal startup error:", err);
  });
} else {
  connectDatabase().catch((err) => console.error("Vercel DB connection error:", err));
}