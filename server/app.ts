import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { log } from "./log";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export interface InitializeAppOptions {
  // Only the standalone server supplies frontend middleware. Keeping its
  // imports outside this module prevents build tools entering the API bundle.
  setupFrontend?: (server: Server, app: Express) => void | Promise<void>;
}

export const app: Express = express();
export const httpServer: Server = createServer(app);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Keep request logging useful for operations without retaining response
// payloads. API responses can contain user and financial information.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });

  next();
});

function statusFromError(error: unknown): number {
  if (!error || typeof error !== "object") return 500;

  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}

function publicMessageForStatus(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "Invalid request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not found";
    case 409:
      return "Conflict";
    case 429:
      return "Too many requests";
    case 500:
      return "Internal server error";
    default:
      return status >= 500 ? "Service unavailable" : "Request failed";
  }
}

export function sendSanitizedError(res: Response, status = 500): void {
  const safeStatus =
    Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  res.status(safeStatus).json({ message: publicMessageForStatus(safeStatus) });
}

function installErrorHandler(): void {
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const status = statusFromError(error);

    // Keep diagnostics in server logs, but never echo exception details (which
    // can contain PII, provider responses, SQL, or credentials) to clients.
    console.error("Request failed", { status });

    if (res.headersSent) {
      next(error);
      return;
    }

    sendSanitizedError(res, status);
  });
}

function installApiNotFoundHandler(): void {
  // This middleware runs before either Vite or the production static fallback,
  // so an unknown API path can never receive index.html.
  app.use("/api", (_req, res) => {
    sendSanitizedError(res, 404);
  });
}

let initialization: Promise<Express> | undefined;

/**
 * Register the application exactly once and resolve only after every startup
 * step needed by the request handlers has completed.
 */
export function initializeApp(options: InitializeAppOptions = {}): Promise<Express> {
  if (initialization) return initialization;

  initialization = (async () => {
    // Keep the database-backed route module out of module evaluation until the
    // request handler can catch startup failures (for example when a Vercel
    // project has not been given DATABASE_URL yet).
    const { registerRoutes } = await import("./routes");
    await registerRoutes(httpServer, app);
    installApiNotFoundHandler();

    await options.setupFrontend?.(httpServer, app);

    installErrorHandler();
    return app;
  })();

  return initialization;
}
