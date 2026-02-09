import { SessionOptions } from "iron-session";
import crypto from "crypto";

export interface SessionData {
  user?: {
    name: string; // Team name
    memberId: string; // Individual member ID for relay
    isAdmin: boolean;
    isMasterAdmin: boolean; // Master admin with extra privileges
    sessionId: string; // Unique session ID for each login
    allowedPath: string; // The path the user is allowed to access
  };
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Use environment variable for production, fallback to default for development
// IMPORTANT: Set SESSION_SECRET in your production environment
const SESSION_SECRET = process.env.SESSION_SECRET || "binary-battles-secret-key-that-is-at-least-32-chars";

// Session TTL: 8 hours in seconds (extended to prevent auto-logout)
const SESSION_TTL = 8 * 60 * 60;

// Determine if we're in a secure context (HTTPS)
const isProduction = process.env.NODE_ENV === "production";

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: "binary-battles-session",
  ttl: SESSION_TTL, // Session expires after 8 hours
  cookieOptions: {
    // In production, require HTTPS for secure cookies
    // Set to false if your production doesn't use HTTPS
    secure: isProduction,
    httpOnly: true, // Prevents JavaScript access to cookie
    sameSite: "lax", // Use "lax" for same-site navigation
    maxAge: SESSION_TTL, // Cookie expires with session
    path: "/", // Cookie available on all paths
  },
};
