import { useState, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { playSuccess, playWrong, speak } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function FillBlank({ item, onCorrect }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playedOnce, setPlayedOnce] = useState(false);
  const parts = item.sentence_parts || ["", ""];

  const pick = (word: string) => {
    if (checked) return;
    const isCorrect = word === item.blank_answer;
    setChosen(word);
    setChecked(true);
    setCorrect(isCorrect);
    if (isCorrect) {
      playSuccess();
      setTimeout(onCorrect, 1000);
    } else {
      playWrong();
    }
  };

  const playSentence = async () => {
    if (playing) return;
    setPlaying(true);
    setPlayedOnce(true);
    // 播放完整句子（空格处填入正确答案）
    const fullSentence = `${parts[0] || ""}${item.blank_answer || ""}${parts[1] || ""}`.replace(/\s+/g, " ").trim();
    await speak(fullSentence, "en-US");
    setPlaying(false);
  };

  // 自动播放完整句子
  useEffect(() => {
    const timer = setTimeout(() => {
      playSentence();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const reset = () => {
    setChosen(null);
    setChecked(false);
    setCorrect(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 再听一遍按钮 */}
      {playedOnce && !playing && !checked && (
        <div className="flex justify-center">
          <button
            onClick={playSentence}
            className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2"
          >
            <Volume2 size={20} />
            🔁 再听一遍
          </button>
        </div>
      )}

      {/* Sentence card - larger and more prominent */}
      <div className="border-[4px] border-[#213044] rounded-2xl bg-white px-8 py-10 max-w-2xl shadow-[6px_6px_0_rgba(33,48,68,0.88)]">
        <div className="flex items-baseline flex-wrap gap-x-4 gap-y-3 justify-center">
          {parts[0] && (
            <span className="font-black text-[#213044]" style={{ fontSize: "clamp(28px,5vw,48px)" }}>
              {parts[0]}
            </span>
          )}

          {/* Blank slot - bigger and more visible */}
          <span
            className={[
              "inline-flex items-center justify-center min-w-48 border-[4px] px-6 py-3 rounded-2xl font-black transition-all",
              !chosen      ? "border-dashed border-[#3167d8] bg-[#f0f7ff] text-transparent shadow-[inset_0_3px_12px_rgba(49,103,216,0.12)]" : "",
              chosen && correct  ? "border-[#1f9d67] bg-[#dff9e9] text-[#1f9d67] shadow-[4px_4px_0_rgba(31,157,103,0.4)]" : "",
              chosen && !correct ? "border-[#e04b4b] bg-[#ffe5e5] text-[#e04b4b] shadow-[4px_4px_0_rgba(224,75,75,0.4)]" : "",
            ].join(" ")}
            style={{ fontSize: "clamp(28px,5vw,48px)" }}
          >
            {chosen ? chosen : (
              <span className="flex gap-2">
                {[1,2,3,4,5].map((i) => (
                  <span key={i} className="w-3 h-3 rounded-full bg-[#3167d8] opacity-30 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
          </span>

          {parts[1] && (
            <span className="font-black text-[#213044]" style={{ fontSize: "clamp(28px,5vw,48px)" }}>
              {parts[1]}
            </span>
          )}
        </div>
      </div>

      {/* Word options - simplified grid */}
      <div className="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          {item.options?.map((opt, idx) => {
            const isChosen = chosen === opt.text;
            const isCorrect = opt.is_correct;
            return (
              <button
                key={idx}
                onClick={() => pick(opt.text)}
                disabled={checked}
                className={[
                  "border-[4px] rounded-2xl px-8 py-6 font-black text-3xl transition-all",
                  "shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:-translate-y-2 hover:shadow-[4px_8px_0_rgba(33,48,68,0.88)]",
                  "active:translate-y-0.5 active:shadow-[2px_2px_0_rgba(33,48,68,0.88)]",
                  isChosen && isCorrect  ? "bg-[#dff9e9] border-[#1f9d67] text-[#1f9d67] animate-correct" : "",
                  isChosen && !isCorrect ? "bg-[#ffe5e5] border-[#e04b4b] text-[#e04b4b] animate-wrong"   : "",
                  !isChosen ? "bg-white border-[#213044] text-[#213044] disabled:opacity-30" : "",
                ].join(" ")}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      {checked && !correct && (
        <div className="flex flex-col items-center gap-4 border-[3px] rounded-2xl px-6 py-5 max-w-2xl animate-rise border-[#e04b4b] bg-[#fff0f0]">
          <span className="text-5xl">❌</span>
          <div className="flex items-center gap-2">
            <span className="text-[#6c7480] font-black text-lg">正确答案：</span>
            <span className="border-[3px] border-[#1f9d67] rounded-xl px-5 py-2 font-black text-[#1f9d67] text-2xl bg-white shadow-[2px_2px_0_rgba(31,157,103,0.3)]">
              {item.blank_answer}
            </span>
          </div>
          <button onClick={reset} className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-white font-black text-[#213044] text-base shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform">
            ↺ 再试一次
          </button>
        </div>
      )}
    </div>
  );
}
