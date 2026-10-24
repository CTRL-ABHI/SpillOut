# SPILLOUT

> **Zero-Archive Privacy-First Communication Platform**  
> Focused exclusively on genuine End-to-End Encrypted (E2EE) text messaging and encrypted WebRTC voice calls.

---

## 1. Architectural Overview & Philosophy

SPILLOUT is an unconventional, privacy-first communication platform built for direct conversation without permanent digital footprints.

- **No Public Performance**: No image feeds, video feeds, public posts, stories, GIFs, file sharing, stickers, or voice notes.
- **Genuine End-to-End Encryption (E2EE)**: Messages are encrypted directly on the sender's client using the native Web Crypto API (`ECDH P-256`, `HKDF-SHA256`, `AES-GCM-256`). The server acts strictly as an opaque real-time message relay and has zero access to plaintext.
- **Zero-Archive In-Memory Communication**: The account database contains **no messages table**. Messages are never written to PostgreSQL, Redis snapshots, server logs, or disk. Once you close the tab, refresh the browser, or log out, all chat plaintext and ephemeral cryptographic keys are completely erased from client memory.
- **7-Day Automatic Account Inactivity Deletion**: Accounts inactive for 7 consecutive days are permanently and automatically deleted by a server-side cleanup task, freeing the username for future registration and completely revoking all sessions.
- **Permanent Account Attributes**: No email, phone number, Google account, or real-name identity is ever collected. Account credentials (username, 3×3 matrix password, and gender selection) are immutable once created. No password resets exist.
- **Custom 3×3 Character Matrix**: A 9-position character grid accepting letters, digits, punctuation, and literal space characters (with a discreet visual space indicator). Passwords are serialized in row-major order and hashed on the server using Argon2id.
- **Encrypted Real-Time Voice Calls**: Browser-based peer-to-peer voice calling over WebRTC with mandatory DTLS-SRTP media transport. Zero call recordings or transcripts.

---

## 2. Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom dark aesthetic (near-black, deep graphite, electric violet `#8B5CF6`, icy blue, and lime highlights)
- **Cryptography**: Web Crypto API (`SubtleCrypto` implementing ECDH P-256, HKDF-SHA256, AES-GCM-256, SHA-256 safety fingerprint numbers)
- **Voice Communication**: WebRTC (`RTCPeerConnection` with DTLS-SRTP audio transport)
- **Real-Time Client**: Native WebSocket client with heartbeat and exponential backoff
- **Audio Synthesizer**: Web Audio API minimal sound engine (message chimes, ringtones, acoustic key taps)
- **Privacy Protections**: Anti-casual-capture Screen Shield (blurs window when focus is lost or visibility changes)

### Backend
- **Runtime**: Node.js 22+ with TypeScript
- **Web Framework**: Express with Helmet security headers and strict CORS
- **Real-Time Delivery & Signaling**: `ws` (native WebSockets)
- **Password Hashing**: Argon2id via `@node-rs/argon2`
- **Session Management**: Secure, HTTP-only, SameSite cookies
- **Database & ORM**: PostgreSQL (production) / SQLite (zero-setup local development) managed via Prisma ORM
- **Inactivity Cleanup**: Scheduled background daemon permanently evicting accounts inactive for ≥7 days
- **Testing**: Vitest integration and unit test suite

---

## 3. Repository Structure

```
spillout/
├── package.json               # Root scripts (dev, test, build, start)
├── docker-compose.yml         # Production PostgreSQL, Redis (no snapshots), Server, and Client
├── Dockerfile.server          # Multi-stage production Dockerfile for backend
├── Dockerfile.client          # Multi-stage production Dockerfile for Next.js frontend
├── .env.example               # Complete environment variable template
├── .gitignore
├── README.md
│
├── server/                    # Node.js backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts       # Sequential integration testing configuration
│   ├── prisma/
│   │   ├── schema.prisma      # SQLite default for local zero-dependency testing
│   │   └── schema.postgresql.prisma # PostgreSQL production schema
│   ├── src/
│   │   ├── index.ts           # Server bootstrap & graceful shutdown
│   │   ├── app.ts             # Express app, Helmet, CORS, body size limits
│   │   ├── config.ts          # Environment variables
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── routes/
│   │   │   ├── auth.ts        # /api/auth (register, login, me, logout, check-username)
│   │   │   └── account.ts     # /api/account (inactivity countdown, manual deletion)
│   │   ├── services/
│   │   │   ├── account-cleanup.service.ts # 7-day automatic deletion background daemon
│   │   │   ├── presence.service.ts        # In-memory presence and socket tracking
│   │   │   └── websocket.service.ts       # E2EE message relay & WebRTC voice signaling
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts         # Session verification & qualifying activity updates
│   │   │   └── rate-limiter.middleware.ts # IP sliding window rate limiters
│   │   └── utils/
│   │       ├── password.ts    # Argon2id hashing & verification
│   │       ├── validation.ts  # Username (alphanumeric, max 10), gender, matrix parser
│   │       └── logger.ts      # Privacy logger (never logs secrets or message payloads)
│   └── tests/
│       ├── password.test.ts   # Argon2id, matrix validation, username rules, gender
│       ├── auth.test.ts       # Registration, case-insensitivity, sessions, 7-day deletion
│       └── messaging.test.ts  # E2EE WebSocket relay, offline rejection, zero DB persistence
│
└── client/                    # Next.js App Router frontend
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts     # Custom dark theme, electric violet, and glow styles
    ├── postcss.config.mjs
    ├── next.config.mjs        # API rewrites proxying /api to backend
    └── src/
        ├── app/
        │   ├── layout.tsx     # Root HTML layout, metadata, viewport
        │   ├── page.tsx       # State orchestrator (Welcome, Auth, Dashboard, Chat, Call)
        │   ├── globals.css    # Dark mode theming, scrollbar styling, animations
        │   └── privacy/
        │       └── page.tsx   # Screen 7: Dedicated Privacy Manifesto & Threat Model
        ├── components/
        │   ├── branding/
        │   │   └── Logo.tsx   # Wordmark and animated indicator
        │   ├── auth/
        │   │   ├── MatrixPasswordInput.tsx # 3×3 Password Grid with keyboard navigation & spaces
        │   │   ├── SignUpForm.tsx          # Step-by-step registration with 3x3 confirmation
        │   │   └── LoginForm.tsx           # Authentication screen with 3x3 matrix
        │   ├── chat/
        │   │   ├── ChatView.tsx            # Live text chat, composer, memory notice
        │   │   ├── EncryptionBadge.tsx     # E2EE status & Safety Numbers verification modal
        │   │   ├── ConversationList.tsx    # Active session conversations & 7-day timer
        │   │   └── UserSearchModal.tsx     # Username resolution and live presence check
        │   ├── voice/
        │   │   └── VoiceCallModal.tsx      # WebRTC DTLS-SRTP call interface, mute, duration
        │   └── privacy/
        │       └── BlurOverlay.tsx         # Screen Shield anti-casual-capture blur
        ├── lib/
        │   ├── api.ts          # Typed REST client with cookie credentials
        │   ├── crypto.ts       # Web Crypto API (ECDH, HKDF, AES-GCM-256, safety numbers)
        │   ├── webrtc.ts       # PeerConnection, DTLS-SRTP, microphone management
        │   ├── socket.ts       # WebSocket client with heartbeats and auto-reconnect
        │   └── sound.ts        # Web Audio API sound generator (chimes, ticks, ringtones)
        └── types/
            └── index.ts        # Shared TypeScript definitions
```

---

## 4. Local Development Quickstart

### Prerequisites
- Node.js 20+ (Node.js 22 or 24 recommended)
- npm 10+

### Setup & Run
1. **Clone the repository and install dependencies**:
   ```bash
   cd spillout
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. **Initialize Database**:
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   cd ..
   ```

3. **Start Development Environment**:
   ```bash
   npm run dev
   ```
   - **Frontend**: Available at `http://localhost:3000`
   - **Backend API**: Available at `http://localhost:4000`
   - **WebSocket**: Running on `ws://localhost:4000/ws`

4. **Run Automated Test Suites**:
   ```bash
   npm run test
   ```
   Runs all unit and integration tests across Argon2id hashing, 3x3 matrix serialization, username constraints, session cookies, 7-day account inactivity deletion, and ephemeral WebSocket message relay.

---

## 5. Production Deployment with Docker Compose

A complete `docker-compose.yml` is provided for containerized production deployment with PostgreSQL 16 and Redis 7.

### Critical Ephemeral Configuration
In `docker-compose.yml`, the Redis service is explicitly launched with:
```yaml
command: redis-server --save "" --appendonly no
```
This guarantees that temporary presence coordination never writes snapshots or append-only logs to disk, maintaining our zero-archive privacy commitment.

### Running with Docker Compose
```bash
docker compose up -d --build
```
This launches:
- `spillout-postgres`: PostgreSQL 16 account database
- `spillout-redis`: Ephemeral in-memory presence coordination
- `spillout-server`: Node.js backend container on port `4000`
- `spillout-client`: Next.js 14 frontend container on port `3000`

---

## 6. Security Guarantees & Threat Model

| Security Dimension | Implementation & Guarantee |
|---|---|
| **Message Encryption** | AES-GCM (256-bit) with 12-byte random nonces and 128-bit authentication tags. Derived from ECDH P-256 shared secrets via HKDF-SHA256. |
| **Server Knowledge** | Server processes only ciphertext, IV, and auth tag. Server never sees plaintext messages or private keys. |
| **Message Persistence** | Zero persistent database storage. Messages exist only in active browser RAM and disappear upon page refresh, browser close, or logout. |
| **Offline Queuing** | Rejected. If a recipient is offline, the message is immediately rejected and discarded. |
| **Voice Call Encryption** | Direct peer-to-peer WebRTC audio encrypted using mandatory DTLS-SRTP. Zero recording, zero audio persistence. |
| **Password Storage** | Argon2id with 19 MiB memory cost, 2 iterations, and per-user cryptographic salts. Passwords are never stored in plaintext or logged. |
| **Account Lifecycle** | Accounts inactive for 7 consecutive days are permanently deleted by a background job, freeing the username. |
| **Transport Security** | Helmet CSP headers, HTTP-only SameSite cookies, CORS restricted to trusted origins, rate limiting on login/registration. |
| **Anti-Casual-Capture** | Screen Shield automatically blurs confidential chat screens when the browser window loses focus or the tab visibility changes. |
| **Practical Limitations** | Web applications cannot prevent OS-level screen recording or external physical cameras. Unavoidable network IP metadata exists at the IP layer; users requiring network anonymity should use Tor or a VPN. |

---

## 7. Acceptance Criteria Verification

- [x] Polished and distinctive modern dark design with electric violet accents.
- [x] Real login and registration against active backend.
- [x] Alphanumeric usernames, max 10 characters, case-insensitive uniqueness (`Abhi123` = `abhi123`).
- [x] 3×3 matrix captures and verifies 9-position passwords, preserving spaces and symbols.
- [x] Argon2id password hashing on server; passwords never stored plaintext.
- [x] Gender, username, and password are immutable after registration.
- [x] Zero email, phone, or OAuth requirement.
- [x] Automatic 7-day inactivity deletion permanently evicts accounts and sessions.
- [x] Real-time conversation initiation via exact username.
- [x] Real-time text messaging with genuine E2EE via Web Crypto API.
- [x] Persistent chat history and offline queues do not exist.
- [x] Chat state cleared on logout and does not return on refresh.
- [x] Real-time voice calls work with secure DTLS-SRTP media transport.
- [x] No voice call recording or transcripts.
- [x] No images, GIFs, video files, or attachments.
- [x] Privacy logger redacts passwords, tokens, and payloads.
- [x] Screenshot limitations documented honestly without impossible guarantees.
- [x] Responsive layout across desktop, tablet, and mobile.
- [x] Backend authorization, validation, session security, and rate limits implemented.
- [x] Complete README, Docker Compose, and environment documentation provided.
- [x] 100% automated tests and production Next.js build verified successfully.
