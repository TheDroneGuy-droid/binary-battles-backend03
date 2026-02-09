import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import { problems } from "@/lib/data";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Piston API - Free code execution API (no API key required)
const PISTON_API_URL = "https://emkc.org/api/v2/piston/execute";

// Language configurations for Piston API
const PISTON_LANGUAGES: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  cpp: { language: "c++", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  java: { language: "java", version: "15.0.2" },
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  csharp: { language: "csharp", version: "6.12.0" },
  go: { language: "go", version: "1.16.2" },
  rust: { language: "rust", version: "1.68.2" },
  ruby: { language: "ruby", version: "3.0.1" },
  kotlin: { language: "kotlin", version: "1.8.20" },
  swift: { language: "swift", version: "5.3.3" },
};

// Execute code using Piston API
async function executeWithPiston(
  code: string,
  language: string,
  input: string
): Promise<{
  output: string;
  error: string;
  status: string;
  time: string;
  success: boolean;
}> {
  const langConfig = PISTON_LANGUAGES[language];
  if (!langConfig) {
    return {
      output: "",
      error: `Unsupported language: ${language}`,
      status: "Error",
      time: "0s",
      success: false,
    };
  }

  try {
    const response = await fetch(PISTON_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [
          {
            name: getFileName(language),
            content: code,
          },
        ],
        stdin: input,
        run_timeout: 10000, // 10 seconds max
      }),
    });

    if (!response.ok) {
      throw new Error(`Piston API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Handle compile errors
    if (result.compile && result.compile.code !== 0) {
      return {
        output: "",
        error: result.compile.stderr || result.compile.output || "Compilation failed",
        status: "Compilation Error",
        time: "0s",
        success: false,
      };
    }

    // Handle runtime results
    const runResult = result.run;
    const hasError = runResult.stderr && runResult.stderr.trim().length > 0;
    const hasOutput = runResult.stdout && runResult.stdout.trim().length > 0;

    return {
      output: runResult.stdout || "",
      error: runResult.stderr || "",
      status: hasError ? "Runtime Error" : (hasOutput ? "Accepted" : "No Output"),
      time: "< 1s",
      success: !hasError,
    };
  } catch (error) {
    console.error("Piston API error:", error);
    return {
      output: "",
      error: error instanceof Error ? error.message : "Execution failed",
      status: "Error",
      time: "0s",
      success: false,
    };
  }
}

// Get appropriate file name for language
function getFileName(language: string): string {
  const fileNames: Record<string, string> = {
    python: "main.py",
    cpp: "main.cpp",
    c: "main.c",
    java: "Main.java",
    javascript: "main.js",
    typescript: "main.ts",
    csharp: "Main.cs",
    go: "main.go",
    rust: "main.rs",
    ruby: "main.rb",
    kotlin: "Main.kt",
    swift: "main.swift",
  };
  return fileNames[language] || "main.txt";
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

    // Check if language is supported
    if (!PISTON_LANGUAGES[language]) {
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

    // Execute code using Piston API
    const pistonResult = await executeWithPiston(code, language, input);

    const result = {
      success: pistonResult.success,
      output: pistonResult.output.trim(),
      error: pistonResult.error.trim(),
      status: pistonResult.status,
      time: pistonResult.time,
      memory: "N/A",
      input: input,
      expectedOutput: expectedOutput,
    };

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
    languages: Object.entries(PISTON_LANGUAGES).map(([name, config]) => ({
      name,
      version: config.version,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
    })),
  });
}
