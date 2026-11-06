import type { Request, Response } from "express";
import { initializeApp, sendSanitizedError } from "./app";
import { restoreApiPath } from "./vercelRouting";

let appPromise: ReturnType<typeof initializeApp> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    req.url = restoreApiPath(req.url ?? "/api");
    appPromise ??= initializeApp();
    const app = await appPromise;
    await new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      res.once("error", reject);
      app(req, res);
    });
  } catch {
    console.error("API initialization or response failed");
    if (!res.headersSent) {
      sendSanitizedError(res, 503);
    } else {
      res.end();
    }
  }
}