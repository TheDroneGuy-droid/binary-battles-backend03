import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addTeam, getTeam } from "@/lib/database";
import { cookies } from "next/headers";

// Normalize team name: lowercase, replace spaces with dashes
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/[^a-z0-9-]/g, ""); // Remove any remaining special characters
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { teamName, password, teamSize = 1, registrationNumbers = "" } = await request.json();

  // Normalize the team name
  const normalizedTeamName = normalizeTeamName(teamName);

  if (!normalizedTeamName) {
    return NextResponse.json(
      { success: false, message: "Invalid team name" },
      { status: 400 }
    );
  }

  // Check if team already exists
  const existingTeam = getTeam(normalizedTeamName);
  if (existingTeam) {
    return NextResponse.json(
      { success: false, message: "Team already exists" },
      { status: 400 }
    );
  }

  const success = addTeam(normalizedTeamName, password, teamSize, registrationNumbers);
  
  if (!success) {
    return NextResponse.json(
      { success: false, message: "Failed to add team" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, teamName: normalizedTeamName });
}
