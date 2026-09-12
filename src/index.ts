import dotenv/config;
import cors from cors;
import express from express;
import { config } from ./config/index.js;
import { mountApiDocs } from ./docs/index.js;
import { errorHandler } from ./middleware/error-handler.js;
import { requestLogger } from ./middleware/request-logger.js;
import authRoutes from ./routes/auth.js;
import humanResourcesRoutes from ./routes/human-resources.js;

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get(/, (_req, res) => {
  res.json({
    message: HRMS API Server is running,
    version: 1.0.0,
    module: Human Resource Management System (HRMS),
    docs: /api-docs,
    openapi: /api-docs.json,
  });
});

app.get(/health, (_req, res) => {
  res.json({ status: ok, service: hrms-backend });
});

mountApiDocs(app);

app.use(/api/auth, authRoutes);
app.use(/api/human-resources, humanResourcesRoutes);

app.use(errorHandler);

app.listen(PORT, 0.0.0.0, () => {
  console.log(\n=================================================);
  console.log(  HRMS Backend Server running on http://localhost:);
  console.log(  API docs     → http://localhost:/api-docs);
  console.log(  OpenAPI JSON → http://localhost:/api-docs.json);
  console.log(=================================================);
  console.log(Active HRMS Endpoints:);
  console.log(  [HR]   /api/human-resources);
  console.log(  [AUTH] /api/auth\n);
});
