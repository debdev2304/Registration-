# Registration System

Participant registration with OTP login, admin approvals, team management, PDF export, and audit logs.

## Prerequisites
- Node.js 18+

## Setup
1. Install dependencies:
```
npm install
```
2. Create `.env` (example):
```
SESSION_SECRET=change_this_in_production
ADMIN_USERNAME=9999999999
# bcrypt hash for admin password (e.g., admin123)
ADMIN_PASSWORD_HASH=$2b$10$1a99cQbkfXA3oU0gZ.lsn./BaKUhbxZ/bmJ4ZrrM9trskIL7ph4sm
PORT=3000
BASE_URL=http://localhost:3000
```
3. Seed database:
```
npm run seed
```
4. Start server:
```
npm run start
```

## Flows
- Participant login: phone -> OTP -> verify -> registration form.
- Registration: select team, enter name, aadhar (12 digits), institute -> submit (pending).
- Admin login: use `ADMIN_USERNAME` (phone) and password matching `ADMIN_PASSWORD_HASH`.
- Admin dashboard: create teams, view pending requests, approve/reject.
- On approval: timestamp stored, member added to team, team PDF generated/updated at `GET /admin/teams/:id/pdf`.
- Audit logs: `GET /admin/audit`.

## Notes
- OTP is logged to server console for development.
- PDFs saved under `pdf/` directory.
- Database file stored at `data/app.db`.
