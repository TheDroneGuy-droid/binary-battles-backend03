import { SessionOptions } from "iron-session";
import crypto from "crypto";

export interface SessionData {
  user?: {
    name: string;
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
const SESSION_SECRET = process.env.SESSION_SECRET || "binary-battles-secret-key-that-is-at-least-32-chars";

// Session TTL: 20 minutes in seconds
const SESSION_TTL = 20 * 60;

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: "binary-battles-session",
  ttl: SESSION_TTL, // Session expires after 20 minutes
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true, // Prevents JavaScript access to cookie
    sameSite: "lax", // CSRF protection
    maxAge: SESSION_TTL, // Cookie expires with session
    path: "/", // Cookie available on all paths
  },
};
