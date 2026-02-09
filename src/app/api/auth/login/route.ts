import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData, generateSessionId } from "@/lib/session";
import { validateTeamCredentials, isTeamBanned, validateMemberLogin } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching for login endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Rate limiting DISABLED to prevent "too many attempts" errors
// Teams can login freely without rate limiting restrictions

export async function POST(request: NextRequest) {
  try {
    const { username, password, registrationOnly } = await request.json();

    // Allow login with just registration/member ID (no password) for participants
    if (registrationOnly && username) {
      const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
      
      // Validate by member ID (individual team member)
      const result = validateMemberLogin(username.trim());
      
      if (!result.valid) {
        return NextResponse.json(
          { success: false, message: "Member ID not found. Please check your registration number." },
          { status: 401 }
        );
      }
      
      // Check if team is banned
      if (isTeamBanned(result.teamName)) {
        return NextResponse.json(
          { success: false, message: "Your team has been banned from the competition" },
          { status: 403 }
        );
      }
      
      // Generate unique session ID for this login
      const sessionId = generateSessionId();
      const allowedPath = "/team";
      const memberId = username.trim().toLowerCase();

      // Store session with memberId for relay tracking
      session.user = { 
        name: result.teamName, 
        memberId: memberId,
        isAdmin: false, 
        isMasterAdmin: false, 
        sessionId, 
        allowedPath 
      };
      await session.save();
      
      return NextResponse.json({ 
        success: true, 
        isAdmin: false, 
        isMasterAdmin: false, 
        sessionId,
        teamName: result.teamName,
        memberId: memberId,
      });
    }

    // Traditional login with username and password (for admins)
    if (!username) {
      return NextResponse.json(
        { success: false, message: "Registration number required" },
        { status: 400 }
      );
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // For admin login, password is required
    const { valid, isAdmin, isMasterAdmin, actualName } = validateTeamCredentials(username, password || "");

    if (!valid) {
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

    // Generate unique session ID for this login
    const sessionId = generateSessionId();
    const allowedPath = isAdmin ? "/admin" : "/team";

    // Store session with sessionId, allowed path, and master admin status
    session.user = { 
      name: actualName, 
      memberId: isAdmin ? "admin" : username.trim().toLowerCase(),
      isAdmin, 
      isMasterAdmin, 
      sessionId, 
      allowedPath 
    };
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
