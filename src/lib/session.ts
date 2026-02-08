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

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: "binary-battles-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true, // Prevents JavaScript access to cookie
    sameSite: "lax", // CSRF protection
  },
};
