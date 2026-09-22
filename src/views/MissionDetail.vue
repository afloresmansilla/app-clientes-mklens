<template>
  <div v-if="project && mission">
    <div class="page-head">
      <div>
        <p class="muted" style="margin:0 0 8px">
          <RouterLink :to="'/estudios/' + project.id">{{ t("missionDetail.back") }}</RouterLink>
        </p>
        <h2 style="font-size:28px">{{ project.name }}</h2>
        <p class="muted meta-line">
          <ProductIcon :product="project.product" />
          <span aria-hidden="true">·</span>
          <MarketFlag :market="project.market" />
        </p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <span class="badge" :class="mission.status === 'active' ? 'ok' : 'idle'">
          {{ missionStatusLabel(mission.status) }}
        </span>
        <span v-if="mission.purchased" class="badge ok">{{ t("projectDetail.bought") }}</span>
        <button
          v-else-if="!project.subscribed"
          class="btn btn-accent"
          type="button"
          :disabled="subscribing"
          @click="subscribe"
        >
          {{ subscribing ? t("projects.subscribing") : t("projects.subscribe") }}
        </button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <article v-if="project.subscribed && mission.buyable && !mission.purchased" class="card wallet-buy">
      <div>
        <strong>{{ formatUsd(wallet.balanceUsd) }}</strong>
        <span>{{ t("wallet.balance") }}</span>
      </div>
      <div>
        <strong>{{ formatUsd(mission.studyPriceUsd) }}</strong>
        <span>{{ t("parseo.studyPrice") }}</span>
      </div>
      <div class="wallet-buy-action">
        <p v-if="!canAfford" class="error" style="margin:0">
          {{ t("wallet.needMore", { amount: formatUsd(shortfall) }) }}
        </p>
        <p v-else class="muted" style="margin:0">{{ t("wallet.chargeHint") }}</p>
        <button
          v-if="canAfford"
          class="btn btn-accent"
          type="button"
          :disabled="buying"
          @click="buy"
        >
          {{ buying ? t("projectDetail.buying") : t("projectDetail.buyFor", { amount: formatUsd(mission.studyPriceUsd) }) }}
        </button>
        <RouterLink v-else class="btn btn-accent" to="/facturacion">{{ t("wallet.goDeposit") }}</RouterLink>
      </div>
    </article>
    <div class="grid-4">
      <article class="card kpi">
        <strong>{{ formatNumber(mission.pseudocompras) }}</strong>
        <span>{{ t("projectDetail.pseudocompras") }}</span>
      </article>
      <article class="card kpi">
        <strong>{{ formatNumber(mission.verifiedPseudocompras) }}</strong>
        <span>{{ t("projectDetail.verified") }}</span>
      </article>
      <article class="card kpi">
        <strong>{{ formatDay(mission.fieldStartedAt) }}</strong>
        <span>{{ t("projectDetail.fieldStart") }}</span>
      </article>
      <article class="card kpi">
        <strong>{{ formatDay(mission.fieldEndedAt) }}</strong>
        <span>{{ t("projectDetail.fieldEnd") }}</span>
      </article>
    </div>
    <div class="mission-split">
      <article class="card mission-chart">
        <h2>{{ chartTitle }}</h2>
        <p class="muted">{{ chartHint }}</p>
        <FieldChart
          :points="mission.dailyPaid || []"
          :label="chartTitle"
          :empty="t('projectDetail.dailyEmpty')"
          :value-label="chartValueLabel"
          :locale="locale"
        />
      </article>
      <article class="card parseo-side">
        <div class="parseo-study-head">
          <div>
            <h2>{{ t("parseo.title") }}</h2>
            <p class="muted">{{ t("parseo.hint") }}</p>
          </div>
        </div>
        <button
          v-if="mission.purchased && parseo.exists"
          class="parseo-study-price"
          type="button"
          @click="showDownload = true"
        >
          <small>{{ t("parseo.downloadExcel") }}</small>
          <strong>{{ t("parseo.download") }}</strong>
        </button>
        <div v-else-if="!mission.purchased" class="parseo-study-prices">
          <div class="parseo-study-price">
            <small>{{ t("parseo.studyPrice") }}</small>
            <strong>{{ formatUsd(mission.studyPriceUsd) }}</strong>
          </div>
          <div v-if="!canAfford" class="parseo-study-price is-short">
            <small>{{ t("parseo.shortfall") }}</small>
            <strong>{{ formatUsd(shortfall) }}</strong>
          </div>
        </div>
        <template v-if="parseo.exists">
          <div class="parseo-side-kpis">
            <article class="kpi">
              <strong>{{ formatUsdRate(pricePerQuote) }}</strong>
              <span>{{ t("parseo.costPerQuote") }}</span>
            </article>
            <article class="kpi">
              <strong>{{ formatNumber(parseo.quotes) }}</strong>
              <span>{{ t("parseo.quotes") }}</span>
            </article>
            <article class="kpi">
              <strong>{{ formatNumber(parseo.comparisons) }}</strong>
              <span>{{ t("parseo.comparisons") }}</span>
            </article>
            <article class="kpi">
              <strong :class="{ 'is-blurred': lockedPrices }">{{ premiumText(parseo.avgPrice) }}</strong>
              <span>{{ t("parseo.avgPrice") }}</span>
            </article>
          </div>
          <div v-if="parseo.coverBreakdown.length" class="cover-mix">
            <div class="cover-mix-bar">
              <span
                v-for="item in parseo.coverBreakdown"
                :key="'bar-' + item.cover"
                class="cover-mix-seg"
                :class="'is-' + item.cover"
                :style="{ width: coverShare(item) + '%' }"
                :title="coverLabel(item.cover) + ' · ' + formatNumber(item.quotes)"
              />
            </div>
            <ul>
              <li v-for="item in parseo.coverBreakdown" :key="item.cover">
                <i :class="'is-' + item.cover"></i>
                <span>{{ coverLabel(item.cover) }}</span>
                <strong>{{ coverShare(item) }}%</strong>
                <small>{{ formatNumber(item.quotes) }}</small>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="muted">{{ t("parseo.empty") }}</p>
      </article>
    </div>
    <div v-if="parseo.exists" class="parseo-brands">
      <article v-for="brand in parseo.brandRows" :key="brand.brandId" class="parseo-brand">
        <header>
          <img
            v-if="brand.logo && !failedLogos.has(brand.logo)"
            class="parseo-brand-logo"
            :src="brand.logo"
            :alt="brand.brandName"
            @error="failLogo(brand.logo)"
          />
          <span v-else class="parseo-brand-fallback">{{ brandInitials(brand.brandName) }}</span>
          <div>
            <h3>{{ brand.brandName }}</h3>
            <p class="muted">{{ t("parseo.brandProducts", { n: formatNumber(brand.products.length) }) }}</p>
          </div>
        </header>
        <div class="parseo-brand-cols">
          <span>{{ t("parseo.colProduct") }}</span>
          <span>{{ t("parseo.premium") }}</span>
          <span>{{ t("parseo.records") }}</span>
        </div>
        <ul>
          <li v-for="item in brand.products" :key="item.code + '-' + item.cover">
            <span>{{ item.productName || coverLabel(item.cover) }}</span>
            <strong :class="{ 'is-blurred': lockedPrices }">{{ premiumText(item.avgPrice) }}</strong>
            <em>{{ formatNumber(item.quotes) }}</em>
          </li>
        </ul>
      </article>
    </div>
  </div>
  <article v-else-if="error" class="card empty">{{ error }}</article>
  <DownloadPricesModal
    v-if="showDownload"
    :covers="parseo.coverBreakdown || []"
    :brands="parseo.brandRows || []"
    :busy="downloading"
    :error="downloadError"
    @close="closeDownload"
    @download="downloadPrices"
  />
  <LoadingModal v-if="(!project && !error) || buying || subscribing" />
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { api, apiFile } from "../api";
import { apiMessage, labelOf } from "../i18n";
import DownloadPricesModal from "../components/DownloadPricesModal.vue";
import FieldChart from "../components/FieldChart.vue";
import { chartGranularity } from "../chartSeries";
import LoadingModal from "../components/LoadingModal.vue";
import MarketFlag from "../components/MarketFlag.vue";
import ProductIcon from "../components/ProductIcon.vue";

const { t, te, locale } = useI18n();
const route = useRoute();
const project = ref(null);
const mission = ref(null);
const error = ref("");
const buying = ref(false);
const subscribing = ref(false);
const showDownload = ref(false);
const downloading = ref(false);
const downloadError = ref("");
const wallet = ref({ balanceUsd: 0 });
const parseo = computed(() => (mission.value && mission.value.parseo) || { exists: false, coverBreakdown: [], brandRows: [] });
const chartMode = computed(() => chartGranularity((mission.value && mission.value.dailyPaid) || []));
const chartTitle = computed(() => {
  if (chartMode.value === "month") return t("projectDetail.dailyTitleMonth");
  if (chartMode.value === "week") return t("projectDetail.dailyTitleWeek");
  return t("projectDetail.dailyTitle");
});
const chartHint = computed(() => {
  if (chartMode.value === "month") return t("projectDetail.dailyHintMonth");
  if (chartMode.value === "week") return t("projectDetail.dailyHintWeek");
  return t("projectDetail.dailyHint");
});
const lockedPrices = computed(() => !(mission.value && mission.value.purchased));
const canAfford = computed(() => Number(wallet.value.balanceUsd || 0) >= Number((mission.value && mission.value.studyPriceUsd) || 0));
const shortfall = computed(() =>
  Math.max(0, Number((mission.value && mission.value.studyPriceUsd) || 0) - Number(wallet.value.balanceUsd || 0))
);
const failedLogos = ref(new Set());
const coverTotal = computed(() =>
  (parseo.value.coverBreakdown || []).reduce((sum, item) => sum + Number(item.quotes || 0), 0)
);
const pricePerQuote = computed(() => {
  const quotes = Number(parseo.value.quotes || 0);
  const usd = Number(mission.value && mission.value.studyPriceUsd);
  if (!quotes || !Number.isFinite(usd)) return null;
  return usd / quotes;
});

function missionStatusLabel(status) {
  return labelOf(t, te, "missionStatus", status);
}

function editionApi(suffix) {
  return "/estudios/" + route.params.id + "/ediciones/" + route.params.editionId + (suffix || "");
}

function formatNumber(value) {
  return new Intl.NumberFormat(locale.value).format(Number(value || 0));
}

function formatUsd(value) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat(locale.value, { style: "currency", currency: "USD" }).format(Number(value));
}

function formatUsdRate(value) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat(locale.value, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(Number(value));
}

function formatMoney(value) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat(locale.value, { style: "currency", currency: "EUR" }).format(Number(value));
}

function premiumText(value) {
  if (!lockedPrices.value) return formatMoney(value);
  return new Intl.NumberFormat(locale.value, { style: "currency", currency: "EUR" }).format(1234.56);
}

function coverShare(item) {
  if (!coverTotal.value) return 0;
  return Math.round((Number(item.quotes || 0) / coverTotal.value) * 100);
}

function coverLabel(cover) {
  return labelOf(t, te, "covers", cover);
}

function brandInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function failLogo(src) {
  if (!src || failedLogos.value.has(src)) return;
  const next = new Set(failedLogos.value);
  next.add(src);
  failedLogos.value = next;
}

function formatDay(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function chartValueLabel(count) {
  return t("projectDetail.dailyPoint", { n: formatNumber(count) });
}

function applyPayload(res) {
  project.value = res.project;
  mission.value = res.mission;
  if (res.wallet) wallet.value = res.wallet;
}

async function subscribe() {
  error.value = "";
  subscribing.value = true;
  try {
    await api("/estudios/" + route.params.id + "/subscribe", { method: "POST" });
    const res = await api(editionApi());
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.subscribe_failed");
  } finally {
    subscribing.value = false;
  }
}

function closeDownload() {
  if (downloading.value) return;
  showDownload.value = false;
  downloadError.value = "";
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadPrices(selection) {
  downloadError.value = "";
  downloading.value = true;
  try {
    const file = await apiFile(
      editionApi("/prices/export"),
      { method: "POST", body: selection }
    );
    saveBlob(file.blob, file.filename);
    showDownload.value = false;
  } catch (e) {
    downloadError.value = apiMessage(t, te, e, "errors.parseo.download_failed");
  } finally {
    downloading.value = false;
  }
}

async function buy() {
  error.value = "";
  buying.value = true;
  try {
    const res = await api(editionApi("/buy"), {
      method: "POST",
    });
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.buy_failed");
  } finally {
    buying.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await api(editionApi());
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.mission_not_found");
  }
});
</script>
