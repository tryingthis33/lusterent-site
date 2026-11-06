import type { Request } from "express";
import { db } from "../db";
import { creditAuditLog } from "@shared/schema";

type ActorType = "user" | "admin" | "system";

interface AuditInput {
  actorId?: string | null;
  actorType?: ActorType;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

// Append-only audit logger. Never throws into the request path — auditing must
// not break the operation it records.
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.insert(creditAuditLog).values({
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? "system",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

export function actorFromReq(req: Request): { actorId: string | null; ipAddress: string | null } {
  const sub = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub ?? null;
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  return { actorId: sub, ipAddress: ip };
}
