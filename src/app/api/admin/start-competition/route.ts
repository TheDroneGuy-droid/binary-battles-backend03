import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { startCompetition } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user || !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const duration = parseInt(body.duration) || 120;
    
    console.log("Starting competition with duration:", duration);
    startCompetition(duration);

    return NextResponse.json({ success: true, duration });
  } catch (error) {
    console.error("Start competition error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
