import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { getFinalSubmissions, getAllTeams, getCompetitionStats, getViolations } from "@/lib/database";
import { problems } from "@/lib/data";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "report";

  const submissions = getFinalSubmissions();
  const teams = getAllTeams().filter(t => !t.is_admin);
  const stats = getCompetitionStats();
  const violations = getViolations();

  if (type === "report") {
    // Generate simple report with correct/incorrect status
    let csv = "Team Name,Problem ID,Problem Title,Language,Status,Submission Time\n";
    
    submissions.forEach(sub => {
      const problem = problems.find(p => p.id === sub.problemId);
      const problemTitle = problem?.title || `Problem ${sub.problemId}`;
      const status = sub.result.passed ? "Correct" : "Incorrect";
      csv += `"${sub.team}",${sub.problemId},"${problemTitle}","${sub.language}","${status}","${sub.timestamp}"\n`;
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="submissions_report_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } else if (type === "analytics") {
    // Generate comprehensive analytics report
    let csv = "=== BINARY BATTLES COMPETITION ANALYTICS ===\n\n";
    
    // Overall Stats
    csv += "=== OVERALL STATISTICS ===\n";
    csv += `Total Teams,${stats.totalTeams}\n`;
    csv += `Active Teams (5m),${stats.activeTeams}\n`;
    csv += `Total Submissions,${stats.totalSubmissions}\n`;
    csv += `Passed Submissions,${stats.passedSubmissions}\n`;
    csv += `Failed Submissions,${stats.failedSubmissions}\n`;
    csv += `Pass Rate,${stats.totalSubmissions > 0 ? ((stats.passedSubmissions / stats.totalSubmissions) * 100).toFixed(1) : 0}%\n`;
    csv += `Total Violations,${stats.totalViolations}\n\n`;
    
    // Problem Stats
    csv += "=== PROBLEM STATISTICS ===\n";
    csv += "Problem ID,Problem Title,Solved,Attempted,Solve Rate\n";
    stats.problemStats.forEach(ps => {
      const problem = problems.find(p => p.id === ps.problemId);
      const title = problem?.title || `Problem ${ps.problemId}`;
      const solveRate = ps.attempted > 0 ? ((ps.solved / ps.attempted) * 100).toFixed(1) : "0";
      csv += `${ps.problemId},"${title}",${ps.solved},${ps.attempted},${solveRate}%\n`;
    });
    csv += "\n";
    
    // Team Performance
    csv += "=== TEAM PERFORMANCE ===\n";
    csv += "Team Name,Score,Problems Solved,Violations,Banned\n";
    teams.forEach(team => {
      const teamViolations = violations.filter(v => v.team_name === team.name).length;
      csv += `"${team.name}",${team.score},${team.solved.length},${teamViolations},${team.is_banned ? "Yes" : "No"}\n`;
    });
    csv += "\n";
    
    // Detailed Submissions
    csv += "=== DETAILED SUBMISSIONS ===\n";
    csv += "Team Name,Problem ID,Problem Title,Language,Status,Message,Submission Time\n";
    submissions.forEach(sub => {
      const problem = problems.find(p => p.id === sub.problemId);
      const problemTitle = problem?.title || `Problem ${sub.problemId}`;
      const status = sub.result.passed ? "Correct" : "Incorrect";
      const message = sub.result.message.replace(/"/g, '""');
      csv += `"${sub.team}",${sub.problemId},"${problemTitle}","${sub.language}","${status}","${message}","${sub.timestamp}"\n`;
    });
    csv += "\n";
    
    // Violations Log
    if (violations.length > 0) {
      csv += "=== VIOLATIONS LOG ===\n";
      csv += "Team Name,Violation Type,Details,Time\n";
      violations.forEach(v => {
        const details = (v.details || "").replace(/"/g, '""');
        csv += `"${v.team_name}","${v.violation_type}","${details}","${v.created_at}"\n`;
      });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="competition_analytics_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ success: false, message: "Invalid type" }, { status: 400 });
}
