import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileJson,
  Flag,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import type {
  Direction,
  Match,
  MatchEvent,
  Perspective,
  Prediction,
  Side,
} from "../shared/types";
import { demoMatches } from "../shared/demos";
import { matchMatchesQuery } from "../shared/names";
import {
  currentMinute,
  eventLabels,
  isEffective,
  isFullTime,
  momentum,
  nextEffectiveIndex,
  playersAt,
  rulesCommentary,
  scoreAt,
} from "../shared/engine";
import { validateMatch } from "../shared/parser";
import { Badge, Brand, Chart, StatsTable, Tag } from "./ui";
import ImportPanel from "./Import";
import {
  LanguageContext,
  type Language,
  useT,
  loadTraditional,
  useNames,
} from "./i18n";

type Page = "home" | "pro" | "fan" | "import" | "guide";
const STORE = "pitchpulse.matches.v1";
function loadMatches() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]").map(
      validateMatch,
    ) as Match[];
  } catch {
    return [];
  }
}
function Pitch() {
  return (
    <div className="pitch-scene" aria-hidden="true">
      <div className="pitch-aura" />
      <svg viewBox="0 0 640 300">
        <defs>
          <linearGradient id="pitchFade" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#24b4ad" stopOpacity=".4" />
            <stop offset="1" stopColor="#8d65f5" stopOpacity=".1" />
          </linearGradient>
          <pattern
            id="pitchGrid"
            width="28"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M28 0H0V24"
              fill="none"
              stroke="#29b8a8"
              strokeWidth=".5"
              opacity=".25"
            />
          </pattern>
        </defs>
        <g transform="translate(135 -15) rotate(29 250 150) skewX(-28)">
          <rect
            x="25"
            y="30"
            width="430"
            height="235"
            rx="4"
            fill="url(#pitchFade)"
            stroke="#59cfc7"
            strokeWidth="1.4"
          />
          <rect
            x="37"
            y="42"
            width="406"
            height="211"
            fill="url(#pitchGrid)"
            stroke="#59cfc7"
            strokeOpacity=".5"
          />
          <path
            d="M240 42V253 M37 95H105V200H37 M443 95H375V200H443 M37 122H67V173H37 M443 122H413V173H443"
            fill="none"
            stroke="#88d5d2"
            strokeOpacity=".5"
          />
          <circle
            cx="240"
            cy="147"
            r="40"
            fill="none"
            stroke="#88d5d2"
            strokeOpacity=".5"
          />
          <circle cx="240" cy="147" r="3" fill="#9ce8dc" />
          {[
            [140, 110],
            [180, 204],
            [300, 105],
            [360, 210],
            [260, 180],
            [340, 150],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="12" fill="#4edbb6" opacity=".1" />
              <circle cx={x} cy={y} r="3" fill="#66eac8" />
            </g>
          ))}
        </g>
      </svg>
      <span className="pitch-label">
        <i /> MATCH INTELLIGENCE, REIMAGINED
      </span>
    </div>
  );
}
function Home({
  matches,
  open,
  importMatch,
}: {
  matches: Match[];
  open: (m: Match, p: "pro" | "fan") => void;
  importMatch: () => void;
}) {
  const t = useT();
  const names = useNames();
  const [query, setQuery] = useState(""),
    [competition, setCompetition] = useState(""),
    [date, setDate] = useState("");
  const demo = demoMatches[0];
  const visible = matches.filter(
    (m) =>
      matchMatchesQuery(m, query, [
        names.team(m.home),
        names.team(m.away),
        names.match(m),
        names.competition(m),
      ]) &&
      (!competition || m.competition === competition) &&
      (!date || m.date === date),
  );
  const sample =
    demo.events.find((e) => e.displayTime === "67") ||
    demo.events[demo.events.length - 3];
  return (
    <>
      <section className="hero">
        <Pitch />
        <div className="hero-copy">
          <div className="eyebrow">
            <span />
            <span>
              {t("让每一场比赛，都有迹可循", "EVERY MATCH HAS A STORY")}
            </span>
          </div>
          <h1>
            {t("一场比赛，", "One match.")}
            <br className="mobile-break" />
            <em>{t("两种", "Two")}</em>
            {t("读法。", " perspectives.")}
          </h1>
          <p>
            {t(
              "用势头曲线看懂转折，用球迷解说重温情绪。",
              "See the turning points. Feel the match all over again.",
            )}
          </p>
          <div className="hero-pills">
            <span>
              <RotateCcw size={13} />
              {t("赛后复盘", "Post-match replay")}
            </span>
            <span>
              <Layers3 size={13} />
              {t("双模式切换", "Two perspectives")}
            </span>
            <span>
              <FileJson size={13} />
              {t("TXT / JSON 导入", "TXT / JSON import")}
            </span>
          </div>
        </div>
        <div className="hero-meta">
          <span className="live-dot" />
          {t("3 场演示比赛", "3 DEMO MATCHES")}
          <i />
          {t("2 种复盘模式", "2 WAYS TO REPLAY")}
        </div>
      </section>
      <div className="mode-grid">
        <article className="mode-card professional">
          <div className="mode-top">
            <div className="mode-icon">
              <BarChart3 size={27} />
            </div>
            <div>
              <span className="micro">THE ANALYST</span>
              <h2>{t("专业版", "Pro mode")}</h2>
            </div>
            <Tag tone="purple">{t("看懂比赛", "READ THE GAME")}</Tag>
          </div>
          <p>
            {t("把比赛走势，看成行情。", "The pulse of the game, at a glance.")}
          </p>
          <div className="mode-desc">
            {t(
              "球队势头曲线 · 重大事件标记 · 数据对比 · 下一事件预测",
              "Momentum charts · Key moments · Match stats · AI insights",
            )}
          </div>
          <div className="pro-preview">
            <div>
              <div className="preview-legend">
                <span>
                  <i className="green" />
                  {t("上涨", "Rising")}
                </span>
                <span>
                  <i className="red" />
                  {t("下跌", "Falling")}
                </span>
                <small>0—100</small>
              </div>
              <Chart
                match={demo}
                side="home"
                cursor={demo.events.length - 1}
                mini
              />
            </div>
            <div className="preview-values">
              {(["home", "away"] as Side[]).map((side) => (
                <div key={side}>
                  <Badge team={demo[side]} size={30} />
                  <span>
                    {names.team(demo[side])}
                    <b className={side === "home" ? "up" : "down"}>
                      {momentum(
                        demo,
                        side,
                        demo.events.findIndex((e) => e.displayTime === "67"),
                      ).toFixed(1)}
                    </b>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            className="btn primary full"
            onClick={() => open(demo, "pro")}
          >
            {t("进入专业版", "Explore pro mode")}
            <ArrowUpRight size={17} />
          </button>
        </article>
        <article className="mode-card supporter">
          <div className="mode-top">
            <div className="mode-icon">
              <MessageCircle size={27} />
            </div>
            <div>
              <span className="micro">THE SUPPORTER</span>
              <h2>{t("球迷版", "Fan mode")}</h2>
            </div>
            <Tag tone="yellow">{t("感受比赛", "FEEL THE GAME")}</Tag>
          </div>
          <p>{t("让文字赛况，有现场感。", "A little closer to the action.")}</p>
          <div className="mode-desc">
            {t(
              "易懂解说 · 情绪表达 · 三种球迷立场 · 原文核对",
              "Clear commentary · Three fan perspectives · Source checking",
            )}
          </div>
          <div className="fan-preview">
            <div className="preview-tabs">
              <span>
                <ShieldCheck size={13} />
                {t("主队球迷", "Home fan")}
              </span>
              <span>
                <Users size={13} />
                {t("中立解说", "Neutral")}
              </span>
              <span>
                <Flag size={13} />
                {t("客队球迷", "Away fan")}
              </span>
            </div>
            <div className="preview-comment">
              <b>{sample.displayTime}′</b>
              <div>
                <strong>
                  {t(
                    "可惜啊！这球被挡住了 😫",
                    "So close! The keeper says no 😫",
                  )}
                </strong>
                <p>
                  {t(
                    "禁区内起脚，但门将将球扑出。",
                    "A shot from inside the box, saved by the keeper.",
                  )}
                </p>
                <span className="tiny-tag">
                  {t("规则解说 · 演示", "RULE COMMENTARY · DEMO")}
                </span>
              </div>
            </div>
          </div>
          <button className="btn yellow full" onClick={() => open(demo, "fan")}>
            {t("进入球迷版", "Explore fan mode")}
            <ArrowUpRight size={17} />
          </button>
        </article>
      </div>
      <section className="match-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MATCH LIBRARY</span>
            <h2>
              {t("选择一场比赛", "Pick a match")}
              <span className="count">
                {matches.length.toString().padStart(2, "0")}
              </span>
            </h2>
          </div>
          <div className="filters">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label={t("搜索球队或比赛", "Search teams or matches")}
                placeholder={t("搜索球队或比赛…", "Search a team or match…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label={t("赛事筛选", "Competition filter")}
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
            >
              <option value="">{t("全部赛事", "All leagues")}</option>
              {[...new Set(matches.map((m) => m.competition))].map((c) => (
                <option key={c} value={c}>
                  {names.competition(matches.find((m) => m.competition === c)!)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("日期筛选", "Date filter")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              <option value="">{t("全部日期", "All dates")}</option>
              {[...new Set(matches.map((m) => m.date))].sort().map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="section-note">
          <Info size={13} />
          {t(
            "示例均为虚构演示数据，比分与赛况仅用于产品体验。",
            "All demos are fictional. Scores and events are for product demonstration.",
          )}
        </p>
        <div className="match-list">
          {visible.map((m, index) => {
            const score = scoreAt(m, m.events.length - 1);
            return (
              <article className="match-row" key={m.id}>
                <div className="match-meta">
                  <div>
                    <span className="match-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>{names.match(m)}</strong>
                  </div>
                  <small>
                    {names.competition(m)}
                    <span>·</span>
                    {m.date}
                  </small>
                  <div>
                    <Tag>{t("已结束", "FULL TIME")}</Tag>
                    {m.demo && (
                      <Tag tone="yellow">{t("虚构演示", "FICTIONAL DEMO")}</Tag>
                    )}
                  </div>
                </div>
                <div className="row-fixture">
                  <div className="row-team">
                    <Badge team={m.home} size={47} />
                    <span>
                      {names.team(m.home)}
                      <small>{names.secondary(m.home)}</small>
                    </span>
                  </div>
                  <div className="row-score">
                    {score[0]}
                    <span>:</span>
                    {score[1]}
                    <small>
                      {isFullTime(m, m.events.length - 1)
                        ? "FT"
                        : t("已记录", "RECORDED")}
                    </small>
                  </div>
                  <div className="row-team away">
                    <Badge team={m.away} size={47} />
                    <span>
                      {names.team(m.away)}
                      <small>{names.secondary(m.away)}</small>
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="btn primary"
                    onClick={() => open(m, "pro")}
                  >
                    <BarChart3 size={16} />
                    {t("专业版", "Pro")}
                  </button>
                  <button className="btn yellow" onClick={() => open(m, "fan")}>
                    <MessageCircle size={16} />
                    {t("球迷版", "Fan")}
                  </button>
                </div>
              </article>
            );
          })}
          {!visible.length && (
            <div className="panel empty">
              <Search size={30} />
              <h3>{t("没有找到比赛", "No matches found")}</h3>
              <p>
                {t(
                  "试试其他关键词，或导入自己的赛况。",
                  "Try another search or import your match.",
                )}
              </p>
              <button className="btn primary" onClick={importMatch}>
                {t("导入比赛", "Import match")}
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="import-callout panel">
        <div className="callout-icon">
          <Plus size={26} />
        </div>
        <div>
          <h2>{t("把你的赛况，导入这里", "Your match. Your replay.")}</h2>
          <p>
            {t(
              "粘贴文字或上传 TXT / JSON，把记录变成一场可回放的比赛。",
              "Paste commentary or upload TXT / JSON to build your own replay.",
            )}
          </p>
        </div>
        <div className="import-steps">
          <span>
            <b>01</b>
            {t("导入赛况", "Import")}
          </span>
          <i />
          <span>
            <b>02</b>
            {t("核对事件", "Review")}
          </span>
          <i />
          <span>
            <b>03</b>
            {t("生成复盘", "Replay")}
          </span>
        </div>
        <button className="btn outline" onClick={importMatch}>
          {t("导入我的比赛", "Import a match")}
          <ArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
const englishTitles: Record<string, string> = {
  goal: "A goal! The score changes ⚽",
  own_goal: "An own goal changes the score ⚽",
  shot_on_target: "On target, but the keeper saves it 🧤",
  shot_off_target: "The shot goes wide 👀",
  shot_blocked: "The shot is blocked 🛡️",
  corner: "A corner opportunity 🚩",
  red_card: "A red card changes the numbers 🟥",
  yellow_card: "A yellow card from the referee",
  var_cancel_goal: "VAR: the goal is ruled out 📺",
  penalty_awarded: "A penalty is awarded 🎯",
  penalty_missed: "The penalty does not go in",
  fulltime: "The final whistle 🏁",
  halftime: "Half-time. Time to regroup ⏸",
  kickoff: "The match gets underway ⚽",
  substitution: "A change of players ⇄",
  foul: "A foul is called",
  save: "The keeper makes a save 🧤",
  unknown: "An event to review",
};
function englishEventTitle(event: MatchEvent, perspective: Perspective) {
  const title = englishTitles[event.type] || "A moment in the match";
  return perspective === "neutral"
    ? title
    : perspective === event.team
      ? "Our moment · " + title
      : "The other side · " + title;
}
function EventIcon({ event }: { event: MatchEvent }) {
  return (
    <span className={`event-symbol ${event.type === "red_card" ? "red" : ""}`}>
      {["goal", "own_goal"].includes(event.type)
        ? "⚽"
        : event.type === "corner"
          ? "🚩"
          : event.type === "red_card"
            ? "▮"
            : event.type === "yellow_card"
              ? "▮"
              : event.type === "var_cancel_goal"
                ? "VAR"
                : event.type === "shot_on_target"
                  ? "🧤"
                  : event.type === "halftime"
                    ? "Ⅱ"
                    : event.type === "fulltime"
                      ? "FT"
                      : event.type === "substitution"
                        ? "⇄"
                        : "↗"}
    </span>
  );
}
function Playback({
  match,
  cursor,
  playing,
  speed,
  setSpeed,
  setPlaying,
  seek,
}: {
  match: Match;
  cursor: number;
  playing: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  setPlaying: (n: boolean) => void;
  seek: (n: number) => void;
}) {
  const t = useT();
  const end = cursor === match.events.length - 1;
  return (
    <div className="panel playback">
      <div className="playback-top">
        <div className="playback-buttons">
          <button
            className="btn accent"
            onClick={() => {
              if (end) seek(-1);
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause size={16} />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {playing
              ? t("暂停", "Pause")
              : end
                ? t("重新播放", "Replay")
                : t("播放", "Play")}
          </button>
          <button
            className="btn ghost"
            aria-label={t("上一事件", "Previous event")}
            disabled={cursor < 0}
            onClick={() => seek(cursor - 1)}
          >
            <SkipBack size={15} />
            <span>{t("上一事件", "Previous")}</span>
          </button>
          <button
            className="btn ghost"
            aria-label={t("下一事件", "Next event")}
            disabled={end}
            onClick={() => seek(cursor + 1)}
          >
            <span>{t("下一事件", "Next")}</span>
            <SkipForward size={15} />
          </button>
          <select
            aria-label={t("回放速度", "Playback speed")}
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
          >
            {[0.5, 1, 2, 4].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
          <b className="clock">
            {cursor < 0 ? "0" : match.events[cursor]?.displayTime}′
            <small>/ {match.events.at(-1)?.displayTime}′</small>
          </b>
        </div>
        <span className="replay-note">
          <ShieldCheck size={13} />
          {end
            ? isFullTime(match, cursor)
              ? t("终场总览", "FULL-TIME OVERVIEW")
              : t("记录结束", "END OF RECORD")
            : t("回放中 · 未来事件已隐藏", "REPLAY · FUTURE EVENTS HIDDEN")}
        </span>
      </div>
      <div className="timeline">
        <input
          type="range"
          min="-1"
          max={match.events.length - 1}
          value={cursor}
          onChange={(e) => seek(+e.target.value)}
          aria-label={t("比赛进度，按事件顺序", "Match progress, event order")}
          style={
            {
              "--progress": `${((cursor + 1) / match.events.length) * 100}%`,
            } as React.CSSProperties
          }
        />
        <div className="timeline-markers">
          {match.events.slice(0, cursor + 1).map((e, i) =>
            ["goal", "red_card", "var_cancel_goal"].includes(e.type) ? (
              <button
                key={e.id}
                title={e.rawText}
                style={{ left: `${((i + 1) / match.events.length) * 100}%` }}
                onClick={() => seek(i)}
              >
                {e.type === "goal"
                  ? "⚽"
                  : e.type === "red_card"
                    ? "🟥"
                    : "VAR"}
                <small>{e.displayTime}′</small>
              </button>
            ) : null,
          )}
        </div>
        <div className="timeline-labels">
          <span>{t("开场", "KICKOFF")}</span>
          <span>
            {t(
              "按事件顺序回放 · 补时与同分钟顺序保留",
              "EVENT-ORDER REPLAY · ADDED TIME PRESERVED",
            )}
          </span>
          <span>{t("终场", "FULL TIME")}</span>
        </div>
      </div>
    </div>
  );
}
type LockedPrediction = Prediction & { target: number; baseline: number };
// Keep an already generated forecast fixed when switching between replay modes.
const predictionMemory = new Map<
  string,
  { team: Side; forecast: LockedPrediction | null }
>();
function PredictionCard({
  match,
  cursor,
  health,
  seek,
}: {
  match: Match;
  cursor: number;
  health: { aiConfigured: boolean; model?: string };
  seek: (n: number) => void;
}) {
  const t = useT();
  const names = useNames();
  const memoryKey = `${match.id}:${match.version}`;
  const saved = predictionMemory.get(memoryKey);
  const [team, setTeam] = useState<Side>(saved?.team ?? "home"),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false),
    [forecast, setForecast] = useState<LockedPrediction | null>(
      saved?.forecast ?? null,
    );
  const anchor = useRef({ cursor, version: match.version, team });
  anchor.current = { cursor, version: match.version, team };
  const next = nextEffectiveIndex(match, cursor);
  useEffect(() => {
    if (predictionMemory.size >= 100 && !predictionMemory.has(memoryKey))
      predictionMemory.delete(predictionMemory.keys().next().value!);
    predictionMemory.set(memoryKey, { team, forecast });
  }, [memoryKey, team, forecast]);
  useEffect(() => {
    if (forecast && cursor < forecast.cursor) setForecast(null);
  }, [cursor, forecast]);
  const generate = async () => {
    const at = cursor;
    setLoading(true);
    setError("");
    setLogin(false);
    try {
      const r = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match, cursor: at, team }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await r.json();
      if (!r.ok) {
        setLogin(r.status === 401);
        throw new Error(
          data.message ||
            t("请求失败，请重试", "Request failed. Please retry."),
        );
      }
      if (
        anchor.current.cursor === at &&
        anchor.current.version === match.version &&
        anchor.current.team === team
      )
        setForecast({
          ...data,
          target: next,
          baseline: momentum(match, team, at),
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  const directionNames: Record<Direction, string> = {
    up: t("看涨", "Rising"),
    down: t("看跌", "Falling"),
    flat: t("预计持平", "Steady"),
    insufficient: t("信息不足", "Insufficient evidence"),
  };
  const revealed = forecast && cursor >= forecast.target;
  const actual = forecast
    ? momentum(match, team, forecast.target) - forecast.baseline
    : 0;
  const actualDirection: Direction =
    Math.abs(actual) < 0.5 ? "flat" : actual > 0 ? "up" : "down";
  return (
    <div className="panel prediction">
      <div className="card-heading">
        <h3>
          <Sparkles size={17} />
          {t("下一有效事件预测", "The next turning point")}
        </h3>
        <Tag tone={health.aiConfigured ? "green" : "muted"}>
          {health.aiConfigured ? "DEEPSEEK" : t("AI 未连接", "AI OFFLINE")}
        </Tag>
      </div>
      <p className="subtle">
        {t(
          "预测下一事件后，该队势头相对当前的方向。",
          "Predict the change after the next meaningful event.",
        )}
      </p>
      <div className="segmented">
        {(["home", "away"] as Side[]).map((s) => (
          <button
            className={s === team ? "active" : ""}
            key={s}
            onClick={() => {
              setTeam(s);
              setForecast(null);
            }}
          >
            {names.team(match[s])}
          </button>
        ))}
      </div>
      {forecast ? (
        <>
          <h2
            className={
              forecast.direction === "up"
                ? "up"
                : forecast.direction === "down"
                  ? "down"
                  : ""
            }
          >
            {directionNames[forecast.direction]}
            {forecast.direction === "up" ? (
              <ArrowUpRight />
            ) : forecast.direction === "down" ? (
              <ArrowDownRight />
            ) : null}
          </h2>
          <p>{forecast.explanation}</p>
          <small>
            {t("已固定于", "LOCKED AT")}{" "}
            {match.events[forecast.cursor]?.displayTime || 0}′ ·{" "}
            {forecast.model} {forecast.cached && t("· 缓存", "· CACHED")}
          </small>
          {revealed ? (
            <div className="prediction-result">
              <Check size={16} />
              {t("实际结果", "ACTUAL")}: {directionNames[actualDirection]} ·{" "}
              {actual > 0 ? "+" : ""}
              {actual.toFixed(1)} {t("点", "pts")}
            </div>
          ) : (
            <button
              className="btn outline full"
              onClick={() => seek(forecast.target)}
            >
              {t("继续回放并揭晓", "Continue & reveal")}
              <ArrowRight size={15} />
            </button>
          )}
        </>
      ) : (
        <div className="prediction-empty">
          <Activity size={33} />
          <strong>
            {next < 0
              ? t("已经到达最后的有效事件", "No further scoring events")
              : health.aiConfigured
                ? t("下一次转折，会是什么？", "What comes next?")
                : t(
                    "连接 AI，解锁下一次转折",
                    "Connect AI to explore what comes next",
                  )}
          </strong>
          <p>
            {next < 0
              ? t(
                  "回到比赛过程中的位置再试。",
                  "Seek back into the match to try a prediction.",
                )
              : t(
                  "仅使用当前位置以前的事件，不读取未来赛况。",
                  "Uses only the events known at the current replay point.",
                )}
          </p>
        </div>
      )}
      {!forecast && (
        <button
          className="btn primary full"
          disabled={loading || next < 0 || !health.aiConfigured}
          onClick={generate}
        >
          {loading ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Sparkles size={15} />
          )}{" "}
          {loading
            ? t("正在分析…", "Analyzing…")
            : t("生成预测", "Generate insight")}
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {login && (
        <a className="login-link" href="/.auth/login/github">
          {t("使用 GitHub 登录", "Sign in with GitHub")} →
        </a>
      )}
      <div className="prediction-foot">
        <ShieldCheck size={13} />
        {t(
          "非胜率 · 原型规则 · 未经校准",
          "Heuristic direction · Prototype rules · Uncalibrated",
        )}
      </div>
    </div>
  );
}
function FanEvent({
  match,
  event,
  index,
  cursor,
  perspective,
  latest,
}: {
  match: Match;
  event: MatchEvent;
  index: number;
  cursor: number;
  perspective: Perspective;
  latest: boolean;
}) {
  const t = useT();
  const names = useNames();
  const [expanded, setExpanded] = useState(false),
    [login, setLogin] = useState(false),
    [ai, setAi] = useState<{
      title: string;
      text: string;
      cached?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rule = rulesCommentary(match, event, perspective);
  const requestContext = `${match.version}:${event.id}:${perspective}`;
  const currentRequestContext = useRef(requestContext);
  currentRequestContext.current = requestContext;
  useEffect(() => {
    setAi(null);
    setError("");
  }, [perspective, match.version, event.id]);
  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match,
          cursor: Math.min(index, cursor),
          eventId: event.id,
          perspective,
        }),
        signal: AbortSignal.timeout(40000),
      });
      const d = await r.json();
      if (!r.ok) {
        setLogin(r.status === 401);
        throw new Error(d.message || t("AI 暂不可用", "AI unavailable"));
      }
      if (currentRequestContext.current === requestContext) setAi(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`comment-card ${latest ? "latest" : ""}`}>
      <div className="event-minute">{event.displayTime}′</div>
      <EventIcon event={event} />
      <div className="comment-body">
        <div className="comment-meta">
          <span>
            {event.team === "unknown"
              ? t("比赛事件", "MATCH EVENT")
              : names.team(match[event.team])}
          </span>
          <Tag tone={ai ? "purple" : "muted"}>
            {ai
              ? t("AI 解说", "AI COMMENTARY")
              : t("规则解说", "RULE COMMENTARY")}
            {ai?.cached && " · CACHE"}
          </Tag>
          {latest && (
            <span className="latest-label">{t("最新事件", "LATEST")}</span>
          )}
        </div>
        <h3>
          {ai?.title || t(rule.title, englishEventTitle(event, perspective))}
        </h3>
        <p>{ai?.text || rule.text}</p>
        <div className="comment-actions">
          <button onClick={() => setExpanded(!expanded)}>
            {expanded
              ? t("收起原文", "Hide source")
              : t("查看原文", "View source")}
            <ChevronDown size={13} className={expanded ? "rotate" : ""} />
          </button>
          <button onClick={request} disabled={busy}>
            {busy ? (
              <LoaderCircle size={12} className="spin" />
            ) : (
              <Sparkles size={12} />
            )}{" "}
            {t("AI 改写", "AI rewrite")}
          </button>
        </div>
        {expanded && (
          <div className="source-text">
            <span>{t("原始赛况", "ORIGINAL EVENT")}</span>
            <p>{event.rawText}</p>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {login && (
          <a className="login-link" href="/.auth/login/github">
            {t("使用 GitHub 登录", "Sign in with GitHub")} →
          </a>
        )}
      </div>
    </article>
  );
}
function MatchView({
  match,
  mode,
  setMode,
  cursor,
  seek,
  health,
  playing,
  setPlaying,
  speed,
  setSpeed,
  exportMatch,
  edit,
}: {
  match: Match;
  mode: "pro" | "fan";
  setMode: (p: "pro" | "fan") => void;
  cursor: number;
  seek: (n: number) => void;
  health: { aiConfigured: boolean; model?: string };
  playing: boolean;
  setPlaying: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  exportMatch: () => void;
  edit: () => void;
}) {
  const t = useT();
  const names = useNames();
  const [hover, setHover] = useState<number | null>(null),
    [all, setAll] = useState(false),
    [perspective, setPerspective] = useState<Perspective>("home"),
    [count, setCount] = useState(8);
  const score = scoreAt(match, cursor),
    players = playersAt(match, cursor);
  const known = match.events.slice(0, cursor + 1);
  const current = known.at(-1);
  const major = known.filter((e) =>
    [
      "goal",
      "own_goal",
      "red_card",
      "penalty_awarded",
      "var_cancel_goal",
    ].includes(e.type),
  );
  const recent = [...known].reverse();
  const latestComment = current
    ? rulesCommentary(match, current, perspective)
    : null;
  return (
    <div className={`match-view ${mode === "fan" ? "fan-mode" : ""}`}>
      <div className="breadcrumb">
        <span>{t("比赛大厅", "Match library")}</span>
        <ChevronRight size={13} />
        <span>{names.match(match)}</span>
        <ChevronRight size={13} />
        <b>
          {mode === "pro" ? t("专业版", "Pro mode") : t("球迷版", "Fan mode")}
        </b>
        {match.demo && (
          <Tag tone="yellow">{t("虚构演示数据", "FICTIONAL DEMO")}</Tag>
        )}
        <div className="mode-switch">
          <button
            className={mode === "pro" ? "active" : ""}
            onClick={() => setMode("pro")}
          >
            <BarChart3 size={14} />
            {t("专业版", "Pro")}
          </button>
          <button
            className={mode === "fan" ? "active fan" : ""}
            onClick={() => setMode("fan")}
          >
            <MessageCircle size={14} />
            {t("球迷版", "Fan")}
          </button>
        </div>
      </div>
      <section className="scoreboard">
        <div className="score-team">
          <div>
            <h2>{names.team(match.home)}</h2>
            <small>{names.secondary(match.home)}</small>
          </div>
          <Badge team={match.home} size={72} />
        </div>
        <div className="score-center">
          <div>
            <strong>{score[0]}</strong>
            <span>—</span>
            <strong>{score[1]}</strong>
          </div>
          <p>
            {cursor === match.events.length - 1
              ? isFullTime(match, cursor)
                ? t("终场总览", "FULL TIME")
                : t("已记录总览", "RECORDED OVERVIEW")
              : t("回放至", "REPLAY")}{" "}
            {cursor === match.events.length - 1
              ? ""
              : `${current?.displayTime || "0"}′ · ${current?.period === 2 ? t("下半场", "2ND HALF") : t("上半场", "1ST HALF")}`}
          </p>
          <small>
            {names.competition(match)} · {match.date}
          </small>
        </div>
        <div className="score-team away">
          <Badge team={match.away} size={72} />
          <div>
            <h2>{names.team(match.away)}</h2>
            <small>{names.secondary(match.away)}</small>
          </div>
        </div>
      </section>
      <div className="match-toolbar">
        <span>
          <i className="live-dot" />
          {t(
            "同一份赛况，两种视角看懂比赛",
            "SAME MATCH. A DIFFERENT PERSPECTIVE.",
          )}
        </span>
        <div>
          <button
            onClick={() => {
              seek(-1);
              setPlaying(false);
            }}
          >
            <RotateCcw size={13} />
            {t("从开场回放", "From kickoff")}
          </button>
          <button onClick={exportMatch}>
            <Download size={13} />
            {t("导出 JSON", "Export JSON")}
          </button>
          <button onClick={edit}>
            <Upload size={13} />
            {t("编辑数据", "Edit data")}
          </button>
        </div>
      </div>
      <Playback
        {...{ match, cursor, playing, speed, setSpeed, setPlaying, seek }}
      />
      {mode === "pro" ? (
        <>
          <div className="chart-grid">
            {(["home", "away"] as Side[]).map((s) => (
              <Chart
                key={s}
                match={match}
                side={s}
                cursor={cursor}
                hover={hover}
                onHover={setHover}
                onSeek={seek}
              />
            ))}
          </div>
          <div className="analysis-grid">
            <section className="panel stats-panel">
              <div className="card-heading">
                <h3>{t("两队数据对比", "The numbers behind the match")}</h3>
                <Tag>
                  {isFullTime(match, cursor)
                    ? t("终场", "FULL TIME")
                    : `${current?.displayTime || 0}′`}
                </Tag>
              </div>
              <StatsTable match={match} cursor={cursor} />
              <p className="section-note">
                <Info size={12} />
                {t(
                  "未提供的数据不作推测。节选计数仅代表已记录事件。",
                  "Missing values stay missing. Excerpt counts cover recorded events only.",
                )}
              </p>
            </section>
            <div className="analysis-aside">
              <PredictionCard
                match={match}
                cursor={cursor}
                health={health}
                seek={seek}
              />
              <details className="panel rules-note">
                <summary>
                  <Info size={15} />
                  {t("势头指数说明", "How momentum works")}
                  <ChevronDown size={14} />
                </summary>
                <p>
                  {t(
                    "50 为中性；两队独立计算。这是启发式势头指标，不是胜率。",
                    "50 is neutral. Teams are independent. This is a heuristic index, not win probability.",
                  )}
                </p>
                <code>50 + Σ w(e) × 2^(−Δt / 3)</code>
                <p>
                  {t(
                    "只计算之前 8 分钟的确认事件。半衰期 3 分钟；无事件时向 50 回归表示信号衰减。",
                    "Confirmed events in the last 8 active minutes. A 3-minute half-life returns old signals toward 50.",
                  )}
                </p>
                <p>
                  {t(
                    "进球 +12 / −6；射正 +5 / −2；射偏 +2 / 0；角球 +1 / 0；红牌 −8 / +3。",
                    "Goal +12 / −6; on target +5 / −2; missed shot +2 / 0; corner +1 / 0; red card −8 / +3.",
                  )}
                </p>
              </details>
            </div>
          </div>
          <section className="panel events-panel">
            <div className="card-heading">
              <h3>
                {all
                  ? t("完整事件记录", "All match events")
                  : t("重大事件", "Turning points")}
              </h3>
              <button className="text-button" onClick={() => setAll(!all)}>
                {all
                  ? t("仅看重大事件", "Key events only")
                  : t("展开完整事件记录", "Show all events")}
                <ChevronDown size={14} />
              </button>
            </div>
            {[...(all ? known : major)].reverse().map((e) => (
              <button
                className="event-row"
                key={e.id}
                onClick={() => seek(match.events.indexOf(e))}
              >
                <b>{e.displayTime}′</b>
                <EventIcon event={e} />
                <span>{e.rawText}</span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!(all ? known : major).length && (
              <p className="empty-note">
                {t(
                  "当前位置尚无重大事件，继续回放。",
                  "No key events yet. Continue the replay.",
                )}
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="perspective-bar">
            <div className="perspective-tabs">
              {(["neutral", "home", "away"] as Perspective[]).map((p) => (
                <button
                  key={p}
                  className={perspective === p ? "active" : ""}
                  onClick={() => setPerspective(p)}
                >
                  {p === "neutral" ? (
                    <Users size={16} />
                  ) : (
                    <Badge team={match[p]} size={20} />
                  )}{" "}
                  {p === "neutral"
                    ? t("中立解说", "Neutral")
                    : `${names.team(match[p])}${t("球迷", " fan")}`}
                </button>
              ))}
            </div>
            <p>
              {t(
                "立场改变语气，比赛事实保持一致。",
                "Different emotions. The same match facts.",
              )}
            </p>
          </div>
          <div className="fan-grid">
            <section className="panel commentary-panel">
              <div className="card-heading">
                <h2>
                  <Volume2 size={22} />
                  {t("比赛解说", "Match commentary")}
                </h2>
                <Tag>{t("最新在前", "LATEST FIRST")}</Tag>
              </div>
              {recent.slice(0, count).map((e, i) => (
                <FanEvent
                  key={e.id}
                  match={match}
                  event={e}
                  index={match.events.indexOf(e)}
                  cursor={cursor}
                  perspective={perspective}
                  latest={i === 0}
                />
              ))}
              {recent.length > count && (
                <button
                  className="btn outline more-events"
                  onClick={() => setCount(count + 8)}
                >
                  {t("查看更多早事件", "Show earlier events")}
                  <ChevronDown size={14} />
                </button>
              )}
              {!recent.length && (
                <div className="empty">
                  <Clock3 size={30} />
                  <h3>{t("比赛即将开始", "Ready for kickoff")}</h3>
                  <p>
                    {t(
                      "点击播放，开始这场比赛。",
                      "Press play to begin the story.",
                    )}
                  </p>
                </div>
              )}
            </section>
            <aside className="fan-aside">
              <section className="panel">
                <div className="card-heading">
                  <h3>{t("此刻的比赛", "The match right now")}</h3>
                  <Tag tone="yellow">{current?.displayTime || 0}′</Tag>
                </div>
                <div className="match-now">
                  <div>
                    <small>{t("当前比分", "SCORE")}</small>
                    <strong>
                      {score[0]} — {score[1]}
                    </strong>
                  </div>
                  <div>
                    <small>{t("场上人数", "PLAYERS")}</small>
                    <strong>
                      {players[0]}
                      <span> vs </span>
                      {players[1]}
                    </strong>
                  </div>
                </div>
                <StatsTable match={match} cursor={cursor} compact />
              </section>
              <section className="panel perspectives-card">
                <h3>{t("同一事件，三种视角", "One moment. Three voices.")}</h3>
                <p className="subtle">
                  {t(
                    "让我们看看不同立场如何解读",
                    "How each side sees the latest event",
                  )}
                </p>
                {current &&
                  (["neutral", "home", "away"] as Perspective[]).map((p) => {
                    const c = rulesCommentary(match, current, p);
                    return (
                      <button
                        className={perspective === p ? "selected" : ""}
                        key={p}
                        onClick={() => setPerspective(p)}
                      >
                        <span>
                          {p === "neutral" ? (
                            "⚽"
                          ) : (
                            <Badge team={match[p]} size={29} />
                          )}
                        </span>
                        <div>
                          <small>
                            {p === "neutral"
                              ? t("中立", "Neutral")
                              : names.team(match[p])}
                          </small>
                          <p>{t(c.title, englishEventTitle(current, p))}</p>
                        </div>
                      </button>
                    );
                  })}
                {!latestComment && (
                  <p>
                    {t(
                      "回放后显示当前事件。",
                      "Replay to see the latest moment.",
                    )}
                  </p>
                )}
              </section>
              <section className="panel commentary-info">
                <h3>
                  {t(
                    "让情绪更近，让事实不变",
                    "Feel the game. Keep the facts.",
                  )}
                </h3>
                {[
                  t("只改写表达，不增加事实", "Expression changes, facts stay"),
                  t("随时展开原始赛况核对", "Check every original event"),
                  t("回放不会提前剧透", "No future events revealed"),
                ].map((s) => (
                  <p key={s}>
                    <Check size={15} />
                    {s}
                  </p>
                ))}
                <small>
                  {t(
                    "未连接 AI 时明确使用规则解说。",
                    "Rule commentary is labeled when AI is disconnected.",
                  )}
                </small>
              </section>
            </aside>
          </div>
          <div className="fan-switch-callout">
            <BarChart3 size={28} />
            <div>
              <h3>
                {t(
                  "想看比赛势头如何变化？",
                  "See how the game ebbs and flows?",
                )}
              </h3>
              <p>
                {t(
                  "切换专业版，查看球队走势与深入的数据对比。",
                  "Explore the momentum charts and match statistics.",
                )}
              </p>
            </div>
            <button className="btn outline" onClick={() => setMode("pro")}>
              {t("切换专业版", "Switch to pro")}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </>
      )}
      <div className="match-data-note">
        <Info size={13} />
        {match.demo ? t("虚构演示数据 · ", "FICTIONAL DEMO · ") : ""}
        {t("数据覆盖", "COVERAGE")}:{" "}
        {match.coverage === "complete"
          ? t("完整记录", "Complete")
          : match.coverage === "excerpt"
            ? t("赛况节选", "Excerpt")
            : t("未知", "Unknown")}{" "}
        · {names.source(match) || t("个人导入", "Personal import")}
      </div>
    </div>
  );
}
function Guide() {
  const t = useT();
  return (
    <div className="guide">
      <div className="page-title">
        <span className="eyebrow">THE PLAYBOOK</span>
        <h1>{t("把比赛，看得更明白。", "A better way to read the game.")}</h1>
        <p>
          {t(
            "从一段文字赛况，开始你的双模式复盘。",
            "Start with the commentary. Discover the whole match.",
          )}
        </p>
      </div>
      <div className="guide-grid">
        {[
          [
            Upload,
            t("01 导入与核对", "01 Import & review"),
            t(
              "粘贴中英文赛况，或上传 UTF-8 TXT / JSON。填写球队和赛事信息，核对时间、球队和事件类型。未知事件会保留原文，VAR 请关联被取消的进球。",
              "Paste Chinese or English commentary, or upload UTF-8 TXT / JSON. Review the teams, times and event types. Unknown events keep their source. Link VAR decisions to the affected goal.",
            ),
          ],
          [
            BarChart3,
            t("02 在专业版读懂转折", "02 Find the turning points"),
            t(
              "两队势头独立计算，统一使用 0–100 刻度。上涨用绿、下跌用红；50 是中性值。只展示回放位置前的数据，缺失数据不作推测。",
              "Independent team indices share a 0–100 scale. Green rises, red falls, and 50 is neutral. Only known events and statistics appear.",
            ),
          ],
          [
            MessageCircle,
            t("03 在球迷版重温情绪", "03 Feel every moment"),
            t(
              "切换中立、主队和客队立场，随时展开原文。无 AI 密钥时使用规则解说；接入 DeepSeek 后可逐条生成 AI 改写。",
              "Switch between neutral, home and away voices. Expand the original text at any time. Rule commentary works offline; DeepSeek enables AI rewrites.",
            ),
          ],
          [
            ShieldCheck,
            t("04 数据属于你的浏览器", "04 Your browser, your library"),
            t(
              "导入的比赛仅保存在此设备的当前浏览器，没有跨设备同步。清除浏览器数据会删除比赛，建议定期导出 JSON。AI 请求仅在点击相应按钮时发送到后端。",
              "Imported matches stay in this browser on this device. Export JSON for backups. AI requests reach the server only when you use an AI feature.",
            ),
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Upload;
          return (
            <section className="panel" key={String(title)}>
              <I size={25} />
              <h2>{String(title)}</h2>
              <p>{String(text)}</p>
            </section>
          );
        })}
      </div>
      <section className="panel guide-rules">
        <h2>{t("透明的势头规则", "An explainable momentum index")}</h2>
        <code>M(t) = clamp(50 + Σ w(e) × 2^(−Δactive / 3), 0, 100)</code>
        <p>
          {t(
            "只累计最近 8 个有效比赛分钟内的已确认事件。权重是可调整的原型假设，没有经过专业校准。点球判罚本身不加分；点球进球按进球计分；乌龙按实际受益方计分；VAR 在取消时撤销残留信号与比分，不改写过去。",
            "Only confirmed events in the last 8 active minutes count. Weights are adjustable prototype assumptions. Penalty awards carry no weight; scored penalties count as goals. Own goals credit the beneficiary. VAR removes the remaining signal and score when the decision occurs.",
          )}
        </p>
        <p>
          {t(
            "指数不是胜率、进球概率或投注信号。射门次数不会被当作 xG。",
            "The index is not win probability, scoring probability or a betting signal. Shot counts are never used as xG.",
          )}
        </p>
      </section>
    </div>
  );
}
export default function App() {
  const [lang, setLang] = useState<Language>(
    () => (localStorage.getItem("pitchpulse.language") as Language) || "zh-CN",
  );
  const [, setTranslationsReady] = useState(false);
  useEffect(() => {
    if (lang === "zh-TW")
      void loadTraditional().then(() => setTranslationsReady(true));
  }, [lang]);
  return (
    <LanguageContext.Provider value={lang}>
      <Application lang={lang} setLang={setLang} />
    </LanguageContext.Provider>
  );
}
function Application({
  lang,
  setLang,
}: {
  lang: Language;
  setLang: (l: Language) => void;
}) {
  const t = useT();
  const [users, setUsers] = useState<Match[]>(loadMatches),
    [page, setPage] = useState<Page>("home"),
    [selectedId, setSelectedId] = useState(demoMatches[0].id),
    [positions, setPositions] = useState<Record<string, number>>({}),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [toast, setToast] = useState(""),
    [editing, setEditing] = useState<Match | undefined>(),
    [health, setHealth] = useState<{ aiConfigured: boolean; model?: string }>({
      aiConfigured: false,
    });
  const matches = [...users, ...demoMatches];
  const match = matches.find((m) => m.id === selectedId) || demoMatches[0];
  const cursor = positions[match.id] ?? match.events.length - 1;
  const route = useRef({ page, selectedId });
  route.current = { page, selectedId };
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(users));
    } catch {
      setToast(
        t(
          "浏览器存储空间不足，请导出备份。",
          "Browser storage is full. Export a backup.",
        ),
      );
    }
  }, [users]);
  useEffect(() => {
    localStorage.setItem("pitchpulse.language", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setHealth({ aiConfigured: false }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const sync = () => {
      const [p, id] = location.hash.slice(1).split("/");
      if (["home", "pro", "fan", "import", "guide"].includes(p)) {
        setPage(p as Page);
        if (id) setSelectedId(decodeURIComponent(id));
        if (!(
          ["pro", "fan"].includes(p) &&
          ["pro", "fan"].includes(route.current.page) &&
          decodeURIComponent(id || "") === route.current.selectedId
        ))
          setPlaying(false);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const nav = (p: Page, id?: string) => {
    setPage(p);
    if (!(
      ["pro", "fan"].includes(p) &&
      ["pro", "fan"].includes(page) &&
      id === selectedId
    ))
      setPlaying(false);
    if (id) setSelectedId(id);
    location.hash = p + (id ? "/" + encodeURIComponent(id) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const seek = (n: number) => {
    setPositions((p) => ({
      ...p,
      [match.id]: Math.max(-1, Math.min(match.events.length - 1, n)),
    }));
  };
  useEffect(() => {
    if (!playing || !["pro", "fan"].includes(page)) return;
    if (cursor >= match.events.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => seek(cursor + 1), 1300 / speed);
    return () => clearTimeout(timer);
  }, [playing, cursor, match.id, speed, page]);
  const save = (m: Match) => {
    setUsers((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
    setPositions((p) => ({ ...p, [m.id]: -1 }));
    setEditing(undefined);
    setToast(t("比赛已保存到当前浏览器", "Match saved to this browser"));
    nav("pro", m.id);
  };
  const exportMatch = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(match, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `pitchpulse-${match.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(t("比赛 JSON 已导出", "Match JSON exported"));
  };
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            onClick={() => nav("home")}
            aria-label="PitchPulse home"
          >
            <Brand />
          </button>
          <nav>
            <button
              className={["home", "pro", "fan"].includes(page) ? "active" : ""}
              onClick={() => nav("home")}
            >
              {t("比赛大厅", "Match library")}
            </button>
            <button
              className={page === "import" ? "active" : ""}
              onClick={() => {
                setEditing(undefined);
                nav("import");
              }}
            >
              {t("数据导入", "Import")}
            </button>
            <button
              className={page === "guide" ? "active" : ""}
              onClick={() => nav("guide")}
            >
              {t("使用指南", "Guide")}
            </button>
          </nav>
          <div className="header-actions">
            <label className="language">
              <Globe2 size={15} />
              <select
                value={lang}
                aria-label="Language"
                onChange={(e) => setLang(e.target.value as Language)}
              >
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              className="btn primary"
              aria-label={t("导入比赛", "Import match")}
              onClick={() => {
                setEditing(undefined);
                nav("import");
              }}
            >
              <Plus size={17} />
              <span>{t("导入比赛", "Import match")}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="main-container">
        {page === "home" && (
          <Home
            matches={matches}
            open={(m, p) => nav(p, m.id)}
            importMatch={() => {
              setEditing(undefined);
              nav("import");
            }}
          />
        )}
        {["pro", "fan"].includes(page) && (
          <MatchView
            key={match.id}
            match={match}
            mode={page as "pro" | "fan"}
            setMode={(p) => nav(p, match.id)}
            {...{
              cursor,
              seek,
              health,
              playing,
              setPlaying,
              speed,
              setSpeed,
              exportMatch,
            }}
            edit={() => {
              setEditing(match);
              nav("import");
            }}
          />
        )}
        {page === "import" && (
          <ImportPanel
            initialMatch={editing}
            onSave={save}
            onCancel={() => nav("home")}
          />
        )}{" "}
        {page === "guide" && <Guide />}
      </main>
      <footer className="site-footer">
        <Brand />
        <span>
          {t("让每一场比赛，都有迹可循。", "Every match has a story.")}
        </span>
        <div>
          <span className="local-dot" />
          {t("数据保存在当前浏览器", "SAVED IN THIS BROWSER")}
          <i />{" "}
          {health.aiConfigured
            ? t("AI 已连接", "AI CONNECTED")
            : t("演示与规则解说可用", "DEMO & RULE COMMENTARY")}
        </div>
        <small>© {new Date().getFullYear()} PitchPulse</small>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button aria-label="Close" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
