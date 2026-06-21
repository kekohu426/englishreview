import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, Eraser, CheckCircle2 } from "lucide-react";
import { LessonItem } from "../../data/lesson";
import { speak, playSuccess } from "../../utils/speech";

interface Props { item: LessonItem; onCorrect: () => void; }

const LETTER_COLORS: Record<string, string> = {
  A:"#e04b4b",B:"#3167d8",C:"#1f9d67",D:"#f28a3c",E:"#9b59b6",F:"#2ca6a4",
  G:"#e04b4b",H:"#3167d8",I:"#1f9d67",J:"#f28a3c",K:"#9b59b6",L:"#2ca6a4",
  M:"#e04b4b",N:"#3167d8",O:"#1f9d67",P:"#f28a3c",Q:"#9b59b6",R:"#2ca6a4",
  S:"#e04b4b",T:"#3167d8",U:"#1f9d67",V:"#f28a3c",W:"#9b59b6",X:"#2ca6a4",
  Y:"#e04b4b",Z:"#3167d8",
};

const PHONICS: Record<string, { ipa: string; zh: string; example: string; emoji: string }> = {
  A:{ ipa:"/eɪ/",  zh:"苹果", example:"apple",   emoji:"🍎" },
  B:{ ipa:"/biː/", zh:"球",   example:"ball",    emoji:"⚽" },
  C:{ ipa:"/siː/", zh:"猫",   example:"cat",     emoji:"🐱" },
  D:{ ipa:"/diː/", zh:"狗",   example:"dog",     emoji:"🐶" },
  E:{ ipa:"/iː/",  zh:"鸡蛋", example:"egg",     emoji:"🥚" },
  F:{ ipa:"/ef/",  zh:"鱼",   example:"fish",    emoji:"🐟" },
  G:{ ipa:"/dʒiː/",zh:"女孩", example:"girl",    emoji:"👧" },
  H:{ ipa:"/eɪtʃ/",zh:"房子", example:"house",   emoji:"🏠" },
  I:{ ipa:"/aɪ/",  zh:"冰淇淋",example:"ice cream",emoji:"🍦" },
  J:{ ipa:"/dʒeɪ/",zh:"果冻", example:"jelly",   emoji:"🍮" },
  K:{ ipa:"/keɪ/", zh:"风筝", example:"kite",    emoji:"🪁" },
  L:{ ipa:"/el/",  zh:"柠檬", example:"lemon",   emoji:"🍋" },
  M:{ ipa:"/em/",  zh:"猴子", example:"monkey",  emoji:"🐒" },
  N:{ ipa:"/en/",  zh:"鸟巢", example:"nest",    emoji:"🪺" },
  O:{ ipa:"/əʊ/",  zh:"橙子", example:"orange",  emoji:"🍊" },
  P:{ ipa:"/piː/", zh:"钢笔", example:"pen",     emoji:"✏️" },
  Q:{ ipa:"/kjuː/",zh:"女王", example:"queen",   emoji:"👑" },
  R:{ ipa:"/ɑː/",  zh:"兔子", example:"rabbit",  emoji:"🐰" },
  S:{ ipa:"/es/",  zh:"太阳", example:"sun",     emoji:"☀️" },
  T:{ ipa:"/tiː/", zh:"老虎", example:"tiger",   emoji:"🐯" },
  U:{ ipa:"/juː/", zh:"伞",   example:"umbrella",emoji:"☂️" },
  V:{ ipa:"/viː/", zh:"蔬菜", example:"vegetable",emoji:"🥦" },
  W:{ ipa:"/dʌbljuː/",zh:"水",example:"water",   emoji:"💧" },
  X:{ ipa:"/eks/", zh:"X光", example:"X-ray",   emoji:"🩻" },
  Y:{ ipa:"/waɪ/", zh:"黄色", example:"yellow",  emoji:"🌟" },
  Z:{ ipa:"/zed/", zh:"斑马", example:"zebra",   emoji:"🦓" },
};

export function LetterSoundTrace({ item, onCorrect }: Props) {
  const letter = (item.letter || "A").toUpperCase();
  const lower = letter.toLowerCase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [played, setPlayed] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const color = LETTER_COLORS[letter] || "#3167d8";
  const phonics = PHONICS[letter];

  const drawGuide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${canvas.height * 0.72}px Georgia, serif`;
    ctx.fillStyle = `${color}1a`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
  }, [letter, color]);

  useEffect(() => { drawGuide(); }, [drawGuide]);

  const playLetter = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    setPlayed(true);
    await speak(letter, "en-US");
    setPlaying(false);
  }, [letter, playing]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    setHasDrawn(true);
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const doDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => { drawing.current = false; };

  const clearCanvas = () => {
    drawGuide();
    setHasDrawn(false);
  };

  const finish = () => {
    setDone(true);
    playSuccess();
    setTimeout(onCorrect, 900);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-5 flex-wrap items-start">
        {/* Left: Letter card + phonics */}
        <div className="flex flex-col gap-3" style={{ minWidth: 180 }}>
          {/* Main letter card */}
          <button
            onClick={playLetter}
            className="border-[4px] border-[#213044] rounded-2xl flex flex-col items-center justify-center gap-2 py-6 transition-all hover:scale-105 hover:-translate-y-1 shadow-[6px_6px_0_rgba(33,48,68,0.88)] cursor-pointer"
            style={{ background: `${color}15`, minWidth: 180, minHeight: 180 }}
          >
            {/* Big letter */}
            <span className="font-black leading-none" style={{ fontSize: 88, color }}>{letter}</span>
            <span className="font-black text-2xl text-[#213044]">{lower}</span>
          </button>

          {/* Hear it button */}
          <button
            onClick={playLetter}
            className={`w-14 h-14 rounded-full border-[3px] border-[#213044] flex items-center justify-center text-white font-black text-2xl shadow-[3px_3px_0_#213044] hover:scale-110 transition-transform ${playing ? "bg-[#e04b4b]" : "bg-[#ffe070]"}`}
          >
            {playing ? <span>🔊</span> : <Volume2 size={22} className="text-[#213044]" />}
          </button>

          {/* Phonics card */}
          {phonics && (
            <div className="border-[3px] border-[#213044] rounded-xl bg-white shadow-[3px_3px_0_rgba(33,48,68,0.5)] overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: `${color}18` }}>
                <span className="text-3xl">{phonics.emoji}</span>
                <div>
                  <p className="font-black text-[#213044] text-lg">{phonics.example}</p>
                  <p className="text-[#6c7480] text-sm">{phonics.zh}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Trace board */}
        <div className="flex flex-col gap-3 flex-1" style={{ minWidth: 260 }}>
          <div className="flex items-center justify-between">
            {hasDrawn && !done && (
              <span className="text-2xl">✍️</span>
            )}
            <div className="flex-1"></div>
            <button
              onClick={clearCanvas}
              className="w-10 h-10 rounded-full border-[3px] border-[#213044] flex items-center justify-center bg-white hover:bg-[#fff1bf] transition-colors shadow-[2px_2px_0_#213044]"
            >
              <Eraser size={18} />
            </button>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            className="border-[3px] border-[#213044] rounded-2xl cursor-crosshair touch-none w-full shadow-[4px_4px_0_rgba(33,48,68,0.88)]"
            style={{
              background: `
                repeating-linear-gradient(
                  to bottom,
                  white 0px, white 46px,
                  #c8deff 47px,
                  white 48px, white 94px,
                  #ffc8c8 95px
                )
              `,
            }}
            onMouseDown={startDraw}
            onMouseMove={doDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={doDraw}
            onTouchEnd={endDraw}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-end">
            <button
              onClick={finish}
              disabled={!played || done}
              className="flex items-center gap-2 border-[3px] border-[#213044] rounded-xl px-5 py-2.5 font-black text-white bg-[#1f9d67] shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              <CheckCircle2 size={16} />
              {done ? "完成！" : "写好啦"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
