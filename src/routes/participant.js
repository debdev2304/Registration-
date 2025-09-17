'use strict';

const express = require('express');
const { db } = require('../db');
const { nanoid } = require('nanoid');
const dayjs = require('dayjs');
const { isValidPhone, isValidAadhar } = require('../utils/validate');
const { logAudit } = require('../utils/audit');

const router = express.Router();

function requireParticipant(req, res, next) {
	if (!req.session.userId) {
		return res.redirect('/participant/login');
	}
	next();
}

router.get('/login', (req, res) => {
	res.render('participant/login');
});

router.post('/otp/request', (req, res) => {
	const { phone } = req.body;
	if (!isValidPhone(phone)) {
		return res.status(400).render('participant/login', { error: 'Enter valid 10-digit phone' });
	}
	const code = String(Math.floor(100000 + Math.random() * 900000));
	const expiresAt = Date.now() + 5 * 60 * 1000;
	db.prepare(`INSERT INTO otps (phone, code, expires_at, created_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
		ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, created_at=excluded.created_at`).run(phone, code, expiresAt);
	console.log(`[OTP] ${phone} -> ${code}`);
	logAudit(null, 'otp_requested', { phone });
	res.render('participant/verify', { phone });
});

router.post('/otp/verify', (req, res) => {
	const { phone, code } = req.body;
	const row = db.prepare('SELECT code, expires_at FROM otps WHERE phone = ?').get(phone);
	if (!row || row.code !== code || Date.now() > Number(row.expires_at)) {
		logAudit(null, 'otp_failed', { phone });
		return res.status(400).render('participant/verify', { phone, error: 'Invalid or expired OTP' });
	}
	db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);
	let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
	if (!user) {
		db.prepare("INSERT INTO users (phone, is_admin) VALUES (?, 0)").run(phone);
		user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
	}
	req.session.userId = user.id;
	logAudit(user.id, 'login_success', { phone });
	res.redirect('/participant/register');
});

router.get('/register', requireParticipant, (req, res) => {
	const teams = db.prepare('SELECT id, name FROM teams ORDER BY name').all();
	res.render('participant/register', { teams });
});

router.post('/register', requireParticipant, (req, res) => {
	const { team_id, name, aadhar, institute } = req.body;
	const userId = req.session.userId;
	const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
	if (!user) return res.redirect('/participant/login');
	if (!name || !isValidAadhar(aadhar) || !institute) {
		const teams = db.prepare('SELECT id, name FROM teams ORDER BY name').all();
		return res.status(400).render('participant/register', { teams, error: 'Fill all fields. Aadhar must be 12 digits.' });
	}
	const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(team_id);
	if (!team) {
		const teams = db.prepare('SELECT id, name FROM teams ORDER BY name').all();
		return res.status(400).render('participant/register', { teams, error: 'Choose a valid team.' });
	}
	db.prepare(`INSERT INTO registrations (user_id, team_id, status, participant_name, aadhar, institute, phone)
		VALUES (?, ?, 'pending', ?, ?, ?, ?)`).run(userId, team.id, name, aadhar, institute, user.phone);
	logAudit(userId, 'registration_submitted', { team_id: team.id });
	res.render('participant/submitted');
});

router.get('/logout', (req, res) => {
	logAudit(req.session.userId || null, 'logout', {});
	req.session.destroy(() => res.redirect('/participant/login'));
});

module.exports = router;
