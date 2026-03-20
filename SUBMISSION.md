# HireFilter — Submission Write-up

## Selected Problem
Problem 1: AI Resume Screening System

## Approach (200 words)

HireFilter uses a two-pass hybrid scoring engine to evaluate resumes against a job description — combining deterministic rule-based analysis with LLM judgment via the Groq API (Llama 3.3 70B).

**Pass 1 — Rule-based pre-score:** A custom parser (parser.py) normalises resume text, detects sections (experience, skills, education), extracts tech keywords, and scores keyword overlap against the JD. This gives a fast, explainable baseline and acts as a sanity anchor — preventing the LLM from inflating scores for candidates who matched zero requirements.

**Pass 2 — LLM refinement:** The normalised resume and JD are sent to Groq, which scores three weighted dimensions: skills match (40%), experience match (35%), and role fit (25%). The final score blends both passes (80% LLM, 20% rule-based).

The system outputs a ranked leaderboard with per-candidate profile cards showing sub-scores, matched keywords, specific strengths and gaps, a recommendation tier, and an expandable reasoning trace. Results export to CSV.

The API key lives server-side (FastAPI backend), never in the browser. The frontend (React + Vite) supports both paste-text and PDF/DOCX/TXT file upload.

## Tools Used
Python, FastAPI, Groq API (Llama 3.3 70B), React, Vite, PyMuPDF, python-docx

## Deployment
- Backend: Render (FastAPI)
- Frontend: Vercel (React/Vite)
