import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquareWarning,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { LessonItem, Module } from "../data/lesson";
import { PracticeReviewDraft, PracticeReviewFeedback } from "../utils/practiceStorage";
import { QuestionRouter } from "./questions/QuestionRouter";

interface Props {
  draft: PracticeReviewDraft;
  onBack: () => void;
  onPublish: (modules: Module[]) => void;
  onUpdateDraft: (draft: PracticeReviewDraft) => void;
  onDiscard: () => void;
}

const REASONS = ["超纲", "答案不对", "选项不合适", "题干不清楚", "表达不自然", "不想要这题"];

const TYPE_LABELS: Record<string, string> = {
  listen_pick_image: "听词选图",
  match_word_image: "看词选图",
  spell_word: "单词拼写",
  read_aloud: "跟读朗读",
  listen_pick_word: "听问选择",
  listen_judge: "听音判断",
  fill_blank: "句子填空",
  word_order: "词语排序",
  translate_pick: "中英互译",
  dialogue_complete: "对话补全",
  mixed_challenge: "混合挑战",
};

const DEFAULT_PROMPTS: Record<string, string> = {
  listen_pick_image: "听一听，选出对应图片",
  match_word_image: "看单词，选出对应图片",
  spell_word: "听单词，把它拼出来",
  read_aloud: "听一听，然后大声读出来",
  listen_pick_word: "听问题，选出正确回答",
  listen_judge: "听句子，判断对不对",
  fill_blank: "选择合适的词补全句子",
  word_order: "把单词排成正确句子",
  translate_pick: "选择正确的意思",
  dialogue_complete: "选出正确回答补全对话",
  mixed_challenge: "完成这道混合练习",
};

export function ParentReviewScreen({ draft, onBack, onPublish, onUpdateDraft, onDiscard }: Props) {
  const readyModules = draft.modules.filter((module) => (module.status || "ready") === "ready" && module.items.length > 0);
  const [activeModuleId, setActiveModuleId] = useState(readyModules[0]?.module_id || "");
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [openFeedbackKey, setOpenFeedbackKey] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  const activeModule = readyModules.find((module) => module.module_id === activeModuleId) || readyModules[0];
  const activeItem = activeModule?.items[Math.min(activeItemIndex, Math.max(0, activeModule.items.length - 1))];
  const total = readyModules.reduce((sum, module) => sum + module.items.length, 0);
  const feedbackByKey = useMemo(
    () => new Map(draft.feedback.map((item) => [item.key, item])),
    [draft.feedback]
  );

  useEffect(() => {
    setActiveItemIndex(0);
    setPreviewVersion((version) => version + 1);
  }, [activeModuleId]);

  useEffect(() => {
    if (!activeModule) return;
    if (activeItemIndex >= activeModule.items.length) {
      setActiveItemIndex(Math.max(0, activeModule.items.length - 1));
    }
  }, [activeModule, activeItemIndex]);

  const selectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    setOpenFeedbackKey(null);
  };

  const goPrev = () => {
    setActiveItemIndex((index) => Math.max(0, index - 1));
    setOpenFeedbackKey(null);
    setPreviewVersion((version) => version + 1);
  };

  const goNext = () => {
    if (!activeModule) return;
    setActiveItemIndex((index) => Math.min(activeModule.items.length - 1, index + 1));
    setOpenFeedbackKey(null);
    setPreviewVersion((version) => version + 1);
  };

  const resetPreview = () => setPreviewVersion((version) => version + 1);

  const removeItem = (moduleId: string, itemId: string) => {
    const modules = draft.modules
      .map((module) =>
        module.module_id === moduleId
          ? { ...module, items: module.items.filter((item) => item.id !== itemId) }
          : module
      )
      .filter((module) => module.items.length > 0);
    onUpdateDraft({ ...draft, modules });
    setOpenFeedbackKey(null);
    setPreviewVersion((version) => version + 1);
  };

  const submitFeedback = async (module: Module, item: LessonItem, reason: string, note: string) => {
    const key = feedbackKey(module.module_id, item.id);
    const feedback: PracticeReviewFeedback = {
      key,
      moduleId: module.module_id,
      itemId: item.id,
      type: item.type,
      reason,
      note,
      createdAt: new Date().toISOString(),
    };
    const feedbackDraft = {
      ...draft,
      feedback: [feedback, ...draft.feedback.filter((entry) => entry.key !== feedback.key)],
    };
    onUpdateDraft(feedbackDraft);
    setOpenFeedbackKey(null);

    try {
      await fetch("/api/review-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_id: draft.id,
          module_id: module.module_id,
          item_id: item.id,
          type: item.type,
          reason,
          note,
          item,
        }),
      });
    } catch {
      // Local draft feedback is still retained if backend logging is unavailable.
    }

    setRegeneratingKey(key);
    try {
      const resp = await fetch("/api/practice/regenerate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_id: draft.id,
          module_id: module.module_id,
          item_id: item.id,
          type: item.type,
          reason,
          note,
          confirmed_analysis: draft.analysis || null,
          coverage_context: {
            teacherText: draft.teacherText,
            target_words: [
              (item as any).target_word,
              (item as any).word,
              (item as any).spell_word,
              (item as any).blank_answer,
            ].filter(Boolean),
            source_refs: (item as any).source_refs || [],
            coverageReport: draft.coverageReport || null,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error || !data.item) throw new Error(data.error || `Regenerate failed: ${resp.status}`);
      const modules = replaceItemInModules(feedbackDraft.modules, module.module_id, item.id, data.item);
      onUpdateDraft({
        ...feedbackDraft,
        modules,
        audit: {
          ...(feedbackDraft.audit || {}),
          overall: data.publishable === false ? "REVIEW_REQUIRED" : feedbackDraft.audit?.overall || "PASS",
          lastRegeneration: data.audit || null,
        },
        publishable: feedbackDraft.publishable !== false && data.publishable !== false,
      });
      setPreviewVersion((version) => version + 1);
    } catch (error: any) {
      onUpdateDraft({
        ...feedbackDraft,
        audit: {
          ...(feedbackDraft.audit || {}),
          lastRegeneration: {
            overall: "FAIL",
            error: error.message || "Regeneration failed",
          },
        },
      });
    } finally {
      setRegeneratingKey(null);
    }
  };

  const activeFeedbackKey = activeModule && activeItem ? feedbackKey(activeModule.module_id, activeItem.id) : "";

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
      <div className="max-w-6xl mx-auto px-4 py-6 pb-16">
        <header className="flex flex-col gap-4 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="border-[3px] border-[#213044] rounded-xl w-11 h-11 bg-white flex items-center justify-center shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform"
                title="返回"
              >
                <ArrowLeft size={19} className="text-[#213044]" />
              </button>
              <div>
                <p className="text-[11px] font-black text-[#6c7480] uppercase tracking-widest mb-1">
                  Parent review
                </p>
                <h1 className="font-black text-[#213044] text-2xl sm:text-3xl leading-tight">
                  家长像孩子一样预览
                </h1>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onDiscard}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-[2px] border-[#213044] bg-white px-5 py-3 text-sm font-black text-[#213044] shadow-[2px_2px_0_#213044] hover:-translate-y-0.5 transition-transform"
              >
                <Trash2 size={16} />
                放弃草稿
              </button>
              <button
                onClick={() => onPublish(draft.modules)}
                disabled={total === 0 || draft.publishable === false || draft.audit?.overall === "FAIL"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#213044] bg-[#dff5e3] px-6 py-3 text-sm font-black text-[#145f3e] shadow-[3px_3px_0_#213044] disabled:opacity-50 hover:-translate-y-0.5 transition-transform"
              >
                <Send size={16} />
                {draft.publishable === false || draft.audit?.overall === "FAIL" ? "需修复后发布" : "确认发布给孩子"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border-[3px] border-[#213044] bg-white px-5 py-4 shadow-[4px_4px_0_rgba(33,48,68,0.82)]">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="待预览题目" value={`${total}`} />
              <Metric label="题型模块" value={`${readyModules.length}`} />
              <Metric label="已反馈" value={`${draft.feedback.length}`} />
              <Metric label="覆盖检查" value={draft.coverageReport?.overall || "PASS"} />
            </div>
            <p className="mt-4 text-sm font-bold text-[#6c7480] leading-relaxed">
              这里展示的是孩子端真实做题组件。你可以像孩子一样点选、拼写、排序和朗读预览；这些操作只用于家长检查，不会记录到孩子成绩。
            </p>
            {(draft.publishable === false || draft.audit?.overall === "FAIL") && (
              <p className="mt-3 rounded-xl bg-[#fff1bf] px-4 py-3 text-sm font-black text-[#8a6100]">
                这套练习没有通过发布门禁，请先处理覆盖或质量问题后再发布给孩子。
              </p>
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-[290px_1fr] gap-5 items-start">
          <aside className="rounded-2xl border-[3px] border-[#213044] bg-white overflow-hidden shadow-[4px_4px_0_rgba(33,48,68,0.82)] h-fit lg:sticky lg:top-4">
            <div className="px-4 py-3 bg-[#213044] text-white font-black flex items-center gap-2">
              <Eye size={17} />
              按题型预览
            </div>
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {readyModules.map((module) => {
                const active = module.module_id === activeModule?.module_id;
                return (
                  <button
                    key={module.module_id}
                    onClick={() => selectModule(module.module_id)}
                    className={[
                      "w-full rounded-xl border-[2px] px-3 py-3 text-left transition-all",
                      active ? "border-[#213044] bg-[#dff5e3] shadow-[2px_2px_0_#213044]" : "border-[#e7dcc4] bg-white hover:bg-[#fff9ea]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-[#213044] truncate">{module.title}</span>
                      <span className="text-xs font-black text-[#6c7480]">{module.items.length}</span>
                    </div>
                    <div className="text-[11px] font-bold text-[#6c7480] mt-1 line-clamp-2">{module.goal}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main>
            {activeModule && activeItem ? (
              <QuestionPreviewPanel
                key={`${activeModule.module_id}-${activeItem.id}`}
                module={activeModule}
                item={activeItem}
                itemIndex={Math.min(activeItemIndex, activeModule.items.length - 1)}
                previewVersion={previewVersion}
                feedback={feedbackByKey.get(activeFeedbackKey)}
                regenerating={regeneratingKey === activeFeedbackKey}
                feedbackOpen={openFeedbackKey === activeFeedbackKey}
                onToggleFeedback={() => setOpenFeedbackKey(openFeedbackKey === activeFeedbackKey ? null : activeFeedbackKey)}
                onSubmitFeedback={submitFeedback}
                onRemove={() => removeItem(activeModule.module_id, activeItem.id)}
                onReset={resetPreview}
                onPrev={goPrev}
                onNext={goNext}
              />
            ) : (
              <div className="rounded-2xl border-[3px] border-[#213044] bg-white p-8 text-center font-black text-[#6c7480] shadow-[4px_4px_0_rgba(33,48,68,0.82)]">
                暂无可预览题目
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function QuestionPreviewPanel({
  module,
  item,
  itemIndex,
  previewVersion,
  feedback,
  regenerating,
  feedbackOpen,
  onToggleFeedback,
  onSubmitFeedback,
  onRemove,
  onReset,
  onPrev,
  onNext,
}: {
  module: Module;
  item: LessonItem;
  itemIndex: number;
  previewVersion: number;
  feedback?: PracticeReviewFeedback;
  regenerating: boolean;
  feedbackOpen: boolean;
  onToggleFeedback: () => void;
  onSubmitFeedback: (module: Module, item: LessonItem, reason: string, note: string) => void;
  onRemove: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [answered, setAnswered] = useState(false);
  const total = module.items.length;
  const prompt = item.prompt || DEFAULT_PROMPTS[item.type] || "完成这道题";
  const pct = Math.round(((itemIndex + (answered ? 1 : 0)) / total) * 100);

  useEffect(() => {
    setAnswered(false);
  }, [item.id, previewVersion]);

  const resetThisQuestion = () => {
    setAnswered(false);
    onReset();
  };

  return (
    <section className="rounded-2xl border-[3px] border-[#213044] bg-white overflow-hidden shadow-[5px_5px_0_rgba(33,48,68,0.82)]">
      <div className="h-2" style={{ background: module.color }} />

      <div className="px-5 py-4 border-b-[3px] border-[#213044] bg-[#ffe070]">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full bg-[#213044] px-3 py-1 text-xs font-black text-white">
                第 {itemIndex + 1} / {total} 题
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#213044] border border-[#213044]">
                {TYPE_LABELS[item.type] || item.type}
              </span>
              {feedback && (
                <span className="rounded-full bg-[#ffe5e5] px-3 py-1 text-xs font-black text-[#8a1515] border border-[#e3b2b2]">
                  已反馈：{feedback.reason}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl border-[3px] border-[#213044] flex items-center justify-center font-black text-white text-xl shadow-[2px_2px_0_rgba(33,48,68,0.7)] flex-shrink-0"
                style={{ background: module.color }}
              >
                {module.icon || itemIndex + 1}
              </div>
              <div className="min-w-0">
                <div className="font-black text-[#213044] text-lg truncate">{module.title}</div>
                <div className="h-2 border border-[#213044] rounded-full bg-white overflow-hidden mt-1 max-w-sm">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: module.color, minWidth: pct > 0 ? 8 : 0 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetThisQuestion}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-[2px] border-[#213044] bg-white px-4 py-2 text-sm font-black text-[#213044] shadow-[2px_2px_0_#213044] hover:-translate-y-0.5 transition-transform"
            >
              <RotateCcw size={16} />
              重看本题
            </button>
            <button
              onClick={onToggleFeedback}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-[2px] border-[#213044] bg-white px-4 py-2 text-sm font-black text-[#213044] shadow-[2px_2px_0_#213044] hover:-translate-y-0.5 transition-transform"
            >
              <MessageSquareWarning size={16} />
              {regenerating ? "重生成中" : "有问题"}
            </button>
            <button
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-xl border-[2px] border-[#e3b2b2] bg-[#fff5f5] px-3 py-2 text-[#8a1515] shadow-[2px_2px_0_#e3b2b2] hover:-translate-y-0.5 transition-transform"
              title="删除这道题"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="border-[3px] border-[#213044] rounded-2xl bg-white overflow-hidden shadow-[4px_4px_0_rgba(33,48,68,0.78)] mb-5">
          <div className="h-1.5" style={{ background: module.color }} />
          <div className="px-5 py-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl border-[3px] border-[#213044] flex items-center justify-center font-black text-white text-lg shadow-[2px_2px_0_rgba(33,48,68,0.7)] flex-shrink-0"
              style={{ background: module.color }}
            >
              {itemIndex + 1}
            </div>
            <span className="font-black text-[#213044] text-xl leading-tight">{prompt}</span>
          </div>
        </div>

        <div className="rounded-3xl bg-[#fffdf5] border-[2px] border-[#eadfca] px-4 py-5 sm:px-6 sm:py-6">
          <QuestionRouter
            key={`${item.id}-${previewVersion}`}
            item={item}
            onCorrect={() => setAnswered(true)}
          />
        </div>
      </div>

      <div className="px-5 py-4 border-t-[2px] border-[#e7dcc4] bg-[#fffdf5] mt-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPrev}
            disabled={itemIndex === 0}
            className="inline-flex items-center justify-center gap-1 rounded-xl border-[3px] border-[#213044] bg-white px-4 py-3 text-sm font-black text-[#213044] shadow-[3px_3px_0_#213044] disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform"
          >
            <ChevronLeft size={18} />
            上一题
          </button>
          <div className="flex-1 rounded-xl border-[2px] border-[#e7dcc4] bg-white px-4 py-3 text-center text-sm font-black text-[#6c7480]">
            预览模式：可以答题体验，但不会影响孩子端进度
          </div>
          <button
            onClick={onNext}
            disabled={itemIndex + 1 >= total}
            className="inline-flex items-center justify-center gap-1 rounded-xl border-[3px] border-[#213044] px-4 py-3 text-sm font-black text-white shadow-[3px_3px_0_#213044] disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform"
            style={{ background: module.color }}
          >
            下一题
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {feedbackOpen && (
        <div className="border-t-[2px] border-[#e7dcc4] bg-[#fff9ea] px-5 py-4">
          <div className="flex items-center gap-2 text-[#8a6100] font-black mb-3">
            <AlertTriangle size={17} />
            反馈这道题的问题
          </div>
          <div className="grid md:grid-cols-[180px_1fr_auto] gap-3">
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-xl border-[2px] border-[#e7dcc4] bg-white px-3 py-2 text-sm font-black text-[#213044]"
            >
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="补充说明，比如：这个词没学过 / 图片不对 / 正确答案应该是..."
              className="rounded-xl border-[2px] border-[#e7dcc4] bg-white px-3 py-2 text-sm font-bold text-[#213044]"
            />
            <button
              onClick={() => onSubmitFeedback(module, item, reason, note)}
              disabled={regenerating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-[2px] border-[#213044] bg-white px-4 py-2 text-sm font-black text-[#213044] shadow-[2px_2px_0_#213044]"
            >
              <Check size={16} />
              {regenerating ? "正在重生成" : "记录并重生成"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f5ef] px-4 py-3">
      <div className="text-xs font-black text-[#6c7480]">{label}</div>
      <div className="mt-1 text-2xl font-black text-[#213044]">{value}</div>
    </div>
  );
}

function feedbackKey(moduleId: string, itemId: string) {
  return `${moduleId}:${itemId}`;
}

function replaceItemInModules(modules: Module[], moduleId: string, itemId: string, replacement: LessonItem) {
  return modules.map((module) =>
    module.module_id === moduleId
      ? {
          ...module,
          items: module.items.map((item) => item.id === itemId ? { ...replacement, id: itemId } : item),
        }
      : module
  );
}
