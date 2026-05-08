import { z } from "zod";
import type { User } from "./domain";

const identifierSchema = z.string().trim().min(1);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const revokeDeviceSessionSchema = z.object({
  revokedByUserId: identifierSchema,
  revokedAt: isoTimestampSchema
});

export interface DeviceSessionSummary {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  provider: string;
  deviceName?: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  active: boolean;
}

export interface RevokeDeviceSessionInput {
  revokedByUserId: string;
  revokedAt: string;
}

export interface DeviceSessionMutationResult {
  item: DeviceSessionSummary;
  message: string;
}

export interface DeviceSessionBootstrap {
  sessions: DeviceSessionSummary[];
  users: User[];
}

export type RevokeDeviceSessionSchemaInput = z.infer<typeof revokeDeviceSessionSchema>;
