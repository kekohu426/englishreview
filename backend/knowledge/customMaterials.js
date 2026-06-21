import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATERIAL_DIR = join(__dirname, '../../.ai/materials');
const REGISTRY_PATH = join(MATERIAL_DIR, 'registry.json');
const WORD_STOP_LIST = new Set([
  'the', 'and', 'you', 'your', 'this', 'that', 'with', 'from', 'unit', 'page',
  'lesson', 'review', 'practice', 'listen', 'read', 'write', 'look', 'circle',
]);

export function listCustomMaterials() {
  ensureMaterialDir();
  return readRegistry();
}

export function getCustomSourceDefinitions() {
  return listCustomMaterials().map(material => ({
    id: material.id,
    type: 'textbook',
    label: material.label,
    defaultForGenericUnits: false,
    aliases: material.aliases.map(alias => new RegExp(escapeRegExp(alias), 'i')),
    custom: true,
  }));
}

export function saveCustomMaterial({ label, aliases = [], filename = 'material.md', content = '' }) {
  ensureMaterialDir();
  const cleanLabel = String(label || '').trim();
  const cleanContent = String(content || '').trim();
  if (!cleanLabel) throw new Error('Material label is required.');
  if (!cleanContent) throw new Error('Markdown content is required.');

  const registry = readRegistry();
  const id = uniqueId(`custom_${slug(cleanLabel)}`, registry);
  const file = `${id}.md`;
  const filePath = join(MATERIAL_DIR, file);
  const normalizedAliases = unique([cleanLabel, ...aliases.map(String).map(item => item.trim()).filter(Boolean)]);

  fs.writeFileSync(filePath, cleanContent, 'utf8');
  const material = {
    id,
    label: cleanLabel,
    aliases: normalizedAliases,
    original_filename: path.basename(filename || file),
    filename: file,
    path: filePath,
    type: 'textbook',
    created_at: new Date().toISOString(),
  };
  writeRegistry([material, ...registry]);
  return material;
}

export function deleteCustomMaterial(id) {
  ensureMaterialDir();
  const registry = readRegistry();
  const material = registry.find(item => item.id === id);
  if (material?.path && fs.existsSync(material.path)) fs.unlinkSync(material.path);
  writeRegistry(registry.filter(item => item.id !== id));
}

export function buildCustomMaterialScope(sourceScopes = {}) {
  const materials = listCustomMaterials();
  const active = [];

  materials.forEach(material => {
    const routeScope = sourceScopes[material.id];
    if (!routeScope) return;
    const content = readMaterialContent(material);
    const scopedText = filterMarkdownByUnits(content, routeScope.units);
    const words = extractWords(scopedText);
    const sentences = extractSentences(scopedText);
    active.push({
      id: material.id,
      label: material.label,
      units: routeScope.units || [],
      pages: routeScope.pages || [],
      words,
      sentences,
      source_refs: [`${material.id}:markdown`],
      text: scopedText.slice(0, 8000),
    });
  });

  return {
    materials: active,
    words: unique(active.flatMap(item => item.words)),
    sentences: unique(active.flatMap(item => item.sentences)),
    source_refs: unique(active.flatMap(item => item.source_refs)),
  };
}

function readMaterialContent(material) {
  try {
    return fs.readFileSync(material.path, 'utf8');
  } catch {
    return '';
  }
}

function filterMarkdownByUnits(content, requestedUnits = []) {
  const text = String(content || '');
  if (!requestedUnits.length) return text;

  const lines = text.split(/\r?\n/);
  const selected = [];
  let active = false;
  for (const line of lines) {
    const unit = unitFromLine(line);
    if (unit) active = requestedUnits.includes(unit);
    if (active) selected.push(line);
  }
  return selected.length ? selected.join('\n') : text;
}

function unitFromLine(line) {
  const text = String(line || '');
  const numeric = text.match(/(?:unit|\u5355\u5143)\s*(\d+)/i) || text.match(/(?:\u7b2c)?\s*(\d+)\s*\u5355\u5143/);
  if (numeric) return Number(numeric[1]);
  const chinese = text.match(/(?:\u7b2c)?\s*([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341])\s*\u5355\u5143/);
  if (chinese) return chineseUnitNumber(chinese[1]);
  return 0;
}

function extractWords(text) {
  return unique((String(text || '').toLowerCase().match(/\b[a-z]{2,15}\b/g) || [])
    .map(word => word.replace(/[^a-z]/g, ''))
    .filter(word => word && !WORD_STOP_LIST.has(word)))
    .slice(0, 300);
}

function extractSentences(text) {
  return unique(String(text || '')
    .split(/[.!?\n]/)
    .map(item => item.trim())
    .filter(item => /[a-zA-Z]/.test(item) && item.split(/\s+/).length >= 3))
    .slice(0, 120);
}

function ensureMaterialDir() {
  fs.mkdirSync(MATERIAL_DIR, { recursive: true });
  if (!fs.existsSync(REGISTRY_PATH)) fs.writeFileSync(REGISTRY_PATH, '[]', 'utf8');
}

function readRegistry() {
  ensureMaterialDir();
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRegistry(items) {
  ensureMaterialDir();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(items, null, 2), 'utf8');
}

function uniqueId(base, registry) {
  const existing = new Set(registry.map(item => item.id));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function chineseUnitNumber(value) {
  return {
    '\u4e00': 1,
    '\u4e8c': 2,
    '\u4e09': 3,
    '\u56db': 4,
    '\u4e94': 5,
    '\u516d': 6,
    '\u4e03': 7,
    '\u516b': 8,
    '\u4e5d': 9,
    '\u5341': 10,
  }[value] || 0;
}

function slug(value) {
  return String(value || 'material')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'material';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

export default {
  listCustomMaterials,
  getCustomSourceDefinitions,
  saveCustomMaterial,
  deleteCustomMaterial,
  buildCustomMaterialScope,
};
