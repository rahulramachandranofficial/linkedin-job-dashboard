const PDFJS_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

async function loadPdfJs() {
  if (window.pdfjsLib) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS_CDN; s.onload = res; s.onerror = () => rej(new Error('PDF.js load failed'));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
}

async function extractPdfText(file) {
  await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text.trim();
}

function extractTxtText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result.trim());
    r.onerror = () => rej(new Error('Failed to read TXT file'));
    r.readAsText(file, 'UTF-8');
  });
}

window.Resume = {
  async extract(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf'))  return extractPdfText(file);
    if (name.endsWith('.txt'))  return extractTxtText(file);
    throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
  },
};
