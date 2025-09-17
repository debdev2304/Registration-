'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	phone TEXT NOT NULL UNIQUE,
	name TEXT,
	aadhar TEXT,
	institute TEXT,
	is_admin INTEGER DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS teams (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	team_lead_user_id INTEGER,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (team_lead_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS registrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	team_id INTEGER NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
	participant_name TEXT NOT NULL,
	aadhar TEXT NOT NULL,
	institute TEXT NOT NULL,
	phone TEXT NOT NULL,
	submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	approved_at TEXT,
	rejected_at TEXT,
	reviewer_admin_id INTEGER,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (team_id) REFERENCES teams(id),
	FOREIGN KEY (reviewer_admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_members (
	team_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	PRIMARY KEY (team_id, user_id),
	FOREIGN KEY (team_id) REFERENCES teams(id),
	FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS otps (
	phone TEXT PRIMARY KEY,
	code TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	actor_user_id INTEGER,
	action TEXT NOT NULL,
	details TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
`);

function runInTransaction(work) {
	const begin = db.prepare('BEGIN');
	const commit = db.prepare('COMMIT');
	const rollback = db.prepare('ROLLBACK');
	return () => {
		begin.run();
		try {
			const result = work();
			commit.run();
			return result;
		} catch (err) {
			rollback.run();
			throw err;
		}
	};
}

module.exports = {
	db,
	runInTransaction
};
