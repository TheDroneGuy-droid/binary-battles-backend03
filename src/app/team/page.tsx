"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Problem {
  id: number;
  title: string;
  description: string;
  input: string;
  output: string;
  constraints?: string;
  examples: { input: string; output: string; explanation?: string }[];
  testCases?: TestCase[];
  difficulty?: string;
}

interface TeamData {
  score: number;
  solved: number[];
  selectedProblem?: number;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  solved: number;
}

interface SubmissionResult {
  problemId: number;
  passed: boolean;
  message: string;
  testsPassed?: number;
  totalTests?: number;
  score?: number;
}

interface CompetitionState {
  startTime: number | null;
  duration: number;
}

interface CompileResult {
  success: boolean;
  output?: string;
  error?: string;
  status?: string;
  time?: string;
  memory?: string;
  input?: string;
  expectedOutput?: string;
}

interface TestCaseResult {
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

export default function TeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [teamData, setTeamData] = useState<TeamData>({
    score: 0,
    solved: [],
    selectedProblem: undefined,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [competition, setCompetition] = useState<CompetitionState>({
    startTime: null,
    duration: 120,
  });
  const [timer, setTimer] = useState("Not Started");
  const [timerClass, setTimerClass] = useState("");
  const [codes, setCodes] = useState<{ [key: number]: string }>({});
  const [languages, setLanguages] = useState<{ [key: number]: string }>({});
  const [submitting, setSubmitting] = useState<{ [key: number]: boolean }>({});
  const [compiling, setCompiling] = useState(false);
  const [results, setResults] = useState<{ [key: number]: SubmissionResult }>({});
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<number | null>(null);
  const [competitionActive, setCompetitionActive] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState("");
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);

  const [showCompiler, setShowCompiler] = useState(false);
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [runningTests, setRunningTests] = useState(false);
  const [problemLocked, setProblemLocked] = useState(false);
  
  // Anti-cheat states
  const [tabViolations, setTabViolations] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  
  const tabViolationsRef = useRef(0);
  const competitionActiveRef = useRef(false);
  const hasRedirected = useRef(false);

  // Fetch team data
  const fetchData = useCallback(async () => {
    if (hasRedirected.current) return;
    
    try {
      const res = await fetch("/api/team", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!data.success) {
        if (hasRedirected.current) return;
        
        if (data.reason === "team_banned") {
          setIsBanned(true);
          setBanMessage(data.message || "Your team has been banned. Please contact the POC.");
          setLoading(false);
          return;
        }
        
        hasRedirected.current = true;
        
        if (data.reason === "is_admin") {
          router.replace("/admin");
        } else {
          router.replace("/");
        }
        return;
      }
      
      // Clear ban state if previously banned but now unbanned
      setIsBanned(false);
      setBanMessage("");

      setTeamName(data.teamName);
      setProblems(data.problems);
      setTeamData(data.teamData);
      setLeaderboard(data.leaderboard);
      
      // Check if team has already selected a problem (single problem attempt)
      if (data.teamData.selectedProblem) {
        setSelectedProblem(data.teamData.selectedProblem);
        setProblemLocked(true);
      } else {
        // Only set default problem on first load
        setSelectedProblem(prev => prev === null && data.problems.length > 0 ? data.problems[0].id : prev);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Fetch competition status
  const fetchCompetition = useCallback(async () => {
    try {
      const res = await fetch("/api/competition", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      setCompetition(data);
      
      const isActive = data.startTime !== null;
      setCompetitionActive(isActive);
      competitionActiveRef.current = isActive;
      
      if (isActive) {
        const now = Date.now();
        const elapsed = Math.floor((now - data.startTime) / 1000);
        const total = data.duration * 60;
        const remaining = Math.max(0, total - elapsed);

        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        setTimer(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );

        if (remaining <= 60) {
          setTimerClass("danger");
        } else if (remaining <= 300) {
          setTimerClass("warning");
        } else {
          setTimerClass("");
        }

        if (remaining === 0) {
          setCompetitionActive(false);
          competitionActiveRef.current = false;
        }
      } else {
        setTimer("Not Started");
        setTimerClass("");
      }
    } catch (error) {
      console.error("Competition fetch error:", error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    fetchCompetition();
    const dataInterval = setInterval(fetchData, 10000); // Reduced frequency to prevent session issues
    const timerInterval = setInterval(fetchCompetition, 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(timerInterval);
    };
  }, [fetchData, fetchCompetition]);

  // Report violation to server
  const reportViolation = async (violationType: string, details: string = "") => {
    try {
      await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationType, details }),
        credentials: "include",
      });
    } catch (error) {
      console.error("Failed to report violation:", error);
    }
  };

  // Tab visibility detection (anti-cheat)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && competitionActiveRef.current) {
        tabViolationsRef.current += 1;
        setTabViolations(tabViolationsRef.current);
        setShowTabWarning(true);
        reportViolation("TAB_SWITCH", `Switched away from tab (violation #${tabViolationsRef.current})`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Prevent right-click during competition
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (competitionActiveRef.current) {
        e.preventDefault();
        reportViolation("RIGHT_CLICK", "Attempted to open context menu");
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Compile code without submitting
  const handleCompile = async () => {
    if (!selectedProblem) return;
    
    setCompiling(true);
    setCompileResult(null);
    
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codes[selectedProblem] || "",
          language: languages[selectedProblem] || "python",
          problemId: selectedProblem,
        }),
        credentials: "include",
      });

      const data = await res.json();
      setCompileResult(data);
    } catch (error) {
      console.error("Compile error:", error);
      setCompileResult({
        success: false,
        error: "Failed to compile code. Please try again.",
        status: "Error",
      });
    } finally {
      setCompiling(false);
    }
  };

  // Run test cases against code
  const handleRunTests = async () => {
    if (!selectedProblem) return;
    
    setRunningTests(true);
    setTestResults([]);
    
    try {
      const res = await fetch("/api/run-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codes[selectedProblem] || "",
          language: languages[selectedProblem] || "python",
          problemId: selectedProblem,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setTestResults(data.results);
      }
    } catch (error) {
      console.error("Test run error:", error);
    } finally {
      setRunningTests(false);
    }
  };

  // Lock problem selection when first submission is made
  const handleSelectProblem = async (problemId: number) => {
    if (problemLocked) {
      // Can't change problem once locked
      return;
    }
    setSelectedProblem(problemId);
  };

  const handleSubmit = async (problemId: number) => {
    setSubmitting((prev) => ({ ...prev, [problemId]: true }));

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          code: codes[problemId] || "",
          language: languages[problemId] || "python",
          lockProblem: !problemLocked, // Lock problem on first submission
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setResults((prev) => ({
          ...prev,
          [problemId]: {
            problemId,
            passed: data.result.passed,
            message: data.result.message,
            testsPassed: data.result.testsPassed,
            totalTests: data.result.totalTests,
            score: data.result.score,
          },
        }));
        
        // Lock problem after first submission
        if (!problemLocked) {
          setProblemLocked(true);
        }
        
        fetchData();
      }
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setSubmitting((prev) => ({ ...prev, [problemId]: false }));
    }
  };

  const currentProblem = problems.find((p) => p.id === selectedProblem) || problems[0];

  if (loading) {
    return (
      <div className="loading">
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Banned Overlay */}
      {isBanned && (
        <div className="banned-overlay">
          <div className="banned-content">
            <div className="banned-icon">🚫</div>
            <h2>Team Banned</h2>
            <p>{banMessage}</p>
            <p style={{ marginTop: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
              If you believe this is an error, please contact the Point of Contact (POC) immediately.
            </p>
            <Link href="/api/auth/logout" className="btn" style={{ marginTop: "24px", maxWidth: "200px", display: "inline-block", textDecoration: "none" }}>
              Logout
            </Link>
          </div>
        </div>
      )}

      {/* Tab Switch Warning Overlay */}
      {showTabWarning && (
        <div className="tab-warning">
          <h2>⚠️ Tab Switch Detected!</h2>
          <p>Switching tabs or windows during the competition is not allowed.</p>
          <p>Your violation has been recorded.</p>
          <div className="violation-count">{tabViolations}</div>
          <p>Total violations</p>
          <button
            className="btn"
            style={{ marginTop: "20px", maxWidth: "200px" }}
            onClick={() => setShowTabWarning(false)}
          >
            Continue
          </button>
        </div>
      )}

      {/* Competition Not Started Overlay */}
      {!competitionActive && (
        <div className="not-started-overlay">
          <div className="not-started-content">
            <div className="not-started-icon">⏳</div>
            <h2>Competition Not Started</h2>
            <p>
              Please wait for the admin to start the competition.
              The problems will be revealed once the timer begins.
            </p>
            <p style={{ marginTop: "20px", color: "var(--text-muted)" }}>
              Team: {teamName}
            </p>
          </div>
        </div>
      )}

      <Link href="/api/auth/logout" className="logout-btn">
        Logout
      </Link>
      <div className={`timer ${timerClass}`}>{timer}</div>

      <div className="container">
        <div className="header">
          <div 
            style={{
              width: 80,
              height: 80,
              background: "linear-gradient(135deg, #00d9ff, #ff6347)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            BB
          </div>
          <h1>Binary Battles 3.0</h1>
          <p>Team: {teamName} | Score: {teamData.score} pts</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Round 3: Code Relay
          </p>
        </div>

        {/* Problem Status Overview */}
        <div className="problem-status">
          <h3>Problems:</h3>
          {problems.map((p) => {
            const isSolved = teamData.solved?.includes(p.id);
            const isSelected = selectedProblem === p.id;
            const isLocked = problemLocked && !isSelected;
            const statusClass = isSolved ? "solved" : isLocked ? "locked" : "";
            return (
              <div
                key={p.id}
                className={`status-indicator ${statusClass} ${isSelected ? "active" : ""}`}
                onClick={() => !isLocked && handleSelectProblem(p.id)}
                title={isLocked ? "Problem locked - You can only attempt one problem" : `Problem ${p.id}: ${p.title}`}
                style={{ 
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                {isSolved ? "✓" : isLocked ? "🔒" : p.id}
              </div>
            );
          })}
        </div>

        {/* Problems Container */}
        <div className="problems-container">
          {/* Sidebar - Problem List */}
          <div className="problems-sidebar">
            {problems.map((problem) => {
              const isSolved = teamData.solved?.includes(problem.id);
              const isSelected = selectedProblem === problem.id;
              const isLocked = problemLocked && !isSelected;
              
              return (
                <div
                  key={problem.id}
                  className={`problem-list-item ${isSelected ? "active" : ""}`}
                  onClick={() => !isLocked && handleSelectProblem(problem.id)}
                  style={{ 
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  <span className={`problem-number ${isSolved ? "solved" : ""}`}>
                    {isSolved ? "✓" : isLocked ? "🔒" : problem.id}
                  </span>
                  <span className="problem-title">{problem.title}</span>
                </div>
              );
            })}
          </div>

          {/* Main - Problem Detail & Editor */}
          <div className="problem-detail">
            {currentProblem && (
              <>
                <div className="problem-description">
                  <h2>Problem {currentProblem.id}: {currentProblem.title}</h2>
                  
                  <p className="description" style={{ whiteSpace: "pre-wrap" }}>
                    {currentProblem.description}
                  </p>
                  
                  {currentProblem.constraints && (
                    <>
                      <div className="section-title">Constraints</div>
                      <pre style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px" }}>
                        {currentProblem.constraints}
                      </pre>
                    </>
                  )}
                  
                  <div className="section-title">Input Format</div>
                  <pre>{currentProblem.input}</pre>
                  
                  <div className="section-title">Output Format</div>
                  <pre>{currentProblem.output}</pre>
                  
                  <div className="section-title">Examples</div>
                  {currentProblem.examples.map((ex, idx) => (
                    <div key={idx} className="example-box">
                      <div className="example-label">Example {idx + 1}</div>
                      <pre>Input:{"\n"}{ex.input}{"\n\n"}Output:{"\n"}{ex.output}</pre>
                      {ex.explanation && (
                        <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                          <strong>Explanation:</strong> {ex.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="code-editor-container">
                  <div className="code-editor-header">
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>Code Editor</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        className="language-select"
                        value={languages[currentProblem.id] || "python"}
                        onChange={(e) =>
                          setLanguages((prev) => ({
                            ...prev,
                            [currentProblem.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="python">Python</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                        <option value="c">C</option>
                        <option value="javascript">JavaScript</option>
                      </select>
                      <button
                        className="btn btn-small"
                        onClick={() => setShowCompiler(!showCompiler)}
                        style={{ 
                          background: showCompiler ? "var(--accent-primary)" : "transparent",
                          border: "1px solid var(--accent-primary)",
                        }}
                      >
                        {showCompiler ? "Hide Compiler" : "Show Compiler"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="code-editor">
                    <textarea
                      value={codes[currentProblem.id] || ""}
                      onChange={(e) =>
                        setCodes((prev) => ({
                          ...prev,
                          [currentProblem.id]: e.target.value,
                        }))
                      }
                      placeholder="Write your solution here..."
                      spellCheck={false}
                    />
                  </div>

                  {/* Compiler Section */}
                  {showCompiler && (
                    <div className="compiler-section" style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "16px",
                      marginTop: "12px",
                    }}>
                      <h4 style={{ marginBottom: "12px" }}>🖥️ Compiler & Test Runner</h4>
                      
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        <button
                          className="btn btn-small"
                          onClick={handleCompile}
                          disabled={compiling}
                          style={{ background: "var(--accent-success)" }}
                        >
                          {compiling ? "Compiling..." : "▶ Run Code"}
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={handleRunTests}
                          disabled={runningTests}
                          style={{ background: "var(--accent-warning)" }}
                        >
                          {runningTests ? "Running..." : "🧪 Run Test Cases"}
                        </button>
                      </div>

                      {/* Compile Result */}
                      {compileResult && (
                        <div style={{
                          background: compileResult.error ? "rgba(244, 67, 54, 0.1)" : "rgba(76, 175, 80, 0.1)",
                          border: `1px solid ${compileResult.error ? "rgba(244, 67, 54, 0.5)" : "rgba(76, 175, 80, 0.5)"}`,
                          borderRadius: "6px",
                          padding: "12px",
                          marginBottom: "12px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                            <span style={{ fontWeight: 600 }}>Compile & Run Result</span>
                            <span style={{ 
                              color: compileResult.error ? "#f44336" : "#4caf50",
                              fontWeight: 600,
                            }}>
                              {compileResult.status || (compileResult.success ? "Success" : "Error")}
                            </span>
                          </div>
                          
                          {compileResult.error ? (
                            <pre style={{ 
                              color: "#f44336",
                              whiteSpace: "pre-wrap",
                              fontSize: "13px",
                              background: "rgba(0,0,0,0.2)",
                              padding: "8px",
                              borderRadius: "4px",
                            }}>
                              {compileResult.error}
                            </pre>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px" }}>
                              <div>
                                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Input (Test Case 1):</div>
                                <pre style={{ 
                                  background: "rgba(0,0,0,0.3)", 
                                  padding: "6px", 
                                  borderRadius: "4px",
                                  margin: 0,
                                  whiteSpace: "pre-wrap",
                                  maxHeight: "80px",
                                  overflow: "auto",
                                }}>
                                  {compileResult.input || "No input"}
                                </pre>
                              </div>
                              <div>
                                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Expected Output:</div>
                                <pre style={{ 
                                  background: "rgba(0,0,0,0.3)", 
                                  padding: "6px", 
                                  borderRadius: "4px",
                                  margin: 0,
                                  whiteSpace: "pre-wrap",
                                  maxHeight: "80px",
                                  overflow: "auto",
                                }}>
                                  {compileResult.expectedOutput || "N/A"}
                                </pre>
                              </div>
                              <div>
                                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Your Output:</div>
                                <pre style={{ 
                                  background: "rgba(0,0,0,0.3)", 
                                  padding: "6px", 
                                  borderRadius: "4px",
                                  margin: 0,
                                  whiteSpace: "pre-wrap",
                                  maxHeight: "80px",
                                  overflow: "auto",
                                  color: compileResult.output === compileResult.expectedOutput ? "#4caf50" : "#ffc107",
                                }}>
                                  {compileResult.output || "No output"}
                                </pre>
                              </div>
                            </div>
                          )}
                          
                          {compileResult.time && (
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                              Time: {compileResult.time} | Memory: {compileResult.memory}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Test Results - First 5 Test Cases */}
                      {testResults.length > 0 && (
                        <div style={{
                          background: "rgba(0,0,0,0.2)",
                          borderRadius: "6px",
                          padding: "12px",
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: "12px" }}>
                            Test Results: {testResults.filter(r => r.passed).length}/{testResults.length} passed
                          </div>
                          
                          {/* Show first 5 test cases with details */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "12px" }}>
                            {testResults.slice(0, 5).map((result) => (
                              <div
                                key={result.testCaseNumber}
                                style={{
                                  background: result.passed ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
                                  border: `1px solid ${result.passed ? "rgba(76, 175, 80, 0.3)" : "rgba(244, 67, 54, 0.3)"}`,
                                  borderRadius: "6px",
                                  padding: "10px",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                  <span style={{ fontWeight: 600 }}>Test Case {result.testCaseNumber}</span>
                                  <span style={{ 
                                    color: result.passed ? "#4caf50" : "#f44336",
                                    fontWeight: 600,
                                  }}>
                                    {result.passed ? "✓ Passed" : "✗ Failed"}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px" }}>
                                  <div>
                                    <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Input:</div>
                                    <pre style={{ 
                                      background: "rgba(0,0,0,0.3)", 
                                      padding: "6px", 
                                      borderRadius: "4px",
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                      maxHeight: "60px",
                                      overflow: "auto",
                                    }}>
                                      {result.input}
                                    </pre>
                                  </div>
                                  <div>
                                    <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Expected Output:</div>
                                    <pre style={{ 
                                      background: "rgba(0,0,0,0.3)", 
                                      padding: "6px", 
                                      borderRadius: "4px",
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                      maxHeight: "60px",
                                      overflow: "auto",
                                    }}>
                                      {result.expectedOutput}
                                    </pre>
                                  </div>
                                  <div>
                                    <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Your Output:</div>
                                    <pre style={{ 
                                      background: "rgba(0,0,0,0.3)", 
                                      padding: "6px", 
                                      borderRadius: "4px",
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                      maxHeight: "60px",
                                      overflow: "auto",
                                      color: result.passed ? "#4caf50" : "#f44336",
                                    }}>
                                      {result.actualOutput || result.error || "No output"}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Summary for remaining test cases */}
                          {testResults.length > 5 && (
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              + {testResults.length - 5} more test cases ({testResults.slice(5).filter(r => r.passed).length} passed, {testResults.slice(5).filter(r => !r.passed).length} failed)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="code-editor-footer">
                    {results[currentProblem.id] && (
                      <div
                        className={`result-badge ${
                          results[currentProblem.id].passed ? "success" : "error"
                        }`}
                      >
                        {results[currentProblem.id].passed
                          ? `✓ Accepted (Score: ${results[currentProblem.id].score || 0})`
                          : `✗ ${results[currentProblem.id].message}`}
                        {results[currentProblem.id].testsPassed !== undefined && (
                          <span style={{ marginLeft: "8px", fontSize: "12px" }}>
                            ({results[currentProblem.id].testsPassed}/{results[currentProblem.id].totalTests} tests)
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn btn-success btn-small"
                      onClick={() => handleSubmit(currentProblem.id)}
                      disabled={submitting[currentProblem.id] || !competitionActive}
                      style={{ width: "auto", minWidth: "140px" }}
                    >
                      {submitting[currentProblem.id] ? "Submitting..." : "Submit Solution"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="leaderboard">
          <h2>Live Leaderboard</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Score</th>
                <th>Solved</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((team, index) => {
                const rankClass = index === 0 ? "rank-1" : index === 1 ? "rank-2" : index === 2 ? "rank-3" : "";
                const isCurrentTeam = team.name === teamName;
                return (
                  <tr
                    key={team.name}
                    style={isCurrentTeam ? { background: "rgba(0, 217, 255, 0.1)" } : undefined}
                  >
                    <td className={rankClass}>{index + 1}</td>
                    <td style={{ fontWeight: isCurrentTeam ? 600 : 400 }}>
                      {team.name} {isCurrentTeam && "(You)"}
                    </td>
                    <td>{team.score}</td>
                    <td>{team.solved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Judging Criteria */}
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "24px",
        }}>
          <h3 style={{ marginBottom: "16px" }}>📋 Round 3: Code Relay - Judging Criteria</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="criteria-item">
              <span>Correctness & Output Accuracy</span>
              <span className="criteria-value">30%</span>
            </div>
            <div className="criteria-item">
              <span>Code Continuity</span>
              <span className="criteria-value">20%</span>
            </div>
            <div className="criteria-item">
              <span>Efficiency & Optimization</span>
              <span className="criteria-value">30%</span>
            </div>
            <div className="criteria-item">
              <span>Debugging & Error Handling</span>
              <span className="criteria-value">10%</span>
            </div>
            <div className="criteria-item">
              <span>Relay Discipline & Compliance</span>
              <span className="criteria-value">10%</span>
            </div>
          </div>
        </div>

        {/* Violations Counter */}
        {tabViolations > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: "16px",
              right: "16px",
              background: "var(--accent-error)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              zIndex: 1000,
            }}
          >
            Violations: {tabViolations}
          </div>
        )}
      </div>

      <style jsx>{`
        .criteria-item {
          display: flex;
          justify-content: space-between;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          font-size: 14px;
        }
        .criteria-value {
          font-weight: 600;
          color: var(--accent-primary);
        }
      `}</style>
    </>
  );
}
