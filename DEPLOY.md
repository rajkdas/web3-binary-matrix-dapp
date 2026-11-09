# Host PortaGraph Online — Step-by-Step Guide

This guide takes you from zero to a public live demo URL in about 15 minutes, using only free tools: **GitHub** (code hosting) and **Vercel** (app hosting). No credit card, no server, no commands beyond a few copies-and-pastes.

**The plan:** download the project → put it on GitHub → let Vercel build and host it → share the link.

---

## Step 0 — What you need

- A computer with internet.
- A free **GitHub** account (github.com) — you have one if you can see your repos at github.com/rajkdas.
- A free **Vercel** account (vercel.com) — sign in **with GitHub**, it's one click.
- The project ZIP file (`portagraph-mvp.zip`), which you unzip anywhere on your computer (Right-click → Extract All).

---

## Step 1 — Put the code on GitHub

### Easy way (GitHub Desktop — no commands)

1. Install **GitHub Desktop** (desktop.github.com), open it, sign in with GitHub.
2. **File → Add Local Repository…** → select the unzipped `portagraph` folder.
   - If it says "this directory is not a repository", click **Create a Repository Here** → leave defaults → **Create Repository**.
3. Click **Publish repository** → keep the name `portagraph` → uncheck "Keep this code private" (so Vercel's clone button works) → **Publish**.

### Terminal way (if you prefer commands)

```bash
cd path/to/portagraph
git init
git add .
git commit -m "PortaGraph MVP"
git remote add origin https://github.com/rajkdas/portagraph.git
git branch -M main
git push -u origin main
```

✅ **Check:** open https://github.com/rajkdas/portagraph in your browser — you should see the code and the README with screenshots.

---

## Step 2 — Deploy on Vercel

1. Go to **vercel.com** → **Sign In → Continue with GitHub** → authorize Vercel.
2. Click **Add New… → Project**.
3. Find **portagraph** in the repository list → click **Import**.
4. Leave every setting as-is:
   - Framework Preset: **Next.js** (auto-detected)
   - Build Command / Output: default
   - Environment Variables: **none needed** (the database creates and seeds itself)
5. Click **Deploy** and wait 2–3 minutes while it builds.

✅ **Check:** you land on a fireworks page with **Continue to Dashboard**. Your URL is shown at the top — something like `portagraph.vercel.app` or `portagraph-xxxx.vercel.app`.

> If the build fails, click **View Build Logs**, copy the last ~10 red lines, and see Troubleshooting below.

---

## Step 3 — Verify the live demo (2 minutes)

Open your URL and click through the money path:

1. **Landing** → **Launch demo** → **“Just exploring? Enter as the demo founder →”**
2. **Matrix tab** → you should see the 45-node tree. Click **Simulate placement** to watch the BFS animation and fee splits.
3. **Admin tab** → find a HELD row in Safety Holding → **Release** → the counter drops in real time.
4. **Calculator tab** → drag the sliders — projections recalculate instantly.

Send that link to anyone — it is your live demo.

---

## Step 4 — Update the README with your real URL (optional, 1 minute)

After the first deploy, Vercel gives you the final URL (e.g. `portagraph-xxxx.vercel.app`).

1. On github.com, open your `portagraph` repo → click the ✏️ pencil on `README.md`.
2. Replace `https://portagraph.vercel.app` (top of the file) with your real URL → **Commit changes**.

Vercel automatically redeploys on every push — nothing else to do.

---

## Everyday use

| I want to… | Do this |
| --- | --- |
| Change anything in the app | Edit → commit → push to GitHub. Vercel redeploys automatically. |
| Reset the demo data | Vercel dashboard → your project → **Deployments** → ⋯ on the latest → **Redeploy**. |
| Use a custom domain | Vercel → Settings → **Domains** → add `demo.yourdomain.com` → follow the DNS instructions. |
| Check for errors | Vercel → **Logs** tab (runtime) or **Deployments → build logs** (build time). |

---

## Troubleshooting

**Build failed with a Prisma error** → The build runs `prisma generate` automatically (`postinstall`). If you removed it from `package.json`, add it back: `"postinstall": "prisma generate"`.

**Page loads but data is missing** → Open `/api/network` in a new tab. If it errors, check Vercel → Logs. First request after a cold start takes ~2–3 s while the database seeds itself — that's normal.

**The activity feed says "polling"** → That's correct on Vercel. The realtime socket service is a local-dev extra; the feed falls back to 9-second polling automatically.

**Signup disappeared after a while** → Expected on serverless: each instance re-seeds its own temporary database. Redeploy any time to force a fresh demo state.

**"Deck/glitch" after an edit** → Vercel → Deployments → ⋯ on the last good deploy → **Instant Rollback**.

---

## Cost

- GitHub: free
- Vercel Hobby: free (includes HTTPS, global CDN, automatic deploys)
- Total: **$0**
