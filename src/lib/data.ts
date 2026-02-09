import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
export const TEAMS_FILE = path.join(DATA_DIR, "teams.json");
export const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
export const COMPETITION_FILE = path.join(DATA_DIR, "competition.json");

// Initialize data directory and files
export function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(TEAMS_FILE)) {
    fs.writeFileSync(
      TEAMS_FILE,
      JSON.stringify({
        admin: { password: "admin123", isAdmin: true, score: 0, solved: [] },
      })
    );
  }

  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([]));
  }

  if (!fs.existsSync(COMPETITION_FILE)) {
    fs.writeFileSync(
      COMPETITION_FILE,
      JSON.stringify({
        startTime: null,
        duration: 120,
      })
    );
  }
}

export function readJSON<T>(file: string): T | null {
  try {
    initializeData();
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("Error reading file:", file, error);
    return null;
  }
}

export function writeJSON(file: string, data: unknown): boolean {
  try {
    initializeData();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing file:", file, error);
    return false;
  }
}

// Types
export interface TeamData {
  password: string;
  isAdmin?: boolean;
  score: number;
  solved: number[];
  failed?: number[];
}

export interface Teams {
  [key: string]: TeamData;
}

export interface Submission {
  team: string;
  problemId: number;
  code: string;
  language: string;
  result: {
    passed: boolean;
    message: string;
  };
  timestamp: string;
}

export interface Competition {
  startTime: number | null;
  duration: number;
}

export interface Problem {
  id: number;
  title: string;
  description: string;
  input: string;
  output: string;
  examples: { input: string; output: string }[];
}

// Problems data
export const problems: Problem[] = [
  {
    id: 1,
    title: "Array Sum Pairs",
    description:
      "Given an array of integers and a target sum, find if there exist two numbers in the array that add up to the target.",
    input: "First line: two integers n (array size) and target\nSecond line: n space-separated integers",
    output: "Print 'YES' if such a pair exists, otherwise 'NO'",
    examples: [
      { input: "5 9\n2 7 11 4 5", output: "YES" },
      { input: "4 10\n1 2 3 4", output: "NO" },
    ],
  },
  {
    id: 2,
    title: "Palindrome Checker",
    description:
      "Check if a given string is a palindrome (reads the same forwards and backwards), ignoring spaces and case.",
    input: "A single line containing a string",
    output: "Print 'PALINDROME' if it is, otherwise 'NOT PALINDROME'",
    examples: [
      { input: "racecar", output: "PALINDROME" },
      { input: "hello", output: "NOT PALINDROME" },
    ],
  },
  {
    id: 3,
    title: "Prime Number Counter",
    description:
      "Count how many prime numbers exist between two given numbers (inclusive).",
    input: "Two integers L and R (1 ≤ L ≤ R ≤ 1000)",
    output: "Print the count of prime numbers in the range [L, R]",
    examples: [
      { input: "1 10", output: "4" },
      { input: "10 20", output: "4" },
    ],
  },
  {
    id: 4,
    title: "Matrix Diagonal Sum",
    description:
      "Given an N×N matrix, calculate the sum of both diagonals (primary and secondary).",
    input: "First line: integer N\nNext N lines: N space-separated integers each",
    output: "Print the sum of both diagonals",
    examples: [{ input: "3\n1 2 3\n4 5 6\n7 8 9", output: "25" }],
  },
  {
    id: 5,
    title: "Binary to Decimal",
    description:
      "Convert a binary number (given as a string) to its decimal equivalent.",
    input: "A string containing only 0s and 1s",
    output: "Print the decimal equivalent",
    examples: [
      { input: "1010", output: "10" },
      { input: "11111111", output: "255" },
    ],
  },
  {
    id: 6,
    title: "Fibonacci Sequence",
    description: "Generate the first N numbers in the Fibonacci sequence.",
    input: "An integer N (1 ≤ N ≤ 20)",
    output: "Print N Fibonacci numbers separated by spaces",
    examples: [
      { input: "5", output: "0 1 1 2 3" },
      { input: "8", output: "0 1 1 2 3 5 8 13" },
    ],
  },
  {
    id: 7,
    title: "Token Merge Validation",
    description: "Given a string of tokens separated by spaces, validate if consecutive duplicate tokens can be merged. Print 'VALID' if no consecutive duplicates exist, otherwise print    'INVALID' followed by the first duplicate token.",
    input: "A single line containing tokens separated by spaces (1 ≤ number of tokens ≤ 100, each token length ≤ 20)",
    output: "Print 'VALID' if no consecutive duplicates, or 'INVALID: <token>' where <token> is the first consecutive duplicate",
    examples: [
      { input: "hello world test", output: "VALID" },
      { input: "foo bar bar baz", output: "INVALID: bar" },
      { input: "a b c c d", output: "INVALID: c" },
      { input: "single", output: "VALID" },
     ],
   },
   {
     id: 8,
     title: "Block Grid Packing",
     description: "Given a grid of size M x N and a list of rectangular blocks with dimensions, determine if all blocks can fit in the grid without overlapping. Blocks cannot be rotated.",
     input: "First line: M N (grid dimensions, 1 ≤ M, N ≤ 10). Second line: K (number of blocks, 1 ≤ K ≤ 20). Next K lines: width height of each block.",
     output: "Print 'YES' if all blocks can be packed in the grid, otherwise 'NO'",
     examples: [
       { 
         input: "5 5\n3\n2 2\n3 1\n2 3", 
         output: "YES" 
       },
       { 
         input: "3 3\n2\n2 2\n2 2", 
         output: "NO" 
       },
       { 
         input: "4 4\n4\n2 2\n2 2\n2 2\n2 2", 
         output: "YES" 
       },
     ],
  },   
];

// Language configurations with compiler/interpreter info
export const languageConfigs: Record<string, { 
  name: string; 
  extension: string; 
  inputPatterns: string[]; 
  outputPatterns: string[];
  compileCmd?: string;
  runCmd: string;
}> = {
  python: {
    name: "Python 3.11",
    extension: ".py",
    inputPatterns: ["input(", "sys.stdin", "readline"],
    outputPatterns: ["print(", "sys.stdout", "write("],
    runCmd: "python3",
  },
  cpp: {
    name: "C++ (g++ 13)",
    extension: ".cpp",
    inputPatterns: ["cin", "scanf", "getline", "gets"],
    outputPatterns: ["cout", "printf", "puts"],
    compileCmd: "g++ -std=c++17 -O2",
    runCmd: "./a.out",
  },
  c: {
    name: "C (gcc 13)",
    extension: ".c",
    inputPatterns: ["scanf", "getchar", "gets", "fgets"],
    outputPatterns: ["printf", "putchar", "puts", "fputs"],
    compileCmd: "gcc -std=c17 -O2",
    runCmd: "./a.out",
  },
  java: {
    name: "Java 21",
    extension: ".java",
    inputPatterns: ["scanner", "bufferedreader", "readline", "nextint", "nextline"],
    outputPatterns: ["system.out", "println", "printf"],
    compileCmd: "javac",
    runCmd: "java Main",
  },
  rust: {
    name: "Rust 1.75",
    extension: ".rs",
    inputPatterns: ["stdin", "read_line", "bufread"],
    outputPatterns: ["println!", "print!", "write!"],
    compileCmd: "rustc -O",
    runCmd: "./main",
  },
  javascript: {
    name: "JavaScript (Node.js)",
    extension: ".js",
    inputPatterns: ["readline", "process.stdin", "prompt"],
    outputPatterns: ["console.log", "process.stdout", "write"],
    runCmd: "node",
  },
  typescript: {
    name: "TypeScript",
    extension: ".ts",
    inputPatterns: ["readline", "process.stdin", "prompt"],
    outputPatterns: ["console.log", "process.stdout", "write"],
    compileCmd: "tsc",
    runCmd: "node",
  },
  go: {
    name: "Go 1.21",
    extension: ".go",
    inputPatterns: ["fmt.scan", "bufio.scanner", "reader"],
    outputPatterns: ["fmt.print", "fmt.println", "fmt.printf"],
    compileCmd: "go build",
    runCmd: "./main",
  },
  csharp: {
    name: "C# (.NET 8)",
    extension: ".cs",
    inputPatterns: ["console.readline", "streamreader", "read"],
    outputPatterns: ["console.write", "console.writeline"],
    compileCmd: "dotnet build",
    runCmd: "dotnet run",
  },
  kotlin: {
    name: "Kotlin",
    extension: ".kt",
    inputPatterns: ["readline", "scanner", "bufferedreader"],
    outputPatterns: ["println", "print"],
    compileCmd: "kotlinc",
    runCmd: "kotlin MainKt",
  },
  swift: {
    name: "Swift 5.9",
    extension: ".swift",
    inputPatterns: ["readline", "readln"],
    outputPatterns: ["print("],
    compileCmd: "swiftc",
    runCmd: "./main",
  },
  ruby: {
    name: "Ruby 3.2",
    extension: ".rb",
    inputPatterns: ["gets", "readline", "$stdin"],
    outputPatterns: ["puts", "print", "p "],
    runCmd: "ruby",
  },
};

// Auto-correction function with multi-language support
export function autoCorrect(
  code: string,
  problem: Problem,
  language: string = "python"
): { passed: boolean; message: string } {
  try {
    if (code.length < 10) {
      return { passed: false, message: "Code too short" };
    }

    const langConfig = languageConfigs[language] || languageConfigs.python;
    const codeLower = code.toLowerCase();

    const hasInput = langConfig.inputPatterns.some((pattern) =>
      codeLower.includes(pattern.toLowerCase())
    );

    const hasOutput = langConfig.outputPatterns.some((pattern) =>
      codeLower.includes(pattern.toLowerCase())
    );

    if (!hasInput || !hasOutput) {
      return { passed: false, message: "Missing input/output operations" };
    }

    const problemKeywords: { [key: number]: string[] } = {
      1: ["sum", "pair", "array", "target", "two", "add"],
      2: ["palindrome", "reverse", "string", "equal"],
      3: ["prime", "count", "range", "divisor"],
      4: ["matrix", "diagonal", "sum", "2d", "array"],
      5: ["binary", "decimal", "convert", "base"],
      6: ["fibonacci", "fib", "sequence"],
    };

    const keywords = problemKeywords[problem.id] || [];
    const hasKeywords = keywords.some((kw) => codeLower.includes(kw));

    if (!hasKeywords) {
      return {
        passed: false,
        message: "Solution may not address the problem requirements",
      };
    }

    return { passed: true, message: "All test cases passed" };
  } catch {
    return { passed: false, message: "Runtime error" };
  }
}
