import { useId, useState } from "react";
import { Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { Match, Team, Side, Stats } from "../shared/types";
import {
  momentum,
  sampleSeries,
  currentMinute,
  eventWeights,
  statsAt,
} from "../shared/engine";
import { useT } from "./i18n";

export function Brand() {
  const t = useT();
  return (
    <span className="brand">
      <Activity size={29} />
      <strong>
        PitchPulse<span className="brand-dot">.</span>
      </strong>
      <small>{t("足球赛况复盘", "FOOTBALL REPLAY")}</small>
    </span>
  );
}
const crestMap: Record<string, string> = {
  曼联: "66",
  "Manchester United": "66",
  热刺: "73",
  "Tottenham Hotspur": "73",
  切尔西: "61",
  Chelsea: "61",
  巴塞罗那: "81",
  Barcelona: "81",
  毕尔巴鄂: "77",
  "Athletic Club": "77",
};
export function Badge({ team, size = 40 }: { team: Team; size?: number }) {
  const [broken, setBroken] = useState(false);
  const id = crestMap[team.name];
  const src = id ? `/crests/${id}.png` : team.badge;
  return (
    <span
      className="badge"
      style={
        {
          width: size,
          height: size,
          flexShrink: 0,
          "--team-color": team.color,
        } as React.CSSProperties
      }
    >
      {src && !broken ? (
        <img
          src={src}
          alt={`${team.name} crest`}
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{team.short.slice(0, 3)}</span>
      )}
    </span>
  );
}
export function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Chart({
  match,
  side,
  cursor,
  mini = false,
  hover,
  onHover,
  onSeek,
}: {
  match: Match;
  side: Side;
  cursor: number;
  mini?: boolean;
  hover?: number | null;
  onHover?: (v: number | null) => void;
  onSeek?: (i: number) => void;
}) {
  const t = useT(),
    id = useId().replaceAll(":", ""),
    [tip, setTip] = useState(false);
  const team = match[side];
  const series = sampleSeries(match, side, cursor);
  const now = currentMinute(match, cursor);
  const duration = Math.max(
    match.duration,
    ...match.events.map((e) => e.activeMinute),
    90,
  );
  const value = momentum(match, side, cursor);
  const prev = cursor > 0 ? momentum(match, side, cursor - 1) : 50;
  const delta = value - (series.at(-2)?.value ?? prev);
  const W = 560,
    H = mini ? 155 : 280,
    left = mini ? 28 : 36,
    right = 12,
    top = mini ? 10 : 20,
    bottom = 30;
  const x = (n: number) => left + (n / duration) * (W - left - right);
  const y = (n: number) => top + ((100 - n) / 100) * (H - top - bottom);
  let area = "";
  let open = false;
  for (const p of series) {
    if (p.value === null) {
      if (open) area += `L${x(p.minute)},${y(0)}Z `;
      open = false;
      continue;
    }
    if (!open) {
      area += `M${x(p.minute)},${y(0)}L${x(p.minute)},${y(p.value)}`;
      open = true;
    } else area += `L${x(p.minute)},${y(p.value)}`;
  }
  if (open && series.length)
    area += `L${x(series[series.length - 1].minute)},${y(0)}Z`;
  const inspected = hover ?? now;
  const pt = series
    .filter((p) => p.value !== null)
    .reduce<(typeof series)[number] | undefined>(
      (a, p) =>
        !a || Math.abs(p.minute - inspected) <= Math.abs(a.minute - inspected)
          ? p
          : a,
      undefined,
    );
  const event =
    pt && pt.eventIndex >= 0 ? match.events[pt.eventIndex] : undefined;
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const m = Math.max(
      0,
      Math.min(
        now,
        ((((e.clientX - rect.left) / rect.width) * W - left) /
          (W - left - right)) *
          duration,
      ),
    );
    onHover?.(m);
    setTip(true);
  };
  return (
    <section className={mini ? "mini-chart" : "panel chart-panel"}>
      {!mini && (
        <div className="chart-heading">
          <div className="team-label">
            <Badge team={team} size={47} />
            <div>
              <h2>{team.name}</h2>
              <small>{team.englishName || team.short}</small>
            </div>
          </div>
          <div className="momentum-number">
            <small>{t("当前势头", "MOMENTUM")}</small>
            <div>
              <b>{value.toFixed(1)}</b>
              <span
                className={
                  Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down"
                }
              >
                {Math.abs(delta) < 0.05 ? (
                  <Minus size={16} />
                ) : delta > 0 ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}{" "}
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role={mini ? "img" : "slider"}
        aria-label={`${team.name} ${t("势头曲线，方向键切换事件", "momentum chart. Arrow keys seek events")}`}
        aria-valuemin={-1}
        aria-valuemax={match.events.length - 1}
        aria-valuenow={cursor}
        tabIndex={mini ? undefined : 0}
        onPointerMove={mini ? undefined : move}
        onPointerLeave={() => {
          onHover?.(null);
          setTip(false);
        }}
        onClick={
          mini
            ? undefined
            : () => {
                if (pt) onSeek?.(pt.eventIndex);
              }
        }
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek?.(Math.min(match.events.length - 1, cursor + 1));
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek?.(Math.max(-1, cursor - 1));
          }
        }}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2ce399" stopOpacity=".2" />
            <stop offset="1" stopColor="#2ce399" stopOpacity="0" />
          </linearGradient>
          <pattern
            id={`future-${id}`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(40)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="#394455"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={left}
              y1={y(v)}
              x2={W - right}
              y2={y(v)}
              stroke={v === 50 ? "#78869d" : "#223043"}
              strokeDasharray={v === 50 ? "4 4" : undefined}
            />
            <text x={left - 9} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 75, 90].map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              y1={top}
              x2={x(v)}
              y2={H - bottom}
              stroke="#1b293a"
            />
            <text x={x(v)} y={H - 9} textAnchor="middle">
              {v}′
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#area-${id})`} />
        {series.slice(1).map((p, i) => {
          const prev = series[i];
          return p.value === null || prev.value === null ? null : (
            <path
              key={i}
              d={`M${x(prev.minute)},${y(prev.value)}L${x(p.minute)},${y(p.value)}`}
              stroke={
                p.value > prev.value
                  ? "#2ce399"
                  : p.value < prev.value
                    ? "#ff5269"
                    : "#8895ab"
              }
              strokeWidth={mini ? 2.5 : 2}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        {now < duration && (
          <>
            <rect
              x={x(now)}
              y={top}
              width={x(duration) - x(now)}
              height={H - top - bottom}
              fill={`url(#future-${id})`}
              opacity=".25"
            />
            {!mini && (
              <text
                x={(x(now) + x(duration)) / 2}
                y={H / 2}
                textAnchor="middle"
              >
                {t("尚未回放", "NOT REPLAYED")}
              </text>
            )}
          </>
        )}
        {!mini &&
          match.events.slice(0, cursor + 1).map((e, i) =>
            [
              "goal",
              "own_goal",
              "red_card",
              "var_cancel_goal",
              "penalty_awarded",
            ].includes(e.type) ? (
              <g
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSeek?.(i);
                }}
                className="chart-marker"
              >
                <line
                  x1={x(e.activeMinute)}
                  x2={x(e.activeMinute)}
                  y1={top}
                  y2={H - bottom}
                  stroke="#9272e2"
                  strokeDasharray="4 5"
                  opacity=".5"
                />
                <text
                  x={x(e.activeMinute)}
                  y={top + 12}
                  textAnchor="middle"
                  className="marker-label"
                >
                  {e.type === "red_card"
                    ? "▮"
                    : e.type === "var_cancel_goal"
                      ? "VAR"
                      : "⚽"}
                </text>
              </g>
            ) : null,
          )}
        <line
          x1={x(inspected)}
          x2={x(inspected)}
          y1={top}
          y2={H - bottom}
          stroke="#aa81ff"
          strokeDasharray="4 3"
        />
        <circle
          cx={x(pt?.minute ?? now)}
          cy={y(pt?.value ?? value)}
          r={mini ? 4 : 5}
          fill="#a478ff"
          stroke="#ece2ff"
          strokeWidth="1.5"
        />
      </svg>
      {!mini && tip && pt && (
        <div className="chart-tooltip">
          <b>
            {event?.displayTime || "0"}′ · {pt.value?.toFixed(1)}
          </b>
          <span>{event?.rawText || t("中性基准", "Neutral baseline")}</span>
          {event && (
            <small>
              {t("事件规则影响", "Event weight")}:{" "}
              {eventWeights(event, side) > 0 ? "+" : ""}
              {eventWeights(event, side)} ·{" "}
              {t("净变化含时间衰减", "Net change includes decay")}
            </small>
          )}
        </div>
      )}
      {!mini && (
        <div className="chart-legend">
          <span>
            <i className="green" />
            {t("上涨", "Rising")}
          </span>
          <span>
            <i className="red" />
            {t("下跌", "Falling")}
          </span>
          <span>
            <Minus size={13} />
            {t("持平", "Flat")}
          </span>
          <small>
            {t("50 为中性 · 基于已导入事件", "50 = neutral · imported events")}
          </small>
        </div>
      )}
    </section>
  );
}
const statRows: [keyof Stats, string, string][] = [
  ["goals", "进球", "Goals"],
  ["shots", "射门", "Shots"],
  ["shotsOnTarget", "射正", "On target"],
  ["corners", "角球", "Corners"],
  ["possession", "控球率", "Possession"],
  ["passes", "传球", "Passes"],
  ["passAccuracy", "传球成功率", "Pass accuracy"],
  ["fouls", "犯规", "Fouls"],
  ["yellowCards", "黄牌", "Yellow cards"],
  ["redCards", "红牌", "Red cards"],
  ["xg", "预期进球 xG", "Expected goals"],
];
export function StatsTable({
  match,
  cursor,
  compact = false,
}: {
  match: Match;
  cursor: number;
  compact?: boolean;
}) {
  const t = useT();
  const data = statsAt(match, cursor);
  return (
    <div className="stats-table">
      <div className="stats-teams">
        <span>
          <Badge team={match.home} size={27} />
          {match.home.name}
        </span>
        <small>
          {t(
            data.label,
            data.label.startsWith("终场")
              ? "Full-time · imported stats"
              : data.label.startsWith("导入快照")
                ? "Imported snapshot · " + data.label.split("·")[1]
                : data.label.startsWith("节选")
                  ? "Excerpt · recorded events"
                  : "Recorded events to this point",
          )}
        </small>
        <span>
          {match.away.name}
          <Badge team={match.away} size={27} />
        </span>
      </div>
      {(compact ? statRows.slice(1, 4) : statRows).map(([key, cn, en]) => {
        const a = data.home[key],
          b = data.away[key];
        const fmt = (v: number | undefined) =>
          v === undefined
            ? t("未提供", "—")
            : `${v}${["possession", "passAccuracy"].includes(key) ? "%" : ""}`;
        return (
          <div className="stat-row" key={key}>
            <b>{fmt(a)}</b>
            <div className="stat-track left">
              <i
                style={{
                  width:
                    a === undefined
                      ? "0%"
                      : `${Math.max(5, (a / Math.max(a, b ?? 0, 1)) * 100)}%`,
                }}
              />
            </div>
            <span>{t(cn, en)}</span>
            <div className="stat-track">
              <i
                style={{
                  width:
                    b === undefined
                      ? "0%"
                      : `${Math.max(5, (b / Math.max(b, a ?? 0, 1)) * 100)}%`,
                }}
              />
            </div>
            <b>{fmt(b)}</b>
          </div>
        );
      })}
    </div>
  );
}
