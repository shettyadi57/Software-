# AEGIS — AI-Powered Online Examination System

A secure, AI-monitored online exam platform built with React, Vite, and Tailwind CSS.

## Features
- Professor dashboard to create and manage exams
- Student authentication per exam
- 30-question DSA question bank
- Real-time credibility scoring
- AI monitoring panel (tab switching, face detection, copy attempts)
- Countdown timer with auto-submit
- Results page with Chart.js doughnut visualization

## Getting Started

```bash
npm install
npm run dev
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/            # Route-level page components
├── data/             # Static question data
├── App.jsx           # Router setup
├── main.jsx          # Entry point
└── index.css         # Tailwind + global styles
```

## Routes
| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/professor/login` | Professor login |
| `/professor/dashboard` | Exam management dashboard |
| `/student/login` | Generic student login |
| `/exam/:examId` | Student login for specific exam |
| `/exam/:examId/take` | Exam interface |
| `/result` | Result summary page |
