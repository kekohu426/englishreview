import { useState, useCallback, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { playSuccess, playWrong, speak } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function WordOrder({ item, onCorrect }: Props) {
  const correctSentence = item.sentence || "";
  const [source, setSource] = useState<string[]>(item.words || []);
  const [answer, setAnswer] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const playSentence = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    await speak(correctSentence, "en-US");
    setPlaying(false);
  }, [correctSentence, playing]);

  // 自动播放句子
  useEffect(() => {
    const timer = setTimeout(() => {
      playSentence();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const addWord = (word: string, idx: number) => {
    if (checked) return;
    const newSource = source.filter((_, i) => i !== idx);
    const newAnswer = [...answer, word];
    setSource(newSource);
    setAnswer(newAnswer);

    // 如果排完了所有单词，自动检查
    if (newSource.length === 0) {
      setTimeout(() => {
        let formed = newAnswer.join(" ");
        formed = formed.replace(/\s+([?.!,;:])/g, "$1");
        const isCorrect = formed === correctSentence;
        setChecked(true);
        setCorrect(isCorrect);
        if (isCorrect) { playSuccess(); setTimeout(onCorrect, 1100); }
        else           { playWrong(); }
      }, 300);
    }
  };

  const removeWord = (idx: number) => {
    if (checked) return;
    const word = answer[idx];
    setAnswer((a) => a.filter((_, i) => i !== idx));
    setSource((s) => [...s, word]);
  };

  const check = () => {
    if (answer.length === 0) return;
    let formed = answer.join(" ");
    // 智能处理标点符号：移除标点符号前的空格
    formed = formed.replace(/\s+([?.!,;:])/g, "$1");
    const isCorrect = formed === correctSentence;
    setChecked(true);
    setCorrect(isCorrect);
    if (isCorrect) { playSuccess(); setTimeout(onCorrect, 1100); }
    else           { playWrong(); }
  };

  const reset = () => {
    setSource(item.words || []);
    setAnswer([]);
    setChecked(false);
    setCorrect(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 再听一遍按钮 */}
      {playCount > 0 && !playing && !checked && (
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

      {/* Answer zone - no label, just the area */}
      <div className="max-w-2xl">
        <div
          className={[
            "min-h-28 border-[4px] rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-center transition-all",
            checked && correct  ? "border-[#1f9d67] bg-[#dff9e9] shadow-[4px_4px_0_rgba(31,157,103,0.3)]" :
            checked && !correct ? "border-[#e04b4b] bg-[#ffe5e5] shadow-[4px_4px_0_rgba(224,75,75,0.3)]" :
            answer.length > 0  ? "border-[#3167d8] bg-white shadow-[4px_4px_0_rgba(49,103,216,0.3)]" :
            "border-[#3167d8] border-dashed bg-[#f0f7ff]",
          ].join(" ")}
        >
          {answer.length === 0 && !checked && (
            <span className="text-6xl opacity-20">👆</span>
          )}
          {answer.map((word, idx) => (
            <button
              key={`ans-${idx}`}
              onClick={() => removeWord(idx)}
              disabled={checked}
              className="border-[3px] border-[#213044] rounded-xl px-5 py-3 font-black text-[#213044] text-2xl bg-[#ffe070] shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:-translate-y-1 hover:shadow-[4px_6px_0_rgba(33,48,68,0.88)] transition-all active:translate-y-0.5 disabled:cursor-default animate-tile-in"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* Source tiles - no label */}
      <div className="max-w-2xl">
        <div className="flex flex-wrap gap-3 min-h-20 p-5 border-[3px] border-[#213044] rounded-2xl bg-white shadow-[3px_3px_0_rgba(33,48,68,0.5)] justify-center">
          {source.map((word, idx) => (
            <button
              key={`src-${idx}-${word}`}
              onClick={() => addWord(word, idx)}
              disabled={checked}
              className="border-[3px] border-[#213044] rounded-xl px-5 py-3 font-black text-[#213044] text-2xl bg-[#d7f0ff] shadow-[3px_3px_0_rgba(33,48,68,0.88)] hover:-translate-y-1 hover:bg-[#ffe070] hover:scale-105 hover:shadow-[3px_5px_0_rgba(33,48,68,0.88)] transition-all active:translate-y-0.5 disabled:cursor-default disabled:opacity-40"
            >
              {word}
            </button>
          ))}
          {source.length === 0 && !checked && (
            <span className="text-5xl">✓</span>
          )}
        </div>
      </div>

      {/* Actions - only show reset button if not checked */}
      {!checked && answer.length > 0 && source.length > 0 && (
        <div className="flex justify-center max-w-2xl">
          <button
            onClick={reset}
            className="border-[3px] border-[#213044] rounded-xl px-5 py-3 bg-white font-black text-[#213044] shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform text-base"
          >
            ↺ 重置
          </button>
        </div>
      )}

      {checked && (
        <div className={`flex flex-col items-center gap-4 border-[3px] rounded-2xl px-6 py-5 max-w-2xl animate-rise ${correct ? "border-[#1f9d67] bg-[#e7fff1]" : "border-[#e04b4b] bg-[#fff0f0]"}`}>
          <span className="text-5xl">{correct ? "🌟" : "❌"}</span>
          {!correct && (
            <>
              <div className="flex flex-wrap gap-2 justify-center">
                {correctSentence.split(" ").map((w, i) => (
                  <span key={i} className="border-[3px] border-[#1f9d67] rounded-xl px-4 py-2 text-lg font-black text-[#1f9d67] bg-white shadow-[2px_2px_0_rgba(31,157,103,0.3)]">{w}</span>
                ))}
              </div>
              <button onClick={reset} className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-white font-black text-[#213044] text-base shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform">
                ↺ 再试一次
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
