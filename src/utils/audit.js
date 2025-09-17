'use strict';

const { db } = require('../db');

function logAudit(actorUserId, action, detailsObj) {
	try {
		const details = detailsObj ? JSON.stringify(detailsObj) : null;
		db.prepare("INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?, ?, ?)").run(actorUserId || null, String(action), details);
	} catch (e) {
		console.error('audit log failed', e);
	}
}

module.exports = { logAudit };
