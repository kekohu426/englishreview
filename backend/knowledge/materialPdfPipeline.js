import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const WORD_STOP_LIST = new Set([
  'the', 'and', 'you', 'your', 'this', 'that', 'with', 'from', 'unit', 'page',
  'a', 'an', 'to', 'do', 'does', 'did', 'is', 'are', 'am', 'be', 'i', 'me', 'my',
  'he', 'she', 'it', 'we', 'they', 'them', 'his', 'her', 'our', 'their', 'what', 'where',
  'who', 'how', 'why', 'when', 'can', 'may', 'will', 'shall', 'see', 'use',
  'lesson', 'review', 'practice', 'listen', 'read', 'write', 'look', 'circle',
  'color', 'colour', 'number', 'name', 'student', 'book', 'activity', 'track',
  'sing', 'chant', 'say', 'point', 'match', 'draw', 'trace', 'stick', 'sticker',
]);

export function convertPdfToMaterialIndex({
  materialDir,
  id,
  label,
  originalFilename,
  pdfBuffer,
}) {
  if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
    throw new Error('PDF content is required.');
  }

  const materialRoot = path.join(materialDir, id);
  const pagesDir = path.join(materialRoot, 'pages');
  const imageDir = path.join(materialRoot, '_page_images');
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });

  const sourcePdfPath = path.join(materialRoot, sanitizeFilename(originalFilename || 'source.pdf'));
  fs.writeFileSync(sourcePdfPath, pdfBuffer);

  const extraction = extractPdfPages(sourcePdfPath, imageDir);
  const pages = normalizeExtractedPages(extraction.pages || []);
  if (!pages.length) throw new Error('PDF conversion did not produce any pages.');

  const allLines = [
    `# ${label} - PDF Text`,
    '',
    `- Source PDF: ${originalFilename || 'source.pdf'}`,
    `- Pages: ${extraction.page_count || pages.length}`,
    `- Extraction: pdfplumber/pypdf with optional pypdfium2 page images`,
    '',
  ];

  pages.forEach(page => {
    const mdPath = path.join(pagesDir, `page_${pad3(page.page)}.md`);
    const relativeImage = page.image_path ? path.relative(pagesDir, page.image_path).replace(/\\/g, '/') : '';
    const body = page.text.trim() || '_No extractable text was found on this page. A vision/OCR rebuild is recommended._';
    const content = [
      `# Page ${page.page}`,
      '',
      `<!-- source: ${originalFilename || 'source.pdf'}; page: ${page.page}; extraction: pdf -->`,
      relativeImage ? `<!-- image: ${relativeImage} -->` : '',
      '',
      body,
      '',
    ].filter(line => line !== '').join('\n');
    fs.writeFileSync(mdPath, content, 'utf8');
    page.markdown_path = mdPath;

    allLines.push(`## Page ${page.page}`);
    allLines.push('');
    allLines.push(body);
    allLines.push('');
  });

  const allPagesPath = path.join(pagesDir, '99_all-pages.md');
  fs.writeFileSync(allPagesPath, allLines.join('\n'), 'utf8');

  const index = buildMaterialIndex({
    id,
    label,
    originalFilename,
    sourcePdfPath,
    pagesDir,
    allPagesPath,
    pages,
  });
  const indexPath = path.join(materialRoot, 'material_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

  return {
    materialRoot,
    sourcePdfPath,
    pagesDir,
    allPagesPath,
    indexPath,
    pageCount: pages.length,
    renderedImages: extraction.rendered_images || 0,
  };
}

function extractPdfPages(pdfPath, imageDir) {
  const scriptPath = path.join(os.tmpdir(), `english_review_pdf_extract_${Date.now()}.py`);
  fs.writeFileSync(scriptPath, PYTHON_EXTRACT_SCRIPT, 'utf8');
  const result = spawnSync('python', [scriptPath, pdfPath, imageDir], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  try {
    fs.unlinkSync(scriptPath);
  } catch {
    // Ignore temp cleanup failures.
  }

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'PDF extraction failed').trim());
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('PDF extraction returned invalid JSON.');
  }
}

function normalizeExtractedPages(pages) {
  let currentUnit = null;
  return pages.map(raw => {
    const text = String(raw.text || '').replace(/\r/g, '').trim();
    const explicitUnit = unitFromText(text);
    if (explicitUnit) currentUnit = explicitUnit;
    return {
      page: Number(raw.page),
      unit: explicitUnit || currentUnit,
      text,
      image_path: raw.image_path || '',
    };
  }).filter(page => Number.isInteger(page.page) && page.page > 0);
}

function buildMaterialIndex({ id, label, originalFilename, sourcePdfPath, pagesDir, allPagesPath, pages }) {
  const indexedPages = pages.map(page => {
    const words = extractWords(page.text);
    const sentencePatterns = extractSentences(page.text);
    const grammarPoints = extractGrammarPoints(page.text);
    const sourceRef = `${id}:page:${page.page}`;
    return {
      page: page.page,
      unit: page.unit,
      title: `Page ${page.page}`,
      text_path: page.markdown_path,
      image_path: page.image_path,
      words,
      sentence_patterns: sentencePatterns,
      grammar_points: grammarPoints,
      source_refs: [sourceRef],
      text_preview: page.text.slice(0, 1200),
    };
  });

  const unitNumbers = unique(indexedPages.map(page => page.unit).filter(Boolean)).sort((a, b) => a - b);
  const units = unitNumbers.map(unit => {
    const unitPages = indexedPages.filter(page => page.unit === unit);
    return {
      unit,
      pages: unitPages.map(page => page.page),
      words: unique(unitPages.flatMap(page => page.words)),
      sentence_patterns: unique(unitPages.flatMap(page => page.sentence_patterns)),
      grammar_points: unique(unitPages.flatMap(page => page.grammar_points)),
      source_refs: unique(unitPages.flatMap(page => page.source_refs)),
    };
  });

  return {
    schema_version: 'custom.material_index.v1',
    material_id: id,
    title: label,
    source_type: 'pdf',
    original_filename: originalFilename,
    source_pdf: sourcePdfPath,
    source_md_dir: pagesDir,
    all_pages_markdown: allPagesPath,
    page_count: indexedPages.length,
    units,
    pages: indexedPages,
    words: unique(indexedPages.flatMap(page => page.words)),
    sentence_patterns: unique(indexedPages.flatMap(page => page.sentence_patterns)),
    grammar_points: unique(indexedPages.flatMap(page => page.grammar_points)),
    source_refs: unique(indexedPages.flatMap(page => page.source_refs)),
    image_safe_words: unique(indexedPages.flatMap(page => page.words)),
    created_at: new Date().toISOString(),
  };
}

function unitFromText(text) {
  const value = String(text || '');
  const numeric = value.match(/(?:^|\b)(?:unit|lesson)\s*(\d{1,2})(?:\b|[^0-9])/i)
    || value.match(/(?:第)?\s*(\d{1,2})\s*(?:单元|课|课文)/);
  if (numeric) return Number(numeric[1]);
  const chinese = value.match(/(?:第)?\s*([一二三四五六七八九十])\s*(?:单元|课|课文)/);
  return chinese ? chineseUnitNumber(chinese[1]) : null;
}

function extractWords(text) {
  return unique((String(text || '').toLowerCase().match(/\b[a-z]{2,24}\b/g) || [])
    .map(word => word.replace(/[^a-z]/g, '').trim())
    .filter(word => word && word.length <= 24)
    .filter(word => !WORD_STOP_LIST.has(word)))
    .slice(0, 400);
}

function extractSentences(text) {
  return unique(String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => /[a-zA-Z]/.test(sentence))
    .filter(sentence => sentence.split(/\s+/).length >= 3)
    .filter(sentence => sentence.length <= 160))
    .slice(0, 180);
}

function extractGrammarPoints(text) {
  const lower = String(text || '').toLowerCase();
  const points = [];
  if (/how many/.test(lower)) points.push('How many + plural countable noun');
  if (/how much/.test(lower)) points.push('How much + uncountable noun');
  if (/\bthis is\b|\bthese are\b/.test(lower)) points.push('This is / These are');
  if (/\bi can\b|\bcan you\b/.test(lower)) points.push('can for ability');
  if (/\bi like\b|\bdo you like\b/.test(lower)) points.push('like / do you like');
  if (/\bi have\b|\bhave got\b/.test(lower)) points.push('have for possession');
  return unique(points);
}

function sanitizeFilename(value) {
  const clean = path.basename(String(value || 'source.pdf')).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

function pad3(value) {
  return String(value).padStart(3, '0');
}

function chineseUnitNumber(value) {
  return {
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
    '十': 10,
  }[value] || null;
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

const PYTHON_EXTRACT_SCRIPT = String.raw`
import json
import sys
from pathlib import Path

pdf_path = Path(sys.argv[1])
image_dir = Path(sys.argv[2])
image_dir.mkdir(parents=True, exist_ok=True)

pages = []
page_count = 0
errors = []

try:
    import pdfplumber
    with pdfplumber.open(str(pdf_path)) as pdf:
        page_count = len(pdf.pages)
        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            pages.append({"page": idx, "text": text, "image_path": ""})
except Exception as exc:
    errors.append("pdfplumber: " + str(exc))
    pages = []

if not pages:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        page_count = len(reader.pages)
        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append({"page": idx, "text": text, "image_path": ""})
    except Exception as exc:
        errors.append("pypdf: " + str(exc))

rendered = 0
try:
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(pdf_path))
    if not page_count:
        page_count = len(doc)
    for idx in range(len(doc)):
        out = image_dir / ("page_%03d.png" % (idx + 1))
        if not out.exists():
            page = doc[idx]
            bitmap = page.render(scale=2.0, rotation=0)
            bitmap.to_pil().save(out)
            page.close()
        if idx < len(pages):
            pages[idx]["image_path"] = str(out)
        rendered += 1
except Exception as exc:
    errors.append("pypdfium2: " + str(exc))

print(json.dumps({
    "page_count": page_count or len(pages),
    "pages": pages,
    "rendered_images": rendered,
    "errors": errors,
}, ensure_ascii=False))
`;
