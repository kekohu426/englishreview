import { useState, useCallback, useEffect } from "react";
import { Volume2, Delete } from "lucide-react";
import { LessonItem, VOCAB_MAP } from "../../data/lesson";
import { speak, playSuccess, playWrong } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

export function SpellWord({ item, onCorrect }: Props) {
  const word = (item.spell_word || "").toUpperCase();
  const vocab = VOCAB_MAP[(item.spell_word || "").toLowerCase()];
  const rawHint = item.word_translation || "";
  const safeHint = rawHint.trim().toLowerCase() === (item.spell_word || "").trim().toLowerCase() || /^[a-z\s-]+$/i.test(rawHint.trim())
    ? "?"
    : rawHint;
  const [typed, setTyped] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [letterPool, setLetterPool] = useState<string[]>([]);

  useEffect(() => {
    setLetterPool(shuffleLetters(item.letter_pool || [], `${item.id || ""}:${item.spell_word || ""}`));
  }, [item.id, item.spell_word, item.letter_pool]);

  const playWord = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayCount((c) => c + 1);
    await speak(item.audio_text || item.spell_word || "", "en-US");
    setPlaying(false);
  }, [item, playing]);

  // 自动播放单词
  useEffect(() => {
    const timer = setTimeout(() => {
      playWord();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const tapLetter = (letter: string) => {
    if (checked || typed.length >= word.length) return;
    const newTyped = [...typed, letter];
    setTyped(newTyped);

    // 如果填满了所有字母，自动检查
    if (newTyped.length === word.length) {
      setTimeout(() => {
        const isCorrect = newTyped.join("") === word;
        setChecked(true);
        setCorrect(isCorrect);
        if (isCorrect) { playSuccess(); setTimeout(onCorrect, 1100); }
        else           { playWrong(); }
      }, 300);
    }
  };

  const backspace = () => {
    if (checked) return;
    setTyped((t) => t.slice(0, -1));
  };

  const reset = () => {
    setTyped([]);
    setChecked(false);
    setCorrect(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 再听一遍按钮 */}
      {playCount > 0 && !playing && !checked && (
        <div className="flex justify-center">
          <button
            onClick={playWord}
            className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-[#ffe070] font-black text-[#213044] text-base shadow-[4px_4px_0_#213044] hover:-translate-y-1 hover:shadow-[4px_6px_0_#213044] transition-all flex items-center gap-2"
          >
            <Volume2 size={20} />
            🔁 再听一遍
          </button>
        </div>
      )}

      {/* Word hint card */}
      <div className="border-[3px] border-[#213044] rounded-2xl bg-white shadow-[5px_5px_0_rgba(33,48,68,0.88)] p-6 max-w-2xl flex items-center justify-center gap-5">
        <div className="w-24 h-24 border-[3px] border-[#213044] rounded-2xl bg-[#fff7d6] flex items-center justify-center shadow-[4px_4px_0_rgba(33,48,68,0.88)] flex-shrink-0">
          <span className="text-5xl leading-none">{vocab?.image || "❓"}</span>
        </div>
        <p className="font-black text-[#213044] text-2xl">{safeHint || "?"}</p>
      </div>

      {/* Answer slots - bigger for better visibility */}
      <div className="flex flex-col gap-3 max-w-2xl">
        <div className="flex gap-3 flex-wrap items-center justify-center">
          {Array.from({ length: word.length }, (_, i) => {
            const letter = typed[i];
            const isCorrectLetter = checked && letter === word[i];
            const isWrongLetter = checked && letter && letter !== word[i];
            const isCurrent = i === typed.length && !checked;
            return (
              <div
                key={i}
                className={[
                  "w-16 h-20 border-[4px] rounded-2xl flex items-center justify-center font-black text-3xl transition-all shadow-[4px_4px_0_rgba(33,48,68,0.88)]",
                  isCorrectLetter ? "bg-[#dff9e9] border-[#1f9d67] text-[#1f9d67]"  :
                  isWrongLetter   ? "bg-[#ffe5e5] border-[#e04b4b] text-[#e04b4b]"  :
                  letter          ? "bg-[#ffe070] border-[#213044] text-[#213044]"   :
                  isCurrent       ? "border-[#3167d8] border-dashed bg-[#f0f7ff]"    :
                  "bg-white border-[#213044] border-dashed opacity-50",
                ].join(" ")}
                style={isCurrent ? { animation: "recordPulse 1.2s ease-in-out infinite" } : {}}
              >
                {letter || ""}
              </div>
            );
          })}
          {/* Backspace */}
          {typed.length > 0 && !checked && (
            <button
              onClick={backspace}
              className="w-16 h-16 border-[4px] border-[#213044] rounded-2xl flex items-center justify-center bg-white shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:bg-[#fff0f0] transition-colors"
            >
              <Delete size={24} className="text-[#e04b4b]" />
            </button>
          )}
        </div>
      </div>

      {/* Letter keyboard - bigger buttons for easier tapping */}
      <div className="flex flex-col gap-2 max-w-2xl">
        <div className="flex flex-wrap gap-3 justify-center">
          {letterPool.map((letter, idx) => (
            <button
              key={`${letter}-${idx}`}
              onClick={() => tapLetter(letter)}
              disabled={checked || typed.length >= word.length}
              className="w-16 h-16 border-[4px] border-[#213044] rounded-2xl font-black text-[#213044] text-2xl bg-white shadow-[4px_4px_0_rgba(33,48,68,0.88)] hover:-translate-y-1 hover:bg-[#ffe070] hover:shadow-[4px_6px_0_rgba(33,48,68,0.88)] transition-all active:translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {checked && !correct && (
        <div className="flex flex-col items-center gap-4 border-[3px] rounded-2xl px-6 py-5 max-w-2xl animate-rise border-[#e04b4b] bg-[#fff0f0]">
          <span className="text-5xl">❌</span>
          <div className="flex gap-2">
            {word.split("").map((l, i) => (
              <span key={i} className="w-12 h-14 border-[3px] border-[#1f9d67] rounded-xl flex items-center justify-center font-black text-[#1f9d67] bg-white text-2xl shadow-[2px_2px_0_rgba(31,157,103,0.3)]">
                {l}
              </span>
            ))}
          </div>
          <button onClick={reset} className="border-[3px] border-[#213044] rounded-xl px-6 py-3 bg-white font-black text-[#213044] text-base shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform">
            ↺ 再试一次
          </button>
        </div>
      )}
    </div>
  );
}

function shuffleLetters(letters: string[], seedText: string) {
  const output = [...letters];
  let seed = seedText.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const swapIndex = seed % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}
