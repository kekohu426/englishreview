import { useState, useCallback, useEffect } from "react";
import { Check, Volume2, X } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { speak, playSuccess, playWrong } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function ListenJudge({ item, onCorrect }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const playAudio = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    await speak(item.audio_text || "", "en-US");
    setPlaying(false);
  }, [item.audio_text, playing]);

  // 自动播放音频
  useEffect(() => {
    const timer = setTimeout(() => {
      playAudio();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const pick = (idx: number) => {
    if (locked) return;
    setSelected(idx);
    setLocked(true);
    if (item.options![idx].is_correct) {
      playSuccess();
      setTimeout(onCorrect, 1000);
    } else {
      playWrong();
      setTimeout(() => { setSelected(null); setLocked(false); }, 1200);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sentence display card */}
      <div className="border-[3px] border-[#213044] rounded-2xl bg-[#fff7d6] px-6 py-6 max-w-2xl shadow-[6px_6px_0_rgba(33,48,68,0.88)]">
        <p className="font-black text-[#213044] leading-snug text-center" style={{ fontSize: "clamp(26px,5vw,40px)" }}>
          "{item.audio_text}"
        </p>
      </div>

      {/* 再听一遍按钮 */}
      {playCount > 0 && !playing && !locked && (
        <div className="flex justify-center max-w-2xl">
          <button
            onClick={playAudio}
            className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2"
          >
            <Volume2 size={20} />
            🔁 再听一遍
          </button>
        </div>
      )}

      {/* True / False — big dramatic buttons */}
      <div className="flex gap-5 max-w-2xl">
        {item.options?.map((opt, idx) => {
          const text = String(opt.text || "");
          const isTrue = !/not|wrong|false|不|错|錯|叉|x/i.test(text);
          const isCorrect = opt.is_correct;
          const isSelected = selected === idx;
          return (
            <button
              key={idx}
              onClick={() => pick(idx)}
              disabled={locked && !isSelected}
              className={[
                "flex-1 border-[4px] rounded-2xl py-12 flex flex-col items-center justify-center gap-4 cursor-pointer font-black transition-all",
                "shadow-[6px_6px_0_rgba(33,48,68,0.88)] hover:-translate-y-2 hover:shadow-[6px_10px_0_rgba(33,48,68,0.88)]",
                "active:translate-y-0.5 active:shadow-[2px_2px_0_rgba(33,48,68,0.88)]",
                isSelected && isCorrect  ? (isTrue ? "animate-correct border-[#1f9d67] bg-[#dff9e9]" : "animate-correct border-[#1f9d67] bg-[#dff9e9]") : "",
                isSelected && !isCorrect ? "animate-wrong border-[#e04b4b] bg-[#ffe5e5]" : "",
                !isSelected && isTrue    ? "border-[#213044] bg-[#e7fff1] hover:bg-[#d0ffe8]" : "",
                !isSelected && !isTrue   ? "border-[#213044] bg-[#fff0f0] hover:bg-[#ffe0e0]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "w-24 h-24 rounded-3xl border-[4px] flex items-center justify-center shadow-[4px_4px_0_rgba(33,48,68,0.28)]",
                  isTrue
                    ? "border-[#1f9d67] bg-[#dff9e9] text-[#1f9d67]"
                    : "border-[#e04b4b] bg-[#ffe5e5] text-[#e04b4b]",
                ].join(" ")}
              >
                {isTrue ? <Check size={58} strokeWidth={4.5} /> : <X size={58} strokeWidth={4.5} />}
              </span>
              <span className="text-3xl text-[#213044]">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {locked && selected !== null && (
        <div className={`flex items-start gap-3 border-[3px] rounded-2xl px-5 py-4 max-w-2xl animate-rise ${item.options![selected].is_correct ? "border-[#1f9d67] bg-[#e7fff1]" : "border-[#e04b4b] bg-[#fff0f0]"}`}>
          <span className="text-2xl mt-0.5">{item.options![selected].is_correct ? "🌟" : "💡"}</span>
          <div>
            <strong className="text-[#213044] text-lg">{item.options![selected].is_correct ? "判断正确！" : "再想想！"}</strong>
            <p className="text-[#6c7480] text-sm mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
