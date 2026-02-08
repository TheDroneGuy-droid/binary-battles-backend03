import { SessionOptions } from "iron-session";

export interface SessionData {
  user?: {
    name: string;
    isAdmin: boolean;
  };
}

export const sessionOptions: SessionOptions = {
  password: "binary-battles-secret-key-that-is-at-least-32-chars",
  cookieName: "binary-battles-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};
