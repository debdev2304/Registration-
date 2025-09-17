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
- Admin login: fixed phone (9641072337) with access code.
- Admin dashboard: create teams, view pending requests, approve/reject.
- On approval: timestamp stored, member added to team, team PDF generated/updated at `GET /admin/teams/:id/pdf`.
- Audit logs: `GET /admin/audit`.

## Cloud Run Deployment (via Cloud Build)
This repo includes a `Dockerfile`, `.dockerignore`, and `cloudbuild.yaml` configured for Artifact Registry and Cloud Run.

1) Create Artifact Registry repository (once):
```
gcloud artifacts repositories create registry \
  --repository-format=docker --location=asia-south1
```

2) Create secrets (optional but recommended):
```
gcloud secrets create SESSION_SECRET --replication-policy=automatic
printf "your-strong-secret" | gcloud secrets versions add SESSION_SECRET --data-file=-

gcloud secrets create BASE_URL --replication-policy=automatic
printf "https://your-cloud-run-url" | gcloud secrets versions add BASE_URL --data-file=-
```

3) Build & push image with Cloud Build (substitute your values):
```
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=asia-south1,_PROJECT_ID=YOUR_PROJECT_ID,_REPO=registry,_SERVICE=registration
```

The build will:
- docker build the image from `Dockerfile`
- push to Artifact Registry
- deploy to Cloud Run (managed) with `PORT=8080`

Cloud Run sets `PORT` automatically. The app reads `process.env.PORT`.

If you see `docker exit code 125` in Cloud Build, ensure:
- `.dockerignore` excludes `.env`, `node_modules`, `data`, `pdf`
- `Dockerfile` exists at repo root
- Artifact Registry `registry` exists in your region
- Your Cloud Build SA has `Artifact Registry Writer` and `Cloud Run Admin` roles

## Notes
- OTP is logged to server console for development.
- PDFs saved under `pdf/` directory when running locally; in Cloud Run, PDFs are ephemeral.
- Database file stored at `data/app.db` locally; for production use Cloud SQL or other persistence.
