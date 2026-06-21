import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileUp,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

const DEFAULT_TEXT =
  "综合复习前 4 单元\n统一做题：教材练习 p38，41\n\n复习巩固歌曲\nHow much & How many\n\n课后小练兵：\n混合过往句型练习问答\n加强名词可数 & 不可数的理解\n\n自然拼读学过的单元反复拼读及尝试拼写\n\nHow much & How many 歌唱视频跟读跟唱";

interface Material {
  id: string;
  label: string;
  aliases: string[];
  type?: string;
  created_at?: string;
}

interface ParentGenerateProps {
  onHome: () => void;
  onAnalyze: (text: string, materialContext?: any) => void;
  onGenerate: (text: string, analysis?: any) => void;
  analysisReport?: any;
  onAnalysisChange: (analysis: any) => void;
  analyzing: boolean;
  loading: boolean;
  error: string | null;
  generationStatus?: string | null;
  coverageReport?: any;
}

const BUILTIN_MATERIALS: Material[] = [
  { id: "opw2_textbook", label: "Big Fun 2 课本", aliases: ["课本", "教材", "Big Fun 2"], type: "builtin" },
  { id: "oxford_phonics", label: "Oxford Phonics World 2 自然拼读", aliases: ["自然拼读", "自拼", "Oxford Phonics World 2"], type: "builtin" },
];

function loadSelectedMaterials() {
  try {
    const savedList = JSON.parse(localStorage.getItem("kids-english-selected-materials") || "[]");
    if (Array.isArray(savedList) && savedList.length) return normalizeSelectedMaterialIds(savedList);
    const legacy = localStorage.getItem("kids-english-selected-material");
    return legacy ? normalizeSelectedMaterialIds([legacy]) : ["opw2_textbook"];
  } catch {
    return ["opw2_textbook"];
  }
}

function normalizeSelectedMaterialIds(ids: string[]) {
  const clean = ids.filter(Boolean);
  if (!clean.length) return ["opw2_textbook"];
  if (clean.includes("opw2_textbook")) return ["opw2_textbook"];
  if (clean.includes("oxford_phonics")) return ["oxford_phonics"];
  return [clean[0]];
}

export function ParentGenerateScreen({
  onHome,
  onAnalyze,
  onGenerate,
  analysisReport,
  onAnalysisChange,
  analyzing,
  loading,
  error,
  generationStatus,
  coverageReport,
}: ParentGenerateProps) {
  const [inputText, setInputText] = useState(
    localStorage.getItem("kids-english-pending") || DEFAULT_TEXT
  );
  const [customMaterials, setCustomMaterials] = useState<Material[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(() =>
    loadSelectedMaterials()
  );
  const [showUpload, setShowUpload] = useState(false);
  const [materialStatus, setMaterialStatus] = useState<string | null>(null);

  const materials = useMemo(() => [...BUILTIN_MATERIALS, ...customMaterials], [customMaterials]);
  const selectedMaterials = materials.filter((material) => selectedMaterialIds.includes(material.id));
  const primaryTextbook = selectedMaterials.find((material) => material.id !== "oxford_phonics") || materials[0];
  const progress = useGenerationProgress({ analyzing, loading, analysisReport, generationStatus });

  useEffect(() => {
    loadMaterials();
  }, []);

  const materialContext = useMemo(() => ({
    default_textbook_id: primaryTextbook?.id || "opw2_textbook",
    selected_material_ids: selectedMaterialIds,
    selected_material_label: selectedMaterials.map((item) => item.label).join(" + ") || "Big Fun 2 课本",
  }), [primaryTextbook, selectedMaterialIds, selectedMaterials]);

  const loadMaterials = async () => {
    try {
      const resp = await fetch("/api/materials");
      const data = await resp.json();
      setCustomMaterials(Array.isArray(data.materials) ? data.materials : []);
    } catch {
      setCustomMaterials([]);
    }
  };

  const chooseMaterial = (id: string) => {
    setSelectedMaterialIds(() => {
      const next = [id || "opw2_textbook"];
      localStorage.setItem("kids-english-selected-materials", JSON.stringify(next));
      localStorage.setItem("kids-english-selected-material", next[0]);
      return next;
    });
  };

  const handleAnalyze = () => {
    if (loading || analyzing || !inputText.trim()) return;
    localStorage.setItem("kids-english-pending", inputText);
    onAnalyze(inputText, materialContext);
  };

  const handleGenerate = () => {
    if (loading || analyzing || !inputText.trim() || !analysisReport) return;
    localStorage.setItem("kids-english-pending", inputText);
    onGenerate(inputText, analysisReport);
  };

  const handleUploaded = (material: Material) => {
    setCustomMaterials((items) => [material, ...items.filter((item) => item.id !== material.id)]);
    setSelectedMaterialIds(() => {
      const next = [material.id];
      localStorage.setItem("kids-english-selected-materials", JSON.stringify(next));
      localStorage.setItem("kids-english-selected-material", material.id);
      return next;
    });
    setShowUpload(false);
    setMaterialStatus(`已选择新教材：${material.label}`);
  };

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
      <div className="max-w-5xl mx-auto px-4 py-6 pb-16">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onHome}
              className="border-[3px] border-[#213044] rounded-xl w-11 h-11 bg-white flex items-center justify-center shadow-[3px_3px_0_#213044]"
              title="返回"
            >
              <ArrowLeft size={19} className="text-[#213044]" />
            </button>
            <div>
              <p className="text-[11px] font-black text-[#6c7480] uppercase tracking-widest mb-1">
                Parent workspace
              </p>
              <h1 className="font-black text-[#213044] text-2xl sm:text-3xl leading-tight">
                生成今日练习
              </h1>
            </div>
          </div>
          <span className="border-[2px] border-[#213044] rounded-full px-4 py-1.5 bg-[#dff5e3] text-[#213044] font-black text-xs">
            先选教材，再拆解作业
          </span>
        </header>

        <section className="border-[3px] border-[#213044] rounded-3xl bg-white overflow-hidden shadow-[6px_6px_0_rgba(33,48,68,0.88)]">
          <div className="bg-[#213044] px-6 py-5">
            <div className="flex items-center gap-2 text-white">
              <ClipboardList size={22} />
              <h2 className="font-black text-xl">作业生成设置</h2>
            </div>
            <p className="text-[#aab4c0] text-sm font-bold mt-2">
              先选择本次作业对应的教材，系统会按这份教材拆解单词、句型和语法。
            </p>
          </div>

          <div className="px-6 py-5">
            <MaterialPicker
              materials={materials}
              selectedIds={selectedMaterialIds}
              showUpload={showUpload}
              onSelect={chooseMaterial}
              onToggleUpload={() => setShowUpload(!showUpload)}
              onUploaded={handleUploaded}
              onStatus={setMaterialStatus}
            />

            {materialStatus && (
              <div className="mt-3 text-sm font-bold text-[#145f3e] bg-[#dff5e3] border-[2px] border-[#b8e3c0] rounded-xl px-4 py-3">
                {materialStatus}
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="font-black text-[#213044]">粘贴老师作业要求</label>
                <span className="text-xs font-black text-[#6c7480]">
                  当前：{selectedMaterials.map((item) => item.label).join(" + ") || "Big Fun 2 课本"}
                </span>
              </div>
              <textarea
                className="w-full border-[2px] border-[#e7dcc4] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#213044] transition-colors leading-relaxed"
                rows={9}
                placeholder="把老师群里的复习要求直接粘贴到这里"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    analysisReport ? handleGenerate() : handleAnalyze();
                  }
                }}
              />
            </div>

            {error && (
              <div className="mt-3 text-red-700 text-sm font-bold bg-red-50 border-[2px] border-red-200 rounded-xl px-4 py-3 flex gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {(analyzing || loading || analysisReport) && (
              <ProgressPanel progress={progress} loading={loading || analyzing} />
            )}

            {analysisReport && !loading && (
              <HomeworkAnalysisPanel analysis={analysisReport} onChange={onAnalysisChange} />
            )}

            {coverageReport && !loading && (
              <CoveragePanel report={coverageReport} />
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                onClick={handleAnalyze}
                disabled={loading || analyzing || !inputText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#c8c4bd] bg-white px-5 py-3 text-base font-black text-[#151515] hover:bg-[#f7f5ef] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                {analyzing ? "分析中..." : analysisReport ? "重新分析" : "分析作业"}
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || analyzing || !inputText.trim() || !analysisReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-base font-black text-[#2e6333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: loading ? "#d4d7dc" : "#eaf4df" }}
              >
                <Check size={17} />
                {loading ? "生成中..." : "确认并生成练习"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MaterialPicker({
  materials,
  selectedIds,
  showUpload,
  onSelect,
  onToggleUpload,
  onUploaded,
  onStatus,
}: {
  materials: Material[];
  selectedIds: string[];
  showUpload: boolean;
  onSelect: (id: string) => void;
  onToggleUpload: () => void;
  onUploaded: (material: Material) => void;
  onStatus: (message: string | null) => void;
}) {
  return (
    <div className="border-[2px] border-[#213044] rounded-2xl bg-[#fff9ea] p-4 shadow-[3px_3px_0_rgba(33,48,68,0.5)]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <div className="font-black text-[#213044] flex items-center gap-2">
            <BookOpen size={18} />
            选择本次教材
          </div>
          <p className="text-xs font-bold text-[#6c7480] mt-1">
            选中教材后，输入“第 1 单元”会优先按这份教材拆解。
          </p>
        </div>
        <button
          onClick={onToggleUpload}
          className="border-[2px] border-[#213044] rounded-xl px-4 py-2 bg-white text-[#213044] font-black shadow-[2px_2px_0_#213044] inline-flex items-center justify-center gap-2 text-sm"
        >
          <FileUp size={16} />
          上传新教材
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {materials.map((material) => {
          const active = selectedIds.includes(material.id);
          return (
            <button
              key={material.id}
              onClick={() => onSelect(material.id)}
              className={[
                "border-[3px] rounded-2xl p-4 text-left shadow-[3px_3px_0_#213044] transition-all",
                active
                  ? "border-[#213044] bg-[#dff5e3] -translate-y-0.5"
                  : "border-[#213044] bg-white hover:-translate-y-0.5",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-black text-[#213044]">{material.label}</div>
                {active && <CheckCircle2 size={18} className="text-[#1f9d67] shrink-0" />}
              </div>
              <div className="text-[11px] font-bold text-[#6c7480] mt-2 line-clamp-2">
                别名：{material.aliases?.join(" / ") || "无"}
              </div>
            </button>
          );
        })}
      </div>

      {showUpload && (
        <MaterialUploadPanel onUploaded={onUploaded} onStatus={onStatus} />
      )}
    </div>
  );
}

function useGenerationProgress({
  analyzing,
  loading,
  analysisReport,
  generationStatus,
}: {
  analyzing: boolean;
  loading: boolean;
  analysisReport?: any;
  generationStatus?: string | null;
}) {
  return useMemo(() => {
    const steps = ["拆解老师要求", "读取教材知识库", "确认知识点", "规划题目", "生成练习", "质量检查"];
    let index = 0;
    if (analysisReport) index = 2;
    if (loading) index = generationStatus?.includes("质量") ? 5 : 4;
    if (analyzing) index = 1;
    return {
      steps,
      index,
      percent: Math.round(((index + 1) / steps.length) * 100),
      label: generationStatus || steps[index],
    };
  }, [analyzing, loading, analysisReport, generationStatus]);
}

function ProgressPanel({ progress, loading }: { progress: { steps: string[]; index: number; percent: number; label: string }; loading: boolean }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#ddd8cf] bg-white px-5 py-5 shadow-sm">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-x-3 gap-y-4">
        {progress.steps.map((step, idx) => {
          const done = idx < progress.index;
          const current = idx === progress.index;
          return (
            <div key={step} className="relative flex flex-col items-center text-center">
              {idx < progress.steps.length - 1 && (
                <div className="hidden md:block absolute left-[62%] right-[-38%] top-[19px] h-px bg-[#ddd8cf]" />
              )}
              <div
                className={[
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black transition-colors",
                  done
                    ? "border-[#e8f1df] bg-[#e8f1df] text-[#2d6b32]"
                    : current
                      ? "border-[#5b83d1] bg-[#dce9ff] text-[#2f61bd]"
                      : "border-[#dedede] bg-white text-[#8b8b8b]",
                ].join(" ")}
              >
                {done ? <Check size={18} strokeWidth={2.5} /> : idx + 1}
              </div>
              <div
                className={[
                  "mt-2 text-sm font-bold leading-snug",
                  current ? "text-[#171717]" : done ? "text-[#4d5b46]" : "text-[#8b8b8b]",
                ].join(" ")}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>
      {loading && progress.index >= 4 && (
        <p className="mt-4 rounded-xl bg-[#f7f5ef] px-4 py-3 text-sm font-bold text-[#6c7480] leading-relaxed">
          正在生成练习并进行质量检查，题量较多时会稍久。页面没有卡住，完成后会进入预览。
        </p>
      )}
    </div>
  );
}

function MaterialUploadPanel({
  onUploaded,
  onStatus,
}: {
  onUploaded: (material: Material) => void;
  onStatus: (message: string | null) => void;
}) {
  const [label, setLabel] = useState("");
  const [aliases, setAliases] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file || uploading) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isMarkdown = file.name.toLowerCase().endsWith(".md") || /markdown|text\/plain/.test(file.type);
    if (!isPdf && !isMarkdown) {
      onStatus("请上传 PDF 或 Markdown 教材文件。");
      return;
    }
    const materialLabel = label.trim() || file.name.replace(/\.(md|pdf)$/i, "");
    const aliasList = aliases
      .split(/[,，、\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    setUploading(true);
    onStatus(isPdf ? "正在转换 PDF 为知识库，请稍等..." : "正在上传教材...");
    try {
      const body = isPdf
        ? {
            label: materialLabel,
            aliases: aliasList,
            filename: file.name,
            content_type: file.type || "application/pdf",
            pdf_base64: await fileToBase64(file),
          }
        : {
            label: materialLabel,
            aliases: aliasList,
            filename: file.name,
            content: await file.text(),
          };
      const resp = await fetch("/api/materials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || `Upload failed: ${resp.status}`);
      const conversionText = data.conversion?.page_count ? `，已转换 ${data.conversion.page_count} 页` : "";
      onStatus(`已添加教材：${data.material.label}${conversionText}`);
      onUploaded(data.material);
      setLabel("");
      setAliases("");
    } catch (error: any) {
      onStatus(error.message || "教材上传失败。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border-[2px] border-[#213044] bg-white p-4">
      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 md:items-end">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="border border-[#e7dcc4] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#213044]"
          placeholder="教材名称，例如：剑桥少儿英语"
        />
        <input
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          className="border border-[#e7dcc4] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#213044]"
          placeholder="别名，用逗号分隔，例如：剑桥, Cambridge"
        />
        <label className="border-[3px] border-[#213044] rounded-xl px-4 py-2.5 bg-[#fff1bf] text-[#213044] font-black shadow-[3px_3px_0_#213044] hover:-translate-y-0.5 transition-transform cursor-pointer text-sm inline-flex items-center justify-center gap-2">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          {uploading ? "处理中..." : "选择 PDF / MD"}
          <input
            type="file"
            accept=".pdf,.md,application/pdf,text/markdown,text/plain"
            disabled={uploading}
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() || "" : value);
    };
    reader.onerror = () => reject(reader.error || new Error("文件读取失败。"));
    reader.readAsDataURL(file);
  });
}

function HomeworkAnalysisPanel({ analysis, onChange }: { analysis: any; onChange: (analysis: any) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const visibleWarnings = list(analysis.warnings).filter(isUsefulAnalysisWarning);
  const displayAnalysis = useMemo(() => ({
    ...analysis,
    source_refs: humanScopeItems(analysis),
  }), [analysis]);
  const primaryGroups = [
    { key: "source_refs", title: "范围", hint: "本次要复习的教材和单元", placeholder: "添加范围，例如：Big Fun 2 Unit 1" },
    { key: "target_words", title: "单词", hint: "孩子需要覆盖的目标词", placeholder: "添加单词" },
    { key: "sentence_patterns", title: "句子", hint: "课本故事、chant 或需要练的表达", placeholder: "添加句子" },
    { key: "grammar_points", title: "语法 / 课本规则", hint: "课本规则、句型规则、语法点", placeholder: "添加语法" },
  ];

  const updateItem = (key: string, id: string, patch: any) => {
    if (key === "source_refs" && String(id).startsWith("scope:")) {
      const nextItems = list(analysis.source_refs).map((item: any) => ({ ...item, ...patch }));
      onChange({ ...analysis, source_refs: nextItems });
      return;
    }
    const nextItems = list(analysis[key]).map((item: any) =>
      item.id === id ? { ...item, ...patch } : item
    );
    onChange({ ...analysis, [key]: nextItems });
  };

  const addItem = (key: string) => {
    const value = (drafts[key] || "").trim();
    if (!value) return;
    const nextItem = {
      id: `parent_added:${key}:${Date.now()}`,
      value,
      label: value,
      source: "parent_added",
      source_label: "家长添加",
      selected: true,
      required: true,
      status: "required",
      note: "家长手动添加",
    };
    onChange({ ...analysis, [key]: [...list(analysis[key]), nextItem] });
    setDrafts({ ...drafts, [key]: "" });
  };

  const renderGroup = (group: { key: string; title: string; hint: string; placeholder?: string }, index: number) => {
    const items = list(displayAnalysis[group.key]);
    const selectedCount = items.filter((item: any) => item.selected !== false).length;
    const previewLimit = group.key === "source_refs" ? 3 : group.key === "target_words" ? 4 : 1;
    const shownItems = expanded[group.key] ? items : items.slice(0, previewLimit);
    const hiddenCount = Math.max(0, items.length - shownItems.length);

    return (
      <div key={group.key} className={index === 0 ? "pt-0" : "border-t border-[#ded8cf] pt-5"}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black text-[#151515]">{group.title}</div>
            <div className="mt-1 text-sm font-bold text-[#77736a]">{group.hint}</div>
          </div>
          <div className="text-sm font-black text-[#77736a]">{selectedCount}/{items.length}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {shownItems.map((item: any) => (
            <button
              type="button"
              key={item.id || item.value}
              onClick={() => updateItem(group.key, item.id, { selected: item.selected === false })}
              className={[
                "inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors",
                item.selected === false
                  ? "bg-[#f7f5ef] text-[#8a8478] line-through"
                  : "bg-[#f4f2ed] text-[#151515]",
              ].join(" ")}
              title="点击取消或恢复"
            >
              <BookOpen size={14} className="shrink-0 text-[#5f5a51]" />
              <span className="truncate">{item.label || item.value}</span>
              <X size={14} className="shrink-0 text-[#77736a]" />
            </button>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded({ ...expanded, [group.key]: true })}
              className="rounded-xl bg-[#f4f2ed] px-3 py-2 text-sm font-black text-[#77736a]"
            >
              +{hiddenCount} 更多
            </button>
          )}
          {expanded[group.key] && items.length > previewLimit && (
            <button
              type="button"
              onClick={() => setExpanded({ ...expanded, [group.key]: false })}
              className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#77736a] ring-1 ring-[#ded8cf]"
            >
              收起
            </button>
          )}
        </div>
        {(group.key === "source_refs" || group.key === "target_words") && (
          <div className="mt-4 flex gap-3">
            <input
              value={drafts[group.key] || ""}
              onChange={(event) => setDrafts({ ...drafts, [group.key]: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") addItem(group.key);
              }}
              className="min-w-0 flex-1 rounded-xl border border-[#d8d5ce] bg-white px-4 py-3 text-sm font-bold text-[#151515] placeholder:text-[#aaa49a] focus:outline-none focus:ring-2 focus:ring-[#d7e6ff]"
              placeholder={group.placeholder || `添加${group.title}`}
            />
            <button
              onClick={() => addItem(group.key)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#c8c4bd] bg-white px-5 py-3 text-sm font-black text-[#151515] hover:bg-[#f7f5ef]"
            >
              <Plus size={16} />
              添加
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mt-5 rounded-xl bg-[#dbe8fa] px-6 py-5 text-[#385c9a]">
        <div className="flex gap-3">
          <Info size={22} className="mt-0.5 shrink-0" />
          <div>
            <div className="text-base font-black">老师这次写得比较简略</div>
            <p className="mt-2 text-base font-bold leading-relaxed text-[#3d4148]">
              老师原文比较简短，系统会结合已选择教材补齐单词、句型和语法；家长可以在下面增删确认。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[#ddd8cf] bg-white px-7 py-7 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-black text-[#111]">作业拆解确认</div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold text-[#77736a]">
              <span>来自老师原文</span>
              <span>教材库自动补全</span>
            </div>
          </div>
          <span className="rounded-xl border border-[#c8c4bd] bg-white px-4 py-2 text-sm font-black text-[#151515]">
            {String(analysis.mode || "").includes("ai") ? "AI + 知识库" : "知识库拆解"}
          </span>
        </div>

        <div className="space-y-5">{primaryGroups.map(renderGroup)}</div>

        {visibleWarnings.length > 0 && (
          <div className="mt-5 rounded-xl bg-[#fff1bf] px-4 py-3 text-sm font-bold text-[#8a6100]">
            {visibleWarnings.slice(0, 3).join(" / ")}
          </div>
        )}
      </div>
    </>
  );
}

function CoveragePanel({ report }: { report: any }) {
  const checks = report.checks || {};
  const rows = [
    ["Unit 词汇", checks.unit_vocabulary],
    ["教材 p38", checks.page_38],
    ["教材 p41", checks.page_41],
    ["How much / How many", checks.patterns],
    ["可数 / 不可数", checks.countable_uncountable],
    ["11 题型", report.question_types],
  ].filter(([, check]) => check);
  const overall = report.overall || "UNKNOWN";

  return (
    <div className="mt-4 border-[2px] border-[#213044] rounded-2xl bg-[#fff9ea] p-4 shadow-[3px_3px_0_rgba(33,48,68,0.5)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-black text-[#213044]">覆盖检查</div>
        <span
          className={[
            "px-3 py-1 rounded-full border-[2px] border-[#213044] text-xs font-black",
            overall === "PASS" ? "bg-[#dff5e3] text-[#145f3e]" : "bg-[#ffe5e5] text-[#8a1515]",
          ].join(" ")}
        >
          {overall}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {rows.map(([label, check]: any[]) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-[#e7dcc4] px-3 py-2 text-xs font-bold">
            <span className="text-[#213044]">{label}</span>
            <span className={check.status === "PASS" ? "text-[#1f9d67]" : "text-[#e04b4b]"}>
              {coverageText(check)}
            </span>
          </div>
        ))}
      </div>
      {Array.isArray(report.missing) && report.missing.length > 0 && (
        <div className="mt-3 text-xs font-bold text-[#8a1515]">
          需要修复：{report.missing.slice(0, 4).join(" / ")}
        </div>
      )}
    </div>
  );
}

function coverageText(check: any) {
  if (!check) return "UNKNOWN";
  if (typeof check.covered === "number" && typeof check.total === "number") {
    return `${check.covered}/${check.total} ${check.status}`;
  }
  if (check.counts) return check.status;
  return check.status || "UNKNOWN";
}

function humanScopeItems(analysis: any) {
  const items: any[] = [];
  const materialLabel = String(analysis?.material_context?.selected_material_label || "");
  const hasTextbook = /big\s*fun|opw2|课本|教材/i.test(materialLabel)
    || list(analysis?.source_refs).some((item: any) => /big\s*fun|opw2|课本|教材/i.test(String(item.value || item.label || item.id || "")));
  const hasPhonics = /phonics|自然拼读|自拼/i.test(materialLabel)
    || list(analysis?.source_refs).some((item: any) => /phonics|自然拼读|自拼/i.test(String(item.value || item.label || item.id || "")));
  const units = uniqueNumbers(analysis?.requested_units || analysis?.requirements?.requested_units || []);
  const phonicsUnits = uniqueNumbers(analysis?.requested_phonics_units || analysis?.requirements?.requested_phonics_units || []);
  const pages = uniqueNumbers(analysis?.requested_pages || analysis?.requirements?.requested_pages || []);

  if (hasTextbook && units.length) {
    items.push(scopeItem("scope:opw2:units", `Big Fun 2 课本 - ${formatUnits(units)}`));
  } else if (hasTextbook) {
    items.push(scopeItem("scope:opw2", "Big Fun 2 课本"));
  }

  if (hasPhonics && phonicsUnits.length) {
    items.push(scopeItem("scope:phonics:units", `Oxford 自然拼读 - ${formatUnits(phonicsUnits)}`));
  } else if (hasPhonics) {
    items.push(scopeItem("scope:phonics", "Oxford 自然拼读"));
  }

  if (pages.length) {
    items.push(scopeItem("scope:pages", `教材页 ${pages.map((page) => `p${page}`).join("、")}`));
  }

  list(analysis?.source_refs)
    .filter((item: any) => item?.source === "custom_material" || String(item?.id || "").startsWith("source:custom:") || item?.source === "parent_added")
    .forEach((item: any) => {
      const label = String(item.label || item.value || "").trim();
      if (label) items.push({ ...item, label, value: label });
    });

  return dedupeByLabel(items.length ? items : list(analysis?.source_refs).filter((item: any) => item?.source === "parent_added"));
}

function scopeItem(id: string, label: string) {
  return {
    id,
    value: label,
    label,
    source: "scope_summary",
    selected: true,
    required: true,
    status: "required",
  };
}

function uniqueNumbers(values: any[]) {
  return [...new Set(list(values).map((value) => Number(value)).filter(Number.isFinite))].sort((a, b) => a - b);
}

function formatUnits(units: number[]) {
  if (units.length > 1 && units.every((unit, index) => index === 0 || unit === units[index - 1] + 1)) {
    return `Unit ${units[0]}-${units[units.length - 1]}`;
  }
  return units.map((unit) => `Unit ${unit}`).join("、");
}

function dedupeByLabel(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.label || item.value || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isUsefulAnalysisWarning(warning: any) {
  const text = String(warning || "").trim();
  if (!text) return false;
  return !/ai analysis fallback|no new words|known word|known words|teacher text|chinese instruction|not english|no target|no matching|no eligible|cannot.*extract|phonics scope|phonics list|scope .*not provided|did not infer|supplied scope|beyond .*scope|no .*beyond/i.test(text);
}

function list(value: any) {
  return Array.isArray(value) ? value : [];
}
