import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { detectLang, playSuccess, playWrong, speak } from "../../utils/speech";

interface Props {
  item: LessonItem;
  onCorrect: () => void;
}

export function TranslatePick({ item, onCorrect }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number>(-1);
  const [playedOnce, setPlayedOnce] = useState(false);
  const [playing, setPlaying] = useState(false);

  const isZh = item.source_lang === "zh";
  const sourceLang = isZh ? "zh-CN" : "en-US";
  const optionLang = isZh ? "en-US" : "zh-CN";

  const pick = (idx: number) => {
    if (locked) return;
    setSelected(idx);
    setLocked(true);
    if (item.options![idx].is_correct) {
      playSuccess();
      setTimeout(onCorrect, 1000);
    } else {
      playWrong();
      setTimeout(() => {
        setSelected(null);
        setLocked(false);
      }, 1200);
    }
  };

  const playSource = async () => {
    if (!item.source_text || playing) return;
    setPlaying(true);
    await speak(item.source_text, sourceLang);
    setPlaying(false);
  };

  const playOption = async (idx: number) => {
    const opt = item.options?.[idx];
    if (!opt?.text || playing) return;
    setPlaying(true);
    setReadingIndex(idx);
    await speak(String.fromCharCode(65 + idx), "en-US");
    await new Promise((resolve) => setTimeout(resolve, 180));
    await speak(opt.text, detectLang(opt.text));
    setReadingIndex(-1);
    setPlaying(false);
  };

  const playAll = async () => {
    if (playing) return;
    setPlaying(true);
    setPlayedOnce(true);
    setReadingIndex(-1);

    if (item.source_text) {
      await speak(item.source_text, sourceLang);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    for (let i = 0; i < (item.options?.length || 0); i++) {
      setReadingIndex(i);
      await speak(String.fromCharCode(65 + i), "en-US");
      await new Promise((resolve) => setTimeout(resolve, 180));
      await speak(item.options![i].text, optionLang);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    setReadingIndex(-1);
    setPlaying(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      playAll();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [item.id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-[3px] border-[#213044] rounded-2xl bg-[#fff7d6] px-7 py-6 shadow-[6px_6px_0_rgba(33,48,68,0.88)] max-w-2xl flex items-center gap-3">
        <button
          type="button"
          onClick={playSource}
          disabled={playing}
          className="w-12 h-12 rounded-xl border-[3px] border-[#213044] bg-white flex items-center justify-center shadow-[3px_3px_0_rgba(33,48,68,0.65)] hover:-translate-y-0.5 transition-transform disabled:opacity-50 flex-shrink-0"
          aria-label={isZh ? "读中文题目" : "读英文题目"}
        >
          <Volume2 size={24} className="text-[#213044]" />
        </button>

        <p
          className="font-black text-[#213044] leading-tight flex-1 text-center"
          style={{ fontSize: "clamp(26px,5vw,40px)" }}
        >
          {item.source_text}
        </p>

        <span className="text-base font-black text-[#213044] border-[2px] border-[#213044] rounded-xl bg-white px-3 py-2 shadow-[2px_2px_0_rgba(33,48,68,0.5)] flex-shrink-0">
          {isZh ? "CN" : "EN"}
        </span>
      </div>

      <div className="flex justify-center max-w-2xl">
        <button
          type="button"
          onClick={playAll}
          disabled={playing || locked}
          className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Volume2 size={20} />
          {playedOnce ? "再听一遍" : "听题目和选项"}
        </button>
      </div>

      <div className="flex flex-col gap-3 max-w-2xl">
        {item.options?.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrect = opt.is_correct;
          const isReading = readingIndex === idx;
          const letter = String.fromCharCode(65 + idx);
          const letterBgs = ["#ffe070", "#d7f0ff", "#dff9e9", "#f0e6ff"];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => pick(idx)}
              disabled={locked && !isSelected}
              className={[
                "border-[3px] rounded-2xl transition-all flex items-stretch overflow-hidden",
                "shadow-[4px_4px_0_rgba(33,48,68,0.88)]",
                isSelected && isCorrect ? "bg-[#dff9e9] border-[#1f9d67] animate-correct" : "",
                isSelected && !isCorrect ? "bg-[#ffe5e5] border-[#e04b4b] animate-wrong" : "",
                isReading ? "bg-[#fff7d6] border-[#f28a3c] scale-[1.02]" : "",
                !isSelected && !isReading ? "bg-white border-[#213044]" : "",
              ].join(" ")}
              style={isReading ? { animation: "recordPulse 0.6s ease-in-out infinite" } : {}}
            >
              <span
                className="flex-1 px-5 py-4 text-left font-black text-xl transition-all flex items-center gap-3 disabled:cursor-not-allowed"
              >
                <span
                  className="w-10 h-10 rounded-xl border-[3px] border-[#213044] flex items-center justify-center text-sm font-black flex-shrink-0 shadow-[2px_2px_0_rgba(33,48,68,0.5)]"
                  style={{
                    background: !isSelected && !isReading ? letterBgs[idx % letterBgs.length] : "transparent",
                  }}
                >
                  {letter}
                </span>
                <span className="flex-1 text-[#213044]">{opt.text}</span>
                {isSelected && isCorrect && <span className="text-xl flex-shrink-0">✓</span>}
                {isSelected && !isCorrect && <span className="text-xl flex-shrink-0">×</span>}
              </span>
            </button>
          );
        })}
      </div>

      {locked && selected !== null && (
        <div
          className={`flex items-start gap-3 border-[3px] rounded-2xl px-5 py-4 max-w-2xl animate-rise ${
            item.options![selected].is_correct
              ? "border-[#1f9d67] bg-[#e7fff1]"
              : "border-[#e04b4b] bg-[#fff0f0]"
          }`}
        >
          <span className="text-2xl mt-0.5">{item.options![selected].is_correct ? "✓" : "×"}</span>
          <div>
            <strong className="text-[#213044] text-lg">
              {item.options![selected].is_correct ? "选对了" : "再想想"}
            </strong>
            <p className="text-[#6c7480] text-sm mt-1 leading-relaxed">{item.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
