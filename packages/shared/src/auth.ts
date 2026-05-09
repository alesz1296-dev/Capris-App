import { z } from "zod";
import type { Locale, Role, User } from "./domain";

export const googleSignInSchema = z.object({
  idToken: z.string().min(20, "idToken is required."),
  deviceName: z.string().trim().min(2).max(120).optional()
});

export const emailSignInSchema = z.object({
  email: z.string().trim().email("A valid email is required.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  deviceName: z.string().trim().min(2).max(120).optional()
});

export const emailRegisterSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().email("A valid email is required.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  locale: z.enum(["en", "es"]).default("es"),
  deviceName: z.string().trim().min(2).max(120).optional()
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(20, "refreshToken is required.")
});

export const signOutSchema = z.object({
  refreshToken: z.string().min(20, "refreshToken is required.")
});

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  locale: Locale;
  active: boolean;
  avatarUrl?: string;
  googleSubject?: string;
}

export interface AuthSession {
  id: string;
  provider: "google" | "password";
  deviceName?: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  session: AuthSession;
}

export interface AuthProfileResponse {
  user: AuthenticatedUser;
  session: AuthSession;
}

export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type EmailSignInInput = z.infer<typeof emailSignInSchema>;
export type EmailRegisterInput = z.infer<typeof emailRegisterSchema>;
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;
export type SignOutInput = z.infer<typeof signOutSchema>;

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    active: user.active,
    avatarUrl: user.avatarUrl,
    googleSubject: user.googleSubject
  };
}
