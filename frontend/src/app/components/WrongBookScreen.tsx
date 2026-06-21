import { CheckCircle2, ChevronRight, Trash2 } from "lucide-react";
import { EmptyState, ScreenShell } from "./HistoryScreen";
import { WrongBookEntry } from "../utils/practiceStorage";

interface Props {
  entries: WrongBookEntry[];
  onHome: () => void;
  onPracticeOne: (entry: WrongBookEntry) => void;
  onPracticeModule: (entries: WrongBookEntry[]) => void;
  onClear: (keys: string[]) => void;
}

export function WrongBookScreen({ entries, onHome, onPracticeOne, onPracticeModule, onClear }: Props) {
  const groups = groupByModule(entries);

  return (
    <ScreenShell title="错题本" subtitle="把点错过的题集中再练一遍" onHome={onHome}>
      {entries.length === 0 ? (
        <EmptyState title="错题本是空的" text="练习中点错的题会自动出现在这里。" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={String(entries.length)} label="错题" />
            <Stat value={String(groups.length)} label="模块" />
          </div>

          {groups.map((group) => (
            <section
              key={group.moduleId}
              className="border-[3px] border-[#213044] rounded-2xl bg-white shadow-[5px_5px_0_rgba(33,48,68,0.88)] overflow-hidden"
            >
              <div className="h-2" style={{ background: group.moduleColor }} />
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 border-[2px] border-[#213044] rounded-xl bg-[#fff9ea] flex items-center justify-center text-2xl shadow-[2px_2px_0_rgba(33,48,68,0.5)]">
                      {group.moduleIcon}
                    </div>
                    <div>
                      <h2 className="font-black text-[#213044] text-lg">{group.moduleTitle}</h2>
                      <p className="text-[#6c7480] text-xs font-bold">{group.items.length} 道错题</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPracticeModule(group.items)}
                      className="border-[3px] border-[#213044] rounded-xl px-4 py-2 bg-[#1f9d67] text-white font-black shadow-[3px_3px_0_#213044] text-sm"
                    >
                      练这一组
                    </button>
                    <button
                      onClick={() => onClear(group.items.map((item) => item.key))}
                      className="border-[3px] border-[#213044] rounded-xl px-3 py-2 bg-white text-[#213044] font-black shadow-[3px_3px_0_#213044]"
                      aria-label="清空这一组"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {group.items.map((entry) => (
                    <div
                      key={entry.key}
                      className="border-[2px] border-[#e7dcc4] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1">
                        <p className="font-black text-[#213044]">
                          {entry.item.prompt || entry.item.audio_text || entry.item.text || entry.item.source_text || entry.item.word || entry.item.spell_word || entry.type}
                        </p>
                        <p className="text-[#6c7480] text-xs mt-1">
                          错 {entry.wrongCount} 次 · 复练 {entry.reviewCount} 次
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onPracticeOne(entry)}
                          className="border-[3px] border-[#213044] rounded-xl px-4 py-2 bg-[#ffe070] text-[#213044] font-black shadow-[3px_3px_0_#213044] text-sm flex items-center gap-1"
                        >
                          重练 <ChevronRight size={15} />
                        </button>
                        <button
                          onClick={() => onClear([entry.key])}
                          className="border-[3px] border-[#213044] rounded-xl px-3 py-2 bg-[#dff9e9] text-[#213044] font-black shadow-[3px_3px_0_#213044]"
                          aria-label="已掌握"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </ScreenShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-[3px] border-[#213044] rounded-2xl bg-white p-4 text-center shadow-[4px_4px_0_rgba(33,48,68,0.88)]">
      <div className="font-black text-[#213044] text-2xl leading-none">{value}</div>
      <div className="text-[#6c7480] text-xs mt-1 font-black">{label}</div>
    </div>
  );
}

function groupByModule(entries: WrongBookEntry[]) {
  const map = new Map<string, WrongBookEntry[]>();
  for (const entry of entries) {
    map.set(entry.moduleId, [...(map.get(entry.moduleId) || []), entry]);
  }
  return [...map.entries()].map(([moduleId, items]) => ({
    moduleId,
    moduleTitle: items[0].moduleTitle,
    moduleIcon: items[0].moduleIcon,
    moduleColor: items[0].moduleColor,
    items,
  }));
}
