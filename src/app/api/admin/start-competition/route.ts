import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { startCompetition, initializeAllRelays, setRelayDuration } from "@/lib/database";
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
    const relayDuration = parseInt(body.relayDuration) || 5; // Default 5 minutes per relay
    
    console.log("Starting competition with duration:", duration, "relay duration:", relayDuration);
    
    // Set relay duration
    setRelayDuration(relayDuration);
    
    // Start the competition
    startCompetition(duration);
    
    // Initialize relay states for all teams
    const relaysInitialized = initializeAllRelays();
    console.log("Relays initialized for", relaysInitialized, "teams");

    return NextResponse.json({ 
      success: true, 
      duration, 
      relayDuration,
      relaysInitialized,
    });
  } catch (error) {
    console.error("Start competition error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
