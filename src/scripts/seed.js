'use strict';

require('dotenv').config();
const { db } = require('../db');

function main() {
	const adminPhone = process.env.ADMIN_USERNAME || '9999999999';
	db.prepare('INSERT OR IGNORE INTO users (phone, is_admin, name) VALUES (?, 1, ?)').run(adminPhone, 'Admin');
	db.prepare('INSERT OR IGNORE INTO teams (name) VALUES (?)').run('Team Alpha');
	console.log('Seed completed. Admin phone:', adminPhone);
}

main();
