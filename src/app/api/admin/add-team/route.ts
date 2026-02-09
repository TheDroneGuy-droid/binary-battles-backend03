import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addTeam, getTeam, setTeamMembers } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const { teamName, password, teamSize = 2, registrationNumbers = "", memberIds = [] } = await request.json();

  // Normalize the team name
  const normalizedTeamName = normalizeTeamName(teamName);

  if (!normalizedTeamName) {
    return NextResponse.json(
      { success: false, message: "Invalid team name" },
      { status: 400 }
    );
  }

  // Parse member IDs from registrationNumbers if not provided separately
  let members: string[] = memberIds;
  if (members.length === 0 && registrationNumbers) {
    // Split by comma, semicolon, or newline
    members = registrationNumbers
      .split(/[,;\n]+/)
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);
  }

  // Validate team size (2-4 members for relay)
  if (members.length < 2) {
    return NextResponse.json(
      { success: false, message: "Team must have at least 2 members for relay mode" },
      { status: 400 }
    );
  }

  if (members.length > 4) {
    return NextResponse.json(
      { success: false, message: "Team can have maximum 4 members" },
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

  // Add the team
  const success = addTeam(normalizedTeamName, password, members.length, registrationNumbers);
  
  if (!success) {
    return NextResponse.json(
      { success: false, message: "Failed to add team" },
      { status: 500 }
    );
  }

  // Add team members for relay
  const membersAdded = setTeamMembers(normalizedTeamName, members);
  
  if (!membersAdded) {
    return NextResponse.json(
      { success: false, message: "Team created but failed to add members" },
      { status: 500 }
    );
  }

  return NextResponse.json({ 
    success: true, 
    teamName: normalizedTeamName,
    memberCount: members.length,
    members: members,
  });
}
