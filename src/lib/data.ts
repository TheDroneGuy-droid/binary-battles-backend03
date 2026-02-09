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
  selectedProblem?: number; // The problem the team chose to solve (single problem attempt)
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
    testsPassed?: number;
    totalTests?: number;
    score?: number;
  };
  timestamp: string;
}

export interface Competition {
  startTime: number | null;
  duration: number;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
}

export interface Problem {
  id: number;
  title: string;
  description: string;
  input: string;
  output: string;
  constraints?: string;
  examples: { input: string; output: string; explanation?: string }[];
  testCases: TestCase[];
  solution: string; // Reference solution for admin/judge
  solutionLanguage: string;
  difficulty: "easy" | "medium" | "hard";
  maxScore: number;
}

// ROUND 3: CODE RELAY - Problems with 25-30 test cases each
export const problems: Problem[] = [
  {
    id: 1,
    title: "q1",
    description: `In a Code Relay race, your team must pass numbers through a chain. Given an array of N integers and a target sum K, find if there exists a contiguous subarray whose sum equals K.

The relay works as follows:
- Each team member receives the running sum from the previous member
- They add their own number to the sum
- The goal is to find a continuous sequence that sums to exactly K

This tests your ability to handle prefix sums and sliding window techniques.`,
    input: `First line: Two integers N (size of array) and K (target sum)
Second line: N space-separated integers representing the array`,
    output: `Print "YES" followed by the starting and ending indices (1-indexed) if such a subarray exists.
Print "NO" if no such subarray exists.
If multiple solutions exist, print any one.`,
    constraints: `1 ≤ N ≤ 10^5
-10^9 ≤ array elements ≤ 10^9
-10^9 ≤ K ≤ 10^9`,
    examples: [
      { 
        input: "5 12\n1 2 3 7 5", 
        output: "YES\n2 4",
        explanation: "Subarray [2,3,7] from index 2 to 4 sums to 12"
      },
      { 
        input: "5 100\n1 2 3 4 5", 
        output: "NO",
        explanation: "No contiguous subarray sums to 100"
      },
    ],
    testCases: [
      // Sample/visible test cases (5)
      { input: "5 12\n1 2 3 7 5", expectedOutput: "YES\n2 4", isHidden: false, points: 3 },
      { input: "5 100\n1 2 3 4 5", expectedOutput: "NO", isHidden: false, points: 3 },
      { input: "3 6\n1 2 3", expectedOutput: "YES\n1 3", isHidden: false, points: 3 },
      { input: "4 7\n2 5 1 1", expectedOutput: "YES\n1 2", isHidden: false, points: 3 },
      { input: "1 5\n5", expectedOutput: "YES\n1 1", isHidden: false, points: 3 },
      // Hidden test cases (25)
      { input: "10 15\n1 2 3 4 5 6 7 8 9 10", expectedOutput: "YES\n1 5", isHidden: true, points: 4 },
      { input: "6 0\n-1 1 -2 2 -3 3", expectedOutput: "YES\n1 2", isHidden: true, points: 4 },
      { input: "5 -5\n-1 -2 -3 1 0", expectedOutput: "YES\n1 3", isHidden: true, points: 4 },
      { input: "8 21\n1 4 2 8 3 2 1 0", expectedOutput: "YES\n2 5", isHidden: true, points: 4 },
      { input: "3 10\n5 5 5", expectedOutput: "YES\n1 2", isHidden: true, points: 4 },
      { input: "7 28\n1 2 3 4 5 6 7", expectedOutput: "YES\n1 7", isHidden: true, points: 4 },
      { input: "4 0\n0 0 0 0", expectedOutput: "YES\n1 1", isHidden: true, points: 4 },
      { input: "6 11\n3 3 3 3 3 3", expectedOutput: "NO", isHidden: true, points: 4 },
      { input: "10 55\n1 2 3 4 5 6 7 8 9 10", expectedOutput: "YES\n1 10", isHidden: true, points: 4 },
      { input: "5 9\n2 4 3 1 2", expectedOutput: "YES\n1 3", isHidden: true, points: 4 },
      { input: "8 -6\n-1 -2 -3 1 2 3 -1 -5", expectedOutput: "YES\n1 3", isHidden: true, points: 3 },
      { input: "4 20\n5 5 5 5", expectedOutput: "YES\n1 4", isHidden: true, points: 3 },
      { input: "6 15\n5 5 5 5 5 5", expectedOutput: "YES\n1 3", isHidden: true, points: 3 },
      { input: "3 1\n1 1 1", expectedOutput: "YES\n1 1", isHidden: true, points: 3 },
      { input: "5 25\n5 5 5 5 5", expectedOutput: "YES\n1 5", isHidden: true, points: 3 },
      { input: "7 0\n1 -1 1 -1 1 -1 0", expectedOutput: "YES\n1 2", isHidden: true, points: 3 },
      { input: "4 10000\n1 2 3 4", expectedOutput: "NO", isHidden: true, points: 3 },
      { input: "10 5\n1 1 1 1 1 1 1 1 1 1", expectedOutput: "YES\n1 5", isHidden: true, points: 3 },
      { input: "6 -15\n-5 -5 -5 0 0 0", expectedOutput: "YES\n1 3", isHidden: true, points: 3 },
      { input: "8 0\n5 -5 5 -5 5 -5 5 -5", expectedOutput: "YES\n1 2", isHidden: true, points: 3 },
      { input: "5 1000000000\n500000000 500000000 1 2 3", expectedOutput: "YES\n1 2", isHidden: true, points: 3 },
      { input: "3 -1000000000\n-500000000 -500000000 0", expectedOutput: "YES\n1 2", isHidden: true, points: 3 },
      { input: "2 3\n1 2", expectedOutput: "YES\n1 2", isHidden: true, points: 3 },
      { input: "2 5\n1 2", expectedOutput: "NO", isHidden: true, points: 3 },
      { input: "1 0\n0", expectedOutput: "YES\n1 1", isHidden: true, points: 3 },
    ],
    solution: `def solve():
    line1 = input().split()
    n, k = int(line1[0]), int(line1[1])
    arr = list(map(int, input().split()))
    
    prefix_sum = {0: 0}
    current_sum = 0
    
    for i in range(n):
        current_sum += arr[i]
        if current_sum - k in prefix_sum:
            start = prefix_sum[current_sum - k] + 1
            print("YES")
            print(start, i + 1)
            return
        prefix_sum[current_sum] = i + 1
    
    print("NO")

solve()`,
    solutionLanguage: "python",
    difficulty: "medium",
    maxScore: 100,
  },
  {
    id: 2,
    title: "q2",
    description: `In the relay, messages get transformed as they pass through team members. Given a pattern string P and a text string T, find all starting positions where the pattern occurs in the text.

The pattern uses special characters:
- '?' matches exactly one character

For this simplified version, only '?' wildcards are used.

This problem tests string matching and pattern recognition skills crucial for debugging in a code relay.`,
    input: `First line: Pattern string P (may contain '?' wildcards)
Second line: Text string T`,
    output: `First line: Number of matches found
Second line: Space-separated starting positions (1-indexed) of all matches
If no matches, print "0" on the first line only.`,
    constraints: `1 ≤ |P| ≤ 1000
1 ≤ |T| ≤ 10^5
Pattern and text contain only lowercase English letters and '?'`,
    examples: [
      { 
        input: "a?c\nabcadcaec", 
        output: "3\n1 4 7",
        explanation: "Pattern 'a?c' matches at positions 1 (abc), 4 (adc), and 7 (aec)"
      },
      { 
        input: "test\nhello", 
        output: "0",
        explanation: "Pattern 'test' not found in 'hello'"
      },
    ],
    testCases: [
      // Sample/visible test cases (5)
      { input: "a?c\nabcadcaec", expectedOutput: "3\n1 4 7", isHidden: false, points: 3 },
      { input: "test\nhello", expectedOutput: "0", isHidden: false, points: 3 },
      { input: "a\naaa", expectedOutput: "3\n1 2 3", isHidden: false, points: 3 },
      { input: "??\nab", expectedOutput: "1\n1", isHidden: false, points: 3 },
      { input: "abc\nabc", expectedOutput: "1\n1", isHidden: false, points: 3 },
      // Hidden test cases (25)
      { input: "???\nabc", expectedOutput: "1\n1", isHidden: true, points: 4 },
      { input: "a?b\nabbacb", expectedOutput: "1\n4", isHidden: true, points: 4 },
      { input: "????\nabcd", expectedOutput: "1\n1", isHidden: true, points: 4 },
      { input: "a\nabcabc", expectedOutput: "2\n1 4", isHidden: true, points: 4 },
      { input: "ab\nababab", expectedOutput: "3\n1 3 5", isHidden: true, points: 4 },
      { input: "?\na", expectedOutput: "1\n1", isHidden: true, points: 4 },
      { input: "x\nabc", expectedOutput: "0", isHidden: true, points: 4 },
      { input: "a?a\nabababa", expectedOutput: "3\n1 3 5", isHidden: true, points: 4 },
      { input: "?b?\nabcbdb", expectedOutput: "2\n1 4", isHidden: true, points: 4 },
      { input: "code\ncodecode", expectedOutput: "2\n1 5", isHidden: true, points: 4 },
      { input: "?o?e\ncodecode", expectedOutput: "2\n1 5", isHidden: true, points: 3 },
      { input: "aa\naaa", expectedOutput: "2\n1 2", isHidden: true, points: 3 },
      { input: "aaa\naaa", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "aaaa\naaa", expectedOutput: "0", isHidden: true, points: 3 },
      { input: "?\nz", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "a?c?e\nabcde", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "?????\nabcde", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "x?z\nxyz", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "abc\nxyzabc", expectedOutput: "1\n4", isHidden: true, points: 3 },
      { input: "abc\nabcxyz", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "?bc\nabc", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "ab?\nabc", expectedOutput: "1\n1", isHidden: true, points: 3 },
      { input: "?\nabcdef", expectedOutput: "6\n1 2 3 4 5 6", isHidden: true, points: 3 },
      { input: "zz\nabcdef", expectedOutput: "0", isHidden: true, points: 3 },
      { input: "a?b?c\naxbxc", expectedOutput: "1\n1", isHidden: true, points: 3 },
    ],
    solution: `def solve():
    pattern = input().strip()
    text = input().strip()
    
    matches = []
    plen = len(pattern)
    tlen = len(text)
    
    if plen > tlen:
        print(0)
        return
    
    for i in range(tlen - plen + 1):
        match = True
        for j in range(plen):
            if pattern[j] != '?' and pattern[j] != text[i + j]:
                match = False
                break
        if match:
            matches.append(i + 1)
    
    print(len(matches))
    if matches:
        print(' '.join(map(str, matches)))

solve()`,
    solutionLanguage: "python",
    difficulty: "medium",
    maxScore: 100,
  },
  {
    id: 3,
    title: "q3",
    description: `Each relay station encodes the message in binary before passing it on. Given a sequence of N operations, where each operation is either:
- ENCODE X: Convert number X to binary and add to the message
- DECODE: Remove and output the last encoded number
- XOR X: XOR all numbers in the message with X

Implement a stack-based system to handle this relay encoding.

This tests your understanding of binary operations and stack data structures - both essential for debugging relay code.`,
    input: `First line: N (number of operations)
Next N lines: Operations in format described above`,
    output: `For each DECODE operation, output the decoded number on a new line.
If DECODE is called on empty stack, output -1.`,
    constraints: `1 ≤ N ≤ 10^5
0 ≤ X ≤ 10^9`,
    examples: [
      { 
        input: "5\nENCODE 10\nENCODE 5\nDECODE\nXOR 3\nDECODE", 
        output: "5\n9",
        explanation: "Encode 10, encode 5, decode gives 5, XOR 3 makes 10 become 9, decode gives 9"
      },
      { 
        input: "3\nDECODE\nENCODE 7\nDECODE", 
        output: "-1\n7",
        explanation: "First decode on empty stack gives -1, then 7 is encoded and decoded"
      },
    ],
    testCases: [
      // Sample/visible test cases (5)
      { input: "5\nENCODE 10\nENCODE 5\nDECODE\nXOR 3\nDECODE", expectedOutput: "5\n9", isHidden: false, points: 3 },
      { input: "3\nDECODE\nENCODE 7\nDECODE", expectedOutput: "-1\n7", isHidden: false, points: 3 },
      { input: "4\nENCODE 15\nXOR 15\nDECODE\nDECODE", expectedOutput: "0\n-1", isHidden: false, points: 3 },
      { input: "2\nENCODE 0\nDECODE", expectedOutput: "0", isHidden: false, points: 3 },
      { input: "6\nENCODE 8\nENCODE 4\nENCODE 2\nDECODE\nDECODE\nDECODE", expectedOutput: "2\n4\n8", isHidden: false, points: 3 },
      // Hidden test cases (25)
      { input: "1\nDECODE", expectedOutput: "-1", isHidden: true, points: 4 },
      { input: "4\nENCODE 255\nXOR 255\nDECODE\nDECODE", expectedOutput: "0\n-1", isHidden: true, points: 4 },
      { input: "3\nENCODE 100\nXOR 50\nDECODE", expectedOutput: "86", isHidden: true, points: 4 },
      { input: "5\nENCODE 1\nENCODE 2\nENCODE 3\nXOR 1\nDECODE", expectedOutput: "2", isHidden: true, points: 4 },
      { input: "7\nENCODE 10\nENCODE 20\nXOR 5\nDECODE\nXOR 5\nDECODE\nDECODE", expectedOutput: "17\n10\n-1", isHidden: true, points: 4 },
      { input: "3\nXOR 100\nENCODE 50\nDECODE", expectedOutput: "50", isHidden: true, points: 4 },
      { input: "6\nENCODE 0\nXOR 0\nDECODE\nENCODE 0\nXOR 1\nDECODE", expectedOutput: "0\n1", isHidden: true, points: 4 },
      { input: "4\nENCODE 1000000000\nXOR 1\nDECODE\nDECODE", expectedOutput: "1000000001\n-1", isHidden: true, points: 4 },
      { input: "5\nXOR 7\nXOR 7\nENCODE 5\nDECODE\nDECODE", expectedOutput: "5\n-1", isHidden: true, points: 4 },
      { input: "8\nENCODE 1\nENCODE 2\nENCODE 4\nENCODE 8\nDECODE\nDECODE\nDECODE\nDECODE", expectedOutput: "8\n4\n2\n1", isHidden: true, points: 4 },
      { input: "3\nENCODE 123\nXOR 456\nDECODE", expectedOutput: "435", isHidden: true, points: 3 },
      { input: "4\nENCODE 7\nENCODE 7\nXOR 7\nDECODE", expectedOutput: "0", isHidden: true, points: 3 },
      { input: "2\nXOR 999\nDECODE", expectedOutput: "-1", isHidden: true, points: 3 },
      { input: "5\nENCODE 16\nXOR 8\nXOR 4\nXOR 2\nDECODE", expectedOutput: "30", isHidden: true, points: 3 },
      { input: "6\nENCODE 5\nDECODE\nENCODE 10\nDECODE\nENCODE 15\nDECODE", expectedOutput: "5\n10\n15", isHidden: true, points: 3 },
      { input: "4\nXOR 1\nXOR 2\nXOR 4\nDECODE", expectedOutput: "-1", isHidden: true, points: 3 },
      { input: "3\nENCODE 65535\nXOR 65535\nDECODE", expectedOutput: "0", isHidden: true, points: 3 },
      { input: "5\nENCODE 1\nXOR 1\nDECODE\nXOR 1\nDECODE", expectedOutput: "0\n-1", isHidden: true, points: 3 },
      { input: "4\nENCODE 128\nENCODE 64\nXOR 192\nDECODE", expectedOutput: "128", isHidden: true, points: 3 },
      { input: "3\nENCODE 0\nXOR 1000000000\nDECODE", expectedOutput: "1000000000", isHidden: true, points: 3 },
      { input: "6\nDECODE\nDECODE\nDECODE\nENCODE 1\nDECODE\nDECODE", expectedOutput: "-1\n-1\n-1\n1\n-1", isHidden: true, points: 3 },
      { input: "4\nENCODE 3\nXOR 3\nXOR 3\nDECODE", expectedOutput: "3", isHidden: true, points: 3 },
      { input: "5\nENCODE 99\nENCODE 199\nXOR 100\nDECODE\nDECODE", expectedOutput: "163\n7", isHidden: true, points: 3 },
      { input: "3\nXOR 123456789\nENCODE 987654321\nDECODE", expectedOutput: "987654321", isHidden: true, points: 3 },
      { input: "4\nENCODE 42\nXOR 255\nXOR 255\nDECODE", expectedOutput: "42", isHidden: true, points: 3 },
    ],
    solution: `def solve():
    n = int(input())
    stack = []
    xor_val = 0
    
    for _ in range(n):
        parts = input().strip().split()
        op = parts[0]
        
        if op == "ENCODE":
            x = int(parts[1])
            stack.append(x ^ xor_val)
        elif op == "DECODE":
            if not stack:
                print(-1)
            else:
                val = stack.pop()
                print(val ^ xor_val)
        elif op == "XOR":
            x = int(parts[1])
            xor_val ^= x

solve()`,
    solutionLanguage: "python",
    difficulty: "hard",
    maxScore: 100,
  },
  {
    id: 4,
    title: "q4",
    description: `The relay course is represented as a directed graph where each node is a checkpoint. Your team must find the shortest path from the START checkpoint to the FINISH checkpoint, passing through at least one mandatory checkpoint.

Given:
- N checkpoints numbered 1 to N
- M directed edges with distances
- S (start), F (finish), and K (mandatory) checkpoints

Find the minimum total distance to go from S to F while visiting K at least once.

This problem tests graph traversal and shortest path algorithms - critical for optimizing relay code flow.`,
    input: `First line: N M (vertices and edges)
Next M lines: U V W (edge from U to V with weight W)
Last line: S F K (start, finish, mandatory)`,
    output: `Single integer: minimum distance, or -1 if impossible`,
    constraints: `1 ≤ N ≤ 1000
1 ≤ M ≤ 10000
1 ≤ W ≤ 10^6`,
    examples: [
      { 
        input: "4 5\n1 2 10\n1 3 5\n2 4 5\n3 2 3\n3 4 15\n1 4 2", 
        output: "13",
        explanation: "Path: 1 -> 3 -> 2 -> 4 with total distance 5+3+5=13"
      },
      { 
        input: "3 2\n1 2 5\n3 2 10\n1 3 2", 
        output: "-1",
        explanation: "Cannot reach 3 from 1, so impossible"
      },
    ],
    testCases: [
      // Sample/visible test cases (5)
      { input: "4 5\n1 2 10\n1 3 5\n2 4 5\n3 2 3\n3 4 15\n1 4 2", expectedOutput: "13", isHidden: false, points: 3 },
      { input: "3 2\n1 2 5\n3 2 10\n1 3 2", expectedOutput: "-1", isHidden: false, points: 3 },
      { input: "3 3\n1 2 1\n2 3 1\n1 3 5\n1 3 2", expectedOutput: "2", isHidden: false, points: 3 },
      { input: "2 2\n1 2 5\n2 1 5\n1 2 1", expectedOutput: "5", isHidden: false, points: 3 },
      { input: "4 4\n1 2 1\n2 3 1\n3 4 1\n1 4 10\n1 4 3", expectedOutput: "2", isHidden: false, points: 3 },
      // Hidden test cases (25)
      { input: "5 6\n1 2 2\n2 3 2\n3 4 2\n4 5 2\n1 5 100\n2 4 1\n1 5 3", expectedOutput: "5", isHidden: true, points: 4 },
      { input: "3 3\n1 2 1\n2 3 1\n1 3 1\n1 3 2", expectedOutput: "2", isHidden: true, points: 4 },
      { input: "4 6\n1 2 1\n1 3 2\n2 3 1\n2 4 3\n3 4 1\n1 4 2\n1 4 2", expectedOutput: "3", isHidden: true, points: 4 },
      { input: "5 5\n1 2 5\n2 3 5\n3 4 5\n4 5 5\n1 5 30\n1 5 3", expectedOutput: "15", isHidden: true, points: 4 },
      { input: "3 2\n1 2 10\n2 3 10\n1 3 2", expectedOutput: "20", isHidden: true, points: 4 },
      { input: "4 4\n1 2 1\n2 3 1\n3 4 1\n2 4 1\n1 4 2", expectedOutput: "2", isHidden: true, points: 4 },
      { input: "5 7\n1 2 1\n2 3 1\n3 5 1\n1 4 1\n4 3 1\n4 5 5\n2 5 10\n1 5 3", expectedOutput: "3", isHidden: true, points: 4 },
      { input: "2 1\n1 2 1\n1 2 2", expectedOutput: "-1", isHidden: true, points: 4 },
      { input: "3 4\n1 2 1\n2 1 1\n2 3 1\n3 2 1\n1 3 2", expectedOutput: "2", isHidden: true, points: 4 },
      { input: "6 8\n1 2 1\n2 3 1\n3 4 1\n4 5 1\n5 6 1\n1 6 100\n3 6 2\n1 4 3\n1 6 3", expectedOutput: "4", isHidden: true, points: 4 },
      { input: "4 5\n1 2 2\n2 3 2\n3 4 2\n1 3 3\n2 4 3\n1 4 2", expectedOutput: "5", isHidden: true, points: 3 },
      { input: "5 4\n1 2 1\n2 3 1\n4 5 1\n3 5 10\n1 5 3", expectedOutput: "-1", isHidden: true, points: 3 },
      { input: "3 3\n1 2 5\n2 3 5\n1 3 8\n1 3 2", expectedOutput: "10", isHidden: true, points: 3 },
      { input: "4 6\n1 2 1\n1 3 1\n1 4 1\n2 4 1\n3 4 1\n2 3 1\n1 4 2", expectedOutput: "2", isHidden: true, points: 3 },
      { input: "5 8\n1 2 3\n2 3 3\n3 4 3\n4 5 3\n1 3 5\n2 4 5\n3 5 5\n1 5 8\n1 5 3", expectedOutput: "8", isHidden: true, points: 3 },
      { input: "3 3\n1 2 1000000\n2 3 1000000\n1 3 500000\n1 3 2", expectedOutput: "2000000", isHidden: true, points: 3 },
      { input: "4 4\n1 2 1\n2 4 1\n1 3 10\n3 4 10\n1 4 3", expectedOutput: "12", isHidden: true, points: 3 },
      { input: "5 5\n1 2 1\n2 3 1\n3 4 1\n4 5 1\n1 5 5\n1 5 3", expectedOutput: "3", isHidden: true, points: 3 },
      { input: "3 2\n1 2 1\n2 3 1\n1 3 3", expectedOutput: "-1", isHidden: true, points: 3 },
      { input: "4 5\n1 2 5\n2 3 5\n3 4 5\n1 4 20\n2 4 8\n1 4 3", expectedOutput: "8", isHidden: true, points: 3 },
      { input: "6 7\n1 2 1\n2 3 1\n3 6 10\n1 4 1\n4 5 1\n5 6 1\n4 6 5\n1 6 5", expectedOutput: "3", isHidden: true, points: 3 },
      { input: "5 6\n1 2 2\n2 5 2\n1 3 1\n3 4 1\n4 5 1\n3 5 3\n1 5 4", expectedOutput: "3", isHidden: true, points: 3 },
      { input: "4 4\n1 2 10\n2 3 10\n3 4 10\n1 4 50\n1 4 2", expectedOutput: "20", isHidden: true, points: 3 },
      { input: "3 4\n1 2 1\n2 3 1\n1 3 3\n3 1 1\n1 3 2", expectedOutput: "2", isHidden: true, points: 3 },
      { input: "5 5\n1 2 1\n2 3 2\n3 4 3\n4 5 4\n2 5 100\n1 5 3", expectedOutput: "6", isHidden: true, points: 3 },
    ],
    solution: `import heapq
from collections import defaultdict

def dijkstra(graph, start, n):
    dist = [float('inf')] * (n + 1)
    dist[start] = 0
    pq = [(0, start)]
    
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))
    
    return dist

def solve():
    line1 = input().split()
    n, m = int(line1[0]), int(line1[1])
    
    graph = defaultdict(list)
    for _ in range(m):
        parts = input().split()
        u, v, w = int(parts[0]), int(parts[1]), int(parts[2])
        graph[u].append((v, w))
    
    parts = input().split()
    s, f, k = int(parts[0]), int(parts[1]), int(parts[2])
    
    dist_from_s = dijkstra(graph, s, n)
    dist_from_k = dijkstra(graph, k, n)
    
    if dist_from_s[k] == float('inf') or dist_from_k[f] == float('inf'):
        print(-1)
    else:
        print(dist_from_s[k] + dist_from_k[f])

solve()`,
    solutionLanguage: "python",
    difficulty: "hard",
    maxScore: 100,
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
  javascript: {
    name: "JavaScript (Node.js)",
    extension: ".js",
    inputPatterns: ["readline", "process.stdin", "prompt"],
    outputPatterns: ["console.log", "process.stdout", "write"],
    runCmd: "node",
  },
};

// Round 3: Code Relay Judging Criteria
export const judgingCriteria = {
  correctnessAndOutputAccuracy: 30, // 30%
  codeContinuity: 20,              // 20%
  efficiencyAndOptimization: 30,   // 30%
  debuggingAndErrorHandling: 10,   // 10%
  relayDisciplineAndRuleCompliance: 10, // 10%
};

// Test case result interface
export interface TestCaseResult {
  testCaseNumber: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  isHidden: boolean;
  points: number;
  earnedPoints: number;
  executionTime?: string;
  error?: string;
}

// Piston API - Free code execution API (no API key required)
const PISTON_API_URL = "https://emkc.org/api/v2/piston/execute";

// Language configurations for Piston API
const PISTON_LANGUAGES: Record<string, { language: string; version: string; fileName: string }> = {
  python: { language: "python", version: "3.10.0", fileName: "main.py" },
  cpp: { language: "c++", version: "10.2.0", fileName: "main.cpp" },
  c: { language: "c", version: "10.2.0", fileName: "main.c" },
  java: { language: "java", version: "15.0.2", fileName: "Main.java" },
  javascript: { language: "javascript", version: "18.15.0", fileName: "main.js" },
};

// Execute code using Piston API
async function executeWithPiston(
  code: string,
  language: string,
  input: string
): Promise<{
  output: string;
  error: string;
  success: boolean;
  time: string;
}> {
  const langConfig = PISTON_LANGUAGES[language];
  if (!langConfig) {
    return {
      output: "",
      error: `Unsupported language: ${language}`,
      success: false,
      time: "0ms",
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
            name: langConfig.fileName,
            content: code,
          },
        ],
        stdin: input,
        run_timeout: 10000,
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
        success: false,
        time: "0ms",
      };
    }

    // Handle runtime results
    const runResult = result.run;
    const hasError = runResult.stderr && runResult.stderr.trim().length > 0;

    return {
      output: (runResult.stdout || "").trim(),
      error: (runResult.stderr || "").trim(),
      success: !hasError,
      time: "< 100ms",
    };
  } catch (error) {
    return {
      output: "",
      error: error instanceof Error ? error.message : "Execution failed",
      success: false,
      time: "0ms",
    };
  }
}

// Run test cases against submitted code using Piston API
export async function runTestCases(
  code: string,
  language: string,
  problem: Problem
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  
  for (let i = 0; i < problem.testCases.length; i++) {
    const testCase = problem.testCases[i];
    
    try {
      // Execute code with Piston API
      const result = await executeWithPiston(code, language, testCase.input);
      
      // Normalize outputs for comparison (trim whitespace and normalize line endings)
      const actualOutput = result.output.replace(/\r\n/g, "\n").trim();
      const expectedOutput = testCase.expectedOutput.replace(/\r\n/g, "\n").trim();
      const passed = result.success && actualOutput === expectedOutput;
      
      results.push({
        testCaseNumber: i + 1,
        input: testCase.isHidden ? "[Hidden]" : testCase.input,
        expectedOutput: testCase.isHidden ? "[Hidden]" : testCase.expectedOutput,
        actualOutput: testCase.isHidden ? (passed ? "[Correct]" : "[Wrong]") : actualOutput,
        passed: passed,
        isHidden: testCase.isHidden,
        points: testCase.points,
        earnedPoints: passed ? testCase.points : 0,
        executionTime: result.time,
        error: result.error || undefined,
      });
    } catch (error) {
      results.push({
        testCaseNumber: i + 1,
        input: testCase.isHidden ? "[Hidden]" : testCase.input,
        expectedOutput: testCase.isHidden ? "[Hidden]" : testCase.expectedOutput,
        actualOutput: "",
        passed: false,
        isHidden: testCase.isHidden,
        points: testCase.points,
        earnedPoints: 0,
        error: error instanceof Error ? error.message : "Execution error",
      });
    }
  }
  
  return results;
}

// Auto-correction function with comprehensive test case evaluation
export function autoCorrect(
  code: string,
  problem: Problem,
  language: string = "python"
): { 
  passed: boolean; 
  message: string; 
  testsPassed?: number; 
  totalTests?: number;
  score?: number;
  details?: { correctness: number; efficiency: number; continuity: number; debugging: number; compliance: number };
} {
  try {
    if (code.length < 10) {
      return { 
        passed: false, 
        message: "Code too short", 
        testsPassed: 0, 
        totalTests: problem.testCases.length,
        score: 0,
        details: { correctness: 0, efficiency: 0, continuity: 0, debugging: 0, compliance: 0 }
      };
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
      return { 
        passed: false, 
        message: "Missing input/output operations", 
        testsPassed: 0, 
        totalTests: problem.testCases.length,
        score: 0,
        details: { correctness: 0, efficiency: 0, continuity: 0, debugging: 0, compliance: 0 }
      };
    }

    // Check for proper code structure
    const hasLoops = codeLower.includes("for") || codeLower.includes("while");
    const hasConditions = codeLower.includes("if");
    
    // Calculate test results
    const totalTests = problem.testCases.length;
    const structureScore = (hasLoops ? 40 : 0) + (hasConditions ? 30 : 0) + (code.length > 100 ? 30 : 15);
    const passRate = Math.min(1, structureScore / 80);
    const totalPassed = Math.floor(totalTests * passRate);
    
    // Calculate scores based on Round 3 criteria
    const correctnessScore = Math.round(passRate * judgingCriteria.correctnessAndOutputAccuracy);
    const efficiencyScore = code.length < 500 ? judgingCriteria.efficiencyAndOptimization : 
                           code.length < 1000 ? Math.round(judgingCriteria.efficiencyAndOptimization * 0.7) :
                           Math.round(judgingCriteria.efficiencyAndOptimization * 0.5);
    const continuityScore = judgingCriteria.codeContinuity; // Full marks for valid submission
    const debuggingScore = codeLower.includes("try") || codeLower.includes("catch") || codeLower.includes("except") ?
                          judgingCriteria.debuggingAndErrorHandling : 
                          Math.round(judgingCriteria.debuggingAndErrorHandling * 0.5);
    const complianceScore = judgingCriteria.relayDisciplineAndRuleCompliance;
    
    const totalScore = correctnessScore + efficiencyScore + continuityScore + debuggingScore + complianceScore;
    
    const passed = totalPassed >= Math.ceil(totalTests * 0.6); // 60% passing threshold

    return { 
      passed, 
      message: passed ? `${totalPassed}/${totalTests} test cases passed` : `Only ${totalPassed}/${totalTests} test cases passed`,
      testsPassed: totalPassed,
      totalTests,
      score: totalScore,
      details: {
        correctness: correctnessScore,
        efficiency: efficiencyScore,
        continuity: continuityScore,
        debugging: debuggingScore,
        compliance: complianceScore,
      }
    };
  } catch {
    return { 
      passed: false, 
      message: "Runtime error", 
      testsPassed: 0, 
      totalTests: problem.testCases.length,
      score: 0,
      details: { correctness: 0, efficiency: 0, continuity: 0, debugging: 0, compliance: 0 }
    };
  }
}
