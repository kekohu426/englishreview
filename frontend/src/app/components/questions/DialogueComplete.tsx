import { useState, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { playSuccess, playWrong, speak } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function DialogueComplete({ item, onCorrect }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number>(-1);
  const [playedOnce, setPlayedOnce] = useState(false);
  const dialogue = item.dialogue || [];

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

  const playOptions = async () => {
    setPlayedOnce(true);
    setReadingIndex(-1);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 先朗读对话中的非空白行
    for (const line of dialogue) {
      if (!line.isBlank && line.text) {
        await speak(line.text, "en-US");
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // 再朗读选项
    await new Promise(resolve => setTimeout(resolve, 400));
    for (let i = 0; i < (item.options?.length || 0); i++) {
      setReadingIndex(i);
      const letter = String.fromCharCode(65 + i);
      await speak(`${letter}`, "en-US");
      await new Promise(resolve => setTimeout(resolve, 300));
      await speak(item.options![i].text, "en-US");
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    setReadingIndex(-1);
  };

  // 自动朗读选项
  useEffect(() => {
    playOptions();
  }, [item]);

  const chosenText = selected !== null ? item.options![selected].text : null;
  const isCorrectAnswer = selected !== null && item.options![selected].is_correct;

  return (
    <div className="flex flex-col gap-6">
      {/* Dialogue card */}
      <div className="border-[3px] border-[#213044] rounded-2xl overflow-hidden max-w-2xl shadow-[6px_6px_0_rgba(33,48,68,0.88)]">
        {/* Bubbles */}
        <div className="bg-[#f8fafc] px-5 py-5 flex flex-col gap-5">
          {dialogue.map((line, i) => {
            const isRight = i % 2 === 1;
            const isBlank = line.isBlank;

            return (
              <div key={i} className={`flex items-end gap-3 ${isRight ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-full border-[3px] border-[#213044] flex items-center justify-center text-2xl flex-shrink-0 shadow-[3px_3px_0_rgba(33,48,68,0.6)] ${isRight ? "bg-[#d7f0ff]" : "bg-[#ffe070]"}`}
                >
                  {line.icon}
                </div>

                <div className={`flex flex-col gap-1 max-w-[75%] ${isRight ? "items-end" : "items-start"}`}>
                  <span className="text-[11px] text-[#6c7480] font-black px-1">{line.name}</span>

                  {isBlank ? (
                    /* Blank bubble */
                    <div
                      className={[
                        "border-[3px] rounded-2xl px-4 py-3 min-w-32 transition-all",
                        isRight ? "rounded-br-none" : "rounded-bl-none",
                        chosenText && isCorrectAnswer ? "border-[#1f9d67] bg-[#dff9e9] shadow-[3px_3px_0_rgba(31,157,103,0.5)]" :
                        chosenText && !isCorrectAnswer ? "border-[#e04b4b] bg-[#ffe5e5] shadow-[3px_3px_0_rgba(224,75,75,0.4)]" :
                        "border-dashed border-[#213044] bg-white shadow-[3px_3px_0_rgba(33,48,68,0.3)]",
                      ].join(" ")}
                    >
                      {chosenText ? (
                        <span
                          className="font-black text-xl leading-tight"
                          style={{ color: isCorrectAnswer ? "#1f9d67" : "#e04b4b" }}
                        >
                          {chosenText}
                        </span>
                      ) : (
                        <span className="text-[#6c7480] text-sm font-black opacity-60 italic">选择回答…</span>
                      )}
                    </div>
                  ) : (
                    /* Normal bubble */
                    <div
                      className={[
                        "border-[3px] border-[#213044] rounded-2xl px-4 py-3 shadow-[3px_3px_0_rgba(33,48,68,0.6)]",
                        isRight ? "rounded-br-none bg-[#d7e8ff]" : "rounded-bl-none bg-white",
                      ].join(" ")}
                    >
                      <span className="font-black text-[#213044] leading-tight" style={{ fontSize: "clamp(18px,3vw,24px)" }}>
                        {line.text}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3 max-w-2xl">
        {playedOnce && !locked && (
          <div className="flex justify-center">
            <button
              onClick={playOptions}
              className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2"
            >
              <Volume2 size={20} />
              🔁 再听一遍
            </button>
          </div>
        )}
        {item.options?.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrect = opt.is_correct;
          const isReading = readingIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => pick(idx)}
              disabled={locked && !isSelected}
              className={[
                "border-[3px] rounded-xl px-5 py-4 text-left font-black text-xl transition-all flex items-center gap-3",
                "shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_rgba(33,48,68,0.88)]",
                "active:translate-x-0.5 active:translate-y-0.5",
                isSelected && isCorrect  ? "bg-[#dff9e9] border-[#1f9d67] animate-correct" : "",
                isSelected && !isCorrect ? "bg-[#ffe5e5] border-[#e04b4b] animate-wrong"   : "",
                isReading               ? "bg-[#fff7d6] border-[#f28a3c] scale-105"       : "",
                !isSelected && !isReading ? "bg-white border-[#213044]"                    : "",
              ].join(" ")}
              style={isReading ? { animation: "recordPulse 0.6s ease-in-out infinite" } : {}}
            >
              <span className="inline-flex w-8 h-8 rounded-lg border-2 border-[#213044] bg-[#fff9ea] items-center justify-center text-sm font-black mr-3 flex-shrink-0">{String.fromCharCode(65 + idx)}</span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {locked && selected !== null && (
        <div className={`flex items-start gap-3 border-[3px] rounded-xl px-5 py-4 max-w-2xl animate-rise ${item.options![selected].is_correct ? "border-[#1f9d67] bg-[#e7fff1]" : "border-[#e04b4b] bg-[#fff0f0]"}`}>
          <span className="text-2xl mt-0.5">{item.options![selected].is_correct ? "🌟" : "💡"}</span>
          <div>
            <strong className="text-[#213044] text-lg">{item.options![selected].is_correct ? "对话接得很好！" : "再想想！"}</strong>
            <p className="text-[#6c7480] text-sm mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
