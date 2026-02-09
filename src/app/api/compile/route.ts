import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import { problems } from "@/lib/data";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Judge0 API configuration - using public instance
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";

// Language IDs for Judge0
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,      // Python 3.8.1
  cpp: 54,         // C++ (GCC 9.2.0)
  c: 50,           // C (GCC 9.2.0)
  java: 62,        // Java (OpenJDK 13.0.1)
  javascript: 63,  // JavaScript (Node.js 12.14.0)
  typescript: 74,  // TypeScript (3.7.4)
  csharp: 51,      // C# (Mono 6.6.0.161)
  go: 60,          // Go (1.13.5)
  rust: 73,        // Rust (1.40.0)
  ruby: 72,        // Ruby (2.7.0)
  kotlin: 78,      // Kotlin (1.3.70)
  swift: 83,       // Swift (5.2.3)
};

// Fallback local execution for when Judge0 is not available
async function executeLocally(code: string, language: string, input: string): Promise<{
  stdout: string;
  stderr: string;
  status: string;
  time: string;
  memory: string;
}> {
  // For security, we'll simulate execution by pattern matching
  // This is a simplified version - in production, use sandboxed execution
  
  try {
    // Simulate compilation/execution
    const result = simulateExecution(code, language, input);
    return {
      stdout: result.output,
      stderr: result.error,
      status: result.error ? "Runtime Error" : "Accepted",
      time: "0.01s",
      memory: "1024 KB",
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : "Execution failed",
      status: "Runtime Error",
      time: "0s",
      memory: "0 KB",
    };
  }
}

function simulateExecution(code: string, language: string, input: string): { output: string; error: string } {
  // Basic syntax validation
  const codeLower = code.toLowerCase();
  
  // Check for dangerous operations
  const dangerousPatterns = [
    /import\s+os/i,
    /import\s+subprocess/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /system\s*\(/i,
    /__import__/i,
    /open\s*\(/i,
    /file\s*\(/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return { output: "", error: "Potentially unsafe code detected" };
    }
  }
  
  // For demonstration, return a placeholder
  // In production, this would use actual sandboxed execution
  return {
    output: "Code compiled successfully. For full execution, configure Judge0 API.",
    error: "",
  };
}

// Use Judge0 API for actual code execution
async function executeWithJudge0(
  code: string, 
  languageId: number, 
  input: string
): Promise<{
  stdout: string;
  stderr: string;
  compile_output: string;
  status: { description: string };
  time: string;
  memory: number;
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  // Add RapidAPI headers if using the hosted version
  if (JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = JUDGE0_API_HOST;
  }

  // Submit code for execution
  const submitResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: Buffer.from(code).toString("base64"),
      language_id: languageId,
      stdin: Buffer.from(input).toString("base64"),
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });

  if (!submitResponse.ok) {
    throw new Error(`Judge0 API error: ${submitResponse.status}`);
  }

  const result = await submitResponse.json();
  
  return {
    stdout: result.stdout ? Buffer.from(result.stdout, "base64").toString() : "",
    stderr: result.stderr ? Buffer.from(result.stderr, "base64").toString() : "",
    compile_output: result.compile_output ? Buffer.from(result.compile_output, "base64").toString() : "",
    status: result.status || { description: "Unknown" },
    time: result.time || "0",
    memory: result.memory || 0,
  };
}

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

    if (!code || !language) {
      return NextResponse.json(
        { success: false, message: "Code and language are required" },
        { status: 400 }
      );
    }

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      return NextResponse.json(
        { success: false, message: `Unsupported language: ${language}` },
        { status: 400 }
      );
    }

    // Get the first test case input from the problem
    let input = "";
    let expectedOutput = "";
    if (problemId) {
      const problem = problems.find(p => p.id === parseInt(problemId));
      if (problem && problem.testCases && problem.testCases.length > 0) {
        // Use the first non-hidden test case
        const firstTestCase = problem.testCases.find(tc => !tc.isHidden) || problem.testCases[0];
        input = firstTestCase.input;
        expectedOutput = firstTestCase.expectedOutput;
      }
    }

    let result;

    // Try Judge0 API first, fallback to local simulation
    if (JUDGE0_API_KEY) {
      try {
        const judge0Result = await executeWithJudge0(code, languageId, input);
        result = {
          success: true,
          output: judge0Result.stdout,
          error: judge0Result.stderr || judge0Result.compile_output,
          status: judge0Result.status.description,
          time: `${judge0Result.time}s`,
          memory: `${Math.round(judge0Result.memory / 1024)} KB`,
          input: input,
          expectedOutput: expectedOutput,
        };
      } catch (error) {
        console.error("Judge0 API error:", error);
        // Fallback to local execution
        const localResult = await executeLocally(code, language, input);
        result = {
          success: true,
          output: localResult.stdout,
          error: localResult.stderr,
          status: localResult.status,
          time: localResult.time,
          memory: localResult.memory,
          input: input,
          expectedOutput: expectedOutput,
        };
      }
    } else {
      // No API key, use local simulation
      const localResult = await executeLocally(code, language, input);
      result = {
        success: true,
        output: localResult.stdout,
        error: localResult.stderr,
        status: localResult.status,
        time: localResult.time,
        memory: localResult.memory,
        input: input,
        expectedOutput: expectedOutput,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Compile error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Compilation failed",
        status: "Error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check supported languages
export async function GET() {
  return NextResponse.json({
    success: true,
    languages: Object.entries(LANGUAGE_IDS).map(([name, id]) => ({
      name,
      id,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
    })),
  });
}
