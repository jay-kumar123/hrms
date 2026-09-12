import type { Express } from "express";
import { openApiDocument } from "./openapi.js";

export function mountApiDocs(app: Express) {
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiDocument);
  });

  void (async () => {
    try {
      const swaggerUiModule = await import("swagger-ui-express");
      const swaggerUi = swaggerUiModule.default || swaggerUiModule;
      app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(openApiDocument, {
          customSiteTitle: "Hotel PMS API Docs",
          customCss: ".swagger-ui .topbar { display: none }",
          swaggerOptions: {
            docExpansion: "none",
            filter: true,
            tagsSorter: "alpha",
            operationsSorter: "alpha",
            tryItOutEnabled: true,
            persistAuthorization: true,
          },
        }),
      );
    } catch {
      // CDN Swagger UI fallback when swagger-ui-express is not installed
      app.get("/api-docs", (_req, res) => {
        res.type("html").send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <title>Hotel PMS API Docs</title>
              <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
            </head>
            <body>
              <div id="swagger-ui"></div>
              <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
              <script>
                window.onload = () => {
                  window.ui = SwaggerUIBundle({
                    url: '/api-docs.json',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    docExpansion: 'none',
                    filter: true,
                  });
                };
              </script>
            </body>
          </html>
        `);
      });
    }
  })();
}
