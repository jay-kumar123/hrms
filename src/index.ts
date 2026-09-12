import "dotenv/config";
import cors from "cors";
import express from "express";
import { config } from "./config/index.js";
import { mountApiDocs } from "./docs/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import authRoutes from "./routes/auth.js";
import platformRoutes from "./routes/platform.js";
import humanResourcesRoutes from "./routes/human-resources.js";

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({
    message: "HRMS API is running (Standalone)",
    version: "1.0.0",
    docs: "/api-docs",
    openapi: "/api-docs.json",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hrms-backend" });
});

mountApiDocs(app);

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/human-resources", humanResourcesRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HRMS Backend Server running on http://localhost:${PORT}`);
  console.log(`API docs     -> http://localhost:${PORT}/api-docs`);
  console.log(`OpenAPI JSON -> http://localhost:${PORT}/api-docs.json`);
  console.log("HRMS Request logging enabled:\n");
  console.log("  [HR]   /api/human-resources");
  console.log("  [AUTH] /api/auth\n");
});
