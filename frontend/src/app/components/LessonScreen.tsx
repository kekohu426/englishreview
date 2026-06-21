import { useEffect, useState, useRef } from "react";
import { Module } from "../data/lesson";
import { QuestionRouter } from "./questions/QuestionRouter";
import { Home, ChevronLeft, ChevronRight, Trophy } from "lucide-react";

const DEFAULT_PROMPTS: Record<string, string> = {
  listen_pick_image:  "听一听，选出对应图片",
  listen_pick_word:   "听问题，选回答",
  listen_judge:       "听一听，判断对错",
  mixed_challenge:    "完成这道题",
  read_aloud:         "听范读，然后跟读",
  word_order:         "听句子，排单词",
  fill_blank:         "听句子，选单词",
  match_word_image:   "看单词，选图片",
  spell_word:         "听单词，拼写出来",
  translate_pick:     "选出正确翻译",
  dialogue_complete:  "选出对话回答",
};

interface Props {
  module?: Module;
  onHome: () => void;
  onComplete: (moduleId: string) => void;
  onWrong?: () => void;
  onItemChange?: (itemIdx: number) => void;
}

export function LessonScreen({ module: mod, onHome, onComplete, onWrong, onItemChange }: Props) {
  if (!mod || !mod.items || mod.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <p className="font-black text-[#6c7480]">加载中，请稍候...</p>
        </div>
      </div>
    );
  }

  const [itemIdx, setItemIdx] = useState(0);
  const [answeredSet, setAnsweredSet] = useState<Set<number>>(new Set());
  const [showComplete, setShowComplete] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItemIdx(0);
    setAnsweredSet(new Set());
    setShowComplete(false);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [mod.module_id]);

  useEffect(() => {
    onItemChange?.(itemIdx);
  }, [itemIdx, onItemChange]);

  useEffect(() => {
    const handler = () => onWrong?.();
    window.addEventListener("kids-english-wrong-answer", handler);
    return () => window.removeEventListener("kids-english-wrong-answer", handler);
  }, [onWrong]);

  const item = mod.items[itemIdx];
  const total = mod.items.length;
  const answered = answeredSet.has(itemIdx);
  const pct = Math.round(((itemIdx + (answered ? 1 : 0)) / total) * 100);

  const scrollTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const handleCorrect = () => {
    setAnsweredSet((s) => new Set([...s, itemIdx]));
    if (itemIdx + 1 >= total) {
      setTimeout(() => setShowComplete(true), 1500);
    } else {
      // 自动跳转到下一题
      setTimeout(() => {
        setItemIdx((i) => i + 1);
        scrollTop();
      }, 1500);
    }
  };

  const next = () => { if (itemIdx + 1 < total) { setItemIdx((i) => i + 1); scrollTop(); } };
  const prev = () => { if (itemIdx > 0) { setItemIdx((i) => i - 1); scrollTop(); } };

  // ── Completion screen ───────────────────────────────────────────
  if (showComplete) {
    const starsPct = Math.round((answeredSet.size / total) * 100);
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-8"
        style={{
          background: `
            linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px) 0 0 / 24px 24px,
            linear-gradient(180deg, rgba(255,255,255,0.4) 1px, transparent 1px) 0 0 / 24px 24px,
            #fff9ea`,
        }}
      >
        <div className="border-[3px] border-[#213044] rounded-3xl bg-white max-w-md w-full shadow-[8px_8px_0_rgba(33,48,68,0.88)] overflow-hidden">
          {/* Top color band */}
          <div className="h-3" style={{ background: mod.color }} />

          <div className="px-8 py-8 flex flex-col items-center gap-5 text-center">
            {/* Trophy */}
            <div
              className="w-28 h-28 rounded-full border-[4px] border-[#213044] flex items-center justify-center text-6xl shadow-[5px_5px_0_#213044]"
              style={{ background: "#ffe070", animation: "bounceIn 0.6s cubic-bezier(0.175,0.885,0.32,1.275)" }}
            >
              🏆
            </div>

            {/* Stars */}
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className="text-4xl"
                  style={{ animation: `starSpin 0.8s ease-out ${s * 0.15}s both` }}
                >
                  ⭐
                </span>
              ))}
            </div>

            <div>
              <p className="text-[#6c7480] text-xs font-black uppercase tracking-widest mb-1">模块完成</p>
              <h2 className="font-black text-[#213044] text-2xl leading-tight">{mod.title}</h2>
            </div>

            {/* Score bar */}
            <div className="w-full border-[3px] border-[#213044] rounded-2xl bg-[#f8f9fa] p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-[#6c7480]">完成度</span>
                <span className="font-black text-[#213044]">{starsPct}%</span>
              </div>
              <div className="h-4 border-[2px] border-[#213044] rounded-full bg-white overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${starsPct}%`, background: "linear-gradient(90deg,#1f9d67,#ffd45a,#f28a3c)" }}
                />
              </div>
              <p className="text-[#6c7480] text-xs mt-2 leading-relaxed">
                「{mod.goal}」已达成！共完成 {total} 题。
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                onClick={onHome}
                className="flex-1 border-[3px] border-[#213044] rounded-xl py-3 bg-white font-black text-[#213044] shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform text-sm flex items-center justify-center gap-2"
              >
                <Home size={16} /> 首页
              </button>
              <button
                onClick={() => onComplete(mod.module_id)}
                className="flex-1 border-[3px] border-[#213044] rounded-xl py-3 text-white font-black shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform text-sm flex items-center justify-center gap-1.5"
                style={{ background: mod.color }}
              >
                下一模块 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screen ─────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: `
          linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px) 0 0 / 24px 24px,
          linear-gradient(180deg, rgba(255,255,255,0.35) 1px, transparent 1px) 0 0 / 24px 24px,
          #fff9ea`,
      }}
    >
      {/* ── Top bar ──────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-[#213044] flex-shrink-0"
        style={{ background: "#ffe070" }}
      >
        <button
          onClick={onHome}
          className="border-[3px] border-[#213044] rounded-xl w-10 h-10 flex items-center justify-center bg-white shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform flex-shrink-0"
        >
          <Home size={18} className="text-[#213044]" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-black text-[#213044] text-sm truncate flex items-center gap-2">
            <span>{mod.icon}</span>
            <span className="hidden xs:inline">{mod.title}</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 border border-[#213044] rounded-full bg-white overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-all duration-400"
              style={{ width: `${pct}%`, background: mod.color, minWidth: pct > 0 ? 6 : 0 }}
            />
          </div>
        </div>

        <div className="border-[2px] border-[#213044] rounded-lg px-3 py-1.5 bg-white font-black text-[#213044] text-sm shadow-[2px_2px_0_#213044] flex-shrink-0">
          {itemIdx + 1}<span className="text-[#6c7480] font-normal">/{total}</span>
        </div>
      </div>

      {/* ── Question card header ──────────────────────── */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-5 flex-shrink-0">
        <div className="border-[3px] border-[#213044] rounded-2xl bg-white overflow-hidden shadow-[4px_4px_0_rgba(33,48,68,0.88)]">
          {/* Accent band */}
          <div className="h-1.5" style={{ background: mod.color }} />
          <div className="px-6 py-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl border-[3px] border-[#213044] flex items-center justify-center font-black text-white text-lg shadow-[2px_2px_0_rgba(33,48,68,0.7)] flex-shrink-0"
              style={{ background: mod.color }}
            >
              {itemIdx + 1}
            </div>
            <span className="font-black text-[#213044] text-xl leading-tight">
              {item?.prompt || (item ? DEFAULT_PROMPTS[item.type] || "完成这道题" : "完成这道题")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────── */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-4 pt-5 pb-32">
        {item && (
          <QuestionRouter
            key={`${mod.module_id}-${itemIdx}`}
            item={item}
            onCorrect={handleCorrect}
          />
        )}
      </div>

      {/* ── Bottom nav ───────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t-[3px] border-[#213044] bg-[#fffdf5] shadow-[0_-6px_18px_rgba(33,48,68,0.12)]">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-4 flex gap-3">
          <button
            onClick={prev}
            disabled={itemIdx === 0}
            className="border-[3px] border-[#213044] rounded-xl px-4 py-3 bg-white font-black text-[#213044] shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
          >
            <ChevronLeft size={18} /> 上一题
          </button>

          {answered && itemIdx + 1 < total ? (
            <button
              onClick={next}
              className="flex-1 border-[3px] border-[#213044] rounded-xl py-3 text-white font-black shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-1.5 text-sm"
              style={{ background: mod.color }}
            >
              下一题 <ChevronRight size={18} />
            </button>
          ) : answered && itemIdx + 1 >= total ? (
            <button
              onClick={() => setShowComplete(true)}
              className="flex-1 border-[3px] border-[#213044] rounded-xl py-3 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 text-sm"
            >
              <Trophy size={18} /> 完成模块
            </button>
          ) : (
            <div className="flex-1 border-[3px] border-[#213044] rounded-xl py-3 bg-[#f0f0f0] flex items-center justify-center gap-2 text-sm font-black text-[#6c7480] cursor-not-allowed">
              答题后解锁下一题
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
