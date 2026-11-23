// Gets the text out of what the owner gives: a paste, a .txt or .eml file, a PDF, or a photo or screenshot.
// Everything runs in this browser with code served from this site (js/vendor/), loaded only when needed. Nothing is
// uploaded, and no third-party host is asked for anything (specs/one-input-tools.md D4, AC-X1).
// Returns { text, how: 'text' | 'pdf' | 'ocr', confidence (OCR only, 0-100) } or throws { kind } the page explains.
const V = (p) => new URL('./vendor/' + p, import.meta.url).href;
let pdfjs = null, ocr = null;

// A raw email (.eml): the text/plain part, decoded from quoted-printable or base64. Plain text passes through.
export function emlText(raw) {
  const s = String(raw);
  if (!/^(from|date|subject|mime-version|content-type|received|to):/im.test(s.slice(0, 2000))) return s;
  const [head, ...rest] = s.split(/\r?\n\r?\n/);
  const body = rest.join('\n\n');
  const bm = /boundary="?([^";\r\n]+)"?/i.exec(head);
  const decode = (h, b) => {
    const cs = (/charset="?([\w-]+)/i.exec(h) || [, 'utf-8'])[1].toLowerCase();
    let bytes;
    if (/content-transfer-encoding:\s*base64/i.test(h)) bytes = Uint8Array.from(atob(b.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    else if (/content-transfer-encoding:\s*quoted-printable/i.test(h)) {
      const q = b.replace(/=\r?\n/g, '');
      const out = [];
      for (let i = 0; i < q.length; i++) {
        if (q[i] === '=' && /^[0-9A-F]{2}$/i.test(q.slice(i + 1, i + 3))) { out.push(parseInt(q.slice(i + 1, i + 3), 16)); i += 2; } else out.push(q.charCodeAt(i) & 0xff);
      }
      bytes = Uint8Array.from(out);
    } else return b;
    try { return new TextDecoder(cs === 'latin1' || cs === 'iso-8859-1' ? 'windows-1252' : cs).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
  };
  const keep = head.split(/\r?\n/).filter((l) => /^(from|date|subject):/i.test(l)).join('\n');
  if (!bm) return keep + '\n\n' + decode(head, body);
  const parts = body.split('--' + bm[1]).map((p) => p.replace(/^\r?\n/, '')).filter((p) => p && !p.startsWith('--'));
  for (const p of parts) {
    const [ph, ...pb] = p.split(/\r?\n\r?\n/);
    if (/content-type:\s*text\/plain/i.test(ph)) return keep + '\n\n' + decode(ph, pb.join('\n\n'));
    if (/content-type:\s*multipart\//i.test(ph)) { const inner = emlText(ph + '\n\n' + pb.join('\n\n')); if (inner) return keep + '\n\n' + inner; }
  }
  return keep;
}

async function pdfText(bytes) {
  pdfjs = pdfjs || await import(V('pdfjs/pdf.min.mjs'));
  pdfjs.GlobalWorkerOptions.workerSrc = V('pdfjs/pdf.worker.min.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // Rebuild lines: items on the same baseline join with a space; a new baseline starts a new line.
    let out = '', lastY = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n';
      else if (out && !out.endsWith(' ') && it.str && !it.str.startsWith(' ')) out += ' ';
      out += it.str;
      lastY = y;
    }
    pages.push({ text: out, page });
  }
  return { doc, pages };
}

async function ocrImage(src) {
  if (!ocr) {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src: V('tesseract/tesseract.min.js'), onload: res, onerror: () => rej({ kind: 'reader' }) }); document.head.append(s); });
    ocr = window.Tesseract.createWorker('eng', 1, { workerPath: V('tesseract/worker.min.js'), corePath: V('tesseract/core'), langPath: V('tesseract/lang'), gzip: true, cacheMethod: 'none' });
  }
  const w = await ocr;
  const r = await w.recognize(src);
  return { text: r.data.text || '', confidence: Math.round(r.data.confidence || 0) };
}

// Draws one PDF page to a canvas, for OCR when the PDF has no text layer (a scan).
async function pageCanvas(page) {
  const vp = page.getViewport({ scale: 2 });
  const c = Object.assign(document.createElement('canvas'), { width: Math.ceil(vp.width), height: Math.ceil(vp.height) });
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c }).promise;
  return c;
}

export async function readDoc(file) {
  const name = (file.name || '').toLowerCase(), type = file.type || '';
  if (/^text\/|message\/rfc822/.test(type) || /\.(txt|eml|msg)$/.test(name)) return { text: emlText(await file.text()), how: 'text' };
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    const { pages } = await pdfText(new Uint8Array(await file.arrayBuffer()));
    const text = pages.map((p) => p.text).join('\n');
    if (text.replace(/\s+/g, '').length >= 20) return { text, how: 'pdf' };
    let all = '', conf = 100;
    for (const p of pages.slice(0, 3)) { const r = await ocrImage(await pageCanvas(p.page)); all += r.text + '\n'; conf = Math.min(conf, r.confidence); }
    if (all.replace(/\s+/g, '').length < 20) throw { kind: 'unreadable' };
    return { text: all, how: 'ocr', confidence: conf };
  }
  if (/\.(heic|heif)$/.test(name) || /hei[cf]/.test(type)) {
    // Only Safari can draw HEIC; elsewhere ask for a screenshot instead (spec §5.4).
    try { const bmp = await createImageBitmap(file); const r = await ocrImage(bmp); return { text: r.text, how: 'ocr', confidence: r.confidence }; } catch { throw { kind: 'heic' }; }
  }
  if (/^image\//.test(type) || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) {
    const r = await ocrImage(file);
    if (r.text.replace(/\s+/g, '').length < 20) throw { kind: 'unreadable' };
    return { text: r.text, how: 'ocr', confidence: r.confidence };
  }
  throw { kind: 'type' };
}
