import { NextResponse } from "next/server";
import { getCompetition } from "@/lib/database";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const competition = getCompetition();
  return NextResponse.json(competition);
}
