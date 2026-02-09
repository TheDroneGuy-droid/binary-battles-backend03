import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addAdmin, removeAdmin, getAdmins } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Get all admins (master admin only)
export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user?.isMasterAdmin) {
      return NextResponse.json(
        { success: false, message: "Master admin access required" },
        { status: 403 }
      );
    }

    const admins = getAdmins();
    return NextResponse.json({ success: true, admins });
  } catch (error) {
    console.error("Get admins error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// Add or remove admin (master admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user?.isMasterAdmin) {
      return NextResponse.json(
        { success: false, message: "Master admin access required" },
        { status: 403 }
      );
    }

    const { action, username, password } = await request.json();

    if (!action || !username) {
      return NextResponse.json(
        { success: false, message: "Action and username required" },
        { status: 400 }
      );
    }

    if (action === "add") {
      if (!password) {
        return NextResponse.json(
          { success: false, message: "Password required for new admin" },
          { status: 400 }
        );
      }

      // Validate username - only alphanumeric and underscore allowed
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json(
          { success: false, message: "Username can only contain letters, numbers, and underscores" },
          { status: 400 }
        );
      }

      // Validate password length
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const success = addAdmin(username, password);
      if (success) {
        return NextResponse.json({ success: true, message: `Admin "${username}" created successfully` });
      } else {
        return NextResponse.json(
          { success: false, message: "Failed to create admin - username may already exist" },
          { status: 400 }
        );
      }
    } else if (action === "remove") {
      const success = removeAdmin(username);
      if (success) {
        return NextResponse.json({ success: true, message: `Admin "${username}" removed successfully` });
      } else {
        return NextResponse.json(
          { success: false, message: "Failed to remove admin - cannot remove master admin" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action. Use 'add' or 'remove'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Manage admins error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
