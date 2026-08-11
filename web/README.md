# alChim Backoffice

Personal trainer backoffice web app for managing students, training plans, notes, payments, and exercise library.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase Admin SDK** (server-side only)
- **jose** (JWT auth)

## Setup

### 1. Install dependencies

```bash
cd web
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

| Variable | Description |
|---|---|
| `ADMIN_PASSWORD` | The password for the backoffice login |
| `AUTH_SECRET` | Random string (32+ chars) for JWT signing |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON of Firebase service account (single line) |

**Getting your Firebase service account:**
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Copy the entire JSON content and paste it as a single-line JSON string in `.env.local`

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for production

```bash
npm run build
npm start
```

## Features

### Student Management
- Create/edit/delete students with profile info (name, phone, weight, gender, custom fields)
- Each student gets a unique 6-char link code (e.g., `X4K2R9`) for mobile app access
- Notes tab: timestamped notes sorted newest first
- Aspects tab: freeform reminders about the student (injuries, preferences)
- Payments tab: monthly payment grid per year, click to toggle paid/unpaid

### Training Plans
- Create multiple plans per student
- Draft → Published workflow
- Rich plan editor with blocks → exercises → sets structure
- Block reordering (up/down)
- Exercise picker with search and inline exercise creation
- Sets: reps or seconds mode, weight input for reps mode
- Inline name editing for plans and blocks
- Save draft / Publish buttons

### Exercise Library
- Global library shared across all students
- Seeded with 10 default exercises on first load
- Search by name or muscle group
- Create: name, category (fuerza/cardio/peso_corporal), muscle groups, MET value

### Mobile API
- `GET /api/student/plans?code=X4K2R9` — returns published plans for the student
- No authentication required (used by the mobile app)

## Project Structure

```
web/
├── app/                     Next.js App Router pages
│   ├── api/                 API routes (server-side Firestore)
│   ├── login/               Login page
│   ├── students/            Student list, detail, plans editor
│   └── exercises/           Exercise library
├── components/
│   └── Sidebar.tsx          Navigation sidebar
├── lib/
│   ├── auth.ts              JWT utils, password check
│   ├── firebase.ts          Firebase Admin init
│   ├── firestore.ts         All Firestore operations
│   └── types.ts             TypeScript types
└── middleware.ts            Route protection
```

## Firestore Data Structure

```
students/{studentId}
  ├── notes/{noteId}
  ├── aspects/{aspectId}
  ├── payments/{year-month}   e.g. "2025-03"
  └── plans/{planId}

exercises/{exerciseId}        Global exercise library
```
