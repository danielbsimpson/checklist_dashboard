/**
 * ChartPrimitives.tsx
 * -------------------
 * Lightweight bar and line chart components built directly on react-native-svg.
 * Works on both web and native without any extra dependencies.
 *
 * Exports:
 *   SimpleBarChart  — vertical bar chart with optional reference line
 *   SimpleLineChart — multi-series line chart (up to 4 series)
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  G,
  Line,
  Path,
  Rect,
  Svg,
  Text as SvgText,
} from "react-native-svg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BarItem {
  value: number;
  label?: string;
  color?: string;
}

export interface LinePoint {
  value: number;
}

export interface LineSeries {
  data: LinePoint[];
  color: string;
  label?: string;
  thickness?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAD_LEFT  = 36; // room for y-axis labels
const PAD_RIGHT = 8;
const PAD_TOP   = 16;
const PAD_BOT   = 40; // room for x-axis labels
const RULE_COLOR    = "#2d2f30";
const AXIS_COLOR    = "#2d2f30";
const LABEL_COLOR   = "#9BA1A6";
const LABEL_SIZE    = 9;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function yForValue(v: number, maxVal: number, innerH: number): number {
  return innerH - (v / maxVal) * innerH;
}

function niceMax(values: number[]): number {
  const max = Math.max(...values, 1);
  return Math.ceil(max / 20) * 20;
}

// ─── SimpleBarChart ───────────────────────────────────────────────────────────

interface BarChartProps {
  data: BarItem[];
  /** Default colour for all bars */
  color?: string;
  /** Total SVG width  */
  width?: number;
  /** Total SVG height */
  height?: number;
  /** Max y-axis value (auto if omitted) */
  maxValue?: number;
  /** Draw a dashed horizontal reference line */
  refLineValue?: number;
  refLineColor?: string;
  /** Number of y-axis grid lines */
  sections?: number;
}

export function SimpleBarChart({
  data,
  color = "#3498db",
  width = 320,
  height = 200,
  maxValue,
  refLineValue,
  refLineColor = "#686e72",
  sections = 5,
}: BarChartProps) {
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOT;
  const max = maxValue ?? niceMax(data.map((d) => d.value));

  const barW = Math.max(4, (innerW / data.length) * 0.65);
  const gap  = innerW / data.length;

  return (
    <Svg width={width} height={height}>
      {/* Grid lines + y labels */}
      {Array.from({ length: sections + 1 }, (_, i) => {
        const v = (max / sections) * i;
        const y = PAD_TOP + yForValue(v, max, innerH);
        return (
          <G key={i}>
            <Line
              x1={PAD_LEFT} y1={y}
              x2={PAD_LEFT + innerW} y2={y}
              stroke={RULE_COLOR} strokeWidth={0.5}
            />
            <SvgText
              x={PAD_LEFT - 4} y={y + 3}
              fontSize={LABEL_SIZE} fill={LABEL_COLOR}
              textAnchor="end"
            >
              {v.toFixed(0)}
            </SvgText>
          </G>
        );
      })}

      {/* Reference line */}
      {refLineValue !== undefined && (
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP + yForValue(refLineValue, max, innerH)}
          x2={PAD_LEFT + innerW}
          y2={PAD_TOP + yForValue(refLineValue, max, innerH)}
          stroke={refLineColor}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (Math.max(d.value, 0) / max) * innerH;
        const x = PAD_LEFT + i * gap + (gap - barW) / 2;
        const y = PAD_TOP + innerH - barH;
        return (
          <G key={i}>
            <Rect
              x={x} y={y}
              width={barW} height={Math.max(barH, 0)}
              fill={d.color ?? color}
              rx={2} ry={2}
            />
          </G>
        );
      })}

      {/* X-axis baseline */}
      <Line
        x1={PAD_LEFT} y1={PAD_TOP + innerH}
        x2={PAD_LEFT + innerW} y2={PAD_TOP + innerH}
        stroke={AXIS_COLOR} strokeWidth={1}
      />

      {/* X-axis labels — rotate for long labels */}
      {data.map((d, i) => {
        if (!d.label) return null;
        const cx = PAD_LEFT + i * gap + gap / 2;
        const cy = PAD_TOP + innerH + 6;
        return (
          <SvgText
            key={i}
            x={cx} y={cy}
            fontSize={LABEL_SIZE} fill={LABEL_COLOR}
            textAnchor="end"
            transform={`rotate(-40, ${cx}, ${cy})`}
          >
            {d.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── SimpleLineChart ──────────────────────────────────────────────────────────

interface LineChartProps {
  series: LineSeries[];
  width?: number;
  height?: number;
  maxValue?: number;
  sections?: number;
  /** Evenly-spaced x-axis labels */
  xLabels?: string[];
  xLabelCount?: number;
}

export function SimpleLineChart({
  series,
  width = 320,
  height = 200,
  maxValue,
  sections = 5,
  xLabels,
  xLabelCount = 5,
}: LineChartProps) {
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOT;

  const allValues = series.flatMap((s) => s.data.map((p) => p.value));
  const max = maxValue ?? niceMax(allValues);

  const paths = useMemo(() => {
    return series.map((s) => {
      const n = s.data.length;
      if (n === 0) return "";
      const pts = s.data.map((p, i) => {
        const x = PAD_LEFT + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const y = PAD_TOP  + yForValue(p.value, max, innerH);
        return { x, y };
      });
      return pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
    });
  }, [series, innerW, innerH, max]);

  const totalPoints = Math.max(...series.map((s) => s.data.length), 1);
  const tickEvery = Math.max(1, Math.floor(totalPoints / xLabelCount));

  return (
    <Svg width={width} height={height}>
      {/* Grid lines + y labels */}
      {Array.from({ length: sections + 1 }, (_, i) => {
        const v = (max / sections) * i;
        const y = PAD_TOP + yForValue(v, max, innerH);
        return (
          <G key={i}>
            <Line
              x1={PAD_LEFT} y1={y}
              x2={PAD_LEFT + innerW} y2={y}
              stroke={RULE_COLOR} strokeWidth={0.5}
            />
            <SvgText
              x={PAD_LEFT - 4} y={y + 3}
              fontSize={LABEL_SIZE} fill={LABEL_COLOR}
              textAnchor="end"
            >
              {v.toFixed(0)}
            </SvgText>
          </G>
        );
      })}

      {/* Lines */}
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={series[i].color}
          strokeWidth={series[i].thickness ?? 2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* X-axis baseline */}
      <Line
        x1={PAD_LEFT} y1={PAD_TOP + innerH}
        x2={PAD_LEFT + innerW} y2={PAD_TOP + innerH}
        stroke={AXIS_COLOR} strokeWidth={1}
      />

      {/* X-axis labels */}
      {xLabels &&
        xLabels.map((label, i) => {
          if (i % tickEvery !== 0 && i !== xLabels.length - 1) return null;
          const n = xLabels.length;
          const x = PAD_LEFT + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
          const y = PAD_TOP + innerH + 6;
          return (
            <SvgText
              key={i}
              x={x} y={y}
              fontSize={LABEL_SIZE} fill={LABEL_COLOR}
              textAnchor="end"
              transform={`rotate(-40, ${x}, ${y})`}
            >
              {label}
            </SvgText>
          );
        })}
    </Svg>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <View style={styles.legend}>
      {items.map(({ label, color }) => (
        <View key={label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    color: "#9BA1A6",
    fontSize: 12,
  },
});
