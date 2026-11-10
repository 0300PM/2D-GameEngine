import type { Plugin } from "vite";

export const DOCS_URL = "https://docs.krecik.tech/game-engine";

export const docsRedirect = (): Plugin => ({
  name: "b2d-docs-redirect",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const url = (request.url ?? "/").split("?")[0];
      if (url !== "/docs" && !url.startsWith("/docs/")) {
        next();
        return;
      }
      response.statusCode = 302;
      response.setHeader("Location", `${DOCS_URL}${url.slice(5)}`);
      response.end();
    });
  }
});
