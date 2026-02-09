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
    duration INTEGER DEFAULT 120,
    relay_duration INTEGER DEFAULT 5
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

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT,
    member_index INTEGER NOT NULL,
    FOREIGN KEY (team_name) REFERENCES teams(name),
    UNIQUE(team_name, member_id)
  );

  CREATE TABLE IF NOT EXISTS relay_state (
    team_name TEXT PRIMARY KEY,
    current_member_id TEXT NOT NULL,
    current_member_index INTEGER NOT NULL,
    relay_start_time INTEGER NOT NULL,
    relay_end_time INTEGER NOT NULL,
    relay_number INTEGER DEFAULT 1,
    previous_member_id TEXT,
    shared_code TEXT DEFAULT '',
    shared_language TEXT DEFAULT 'python',
    relay_history TEXT DEFAULT '[]',
    FOREIGN KEY (team_name) REFERENCES teams(name)
  );
`);

// Migration: Add is_banned column if it doesn't exist
try {
  db.prepare("SELECT is_banned FROM teams LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE teams ADD COLUMN is_banned INTEGER DEFAULT 0");
}

// Migration: Add is_master_admin column if it doesn't exist
try {
  db.prepare("SELECT is_master_admin FROM teams LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE teams ADD COLUMN is_master_admin INTEGER DEFAULT 0");
}

// Migration: Add selected_problem column if it doesn't exist
try {
  db.prepare("SELECT selected_problem FROM teams LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE teams ADD COLUMN selected_problem INTEGER DEFAULT NULL");
}

// Migration: Add relay_duration column if it doesn't exist
try {
  db.prepare("SELECT relay_duration FROM competition LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE competition ADD COLUMN relay_duration INTEGER DEFAULT 5");
}

// Initialize competition row if not exists
const initCompetition = db.prepare(
  "INSERT OR IGNORE INTO competition (id, duration, relay_duration) VALUES (1, 120, 5)"
);
initCompetition.run();

// Initialize regular admin if not exists (with hashed password)
const initAdmin = db.prepare(
  "INSERT OR IGNORE INTO teams (name, password, plain_password, is_admin, score, is_master_admin) VALUES (?, ?, ?, ?, ?, ?)"
);
const hashedAdminPassword = hashPassword("admin123");
initAdmin.run("admin", hashedAdminPassword, "admin123", 1, 0, 0);

// Initialize MASTER admin with UID "masteradmin" and password "199810"
const initMasterAdmin = db.prepare(
  "INSERT OR IGNORE INTO teams (name, password, plain_password, is_admin, score, is_master_admin, registration_numbers) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const hashedMasterPassword = hashPassword("199810");
initMasterAdmin.run("MasterAdmin", hashedMasterPassword, "199810", 1, 0, 1, "masteradmin");

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
  selectedProblem?: number;
}

export function getTeam(name: string): Team | null {
  const team = db
    .prepare("SELECT * FROM teams WHERE name = ?")
    .get(name) as { name: string; password: string; plain_password: string; is_admin: number; score: number; team_size: number; registration_numbers: string; is_banned?: number; selected_problem?: number } | undefined;

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
    selectedProblem: team.selected_problem || undefined,
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

export function setSelectedProblem(name: string, problemId: number): void {
  db.prepare("UPDATE teams SET selected_problem = ? WHERE name = ?").run(problemId, name);
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
  identifier: string,
  password: string
): { valid: boolean; isAdmin: boolean; isMasterAdmin: boolean; actualName: string } {
  // Normalize the identifier - trim and convert to lowercase for comparison
  const normalizedIdentifier = identifier.trim().toLowerCase();
  
  // Try to find team by name first (for admin login)
  let team = db
    .prepare("SELECT name, password, is_admin, is_master_admin FROM teams WHERE LOWER(name) = ?")
    .get(normalizedIdentifier) as { name: string; password: string; is_admin: number; is_master_admin?: number } | undefined;

  // If not found by name, try by EXACT registration number match
  if (!team) {
    team = db
      .prepare("SELECT name, password, is_admin, is_master_admin FROM teams WHERE LOWER(registration_numbers) = ?")
      .get(normalizedIdentifier) as { name: string; password: string; is_admin: number; is_master_admin?: number } | undefined;
  }

  if (!team) {
    return { valid: false, isAdmin: false, isMasterAdmin: false, actualName: "" };
  }

  // Verify password using SHA-256 hash comparison
  if (!verifyPassword(password, team.password)) {
    return { valid: false, isAdmin: false, isMasterAdmin: false, actualName: "" };
  }

  return { 
    valid: true, 
    isAdmin: team.is_admin === 1, 
    isMasterAdmin: team.is_master_admin === 1,
    actualName: team.name 
  };
}

// Validate team by registration number only (passwordless login for participants)
export function validateTeamByRegistration(
  registrationNumber: string
): { valid: boolean; actualName: string } {
  const normalizedReg = registrationNumber.trim().toLowerCase();
  
  // Try to find team by registration number
  let team = db
    .prepare("SELECT name, is_admin FROM teams WHERE LOWER(registration_numbers) = ?")
    .get(normalizedReg) as { name: string; is_admin: number } | undefined;

  // If not found by exact match, try partial match (in case of multiple registration numbers)
  if (!team) {
    team = db
      .prepare("SELECT name, is_admin FROM teams WHERE LOWER(registration_numbers) LIKE ?")
      .get(`%${normalizedReg}%`) as { name: string; is_admin: number } | undefined;
  }
  
  // Also try matching by team name for convenience
  if (!team) {
    team = db
      .prepare("SELECT name, is_admin FROM teams WHERE LOWER(name) = ? AND is_admin = 0")
      .get(normalizedReg) as { name: string; is_admin: number } | undefined;
  }

  if (!team || team.is_admin === 1) {
    // Don't allow passwordless login for admins
    return { valid: false, actualName: "" };
  }

  return { valid: true, actualName: team.name };
}

// ============ Admin Management (Master Admin Only) ============

export function addAdmin(username: string, password: string): boolean {
  try {
    const hashedPassword = hashPassword(password);
    db.prepare(
      "INSERT INTO teams (name, password, plain_password, is_admin, score, is_master_admin) VALUES (?, ?, ?, 1, 0, 0)"
    ).run(username, hashedPassword, password);
    return true;
  } catch (error) {
    console.error("Error adding admin:", error);
    return false;
  }
}

export function removeAdmin(username: string): boolean {
  try {
    // Cannot remove master admin
    const team = db.prepare("SELECT is_master_admin FROM teams WHERE name = ?").get(username) as { is_master_admin?: number } | undefined;
    if (!team || team.is_master_admin === 1) {
      return false;
    }
    const result = db.prepare("DELETE FROM teams WHERE name = ? AND is_admin = 1 AND is_master_admin = 0").run(username);
    return result.changes > 0;
  } catch {
    return false;
  }
}

export function getAdmins(): { name: string; isMasterAdmin: boolean }[] {
  const admins = db.prepare("SELECT name, is_master_admin FROM teams WHERE is_admin = 1").all() as { name: string; is_master_admin?: number }[];
  return admins.map(a => ({ name: a.name, isMasterAdmin: a.is_master_admin === 1 }));
}

// ============ Database CLI (Master Admin Only) ============

export interface DbQueryResult {
  success: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  changes?: number;
  error?: string;
}

export function executeQuery(query: string): DbQueryResult {
  try {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Prevent dangerous operations
    if (trimmedQuery.includes("drop database") || trimmedQuery.includes("drop table teams")) {
      return { success: false, error: "This operation is not allowed" };
    }
    
    if (trimmedQuery.startsWith("select")) {
      const stmt = db.prepare(query);
      const rows = stmt.all() as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { success: true, columns, rows };
    } else {
      const stmt = db.prepare(query);
      const result = stmt.run();
      return { success: true, changes: result.changes };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getTableSchema(): { tables: string[]; schema: Record<string, string[]> } {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  const schema: Record<string, string[]> = {};
  
  for (const table of tables) {
    const cols = db.prepare(`PRAGMA table_info(${table.name})`).all() as { name: string }[];
    schema[table.name] = cols.map(c => c.name);
  }
  
  return { tables: tables.map(t => t.name), schema };
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

// ============ Relay Race System ============

export interface TeamMember {
  id: string;
  name: string;
  index: number;
}

export interface RelayState {
  teamName: string;
  currentMemberId: string;
  currentMemberIndex: number;
  relayStartTime: number;
  relayEndTime: number;
  relayNumber: number;
  previousMemberId: string | null;
  sharedCode: string;
  sharedLanguage: string;
  relayHistory: string[];
  members: TeamMember[];
}

// Get relay duration from competition settings (in minutes)
export function getRelayDuration(): number {
  const comp = db.prepare("SELECT relay_duration FROM competition WHERE id = 1").get() as { relay_duration: number } | undefined;
  return comp?.relay_duration || 5;
}

// Set relay duration (admin only)
export function setRelayDuration(minutes: number): void {
  db.prepare("UPDATE competition SET relay_duration = ? WHERE id = 1").run(minutes);
}

// Add team members when creating/updating a team
export function setTeamMembers(teamName: string, memberIds: string[]): boolean {
  try {
    // Clear existing members
    db.prepare("DELETE FROM team_members WHERE team_name = ?").run(teamName);
    
    // Add new members (2-4 members)
    const insert = db.prepare(
      "INSERT INTO team_members (team_name, member_id, member_name, member_index) VALUES (?, ?, ?, ?)"
    );
    
    for (let i = 0; i < memberIds.length; i++) {
      insert.run(teamName, memberIds[i].trim().toLowerCase(), memberIds[i].trim(), i);
    }
    
    // Update team size
    db.prepare("UPDATE teams SET team_size = ? WHERE name = ?").run(memberIds.length, teamName);
    
    return true;
  } catch (error) {
    console.error("Error setting team members:", error);
    return false;
  }
}

// Get team members
export function getTeamMembers(teamName: string): TeamMember[] {
  const members = db.prepare(
    "SELECT member_id, member_name, member_index FROM team_members WHERE team_name = ? ORDER BY member_index"
  ).all(teamName) as { member_id: string; member_name: string; member_index: number }[];
  
  return members.map(m => ({
    id: m.member_id,
    name: m.member_name || m.member_id,
    index: m.member_index,
  }));
}

// Get which team a member belongs to
export function getMemberTeam(memberId: string): string | null {
  const normalizedId = memberId.trim().toLowerCase();
  const result = db.prepare(
    "SELECT team_name FROM team_members WHERE LOWER(member_id) = ?"
  ).get(normalizedId) as { team_name: string } | undefined;
  return result?.team_name || null;
}

// Validate member login and get their team
export function validateMemberLogin(memberId: string): { valid: boolean; teamName: string; memberIndex: number } {
  const normalizedId = memberId.trim().toLowerCase();
  const result = db.prepare(
    "SELECT team_name, member_index FROM team_members WHERE LOWER(member_id) = ?"
  ).get(normalizedId) as { team_name: string; member_index: number } | undefined;
  
  if (!result) {
    return { valid: false, teamName: "", memberIndex: -1 };
  }
  
  return { valid: true, teamName: result.team_name, memberIndex: result.member_index };
}

// Initialize relay state for a team when competition starts
export function initializeRelayState(teamName: string): RelayState | null {
  const members = getTeamMembers(teamName);
  if (members.length < 2) return null;
  
  const relayDuration = getRelayDuration();
  const now = Date.now();
  const endTime = now + relayDuration * 60 * 1000;
  
  // Start with a random member
  const randomIndex = Math.floor(Math.random() * members.length);
  const firstMember = members[randomIndex];
  
  try {
    db.prepare(`
      INSERT OR REPLACE INTO relay_state 
      (team_name, current_member_id, current_member_index, relay_start_time, relay_end_time, relay_number, previous_member_id, shared_code, shared_language, relay_history)
      VALUES (?, ?, ?, ?, ?, 1, NULL, '', 'python', ?)
    `).run(teamName, firstMember.id, firstMember.index, now, endTime, JSON.stringify([firstMember.id]));
    
    return getRelayState(teamName);
  } catch (error) {
    console.error("Error initializing relay state:", error);
    return null;
  }
}

// Get current relay state for a team
export function getRelayState(teamName: string): RelayState | null {
  const state = db.prepare(
    "SELECT * FROM relay_state WHERE team_name = ?"
  ).get(teamName) as {
    team_name: string;
    current_member_id: string;
    current_member_index: number;
    relay_start_time: number;
    relay_end_time: number;
    relay_number: number;
    previous_member_id: string | null;
    shared_code: string;
    shared_language: string;
    relay_history: string;
  } | undefined;
  
  if (!state) return null;
  
  const members = getTeamMembers(teamName);
  
  return {
    teamName: state.team_name,
    currentMemberId: state.current_member_id,
    currentMemberIndex: state.current_member_index,
    relayStartTime: state.relay_start_time,
    relayEndTime: state.relay_end_time,
    relayNumber: state.relay_number,
    previousMemberId: state.previous_member_id,
    sharedCode: state.shared_code,
    sharedLanguage: state.shared_language,
    relayHistory: JSON.parse(state.relay_history || "[]"),
    members,
  };
}

// Check if relay needs to transition to next member
export function checkAndTransitionRelay(teamName: string): RelayState | null {
  const state = getRelayState(teamName);
  if (!state) return null;
  
  const now = Date.now();
  
  // If relay time hasn't expired, return current state
  if (now < state.relayEndTime) {
    return state;
  }
  
  // Time to transition to next member
  return transitionToNextMember(teamName);
}

// Transition to next member (called when timer expires)
export function transitionToNextMember(teamName: string): RelayState | null {
  const state = getRelayState(teamName);
  if (!state || state.members.length < 2) return null;
  
  const relayDuration = getRelayDuration();
  const now = Date.now();
  const endTime = now + relayDuration * 60 * 1000;
  
  // Get list of eligible members (exclude current member to prevent consecutive turns)
  const eligibleMembers = state.members.filter(m => m.id !== state.currentMemberId);
  
  if (eligibleMembers.length === 0) {
    // Fallback: allow any member if somehow there's only one
    return state;
  }
  
  // Select random member from eligible ones
  const randomIndex = Math.floor(Math.random() * eligibleMembers.length);
  const nextMember = eligibleMembers[randomIndex];
  
  // Update relay history
  const history = [...state.relayHistory, nextMember.id];
  
  try {
    db.prepare(`
      UPDATE relay_state SET
        current_member_id = ?,
        current_member_index = ?,
        relay_start_time = ?,
        relay_end_time = ?,
        relay_number = relay_number + 1,
        previous_member_id = ?,
        relay_history = ?
      WHERE team_name = ?
    `).run(nextMember.id, nextMember.index, now, endTime, state.currentMemberId, JSON.stringify(history), teamName);
    
    // Log the transition
    logActivity(teamName, "RELAY_TRANSITION", `Relay ${state.relayNumber + 1}: ${nextMember.name} is now coding`);
    
    return getRelayState(teamName);
  } catch (error) {
    console.error("Error transitioning relay:", error);
    return null;
  }
}

// Update shared code (only by active member)
export function updateSharedCode(teamName: string, memberId: string, code: string, language: string): boolean {
  const state = getRelayState(teamName);
  if (!state) return false;
  
  // Verify this member is the active one
  const normalizedMemberId = memberId.trim().toLowerCase();
  if (state.currentMemberId.toLowerCase() !== normalizedMemberId) {
    return false; // Not the active member
  }
  
  try {
    db.prepare(
      "UPDATE relay_state SET shared_code = ?, shared_language = ? WHERE team_name = ?"
    ).run(code, language, teamName);
    return true;
  } catch (error) {
    console.error("Error updating shared code:", error);
    return false;
  }
}

// Check if a member is currently the active relay member
export function isActiveMember(teamName: string, memberId: string): boolean {
  const state = getRelayState(teamName);
  if (!state) return false;
  
  const normalizedMemberId = memberId.trim().toLowerCase();
  return state.currentMemberId.toLowerCase() === normalizedMemberId;
}

// Clear relay state (when competition ends or is reset)
export function clearRelayState(teamName?: string): void {
  if (teamName) {
    db.prepare("DELETE FROM relay_state WHERE team_name = ?").run(teamName);
  } else {
    db.prepare("DELETE FROM relay_state").run();
  }
}

// Initialize relay for all teams when competition starts
export function initializeAllRelays(): number {
  const teams = db.prepare(
    "SELECT name FROM teams WHERE is_admin = 0 AND is_banned = 0"
  ).all() as { name: string }[];
  
  let initialized = 0;
  for (const team of teams) {
    const members = getTeamMembers(team.name);
    if (members.length >= 2) {
      const state = initializeRelayState(team.name);
      if (state) initialized++;
    }
  }
  
  return initialized;
}

export default db;
