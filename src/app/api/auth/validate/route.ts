import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, currentPath } = await request.json();
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json({ valid: false, reason: "no_session" });
    }

    // Validate session ID matches
    if (session.user.sessionId !== sessionId) {
      // Destroy invalid session
      session.destroy();
      return NextResponse.json({ valid: false, reason: "session_mismatch" });
    }

    // For non-admin users, validate they're on the allowed path
    if (!session.user.isAdmin && currentPath !== session.user.allowedPath) {
      session.destroy();
      return NextResponse.json({ valid: false, reason: "invalid_path" });
    }

    return NextResponse.json({ valid: true, user: session.user });
  } catch (error) {
    console.error("Session validate error:", error);
    return NextResponse.json({ valid: false, reason: "error" });
  }
}
