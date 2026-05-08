import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ZodError } from "zod";
import {
  googleSignInSchema,
  refreshSessionSchema,
  signOutSchema,
  type GoogleSignInInput,
  type RefreshSessionInput,
  type SignOutInput
} from "@capris/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, type AuthenticatedRequest } from "./jwt-auth.guard";
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
