import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { env } from "./config/env.js";

const app = express();
app.use(cors({ origin: env.clientUrl }));
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
