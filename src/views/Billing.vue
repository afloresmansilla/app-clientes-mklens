<template>
  <div>
    <div class="page-head">
      <div>
        <p class="muted" style="margin:0">{{ t("wallet.hint") }}</p>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="wallet.ready === false" class="error">{{ t("errors.wallet.not_ready") }}</p>
    <p v-if="saved" class="muted">{{ t("wallet.deposited", { amount: formatUsd(lastDeposit) }) }}</p>
    <div class="wallet-layout">
      <article class="card wallet-hero">
        <small>{{ t("wallet.balance") }}</small>
        <strong>{{ formatUsd(wallet.balanceUsd) }}</strong>
        <p class="muted">{{ t("wallet.balanceHint") }}</p>
      </article>
      <article class="card">
        <h2>{{ t("wallet.depositTitle") }}</h2>
        <p class="muted">{{ t("wallet.depositHint") }}</p>
        <div class="wallet-presets">
          <button
            v-for="item in presets"
            :key="item"
            class="btn btn-ghost btn-sm"
            type="button"
            @click="amount = item"
          >
            {{ formatUsd(item) }}
          </button>
        </div>
        <form class="wallet-deposit" @submit.prevent="onDeposit">
          <div class="field">
            <label>{{ t("wallet.amount") }}</label>
            <input v-model.number="amount" type="number" min="1" max="100000" step="0.01" required />
          </div>
          <button class="btn btn-accent" type="submit" :disabled="saving">
            {{ saving ? t("wallet.depositing") : t("wallet.deposit") }}
          </button>
        </form>
      </article>
    </div>

    <article class="card" style="margin-top:16px">
      <h2>{{ t("wallet.movements") }}</h2>
      <table class="table" style="margin-top:12px">
        <thead>
          <tr>
            <th>{{ t("wallet.colDate") }}</th>
            <th>{{ t("wallet.colConcept") }}</th>
            <th>{{ t("wallet.colAmount") }}</th>
            <th>{{ t("wallet.colBalance") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(wallet.movements || []).length">
            <td colspan="4" class="muted">{{ t("wallet.noMovements") }}</td>
          </tr>
          <tr v-for="item in wallet.movements || []" :key="item.id">
            <td>{{ formatWhen(item.createdAt) }}</td>
            <td>
              <strong>{{ movementLabel(item.type) }}</strong>
              <div v-if="item.title" class="muted">{{ item.title }}</div>
            </td>
            <td>
              <span :class="item.type === 'charge' ? 'amount-neg' : 'amount-pos'">
                {{ signedAmount(item) }}
              </span>
            </td>
            <td>{{ formatUsd(item.balanceAfter) }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <div class="grid-2" style="margin-top:16px">
      <article class="card">
        <h2>{{ t("billing.billingData") }}</h2>
        <p><strong>{{ billing.org && billing.org.name }}</strong></p>
        <p class="muted">{{ billing.org && billing.org.taxId }}</p>
        <p class="muted">{{ billing.org && billing.org.address }}</p>
        <p class="muted">{{ billing.org && billing.org.billingEmail }}</p>
        <RouterLink class="btn btn-ghost" style="margin-top:12px" to="/ajustes">{{ t("billing.edit") }}</RouterLink>
      </article>
      <article class="card">
        <h2>{{ t("billing.invoices") }}</h2>
        <p v-if="!(billing.invoices || []).length" class="muted">{{ t("billing.noInvoices") }}</p>
        <table v-else class="table" style="margin-top:12px">
          <thead>
            <tr>
              <th>{{ t("billing.number") }}</th>
              <th>{{ t("billing.date") }}</th>
              <th>{{ t("billing.amount") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in billing.invoices || []" :key="inv.id">
              <td>{{ inv.id }}</td>
              <td>{{ formatWhen(inv.date) }}</td>
              <td>{{ inv.amount }} €</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
    <LoadingModal v-if="loading || saving" />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { apiMessage } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";

const { t, te, locale } = useI18n();
const wallet = ref({ balanceUsd: 0, movements: [] });
const billing = ref({ org: {}, invoices: [] });
const amount = ref(250);
const presets = [100, 250, 500, 1000, 2500];
const error = ref("");
const saved = ref(false);
const lastDeposit = ref(0);
const loading = ref(true);
const saving = ref(false);

function formatUsd(value) {
  return new Intl.NumberFormat(locale.value, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function movementLabel(type) {
  if (te("wallet.types." + type)) return t("wallet.types." + type);
  return type;
}

function signedAmount(item) {
  const n = Number(item.amountUsd || 0);
  const signed = item.type === "charge" ? -n : n;
  const formatted = formatUsd(Math.abs(signed));
  return (signed < 0 ? "−" : "+") + formatted;
}

async function refresh() {
  const [walletRes, billingRes] = await Promise.all([api("/wallet"), api("/billing")]);
  wallet.value = walletRes.wallet || { balanceUsd: 0, movements: [] };
  billing.value = billingRes;
}

async function onDeposit() {
  error.value = "";
  saved.value = false;
  saving.value = true;
  try {
    const res = await api("/wallet/deposit", { method: "POST", body: { amount: Number(amount.value) } });
    wallet.value = res.wallet || wallet.value;
    lastDeposit.value = Number(res.deposited || amount.value || 0);
    saved.value = true;
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.wallet.deposit_failed");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.wallet.load_failed");
  } finally {
    loading.value = false;
  }
});
</script>
