import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { validateTeamCredentials, isTeamBanned } from "@/lib/database";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password required" },
        { status: 400 }
      );
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const { valid, isAdmin } = validateTeamCredentials(username, password);

    if (!valid) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if team is banned (admins can't be banned)
    if (!isAdmin && isTeamBanned(username)) {
      return NextResponse.json(
        { success: false, message: "Your team has been banned from the competition" },
        { status: 403 }
      );
    }

    // Auto-detect user type from database - no manual selection needed
    session.user = { name: username, isAdmin };
    await session.save();
    return NextResponse.json({ success: true, isAdmin });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
