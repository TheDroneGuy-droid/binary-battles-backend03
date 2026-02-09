import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

// Disable caching for session endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    const response = session.user 
      ? NextResponse.json({ user: session.user })
      : NextResponse.json({ user: null });
    
    // Prevent caching of session data
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ user: null });
  }
}
