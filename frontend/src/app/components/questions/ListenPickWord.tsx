import { useState, useCallback, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { speak, playSuccess, playWrong } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; badge?: string; badgeBg?: string; }

export function ListenPickWord({ item, onCorrect, badge = "🎧 听问题，选回答", badgeBg = "#d7e8ff" }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [readingIndex, setReadingIndex] = useState<number>(-1);

  const playAudio = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    setReadingIndex(-1);
    // 先播放问题
    await speak(item.audio_text || "", "en-US");
    await new Promise(resolve => setTimeout(resolve, 800));
    // 然后依次朗读选项
    for (let i = 0; i < (item.options?.length || 0); i++) {
      setReadingIndex(i);
      const letter = String.fromCharCode(65 + i); // A, B, C
      await speak(`${letter}`, "en-US");
      await new Promise(resolve => setTimeout(resolve, 300));
      await speak(item.options![i].text, "en-US");
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    setReadingIndex(-1);
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
      {/* Question card */}
      <div className="border-[3px] border-[#213044] rounded-2xl bg-[#fff7d6] px-6 py-5 text-center shadow-[6px_6px_0_rgba(33,48,68,0.88)] max-w-2xl">
        <p className="font-black text-[#213044] leading-tight" style={{ fontSize: "clamp(26px,5vw,40px)" }}>
          {item.audio_text}
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

      {/* Choices */}
      <div className="flex flex-col gap-3 max-w-2xl">
        {item.options?.map((opt, idx) => {
          const isCorrect = opt.is_correct;
          const isSelected = selected === idx;
          const isReading = readingIndex === idx;
          const letter = String.fromCharCode(65 + idx);
          const bgColors = ["#ffe070", "#d7f0ff", "#dff9e9", "#ffe5e5"];
          return (
            <button
              key={idx}
              onClick={() => pick(idx)}
              disabled={locked && !isSelected}
              className={[
                "border-[3px] rounded-2xl px-5 py-4 text-left font-black text-xl transition-all flex items-center gap-3 relative",
                "shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(33,48,68,0.88)]",
                "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_rgba(33,48,68,0.88)]",
                isSelected && isCorrect  ? "bg-[#dff9e9] border-[#1f9d67] animate-correct" : "",
                isSelected && !isCorrect ? "bg-[#ffe5e5] border-[#e04b4b] animate-wrong"   : "",
                isReading               ? "bg-[#fff7d6] border-[#f28a3c] scale-105"       : "",
                !isSelected && !isReading ? "bg-white border-[#213044]"                     : "",
              ].join(" ")}
              style={isReading ? { animation: "recordPulse 0.6s ease-in-out infinite" } : {}}
            >
              <span
                className="w-10 h-10 rounded-xl border-[3px] border-[#213044] flex items-center justify-center text-sm font-black flex-shrink-0 shadow-[2px_2px_0_rgba(33,48,68,0.5)]"
                style={{ background: !isSelected && !isReading ? bgColors[idx % bgColors.length] : "transparent" }}
              >
                {letter}
              </span>
              <span className="text-[#213044]">{opt.text}</span>
              {isSelected && isCorrect  && <span className="ml-auto text-xl">✅</span>}
              {isSelected && !isCorrect && <span className="ml-auto text-xl">❌</span>}
            </button>
          );
        })}
      </div>

      {locked && selected !== null && (
        <div className={`flex items-start gap-3 border-[3px] rounded-2xl px-5 py-4 max-w-2xl animate-rise ${item.options![selected].is_correct ? "border-[#1f9d67] bg-[#e7fff1]" : "border-[#e04b4b] bg-[#fff0f0]"}`}>
          <span className="text-2xl mt-0.5">{item.options![selected].is_correct ? "🌟" : "💡"}</span>
          <div>
            <strong className="text-[#213044] text-lg">{item.options![selected].is_correct ? "答对啦！" : "再想想！"}</strong>
            <p className="text-[#6c7480] text-sm mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
