import { NextResponse } from "next/server";
import { getCompetition } from "@/lib/database";

export async function GET() {
  const competition = getCompetition();
  return NextResponse.json(competition);
}
