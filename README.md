# FocusForge

## Overview

FocusForge is a C++ CLI application that generates a personalized daily study plan based on your exams, subject difficulty, and progress.

It removes the need to manually plan your study sessions and ensures you stay on track, even if you miss days.

---

## Problem

Students often:

* Don’t know what to study each day
* Underestimate workload
* Fall behind and struggle to recover

Manual planning leads to inconsistency and stress.

---

## Solution

FocusForge:

* Calculates how much you should study daily
* Prioritizes subjects based on difficulty and deadlines
* Tracks your progress
* Automatically adjusts your plan if you fall behind

---

## Features

### Core Features

* Add and manage subjects
* Set exam dates and difficulty levels
* Automatic daily study plan generation
* Progress tracking (hours completed)
* Dynamic rescheduling if you fall behind

### Smart Logic

* Difficulty-weighted scheduling
* Real-time recalculation of study load
* Warning system when you're behind schedule

### User Experience

* Clean and structured CLI interface
* Clear daily study breakdown
* Simple command system

---

## Example Output

===== STUDY DASHBOARD =====

Subjects:
[1] Math       | 2/20 hrs | ⚠ Behind
[2] Physics    | 5/10 hrs | ✓ On Track

Today's Plan:

* Math: 3.1 hrs
* Physics: 0.8 hrs

---

## How It Works

FocusForge calculates your daily study workload using:

remaining_hours / remaining_days

It then adjusts the result based on subject difficulty to prioritize harder subjects.

If you miss a day, the system recalculates automatically to keep you on track.

---

## Tech Stack

* C++
* CLI Interface
* File-based or SQLite storage

---

## Installation

1. Clone the repository
2. Compile the project:
   g++ main.cpp -o focusforge
3. Run:
   ./focusforge

---

## Future Improvements

* GUI version
* Data visualization (graphs)
* Mobile companion app
* AI-based predictions

---

## Why This Project

This project was built to solve a real problem faced by students: ineffective and inconsistent study planning.

FocusForge provides a simple but powerful solution that adapts to the user and encourages consistency.

---

## Demo Idea

Add 2–3 subjects with different exam dates and difficulty levels, then generate a study plan and simulate missing a day to show dynamic recalculation.

---

## Author

Panayiotis Savva

