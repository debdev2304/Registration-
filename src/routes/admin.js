'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');

const { db } = require('../db');
const { maskPhone, maskAadhar } = require('../utils/mask');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const FIXED_ADMIN_PHONE = '9641072337';
const FIXED_ADMIN_CODE = 'Itsallscripted';

function requireAdmin(req, res, next) {
	if (!req.session.adminId) return res.redirect('/admin/login');
	next();
}

router.get('/login', (req, res) => {
	res.render('admin/login');
});

router.post('/login', (req, res) => {
	const { code } = req.body;
	const ok = code && code === FIXED_ADMIN_CODE;
	if (!ok) {
		logAudit(null, 'admin_login_failed', { code_provided: Boolean(code) });
		return res.status(401).render('admin/login', { error: 'Invalid access code' });
	}
	// Ensure fixed admin user exists
	db.prepare('INSERT OR IGNORE INTO users (phone, is_admin, name) VALUES (?, 1, ?)').run(FIXED_ADMIN_PHONE, 'Admin');
	const admin = db.prepare('SELECT * FROM users WHERE phone = ?').get(FIXED_ADMIN_PHONE);
	req.session.adminId = admin.id;
	logAudit(admin.id, 'admin_login_success', { phone: FIXED_ADMIN_PHONE });
	res.redirect('/admin');
});

router.get('/', requireAdmin, (req, res) => {
	const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();
	const pending = db.prepare("SELECT r.*, t.name AS team_name FROM registrations r JOIN teams t ON r.team_id = t.id WHERE r.status = 'pending' ORDER BY r.submitted_at").all();
	res.render('admin/dashboard', { teams, pending });
});

router.post('/teams', requireAdmin, (req, res) => {
	const { name } = req.body;
	if (!name) return res.redirect('/admin');
	try {
		db.prepare('INSERT INTO teams (name) VALUES (?)').run(name.trim());
		logAudit(req.session.adminId, 'team_created', { name: name.trim() });
	} catch (e) {
		console.error(e);
	}
	res.redirect('/admin');
});

router.post('/requests/:id/approve', requireAdmin, (req, res) => {
	const id = Number(req.params.id);
	const request = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
	if (!request || request.status !== 'pending') return res.redirect('/admin');
	const now = dayjs().toISOString();
	db.prepare("UPDATE registrations SET status='approved', approved_at = ?, reviewer_admin_id = ? WHERE id = ?").run(now, req.session.adminId, id);
	try {
		db.prepare('INSERT OR IGNORE INTO users (phone, is_admin) VALUES (?, 0)').run(request.phone);
		const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(request.phone);
		if (request.participant_name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(request.participant_name, user.id);
		if (request.aadhar) db.prepare('UPDATE users SET aadhar = ? WHERE id = ?').run(request.aadhar, user.id);
		if (request.institute) db.prepare('UPDATE users SET institute = ? WHERE id = ?').run(request.institute, user.id);
		db.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)').run(request.team_id, user.id);
	} catch (e) {
		console.error(e);
	}
	logAudit(req.session.adminId, 'registration_approved', { request_id: id, team_id: request.team_id });
	generateTeamPdf(request.team_id);
	res.redirect('/admin');
});

router.post('/requests/:id/reject', requireAdmin, (req, res) => {
	const id = Number(req.params.id);
	const request = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
	if (!request || request.status !== 'pending') return res.redirect('/admin');
	db.prepare("UPDATE registrations SET status='rejected', rejected_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), reviewer_admin_id = ? WHERE id = ?").run(req.session.adminId, id);
	logAudit(req.session.adminId, 'registration_rejected', { request_id: id, team_id: request.team_id });
	res.redirect('/admin');
});

router.get('/teams/:id/pdf', requireAdmin, (req, res) => {
	const teamId = Number(req.params.id);
	const pdfPath = ensureTeamPdfPath(teamId);
	if (!fs.existsSync(pdfPath)) generateTeamPdf(teamId);
	logAudit(req.session.adminId, 'team_pdf_viewed', { team_id: teamId });
	res.sendFile(pdfPath);
});

router.get('/audit', requireAdmin, (req, res) => {
	const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all();
	res.render('admin/audit', { logs });
});

function ensureTeamPdfPath(teamId) {
	const dir = path.join(__dirname, '..', '..', 'pdf');
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	return path.join(dir, `team_${teamId}.pdf`);
}

function generateTeamPdf(teamId) {
	const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
	if (!team) return;
	const members = db.prepare(`SELECT u.name, u.phone, u.aadhar, u.institute, m.joined_at
		FROM team_members m JOIN users u ON m.user_id = u.id WHERE m.team_id = ? ORDER BY m.joined_at`).all(teamId);
	const requests = db.prepare(`SELECT participant_name, phone, aadhar, institute, approved_at FROM registrations WHERE team_id = ? AND status = 'approved' ORDER BY approved_at`).all(teamId);
	const lead = team.team_lead_user_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(team.team_lead_user_id) : null;

	const pdfPath = ensureTeamPdfPath(teamId);
	const doc = new PDFDocument({ margin: 50 });
	doc.pipe(fs.createWriteStream(pdfPath));

	doc.fontSize(18).text(`Team: ${team.name}`);
	doc.moveDown(0.5);
	doc.fontSize(12).text(`Team Lead: ${lead ? lead.name || 'N/A' : 'N/A'}`);
	doc.moveDown();

	doc.fontSize(14).text('Approved Participants');
	doc.moveDown(0.5);
	const rows = requests.length ? requests : members;
	rows.forEach((r, idx) => {
		doc.fontSize(12).text(`${idx + 1}. ${r.participant_name || r.name || 'N/A'}`);
		doc.fontSize(10).text(`   Phone: ${maskPhone(r.phone || '')}`);
		doc.text(`   Aadhar: ${maskAadhar(r.aadhar || '')}`);
		doc.text(`   Institute: ${r.institute || 'N/A'}`);
		doc.text(`   Approval Timestamp: ${r.approved_at || r.joined_at || 'N/A'}`);
		doc.moveDown(0.25);
	});

	doc.end();
}

module.exports = router;
