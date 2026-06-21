import { ChevronRight, Home, RotateCcw } from "lucide-react";
import { PracticeHistoryEntry } from "../utils/practiceStorage";

interface Props {
  entries: PracticeHistoryEntry[];
  onHome: () => void;
  onOpen: (entry: PracticeHistoryEntry, reset: boolean) => void;
}

export function HistoryScreen({ entries, onHome, onOpen }: Props) {
  return (
    <ScreenShell title="历史练习" subtitle="打开以前生成过的练习继续做" onHome={onHome}>
      {entries.length === 0 ? (
        <EmptyState title="还没有历史练习" text="生成一套练习后，这里会自动保存。" />
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => {
            const totalModules = entry.modules.length;
            const readyModules = entry.modules.filter((mod) => (mod.status || "ready") === "ready").length;
            const totalQuestions = entry.modules.reduce((sum, mod) => sum + (mod.items?.length || 0), 0);
            const done = entry.completedModuleIds.length;
            const created = new Date(entry.createdAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={entry.id}
                className="border-[3px] border-[#213044] rounded-2xl bg-white shadow-[5px_5px_0_rgba(33,48,68,0.88)] overflow-hidden"
              >
                <div className="h-2 bg-[#3167d8]" />
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-[#6c7480]">{created}</p>
                      <h3 className="font-black text-[#213044] text-lg mt-1">
                        {readyModules}/{totalModules} 模块 · {totalQuestions} 题
                      </h3>
                      <p className="text-[#6c7480] text-sm mt-2 line-clamp-2">
                        {entry.teacherText || "历史生成练习"}
                      </p>
                    </div>
                    <div className="border-[2px] border-[#213044] rounded-xl px-3 py-2 bg-[#fff1bf] font-black text-[#213044] text-sm whitespace-nowrap">
                      完成 {done}/{totalModules}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => onOpen(entry, false)}
                      className="flex-1 border-[3px] border-[#213044] rounded-xl px-5 py-3 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044] flex items-center justify-center gap-2"
                    >
                      继续练习 <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() => onOpen(entry, true)}
                      className="flex-1 border-[3px] border-[#213044] rounded-xl px-5 py-3 bg-white text-[#213044] font-black shadow-[3px_3px_0_#213044] flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={18} /> 重新开始
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ScreenShell>
  );
}

export function ScreenShell({
  title,
  subtitle,
  onHome,
  children,
}: {
  title: string;
  subtitle: string;
  onHome: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px) 0 0 / 24px 24px,
          linear-gradient(180deg, rgba(255,255,255,0.45) 1px, transparent 1px) 0 0 / 24px 24px,
          #fff9ea`,
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onHome}
            className="border-[3px] border-[#213044] rounded-xl w-11 h-11 flex items-center justify-center bg-white shadow-[3px_3px_0_#213044]"
          >
            <Home size={18} className="text-[#213044]" />
          </button>
          <div>
            <h1 className="font-black text-[#213044] text-2xl">{title}</h1>
            <p className="text-[#6c7480] text-sm font-bold">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-[3px] border-dashed border-[#e7dcc4] rounded-2xl bg-white p-8 text-center">
      <p className="font-black text-[#213044] text-lg">{title}</p>
      <p className="text-[#6c7480] text-sm mt-2">{text}</p>
    </div>
  );
}
