# Deployment Guide

Full walkthrough for hosting HireFilter on Render (backend) + Vercel (frontend).
Total time: ~20 minutes.

---

## Step 0 — Prep: push to GitHub

```bash
# From the hirefilter/ root
git init
git add .
git commit -m "feat: initial HireFilter implementation"

# Create a new repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/hirefilter.git
git push -u origin main
```

Your repo should look like:
```
hirefilter/
├── backend/
├── frontend/
├── sample-data/
└── README.md
```

---

## Part 1 — Backend on Render

Render gives you a free tier that's perfect for demos.
Note: free tier spins down after 15 min of inactivity (first request after sleep takes ~30s).
Upgrade to Starter ($7/mo) for always-on if you need it for the demo.

### 1.1 — Create the service

1. Go to [render.com](https://render.com) → Sign up / Log in
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select your `hirefilter` repository
5. Fill in:

| Field | Value |
|---|---|
| **Name** | `hirefilter-api` |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Free (or Starter for production) |

6. Click **Advanced** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | `gsk_your_actual_key_here` |
| `ALLOWED_ORIGINS` | `https://your-vercel-app.vercel.app` *(update after Step 2)* |

7. Click **Create Web Service**

### 1.2 — Wait for deploy

Build takes 2–4 minutes. Watch the logs in the Render dashboard.

### 1.3 — Verify it's working

Once deployed, your API is live at something like:
`https://hirefilter-api.onrender.com`

Test it:
```bash
curl https://hirefilter-api.onrender.com/health
# Expected: {"status":"ok","version":"1.1.0"}
```

Or open `https://hirefilter-api.onrender.com/docs` in your browser for the interactive Swagger UI.

### 1.4 — Copy your Render URL

You'll need it in the next step. It looks like:
`https://hirefilter-api.onrender.com`

---

## Part 2 — Frontend on Vercel

### 2.1 — Add the environment variable file

In `frontend/`, create a `.env.production` file:
```
VITE_API_URL=https://hirefilter-api.onrender.com
```

Commit and push:
```bash
git add frontend/.env.production
git commit -m "chore: add production API URL"
git push
```

### 2.2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up / Log in with GitHub
2. Click **Add New...** → **Project**
3. Import your `hirefilter` repository
4. Configure:

| Field | Value |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` *(auto-detected)* |
| **Output Directory** | `dist` *(auto-detected)* |

5. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://hirefilter-api.onrender.com` |

6. Click **Deploy**

### 2.3 — Wait for deploy

Takes about 1 minute. Vercel will give you a URL like:
`https://hirefilter-xyz.vercel.app`

### 2.4 — Update CORS on Render

Go back to Render → your service → **Environment** → update:
```
ALLOWED_ORIGINS=https://hirefilter-xyz.vercel.app
```

Click **Save Changes** — Render will redeploy automatically (takes ~2 min).

### 2.5 — Test end-to-end

1. Open your Vercel URL in the browser
2. Paste the job description from `sample-data/job-description.txt`
3. Paste the resumes from `sample-data/resumes-all.txt`
4. Click **Screen Candidates**
5. You should see 5 ranked candidates appear

---

## Troubleshooting

**CORS error in browser console**
→ Make sure `ALLOWED_ORIGINS` on Render matches your exact Vercel URL (no trailing slash)

**"Failed to fetch" / network error**
→ Check that the Render service is awake. Visit `https://your-api.onrender.com/health` first to wake it.

**Render build fails**
→ Check build logs. Usually a missing dependency. Make sure `requirements.txt` is in `backend/`.

**Vercel build fails**
→ Check that `Root Directory` is set to `frontend`, not the repo root.

**Groq API errors**
→ Check your `GROQ_API_KEY` env var on Render. Confirm it starts with `gsk_`. Test at console.groq.com.

---

## Custom domain (optional)

On Vercel: Settings → Domains → Add your domain.
On Render: Settings → Custom Domains → Add your domain.
Both handle SSL automatically.
