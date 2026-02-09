import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import {
  getRelayState,
  checkAndTransitionRelay,
  updateSharedCode,
  isActiveMember,
  getTeamMembers,
  getRelayDuration,
  getMemberTeam,
} from "@/lib/database";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Get current relay state for the team
export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Admin cannot participate in relay" },
        { status: 403 }
      );
    }

    const teamName = session.user.name;
    const memberId = session.user.sessionId; // We'll use memberId stored in session

    // Check and transition relay if needed (auto-transition on timer expiry)
    const state = checkAndTransitionRelay(teamName);

    if (!state) {
      // No relay state - check if team has members
      const members = getTeamMembers(teamName);
      return NextResponse.json({
        success: true,
        relayActive: false,
        members,
        message: members.length < 2
          ? "Team needs at least 2 members for relay mode"
          : "Relay not started. Waiting for competition to begin.",
      });
    }

    // Calculate remaining time
    const now = Date.now();
    const remainingMs = Math.max(0, state.relayEndTime - now);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    // Check if this user is the active member
    const userMemberId = session.user.memberId || "";
    const isActive = isActiveMember(teamName, userMemberId);

    return NextResponse.json({
      success: true,
      relayActive: true,
      isActiveEditor: isActive,
      currentMember: {
        id: state.currentMemberId,
        index: state.currentMemberIndex,
        name: state.members.find(m => m.id === state.currentMemberId)?.name || state.currentMemberId,
      },
      relayNumber: state.relayNumber,
      relayDuration: getRelayDuration(),
      remainingSeconds,
      relayEndTime: state.relayEndTime,
      sharedCode: state.sharedCode,
      sharedLanguage: state.sharedLanguage,
      members: state.members,
      relayHistory: state.relayHistory,
    });
  } catch (error) {
    console.error("Relay state error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get relay state" },
      { status: 500 }
    );
  }
}

// POST: Update shared code (only active member can do this)
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Admin cannot participate in relay" },
        { status: 403 }
      );
    }

    const { code, language } = await request.json();
    const teamName = session.user.name;
    const memberId = session.user.memberId || "";

    // Check if relay needs transition first
    checkAndTransitionRelay(teamName);

    // Verify this member is active
    if (!isActiveMember(teamName, memberId)) {
      return NextResponse.json(
        { success: false, message: "You are not the active editor. Wait for your turn." },
        { status: 403 }
      );
    }

    // Update the shared code
    const updated = updateSharedCode(teamName, memberId, code, language);

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Failed to update code" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Relay update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update code" },
      { status: 500 }
    );
  }
}
