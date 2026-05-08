import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Locale, Role } from "@capris/shared";

export interface AuthJwtPayload {
  sub: string;
  organizationId: string;
  email: string;
  role: Role;
  locale: Locale;
  name: string;
  sessionId: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

export interface IssueTokenInput {
  userId: string;
  organizationId: string;
  email: string;
  role: Role;
  locale: Locale;
  name: string;
  sessionId: string;
}

@Injectable()
export class AuthTokenService {
  private readonly accessTokenTtlSeconds = parseDurationToSeconds(process.env.JWT_ACCESS_TTL ?? "15m");
  private readonly refreshTokenTtlSeconds = parseDurationToSeconds(process.env.JWT_REFRESH_TTL ?? "7d");

  issueTokens(input: IssueTokenInput) {
    const accessToken = this.signToken(
      {
        sub: input.userId,
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        locale: input.locale,
        name: input.name,
        sessionId: input.sessionId,
        type: "access"
      },
      this.getAccessSecret(),
      this.accessTokenTtlSeconds
    );

    const refreshToken = this.signToken(
      {
        sub: input.userId,
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        locale: input.locale,
        name: input.name,
        sessionId: input.sessionId,
        type: "refresh"
      },
      this.getRefreshSecret(),
      this.refreshTokenTtlSeconds
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date((this.getPayload(accessToken).exp ?? 0) * 1000).toISOString(),
      refreshTokenExpiresAt: new Date((this.getPayload(refreshToken).exp ?? 0) * 1000).toISOString()
    };
  }

  verifyAccessToken(token: string): AuthJwtPayload {
    return this.verifyToken(token, this.getAccessSecret(), "access");
  }

  verifyRefreshToken(token: string): AuthJwtPayload {
    return this.verifyToken(token, this.getRefreshSecret(), "refresh");
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private signToken(
    payload: Omit<AuthJwtPayload, "iat" | "exp">,
    secret: string,
    ttlSeconds: number
  ) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const fullPayload: AuthJwtPayload = {
      ...payload,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds
    };

    const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifyToken(token: string, secret: string, expectedType: "access" | "refresh") {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid token format.");
    }

    const [encodedHeader, encodedPayload, receivedSignature] = parts;
    const expectedSignature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))
    ) {
      throw new UnauthorizedException("Invalid token signature.");
    }

    const payload = this.getPayload(token);
    if (payload.type !== expectedType) {
      throw new UnauthorizedException(`Expected a ${expectedType} token.`);
    }

    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Token has expired.");
    }

    return payload;
  }

  private getPayload(token: string): AuthJwtPayload {
    const [, encodedPayload] = token.split(".");
    try {
      return JSON.parse(base64UrlDecode(encodedPayload)) as AuthJwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid token payload.");
    }
  }

  private getAccessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT_ACCESS_SECRET is not configured.");
    }
    return secret;
  }

  private getRefreshSecret() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT_REFRESH_SECRET is not configured.");
    }
    return secret;
  }
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function parseDurationToSeconds(input: string) {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Unsupported token TTL format: ${input}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };

  return value * unitSeconds[unit];
}
