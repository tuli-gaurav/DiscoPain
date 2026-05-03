import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { env } from "./config/env.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

/** Allow typical local dev URLs so switching localhost ↔ 127.0.0.1 does not blank the UI */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allow = new Set([
        env.clientUrl,
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ]);
      if (allow.has(origin)) return callback(null, true);
      if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    }
  })
);
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", at: new Date().toISOString() }));
app.use("/api", routes);
app.use((err, _req, res, _next) => {
  // Ensure async route failures return JSON instead of hanging requests.
  console.error("API error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error"
  });
});

export default app;
