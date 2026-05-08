import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { Locale } from "@capris/shared";

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  locale: Locale;
  avatarUrl?: string;
}

@Injectable()
export class GoogleIdentityService {
  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException("GOOGLE_CLIENT_ID is not configured.");
    }

    let response: Response;
    try {
      response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    } catch {
      throw new ServiceUnavailableException("Unable to reach Google token verification service.");
    }

    if (!response.ok) {
      throw new UnauthorizedException("Google token verification failed.");
    }

    const payload = (await response.json()) as Record<string, string | undefined>;
    if (payload.aud !== clientId) {
      throw new UnauthorizedException("Google token audience does not match this app.");
    }

    if (payload.email_verified !== "true") {
      throw new UnauthorizedException("Google email must be verified.");
    }

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException("Google token did not include the required identity fields.");
    }

    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name?.trim() || payload.email,
      locale: payload.locale === "es" ? "es" : "en",
      avatarUrl: payload.picture
    };
  }
}
