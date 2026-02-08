"use client";

import Script from "next/script";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamData {
  password: string;
  isAdmin?: boolean;
  score: number;
  solved: number[];
  team_size?: number;
  registration_numbers?: string;
  violations?: number;
  is_banned?: boolean;
}

interface Teams {
  [key: string]: TeamData;
}

interface Submission {
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

interface LeaderboardEntry {
  name: string;
  score: number;
  solved: number;
  lastSubmission: string;
}

interface Competition {
  startTime: number | null;
  duration: number;
}

interface Violation {
  id: number;
  team_name: string;
  violation_type: string;
  details: string;
  created_at: string;
}

interface CompetitionStats {
  totalTeams: number;
  activeTeams: number;
  totalSubmissions: number;
  passedSubmissions: number;
  failedSubmissions: number;
  totalViolations: number;
  problemStats: { problemId: number; solved: number; attempted: number }[];
}

export default function AdminPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Teams>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [competition, setCompetition] = useState<Competition>({
    startTime: null,
    duration: 120,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [timer, setTimer] = useState("Not Started");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPassword, setNewTeamPassword] = useState("");
  const [newTeamSize, setNewTeamSize] = useState(1);
  const [duration, setDuration] = useState(120);
  const [vantaLoaded, setVantaLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<number>>(
    new Set()
  );
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "teams" | "monitoring" | "submissions">("overview");
  const isFirstLoad = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();

      if (!data.success) {
        router.push("/");
        return;
      }

      setTeams(data.teams);
      setSubmissions(data.submissions);
      setCompetition(data.competition);
      setLeaderboard(data.leaderboard);
      setViolations(data.violations || []);
      setStats(data.stats || null);
      // Only set duration on initial load, not on every refresh
      if (isFirstLoad.current) {
        setDuration(data.competition.duration || 120);
        isFirstLoad.current = false;
      }
      setLoading(false);
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const updateTimer = () => {
      if (!competition.startTime) {
        setTimer("Not Started");
        return;
      }

      const now = Date.now();
      const elapsed = Math.floor((now - competition.startTime) / 1000);
      const total = competition.duration * 60;
      const remaining = Math.max(0, total - elapsed);

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      setTimer(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [competition]);

  useEffect(() => {
    if (
      threeLoaded &&
      vantaLoaded &&
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).VANTA &&
      (window as unknown as Record<string, unknown>).THREE
    ) {
      try {
        const VANTA = (
          window as unknown as Record<
            string,
            { GLOBE: (options: Record<string, unknown>) => void }
          >
        ).VANTA;
        VANTA.GLOBE({
          el: "#vanta-bg",
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0xe8105a,
          backgroundColor: 0x3c1530,
          size: 1.2,
          backgroundAlpha: 1.0,
        });
      } catch (e) {
        console.warn("VANTA init failed:", e);
      }
    }
  }, [threeLoaded, vantaLoaded]);

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewTeamPassword(password);
  };

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/admin/add-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: newTeamName,
          password: newTeamPassword,
          teamSize: newTeamSize,
        }),
      });
      setNewTeamName("");
      setNewTeamPassword("");
      setNewTeamSize(1);
      fetchData();
    } catch (error) {
      console.error("Add team error:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult("");

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const regNumIndex = headers.findIndex((h) => h.includes("registration"));
      const phoneIndex = headers.findIndex((h) => h.includes("phone"));
      const nameIndex = headers.findIndex((h) => h.includes("team") || h.includes("name"));

      if (regNumIndex === -1 || phoneIndex === -1) {
        setUploadResult("Error: CSV must have 'registration_number' and 'phone_number' columns");
        setUploading(false);
        return;
      }

      const teams = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        return {
          registration_number: values[regNumIndex] || "",
          phone_number: values[phoneIndex] || "",
          team_name: nameIndex !== -1 ? values[nameIndex] : undefined,
        };
      }).filter((t) => t.registration_number && t.phone_number);

      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
      });

      const data = await res.json();
      setUploadResult(data.message || "Upload complete");
      fetchData();
    } catch (error) {
      console.error("Upload error:", error);
      setUploadResult("Error processing file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = () => {
    window.location.href = "/api/admin/sample-template";
  };

  const deleteTeam = async (teamName: string) => {
    if (!confirm(`Delete ${teamName}?`)) return;

    try {
      const res = await fetch("/api/admin/delete-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed to delete team: ${data.message}`);
      }
      fetchData();
    } catch (error) {
      console.error("Delete team error:", error);
      alert("Failed to delete team. Check console for details.");
    }
  };

  const toggleBanTeam = async (teamName: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? "unban" : "ban";
    if (!confirm(`${currentlyBanned ? "Unban" : "Ban"} ${teamName}?`)) return;

    try {
      const res = await fetch("/api/admin/ban-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, action }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed to ${action} team: ${data.message}`);
      }
      fetchData();
    } catch (error) {
      console.error(`${action} team error:`, error);
      alert(`Failed to ${action} team.`);
    }
  };

  const downloadSubmissions = (type: "report" | "analytics") => {
    window.location.href = `/api/admin/download-submissions?type=${type}`;
  };

  const startCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const durationToUse = duration || 120;
      console.log("Starting competition with duration:", durationToUse);
      const res = await fetch("/api/admin/start-competition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: durationToUse }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("Failed to start competition");
      }
      fetchData();
    } catch (error) {
      console.error("Start competition error:", error);
      alert("Failed to start competition");
    }
  };

  const stopCompetition = async () => {
    try {
      await fetch("/api/admin/stop-competition", {
        method: "POST",
      });
      fetchData();
    } catch (error) {
      console.error("Stop competition error:", error);
    }
  };

  const toggleSubmissionCode = (index: number) => {
    setExpandedSubmissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const teamEntries = Object.entries(teams).filter(
    ([, data]) => !data.isAdmin
  );

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeLoaded(true)}
      />
      {threeLoaded && (
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.globe.min.js"
          strategy="afterInteractive"
          onLoad={() => setVantaLoaded(true)}
        />
      )}

      <div id="vanta-bg"></div>

      <Link href="/api/auth/logout" className="logout-btn">
        Logout
      </Link>

      <div className="container">
        <div className="header">
          <h1>Binary Battles 0.3</h1>
          <p>Admin Control Panel</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ 
          display: "flex", 
          gap: "10px", 
          marginBottom: "20px", 
          flexWrap: "wrap",
          background: "var(--bg-secondary)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)"
        }}>
          <button 
            className={`btn ${activeTab === "overview" ? "" : "btn-secondary"}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Overview
          </button>
          <button 
            className={`btn ${activeTab === "teams" ? "" : "btn-secondary"}`}
            onClick={() => setActiveTab("teams")}
          >
            👥 Teams
          </button>
          <button 
            className={`btn ${activeTab === "monitoring" ? "" : "btn-secondary"}`}
            onClick={() => setActiveTab("monitoring")}
            style={{ position: "relative" }}
          >
            🔍 Monitoring
            {violations.length > 0 && (
              <span style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#ff4444",
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {violations.length}
              </span>
            )}
          </button>
          <button 
            className={`btn ${activeTab === "submissions" ? "" : "btn-secondary"}`}
            onClick={() => setActiveTab("submissions")}
          >
            📝 Submissions
          </button>
        </div>

        {/* Statistics Cards - Always visible */}
        {stats && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
            gap: "15px", 
            marginBottom: "20px" 
          }}>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-primary)" }}>{stats.totalTeams}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Total Teams</div>
            </div>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4ade80" }}>{stats.activeTeams}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Active (5m)</div>
            </div>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#60a5fa" }}>{stats.totalSubmissions}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Submissions</div>
            </div>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4ade80" }}>{stats.passedSubmissions}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Passed</div>
            </div>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f87171" }}>{stats.failedSubmissions}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Failed</div>
            </div>
            <div className="admin-card" style={{ textAlign: "center", padding: "15px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: violations.length > 0 ? "#ff4444" : "#4ade80" }}>{stats.totalViolations}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Violations</div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
        <div className="admin-controls">
          <div className="admin-card">
            <h3>⏱️ Competition Timer</h3>
            <form onSubmit={startCompetition}>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 120)}
                  min="1"
                  required
                />
              </div>
              <button type="submit" className="btn">
                Start Competition
              </button>
            </form>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={stopCompetition}
            >
              Stop Competition
            </button>
            <p
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "1.8em",
                color: "#ff6347",
              }}
            >
              {timer}
            </p>
          </div>
        </div>

        <div className="leaderboard">
          <h2>🏆 Live Leaderboard</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Score</th>
                <th>Problems Solved</th>
                <th>Last Submission</th>
                <th>Violations</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((team, index) => {
                let rankClass = "";
                if (index === 0) rankClass = "rank-1";
                else if (index === 1) rankClass = "rank-2";
                else if (index === 2) rankClass = "rank-3";
                const teamViolations = teams[team.name]?.violations || 0;

                return (
                  <tr key={team.name}>
                    <td className={rankClass}>{index + 1}</td>
                    <td>{team.name}</td>
                    <td>{team.score}</td>
                    <td>{team.solved}</td>
                    <td>{team.lastSubmission}</td>
                    <td style={{ color: teamViolations > 0 ? "#ff4444" : "inherit" }}>
                      {teamViolations > 0 ? `⚠️ ${teamViolations}` : "✓"}
                    </td>
                  </tr>
                );
              })}
              {leaderboard.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", opacity: 0.7 }}
                  >
                    No teams yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {/* Teams Tab */}
        {activeTab === "teams" && (
          <>
            <div className="admin-controls">
              <div className="admin-card">
                <h3>👥 Add New Team</h3>
                <form onSubmit={addTeam}>
                  <div className="form-group">
                    <label>Team Name</label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Enter team name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="text"
                      value={newTeamPassword}
                      placeholder="Click generate"
                      readOnly
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Team Size</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newTeamSize}
                      onChange={(e) => setNewTeamSize(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={generatePassword}>
                    Generate Password
                  </button>
                  <button type="submit" className="btn" style={{ marginTop: "10px" }}>
                    Add Team
                  </button>
                </form>
              </div>

              <div className="admin-card">
                <h3>📁 Bulk Upload</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  Upload CSV with: registration_number, phone_number, team_name (optional)
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>
                    📥 Template
                  </button>
                  <label className="btn" style={{ cursor: "pointer" }}>
                    {uploading ? "Uploading..." : "📤 Upload CSV"}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {uploadResult && (
                  <p style={{ marginTop: "12px", color: uploadResult.includes("Error") ? "var(--accent-error)" : "var(--accent-success)" }}>
                    {uploadResult}
                  </p>
                )}
              </div>
            </div>

            <div className="admin-card">
              <h3>📋 All Registered Teams ({teamEntries.length})</h3>
              <div className="team-list" style={{ maxHeight: "500px" }}>
                {teamEntries.map(([name, data]) => (
                  <div key={name} className="team-item" style={{ 
                    borderLeft: (data.violations || 0) > 0 ? "3px solid #ff4444" : "3px solid transparent" 
                  }}>
                    <div style={{ flex: 1 }}>
                      <strong>{name}</strong>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Password: {data.password} | Size: {data.team_size || 1} | Score: {data.score}
                        {(data.violations || 0) > 0 && (
                          <span style={{ color: "#ff4444", marginLeft: "10px" }}>
                            ⚠️ {data.violations} violation(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="btn btn-small" onClick={() => deleteTeam(name)} style={{ background: "#dc2626" }}>
                      Delete
                    </button>
                  </div>
                ))}
                {teamEntries.length === 0 && (
                  <p style={{ opacity: 0.7, textAlign: "center", padding: "20px" }}>
                    No teams registered yet
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Monitoring Tab */}
        {activeTab === "monitoring" && (
          <>
            <div className="admin-controls">
              <div className="admin-card">
                <h3>📊 Problem Statistics</h3>
                {stats && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "10px" }}>
                    {stats.problemStats.map((ps) => (
                      <div key={ps.problemId} style={{ 
                        background: "var(--bg-tertiary)", 
                        padding: "15px", 
                        borderRadius: "8px",
                        textAlign: "center"
                      }}>
                        <div style={{ fontSize: "16px", fontWeight: "bold" }}>P{ps.problemId}</div>
                        <div style={{ fontSize: "20px", color: "#4ade80" }}>{ps.solved}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>solved / {ps.attempted} tried</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-card">
                <h3>🔴 Live Team Status</h3>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {teamEntries.map(([name, data]) => (
                    <div key={name} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      padding: "10px",
                      borderBottom: "1px solid var(--border-color)",
                      background: data.is_banned ? "rgba(220,38,38,0.2)" : (data.violations || 0) > 0 ? "rgba(255,68,68,0.1)" : "transparent"
                    }}>
                      <span>
                        <strong>{name}</strong>
                        {data.is_banned && <span style={{ marginLeft: "8px", color: "#dc2626", fontSize: "11px", fontWeight: "bold" }}>🚫 BANNED</span>}
                        <span style={{ 
                          marginLeft: "10px", 
                          fontSize: "12px",
                          color: "var(--text-secondary)" 
                        }}>
                          Score: {data.score} | Solved: {data.solved.length}
                        </span>
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ 
                          color: (data.violations || 0) > 0 ? "#ff4444" : "#4ade80",
                          fontWeight: "bold"
                        }}>
                          {(data.violations || 0) > 0 ? `⚠️ ${data.violations}` : "✓ Clean"}
                        </span>
                        <button
                          className="btn btn-small"
                          style={{ 
                            background: data.is_banned ? "#4ade80" : "#dc2626",
                            fontSize: "11px",
                            padding: "4px 8px"
                          }}
                          onClick={() => toggleBanTeam(name, data.is_banned || false)}
                        >
                          {data.is_banned ? "Unban" : "Ban"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>⚠️ Rule Violations ({violations.length})</span>
                {violations.length > 0 && (
                  <button 
                    className="btn btn-small" 
                    style={{ background: "#dc2626" }}
                    onClick={async () => {
                      if (confirm("Clear all violations?")) {
                        await fetch("/api/violations", { method: "DELETE" });
                        fetchData();
                      }
                    }}
                  >
                    Clear All
                  </button>
                )}
              </h3>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {violations.map((v) => (
                  <div key={v.id} style={{ 
                    padding: "12px", 
                    marginBottom: "10px",
                    background: "rgba(255,68,68,0.1)", 
                    borderRadius: "8px",
                    borderLeft: "3px solid #ff4444"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <strong style={{ color: "#ff4444" }}>{v.team_name}</strong>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: "14px" }}>
                      <span style={{ 
                        background: "#ff4444", 
                        color: "white", 
                        padding: "2px 8px", 
                        borderRadius: "4px",
                        fontSize: "12px",
                        marginRight: "10px"
                      }}>
                        {v.violation_type}
                      </span>
                      {v.details}
                    </div>
                  </div>
                ))}
                {violations.length === 0 && (
                  <p style={{ opacity: 0.7, textAlign: "center", padding: "40px" }}>
                    ✓ No violations detected - all teams are following the rules
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>📝 Final Submissions ({submissions.length})</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => downloadSubmissions("report")}
                style={{ fontSize: "13px", padding: "8px 12px" }}
              >
                📄 Download Report
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => downloadSubmissions("analytics")}
                style={{ fontSize: "13px", padding: "8px 12px" }}
              >
                📊 Download Analytics
              </button>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "15px" }}>
            Showing only the latest submission per team per problem (autosaves excluded)
          </p>
          <div className="submissions-list">
            {[...submissions].reverse().map((sub, idx) => {
              const realIndex = submissions.length - 1 - idx;
              return (
                <div key={realIndex} className="submission-item">
                  <h4>
                    Team: {sub.team} | Problem {sub.problemId} | {sub.language}
                  </h4>
                  <p>
                    <strong>Time:</strong>{" "}
                    {new Date(sub.timestamp).toLocaleString()}
                  </p>
                  <p>
                    <strong>Result:</strong>{" "}
                    <span
                      className={`status-badge ${
                        sub.result.passed ? "status-correct" : "status-incorrect"
                      }`}
                    >
                      {sub.result.passed
                        ? "✓ Correct"
                        : `✗ ${sub.result.message}`}
                    </span>
                  </p>
                  <button
                    onClick={() => toggleSubmissionCode(realIndex)}
                    style={{
                      cursor: "pointer",
                      color: "#ff6347",
                      margin: "15px 0",
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      fontSize: "1em",
                    }}
                  >
                    {expandedSubmissions.has(realIndex)
                      ? "▼ Hide Code"
                      : "▶ View Code"}
                  </button>
                  {expandedSubmissions.has(realIndex) && (
                    <div className="submission-code">{sub.code}</div>
                  )}
                </div>
              );
            })}
            {submissions.length === 0 && (
              <p style={{ opacity: 0.7, textAlign: "center", padding: "20px" }}>
                No submissions yet
              </p>
            )}
          </div>
          </>
        )}
      </div>
      <div className="dev-footer">developed by murli sharma</div>
    </>
  );
}
