"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Problem {
  id: number;
  title: string;
  description: string;
  input: string;
  output: string;
  examples: { input: string; output: string }[];
}

interface TeamData {
  score: number;
  solved: number[];
  failed: number[];
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
}

interface CompetitionState {
  startTime: number | null;
  duration: number;
}

export default function TeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [teamData, setTeamData] = useState<TeamData>({
    score: 0,
    solved: [],
    failed: [],
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
  const [results, setResults] = useState<{ [key: number]: SubmissionResult }>({});
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<number>(1);
  const [lastSaved, setLastSaved] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  
  // Anti-cheat states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [tabViolations, setTabViolations] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showFinalWarning, setShowFinalWarning] = useState(false);
  const [competitionActive, setCompetitionActive] = useState(false);
  
  const tabViolationsRef = useRef(0);
  const competitionActiveRef = useRef(false);
  const codesRef = useRef<{ [key: number]: string }>({});
  const languagesRef = useRef<{ [key: number]: string }>({});
  const hasRedirected = useRef(false);
  const isMounted = useRef(true);

  // Fetch team data
  const fetchData = useCallback(async () => {
    if (hasRedirected.current || !isMounted.current) return;
    
    try {
      const res = await fetch("/api/team");
      
      // Handle network errors
      if (!res.ok && res.status >= 500) {
        console.error("Server error:", res.status);
        return; // Don't redirect on server errors, just retry
      }
      
      const data = await res.json();

      if (!data.success) {
        if (hasRedirected.current) return;
        
        // Handle different failure reasons
        if (data.reason === "is_admin") {
          hasRedirected.current = true;
          router.replace("/admin");
        } else if (data.reason === "no_session") {
          hasRedirected.current = true;
          router.replace("/");
        } else if (data.reason === "team_not_found") {
          hasRedirected.current = true;
          router.replace("/");
        }
        // For server_error or unknown, don't redirect - just stay on page
        return;
      }

      if (isMounted.current) {
        setTeamName(data.teamName);
        setProblems(data.problems);
        setTeamData(data.teamData);
        setLeaderboard(data.leaderboard);
        setLoading(false);
        setInitialized(true);
      }
    } catch (error) {
      // Network errors - don't redirect, just log and retry on next interval
      console.error("Fetch error:", error);
      // Only redirect if we've never successfully loaded data
      if (!initialized && !hasRedirected.current && isMounted.current) {
        // Wait a bit before deciding to redirect
        setTimeout(() => {
          if (!initialized && !hasRedirected.current && isMounted.current) {
            hasRedirected.current = true;
            router.replace("/");
          }
        }, 3000);
      }
    }
  }, [router, initialized]);

  // Fetch competition status
  const fetchCompetition = useCallback(async () => {
    try {
      const res = await fetch("/api/competition");
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

        // Timer color based on remaining time
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

  // Initial data fetch with cleanup
  useEffect(() => {
    isMounted.current = true;
    fetchData();
    fetchCompetition();
    const dataInterval = setInterval(fetchData, 5000);
    const timerInterval = setInterval(fetchCompetition, 1000);
    return () => {
      isMounted.current = false;
      clearInterval(dataInterval);
      clearInterval(timerInterval);
    };
  }, [fetchData, fetchCompetition]);

  // Update refs when state changes
  useEffect(() => {
    codesRef.current = codes;
  }, [codes]);

  useEffect(() => {
    languagesRef.current = languages;
  }, [languages]);

  // Auto-save code every 10 seconds (reduced frequency, only current problem)
  useEffect(() => {
    if (!competitionActive || !initialized) return;
    
    let isAutoSaving = false;
    
    const autoSaveInterval = setInterval(async () => {
      if (isAutoSaving || !isMounted.current) return;
      isAutoSaving = true;
      
      const currentCodes = codesRef.current;
      const currentLanguages = languagesRef.current;
      
      // Only save the currently selected problem to reduce API calls
      const code = currentCodes[selectedProblem];
      if (code && code.trim().length > 10) {
        try {
          await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problemId: selectedProblem,
              code,
              language: currentLanguages[selectedProblem] || "python",
              autoSave: true,
            }),
          });
          if (isMounted.current) {
            setLastSaved(new Date().toLocaleTimeString());
          }
        } catch (error) {
          console.error("Auto-save error:", error);
        }
      }
      isAutoSaving = false;
    }, 10000);
    
    return () => clearInterval(autoSaveInterval);
  }, [competitionActive, initialized, selectedProblem]);

  // Fullscreen management
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenWarning(false);
      }
    } catch (e) {
      console.warn("Fullscreen request failed (requires user interaction):", e);
      // Don't block the user if fullscreen fails
      setShowFullscreenWarning(false);
    }
  }, []);

  // Show fullscreen prompt when competition starts (don't auto-enter - requires user gesture)
  useEffect(() => {
    if (competitionActive && !isFullscreen) {
      setShowFullscreenWarning(true);
      document.body.classList.add("no-select");
    }
  }, [competitionActive, isFullscreen]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      
      if (!isFs && competitionActiveRef.current) {
        setShowFullscreenWarning(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Tab visibility detection (anti-cheat) - 2 warning system
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && competitionActiveRef.current) {
        tabViolationsRef.current += 1;
        setTabViolations(tabViolationsRef.current);
        
        // Show final warning after 2 violations
        if (tabViolationsRef.current >= 2) {
          setShowFinalWarning(true);
        } else {
          setShowTabWarning(true);
        }
        
        // Report violation to server
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "tab_switch",
            team: teamName,
            count: tabViolationsRef.current,
          }),
        }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [teamName]);

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (competitionActiveRef.current) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Prevent keyboard shortcuts - STRICT copy/paste and screenshot blocking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!competitionActiveRef.current) return;

      // Block PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("");
        alert("Screenshots are not allowed!");
        return;
      }

      // Block ALL copy/paste/cut/select including in textareas
      if (e.ctrlKey || e.metaKey) {
        if (["c", "v", "x", "a", "p", "s"].includes(e.key.toLowerCase())) {
          e.preventDefault();
          return;
        }
      }

      // Block F12, DevTools shortcuts
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        return;
      }

      // Block Alt+Tab indicator (though can't fully prevent)
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
      }
    };

    // Block copy/paste events directly
    const handleCopy = (e: ClipboardEvent) => {
      if (competitionActiveRef.current) {
        e.preventDefault();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (competitionActiveRef.current) {
        e.preventDefault();
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (competitionActiveRef.current) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("cut", handleCut);
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("cut", handleCut);
    };
  }, []);

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
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResults((prev) => ({
          ...prev,
          [problemId]: {
            problemId,
            passed: data.result.passed,
            message: data.result.message,
          },
        }));
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
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {/* Final Warning Overlay - After 2+ violations */}
      {showFinalWarning && (
        <div className="final-warning">
          <h2>🚨 FINAL WARNING!</h2>
          <p>You have switched tabs {tabViolations} times.</p>
          <p style={{ fontSize: "18px", fontWeight: "bold", marginTop: "20px" }}>
            This is your FINAL WARNING. Any further violations may result in disqualification.
          </p>
          <p style={{ marginTop: "20px" }}>All violations have been recorded and reported to the admin.</p>
          <div className="violation-count" style={{ background: "#7f1d1d" }}>{tabViolations}</div>
          <p>Total violations</p>
          <button
            className="btn"
            style={{ marginTop: "20px", maxWidth: "200px", background: "#dc2626" }}
            onClick={() => setShowFinalWarning(false)}
          >
            I Understand
          </button>
        </div>
      )}

      {/* Tab Switch Warning Overlay - First warning */}
      {showTabWarning && !showFinalWarning && (
        <div className="tab-warning">
          <h2>⚠️ Warning: Tab Switch Detected!</h2>
          <p>Switching tabs or windows during the competition is not allowed.</p>
          <p>Your violation has been recorded.</p>
          <p style={{ marginTop: "10px", fontWeight: "bold", color: "#fbbf24" }}>
            Warning {tabViolations} of 2. Next violation is FINAL WARNING.
          </p>
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

      {/* Fullscreen Warning Overlay */}
      {showFullscreenWarning && competitionActive && (
        <div className="fullscreen-warning">
          <h2>⚠️ Fullscreen Recommended</h2>
          <p>
            For the best experience, please enter fullscreen mode during the competition.
          </p>
          <button
            className="btn"
            style={{ marginTop: "20px", maxWidth: "200px", marginRight: "10px" }}
            onClick={enterFullscreen}
          >
            Enter Fullscreen
          </button>
          <button
            className="btn"
            style={{ marginTop: "20px", maxWidth: "200px", background: "var(--text-muted)" }}
            onClick={() => setShowFullscreenWarning(false)}
          >
            Continue Without
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
          <h1>Binary Battles</h1>
          <p>Team: {teamName} | Score: {teamData.score} pts</p>
        </div>

        {/* Problem Status Overview */}
        <div className="problem-status">
          <h3>Problems:</h3>
          {problems.map((p) => {
            const isSolved = teamData.solved?.includes(p.id);
            const isFailed = teamData.failed?.includes(p.id);
            const statusClass = isSolved ? "solved" : isFailed ? "failed" : "";
            return (
              <div
                key={p.id}
                className={`status-indicator ${statusClass} ${selectedProblem === p.id ? "active" : ""}`}
                onClick={() => setSelectedProblem(p.id)}
                title={`Problem ${p.id}: ${p.title}`}
                style={{
                  border: selectedProblem === p.id ? "2px solid var(--accent-primary)" : undefined,
                }}
              >
                {p.id}
              </div>
            );
          })}
        </div>

        {/* Problems Container - LeetCode Style */}
        <div className="problems-container">
          {/* Sidebar - Problem List */}
          <div className="problems-sidebar">
            {problems.map((problem) => {
              const isSolved = teamData.solved?.includes(problem.id);
              const isFailed = teamData.failed?.includes(problem.id);
              return (
                <div
                  key={problem.id}
                  className={`problem-list-item ${selectedProblem === problem.id ? "active" : ""}`}
                  onClick={() => setSelectedProblem(problem.id)}
                >
                  <span className={`problem-number ${isSolved ? "solved" : isFailed ? "failed" : ""}`}>
                    {isSolved ? "✓" : problem.id}
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
                  
                  <p className="description">{currentProblem.description}</p>
                  
                  <div className="section-title">Input Format</div>
                  <pre>{currentProblem.input}</pre>
                  
                  <div className="section-title">Output Format</div>
                  <pre>{currentProblem.output}</pre>
                  
                  <div className="section-title">Examples</div>
                  {currentProblem.examples.map((ex, idx) => (
                    <div key={idx} className="example-box">
                      <div className="example-label">EXAMPLE {idx + 1}</div>
                      <pre>{`Input:\n${ex.input}\n\nOutput:\n${ex.output}`}</pre>
                    </div>
                  ))}
                </div>

                <div className="code-editor-container">
                  <div className="code-editor-header">
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>Code Editor</span>
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
                      <option value="python">Python 3.11</option>
                      <option value="cpp">C++ (g++ 13)</option>
                      <option value="c">C (gcc 13)</option>
                      <option value="java">Java 21</option>
                      <option value="rust">Rust 1.75</option>
                      <option value="javascript">JavaScript (Node.js)</option>
                      <option value="typescript">TypeScript</option>
                      <option value="go">Go 1.21</option>
                      <option value="csharp">C# (.NET 8)</option>
                      <option value="kotlin">Kotlin</option>
                      <option value="swift">Swift 5.9</option>
                      <option value="ruby">Ruby 3.2</option>
                    </select>
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

                  <div className="code-editor-footer">
                    {lastSaved && (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Auto-saved: {lastSaved}
                      </span>
                    )}
                    {results[currentProblem.id] && (
                      <div
                        className={`result-badge ${
                          results[currentProblem.id].passed ? "success" : "error"
                        }`}
                      >
                        {results[currentProblem.id].passed
                          ? "✓ Accepted (+10 pts)"
                          : `✗ ${results[currentProblem.id].message}`}
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn btn-success btn-small"
                      onClick={() => handleSubmit(currentProblem.id)}
                      disabled={submitting[currentProblem.id] || !competitionActive}
                      style={{ width: "auto", minWidth: "140px" }}
                    >
                      {submitting[currentProblem.id] ? "Submitting..." : "Submit"}
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

        {/* Violations Counter (visible in corner) */}
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
      <div className="dev-footer">developed by murli sharma</div>
    </>
  );
}
