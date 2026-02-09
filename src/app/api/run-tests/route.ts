import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import { problems, runTestCases } from "@/lib/data";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { code, language, problemId } = await request.json();

    if (!code || !language || !problemId) {
      return NextResponse.json(
        { success: false, message: "Code, language, and problemId are required" },
        { status: 400 }
      );
    }

    const problem = problems.find(p => p.id === parseInt(problemId));
    if (!problem) {
      return NextResponse.json(
        { success: false, message: "Problem not found" },
        { status: 404 }
      );
    }

    // Run test cases against the code
    const testResults = await runTestCases(code, language, problem);

    return NextResponse.json({
      success: true,
      results: testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.passed).length,
        failed: testResults.filter(r => !r.passed).length,
      },
    });
  } catch (error) {
    console.error("Test cases error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to run test cases",
      },
      { status: 500 }
    );
  }
}
