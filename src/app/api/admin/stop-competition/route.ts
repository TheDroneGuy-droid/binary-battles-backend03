import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { stopCompetition, clearRelayState } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // Stop competition and clear all relay states
  stopCompetition();
  clearRelayState();

  return NextResponse.json({ success: true });
}
