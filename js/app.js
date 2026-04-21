/* Motion One helper — animate with Framer Motion web animations */
const mot      = window.Motion || {};
const _motAnim = typeof mot.animate === 'function' ? mot.animate : null;
const animate  = _motAnim;
const stagger  = typeof mot.stagger === 'function' ? mot.stagger : (delay => (_, i) => i * delay);

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

function getKeys() {
  return {
    apify:     localStorage.getItem('apify_key')          || '',
    anthropic: localStorage.getItem('anthropic_key')      || '',
    name:      localStorage.getItem('candidate_name')     || '',
    profile:   localStorage.getItem('candidate_profile')  || '',
  };
}

let lastJobs = [], lastCfg = null, currentJob = null;

const $ = id => document.getElementById(id);

const els = {
  searchForm:      $('search-form'),
  btnRefresh:      $('btn-refresh'),
  btnExportPdf:    $('btn-export-pdf'),
  btnSettings:     $('btn-settings'),
  settingsOverlay: $('settings-overlay'),
  settingsModal:   $('settings-modal'),
  closeSettings:   $('close-settings'),
  saveSettings:    $('save-settings'),
  letterOverlay:   $('letter-overlay'),
  letterModal:     $('letter-modal'),
  closeLetter:     $('close-letter'),
  letterBody:      $('letter-body'),
  letterLoading:   $('letter-loading'),
  letterTone:      $('letter-tone'),
  regenBtn:        $('regenerate-letter'),
  copyBtn:         $('copy-letter'),
  exportLetterPdf: $('export-letter-pdf'),
  resultsGrid:     $('results-grid'),
  loadingState:    $('loading-state'),
  loadingMsg:      $('loading-msg'),
  emptyState:      $('empty-state'),
  errorState:      $('error-state'),
  errorMsg:        $('error-msg'),
  resultSummary:   $('result-summary'),
  resumeDropZone:  $('resume-drop-zone'),
  resumeFile:      $('resume-file'),
  resumeFilename:  $('resume-filename'),
  resumeStatus:    $('resume-status'),
  letterTitle:     $('letter-modal-title'),
};

/* ── Motion helpers ── */
function showCards(cards) {
  cards.forEach(c => { c.style.opacity = '1'; c.style.transform = ''; });
}

function animateIn(el, opts = {}) {
  if (!el) return;
  if (!animate) { el.style.opacity = '1'; return; }
  animate(el, { opacity: [0, 1], y: [12, 0] }, { duration: 0.25, easing: [0.4, 0, 0.2, 1], ...opts });
}

function animateModal(el) {
  if (!el) return;
  if (!animate) { el.style.opacity = '1'; return; }
  animate(el, { opacity: [0, 1], scale: [0.94, 1], y: [16, 0] }, { duration: 0.28, easing: [0.34, 1.56, 0.64, 1] });
}

function animateCards(cards) {
  if (!cards.length) return;
  /* Safety net: if Motion One fails for any reason, reveal cards after 700ms */
  const fallback = setTimeout(() => showCards(cards), 700);
  if (!animate) { clearTimeout(fallback); showCards(cards); return; }
  try {
    const anim = animate(cards, { opacity: [0, 1], y: [20, 0], scale: [0.97, 1] }, {
      duration: 0.3,
      delay: stagger(0.04),
      easing: [0.34, 1.56, 0.64, 1],
    });
    /* Clear safety net once animation finishes successfully */
    if (anim && typeof anim.finished === 'object' && anim.finished instanceof Promise) {
      anim.finished.then(() => clearTimeout(fallback)).catch(() => { clearTimeout(fallback); showCards(cards); });
    }
  } catch {
    clearTimeout(fallback);
    showCards(cards);
  }
}

/* ── SETTINGS ── */
els.btnSettings.onclick = () => {
  const k = getKeys();
  $('apify-key').value         = localStorage.getItem('apify_key')     || '';
  $('anthropic-key').value     = localStorage.getItem('anthropic_key') || '';
  $('candidate-name').value    = k.name;
  $('candidate-profile').value = k.profile;
  els.resumeFilename.textContent = 'Drop file here or click to browse';
  els.resumeStatus.className   = 'upload-status hidden';
  els.settingsOverlay.classList.remove('hidden');
  animateModal(els.settingsModal);
};
els.closeSettings.onclick   = () => els.settingsOverlay.classList.add('hidden');
els.settingsOverlay.onclick = e => { if (e.target === els.settingsOverlay) els.settingsOverlay.classList.add('hidden'); };

els.saveSettings.onclick = () => {
  localStorage.setItem('apify_key',         $('apify-key').value.trim());
  localStorage.setItem('anthropic_key',     $('anthropic-key').value.trim());
  localStorage.setItem('candidate_name',    $('candidate-name').value.trim());
  localStorage.setItem('candidate_profile', $('candidate-profile').value.trim());
  els.settingsOverlay.classList.add('hidden');
};

/* ── RESUME UPLOAD ── */
async function handleResumeFile(file) {
  if (!file) return;
  els.resumeStatus.className   = 'upload-status';
  els.resumeStatus.textContent = `Extracting text from ${file.name}…`;
  animateIn(els.resumeStatus);
  els.resumeFilename.textContent = file.name;
  try {
    const text = await window.Resume.extract(file);
    if (!text || text.length < 50) throw new Error('Could not extract enough text. Try a TXT version.');
    $('candidate-profile').value = text;
    els.resumeStatus.textContent = `Done — ${text.length.toLocaleString()} characters extracted from ${file.name}`;
  } catch (err) {
    els.resumeStatus.className   = 'upload-status error';
    els.resumeStatus.textContent = `Error: ${err.message}`;
  }
}

/* No onclick needed — <label for="resume-file"> handles native file picker on all devices */
els.resumeFile.onchange = e => handleResumeFile(e.target.files[0]);
els.resumeDropZone.ondragover  = e => { e.preventDefault(); els.resumeDropZone.classList.add('drag-over'); };
els.resumeDropZone.ondragleave = () => els.resumeDropZone.classList.remove('drag-over');
els.resumeDropZone.ondrop = e => {
  e.preventDefault();
  els.resumeDropZone.classList.remove('drag-over');
  handleResumeFile(e.dataTransfer.files[0]);
};

/* ── SEARCH ── */
function getConfig() {
  const wt     = $('f-type').value;
  const posted = $('f-posted').value;
  return {
    role:       $('f-role').value.trim(),
    location:   $('f-location').value.trim(),
    keywords:   $('f-keywords').value.trim(),
    workType:   wt,
    timePosted: posted,
    count:      $('f-count').value,
    sort:       $('f-sort').value,
    workTypeLabel: { '':'Any','2':'Remote','3':'Hybrid','1':'On-site' }[wt] || 'Any',
    postedLabel:   { 'r86400':'Past 24 hrs','r604800':'Past week','r2592000':'Past month' }[posted] || '',
    sortLabel:     $('f-sort').options[$('f-sort').selectedIndex].text,
  };
}

function setState(state) {
  els.loadingState.classList.toggle('hidden', state !== 'loading');
  els.emptyState.classList.toggle('hidden',   state !== 'empty');
  els.errorState.classList.toggle('hidden',   state !== 'error');
  if (state !== 'results') {
    els.resultsGrid.innerHTML = '';
    $('pagination').classList.add('hidden');
  }
  if (state === 'loading') animateIn(els.loadingState);
  if (state === 'error')   animateIn(els.errorState);
}

function scoreColor(s) {
  return s >= 70 ? 'teal' : s >= 50 ? 'amber' : s >= 25 ? 'coral' : 'gray';
}

function renderCard(job) {
  const sc      = scoreColor(job.score ?? 0);
  const matches = job.matches || [];
  const gaps    = job.gaps    || [];

  /* Show 2 match + 1 gap tags as preview; rest behind toggle */
  const previewM = matches.slice(0, 2);
  const previewG = gaps.slice(0, 1);
  const extraCount = (matches.length + gaps.length) - (previewM.length + previewG.length);
  const hasDetail  = job.summary || matches.length || gaps.length;

  const previewTagsHtml = [
    ...previewM.map(m => `<span class="tag match">${m}</span>`),
    ...previewG.map(g => `<span class="tag gap">${g}</span>`),
    extraCount > 0 ? `<button class="btn-more-tags">+${extraCount} more</button>` : '',
  ].join('');

  const card = document.createElement('div');
  card.className = 'job-card';
  card.style.opacity = '0';
  card.innerHTML = `
    <div class="card-accent ${sc}"></div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-title">${job.title}</div>
        <div class="score-badge ${sc}">${job.score != null ? job.score + '%' : '—'}</div>
      </div>
      <div class="score-bar-wrap"><div class="score-bar ${sc}" style="width:${job.score ?? 0}%"></div></div>
      <div class="card-meta"><strong>${job.company}</strong> · ${job.location}</div>
      <div class="card-meta-sub">${[job.type, job.seniority, job.workplace].filter(Boolean).join(' · ')}${job.salary ? ` · <span class="salary">${job.salary}</span>` : ''}</div>
      <div class="card-meta-sub muted">Posted ${job.posted} · ${job.applicants} applicants</div>
      ${previewTagsHtml ? `<div class="tag-row card-tags-preview">${previewTagsHtml}</div>` : ''}
      ${hasDetail ? `
        <div class="card-analysis hidden">
          <div class="tag-row">
            ${matches.map(m => `<span class="tag match">${m}</span>`).join('')}
            ${gaps.map(g => `<span class="tag gap">${g}</span>`).join('')}
          </div>
          ${job.summary ? `<div class="card-score-summary">${job.summary}</div>` : ''}
        </div>
        <button class="btn-toggle-analysis">▾ AI analysis</button>` : ''}
    </div>
    <div class="card-actions">
      <button class="btn-cover">✉ Cover letter</button>
      <a class="btn-apply" href="${job.applyUrl}" target="_blank" rel="noopener">Apply ↗</a>
      <a class="btn-apply" href="${job.link}"     target="_blank" rel="noopener">LinkedIn ↗</a>
    </div>`;

  const toggleBtn  = card.querySelector('.btn-toggle-analysis');
  const analysisEl = card.querySelector('.card-analysis');
  const moreBtn    = card.querySelector('.btn-more-tags');

  if (toggleBtn && analysisEl) {
    toggleBtn.onclick = () => {
      const nowHidden = analysisEl.classList.toggle('hidden');
      toggleBtn.textContent = nowHidden ? '▾ AI analysis' : '▴ Hide analysis';
      toggleBtn.classList.toggle('active', !nowHidden);
    };
  }
  if (moreBtn && toggleBtn) {
    moreBtn.onclick = () => {
      analysisEl.classList.remove('hidden');
      toggleBtn.textContent = '▴ Hide analysis';
      toggleBtn.classList.add('active');
    };
  }

  card.querySelector('.btn-cover').onclick = () => openCoverLetter(job);
  return card;
}

function sortJobs(jobs, sort) {
  const a = [...jobs];
  if (sort === 'fit')        return a.sort((x,y)=>(y.score??0)-(x.score??0));
  if (sort === 'applicants') return a.sort((x,y)=>Number(x.applicants||999)-Number(y.applicants||999));
  return a;
}

/* ── Pagination ── */
const PAGE_SIZE = 8;
let currentPage = 1;
let pagedJobs   = [];

function renderPage(page) {
  currentPage = page;
  els.resultsGrid.innerHTML = '';
  const start = (page - 1) * PAGE_SIZE;
  const cards = pagedJobs.slice(start, start + PAGE_SIZE).map(j => renderCard(j));
  cards.forEach(c => els.resultsGrid.appendChild(c));
  animateCards(cards);

  const pages   = Math.ceil(pagedJobs.length / PAGE_SIZE);
  const pag     = $('pagination');
  pag.classList.toggle('hidden', pages <= 1);
  $('page-info').textContent  = `Page ${currentPage} of ${pages}`;
  $('btn-prev-page').disabled = currentPage <= 1;
  $('btn-next-page').disabled = currentPage >= pages;

  /* Scroll results area back to top on page change */
  document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResults(jobs, cfg) {
  pagedJobs   = sortJobs(jobs, cfg.sort);
  currentPage = 1;
  renderPage(1);

  const high = jobs.filter(j=>(j.score??0)>=70).length;
  const mid  = jobs.filter(j=>(j.score??0)>=50&&(j.score??0)<70).length;
  els.resultSummary.textContent = `${jobs.length} results · ${high} strong · ${mid} moderate · ${cfg.sortLabel}`;
  animateIn(els.resultSummary);
  els.btnRefresh.disabled   = false;
  els.btnExportPdf.disabled = false;
}

async function runSearch(cfg) {
  const keys = getKeys();
  if (!keys.apify) {
    setState('error');
    els.errorMsg.textContent = 'Apify API key not set. Click ⚙ Settings to add it.';
    return;
  }
  setState('loading');
  els.loadingMsg.textContent = 'Starting Apify LinkedIn scrape…';

  try {
    const jobs = await window.Scraper.run(cfg, keys.apify, msg => { els.loadingMsg.textContent = msg; });

    if (keys.anthropic && keys.profile) {
      for (let i = 0; i < jobs.length; i++) {
        els.loadingMsg.textContent = `Scoring job ${i+1}/${jobs.length} with Claude…`;
        try {
          const r = await window.AI.scoreJob(jobs[i], keys.profile, keys.anthropic);
          jobs[i].score   = r.score;
          jobs[i].matches = r.matches || [];
          jobs[i].gaps    = r.gaps    || [];
          jobs[i].summary = r.summary || '';
        } catch { jobs[i].score = 50; jobs[i].summary = 'AI scoring unavailable'; }
      }
    }

    lastJobs = jobs; lastCfg = cfg;
    setState('results');
    renderResults(jobs, cfg);
  } catch (err) {
    setState('error');
    els.errorMsg.textContent = `Error: ${err.message}`;
  }
}

els.searchForm.onsubmit = e => { e.preventDefault(); runSearch(getConfig()); };
els.btnRefresh.onclick  = () => { if (lastCfg) runSearch(lastCfg); };
$('btn-retry').onclick  = () => { if (lastCfg) runSearch(lastCfg); };
$('btn-prev-page').onclick = () => renderPage(currentPage - 1);
$('btn-next-page').onclick = () => renderPage(currentPage + 1);
els.btnExportPdf.onclick = () => {
  if (lastJobs.length) window.PDF.exportReport(lastJobs, lastCfg).catch(e => alert(`Export error: ${e.message}`));
};

/* ── COVER LETTER ── */
function openCoverLetter(job) {
  currentJob = job;
  els.letterTitle.textContent = `Draft cover letter — ${job.title} @ ${job.company}`;
  els.letterBody.value = '';
  els.letterOverlay.classList.remove('hidden');
  animateModal(els.letterModal);
  doGenerateLetter();
}

async function doGenerateLetter() {
  const keys = getKeys();
  if (!keys.anthropic) { els.letterBody.value = 'Anthropic API key not set. Go to ⚙ Settings.'; return; }
  els.letterLoading.classList.remove('hidden');
  els.letterBody.style.display = 'none';
  try {
    const text = await window.AI.generateCoverLetter(
      currentJob, keys.profile, keys.name, els.letterTone.value, keys.anthropic
    );
    els.letterBody.value = text;
  } catch (err) {
    els.letterBody.value = `Error: ${err.message}`;
  } finally {
    els.letterLoading.classList.add('hidden');
    els.letterBody.style.display = '';
    /* animate AFTER display is restored so Motion One can measure the element */
    animateIn(els.letterBody);
  }
}

els.closeLetter.onclick   = () => els.letterOverlay.classList.add('hidden');
els.letterOverlay.onclick = e => { if (e.target === els.letterOverlay) els.letterOverlay.classList.add('hidden'); };
els.regenBtn.onclick      = doGenerateLetter;
els.letterTone.onchange   = doGenerateLetter;
els.copyBtn.onclick = () => {
  navigator.clipboard.writeText(els.letterBody.value).then(() => {
    els.copyBtn.textContent = 'Copied!';
    if (animate) animate(els.copyBtn, { scale: [1, 1.12, 1] }, { duration: 0.3 });
    setTimeout(() => els.copyBtn.textContent = 'Copy text', 1500);
  });
};
els.exportLetterPdf.onclick = () => {
  if (currentJob && els.letterBody.value)
    window.PDF.exportLetter(els.letterBody.value, currentJob.title, currentJob.company);
};

/* ── Search button press feedback ── */
els.searchForm.addEventListener('submit', () => {
  const btn = document.getElementById('btn-search');
  if (animate) animate(btn, { scale: [1, 0.96, 1] }, { duration: 0.18 });
  /* Auto-close drawer on mobile after search starts */
  closeMobileSidebar();
});

/* ── Mobile sidebar drawer ── */
const mobileMenuBtn = $('btn-mobile-menu');
const sidebarDim    = $('sidebar-dim');
const sidebarEl     = document.querySelector('.sidebar');

function closeMobileSidebar() {
  if (!sidebarEl) return;
  sidebarEl.classList.remove('mobile-open');
  sidebarDim.classList.remove('active');
  if (mobileMenuBtn) mobileMenuBtn.classList.remove('open');
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = sidebarEl.classList.toggle('mobile-open');
    sidebarDim.classList.toggle('active', isOpen);
    mobileMenuBtn.classList.toggle('open', isOpen);
  });
  sidebarDim.addEventListener('click', closeMobileSidebar);
}

/* ── Escape key closes any open modal ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!els.settingsOverlay.classList.contains('hidden')) els.settingsOverlay.classList.add('hidden');
  if (!els.letterOverlay.classList.contains('hidden'))  els.letterOverlay.classList.add('hidden');
});

/* Seed localStorage from config.js defaults (only when key is not already set) */
(function seedFromConfig() {
  const cfg = window.APP_CONFIG || {};
  if (cfg.apifyKey     && !localStorage.getItem('apify_key'))     localStorage.setItem('apify_key',     cfg.apifyKey);
  if (cfg.anthropicKey && !localStorage.getItem('anthropic_key')) localStorage.setItem('anthropic_key', cfg.anthropicKey);
})();

setState('empty');
