import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@capris/shared";

export const REQUIRED_PERMISSIONS_KEY = "capris:requiredPermissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
