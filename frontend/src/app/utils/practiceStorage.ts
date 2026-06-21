import { LessonItem, Module } from "../data/lesson";

export type PracticeSource = "llm" | "mock" | "history" | "llm_plan_local_render" | "imported";

export interface PracticeHistoryEntry {
  id: string;
  createdAt: string;
  teacherText: string;
  modules: Module[];
  completedModuleIds: string[];
  source: PracticeSource;
  materialIds?: string[];
  confirmedAnalysis?: any;
  coverageReport?: any;
  audit?: any;
  feedback?: PracticeReviewFeedback[];
  artifactId?: string | null;
  completedItemIds?: string[];
  publishable?: boolean;
  legacy?: boolean;
}

export interface PracticePackage extends PracticeHistoryEntry {
  materialIds: string[];
  confirmedAnalysis: any;
  coverageReport: any;
  audit: any;
  feedback: PracticeReviewFeedback[];
  source: PracticeSource;
  artifactId?: string | null;
  completedItemIds: string[];
  publishable: boolean;
  legacy?: boolean;
}

export interface PracticeReviewDraft {
  id: string;
  createdAt: string;
  teacherText: string;
  modules: Module[];
  source: "llm" | "mock";
  coverageReport?: any;
  analysis?: any;
  audit?: any;
  materialIds?: string[];
  artifactId?: string | null;
  publishable?: boolean;
  feedback: PracticeReviewFeedback[];
}

export interface PracticeReviewFeedback {
  key: string;
  moduleId: string;
  itemId: string;
  type: string;
  reason: string;
  note: string;
  createdAt: string;
}

export interface WrongBookEntry {
  key: string;
  item: LessonItem;
  moduleId: string;
  moduleTitle: string;
  moduleIcon: string;
  moduleColor: string;
  type: string;
  wrongCount: number;
  reviewCount: number;
  createdAt: string;
  lastWrongAt: string;
}

const HISTORY_KEY = "kids-english-practice-history-v1";
const PACKAGE_HISTORY_KEY = "kids-english-practice-packages-v1";
const WRONG_KEY = "kids-english-wrong-book-v1";
const REVIEW_DRAFT_KEY = "kids-english-review-draft-v1";
const CURRENT_PRACTICE_KEY = "kids-english-current-practice-v1";
const HISTORY_LIMIT = 30;

export function createPracticeId() {
  return `practice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function makeWrongKey(moduleId: string, item: LessonItem) {
  return `${moduleId}:${item.id}:${item.type}`;
}

export function normalizePracticePackage(entry: PracticeHistoryEntry | PracticePackage): PracticePackage {
  return {
    ...entry,
    materialIds: entry.materialIds || [],
    confirmedAnalysis: entry.confirmedAnalysis || null,
    coverageReport: entry.coverageReport || null,
    audit: entry.audit || { overall: "UNKNOWN", legacy: !entry.audit },
    feedback: entry.feedback || [],
    artifactId: entry.artifactId || null,
    completedItemIds: entry.completedItemIds || [],
    completedModuleIds: entry.completedModuleIds || [],
    publishable: entry.publishable !== false,
    legacy: entry.legacy || !entry.audit,
  };
}

export function loadHistory(): PracticePackage[] {
  const packages = readArray<PracticePackage>(PACKAGE_HISTORY_KEY).map(normalizePracticePackage);
  const legacy = readArray<PracticeHistoryEntry>(HISTORY_KEY).map(normalizePracticePackage);
  const byId = new Map<string, PracticePackage>();
  [...packages, ...legacy].forEach((entry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  });
  const merged = [...byId.values()];
  if (legacy.length && packages.length < merged.length) saveHistory(merged);
  return merged;
}

export function saveHistory(entries: PracticeHistoryEntry[] | PracticePackage[]) {
  const normalized = entries.map(normalizePracticePackage).slice(0, HISTORY_LIMIT);
  localStorage.setItem(PACKAGE_HISTORY_KEY, JSON.stringify(normalized));
}

export function upsertHistory(entry: PracticeHistoryEntry | PracticePackage) {
  const existing = loadHistory().filter((item) => item.id !== entry.id);
  saveHistory([normalizePracticePackage(entry), ...existing]);
}

export function updateHistoryCompletion(id: string, completedModuleIds: string[]) {
  const entries = loadHistory();
  const next = entries.map((entry) =>
    entry.id === id ? { ...entry, completedModuleIds } : entry
  );
  saveHistory(next);
}

export function deleteHistoryEntry(id: string) {
  saveHistory(loadHistory().filter((entry) => entry.id !== id));
}

export function loadReviewDraft(): PracticeReviewDraft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(REVIEW_DRAFT_KEY) || "null");
    return raw && Array.isArray(raw.modules) ? raw : null;
  } catch {
    return null;
  }
}

export function saveReviewDraft(draft: PracticeReviewDraft | null) {
  if (!draft) {
    localStorage.removeItem(REVIEW_DRAFT_KEY);
    return;
  }
  localStorage.setItem(REVIEW_DRAFT_KEY, JSON.stringify(draft));
}

export function deleteReviewDraft() {
  localStorage.removeItem(REVIEW_DRAFT_KEY);
}

export function loadCurrentPractice(): { modules: Module[]; practiceId: string | null; coverageReport?: any; analysis?: any } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CURRENT_PRACTICE_KEY) || "null");
    return raw && Array.isArray(raw.modules) ? raw : null;
  } catch {
    return null;
  }
}

export function saveCurrentPractice(value: { modules: Module[]; practiceId: string | null; coverageReport?: any; analysis?: any } | null) {
  if (!value) {
    localStorage.removeItem(CURRENT_PRACTICE_KEY);
    return;
  }
  localStorage.setItem(CURRENT_PRACTICE_KEY, JSON.stringify(value));
}

export function loadWrongBook(): WrongBookEntry[] {
  return readArray<WrongBookEntry>(WRONG_KEY);
}

export function saveWrongBook(entries: WrongBookEntry[]) {
  localStorage.setItem(WRONG_KEY, JSON.stringify(entries));
}

export function addWrongItem(module: Module, item: LessonItem) {
  const now = new Date().toISOString();
  const key = makeWrongKey(module.module_id, item);
  const entries = loadWrongBook();
  const existing = entries.find((entry) => entry.key === key);

  if (existing) {
    saveWrongBook([
      { ...existing, wrongCount: existing.wrongCount + 1, lastWrongAt: now, item },
      ...entries.filter((entry) => entry.key !== key),
    ]);
    return;
  }

  saveWrongBook([
    {
      key,
      item,
      moduleId: module.module_id,
      moduleTitle: module.title,
      moduleIcon: module.icon,
      moduleColor: module.color,
      type: item.type,
      wrongCount: 1,
      reviewCount: 0,
      createdAt: now,
      lastWrongAt: now,
    },
    ...entries,
  ]);
}

export function removeWrongItems(keys: string[]) {
  const keySet = new Set(keys);
  saveWrongBook(loadWrongBook().filter((entry) => !keySet.has(entry.key)));
}

export function touchReviewedWrongItems(keys: string[]) {
  const keySet = new Set(keys);
  saveWrongBook(
    loadWrongBook().map((entry) =>
      keySet.has(entry.key) ? { ...entry, reviewCount: entry.reviewCount + 1 } : entry
    )
  );
}

function readArray<T>(key: string): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
