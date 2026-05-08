import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ZodError } from "zod";
import {
  googleSignInSchema,
  hasPermission,
  refreshSessionSchema,
  revokeDeviceSessionSchema,
  signOutSchema,
  type RevokeDeviceSessionInput,
  type GoogleSignInInput,
  type RefreshSessionInput,
  type SignOutInput
} from "@capris/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, type AuthenticatedRequest } from "./jwt-auth.guard";
import { RequirePermissions } from "./require-permission.decorator";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post("google")
  @Public()
  async signInWithGoogle(@Body() input: GoogleSignInInput) {
    const response = await this.service.signInWithGoogle(parseAuthInput(googleSignInSchema, input));
    return {
      ...response,
      ...this.service.getAccessProfile(response.user.role)
    };
  }

  @Post("refresh")
  @Public()
  async refresh(@Body() input: RefreshSessionInput) {
    const response = await this.service.refreshSession(parseAuthInput(refreshSessionSchema, input));
    return {
      ...response,
      ...this.service.getAccessProfile(response.user.role)
    };
  }

  @Post("sign-out")
  @Public()
  signOut(@Body() input: SignOutInput) {
    return this.service.signOut(parseAuthInput(signOutSchema, input));
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    if (!request.auth) {
      throw new BadRequestException("Authenticated request context was not found.");
    }

    return this.service.getProfile(request.auth.sub, request.auth.sessionId);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @RequirePermissions("device_sessions.revoke")
  getDeviceSessions(@Req() request: AuthenticatedRequest) {
    assertRequestPermission(request, "device_sessions.revoke");
    return this.service.getDeviceSessions();
  }

  @Patch("sessions/:id/revoke")
  @UseGuards(JwtAuthGuard)
  @RequirePermissions("device_sessions.revoke")
  revokeDeviceSession(
    @Param("id") id: string,
    @Body() input: RevokeDeviceSessionInput,
    @Req() request: AuthenticatedRequest
  ) {
    assertRequestPermission(request, "device_sessions.revoke");

    if (request.auth?.sub !== input.revokedByUserId) {
      throw new UnauthorizedException("Revoking user must match the authenticated user.");
    }

    return this.service.revokeDeviceSession(id, parseAuthInput(revokeDeviceSessionSchema, input));
  }
}

function parseAuthInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }

    throw error;
  }
}

function assertRequestPermission(
  request: AuthenticatedRequest,
  permission: "device_sessions.revoke"
) {
  if (!request.auth) {
    throw new BadRequestException("Authenticated request context was not found.");
  }

  if (!hasPermission(request.auth.role, permission)) {
    throw new UnauthorizedException("You do not have permission to perform this action.");
  }
}
