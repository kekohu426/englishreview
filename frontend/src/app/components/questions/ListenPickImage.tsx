import { useState, useCallback, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem, VOCAB_MAP } from "../../data/lesson";
import { speak, playSuccess, playWrong } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function ListenPickImage({ item, onCorrect }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const playAudio = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    // 只播放目标单词，不朗读选项（考察听力理解+图片认知）
    await speak(item.audio_text || "", "en-US");
    setPlaying(false);
  }, [item, playing]);

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
      {/* 再听一遍按钮 */}
      {playCount > 0 && !playing && !locked && (
        <div className="flex justify-center">
          <button
            onClick={playAudio}
            className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2"
          >
            <Volume2 size={20} />
            🔁 再听一遍
          </button>
        </div>
      )}

      {/* Image option cards */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {item.options?.map((opt, idx) => {
          const imageKey = opt.image_key || opt.label || opt.text || "";
          const vocab = VOCAB_MAP[imageKey];
          const visual = vocab?.image || "";
          const isTextFallback = !visual || visual.toLowerCase() === String(imageKey).toLowerCase();
          const isCorrect = opt.is_correct;
          const isSelected = selected === idx;
          return (
            <button
              key={idx}
              onClick={() => pick(idx)}
              disabled={locked && !isSelected}
              className={[
                "border-[3px] rounded-2xl flex flex-col items-center justify-center gap-3 py-6 px-3 relative",
                "cursor-pointer transition-all shadow-[4px_4px_0_rgba(33,48,68,0.88)]",
                "hover:-translate-y-1.5 hover:shadow-[4px_7px_0_rgba(33,48,68,0.88)]",
                "active:translate-y-0.5 active:shadow-[2px_2px_0_rgba(33,48,68,0.88)]",
                isSelected && isCorrect  ? "bg-[#dff9e9] border-[#1f9d67] animate-correct" : "",
                isSelected && !isCorrect ? "bg-[#ffe5e5] border-[#e04b4b] animate-wrong"   : "",
                !isSelected              ? "bg-white border-[#213044]"                      : "",
              ].join(" ")}
            >
              {/* Image only - no text labels to test listening comprehension */}
              <div className={[
                "rounded-xl border-[3px] border-[#213044] bg-[#fff7d6] flex items-center justify-center shadow-[3px_3px_0_rgba(33,48,68,0.5)]",
                isTextFallback ? "w-full min-h-24 px-4" : "w-20 h-20 overflow-hidden",
              ].join(" ")}>
                {isTextFallback ? (
                  <span className="w-full text-center font-black text-[#213044] leading-none break-words" style={{ fontSize: "clamp(28px,6vw,44px)" }}>
                    {String(imageKey)}
                  </span>
                ) : (
                  <span className="text-5xl leading-none">{visual}</span>
                )}
              </div>
              {/* Check mark on correct */}
              {isSelected && isCorrect && (
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#1f9d67] border-2 border-[#213044] flex items-center justify-center text-white text-sm">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {locked && selected !== null && (
        <div
          className={`flex items-start gap-3 border-[3px] rounded-2xl px-5 py-4 max-w-2xl animate-rise ${item.options![selected].is_correct ? "border-[#1f9d67] bg-[#e7fff1]" : "border-[#e04b4b] bg-[#fff0f0]"}`}
        >
          <span className="text-2xl mt-0.5">{item.options![selected].is_correct ? "🌟" : "💡"}</span>
          <div>
            <strong className="text-[#213044] text-lg">
              {item.options![selected].is_correct ? "太棒了！答对啦！" : "再想想，试一次！"}
            </strong>
            <p className="text-[#6c7480] text-sm mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
