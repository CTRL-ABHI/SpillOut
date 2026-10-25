# SPILLOUT: Production Deployment & Repair Guide

> Complete, step-by-step production deployment guide for SPILLOUT with Vercel (Frontend), Render (Backend & WebSockets), and Neon (PostgreSQL Account Database).

---

## 1. Architectural Overview & Hosting Decision

SPILLOUT is an unconventional, privacy-first communication platform designed with strict security guarantees:
- **Zero-Archive In-Memory Chat**: Messages exist strictly in RAM and are never persisted to disk or database.
- **Genuine E2EE**: Native Web Crypto API (`ECDH P-256`, `HKDF-SHA256`, `AES-GCM-256`) with ephemeral client keys.
- **Real-Time WebSockets (`/ws`)**: Used for live presence tracking, instant message relay, and WebRTC DTLS-SRTP voice call signaling.
- **7-Day Automatic Account Inactivity Deletion**: Inactive accounts are permanently evicted by a server-side timer daemon.

### Why Render (Backend) + Vercel (Frontend) + Neon (Database)?

| Component | Selected Platform | Rationale |
| :--- | :--- | :--- |
| **Frontend** | **Vercel** | Delivers ultra-fast Next.js SSR, static page optimization, edge caching, and seamless App Router routing. |
| **Backend & WebSockets** | **Render** | **Vercel Serverless Functions do not support persistent WebSockets.** Persistent WebSockets (`/ws`) and the background inactivity cleanup daemon require a continuous, long-running Node.js process. Render provides a native Node.js runtime with full WebSocket and HTTP support. |
| **Account Database** | **Neon PostgreSQL** | Serverless, managed PostgreSQL with native connection pooling, high availability, and SSL encryption. Stores only `User` and `Session` records; **never stores chat history or call recordings**. |

---

## 2. Root Cause of the Original HTTP 500 Error

When logging in on the live site, the frontend displayed:
`Request failed with status 500`

### Identified Causes:
1. **Missing Backend Proxy Destination (`BACKEND_API_URL`)**: Next.js in `client/next.config.mjs` was configured to proxy `/api/:path*` to `BACKEND_API_URL`. Because this environment variable was not configured in Vercel, Next.js defaulted to `http://localhost:4000/api/:path*`. When a user clicked "Log In", Next.js attempted to reach `localhost:4000` inside Vercel's serverless worker, which immediately threw `ECONNREFUSED` and returned a 500 HTML error page.
2. **Missing Backend Service Entrypoint**: `server/src/index.ts` had no default export and called `main()` unconditionally, preventing serverless function execution.
3. **Database Unavailability & Provider Mismatch**: Without a hosted PostgreSQL connection string (`DATABASE_URL`), the server attempted to write to `/tmp/spillout.db`, which is wiped across serverless cold starts. If PostgreSQL was set at runtime, Prisma Client failed because it had been built for SQLite.
4. **Opaque Error Fallback**: In `client/src/lib/api.ts`, parsing non-JSON HTML error pages resulted in an empty body `{}` with an undefined `body.error`, causing the frontend to fall back to the generic message `"Request failed with status 500"`.

All four root causes have been resolved in the codebase.

---

## 3. Environment Variable Reference

### Backend Variables (Configure in Render Dashboard)
| Variable Name | Required? | Secret? | Description & Format | How to Obtain | Deployment Restart Required? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `DATABASE_URL` | **Yes** | **Yes** | PostgreSQL connection string with SSL | Copy from Neon Dashboard (starts with `postgresql://`) | Yes |
| `NODE_ENV` | **Yes** | No | Set to `production` | Set manually to `production` | Yes |
| `PORT` | **Yes** | No | Internal server port (Render default `4000` or auto-assigned) | Set to `4000` | Yes |
| `CLIENT_ORIGIN` | **Yes** | No | Full URL of your Vercel frontend | E.g., `https://spillout.vercel.app` | Yes |
| `COOKIE_SECRET` | **Yes** | **Yes** | Random 32+ character key for signing cookies | Generate via `openssl rand -hex 32` | Yes |
| `SESSION_TTL_HOURS` | No | No | Session duration in hours (default `168` = 7 days) | Set to `168` | Yes |
| `INACTIVITY_EXPIRATION_DAYS` | No | No | Inactivity deletion window (default `7` days) | Set to `7` | Yes |

### Frontend Variables (Configure in Vercel Dashboard)
| Variable Name | Required? | Secret? | Description & Format | How to Obtain | Deployment Restart Required? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `BACKEND_API_URL` | **Yes** | No | Public backend API URL with `/api` suffix | Your Render URL + `/api` (e.g. `https://spillout-api.onrender.com/api`) | Yes (Redeploy) |
| `NEXT_PUBLIC_WS_URL` | **Yes** | No | Public backend WebSocket URL with `/ws` suffix | Your Render URL with `wss://` + `/ws` (e.g. `wss://spillout-api.onrender.com/ws`) | Yes (Redeploy) |

> [!IMPORTANT]
> **Do NOT configure `DATABASE_URL` or `COOKIE_SECRET` on Vercel.** Because the backend is hosted on Render, only Render connects directly to the database. Keeping database credentials off Vercel prevents accidental exposure in client-side bundles.

---

## 4. Complete Step-by-Step Deployment Procedure

### Step 1: Push Code Fixes to GitHub
Open your terminal in the workspace root and run:
```bash
git push origin main
```
Confirm that the commit containing the production fixes is pushed to your GitHub repository.

---

### Step 2: Create Free PostgreSQL Database on Neon
1. Go to [https://neon.tech](https://neon.tech) and sign up / log in with GitHub.
2. Click **Create a project** (or **+ New Project**).
3. Set **Project Name** to `spillout-db`.
4. Choose the region closest to you or your users (e.g., `US East` or `Frankfurt`).
5. Click **Create Project**.
6. On your project dashboard under **Connection Details**:
   - Ensure the dropdown shows **Pooled connection**.
   - Click the **Copy** button to copy the connection string.
   - It will look like:
     ```
     postgresql://neondb_owner:npg_xxxxxxxxxxxx@ep-cool-lake-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - Save this value as your `DATABASE_URL`.

---

### Step 3: Deploy Backend on Render

#### Option A: Quick Deploy with Render Blueprint (`render.yaml`)
1. Go to [https://dashboard.render.com](https://dashboard.render.com) and log in with GitHub.
2. Click **+ New** (top right) → **Blueprint**.
3. Connect your `SpillOut` repository.
4. Render will automatically read `render.yaml` from the repository root:
   - It will configure the service name (`spillout-backend`), runtime (`Node`), root directory (`server`), build command, and start command automatically.
5. Render will prompt you for the uncommitted variables:
   - `DATABASE_URL`: Paste your Neon connection string.
   - `CLIENT_ORIGIN`: Enter your Vercel URL (e.g. `https://your-spillout.vercel.app`).
6. Click **Apply**.

#### Option B: Manual Web Service Setup on Render
1. Go to [https://dashboard.render.com](https://dashboard.render.com) → Click **+ New** → **Web Service**.
2. Select **Build and deploy from a Git repository** → Connect your `SpillOut` repository.
3. Configure the following exact settings:
   - **Name**: `spillout-api`
   - **Region**: Choose the same or closest region to your Neon DB.
   - **Branch**: `main`
   - **Root Directory**: `server` *(Important: must be `server`)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: `Free`
4. Under **Environment Variables**, click **Add Environment Variable** for each:
   - `DATABASE_URL` = *(Your Neon connection string)*
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
   - `CLIENT_ORIGIN` = `https://your-spillout.vercel.app`
   - `COOKIE_SECRET` = *(Any random 32+ character string)*
   - `SESSION_TTL_HOURS` = `168`
   - `INACTIVITY_EXPIRATION_DAYS` = `7`
5. Click **Create Web Service**.
6. Wait 2-3 minutes until the log displays:
   ```
   ==> Your service is live 🎉
   ```
7. Copy your public service URL from the top of the page (e.g., `https://spillout-api.onrender.com`).

---

### Step 4: Run Database Schema Synchronization
The server automatically initializes required PostgreSQL tables on first connection. However, to explicitly sync your schema using the Prisma CLI from your local machine:
```bash
# In the server directory:
cd server

# Set your temporary production DATABASE_URL (PowerShell example):
$env:DATABASE_URL="postgresql://neondb_owner:pass@ep-xyz-pooler.aws.neon.tech/neondb?sslmode=require"

# Push schema directly to Neon PostgreSQL (non-destructive):
npx prisma db push --schema=prisma/schema.postgresql.prisma
```
This safely creates the `User` and `Session` tables, along with all unique indexes.

---

### Step 5: Configure Environment Variables on Vercel
1. Open the [Vercel Dashboard](https://vercel.com) and click into your **SpillOut** project.
2. Navigate to **Settings** → **Environment Variables**.
3. Add the following two variables (select **Production**, **Preview**, and **Development**):
   - **`BACKEND_API_URL`**: `https://spillout-api.onrender.com/api` *(Your Render URL followed by `/api`)*
   - **`NEXT_PUBLIC_WS_URL`**: `wss://spillout-api.onrender.com/ws` *(Your Render URL starting with `wss://` and ending with `/ws`)*
4. Click **Save**.

---

### Step 6: Redeploy on Vercel
1. In your Vercel project, go to the **Deployments** tab.
2. Find the top deployment, click the **three dots (`...`)** on the right side, and select **Redeploy**.
3. In the confirmation dialog, click **Redeploy**.
4. Wait until the deployment status turns green with **Ready**.

---

## 5. Production Verification Checklist

Run through this verification sequence to confirm full system readiness:

### 1. Database Health Check Endpoint
Open in your browser:
```
https://your-spillout.vercel.app/api/health
```
**Expected Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "service": "SPILLOUT-API",
  "database": "connected",
  "timestamp": "2026-10-25T..."
}
```
*(If `database` reports `"connected"`, the end-to-end handshake between Vercel proxy, Render backend, and Neon PostgreSQL is fully operational).*

### 2. User Registration (Sign Up)
1. Navigate to `https://your-spillout.vercel.app`.
2. Click **Create one** at the bottom of the login box.
3. Enter an alphanumeric username (e.g., `Alex01`, max 10 chars).
4. Select a gender identity (`Male`, `Female`, or `Object`).
5. Enter a 9-cell password matrix and confirm it identically.
6. Click **Create Encrypted Account**.
7. Confirm you are immediately logged in, an identity key pair is generated in client memory, and the real-time dashboard renders.

### 3. User Login
1. Click **Log Out** in the dashboard header.
2. On the login form, enter `Alex01` and your 9-cell matrix password.
3. Click **Log In to SpillOut**.
4. Confirm successful authentication with **zero 500 errors**.

### 4. Real-Time End-to-End Encrypted Messaging
1. Open an Incognito window and register a second account (e.g., `Sam02`).
2. Click **Start Conversation** and search for `Alex01`.
3. Send an encrypted message: verify instant delivery via WebSocket relay.
4. Verify safety fingerprint numbers: click the shield badge on the chat header to verify safety numbers match on both screens.
5. Refresh the browser: confirm that message history is completely wiped from memory (Zero-Archive guarantee).

### 5. WebRTC Encrypted Voice Calling
1. Click the **Voice Call** icon in the conversation header.
2. Verify incoming call ringing on the second client.
3. Accept the call: verify direct browser peer-to-peer audio connection over DTLS-SRTP.

---

## 6. Troubleshooting Common Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `Request failed with status 500` | `BACKEND_API_URL` missing or misspelled in Vercel | Verify that `BACKEND_API_URL` is configured in Vercel under Environment Variables as `https://<render-subdomain>.onrender.com/api`, then trigger a Redeploy. |
| `/api/health` returns `database: disconnected` | `DATABASE_URL` missing or invalid on Render | Verify that the Neon connection string is pasted correctly in Render environment variables with `?sslmode=require`. |
| WebSocket connection fails (`wss://.../ws`) | Render free tier service is spinning up | Render's free tier spins down after 15 minutes of inactivity. The first request takes 30-45 seconds to wake up. Once awake, WebSockets connect immediately. |
| CORS error in browser console | `CLIENT_ORIGIN` on Render does not match Vercel URL | In Render dashboard, set `CLIENT_ORIGIN` to match your Vercel URL (e.g. `https://your-spillout.vercel.app`). |
