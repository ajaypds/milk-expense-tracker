# 🥛 Milk Manager App

## Overview

Milk Manager is a simple React + TypeScript web application for tracking daily milk purchases and calculating monthly payments.  
It is built using **Vite**, **TailwindCSS**, **Redux Toolkit**, **React Router**, and **Firebase Firestore**.

---

## 🧩 Core Features

1. **Daily Entry**

   - Add an entry for each day with:
     - Date
     - Milk Taken (checkbox)
     - Quantity (0.5L, 1L, 1.5L, 2L)
   - Data stored in Firestore under `users/{userId}/milkEntries`.

2. **Monthly Dashboard**

   - Shows:
     - Total quantity between **10th of previous month → 9th of current month**
     - Total amount = Quantity × Milk Rate
     - Payment status (Paid/Not Paid)
   - Allows marking monthly payment as “Paid”.

3. **Milk Rate Management**
   - Add or edit the milk rate per liter.
   - Stored in Firestore under `users/{userId}/settings/milkRate`.

---

## 🧱 Tech Stack

| Layer            | Technology           |
| ---------------- | -------------------- |
| Frontend         | React (TypeScript)   |
| State Management | Redux Toolkit        |
| Styling          | Tailwind CSS         |
| Routing          | React Router         |
| Backend          | Firebase Firestore   |
| Build Tool       | Vite (with Rolldown) |

---

## 🔧 Folder Structure

src/
├─ components/
│ ├─ EntryForm.tsx
│ ├─ SummaryCard.tsx
│ ├─ PaymentStatusToggle.tsx
│
├─ pages/
│ ├─ DailyEntry.tsx
│ ├─ Dashboard.tsx
│ ├─ Settings.tsx
│
├─ store/
│ ├─ entriesSlice.ts
│ ├─ settingsSlice.ts
│ ├─ store.ts
│
├─ firebase/
│ ├─ config.ts
│ ├─ firestoreHelpers.ts
│
├─ utils/
│ ├─ dateUtils.ts
│ ├─ calculations.ts
│
├─ App.tsx
├─ main.tsx
├─ index.css

---

## ⚙️ Firestore Schema Example

users/
{userId}/
milkEntries/
{entryId}: {
date: "2025-11-12",
milkTaken: true,
quantity: 1,
monthPeriod: "2025-11"
}
settings: {
milkRate: 60,
paymentStatus: {
"2025-11": "Paid"
}
}

---

## 🧮 Calculation Logic

- **Billing Period:** 10th of previous month → 9th of current month
- **Amount to Pay:** `totalLiters × milkRate`
- **Payment Date:** Every 10th of the month

---

## 🚀 Setup Instructions

```bash
# 1. Install dependencies
pnpm install

# 2. Set up Firebase config in src/firebase/config.ts
# (API keys, project ID, etc.)

# 3. Run the app
pnpm run dev

🧠 Notes for AI Assistants
- Maintain consistent TypeScript types for all data structures.
- Prioritize Firestore integration (CRUD operations).
- Keep UI simple, clean, and mobile-friendly using Tailwind.
- Respect the billing cycle logic (10th → 9th) in all calculations.
- Use Redux Toolkit for global state management and async Firestore actions.
- Provide inline comments for important logic and Firestore queries.
```
