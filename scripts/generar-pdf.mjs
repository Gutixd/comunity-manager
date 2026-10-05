// Genera el PDF "Kit de inicio para Community Managers".
// Textos y colores: content/kit.json  ·  Uso: npm run pdf
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kit = JSON.parse(await readFile(path.join(root, 'content/kit.json'), 'utf8'));

const hex = (h) => rgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const C = Object.fromEntries(Object.entries(kit.tema).map(([k, v]) => [k, hex(v)]));
const WHITE = rgb(1, 1, 1);
const GREY = rgb(0.45, 0.4, 0.5);

const W = 595.28; // A4
const H = 841.89;
const M = 44;
const CW = W - M * 2;

const pdf = await PDFDocument.create();
pdf.setTitle(kit.portada.titulo);
pdf.setLanguage('es');
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

// Helvetica estándar no dibuja emojis: se quitan del texto
const strip = (s) =>
  String(s).replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F\u200D]/gu, '').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of strip(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Dibuja texto con salto de línea; (x, y) es la esquina superior. Devuelve la y final. */
function text(page, str, x, y, { font = regular, size = 10.5, color = C.texto, width = CW, lead = 1.35 } = {}) {
  for (const line of wrap(str, font, size, width)) {
    page.drawText(line, { x, y: y - size, font, size, color });
    y -= size * lead;
  }
  return y;
}

const box = (page, x, y, w, h, opts) => page.drawRectangle({ x, y: y - h, width: w, height: h, ...opts });

let pageNo = 0;
function newPage(section) {
  const page = pdf.addPage([W, H]);
  pageNo++;
  if (!section) return { page, y: H - M };
  box(page, 0, H, W, 10, { color: C.acento });
  page.drawText(String(pageNo).padStart(2, '0'), { x: M, y: H - 66, font: bold, size: 30, color: C.acento });
  let y = text(page, section.titulo, M + 50, H - 40, { font: bold, size: 22, width: CW - 50, lead: 1.1 });
  y = text(page, section.bajada, M + 50, y - 4, { size: 10.5, color: GREY, width: CW - 50 });
  page.drawText(kit.portada.titulo, { x: M, y: 24, font: regular, size: 8, color: GREY });
  return { page, y: y - 16 };
}

/* ---------- Portada ---------- */
{
  const { page } = newPage();
  const p = kit.portada;
  box(page, 0, H, W, H, { color: C.oscuro });
  page.drawCircle({ x: W - 40, y: H - 60, size: 190, color: C.acento });
  page.drawCircle({ x: 20, y: 30, size: 95, color: C.secundario });
  let y = text(page, p.etiqueta.toUpperCase(), M, H - 200, { font: bold, size: 9.5, color: C.resalte, width: CW - 120 });
  y = text(page, p.titulo, M, y - 14, { font: bold, size: 44, color: WHITE, width: CW - 60, lead: 1.05 });
  y = text(page, p.bajada, M, y - 14, { size: 14, color: WHITE, width: CW - 140 });
  y -= 34;
  p.contenido.forEach((item, i) => {
    box(page, M, y, 22, 22, { color: C.acento });
    page.drawText(String(i + 1), { x: M + 7.5, y: y - 15.5, font: bold, size: 11, color: WHITE });
    text(page, item, M + 32, y - 5, { font: bold, size: 12, color: WHITE, width: CW - 80 });
    y -= 29;
  });
  text(page, p.pie, M + 150, 60, { size: 9.5, color: WHITE, width: CW - 150 });
}


/** "Título: detalle" → título en negrita y detalle debajo. Devuelve la y final. */
function lead(page, str, x, y, width, { size = 10.5, gap = 0 } = {}) {
  const clean = strip(str);
  const i = clean.indexOf(': ');
  if (i < 0) return text(page, clean, x, y, { size, width }) - gap;
  y = text(page, clean.slice(0, i), x, y, { font: bold, size: size + 1, width });
  return text(page, clean.slice(i + 2), x, y - 1, { size: size - 0.5, color: GREY, width }) - gap;
}

function leadHeight(str, width, size = 10.5) {
  const clean = strip(str);
  const i = clean.indexOf(': ');
  if (i < 0) return wrap(clean, regular, size, width).length * size * 1.35;
  return (
    wrap(clean.slice(0, i), bold, size + 1, width).length * (size + 1) * 1.35 +
    wrap(clean.slice(i + 2), regular, size - 0.5, width).length * (size - 0.5) * 1.35 + 1
  );
}

function numberedList(section) {
  let { page, y } = newPage(section);
  section.items.forEach((item, i) => {
    page.drawCircle({ x: M + 10, y: y - 9, size: 10, color: C.acento });
    const n = String(i + 1);
    page.drawText(n, { x: M + 10 - bold.widthOfTextAtSize(n, 9) / 2, y: y - 12, font: bold, size: 9, color: WHITE });
    y = lead(page, item, M + 30, y - 1, CW - 30, { size: 12, gap: 15 });
  });
}

/* ---------- Best practices ---------- */
numberedList(kit.agencia);
numberedList(kit.community);

/* ---------- Do & Don't ---------- */
{
  const s = kit.dodont;
  let { page, y } = newPage(s);
  const colW = (CW - 10) / 2;
  const textW = colW - 22;
  [[s.do, C.acento, M], [s.dont, C.oscuro, M + colW + 10]].forEach(([label, color, x]) => {
    box(page, x, y, colW, 26, { color });
    page.drawText(label, { x: x + 12, y: y - 18, font: bold, size: 13, color: WHITE });
  });
  y -= 26;
  s.pares.forEach(([yes, no], r) => {
    const h = Math.max(leadHeight(yes, textW, 11.5), leadHeight(no, textW, 11.5)) + 22;
    box(page, M, y, CW, h, { color: r % 2 ? C.suave : WHITE, borderColor: GREY, borderWidth: 0.4 });
    page.drawLine({ start: { x: M + colW + 5, y }, end: { x: M + colW + 5, y: y - h }, thickness: 0.4, color: GREY });
    lead(page, yes, M + 12, y - 11, textW, { size: 11.5 });
    lead(page, no, M + colW + 22, y - 11, textW, { size: 11.5 });
    y -= h;
  });
}

/* ---------- Calendario ---------- */
{
  const s = kit.calendario;
  let { page, y } = newPage(s);
  for (const campo of s.campos) {
    page.drawText(campo, { x: M, y: y - 10, font: bold, size: 9.5, color: C.texto });
    const lx = M + bold.widthOfTextAtSize(campo, 9.5) + 8;
    page.drawLine({ start: { x: lx, y: y - 12 }, end: { x: W - M, y: y - 12 }, thickness: 0.7, color: GREY });
    y -= 24;
  }
  y -= 4;
  const gap = 8;
  const pw = (CW - gap * (s.pilares.length - 1)) / s.pilares.length;
  s.pilares.forEach((pilar, i) => {
    const x = M + i * (pw + gap);
    box(page, x, y, pw, 44, { color: C.suave, borderColor: C.acento, borderWidth: 1 });
    page.drawText(pilar, { x: x + 8, y: y - 14, font: bold, size: 8.5, color: C.acento });
  });
  y -= 60;

  const headH = 24;
  const rowH = (y - 70 - headH) / s.dias.length;
  let x = M;
  box(page, M, y, CW, headH, { color: C.oscuro });
  s.columnas.forEach((col, i) => {
    page.drawText(col, { x: x + 6, y: y - 15.5, font: bold, size: 8, color: WHITE });
    x += CW * s.anchos[i];
  });
  y -= headH;
  s.dias.forEach((dia, r) => {
    box(page, M, y, CW, rowH, { color: r % 2 ? C.suave : WHITE, borderColor: GREY, borderWidth: 0.5 });
    page.drawText(dia, { x: M + 6, y: y - 16, font: bold, size: 8.5, color: C.texto });
    let cx = M;
    s.anchos.slice(0, -1).forEach((a) => {
      cx += CW * a;
      page.drawLine({ start: { x: cx, y }, end: { x: cx, y: y - rowH }, thickness: 0.5, color: GREY });
    });
    y -= rowH;
  });
  text(page, s.nota, M, y - 10, { size: 8.5, color: GREY });
}

/* ---------- Checklist ---------- */
{
  const s = kit.checklist;
  let { page, y } = newPage(s);
  for (const grupo of s.grupos) {
    const tw = bold.widthOfTextAtSize(grupo.nombre, 12) + 20;
    box(page, M, y, tw, 24, { color: C.acento });
    page.drawText(grupo.nombre, { x: M + 10, y: y - 16.5, font: bold, size: 12, color: WHITE });
    y -= 38;
    for (const item of grupo.items) {
      box(page, M + 2, y, 14, 14, { borderColor: C.texto, borderWidth: 1.2, color: WHITE });
      y = text(page, item, M + 28, y - 1, { size: 11.5, width: CW - 28 }) - 11;
    }
    y -= 12;
  }
}

/* ---------- Guía de respuesta ---------- */
{
  const s = kit.respuestas;
  let { page, y } = newPage(s);
  s.pasos.forEach(([titulo, detalle], i) => {
    page.drawCircle({ x: M + 11, y: y - 11, size: 11, color: C.acento });
    page.drawText(String(i + 1), { x: M + 8, y: y - 15, font: bold, size: 11, color: WHITE });
    const ty = text(page, titulo, M + 32, y - 1, { font: bold, size: 11.5, width: CW - 32 });
    y = text(page, detalle, M + 32, ty - 1, { size: 10, color: GREY, width: CW - 32 }) - 9;
  });
  y -= 8;

  const cols = [0.2, 0.36, 0.44];
  const heads = ['Tipo de mensaje', 'Qué hacer', 'Ejemplo para adaptar'];
  let x = M;
  box(page, M, y, CW, 22, { color: C.oscuro });
  heads.forEach((h, i) => {
    page.drawText(h, { x: x + 7, y: y - 14.5, font: bold, size: 8.5, color: WHITE });
    x += CW * cols[i];
  });
  y -= 22;
  s.tipos.forEach((fila, r) => {
    const cells = fila.map((t, i) => wrap(t, i ? regular : bold, 9.5, CW * cols[i] - 14));
    const h = Math.max(...cells.map((c) => c.length)) * 12.8 + 14;
    box(page, M, y, CW, h, { color: r % 2 ? C.suave : WHITE, borderColor: GREY, borderWidth: 0.5 });
    let cx = M;
    fila.forEach((t, i) => {
      text(page, t, cx + 7, y - 7, { font: i ? regular : bold, size: 9.5, width: CW * cols[i] - 14, color: i ? C.texto : C.acento });
      cx += CW * cols[i];
    });
    y -= h;
  });
  y -= 18;

  const rh = s.recordatorios.length * 17 + 36;
  box(page, M, y, CW, rh, { color: C.resalte });
  page.drawText('Recuerda', { x: M + 12, y: y - 19, font: bold, size: 11, color: C.texto });
  let ry = y - 28;
  for (const r of s.recordatorios) ry = text(page, `-  ${r}`, M + 12, ry, { size: 10, width: CW - 24 }) - 3.5;
}

/* ---------- Mapa de roles ---------- */
{
  const s = kit.roles;
  let { page, y } = newPage(s);
  const cx = W / 2;
  const cy = y - 185;
  const rx = 190;
  const ry = 140;
  const nodes = s.lista.map(([nombre], i) => {
    const a = (-90 + (i * 360) / s.lista.length) * (Math.PI / 180);
    return { nombre, x: cx + rx * Math.cos(a), y: cy - ry * Math.sin(a) };
  });
  for (const n of nodes) {
    page.drawLine({ start: { x: cx, y: cy }, end: { x: n.x, y: n.y }, thickness: 1.6, color: C.acento, opacity: 0.55 });
  }
  for (const n of nodes) {
    const w = Math.max(74, bold.widthOfTextAtSize(n.nombre, 8.5) + 18);
    page.drawRectangle({ x: n.x - w / 2, y: n.y - 12, width: w, height: 24, color: WHITE, borderColor: C.oscuro, borderWidth: 1.2 });
    page.drawText(n.nombre, { x: n.x - bold.widthOfTextAtSize(n.nombre, 8.5) / 2, y: n.y - 3, font: bold, size: 8.5, color: C.texto });
  }
  page.drawCircle({ x: cx, y: cy, size: 50, color: C.acento });
  s.centro.split(' ').forEach((word, i, all) => {
    page.drawText(word, {
      x: cx - bold.widthOfTextAtSize(word, 11) / 2,
      y: cy + ((all.length - 1) / 2 - i) * 13 - 4,
      font: bold, size: 11, color: WHITE,
    });
  });

  y = cy - ry - 44;
  const colW = (CW - 16) / 2;
  const half = Math.ceil(s.lista.length / 2);
  const rowH = 44;
  s.lista.forEach(([nombre, detalle], i) => {
    const x = M + (i >= half ? colW + 16 : 0);
    const ty = y - (i % half) * rowH;
    box(page, x, ty, 4, rowH - 10, { color: C.acento });
    page.drawText(nombre, { x: x + 12, y: ty - 11, font: bold, size: 10.5, color: C.texto });
    text(page, detalle, x + 12, ty - 15, { size: 9, color: GREY, width: colW - 14 });
  });
  text(page, s.nota, M, y - half * rowH - 6, { size: 9, color: GREY });
}


/* ---------- Quiz ---------- */
{
  const s = kit.quiz;
  let { page, y } = newPage(s);
  s.preguntas.forEach(([pregunta, opciones]) => {
    y = text(page, pregunta, M, y, { font: bold, size: 12.5, width: CW }) - 4;
    opciones.forEach((op, i) => {
      page.drawText('ABCDE'[i], { x: M + 8, y: y - 10, font: bold, size: 10.5, color: C.acento });
      y = text(page, op, M + 26, y, { size: 11, width: CW - 26 }) - 3.5;
    });
    y -= 14;
  });
  box(page, M, y, CW, 34, { color: C.suave, borderColor: C.acento, borderWidth: 1 });
  page.drawText(s.anota, { x: M + 12, y: y - 21, font: bold, size: 10.5, color: C.texto });
  'ABCDE'.split('').forEach((l, i) => {
    const x = M + 110 + i * 70;
    page.drawText(`${l}:`, { x, y: y - 21, font: bold, size: 10.5, color: C.acento });
    page.drawLine({ start: { x: x + 16, y: y - 23 }, end: { x: x + 52, y: y - 23 }, thickness: 0.7, color: GREY });
  });
}

/* ---------- Resultados del quiz ---------- */
{
  const s = kit.resultados;
  let { page, y } = newPage(s);
  s.items.forEach(([letra, titulo, desc]) => {
    const h = wrap(desc, regular, 11.5, CW - 70).length * 15.5 + 42;
    box(page, M, y, CW, h, { color: C.suave });
    box(page, M, y, 44, h, { color: C.acento });
    page.drawText(letra, { x: M + 22 - bold.widthOfTextAtSize(letra, 22) / 2, y: y - h / 2 - 8, font: bold, size: 22, color: WHITE });
    page.drawText(strip(titulo).toUpperCase(), { x: M + 58, y: y - 20, font: bold, size: 11.5, color: C.acento });
    text(page, desc, M + 58, y - 30, { size: 11.5, width: CW - 70 });
    y -= h + 10;
  });
  const h = wrap(s.cierre, bold, 11, CW - 28).length * 15 + 22;
  box(page, M, y - 6, CW, h, { color: C.resalte });
  text(page, s.cierre, M + 14, y - 16, { font: bold, size: 11, width: CW - 28, lead: 1.4 });
}

/* ---------- LinkedIn ---------- */
{
  const s = kit.linkedin;
  let { page, y } = newPage(s);
  s.items.forEach((item) => {
    box(page, M, y, 4, leadHeight(item, CW - 20, 13) + 2, { color: C.acento });
    y = lead(page, item, M + 16, y - 1, CW - 20, { size: 13, gap: 24 });
  });
  y -= 10;
  const h = wrap(s.cierre, bold, 14, CW - 40).length * 20 + 30;
  box(page, M, y, CW, h, { color: C.oscuro });
  text(page, s.cierre, M + 20, y - 18, { font: bold, size: 14, color: WHITE, width: CW - 40, lead: 1.4 });
}

const out = path.join(root, kit.archivo);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, await pdf.save());
console.log(`PDF generado: ${kit.archivo} (${pdf.getPageCount()} páginas)`);
