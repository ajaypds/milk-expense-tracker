# 🥛 Milk Expense Tracker

A modern, offline-first daily milk expense tracking mobile and web application. Built with React 19, TypeScript, Supabase (PostgreSQL & Row Level Security), Tailwind CSS v4, Material UI v7, and Capacitor 7 for Android.

---

## ✨ Features

- 🔐 **Supabase Authentication & Row Level Security (RLS)**: Secure multi-user login with granular database security policies.
- 📈 **Effective Milk Rate Versioning**: Changes to milk rates are stamped with `effective_from` dates so previously settled cycles remain immutable and accurate.
- 📅 **Interactive Monthly Calendar / Heatmap**:
  - Switch between Table View and Visual Calendar View.
  - Visual color badges: 🥛 Delivered (`1.5 L`), 🚫 Skipped, and ⏳ Pending.
  - 1-tap quick log on any date cell.
- ⚡ **Offline Doorstep Logging & Sync Queue**:
  - Automatically caches entries locally for instant offline review.
  - Doorstep logging queues changes when cellular connectivity is spotty and automatically syncs to Supabase once back online.
- 🔔 **Daily Reminders (`@capacitor/local-notifications`)**:
  - Set a customizable daily reminder time (default 8:30 PM).
  - Native Android notifications remind you to log today's milk delivery.
  - Includes an in-app "Send Test Alert" button.
- 📱 **1-Tap WhatsApp Itemized Bill Sharing**:
  - Generates a formatted bill receipt showing cycle dates, total liters, effective rate, amount, and an itemized list of all skipped delivery dates.
- 💸 **1-Click UPI Deep Links**:
  - Generates `upi://pay` links that launch Google Pay, PhonePe, or Paytm directly on mobile.
  - Desktop QR code modal for scanning directly from your phone.
- 📒 **Khata / Advance Carryover Ledger**:
  - Record payments, partial dues, or extra advances with automatic balance adjustments.
- 📊 **Paid Months History & Reports**:
  - Dedicated Reports page with annual filter, total amounts paid, total liters consumed, average monthly spend, and deep-dive itemized daily logs.
- ⏰ **Automated Supabase Keep-Alive**:
  - GitHub Action workflow pings the Supabase REST API every 3 days to prevent free-tier project inactivity pause.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite (Rolldown)
- **UI / Styling**: Material UI v7, Tailwind CSS v4, Emotion
- **State Management**: Redux Toolkit, React-Redux
- **Backend & Auth**: Supabase (PostgreSQL, Auth, RLS)
- **Native Mobile**: Capacitor 7 (Android)
- **Notifications**: `@capacitor/local-notifications`

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)
- Android Studio (for native Android APK builds)

### 2. Setup Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```

### 3. Install Dependencies & Run
```bash
# Install dependencies
pnpm install

# Start local dev server
pnpm dev

# Build for production
pnpm run build
```

---

## 📱 Capacitor Android Build

```bash
# Build web assets and sync to native Android project
pnpm run build
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

## ⏰ Supabase Free-Tier Keep-Alive Action

Supabase free tier automatically pauses projects after 7 consecutive days of inactivity. A scheduled GitHub Action is included in `.github/workflows/supabase-keep-alive.yml`.

To enable:
1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Add the following Repository Secrets:
   - `VITE_SUPABASE_URL`: Your Supabase URL (`https://xyz.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public anonymous key
3. The workflow runs every 3 days at 06:00 UTC, or can be triggered manually under the **Actions** tab.
