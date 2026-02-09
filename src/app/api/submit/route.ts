import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import {
  getTeam,
  addSubmission,
  addSolvedProblem,
  addFailedProblem,
  updateTeamScore,
} from "@/lib/database";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { problems, autoCorrect } from "@/lib/data";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { problemId, code, language, autoSave } = await request.json();
  const problem = problems.find((p) => p.id === parseInt(problemId));

  if (!problem) {
    return NextResponse.json(
      { success: false, message: "Problem not found" },
      { status: 404 }
    );
  }

  const teamName = session.user.name;

  // If auto-save, just save the code without evaluation
  if (autoSave) {
    addSubmission(
      teamName,
      parseInt(problemId),
      code,
      language,
      false,
      "Auto-saved draft"
    );
    return NextResponse.json({ success: true, autoSave: true });
  }

  const result = autoCorrect(code, problem, language);

  // Add submission to database
  addSubmission(
    teamName,
    parseInt(problemId),
    code,
    language,
    result.passed,
    result.message
  );

  // Get current team data
  const team = getTeam(teamName);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 }
    );
  }

  if (result.passed) {
    if (!team.solved.includes(parseInt(problemId))) {
      // Update score and mark as solved
      updateTeamScore(teamName, team.score + 10);
      addSolvedProblem(teamName, parseInt(problemId));
    }
  } else {
    if (!team.solved.includes(parseInt(problemId))) {
      addFailedProblem(teamName, parseInt(problemId));
    }
  }

  return NextResponse.json({
    success: true,
    result: result,
  });
}
