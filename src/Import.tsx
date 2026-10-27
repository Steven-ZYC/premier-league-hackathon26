import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileJson,
  FileText,
  LoaderCircle,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { EventType, Match, MatchEvent, Team } from "../shared/types";
import { eventLabels, normalizeEvents } from "../shared/engine";
import { parseText, validateMatch, versionMatch } from "../shared/parser";
import { useT } from "./i18n";

interface Props {
  onSave: (match: Match) => void;
  onCancel: () => void;
  initialMatch?: Match;
}
const LIMIT = 1024 * 1024;
const SAMPLE = `0′ 主队开球
8′ 客队射门偏出
12′ 主队前锋进球
19′ 主队获得角球
27′ 客队射门被门将扑出
38′ 客队进球，扳平比分
45+2′ 主队射门被封堵
45+3′ 半场结束
下半场
46′ 客队开球
59′ 主队获得角球
63′ 主队射门偏出
67′ 主队前锋在禁区内射门，被门将扑出
90+3′ 全场结束`;
const englishLabels: Record<EventType, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  shot_on_target: "Shot on target",
  shot_off_target: "Shot off target",
  shot_blocked: "Blocked shot",
  save: "Save",
  corner: "Corner",
  yellow_card: "Yellow card",
  red_card: "Red card",
  penalty_awarded: "Penalty awarded",
  penalty_missed: "Penalty missed",
  var_cancel_goal: "VAR: goal cancelled",
  substitution: "Substitution",
  foul: "Foul",
  unknown: "Unknown",
  kickoff: "Kick-off",
  halftime: "Half-time",
  fulltime: "Full-time",
};
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function extraData(match?: Match) {
  if (!match || (!match.finalStats && !match.snapshots && !match.missingRanges))
    return "";
  return JSON.stringify(
    {
      ...(match.finalStats ? { finalStats: match.finalStats } : {}),
      ...(match.snapshots ? { snapshots: match.snapshots } : {}),
      ...(match.missingRanges ? { missingRanges: match.missingRanges } : {}),
    },
    null,
    2,
  );
}
function newTeam(name: string, color: string, existing?: Team): Team {
  return existing?.name === name
    ? existing
    : { name, short: name.replace(/\s/g, "").slice(0, 3), color };
}
export default function ImportPanel({ onSave, onCancel, initialMatch }: Props) {
  const t = useT(),
    fileInput = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState<Match | undefined>(initialMatch);
  const [title, setTitle] = useState(initialMatch?.title || "");
  const [competition, setCompetition] = useState(
    initialMatch?.competition || "",
  );
  const [date, setDate] = useState(initialMatch?.date || today());
  const [home, setHome] = useState(initialMatch?.home.name || "");
  const [away, setAway] = useState(initialMatch?.away.name || "");
  const [source, setSource] = useState(initialMatch?.source || "");
  const [coverage, setCoverage] = useState<Match["coverage"]>(
    initialMatch?.coverage || "excerpt",
  );
  const [raw, setRaw] = useState(initialMatch?.rawInput || "");
  const [extras, setExtras] = useState(extraData(initialMatch));
  const [events, setEvents] = useState<MatchEvent[]>(
    initialMatch?.events.map((e) => ({ ...e })) || [],
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [needsReparse, setNeedsReparse] = useState(false);
  const updateEvent = (index: number, change: Partial<MatchEvent>) =>
    setEvents((old) =>
      old.map((e, i) => (i === index ? { ...e, ...change } : e)),
    );
  const metadataValid = () => {
    if (!home.trim() || !away.trim())
      throw new Error(
        t("请先填写主队和客队名称。", "Enter both team names first."),
      );
    if (home.trim().toLowerCase() === away.trim().toLowerCase())
      throw new Error(t("主队和客队名称不能相同。", "Team names must differ."));
  };
  const parse = async (useAI = false) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      metadataValid();
      if (!raw.trim())
        throw new Error(
          t(
            "请粘贴赛况，或上传 TXT / JSON 文件。",
            "Paste commentary or upload a TXT / JSON file.",
          ),
        );
      if (raw.length > 200000)
        throw new Error(
          t(
            "文本最多支持 200,000 字符。",
            "Text is limited to 200,000 characters.",
          ),
        );
      let parsed: MatchEvent[];
      if (useAI) {
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw,
            home: home.trim(),
            away: away.trim(),
            useAI: true,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (response.status === 401 || response.status === 403)
          throw new Error(
            t(
              "AI 解析需要登录。请使用页面右上角的 GitHub 登录后重试。",
              "Sign in with GitHub to use AI parsing.",
            ),
          );
        const data = (await response.json().catch(() => null)) as {
          events?: unknown;
          message?: string;
          error?: string | { message?: string };
        } | null;
        if (!response.ok) {
          const detail =
            typeof data?.error === "string" ? data.error : data?.error?.message;
          throw new Error(
            data?.message ||
              detail ||
              t(
                "AI 暂不可用；可使用规则解析继续导入。",
                "AI is unavailable. Use rule parsing to continue.",
              ),
          );
        }
        if (!Array.isArray(data?.events))
          throw new Error(
            t(
              "AI 返回的事件格式无效，请使用规则解析。",
              "Invalid AI event data. Use rule parsing.",
            ),
          );
        parsed = validateMatch({
          home: newTeam(home, "#e64e56"),
          away: newTeam(away, "#9eaaff"),
          date,
          events: data.events,
        }).events;
      } else parsed = parseText(raw, home.trim(), away.trim());
      setEvents(parsed);
      setAiUsed(useAI);
      setNeedsReparse(false);
      setNotice(
        t(
          `已识别 ${parsed.length} 条事件，请核对后保存。`,
          `${parsed.length} events found. Review them before saving.`,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("解析失败，请重试。", "Parsing failed. Try again."),
      );
    } finally {
      setBusy(false);
    }
  };
  const loadFile = async (file: File) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (!/\.(txt|json)$/i.test(file.name))
        throw new Error(
          t(
            "仅支持 UTF-8 编码的 .txt 和 .json 文件。",
            "Only UTF-8 .txt and .json files are supported.",
          ),
        );
      if (file.size > LIMIT)
        throw new Error(
          t("文件不能超过 1 MB。", "File must be no larger than 1 MB."),
        );
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true })
          .decode(await file.arrayBuffer())
          .replace(/^\uFEFF/, "");
      } catch {
        throw new Error(
          t(
            "文件不是有效 UTF-8 文本，请转换编码后重试。",
            "File is not valid UTF-8. Convert its encoding and retry.",
          ),
        );
      }
      if (/\.json$/i.test(file.name)) {
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          throw new Error(
            t(
              "JSON 语法无效，请检查文件。",
              "Invalid JSON syntax. Check your file.",
            ),
          );
        }
        const match = validateMatch(value);
        setBase(match);
        setTitle(match.title);
        setCompetition(match.competition);
        setDate(match.date);
        setHome(match.home.name);
        setAway(match.away.name);
        setSource(match.source);
        setCoverage(match.coverage);
        setRaw(match.rawInput);
        setEvents(match.events);
        setExtras(extraData(match));
        setNeedsReparse(false);
        setAiUsed(false);
        setNotice(
          t(
            `已读取 ${file.name}，请核对 ${match.events.length} 条事件后保存。`,
            `${file.name} loaded. Review ${match.events.length} events before saving.`,
          ),
        );
      } else {
        if (text.length > 200000)
          throw new Error(
            t(
              "文本最多支持 200,000 字符。",
              "Text is limited to 200,000 characters.",
            ),
          );
        setRaw(text);
        setNeedsReparse(true);
        setEvents([]);
        setAiUsed(false);
        setNotice(
          t(
            `已读取 ${file.name}，填写球队名称后点击「解析并预览事件」。`,
            `${file.name} loaded. Enter teams and select Parse & preview.`,
          ),
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("文件读取失败。", "Unable to read file."),
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const save = () => {
    setError("");
    setNotice("");
    try {
      metadataValid();
      if (needsReparse)
        throw new Error(
          t(
            "原始赛况已改变，请重新解析后再保存。",
            "Commentary changed. Parse it again before saving.",
          ),
        );
      if (!events.some((e) => e.confirmed && e.type !== "unknown"))
        throw new Error(
          t(
            "请至少核对并确认一条可识别事件。",
            "Confirm at least one recognized event.",
          ),
        );
      let extra: Record<string, unknown> = {};
      if (extras.trim()) {
        const value = JSON.parse(extras) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error(
            t(
              "补充数据需要一个 JSON 对象。",
              "Additional data must be a JSON object.",
            ),
          );
        const obj = value as Record<string, unknown>;
        extra = {
          ...(obj.finalStats !== undefined
            ? { finalStats: obj.finalStats }
            : {}),
          ...(obj.snapshots !== undefined ? { snapshots: obj.snapshots } : {}),
          ...(obj.missingRanges !== undefined
            ? { missingRanges: obj.missingRanges }
            : {}),
        };
      }
      const normalized = normalizeEvents(
        events.map((e, i) => ({
          ...e,
          order: i,
          confirmed: e.type === "unknown" ? false : e.confirmed,
        })),
      );
      const match = validateMatch({
        id: initialMatch?.id || crypto.randomUUID(),
        title: title.trim() || `${home.trim()} vs ${away.trim()}`,
        competition:
          competition.trim() || t("自定义赛事", "Custom competition"),
        date,
        home: newTeam(home.trim(), "#e64e56", base?.home),
        away: newTeam(away.trim(), "#a5afff", base?.away),
        coverage,
        source: source.trim() || t("个人导入", "Personal import"),
        rawInput: raw,
        events: normalized,
        ...extra,
      });
      match.version = versionMatch(match);
      onSave(match);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? t(
              "补充数据 JSON 语法错误，请检查括号与逗号。",
              "Invalid additional-data JSON. Check brackets and commas.",
            )
          : e instanceof Error
            ? e.message
            : t("保存失败，请重试。", "Save failed. Try again."),
      );
    }
  };
  const warnings = events.filter(
    (e) => !e.confirmed || e.type === "unknown" || e.warnings?.length,
  ).length;
  return (
    <div className="import-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR MATCH, YOUR STORY</span>
          <h1>
            {t(
              initialMatch ? "核对比赛数据" : "把你的赛况，导入这里",
              initialMatch ? "Review match data" : "Bring your match to life",
            )}
            <span className="brand-dot">.</span>
          </h1>
          <p>
            {t(
              "粘贴文字或上传文件，核对事件后开始双模式复盘。",
              "Paste or upload commentary, review events, and start your replay.",
            )}
          </p>
        </div>
        <button className="btn" onClick={onCancel}>
          <X size={16} />
          {t("返回比赛大厅", "Back to matches")}
        </button>
      </div>
      <div className="import-steps">
        <span className={!events.length ? "active" : ""}>
          <b>01</b>
          {t("粘贴或上传", "Paste or upload")}
        </span>
        <ArrowRight size={16} />
        <span className={events.length ? "active" : ""}>
          <b>02</b>
          {t("核对事件", "Review events")}
        </span>
        <ArrowRight size={16} />
        <span>
          <b>03</b>
          {t("生成复盘", "Start replay")}
        </span>
      </div>
      <section className="panel import-metadata">
        <div className="section-heading">
          <h2>{t("比赛信息", "Match details")}</h2>
          <span className="tag">
            {t("保存在当前浏览器", "Saved in this browser")}
          </span>
        </div>
        <div className="form-grid">
          <label>
            {t("比赛名称", "Match title")}
            <input
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("例如：周末焦点战", "e.g. Weekend spotlight")}
            />
          </label>
          <label>
            {t("赛事", "Competition")}
            <input
              value={competition}
              maxLength={100}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder={t("例如：英超", "e.g. Premier League")}
            />
          </label>
          <label>
            {t("比赛日期", "Match date")}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            {t("主队名称 *", "Home team *")}
            <input
              value={home}
              maxLength={80}
              onChange={(e) => {
                setHome(e.target.value);
                if (events.length) setNeedsReparse(true);
              }}
              placeholder={t("例如：曼联", "e.g. Manchester United")}
              required
            />
          </label>
          <label>
            {t("客队名称 *", "Away team *")}
            <input
              value={away}
              maxLength={80}
              onChange={(e) => {
                setAway(e.target.value);
                if (events.length) setNeedsReparse(true);
              }}
              placeholder={t("例如：热刺", "e.g. Tottenham Hotspur")}
              required
            />
          </label>
          <label>
            {t("数据来源", "Data source")}
            <input
              value={source}
              maxLength={500}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t(
                "来源名称或网址（可选）",
                "Source name or URL (optional)",
              )}
            />
          </label>
          <label>
            {t("数据覆盖范围", "Coverage")}
            <select
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as Match["coverage"])}
            >
              <option value="excerpt">
                {t("节选：仅记录部分事件", "Excerpt: selected events")}
              </option>
              <option value="complete">
                {t("完整：包含整场事件", "Complete: full match")}
              </option>
              <option value="unknown">
                {t("覆盖范围未知", "Unknown coverage")}
              </option>
            </select>
          </label>
        </div>
      </section>
      <section className="panel import-input">
        <div className="import-input-grid">
          <div>
            <div className="section-heading">
              <h2>
                <FileText size={20} />
                {t("粘贴文字赛况", "Paste commentary")}
              </h2>
              <button
                className="text-button"
                onClick={() => {
                  setRaw(SAMPLE);
                  setHome(home || "曼联");
                  setAway(away || "热刺");
                  setTitle(title || t("我的演示比赛", "My demo match"));
                  setSource(t("虚构格式示例", "Fictional format example"));
                  setCoverage("excerpt");
                  setNeedsReparse(true);
                  setNotice(
                    t(
                      "已填入虚构格式示例，请解析并核对。",
                      "Fictional sample inserted. Parse and review it.",
                    ),
                  );
                  setError("");
                }}
              >
                {t("填入格式示例", "Use example")}
              </button>
            </div>
            <textarea
              className="commentary-input"
              rows={10}
              value={raw}
              maxLength={200000}
              onChange={(e) => {
                setRaw(e.target.value);
                setNeedsReparse(true);
              }}
              placeholder={t(
                "12′ 主队进球\n38′ 客队扳平比分\n67′ 主队射门被扑出",
                "12′ Home goal\n38′ Away scores\n67′ Home shot saved",
              )}
              aria-label={t("原始文字赛况", "Original match commentary")}
            />
            <small>
              {t(
                "每行一条事件，使用 45+2 / 90+5 表示补时；球队不明确时保留为待核对。",
                "One event per line. Use 45+2 / 90+5 for added time. Unclear teams stay unconfirmed.",
              )}
            </small>
          </div>
          <div>
            <div className="section-heading">
              <h2>
                <Upload size={20} />
                {t("上传文件", "Upload file")}
              </h2>
              <span className="tag">TXT / JSON</span>
            </div>
            <div
              className={`file-drop ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length === 1)
                  void loadFile(e.dataTransfer.files[0]);
                else
                  setError(
                    t("请一次上传一个文件。", "Upload one file at a time."),
                  );
              }}
            >
              <FileJson size={42} />
              <h3>{t("拖入 TXT / JSON 文件", "Drop a TXT / JSON file")}</h3>
              <p>{t("支持 UTF-8 · 最大 1 MB", "UTF-8 · up to 1 MB")}</p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <Plus size={16} />
                {t("选择文件", "Choose file")}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".txt,.json,text/plain,application/json"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) void loadFile(e.target.files[0]);
                }}
              />
            </div>
            <p className="muted small">
              {t(
                "JSON 可直接导入本站导出的完整比赛。上传内容仅作为赛况数据处理。",
                "JSON accepts full matches exported by PitchPulse. Uploaded text is treated only as match data.",
              )}
            </p>
          </div>
        </div>
        <div className="import-actions">
          <button
            className="btn primary"
            onClick={() => void parse()}
            disabled={busy || !raw.trim()}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <FileText size={17} />
            )}{" "}
            {t("解析并预览事件", "Parse & preview")}
            <ArrowRight size={17} />
          </button>
          <button
            className="btn"
            onClick={() => void parse(true)}
            disabled={busy || !raw.trim()}
          >
            <Sparkles size={16} />
            {t("使用 AI 解析", "Parse with AI")}
          </button>
          <small>
            {t(
              "规则解析无需密钥；AI 解析需要登录并配置 DeepSeek。",
              "Rules work without a key. AI requires sign-in and a configured DeepSeek key.",
            )}
          </small>
        </div>
      </section>
      <details className="panel import-advanced">
        <summary>
          {t(
            "补充终场统计、逐时快照与缺失区间（可选）",
            "Add final stats, snapshots and missing intervals (optional)",
          )}
          <ChevronDown size={16} />
        </summary>
        <div>
          <p className="small muted">
            {t(
              "仅填写真实提供的数字。终场统计不会在早期回放中显示；快照 cursor 为从 0 开始的事件位置。可使用 finalStats、snapshots、missingRanges 三个字段。",
              "Use only supplied figures. Final stats stay hidden during early replay. Snapshot cursor is a zero-based event index. Allowed fields: finalStats, snapshots, missingRanges.",
            )}
          </p>
          <textarea
            rows={7}
            value={extras}
            onChange={(e) => setExtras(e.target.value)}
            aria-label={t("补充统计 JSON", "Additional statistics JSON")}
            placeholder={
              '{\n  "finalStats": {"home": {"shots": 12}, "away": {"shots": 7}},\n  "snapshots": [{"cursor": 3, "home": {"passes": 30}, "away": {"passes": 25}}],\n  "missingRanges": [{"from": 20, "to": 25}]\n}'
            }
          />
        </div>
      </details>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="import-notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!!events.length && (
        <section className="panel event-preview">
          <div className="section-heading">
            <div>
              <h2>
                {t("核对事件", "Review events")}{" "}
                <span className="tag purple">{events.length}</span>
              </h2>
              <p className="small muted">
                {t(
                  `共 ${warnings} 条需要核对。勾选「确认」的已知事件才会参与计算；未知事件仍会保存。`,
                  `${warnings} events need review. Only confirmed, recognized events affect calculations; unknown records are preserved.`,
                )}
              </p>
            </div>
            <span className="tag">
              {aiUsed
                ? t("AI 解析 · 待核对", "AI parsed · review required")
                : t("规则解析", "Rule parsing")}
            </span>
          </div>
          {needsReparse && (
            <p className="error">
              {t(
                "赛况或球队名称已修改，请重新解析。",
                "Commentary or teams changed. Parse again.",
              )}
            </p>
          )}
          <div className="preview-table-wrap" style={{ overflowX: "auto" }}>
            <table className="preview-table">
              <thead>
                <tr>
                  <th>{t("确认", "Confirm")}</th>
                  <th>{t("分钟 / 阶段", "Time / half")}</th>
                  <th>{t("球队 / 球员", "Team / player")}</th>
                  <th>{t("事件 / 关联", "Event / relation")}</th>
                  <th>{t("原始赛况", "Original record")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={event.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={event.confirmed && event.type !== "unknown"}
                        disabled={event.type === "unknown"}
                        aria-label={t(
                          `确认事件 ${index + 1}`,
                          `Confirm event ${index + 1}`,
                        )}
                        onChange={(e) =>
                          updateEvent(index, { confirmed: e.target.checked })
                        }
                      />
                      <small className="muted">#{index + 1}</small>
                    </td>
                    <td>
                      <input
                        aria-label={t(
                          `事件 ${index + 1} 分钟`,
                          `Event ${index + 1} minute`,
                        )}
                        value={event.displayTime}
                        maxLength={8}
                        onChange={(e) =>
                          updateEvent(index, { displayTime: e.target.value })
                        }
                        style={{ width: 85 }}
                      />
                      <select
                        aria-label={t(
                          `事件 ${index + 1} 阶段`,
                          `Event ${index + 1} half`,
                        )}
                        value={event.period}
                        onChange={(e) =>
                          updateEvent(index, {
                            period: Number(e.target.value) as 1 | 2,
                          })
                        }
                      >
                        <option value={1}>{t("上半场", "1st half")}</option>
                        <option value={2}>{t("下半场", "2nd half")}</option>
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={t(
                          `事件 ${index + 1} 球队`,
                          `Event ${index + 1} team`,
                        )}
                        value={event.team}
                        onChange={(e) =>
                          updateEvent(index, {
                            team: e.target.value as MatchEvent["team"],
                          })
                        }
                      >
                        <option value="home">
                          {home || t("主队", "Home")}
                        </option>
                        <option value="away">
                          {away || t("客队", "Away")}
                        </option>
                        <option value="unknown">
                          {t("待核对 / 无球队", "Unclear / no team")}
                        </option>
                      </select>
                      <input
                        aria-label={t(
                          `事件 ${index + 1} 球员`,
                          `Event ${index + 1} player`,
                        )}
                        value={event.player || ""}
                        maxLength={100}
                        onChange={(e) =>
                          updateEvent(index, {
                            player: e.target.value || undefined,
                          })
                        }
                        placeholder={t("球员（可选）", "Player (optional)")}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={t(
                          `事件 ${index + 1} 类型`,
                          `Event ${index + 1} type`,
                        )}
                        value={event.type}
                        onChange={(e) => {
                          const type = e.target.value as EventType;
                          updateEvent(index, {
                            type,
                            ...(type === "unknown" ? { confirmed: false } : {}),
                          });
                        }}
                      >
                        {(Object.keys(eventLabels) as EventType[]).map(
                          (type) => (
                            <option key={type} value={type}>
                              {t(eventLabels[type], englishLabels[type])}
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        aria-label={t(
                          `事件 ${index + 1} 关联`,
                          `Event ${index + 1} relation`,
                        )}
                        value={event.relatedEventId || ""}
                        onChange={(e) =>
                          updateEvent(index, {
                            relatedEventId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">
                          {t("独立事件", "Independent event")}
                        </option>
                        {events.slice(0, index).map((e, i) => (
                          <option key={e.id} value={e.id}>
                            #{i + 1} · {e.displayTime}′ ·{" "}
                            {t(eventLabels[e.type], englishLabels[e.type])}
                          </option>
                        ))}
                      </select>
                      <small className="muted">{event.id}</small>
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={event.rawText}
                        maxLength={3000}
                        aria-label={t(
                          `事件 ${index + 1} 原文`,
                          `Event ${index + 1} original record`,
                        )}
                        onChange={(e) =>
                          updateEvent(index, { rawText: e.target.value })
                        }
                      />
                      {event.warnings?.map((w, i) => (
                        <small className="event-warning" key={i}>
                          {t(w)}
                        </small>
                      ))}
                      {event.type === "unknown" && (
                        <small className="event-warning">
                          {t(
                            "未知动作：保留原文，不参与计分",
                            "Unknown action: kept without scoring",
                          )}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button
              className="btn primary"
              disabled={busy || needsReparse}
              onClick={save}
            >
              <Check size={17} />
              {t("确认并生成复盘", "Confirm & start replay")}
              <ArrowRight size={17} />
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  setEvents(
                    normalizeEvents(events.map((e, i) => ({ ...e, order: i }))),
                  );
                  setError("");
                  setNotice(
                    t(
                      "已按比赛阶段和时间重新排序。",
                      "Events sorted by half and time.",
                    ),
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Invalid event time",
                  );
                }
              }}
            >
              {t("按时间排序", "Sort by time")}
            </button>
            <small>
              {t(
                "数据仅保存在当前浏览器，可随时导出 JSON。",
                "Saved in this browser only. Export JSON for a backup.",
              )}
            </small>
          </div>
        </section>
      )}
    </div>
  );
}
