# LinkedIn Job Dashboard

A static SPA on GitHub Pages that scrapes live LinkedIn jobs via Apify, scores each role against your profile using Claude AI, generates cover letters, and exports PDF reports with true clickable hyperlinks — all from your browser, no server needed.

## Features
- **Live LinkedIn scraping** via Apify (no LinkedIn login required)
- **Resume upload** — drag-and-drop or browse PDF/TXT; text extracted automatically via PDF.js
- **AI fit scoring** — Claude scores each job 0–100% vs your profile with match/gap tags
- **Cover letter generator** — tone selector, regenerate, copy, PDF export
- **PDF report with clickable links** — jsPDF generates a true PDF where every Apply and LinkedIn link is a real clickable hyperlink
- **Motion One animations** — Framer Motion web animations for staggered card entrances, modal popins, button feedback
- **On-demand refresh** — re-run the same search with one click
- **Sort by** AI fit score, date posted, or fewest applicants
- **Filters** — role, location, keywords, job type, time posted, result count
- **No backend** — all API keys stored only in your browser localStorage

## Setup

### 1. Fork and deploy
1. Fork this repo on GitHub (must be public for free GitHub Pages)
2. Go to **Settings → Pages → Source: Deploy from branch → gh-pages → Save**
3. Push any change to `main` — GitHub Actions auto-deploys

### 2. Get API keys
| Key | Where |
|-----|-------|
| Apify | console.apify.com/account/integrations (free $5 credit available) |
| Anthropic | console.anthropic.com/settings/api-keys |

### 3. Configure in the app
1. Open your GitHub Pages URL
2. Click **⚙ Settings**
3. Paste Apify and Anthropic keys
4. Upload your resume (PDF or TXT) — text is extracted automatically
5. Add your name → **Save settings**

### 4. Run a search
1. Enter job role, location, extra keywords
2. Select job type, time posted, result count
3. **Search LinkedIn** → wait ~30–60s for Apify + Claude
4. **↺ Refresh** to re-run on demand
5. **⬇ Export PDF** for the full ranked report with clickable links
6. **✉ Draft cover letter** on any card to generate a tailored letter

## Architecture
```
Browser (GitHub Pages static SPA)
├── js/resume.js   → PDF.js / FileReader — resume text extraction
├── js/scraper.js  → Apify REST API — LinkedIn job scraping
├── js/ai.js       → Anthropic API — fit scoring + cover letters
├── js/pdf.js      → jsPDF + jsPDF-AutoTable — clickable PDF reports
│                  → html2pdf.js — cover letter PDF formatting
└── js/app.js      → orchestrates all modules + Motion One animations
```

## Cost per search run (~25 jobs)
| Item | Cost |
|------|------|
| Apify scrape | ~$0.03 |
| Claude scoring (25 jobs) | ~$0.08 |
| Cover letter (1x) | ~$0.005 |
| **Total** | **~$0.12** |

## Security
Keys are stored in browser localStorage only. Never committed to the repo. Avoid sharing your deployed URL with untrusted users.

## License
MIT
