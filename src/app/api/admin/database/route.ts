import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { executeQuery, getTableSchema } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Get database schema (master admin only)
export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user?.isMasterAdmin) {
      return NextResponse.json(
        { success: false, message: "Master admin access required" },
        { status: 403 }
      );
    }

    const { tables, schema } = getTableSchema();
    return NextResponse.json({ success: true, tables, schema });
  } catch (error) {
    console.error("Get schema error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// Execute SQL query (master admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user?.isMasterAdmin) {
      return NextResponse.json(
        { success: false, message: "Master admin access required" },
        { status: 403 }
      );
    }

    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { success: false, message: "SQL query required" },
        { status: 400 }
      );
    }

    // Basic SQL injection prevention for dangerous operations
    const lowerQuery = query.toLowerCase().trim();
    const dangerousPatterns = [
      "drop database",
      "drop table teams",
      "drop table competition",
      "drop table solved_problems",
      "drop table failed_problems", 
      "drop table submissions",
      "drop table violations",
      "drop table team_activity",
      "truncate",
      "delete from teams where 1",
      "delete from teams;",
      "delete from competition",
      "alter table teams drop",
      "update teams set is_master_admin",
      "update teams set is_admin = 1",
      "insert into teams",
    ];

    for (const pattern of dangerousPatterns) {
      if (lowerQuery.includes(pattern) || lowerQuery === "delete from teams") {
        return NextResponse.json(
          { success: false, message: "This operation is not allowed for safety reasons" },
          { status: 403 }
        );
      }
    }

    const result = executeQuery(query);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Execute query error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
