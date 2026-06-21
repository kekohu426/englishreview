import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheckBig,
  Clock,
  Eraser,
  Headphones,
  Image as ImageIcon,
  Languages,
  Layers3,
  ListOrdered,
  MessageCircleQuestion,
  MessagesSquare,
  Mic,
  PenLine,
  Play,
  Plus,
  Sparkles,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { Module } from "../data/lesson";
import { PracticeHistoryEntry, WrongBookEntry } from "../utils/practiceStorage";

type HomeTab = "today" | "history" | "wrong";

interface HomeProps {
  modules: Module[];
  completed: Set<string>;
  history: PracticeHistoryEntry[];
  wrongBook: WrongBookEntry[];
  loading: boolean;
  generationStatus?: string | null;
  hasReviewDraft?: boolean;
  onStartToday: () => void;
  onStartType: (moduleIdx: number) => void;
  onOpenParent: () => void;
  onOpenReviewDraft?: () => void;
  onOpenHistory: (entry: PracticeHistoryEntry) => void;
  onDeleteHistory: (entry: PracticeHistoryEntry) => void;
  onPracticeWrongOne: (entry: WrongBookEntry) => void;
  onPracticeWrongAll: () => void;
  onClearWrong: (keys: string[]) => void;
}

function isReady(mod: Module) {
  return (mod.status || "ready") === "ready" && mod.items.length > 0;
}

const MODULE_DISPLAY: Record<string, {
  zh: string;
  en: string;
  description: string;
  icon: React.ReactNode;
}> = {
  m1: { zh: "听音选图", en: "Listen & Pick Image", description: "听到单词，选择对应图片", icon: <Headphones size={21} /> },
  m2: { zh: "看词选图", en: "Match Word & Image", description: "看英文单词，选择对应图片", icon: <ImageIcon size={21} /> },
  m3: { zh: "单词拼写", en: "Spell The Word", description: "听单词发音，拼出目标词", icon: <PenLine size={21} /> },
  m4: { zh: "跟读朗读", en: "Read Aloud", description: "朗读单词和句子", icon: <Mic size={21} /> },
  m5: { zh: "听问答选句", en: "Listen & Pick Word", description: "听问题，选择合适回答", icon: <MessageCircleQuestion size={21} /> },
  m6: { zh: "听句判断", en: "Listen & Judge", description: "判断句子或句型是否正确", icon: <CircleCheckBig size={21} /> },
  m7: { zh: "句子填空", en: "Fill In The Blank", description: "补全单词或句型", icon: <TextCursorInput size={21} /> },
  m8: { zh: "词序排序", en: "Word Order", description: "把单词排成正确句子", icon: <ListOrdered size={21} /> },
  m9: { zh: "翻译选择", en: "Translation Pick", description: "选择匹配的中英文意思", icon: <Languages size={21} /> },
  m10: { zh: "对话补全", en: "Dialogue Complete", description: "选择合适的对话回复", icon: <MessagesSquare size={21} /> },
  m11: { zh: "综合挑战", en: "Mixed Challenge", description: "综合复习词汇、句型和语法", icon: <Sparkles size={21} /> },
};

export function HomeScreen({
  modules,
  completed,
  history,
  wrongBook,
  loading,
  generationStatus,
  hasReviewDraft = false,
  onStartToday,
  onStartType,
  onOpenParent,
  onOpenReviewDraft,
  onOpenHistory,
  onDeleteHistory,
  onPracticeWrongOne,
  onPracticeWrongAll,
  onClearWrong,
}: HomeProps) {
  const [tab, setTab] = useState<HomeTab>(() => {
    try {
      const saved = localStorage.getItem("kids-english-active-tab");
      return saved === "history" || saved === "wrong" || saved === "today" ? saved : "today";
    } catch {
      return "today";
    }
  });
  const [showTypeList, setShowTypeList] = useState(false);

  const readyModules = useMemo(() => modules.filter(isReady), [modules]);
  const totalQuestions = readyModules.reduce((sum, mod) => sum + mod.items.length, 0);
  const totalMinutes = readyModules.reduce((sum, mod) => sum + (mod.estimated_minutes || 0), 0);
  const completedCount = readyModules.filter((mod) => completed.has(mod.module_id)).length;
  const completedQuestions = readyModules
    .filter((mod) => completed.has(mod.module_id))
    .reduce((sum, mod) => sum + mod.items.length, 0);
  const progress = totalQuestions ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  const switchTab = (next: HomeTab) => {
    setTab(next);
    localStorage.setItem("kids-english-active-tab", next);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px) 0 0 / 24px 24px,
          linear-gradient(180deg, rgba(255,255,255,0.45) 1px, transparent 1px) 0 0 / 24px 24px,
          #fff9ea`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-black text-[#6c7480] uppercase tracking-widest mb-2">
              English practice desk
            </p>
            <h1 className="font-black text-[#213044] text-3xl sm:text-4xl leading-tight">
              今天先做题，再拿星星
            </h1>
          </div>
          <button
            onClick={onOpenParent}
            className="border-[3px] border-[#213044] rounded-2xl px-5 py-3 bg-[#ffe070] font-black text-[#213044] shadow-[4px_4px_0_#213044] hover:-translate-y-0.5 transition-transform inline-flex items-center justify-center gap-2"
          >
            <Plus size={19} />
            生成今日练习
          </button>
        </header>

        {hasReviewDraft && (
          <button
            onClick={onOpenReviewDraft}
            className="w-full mb-5 border-[3px] border-[#213044] rounded-2xl bg-[#dff5e3] px-5 py-4 shadow-[4px_4px_0_#213044] text-left hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-[#145f3e] text-lg">有一套练习等待家长预览确认</div>
                <div className="text-sm font-bold text-[#496451] mt-1">确认发布后，孩子端今日练习才会更新。</div>
              </div>
              <ChevronRight size={22} className="text-[#213044] shrink-0" />
            </div>
          </button>
        )}

        <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
          <TabButton active={tab === "today"} label={"\u4eca\u65e5\u7ec3\u4e60"} count={totalQuestions || undefined} onClick={() => switchTab("today")} />
          <TabButton active={tab === "history"} label={"\u5386\u53f2\u7ec3\u4e60"} count={history.length || undefined} onClick={() => switchTab("history")} />
          <TabButton active={tab === "wrong"} label={"\u6211\u7684\u9519\u9898"} count={wrongBook.length || undefined} more onClick={() => switchTab("wrong")} />
        </div>

        {tab === "today" && (
          <TodayTab
            modules={modules}
            readyModules={readyModules}
            totalQuestions={totalQuestions}
            totalMinutes={totalMinutes}
            completedCount={completedCount}
            completedQuestions={completedQuestions}
            progress={progress}
            completed={completed}
            loading={loading}
            generationStatus={generationStatus}
            showTypeList={showTypeList}
            setShowTypeList={setShowTypeList}
            onOpenParent={onOpenParent}
            onStartToday={onStartToday}
            onStartType={onStartType}
          />
        )}

        {tab === "history" && (
          <HistoryTab entries={history} onOpen={onOpenHistory} onDelete={onDeleteHistory} />
        )}

        {tab === "wrong" && (
          <WrongTab
            entries={wrongBook}
            onPracticeAll={onPracticeWrongAll}
            onPracticeOne={onPracticeWrongOne}
            onClear={onClearWrong}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, label, count, more, onClick }: { active: boolean; label: string; count?: number; more?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative min-h-[92px] rounded-[18px] border bg-white px-5 py-5 text-left transition-all",
        active ? "border-[#6f93df] ring-2 ring-[#6f93df]" : "border-[#e2ded2] hover:border-[#b8c8ea]",
      ].join(" ")}
    >
      {more && <span className="absolute right-5 top-4 text-2xl leading-none text-[#3b3b3b]">...</span>}
      <span className={["block text-2xl font-black", active ? "text-[#345d9d]" : "text-[#383838]"].join(" ")}>{label}</span>
      <span className="block text-xl font-bold text-[#77736c] mt-2">{count ? `${count}` : " "}</span>
    </button>
  );
}

function TodayTab({
  modules,
  readyModules,
  totalQuestions,
  totalMinutes,
  completedCount,
  completedQuestions,
  progress,
  completed,
  loading,
  generationStatus,
  showTypeList,
  setShowTypeList,
  onOpenParent,
  onStartToday,
  onStartType,
}: {
  modules: Module[];
  readyModules: Module[];
  totalQuestions: number;
  totalMinutes: number;
  completedCount: number;
  completedQuestions: number;
  progress: number;
  completed: Set<string>;
  loading: boolean;
  generationStatus?: string | null;
  showTypeList: boolean;
  setShowTypeList: (value: boolean) => void;
  onOpenParent: () => void;
  onStartToday: () => void;
  onStartType: (moduleIdx: number) => void;
}) {
  if (readyModules.length === 0) {
    return (
      <section className="border-[3px] border-[#213044] rounded-3xl bg-white shadow-[6px_6px_0_rgba(33,48,68,0.88)] overflow-hidden">
        <div className="bg-[#213044] px-6 py-8 text-white">
          <p className="text-[#aab4c0] text-xs font-black uppercase tracking-wider mb-2">Today</p>
          <h2 className="text-3xl font-black leading-tight">今天还没有练习</h2>
          <p className="text-[#d8e0ea] text-sm font-bold mt-2">
            先让家长粘贴老师作业，确认拆解后再生成。
          </p>
        </div>
        <div className="px-6 py-7 text-center">
          <div className="w-16 h-16 mx-auto border-[3px] border-[#213044] rounded-2xl bg-[#fff1bf] flex items-center justify-center shadow-[4px_4px_0_#213044] mb-4">
            <BookOpen size={30} className="text-[#213044]" />
          </div>
          <button
            onClick={onOpenParent}
            className="border-[4px] border-[#213044] rounded-2xl px-8 py-4 bg-[#1f9d67] text-white font-black text-lg shadow-[5px_5px_0_#213044] hover:-translate-y-0.5 transition-transform inline-flex items-center gap-2"
          >
            生成今日练习
            <ChevronRight size={22} />
          </button>
          {loading && (
            <p className="mt-4 text-sm font-black text-[#213044]">{generationStatus || "正在生成练习..."}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="border-[3px] border-[#213044] rounded-3xl bg-white shadow-[6px_6px_0_rgba(33,48,68,0.88)] overflow-hidden">
        <div className="bg-[#213044] px-6 py-7 text-white">
          <p className="text-[#aab4c0] text-xs font-black uppercase tracking-wider mb-2">Today</p>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight">今日练习已准备好</h2>
          <p className="text-[#d8e0ea] text-sm font-bold mt-2">
            共 {totalQuestions} 道题，按生成顺序一题题完成。
          </p>
        </div>

        <div className="px-6 py-6">
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <Metric icon={<Layers3 size={18} />} value={`${readyModules.length}`} label="题型模块" />
            <Metric icon={<BookOpen size={18} />} value={`${totalQuestions}`} label="题目数量" />
            <Metric icon={<Clock size={18} />} value={`${Math.max(5, totalMinutes)}`} label="预计分钟" />
          </div>

          <div className="mb-5">
            <div className="flex justify-between items-center mb-2 gap-3">
              <span className="text-xs font-black text-[#6c7480]">孩子完成进度</span>
              <span className="text-xs font-black text-[#213044] text-right">{completedQuestions}/{totalQuestions} 题 · {completedCount}/{readyModules.length} 模块</span>
            </div>
            <div className="h-5 border-[2px] border-[#213044] rounded-full bg-[#f0f0f0] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: "#1f9d67",
                  minWidth: progress > 0 ? 10 : 0,
                }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStartToday}
              className="flex-1 border-[4px] border-[#213044] rounded-2xl px-8 py-5 font-black text-white shadow-[5px_5px_0_#213044] hover:-translate-y-0.5 transition-transform inline-flex items-center justify-center gap-3 text-lg"
              style={{ background: progress > 0 ? "#f28a3c" : "#1f9d67" }}
            >
              {progress > 0 ? "继续今日练习" : "开始今日练习"}
              <Play size={22} />
            </button>
            <button
              onClick={() => setShowTypeList(!showTypeList)}
              className="border-[3px] border-[#213044] rounded-2xl px-5 py-4 bg-[#fff1bf] text-[#213044] font-black shadow-[4px_4px_0_#213044] hover:-translate-y-0.5 transition-transform inline-flex items-center justify-center gap-2"
            >
              按题型练习
              <ChevronDown size={18} />
            </button>
          </div>

          {loading && (
            <p className="mt-4 text-sm font-black text-[#213044]">{generationStatus || "还有题目正在生成..."}</p>
          )}
        </div>
      </div>

      {showTypeList && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {modules.map((mod, idx) => (
            <ModuleCard key={mod.module_id} mod={mod} idx={idx} completed={completed.has(mod.module_id)} onStart={onStartType} />
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="border-[2px] border-[#213044] rounded-2xl bg-[#fff9ea] px-4 py-3 shadow-[3px_3px_0_rgba(33,48,68,0.45)]">
      <div className="flex items-center gap-2 text-[#213044]">
        {icon}
        <span className="text-xl font-black">{value}</span>
      </div>
      <div className="text-xs font-black text-[#6c7480] mt-1">{label}</div>
    </div>
  );
}

function ModuleCard({ mod, idx, completed, onStart }: { mod: Module; idx: number; completed: boolean; onStart: (moduleIdx: number) => void }) {
  const ready = isReady(mod);
  const display = MODULE_DISPLAY[mod.module_id] || {
    zh: mod.title || "\u9898\u578b\u7ec3\u4e60",
    en: mod.title || "Practice Module",
    description: mod.goal || "\u5b8c\u6210\u8fd9\u4e00\u7ec4\u7ec3\u4e60",
    icon: <BookOpen size={21} />,
  };
  const status = completed
    ? { label: "\u5df2\u5b8c\u6210", className: "bg-[#dff5e3] text-[#145f3e]", icon: <CheckCircle2 size={14} /> }
    : ready
    ? { label: "\u5f85\u7ec3\u4e60", className: "bg-[#f0f0f0] text-[#213044]", icon: <Circle size={13} /> }
    : { label: "\u751f\u6210\u4e2d", className: "bg-[#fff1bf] text-[#213044]", icon: <Clock size={13} /> };

  return (
    <button
      onClick={() => ready && onStart(idx)}
      disabled={!ready}
      className={[
        "min-h-[255px] rounded-[18px] border border-[#e6e2d8] text-left transition-all overflow-hidden bg-white",
        ready ? "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(33,48,68,0.08)]" : "opacity-65 cursor-not-allowed",
      ].join(" ")}
    >
      <div className="h-2.5 w-full" style={{ background: ready ? mod.color : "#d0d0d0" }} />
      <div className="p-8 h-full flex flex-col">
        <div className="flex items-start justify-between gap-5 mb-9">
          <div className="w-[58px] h-[58px] shrink-0 rounded-full bg-[#faf9f3] flex items-center justify-center text-[#3d3d3a]">
            {display.icon}
          </div>
          <span className={["inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-base font-bold", status.className].join(" ")}>
            {status.icon}
            {status.label}
          </span>
        </div>
        <h3 className="font-black text-[#111111] text-[27px] leading-tight mb-1">{display.zh}</h3>
        <p className="text-[#77736c] text-[22px] leading-tight mb-4">{display.en}</p>
        <p className="text-[#4f4d49] text-[18px] leading-relaxed mb-8 min-h-[52px]">{display.description}</p>
        <div className="mt-auto flex items-center justify-between text-[18px] font-bold text-[#77736c]">
          <span>{ready ? `${mod.items.length} \u9898` : "\u7b49\u5f85\u89e3\u9501"}</span>
          {ready && <ChevronRight size={30} className="text-[#77736c]" />}
        </div>
      </div>
    </button>
  );
}

function HistoryTab({
  entries,
  onOpen,
  onDelete,
}: {
  entries: PracticeHistoryEntry[];
  onOpen: (entry: PracticeHistoryEntry) => void;
  onDelete: (entry: PracticeHistoryEntry) => void;
}) {
  if (entries.length === 0) {
    return <EmptyPanel icon={<CalendarDays size={30} />} title="还没有历史练习" text="生成过的练习会自动保存在这里。" />;
  }

  return (
    <section className="space-y-3">
      {entries.map((entry) => {
        const ready = entry.modules.filter(isReady);
        const total = ready.reduce((sum, mod) => sum + mod.items.length, 0);
        const pct = ready.length ? Math.round((entry.completedModuleIds.length / ready.length) * 100) : 0;
        return (
          <div key={entry.id} className="border-[3px] border-[#213044] rounded-2xl bg-white p-4 shadow-[4px_4px_0_rgba(33,48,68,0.8)]">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-black text-[#213044] text-lg truncate">{historyTitle(entry)}</span>
                  <span className="text-[11px] font-black border border-[#213044] rounded-full px-2 py-0.5 bg-[#fff1bf] text-[#213044]">
                    {entry.source === "llm" ? "真实生成" : "演示生成"}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#6c7480] flex flex-wrap gap-x-4 gap-y-1">
                  <span>{formatDate(entry.createdAt)}</span>
                  <span>{total} 题</span>
                  <span>完成度 {pct}%</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpen(entry)}
                  className="border-[3px] border-[#213044] rounded-xl px-4 py-2 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044] inline-flex items-center gap-1.5"
                >
                  继续练习
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => onDelete(entry)}
                  className="border-[3px] border-[#213044] rounded-xl px-4 py-2 bg-white text-[#e04b4b] font-black shadow-[3px_3px_0_#213044] inline-flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  删除
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function WrongTab({
  entries,
  onPracticeAll,
  onPracticeOne,
  onClear,
}: {
  entries: WrongBookEntry[];
  onPracticeAll: () => void;
  onPracticeOne: (entry: WrongBookEntry) => void;
  onClear: (keys: string[]) => void;
}) {
  const analysis = useMemo(() => analyzeWrongBook(entries), [entries]);

  if (entries.length === 0) {
    return <EmptyPanel icon={<AlertTriangle size={30} />} title="暂时没有错题" text="答题时做错的题会自动进入这里。" />;
  }

  return (
    <section className="space-y-4">
      <div className="border-[3px] border-[#213044] rounded-3xl bg-white p-5 shadow-[5px_5px_0_rgba(33,48,68,0.88)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#6c7480] uppercase tracking-wider mb-1">Wrong book</p>
            <h2 className="font-black text-[#213044] text-2xl">共有 {entries.length} 道错题</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onPracticeAll}
              className="border-[3px] border-[#213044] rounded-xl px-5 py-3 bg-[#f28a3c] text-white font-black shadow-[3px_3px_0_#213044] inline-flex items-center gap-2"
            >
              <Play size={17} />
              开始错题练习
            </button>
            <button
              onClick={() => onClear(entries.map((entry) => entry.key))}
              className="border-[3px] border-[#213044] rounded-xl px-4 py-3 bg-white text-[#e04b4b] font-black shadow-[3px_3px_0_#213044] inline-flex items-center gap-2"
            >
              <Eraser size={17} />
              清空
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <AnalysisBox title="词汇" values={analysis.words} />
          <AnalysisBox title="句型" values={analysis.patterns} />
          <AnalysisBox title="语法" values={analysis.grammar} />
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.key} className="border-[3px] border-[#213044] rounded-2xl bg-white p-4 shadow-[4px_4px_0_rgba(33,48,68,0.75)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-12 h-12 border-[2px] border-[#213044] rounded-xl bg-[#fff1bf] flex items-center justify-center text-2xl shadow-[2px_2px_0_#213044]">
                {entry.moduleIcon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-[#213044] truncate">{entry.item.prompt || entry.moduleTitle}</div>
                <div className="text-xs font-bold text-[#6c7480] mt-1">
                  错 {entry.wrongCount} 次 · 复练 {entry.reviewCount} 次 · {entry.type}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onPracticeOne(entry)}
                  className="border-[3px] border-[#213044] rounded-xl px-4 py-2 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044]"
                >
                  练这一题
                </button>
                <button
                  onClick={() => onClear([entry.key])}
                  className="border-[3px] border-[#213044] rounded-xl px-3 py-2 bg-white text-[#e04b4b] font-black shadow-[3px_3px_0_#213044]"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyPanel({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="border-[3px] border-[#213044] rounded-3xl bg-white shadow-[6px_6px_0_rgba(33,48,68,0.88)] px-6 py-10 text-center">
      <div className="w-16 h-16 mx-auto border-[3px] border-[#213044] rounded-2xl bg-[#fff1bf] flex items-center justify-center shadow-[4px_4px_0_#213044] mb-4 text-[#213044]">
        {icon}
      </div>
      <h2 className="font-black text-[#213044] text-2xl">{title}</h2>
      <p className="text-sm font-bold text-[#6c7480] mt-2">{text}</p>
    </section>
  );
}

function AnalysisBox({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-2xl border-[2px] border-[#213044] bg-[#fff9ea] p-3">
      <div className="font-black text-[#213044] text-sm mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.length ? (
          values.slice(0, 8).map((value) => (
            <span key={value} className="text-[11px] font-black rounded-full border border-[#213044] bg-white px-2 py-0.5 text-[#213044]">
              {value}
            </span>
          ))
        ) : (
          <span className="text-xs font-bold text-[#6c7480]">暂无明显集中点</span>
        )}
      </div>
    </div>
  );
}

function historyTitle(entry: PracticeHistoryEntry) {
  const firstLine = entry.teacherText.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine) return firstLine.slice(0, 24);
  return `练习 ${formatDate(entry.createdAt)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function analyzeWrongBook(entries: WrongBookEntry[]) {
  const words = new Set<string>();
  const patterns = new Set<string>();
  const grammar = new Set<string>();

  entries.forEach((entry) => {
    const item: any = entry.item;
    [
      item.target_word,
      item.word,
      item.spell_word,
      item.audio_text,
      item.text,
      item.sentence,
      item.blank_answer,
      item.source_text,
    ].forEach((value) => collectWords(value, words));

    const text = [
      item.audio_text,
      item.text,
      item.sentence,
      item.source_text,
      item.prompt,
      ...(Array.isArray(item.dialogue) ? item.dialogue.map((line: any) => line.text) : []),
    ].filter(Boolean).join(" ");

    if (/how much/i.test(text)) patterns.add("How much");
    if (/how many/i.test(text)) patterns.add("How many");
    if (/can you/i.test(text)) patterns.add("Can you...");
    if (/do you/i.test(text)) patterns.add("Do you...");
    if (/is this/i.test(text)) patterns.add("Is this...");
    if (/i see/i.test(text)) patterns.add("I see...");
    if (/i have/i.test(text)) patterns.add("I have...");

    if (/countable|uncountable|可数|不可数/i.test(text)) grammar.add("可数 / 不可数");
    if (entry.type === "spell_word") grammar.add("单词拼写");
    if (entry.type === "word_order") grammar.add("词序");
    if (entry.type === "fill_blank") grammar.add("句子填空");
    if (entry.type === "dialogue_complete") grammar.add("对话补全");
  });

  return {
    words: [...words].slice(0, 12),
    patterns: [...patterns],
    grammar: [...grammar],
  };
}

function collectWords(value: unknown, target: Set<string>) {
  if (typeof value !== "string") return;
  const matches = value.match(/\b[a-zA-Z]{2,}\b/g) || [];
  matches.forEach((word) => {
    const lower = word.toLowerCase();
    if (!["the", "and", "you", "this", "that", "yes", "no", "what", "with"].includes(lower)) {
      target.add(lower);
    }
  });
}
