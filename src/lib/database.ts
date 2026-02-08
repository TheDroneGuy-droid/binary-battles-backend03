import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// SHA-256 hash function for password security
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "competition.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    name TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    plain_password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    team_size INTEGER DEFAULT 1,
    registration_numbers TEXT,
    is_banned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS solved_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    problem_id INTEGER NOT NULL,
    solved_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_name) REFERENCES teams(name),
    UNIQUE(team_name, problem_id)
  );

  CREATE TABLE IF NOT EXISTS failed_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    problem_id INTEGER NOT NULL,
    failed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_name) REFERENCES teams(name),
    UNIQUE(team_name, problem_id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    problem_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    passed INTEGER NOT NULL,
    message TEXT,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_name) REFERENCES teams(name)
  );

  CREATE TABLE IF NOT EXISTS competition (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    start_time INTEGER,
    duration INTEGER DEFAULT 120
  );

  CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_name) REFERENCES teams(name)
  );

  CREATE TABLE IF NOT EXISTS team_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_name) REFERENCES teams(name)
  );
`);

// Migration: Add is_banned column if it doesn't exist
try {
  db.prepare("SELECT is_banned FROM teams LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE teams ADD COLUMN is_banned INTEGER DEFAULT 0");
}

// Initialize competition row if not exists
const initCompetition = db.prepare(
  "INSERT OR IGNORE INTO competition (id, duration) VALUES (1, 120)"
);
initCompetition.run();

// Initialize admin if not exists (with hashed password)
const initAdmin = db.prepare(
  "INSERT OR IGNORE INTO teams (name, password, plain_password, is_admin, score) VALUES (?, ?, ?, ?, ?)"
);
const hashedAdminPassword = hashPassword("admin123");
initAdmin.run("admin", hashedAdminPassword, "admin123", 1, 0);

// ============ Team Operations ============

export interface Team {
  name: string;
  password: string;
  is_admin: boolean;
  score: number;
  solved: number[];
  failed: number[];
  team_size: number;
  registration_numbers: string;
  is_banned: boolean;
}

export function getTeam(name: string): Team | null {
  const team = db
    .prepare("SELECT * FROM teams WHERE name = ?")
    .get(name) as { name: string; password: string; plain_password: string; is_admin: number; score: number; team_size: number; registration_numbers: string; is_banned?: number } | undefined;

  if (!team) return null;

  const solved = db
    .prepare("SELECT problem_id FROM solved_problems WHERE team_name = ?")
    .all(name) as { problem_id: number }[];

  const failed = db
    .prepare("SELECT problem_id FROM failed_problems WHERE team_name = ?")
    .all(name) as { problem_id: number }[];

  return {
    name: team.name,
    password: team.plain_password, // Return plain password for display
    is_admin: team.is_admin === 1,
    score: team.score,
    solved: solved.map((s) => s.problem_id),
    failed: failed.map((f) => f.problem_id),
    team_size: team.team_size || 1,
    registration_numbers: team.registration_numbers || "",
    is_banned: team.is_banned === 1,
  };
}

export function getAllTeams(): Team[] {
  const teams = db.prepare("SELECT * FROM teams").all() as {
    name: string;
    password: string;
    plain_password: string;
    is_admin: number;
    score: number;
    team_size: number;
    registration_numbers: string;
    is_banned?: number;
  }[];

  return teams.map((team) => {
    const solved = db
      .prepare("SELECT problem_id FROM solved_problems WHERE team_name = ?")
      .all(team.name) as { problem_id: number }[];

    const failed = db
      .prepare("SELECT problem_id FROM failed_problems WHERE team_name = ?")
      .all(team.name) as { problem_id: number }[];

    return {
      name: team.name,
      password: team.plain_password, // Return plain password for display
      is_admin: team.is_admin === 1,
      score: team.score,
      solved: solved.map((s) => s.problem_id),
      failed: failed.map((f) => f.problem_id),
      team_size: team.team_size || 1,
      registration_numbers: team.registration_numbers || "",
      is_banned: team.is_banned === 1,
    };
  });
}

export function addTeam(name: string, password: string, teamSize: number = 1, registrationNumbers: string = ""): boolean {
  try {
    const hashedPassword = hashPassword(password);
    db.prepare("INSERT INTO teams (name, password, plain_password, team_size, registration_numbers) VALUES (?, ?, ?, ?, ?)").run(
      name,
      hashedPassword,
      password, // Store plain password for admin display
      teamSize,
      registrationNumbers
    );
    return true;
  } catch (error) {
    console.error("Error adding team:", error);
    return false;
  }
}

export function deleteTeam(name: string): boolean {
  try {
    console.log(`Attempting to delete team: ${name}`);
    
    // First check if team exists and is not admin
    const team = db.prepare("SELECT name, is_admin FROM teams WHERE name = ?").get(name) as { name: string; is_admin: number } | undefined;
    
    if (!team) {
      console.log(`Team not found: ${name}`);
      return false;
    }
    
    if (team.is_admin === 1) {
      console.log(`Cannot delete admin team: ${name}`);
      return false;
    }
    
    // Delete related records first (cascade delete)
    db.prepare("DELETE FROM solved_problems WHERE team_name = ?").run(name);
    db.prepare("DELETE FROM failed_problems WHERE team_name = ?").run(name);
    db.prepare("DELETE FROM submissions WHERE team_name = ?").run(name);
    
    // Then delete the team
    const result = db.prepare("DELETE FROM teams WHERE name = ?").run(name);
    console.log(`Delete result for ${name}:`, result.changes);
    
    return result.changes > 0;
  } catch (error) {
    console.error(`Error deleting team ${name}:`, error);
    return false;
  }
}

export function updateTeamScore(name: string, score: number): void {
  db.prepare("UPDATE teams SET score = ? WHERE name = ?").run(score, name);
}

export function banTeam(name: string): boolean {
  try {
    const result = db.prepare("UPDATE teams SET is_banned = 1 WHERE name = ? AND is_admin = 0").run(name);
    return result.changes > 0;
  } catch {
    return false;
  }
}

export function unbanTeam(name: string): boolean {
  try {
    const result = db.prepare("UPDATE teams SET is_banned = 0 WHERE name = ?").run(name);
    return result.changes > 0;
  } catch {
    return false;
  }
}

export function isTeamBanned(name: string): boolean {
  try {
    const team = db.prepare("SELECT is_banned FROM teams WHERE name = ?").get(name) as { is_banned: number } | undefined;
    return team?.is_banned === 1;
  } catch {
    // Column might not exist in older databases
    return false;
  }
}

export function addSolvedProblem(teamName: string, problemId: number): void {
  try {
    db.prepare(
      "INSERT OR IGNORE INTO solved_problems (team_name, problem_id) VALUES (?, ?)"
    ).run(teamName, problemId);
    // Remove from failed if exists
    db.prepare(
      "DELETE FROM failed_problems WHERE team_name = ? AND problem_id = ?"
    ).run(teamName, problemId);
  } catch {
    // Already exists
  }
}

export function addFailedProblem(teamName: string, problemId: number): void {
  try {
    // Only add to failed if not already solved
    const solved = db
      .prepare(
        "SELECT 1 FROM solved_problems WHERE team_name = ? AND problem_id = ?"
      )
      .get(teamName, problemId);
    if (!solved) {
      db.prepare(
        "INSERT OR IGNORE INTO failed_problems (team_name, problem_id) VALUES (?, ?)"
      ).run(teamName, problemId);
    }
  } catch {
    // Already exists
  }
}

// ============ Submission Operations ============

export interface Submission {
  id: number;
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

export function addSubmission(
  teamName: string,
  problemId: number,
  code: string,
  language: string,
  passed: boolean,
  message: string
): void {
  db.prepare(
    `INSERT INTO submissions (team_name, problem_id, code, language, passed, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(teamName, problemId, code, language, passed ? 1 : 0, message);
}

export function getAllSubmissions(): Submission[] {
  const submissions = db
    .prepare("SELECT * FROM submissions ORDER BY submitted_at DESC")
    .all() as {
    id: number;
    team_name: string;
    problem_id: number;
    code: string;
    language: string;
    passed: number;
    message: string;
    submitted_at: string;
  }[];

  return submissions.map((sub) => ({
    id: sub.id,
    team: sub.team_name,
    problemId: sub.problem_id,
    code: sub.code,
    language: sub.language,
    result: {
      passed: sub.passed === 1,
      message: sub.message,
    },
    timestamp: sub.submitted_at,
  }));
}

export function getTeamSubmissions(teamName: string): Submission[] {
  const submissions = db
    .prepare(
      "SELECT * FROM submissions WHERE team_name = ? ORDER BY submitted_at DESC"
    )
    .all(teamName) as {
    id: number;
    team_name: string;
    problem_id: number;
    code: string;
    language: string;
    passed: number;
    message: string;
    submitted_at: string;
  }[];

  return submissions.map((sub) => ({
    id: sub.id,
    team: sub.team_name,
    problemId: sub.problem_id,
    code: sub.code,
    language: sub.language,
    result: {
      passed: sub.passed === 1,
      message: sub.message,
    },
    timestamp: sub.submitted_at,
  }));
}

// Get only final submissions (latest per team per problem - ignores autosaves)
export function getFinalSubmissions(): Submission[] {
  // Get the latest submission for each team-problem combination
  const submissions = db.prepare(`
    SELECT s.* FROM submissions s
    INNER JOIN (
      SELECT team_name, problem_id, MAX(submitted_at) as max_time
      FROM submissions
      GROUP BY team_name, problem_id
    ) latest ON s.team_name = latest.team_name 
    AND s.problem_id = latest.problem_id 
    AND s.submitted_at = latest.max_time
    ORDER BY s.submitted_at DESC
  `).all() as {
    id: number;
    team_name: string;
    problem_id: number;
    code: string;
    language: string;
    passed: number;
    message: string;
    submitted_at: string;
  }[];

  return submissions.map((sub) => ({
    id: sub.id,
    team: sub.team_name,
    problemId: sub.problem_id,
    code: sub.code,
    language: sub.language,
    result: {
      passed: sub.passed === 1,
      message: sub.message,
    },
    timestamp: sub.submitted_at,
  }));
}

// ============ Competition Operations ============

export interface CompetitionState {
  startTime: number | null;
  duration: number;
}

export function getCompetition(): CompetitionState {
  const comp = db.prepare("SELECT * FROM competition WHERE id = 1").get() as {
    start_time: number | null;
    duration: number;
  };
  return {
    startTime: comp.start_time,
    duration: comp.duration,
  };
}

export function startCompetition(duration: number): void {
  db.prepare("UPDATE competition SET start_time = ?, duration = ? WHERE id = 1").run(
    Date.now(),
    duration
  );
}

export function stopCompetition(): void {
  db.prepare("UPDATE competition SET start_time = NULL WHERE id = 1").run();
}

export function isCompetitionActive(): boolean {
  const comp = getCompetition();
  if (!comp.startTime) return false;
  const elapsed = (Date.now() - comp.startTime) / 1000 / 60;
  return elapsed < comp.duration;
}

// ============ Leaderboard ============

export interface LeaderboardEntry {
  name: string;
  score: number;
  solved: number;
  lastSubmission: string;
}

export function getLeaderboard(): LeaderboardEntry[] {
  const teams = getAllTeams().filter((t) => !t.is_admin);

  const leaderboard: LeaderboardEntry[] = teams.map((team) => {
    const lastSub = db
      .prepare(
        "SELECT submitted_at FROM submissions WHERE team_name = ? ORDER BY submitted_at DESC LIMIT 1"
      )
      .get(team.name) as { submitted_at: string } | undefined;

    return {
      name: team.name,
      score: team.score,
      solved: team.solved.length,
      lastSubmission: lastSub?.submitted_at || "Never",
    };
  });

  return leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lastSubmission.localeCompare(b.lastSubmission);
  });
}

// ============ Validate Credentials ============

export function validateTeamCredentials(
  name: string,
  password: string
): { valid: boolean; isAdmin: boolean } {
  const team = db
    .prepare("SELECT password, is_admin FROM teams WHERE name = ?")
    .get(name) as { password: string; is_admin: number } | undefined;

  if (!team) {
    return { valid: false, isAdmin: false };
  }

  // Verify password using SHA-256 hash comparison
  if (!verifyPassword(password, team.password)) {
    return { valid: false, isAdmin: false };
  }

  return { valid: true, isAdmin: team.is_admin === 1 };
}

// ============ Violations Tracking ============

export interface Violation {
  id: number;
  team_name: string;
  violation_type: string;
  details: string;
  created_at: string;
}

export function addViolation(teamName: string, violationType: string, details: string = ""): void {
  db.prepare(
    "INSERT INTO violations (team_name, violation_type, details) VALUES (?, ?, ?)"
  ).run(teamName, violationType, details);
}

export function getViolations(teamName?: string): Violation[] {
  if (teamName) {
    return db
      .prepare("SELECT * FROM violations WHERE team_name = ? ORDER BY created_at DESC")
      .all(teamName) as Violation[];
  }
  return db
    .prepare("SELECT * FROM violations ORDER BY created_at DESC")
    .all() as Violation[];
}

export function getViolationCount(teamName: string): number {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM violations WHERE team_name = ?")
    .get(teamName) as { count: number };
  return result.count;
}

export function clearViolations(teamName?: string): void {
  if (teamName) {
    db.prepare("DELETE FROM violations WHERE team_name = ?").run(teamName);
  } else {
    db.prepare("DELETE FROM violations").run();
  }
}

// ============ Team Activity Tracking ============

export interface TeamActivity {
  id: number;
  team_name: string;
  activity_type: string;
  details: string;
  created_at: string;
}

export function logActivity(teamName: string, activityType: string, details: string = ""): void {
  db.prepare(
    "INSERT INTO team_activity (team_name, activity_type, details) VALUES (?, ?, ?)"
  ).run(teamName, activityType, details);
}

export function getTeamActivity(teamName?: string, limit: number = 50): TeamActivity[] {
  if (teamName) {
    return db
      .prepare("SELECT * FROM team_activity WHERE team_name = ? ORDER BY created_at DESC LIMIT ?")
      .all(teamName, limit) as TeamActivity[];
  }
  return db
    .prepare("SELECT * FROM team_activity ORDER BY created_at DESC LIMIT ?")
    .all(limit) as TeamActivity[];
}

// ============ Statistics ============

export interface CompetitionStats {
  totalTeams: number;
  activeTeams: number;
  totalSubmissions: number;
  passedSubmissions: number;
  failedSubmissions: number;
  totalViolations: number;
  problemStats: { problemId: number; solved: number; attempted: number }[];
}

export function getCompetitionStats(): CompetitionStats {
  const totalTeams = (db.prepare("SELECT COUNT(*) as count FROM teams WHERE is_admin = 0").get() as { count: number }).count;
  
  const activeTeams = (db.prepare(
    "SELECT COUNT(DISTINCT team_name) as count FROM submissions WHERE submitted_at > datetime('now', '-5 minutes')"
  ).get() as { count: number }).count;
  
  const totalSubmissions = (db.prepare("SELECT COUNT(*) as count FROM submissions WHERE passed IS NOT NULL").get() as { count: number }).count;
  const passedSubmissions = (db.prepare("SELECT COUNT(*) as count FROM submissions WHERE passed = 1").get() as { count: number }).count;
  const failedSubmissions = (db.prepare("SELECT COUNT(*) as count FROM submissions WHERE passed = 0").get() as { count: number }).count;
  const totalViolations = (db.prepare("SELECT COUNT(*) as count FROM violations").get() as { count: number }).count;
  
  const problemStats = [];
  for (let i = 1; i <= 6; i++) {
    const solved = (db.prepare("SELECT COUNT(*) as count FROM solved_problems WHERE problem_id = ?").get(i) as { count: number }).count;
    const attempted = (db.prepare("SELECT COUNT(DISTINCT team_name) as count FROM submissions WHERE problem_id = ?").get(i) as { count: number }).count;
    problemStats.push({ problemId: i, solved, attempted });
  }
  
  return {
    totalTeams,
    activeTeams,
    totalSubmissions,
    passedSubmissions,
    failedSubmissions,
    totalViolations,
    problemStats,
  };
}

export default db;
