import { useEffect, useRef, useState } from "react";
import { Module } from "./data/lesson";
import { HomeScreen } from "./components/HomeScreen";
import { LessonScreen } from "./components/LessonScreen";
import { ParentGenerateScreen } from "./components/ParentGenerateScreen";
import { ParentReviewScreen } from "./components/ParentReviewScreen";
import { initSpeech } from "./utils/speech";
import {
  PracticeHistoryEntry,
  PracticeReviewDraft,
  WrongBookEntry,
  addWrongItem,
  createPracticeId,
  deleteHistoryEntry,
  deleteReviewDraft,
  loadCurrentPractice,
  loadHistory,
  loadReviewDraft,
  loadWrongBook,
  removeWrongItems,
  saveCurrentPractice,
  saveReviewDraft,
  touchReviewedWrongItems,
  updateHistoryCompletion,
  upsertHistory,
} from "./utils/practiceStorage";

type Screen = "home" | "lesson" | "parent-generate" | "parent-review";
type LessonMode = "today" | "module" | "history" | "wrongbook";
type CoverageReport = any;
type HomeworkAnalysis = any;

const STORAGE_KEY = "kids-english-review-v2";
const CLIENT_RESET_KEYS = [
  STORAGE_KEY,
  "kids-english-practice-history-v1",
  "kids-english-wrong-book-v1",
  "kids-english-review-draft-v1",
  "kids-english-current-practice-v1",
  "kids-english-pending",
  "kids-english-active-tab",
];

function isModuleReady(module?: Module) {
  return !!module && (module.status || "ready") === "ready" && module.items.length > 0;
}

function loadCompleted(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveCompleted(s: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

function readyModulesOnly(modules: Module[]) {
  return modules.filter(isModuleReady);
}

export function createTodayPracticeModule(modules: Module[]): Module {
  const ready = readyModulesOnly(modules);
  const items = ready.flatMap((module) =>
    module.items.map((item) => ({
      ...item,
      id: `today-${module.module_id}-${item.id}`,
    }))
  );
  const minutes = ready.reduce((sum, module) => sum + (module.estimated_minutes || 0), 0);
  return {
    module_id: "today-practice",
    icon: "⭐",
    title: "今日练习",
    goal: "按老师要求生成的一整套练习",
    estimated_minutes: Math.max(5, minutes),
    color: "#1f9d67",
    status: "ready",
    items,
  };
}

function createWrongModule(entries: WrongBookEntry[]): Module {
  const first = entries[0];
  return {
    module_id: `wrong-${Date.now()}`,
    icon: first?.moduleIcon || "✍️",
    title: entries.length > 1 ? "错题本复练" : first?.moduleTitle || "错题复练",
    goal: "把做错过的题再练一遍",
    estimated_minutes: Math.max(3, entries.length * 2),
    color: first?.moduleColor || "#e04b4b",
    status: "ready",
    items: entries.map((entry) => entry.item),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [moduleIdx, setModuleIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(loadCompleted);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonModules, setLessonModules] = useState<Module[]>([]);
  const [history, setHistory] = useState<PracticeHistoryEntry[]>([]);
  const [wrongBook, setWrongBook] = useState<WrongBookEntry[]>([]);
  const [reviewDraft, setReviewDraft] = useState<PracticeReviewDraft | null>(null);
  const [lessonMode, setLessonMode] = useState<LessonMode>("today");
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null);
  const [wrongReviewKeys, setWrongReviewKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const [homeworkAnalysis, setHomeworkAnalysis] = useState<HomeworkAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const requestIdRef = useRef(0);
  const generatedDuringParentFlowRef = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      CLIENT_RESET_KEYS.forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
      setCompleted(new Set());
      setHistory([]);
      setWrongBook([]);
      setReviewDraft(null);
      setModules([]);
      setLessonModules([]);
      saveCurrentPractice(null);
      setCoverageReport(null);
      setHomeworkAnalysis(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
    initSpeech();
    refreshPracticeStores();
    setReviewDraft(loadReviewDraft());
    const current = loadCurrentPractice();
    if (current) {
      setCurrentPractice(current.modules, current.practiceId || null);
      setCoverageReport(current.coverageReport || null);
      setHomeworkAnalysis(current.analysis || null);
    }
  }, []);

  function refreshPracticeStores() {
    setHistory(loadHistory());
    setWrongBook(loadWrongBook());
  }

  function setPendingReviewDraft(draft: PracticeReviewDraft | null) {
    setReviewDraft(draft);
    saveReviewDraft(draft);
  }

  function setCurrentPractice(nextModules: Module[], practiceId: string | null) {
    setModules(nextModules);
    setCurrentPracticeId(practiceId);
  }

  function saveGeneratedHistory(teacherText: string, nextModules: Module[], source: "llm" | "mock", metadata: any = {}) {
    const ready = readyModulesOnly(nextModules);
    if (ready.length === 0) return null;
    const id = metadata.id || createPracticeId();
    upsertHistory({
      id,
      createdAt: metadata.createdAt || new Date().toISOString(),
      teacherText,
      modules: nextModules,
      completedModuleIds: [],
      source,
      materialIds: metadata.materialIds || [],
      confirmedAnalysis: metadata.confirmedAnalysis || metadata.analysis || null,
      coverageReport: metadata.coverageReport || null,
      audit: metadata.audit || { overall: "PASS" },
      feedback: metadata.feedback || [],
      artifactId: metadata.artifactId || null,
      completedItemIds: [],
      publishable: metadata.publishable !== false,
    });
    refreshPracticeStores();
    return id;
  }

  async function analyzeHomework(teacherText: string, materialContext: any = {}) {
    setAnalyzing(true);
    setError(null);
    setGenerationStatus("正在拆解老师作业...");
    try {
      const resp = await fetch("/api/analyze-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: teacherText, material_context: materialContext }),
      });
      const data = await readJsonResponse(resp);
      if (!resp.ok || data.error) throw new Error(data.error || `Request failed: ${resp.status}`);
      setHomeworkAnalysis(data.analysis || null);
      setCoverageReport(null);
      setGenerationStatus(null);
    } catch (e: any) {
      setError(e.message || "Homework analysis failed.");
      setGenerationStatus(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateModules(teacherText: string, useMock = false, confirmedAnalysis: HomeworkAnalysis | null = null) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    generatedDuringParentFlowRef.current = screen === "parent-generate";
    setLoading(true);
    setError(null);
    setLessonMode("today");
    setCurrentPracticeId(null);
    try {
      if (!useMock) {
        await generateModulesDirectly(teacherText, requestId, confirmedAnalysis);
        return;
      }

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/api/mock-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: teacherText, difficulty: "level_1", target_minutes: 5 }),
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      const data = await readJsonResponse(resp);
      if (!resp.ok || data.error) throw new Error(data.error || `Request failed: ${resp.status}`);
      if (requestId === requestIdRef.current) {
        createReviewDraft(teacherText, data.modules || [], "mock", data.meta?.coverage || null, confirmedAnalysis, data.practice || data.meta || {});
        setCoverageReport(data.meta?.coverage || null);
        setGenerationStatus(null);
      }
    } catch (e: any) {
      if (requestId === requestIdRef.current) {
        if (!useMock) {
          try {
            const fallback = await fetch("/api/mock-generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: teacherText, difficulty: "level_1", target_minutes: 5 }),
            });
            const fallbackData = await readJsonResponse(fallback);
            if (fallback.ok && !fallbackData.error) {
              const nextModules = fallbackData.modules || [];
              createReviewDraft(teacherText, nextModules, "mock", fallbackData.meta?.coverage || null, confirmedAnalysis, fallbackData.practice || fallbackData.meta || {});
              setCoverageReport(fallbackData.meta?.coverage || null);
              setError(
                e.name === "AbortError"
                  ? "AI generation timed out. Generated demo practice is ready."
                  : `${e.message || "AI generation failed"}. Generated demo practice is ready.`
              );
            } else {
              setError(fallbackData.error || e.message || "Generation failed.");
            }
          } catch (fallbackError: any) {
            setCurrentPractice([], null);
            saveCurrentPractice(null);
            setError(fallbackError.message || e.message || "Generation failed.");
          }
        } else {
          setCurrentPractice([], null);
          saveCurrentPractice(null);
          setCoverageReport(null);
          setError(e.message || "Mock generation failed.");
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function generateModulesDirectly(teacherText: string, requestId: number, confirmedAnalysis: HomeworkAnalysis | null = null) {
    setGenerationStatus("正在规划题目并生成练习...");
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: teacherText,
        difficulty: "level_2",
        target_minutes: 20,
        confirmed_analysis: confirmedAnalysis,
      }),
    });
    const data = await readJsonResponse(resp);
    if (!resp.ok || data.error) throw new Error(data.error || `Request failed: ${resp.status}`);
    if (requestId !== requestIdRef.current) return;

    const nextModules = data.modules || [];
    createReviewDraft(teacherText, nextModules, "llm", data.meta?.coverage || null, data.meta?.confirmedAnalysis || confirmedAnalysis, data.practice || data.meta || {});
    setCoverageReport(data.meta?.coverage || null);
    setHomeworkAnalysis(data.meta?.confirmedAnalysis || confirmedAnalysis);
    setCompleted(new Set());
    saveCompleted(new Set());
    setGenerationStatus(null);
  }

  function createReviewDraft(
    teacherText: string,
    nextModules: Module[],
    source: "llm" | "mock",
    coverage: CoverageReport | null,
    analysis: HomeworkAnalysis | null,
    metadata: any = {}
  ) {
    const draft: PracticeReviewDraft = {
      id: metadata.id || createPracticeId(),
      createdAt: metadata.createdAt || new Date().toISOString(),
      teacherText,
      modules: nextModules,
      source,
      coverageReport: metadata.coverageReport || coverage,
      analysis: metadata.confirmedAnalysis || metadata.analysis || analysis,
      audit: metadata.audit || { overall: metadata.publishable === false ? "REVIEW_REQUIRED" : "PASS" },
      materialIds: metadata.materialIds || [],
      artifactId: metadata.artifactId || null,
      publishable: metadata.publishable !== false,
      feedback: metadata.feedback || [],
    };
    setPendingReviewDraft(draft);
    setCurrentPractice([], null);
    saveCurrentPractice(null);
    setScreen("parent-review");
  }

  function publishReviewDraft(nextModules: Module[]) {
    if (!reviewDraft) return;
    const practiceId = saveGeneratedHistory(reviewDraft.teacherText, nextModules, reviewDraft.source, {
      id: reviewDraft.id,
      createdAt: reviewDraft.createdAt,
      materialIds: reviewDraft.materialIds || [],
      confirmedAnalysis: reviewDraft.analysis || null,
      coverageReport: reviewDraft.coverageReport || null,
      audit: reviewDraft.audit || { overall: "PASS" },
      feedback: reviewDraft.feedback || [],
      artifactId: reviewDraft.artifactId || null,
      publishable: reviewDraft.publishable !== false,
    });
    setCurrentPractice(nextModules, practiceId);
    saveCurrentPractice({
      modules: nextModules,
      practiceId,
      coverageReport: reviewDraft.coverageReport || null,
      analysis: reviewDraft.analysis || null,
    });
    setCoverageReport(reviewDraft.coverageReport || null);
    setHomeworkAnalysis(reviewDraft.analysis || null);
    setCompleted(new Set());
    saveCompleted(new Set());
    setPendingReviewDraft(null);
    deleteReviewDraft();
    refreshPracticeStores();
    setScreen("home");
  }

  function updateReviewDraft(draft: PracticeReviewDraft) {
    setPendingReviewDraft(draft);
  }

  function discardReviewDraft() {
    setPendingReviewDraft(null);
    deleteReviewDraft();
    setScreen("parent-generate");
  }

  const goHome = () => setScreen("home");

  const startTypeModule = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, modules.length - 1));
    if (!isModuleReady(modules[safeIdx])) return;
    setLessonModules(modules);
    setModuleIdx(safeIdx);
    setLessonMode("module");
    setScreen("lesson");
  };

  const startTodayPractice = () => {
    const todayModule = createTodayPracticeModule(modules);
    if (!isModuleReady(todayModule)) return;
    setLessonModules([todayModule]);
    setModuleIdx(0);
    setLessonMode("today");
    setScreen("lesson");
  };

  const handleComplete = (moduleId: string) => {
    if (lessonMode === "wrongbook") {
      touchReviewedWrongItems(wrongReviewKeys);
      refreshPracticeStores();
      setScreen("home");
      return;
    }

    if (lessonMode === "today" || lessonMode === "history") {
      const next = new Set([...completed, ...readyModulesOnly(modules).map((module) => module.module_id)]);
      setCompleted(next);
      saveCompleted(next);
      if (currentPracticeId) {
        updateHistoryCompletion(currentPracticeId, [...next]);
        refreshPracticeStores();
      }
      goHome();
      return;
    }

    const next = new Set([...completed, moduleId]);
    setCompleted(next);
    saveCompleted(next);
    if (currentPracticeId) {
      updateHistoryCompletion(currentPracticeId, [...next]);
      refreshPracticeStores();
    }

    const sourceModules = lessonMode === "history" ? lessonModules : modules;
    const currentIdx = sourceModules.findIndex((m) => m.module_id === moduleId);
    const nextIdx = sourceModules.findIndex((m, idx) => idx > currentIdx && isModuleReady(m) && !next.has(m.module_id));
    if (nextIdx >= 0) {
      setModuleIdx(nextIdx);
    } else {
      goHome();
    }
  };

  const handleWrong = () => {
    const module = lessonModules[moduleIdx];
    const item = module?.items?.find((_, idx) => idx === getCurrentItemIndex());
    if (!module || !item || lessonMode === "wrongbook") return;
    addWrongItem(module, item);
    refreshPracticeStores();
  };

  const currentLessonRef = useRef({ itemIdx: 0 });
  function getCurrentItemIndex() {
    return currentLessonRef.current.itemIdx || 0;
  }
  const handleItemChange = (idx: number) => {
    currentLessonRef.current.itemIdx = idx;
  };

  const openHistoryEntry = (entry: PracticeHistoryEntry, reset = false) => {
    const completedIds = reset ? [] : entry.completedModuleIds;
    setCompleted(new Set(completedIds));
    if (reset) {
      updateHistoryCompletion(entry.id, []);
      refreshPracticeStores();
    }
    setCurrentPractice(entry.modules, entry.id);
    saveCurrentPractice({
      modules: entry.modules,
      practiceId: entry.id,
      coverageReport: entry.coverageReport || coverageReport,
      analysis: entry.confirmedAnalysis || homeworkAnalysis,
    });
    setLessonModules([createTodayPracticeModule(entry.modules)]);
    setModuleIdx(0);
    setLessonMode("history");
    setScreen("lesson");
  };

  const removeHistoryEntry = (entry: PracticeHistoryEntry) => {
    deleteHistoryEntry(entry.id);
    if (entry.id === currentPracticeId) {
      setCurrentPractice([], null);
      saveCurrentPractice(null);
      setLessonModules([]);
      setCompleted(new Set());
      saveCompleted(new Set());
    }
    refreshPracticeStores();
  };

  const openWrongEntries = (entries: WrongBookEntry[]) => {
    if (entries.length === 0) return;
    setWrongReviewKeys(entries.map((entry) => entry.key));
    setCompleted(new Set());
    setLessonModules([createWrongModule(entries)]);
    setModuleIdx(0);
    setLessonMode("wrongbook");
    setScreen("lesson");
  };

  const clearWrongItems = (keys: string[]) => {
    removeWrongItems(keys);
    refreshPracticeStores();
  };

  if (screen === "parent-generate") {
    return (
      <ParentGenerateScreen
        onHome={goHome}
        onAnalyze={analyzeHomework}
        onGenerate={(text, analysis) => generateModules(text, false, analysis)}
        analysisReport={homeworkAnalysis}
        onAnalysisChange={setHomeworkAnalysis}
        analyzing={analyzing}
        loading={loading}
        error={error}
        generationStatus={generationStatus}
        coverageReport={coverageReport}
      />
    );
  }

  if (screen === "parent-review" && reviewDraft) {
    return (
      <ParentReviewScreen
        draft={reviewDraft}
        onBack={() => setScreen("parent-generate")}
        onPublish={publishReviewDraft}
        onUpdateDraft={updateReviewDraft}
        onDiscard={discardReviewDraft}
      />
    );
  }

  if (screen === "lesson") {
    return (
      <LessonScreen
        module={lessonModules[moduleIdx]}
        onHome={goHome}
        onComplete={handleComplete}
        onWrong={handleWrong}
        onItemChange={handleItemChange}
      />
    );
  }

  return (
    <HomeScreen
      modules={modules}
      completed={completed}
      history={history}
      wrongBook={wrongBook}
      loading={loading}
      generationStatus={generationStatus}
      hasReviewDraft={!!reviewDraft}
      onStartToday={startTodayPractice}
      onStartType={startTypeModule}
      onOpenParent={() => setScreen("parent-generate")}
      onOpenReviewDraft={() => reviewDraft && setScreen("parent-review")}
      onOpenHistory={openHistoryEntry}
      onDeleteHistory={removeHistoryEntry}
      onPracticeWrongOne={(entry) => openWrongEntries([entry])}
      onPracticeWrongAll={() => openWrongEntries(wrongBook)}
      onClearWrong={clearWrongItems}
    />
  );
}

async function readJsonResponse(resp: Response) {
  const text = await resp.text();
  if (!text.trim()) {
    throw new Error(`Empty response from server (${resp.status})`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from server (${resp.status})`);
  }
}
