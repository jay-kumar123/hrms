import "dotenv/config";
import cors from "cors";
import express from "express";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import authRoutes from "./routes/auth.js";
import humanResourcesRoutes from "./routes/human-resources.js";

const app = express();
const PORT = config.port || 5002;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({
    message: "HRMS Backend API is running",
    version: "1.0.0",
    modules: ["/api/auth", "/api/human-resources"],
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hrms-backend", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/human-resources", humanResourcesRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[HRMS Backend] Server running on http://localhost:${PORT}`);
  console.log(`[HRMS Backend] Health check: http://localhost:${PORT}/health`);
  console.log(`[HRMS Backend] HR API endpoints mounted at /api/human-resources\n`);
});
