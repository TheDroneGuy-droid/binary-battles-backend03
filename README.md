# Binary Battles 0.3 - Next.js Version

A modern, fullstack React-based coding competition platform built with Next.js.

## Features

- **Team Management**: Admin can create and manage teams
- **Real-time Competition**: Timed coding challenges with live leaderboard
- **Code Submission**: Submit solutions in Python, C++, Java, or C
- **Auto-Correction**: Basic code validation and scoring
- **Glassmorphism UI**: Modern, animated interface with Vanta.js background

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the next-app directory:
   ```bash
   cd next-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Login

**Admin:**
- Username: `admin`
- Password: `admin123`

## Project Structure

```
next-app/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel page
│   │   ├── team/           # Team panel page
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   ├── admin/      # Admin actions
│   │   │   ├── team/       # Team data
│   │   │   ├── submit/     # Code submission
│   │   │   └── competition/# Competition timer
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Login page
│   │   └── globals.css     # Global styles
│   └── lib/
│       ├── session.ts      # Session configuration
│       └── data.ts         # Data management & problems
├── data/                   # JSON data storage
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS with Glassmorphism effects
- **Session Management**: iron-session
- **UI Effects**: Vanta.js with Three.js

## License

MIT
