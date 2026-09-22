<template>
  <div v-if="series.points.length" class="pro-chart" role="img" :aria-label="label">
    <svg :viewBox="'0 0 ' + W + ' ' + H" preserveAspectRatio="xMidYMid meet">
      <g v-for="tick in yTicks" :key="'g-' + tick.value">
        <line
          class="pro-chart-grid"
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="tick.y"
          :y2="tick.y"
        />
        <text class="pro-chart-y" :x="PAD.l - 8" :y="tick.y + 3">{{ tick.label }}</text>
      </g>
      <g v-for="(bar, i) in bars" :key="bar.day">
        <rect
          class="pro-chart-bar"
          :class="{ 'is-empty': !bar.count, 'is-active': hoverIndex === i }"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          rx="3"
        />
        <text class="pro-chart-x" :x="bar.cx" :y="H - 8">{{ bar.label }}</text>
        <rect
          class="pro-chart-hit"
          :x="bar.slotX"
          :y="PAD.t"
          :width="bar.slotW"
          :height="plotH"
          @mouseenter="hoverIndex = i"
          @mouseleave="hoverIndex = -1"
        />
      </g>
    </svg>
    <div v-if="hovered" class="pro-chart-tip" :style="tipStyle">
      <strong>{{ hovered.dateLabel }}</strong>
      <span>{{ hovered.value }}</span>
    </div>
  </div>
  <p v-else class="muted">{{ empty }}</p>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { chartSeries, parseDay } from "../chartSeries";

const { t } = useI18n();

const props = defineProps({
  points: { type: Array, default: () => [] },
  label: { type: String, default: "" },
  empty: { type: String, default: "" },
  valueLabel: { type: Function, default: null },
  locale: { type: String, default: "es" },
});

const W = 720;
const H = 260;
const PAD = { t: 12, r: 8, b: 28, l: 40 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const plotBottom = H - PAD.b;
const hoverIndex = ref(-1);
const series = computed(() => chartSeries(props.points));
const weekly = computed(() => series.value.mode === "week");
const monthly = computed(() => series.value.mode === "month");
const grouped = computed(() => weekly.value || monthly.value);

function formatCount(count) {
  return new Intl.NumberFormat(props.locale).format(Number(count || 0));
}

function niceMax(value) {
  const max = Math.max(1, Number(value || 0));
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

const maxValue = computed(() => {
  const values = series.value.points.map((point) => Number(point.count || 0));
  return niceMax(Math.max(0, ...values));
});

const yTicks = computed(() => {
  const steps = 3;
  const top = maxValue.value;
  const ticks = [];
  for (let i = 1; i <= steps; i += 1) {
    const value = (top / steps) * i;
    const y = plotBottom - (value / top) * plotH;
    ticks.push({ value, y, label: formatCount(Math.round(value)) });
  }
  return ticks;
});

function formatShort(day) {
  const date = parseDay(day);
  if (!date) return String(day).slice(-2);
  const month = new Intl.DateTimeFormat(props.locale, { month: "short" }).format(date).replace(".", "");
  return date.getDate() + " " + month;
}

function formatMonth(day, width) {
  const date = parseDay(day);
  if (!date) return String(day).slice(0, 7);
  return new Intl.DateTimeFormat(props.locale, { month: width, year: width === "long" ? "numeric" : undefined }).format(date);
}

function weekRange(point) {
  const from = point.from || point.day;
  const to = point.to || point.day;
  if (from === to) return formatShort(from);
  return formatShort(from) + " – " + formatShort(to);
}

function xLabel(point, index, list) {
  const day = grouped.value ? point.from || point.day : point.day;
  const date = parseDay(day);
  if (!date) return String(day).slice(-2);
  if (monthly.value) return formatMonth(day, "short").replace(".", "");
  if (weekly.value) return t("projectDetail.weekAxis", { label: formatShort(day) });
  const prev = index > 0 ? parseDay(list[index - 1].day) : null;
  if (!prev || prev.getMonth() !== date.getMonth()) return formatShort(day);
  return String(date.getDate());
}

function dateLabel(point) {
  if (monthly.value) {
    return t("projectDetail.monthTip", { month: formatMonth(point.from || point.day, "long") });
  }
  if (weekly.value && (point.from || point.day)) {
    return t("projectDetail.weekTip", { range: weekRange(point) });
  }
  const date = parseDay(point.day);
  if (!date) return point.day;
  return new Intl.DateTimeFormat(props.locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

const bars = computed(() => {
  const list = series.value.points;
  const n = list.length || 1;
  const slotW = plotW / n;
  const barW = Math.max(6, Math.min(grouped.value ? 40 : 18, slotW * (grouped.value ? 0.5 : 0.42)));
  const top = maxValue.value || 1;
  return list.map((point, index) => {
    const count = Number(point.count || 0);
    const slotX = PAD.l + slotW * index;
    const h = Math.max(count ? 3 : 1, (count / top) * plotH);
    const x = slotX + (slotW - barW) / 2;
    const y = plotBottom - h;
    return {
      day: point.day,
      count,
      slotX,
      slotW,
      x,
      y,
      w: barW,
      h,
      cx: x + barW / 2,
      label: xLabel(point, index, list),
      dateLabel: dateLabel(point),
      value: props.valueLabel ? props.valueLabel(count) : formatCount(count),
    };
  });
});

const hovered = computed(() => (hoverIndex.value >= 0 ? bars.value[hoverIndex.value] : null));

const tipStyle = computed(() => {
  if (!hovered.value) return {};
  const left = (hovered.value.cx / W) * 100;
  return {
    left: left + "%",
    transform: left > 72 ? "translate(-100%, -8px)" : "translate(-50%, -8px)",
  };
});
</script>
