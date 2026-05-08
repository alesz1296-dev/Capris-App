import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, type Permission } from "@capris/shared";
import { type AuthenticatedRequest } from "./jwt-auth.guard";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new ForbiddenException("Authenticated request context was not found.");
    }

    const missingPermission = requiredPermissions.find((permission) => !hasPermission(request.auth!.role, permission));
    if (missingPermission) {
      throw new ForbiddenException(`Missing permission: ${missingPermission}.`);
    }

    return true;
  }
}
