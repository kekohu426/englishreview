import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Volume2, ChevronRight, RotateCcw } from "lucide-react";
import { LessonItem, SCENE_BG } from "../../data/lesson";
import { speak } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

type Stage = "idle" | "countdown" | "recording" | "done";

const SCENE_DECO: Record<string, string[]> = {
  school: ["📚", "✏️", "🎒", "📏"],
  fruit:  ["🍎", "🍌", "🍊", "🍐"],
  animal: ["🐱", "🐶", "🐟", "🐦"],
  color:  ["🔴", "🔵", "🟡", "🟢"],
  action: ["🏃", "⚽", "🏊", "🤸"],
};

export function ReadAloud({ item, onCorrect }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState<number | null>(null);
  const [modelPlaying, setModelPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sceneKey = item.scene_key || "school";
  const sceneBg  = SCENE_BG[sceneKey] || "#d7e8ff";
  const decos    = SCENE_DECO[sceneKey] || ["🌟"];

  const playModel = useCallback(async () => {
    if (modelPlaying) return;
    setModelPlaying(true);
    await speak(item.pronunciation_target || item.text || "", "en-US");
    setModelPlaying(false);
  }, [item, modelPlaying]);

  // 自动播放范读
  useEffect(() => {
    const timer = setTimeout(() => {
      playModel();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const startCountdown = () => {
    if (stage !== "idle") return;
    setStage("countdown");
    setCountdown(3);
    let c = 3;
    const tick = () => {
      c -= 1;
      if (c > 0) { setCountdown(c); timerRef.current = setTimeout(tick, 1000); }
      else { setStage("recording"); timerRef.current = setTimeout(stopRecording, 4500); }
    };
    timerRef.current = setTimeout(tick, 1000);
  };

  const stopRecording = () => {
    setStage("done");
    setScore(Math.floor(Math.random() * 22) + 78); // demo: 78–99
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStage("idle");
    setScore(null);
    setCountdown(3);
  };

  function renderSentence() {
    return item.text || "";
  }

  const starCount = score === null ? 0 : score >= 92 ? 3 : score >= 80 ? 2 : 1;
  const scoreColor = score === null ? "#213044" : score >= 88 ? "#1f9d67" : score >= 75 ? "#f28a3c" : "#e04b4b";
  const scoreBg    = score === null ? "#fff"     : score >= 88 ? "#dff9e9" : score >= 75 ? "#fff1bf" : "#ffe5e5";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ── Scene card - redesigned ───────────────────────────────── */}
      <div className="border-[4px] border-[#213044] rounded-2xl overflow-hidden shadow-[6px_6px_0_rgba(33,48,68,0.88)] max-w-2xl">
        {/* Scene art area */}
        <div
          className="relative flex items-center justify-center py-8 overflow-hidden"
          style={{ background: sceneBg, minHeight: 140 }}
        >
          {/* floating decos */}
          {decos.map((e, i) => (
            <span
              key={i}
              className="absolute text-5xl select-none opacity-20"
              style={{ left: `${8 + i * 20}%`, top: `${12 + (i % 2) * 35}%` }}
            >
              {e}
            </span>
          ))}
          {/* character */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full border-[4px] border-[#213044] bg-white flex items-center justify-center text-5xl shadow-[5px_5px_0_#213044]">
              {item.role_icon || "🧒"}
            </div>
          </div>
        </div>

        {/* Sentence display - separate white section */}
        <div className="bg-white border-t-[4px] border-[#213044] px-8 py-6">
          <div className="text-center">
            <span className="font-black text-[#213044] leading-relaxed inline-block" style={{ fontSize: "clamp(26px,5vw,40px)" }}>
              {renderSentence()}
            </span>
            <p className="text-[#6c7480] font-black text-base mt-3">{item.translation}</p>
          </div>
        </div>
      </div>

      {/* Replay button */}
      {stage === "idle" && (
        <div className="flex justify-center">
          <button
            onClick={playModel}
            disabled={modelPlaying}
            className={`border-[3px] border-[#213044] rounded-xl px-6 py-3 font-black text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2 ${modelPlaying ? "bg-[#e04b4b] text-white" : "bg-[#ffe070] text-[#213044]"}`}
          >
            <Volume2 size={20} />
            🔁 再听一遍
          </button>
        </div>
      )}

      {/* ── Recording interface ────────────────────────── */}
      <div className="border-[3px] border-[#213044] rounded-2xl bg-white overflow-hidden shadow-[5px_5px_0_rgba(33,48,68,0.88)]">

        <div className="px-5 py-6 flex flex-col items-center gap-4">
          {stage === "idle" && (
            <button
              onClick={startCountdown}
              className="w-40 h-40 rounded-full border-[4px] border-[#213044] bg-[#1f9d67] text-white flex items-center justify-center cursor-pointer shadow-[6px_6px_0_#213044] hover:scale-105 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
            >
              <Mic size={64} />
            </button>
          )}

          {stage === "countdown" && (
            <div
              className="w-36 h-36 rounded-full border-[4px] border-[#213044] bg-[#f28a3c] text-white flex items-center justify-center shadow-[6px_6px_0_#213044]"
              style={{ animation: "bounceIn 0.4s ease-out" }}
            >
              <span className="text-7xl font-black">{countdown}</span>
            </div>
          )}

          {stage === "recording" && (
            <>
              <div
                className="w-36 h-36 rounded-full border-[4px] border-[#213044] bg-[#e04b4b] text-white flex flex-col items-center justify-center gap-3 shadow-[6px_6px_0_#213044]"
                style={{ animation: "recordPulse 0.75s ease-in-out infinite" }}
              >
                <Mic size={56} />
                {/* wave bars */}
                <div className="flex items-end gap-1.5 h-8">
                  {[1,2,3,4,5,4,3].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-full bg-white"
                      style={{ height: h * 5, animation: `waveBar 0.74s ease-in-out ${i * 0.08}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === "done" && score !== null && (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Score circle */}
              <div
                className="w-40 h-40 rounded-full border-[4px] border-[#213044] flex flex-col items-center justify-center gap-2 shadow-[5px_5px_0_rgba(33,48,68,0.86)]"
                style={{ background: scoreBg }}
              >
                <span className="font-black text-5xl leading-none" style={{ color: scoreColor }}>{score}</span>
                <div className="flex gap-1">
                  {[1,2,3].map((s) => (
                    <span key={s} className={`text-2xl ${s <= starCount ? "text-[#f2a900]" : "text-[#e7dcc4]"}`}>★</span>
                  ))}
                </div>
              </div>

              <p className="font-black text-[#213044] text-2xl text-center">
                {score >= 92 ? "🌟 超棒！" : score >= 80 ? "😊 不错！" : "💪 加油！"}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="border-[3px] border-[#213044] rounded-xl px-5 py-2.5 bg-white font-black text-[#213044] shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform text-sm flex items-center gap-1.5"
                >
                  <RotateCcw size={15} /> 再读一次
                </button>
                <button
                  onClick={onCorrect}
                  className="border-[3px] border-[#213044] rounded-xl px-5 py-2.5 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform text-sm flex items-center gap-1.5"
                >
                  继续 <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
