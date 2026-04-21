const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID   = 'curious_coder~linkedin-jobs-scraper';

function buildLinkedInUrl(cfg) {
  const kw = [cfg.role, cfg.keywords].filter(Boolean).join(' ');
  const p  = new URLSearchParams({ keywords: kw, location: cfg.location || 'Europe', position: '1', pageNum: '0' });
  if (cfg.workType)   p.set('f_WT',  cfg.workType);
  if (cfg.timePosted) p.set('f_TPR', cfg.timePosted);
  return `https://www.linkedin.com/jobs/search/?${p.toString()}`;
}

async function pollRun(runId, token, onStatus) {
  const maxWait = 120000, interval = 4000;
  const start   = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval));
    const d = await (await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)).json();
    const s = d.data?.status;
    onStatus(`Apify: ${s}…`);
    if (s === 'SUCCEEDED') return d.data.defaultDatasetId;
    if (['FAILED','ABORTED','TIMED-OUT'].includes(s))
      throw new Error(`Apify run ${s}: ${d.data?.statusMessage || ''}`);
  }
  throw new Error('Apify run timed out after 2 minutes');
}

function normalizeJob(raw) {
  return {
    id:          raw.id || String(Math.random()),
    title:       raw.title || 'Untitled',
    company:     raw.companyName || 'Unknown',
    location:    raw.location || raw.country || '',
    posted:      raw.postedAt ? new Date(raw.postedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '',
    applicants:  raw.applicantsCount || '?',
    type:        raw.employmentType || '',
    seniority:   raw.seniorityLevel || '',
    salary:      (raw.salaryInfo || []).join(' – ') || '',
    description: (raw.descriptionText || '').slice(0, 3000),
    link:        raw.link || '#',
    applyUrl:    raw.applyUrl || raw.link || '#',
    workplace:   (raw.workplaceTypes || []).join(', '),
    score: null, matches: [], gaps: [], summary: '',
  };
}

window.Scraper = {
  async run(cfg, token, onStatus) {
    const url = buildLinkedInUrl(cfg);
    onStatus('Starting Apify run…');
    const startRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], count: Number(cfg.count) || 25, scrapeCompany: true }),
    });
    if (!startRes.ok) {
      const e = await startRes.json().catch(() => ({}));
      throw new Error(`Apify start failed (${startRes.status}): ${e?.error?.message || startRes.statusText}`);
    }
    const runId = (await startRes.json()).data?.id;
    if (!runId) throw new Error('No run ID returned from Apify');

    onStatus('Scraping LinkedIn (~30–60s)…');
    const dsId = await pollRun(runId, token, onStatus);

    onStatus('Fetching results…');
    const items = await (await fetch(
      `${APIFY_BASE}/datasets/${dsId}/items?token=${token}&limit=${Number(cfg.count)||25}&fields=id,title,companyName,location,postedAt,applicantsCount,link,applyUrl,employmentType,seniorityLevel,descriptionText,workplaceTypes,country,salaryInfo`
    )).json();
    return items.map(normalizeJob);
  },
};
