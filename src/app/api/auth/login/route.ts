import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData, generateSessionId } from "@/lib/session";
import { validateTeamCredentials, isTeamBanned } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching for login endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simple in-memory rate limiting to prevent brute force attacks
const loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remainingTime?: number } {
  const attempt = loginAttempts.get(ip);
  const now = Date.now();
  
  if (!attempt) {
    return { allowed: true };
  }
  
  // Reset if lockout has expired
  if (now - attempt.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  
  if (attempt.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempt.lastAttempt)) / 1000 / 60);
    return { allowed: false, remainingTime };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const attempt = loginAttempts.get(ip);
  const now = Date.now();
  
  if (!attempt || now - attempt.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(ip, { count: attempt.count + 1, lastAttempt: now });
  }
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: `Too many failed attempts. Try again in ${rateLimit.remainingTime} minutes.` },
        { status: 429 }
      );
    }
    
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password required" },
        { status: 400 }
      );
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const { valid, isAdmin, isMasterAdmin, actualName } = validateTeamCredentials(username, password);

    if (!valid) {
      recordFailedAttempt(clientIP);
      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if team is banned (admins can't be banned)
    if (!isAdmin && isTeamBanned(actualName)) {
      return NextResponse.json(
        { success: false, message: "Your team has been banned from the competition" },
        { status: 403 }
      );
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(clientIP);

    // Generate unique session ID for this login
    const sessionId = generateSessionId();
    const allowedPath = isAdmin ? "/admin" : "/team";

    // Store session with sessionId, allowed path, and master admin status
    session.user = { name: actualName, isAdmin, isMasterAdmin, sessionId, allowedPath };
    await session.save();
    
    return NextResponse.json({ success: true, isAdmin, isMasterAdmin, sessionId });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
