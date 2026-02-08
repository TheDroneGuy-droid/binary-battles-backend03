import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { stopCompetition } from "@/lib/database";
import { cookies } from "next/headers";

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  stopCompetition();

  return NextResponse.json({ success: true });
}
