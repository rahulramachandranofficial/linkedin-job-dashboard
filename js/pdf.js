const JSPDF_CDN     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
const HTML2PDF_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadJsPDF() {
  await loadScript(JSPDF_CDN);
  await loadScript(AUTOTABLE_CDN);
}

async function loadHtml2pdf() {
  await loadScript(HTML2PDF_CDN);
}

function scoreColor(s) {
  if (s >= 70) return { hex: '#1D9E75', label: 'Strong match' };
  if (s >= 50) return { hex: '#BA7517', label: 'Moderate match' };
  if (s >= 25) return { hex: '#D85A30', label: 'Partial match' };
  return { hex: '#888780', label: 'Low fit' };
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

function pdfError(msg) {
  alert(`PDF export failed: ${msg}\n\nThis usually means a CDN script couldn't be loaded. Check your internet connection and try again.`);
}

window.PDF = {
  async exportReport(jobs, cfg) {
    try {
      await loadJsPDF();
    } catch (e) { pdfError(e.message); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { pdfError('jsPDF library did not load correctly.'); return; }
    try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, ML = 14, MR = 14, CW = PW - ML - MR;
    let y = 14;

    doc.setFontSize(18).setFont(undefined, 'bold').setTextColor(12, 68, 124);
    doc.text('LinkedIn Job Search Report', ML, y);
    y += 7;

    doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(100, 100, 100);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, ML, y);
    y += 5;
    doc.text(
      `Role: ${cfg.role||'Any'} · Location: ${cfg.location||'Any'} · Type: ${cfg.workTypeLabel||'Any'} · Posted: ${cfg.postedLabel||''} · Sort: ${cfg.sortLabel||''}`,
      ML, y
    );
    y += 5;

    doc.setDrawColor(12, 68, 124).setLineWidth(0.5);
    doc.line(ML, y, PW - MR, y);
    y += 5;

    const high = jobs.filter(j=>(j.score??0)>=70).length;
    const mid  = jobs.filter(j=>(j.score??0)>=50&&(j.score??0)<70).length;
    const statCols = [
      ['Total results', String(jobs.length)],
      ['Strong ≥70%',   String(high)],
      ['Moderate 50–69%', String(mid)],
      ['Sorted by', cfg.sortLabel||'AI fit score'],
    ];
    doc.autoTable({
      startY: y,
      body: statCols,
      theme: 'plain',
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold', textColor: [100,100,100], fontSize: 8 }, 1: { fontSize: 10, fontStyle: 'bold', textColor: [12,68,124] } },
      margin: { left: ML },
      styles: { cellPadding: 1.5 },
    });
    y = doc.lastAutoTable.finalY + 6;

    doc.setDrawColor(210,210,210).setLineWidth(0.3);
    doc.line(ML, y, PW - MR, y);
    y += 5;

    jobs.forEach((job, idx) => {
      const sc   = scoreColor(job.score ?? 0);
      const rgb  = hexToRgb(sc.hex);
      const needH = 52 + Math.ceil((job.matches||[]).length / 3) * 5 + (job.summary ? 5 : 0);

      if (y + needH > 280) { doc.addPage(); y = 14; }

      doc.setFillColor(...rgb).setDrawColor(...rgb).setLineWidth(1.5);
      doc.line(ML, y, ML, y + needH - 4);

      const titleX = ML + 4;
      doc.setFontSize(11).setFont(undefined, 'bold').setTextColor(12, 68, 124);
      doc.text(`#${idx+1} ${job.title}`, titleX, y + 4, { maxWidth: CW - 28 });

      doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(...rgb);
      doc.text(`${job.score??'?'}%`, PW - MR, y + 4, { align: 'right' });

      doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(...rgb);
      doc.text(sc.label, PW - MR, y + 9, { align: 'right' });

      y += 12;

      doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(80, 80, 80);
      const metaParts = [job.company, job.location, job.type, job.seniority, job.posted ? `Posted ${job.posted}` : '', job.applicants ? `${job.applicants} applicants` : '', job.salary].filter(Boolean);
      doc.text(metaParts.join(' · '), titleX, y, { maxWidth: CW - 4 });
      y += 6;

      const barX = titleX, barW = CW - 4, barH = 2.5;
      doc.setFillColor(230,230,230).rect(barX, y, barW, barH, 'F');
      doc.setFillColor(...rgb).rect(barX, y, barW * (job.score??0)/100, barH, 'F');
      y += 5;

      const allTags = [
        ...(job.matches||[]).map(m=>({text:`+ ${m}`, color:[15,110,86], bg:[225,245,238]})),
        ...(job.gaps   ||[]).map(g=>({text:`- ${g}`, color:[153,60,29],bg:[250,236,231]})),
      ];
      let tagX = titleX;
      allTags.forEach(tag => {
        const tw = doc.getStringUnitWidth(tag.text) * 8 / doc.internal.scaleFactor + 4;
        if (tagX + tw > PW - MR) { tagX = titleX; y += 5; }
        doc.setFillColor(...tag.bg).setDrawColor(...tag.bg);
        doc.roundedRect(tagX, y - 3.5, tw, 4.5, 1, 1, 'F');
        doc.setFontSize(7).setTextColor(...tag.color).text(tag.text, tagX + 2, y);
        tagX += tw + 2;
      });
      if (allTags.length) y += 6;

      if (job.summary) {
        doc.setFontSize(8).setFont(undefined,'italic').setTextColor(100,100,100);
        doc.text(job.summary, titleX, y, { maxWidth: CW - 4 });
        y += 5;
      }

      doc.setFontSize(8).setFont(undefined,'normal').setTextColor(12,68,124);

      const applyLabel = 'Apply now';
      doc.text(applyLabel, titleX, y);
      const applyW = doc.getStringUnitWidth(applyLabel) * 8 / doc.internal.scaleFactor;
      doc.link(titleX, y - 3.5, applyW, 4.5, { url: job.applyUrl });

      doc.setTextColor(150,150,150).text(' | ', titleX + applyW, y);

      const liLabel = 'View on LinkedIn';
      const liX = titleX + applyW + doc.getStringUnitWidth(' | ') * 8 / doc.internal.scaleFactor;
      doc.setTextColor(12,68,124).text(liLabel, liX, y);
      const liW = doc.getStringUnitWidth(liLabel) * 8 / doc.internal.scaleFactor;
      doc.link(liX, y - 3.5, liW, 4.5, { url: job.link });

      y += 7;

      doc.setDrawColor(210,210,210).setLineWidth(0.3);
      doc.line(ML, y, PW - MR, y);
      y += 5;
    });

      doc.setFontSize(8).setTextColor(150,150,150);
      doc.text('Powered by Apify + Claude AI (Anthropic) · linkedin-job-dashboard', PW/2, 292, { align: 'center' });

      doc.save(`job-report-${Date.now()}.pdf`);
    } catch (e) { pdfError(e.message); }
  },

  async exportLetter(text, jobTitle, company) {
    try {
      await loadHtml2pdf();
    } catch (e) { pdfError(e.message); return; }
    if (typeof window.html2pdf !== 'function') { pdfError('html2pdf library did not load correctly.'); return; }
    try {
      const html = `<div style="font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:40px 30px">
        <p style="font-size:11px;color:#888;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:24px">
          Cover Letter · ${jobTitle} @ ${company} · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
        </p>
        <div style="font-size:13px;line-height:1.9;white-space:pre-wrap;color:#1a1a1a">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>`;
      const el = document.createElement('div');
      el.innerHTML = html;
      document.body.appendChild(el);
      await window.html2pdf().set({
        margin: 0,
        filename: `cover-letter-${company.replace(/\s+/g,'-').toLowerCase()}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
      document.body.removeChild(el);
    } catch (e) { pdfError(e.message); }
  },
};
