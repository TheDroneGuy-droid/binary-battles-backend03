import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import {
  getTeam,
  addSubmission,
  addSolvedProblem,
  addFailedProblem,
  updateTeamScore,
  setSelectedProblem,
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

  const { problemId, code, language, autoSave, lockProblem } = await request.json();
  const parsedProblemId = parseInt(problemId);
  const problem = problems.find((p) => p.id === parsedProblemId);

  if (!problem) {
    return NextResponse.json(
      { success: false, message: "Problem not found" },
      { status: 404 }
    );
  }

  const teamName = session.user.name;
  
  // Get current team data
  const team = getTeam(teamName);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 }
    );
  }

  // Check if team has already selected a different problem
  if (team.selectedProblem && team.selectedProblem !== parsedProblemId) {
    return NextResponse.json(
      { success: false, message: `You can only attempt Problem ${team.selectedProblem}. You cannot change your selected problem.` },
      { status: 403 }
    );
  }

  // If auto-save, just save the code without evaluation
  if (autoSave) {
    addSubmission(
      teamName,
      parsedProblemId,
      code,
      language,
      false,
      "Auto-saved draft"
    );
    return NextResponse.json({ success: true, autoSave: true });
  }

  // Lock problem selection on first real submission
  if (lockProblem && !team.selectedProblem) {
    setSelectedProblem(teamName, parsedProblemId);
  }

  const result = autoCorrect(code, problem, language);

  // Add submission to database
  addSubmission(
    teamName,
    parsedProblemId,
    code,
    language,
    result.passed,
    result.message
  );

  if (result.passed) {
    if (!team.solved.includes(parsedProblemId)) {
      // Calculate score based on test cases passed
      const earnedScore = result.score || 10;
      updateTeamScore(teamName, team.score + earnedScore);
      addSolvedProblem(teamName, parsedProblemId);
    }
  } else {
    if (!team.solved.includes(parsedProblemId)) {
      addFailedProblem(teamName, parsedProblemId);
    }
  }

  return NextResponse.json({
    success: true,
    result: result,
  });
}
