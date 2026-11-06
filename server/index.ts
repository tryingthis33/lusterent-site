import { httpServer, initializeApp } from "./app";
import { log } from "./log";

const port = parseInt(process.env.PORT || "5000", 10);

initializeApp({
  setupFrontend: async (server, app) => {
    if (process.env.NODE_ENV === "production") {
      const { serveStatic } = await import("./static");
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(server, app);
    }
  },
})
  .then(() => {
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: process.platform === "linux",
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  })
  .catch((error) => {
    console.error("Application initialization failed", error);
    process.exitCode = 1;
  });
