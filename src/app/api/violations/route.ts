import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addViolation, getViolations, getViolationCount, clearViolations } from "@/lib/database";
import { cookies } from "next/headers";

// Report a violation (from team page)
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { violationType, details } = await request.json();
    
    if (!violationType) {
      return NextResponse.json(
        { success: false, message: "Violation type required" },
        { status: 400 }
      );
    }

    addViolation(session.user.name, violationType, details || "");
    const count = getViolationCount(session.user.name);

    return NextResponse.json({ 
      success: true, 
      violationCount: count,
      message: `Violation recorded: ${violationType}`
    });
  } catch (error) {
    console.error("Violation API error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// Get violations (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user || !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get("team") || undefined;

    const violations = getViolations(teamName);

    return NextResponse.json({ 
      success: true, 
      violations 
    });
  } catch (error) {
    console.error("Get violations error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// Clear violations (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user || !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get("team") || undefined;

    clearViolations(teamName);

    return NextResponse.json({ 
      success: true, 
      message: teamName ? `Violations cleared for ${teamName}` : "All violations cleared"
    });
  } catch (error) {
    console.error("Clear violations error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
