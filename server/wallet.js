const { getPool } = require("./db");

const MIN_DEPOSIT = 1;
const MAX_DEPOSIT = 100000;

function moneyUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

function httpError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function isMissingTable(err) {
  return err && err.code === "ER_NO_SUCH_TABLE";
}

function isoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function mapWalletRow(row) {
  return {
    id: String(row.id),
    type: row.type,
    amountUsd: moneyUsd(row.amount_usd),
    balanceAfter: moneyUsd(row.balance_after),
    missionId: row.mission_id ? String(row.mission_id) : "",
    projectId: row.project_id ? String(row.project_id) : "",
    title: row.title || "",
    createdAt: isoDate(row.created_at),
  };
}

async function ensureWallet(conn, orgId) {
  await conn.query(
    `INSERT INTO wallets (organization_id, balance_usd, updated_at)
     VALUES (:orgId, 0, NOW())
     ON DUPLICATE KEY UPDATE organization_id = organization_id`,
    { orgId }
  );
}

async function readBalance(conn, orgId) {
  const [rows] = await conn.query(
    "SELECT balance_usd FROM wallets WHERE organization_id = :orgId LIMIT 1",
    { orgId }
  );
  return moneyUsd(rows[0] && rows[0].balance_usd);
}

async function applyDelta(conn, orgId, payload) {
  const amountUsd = moneyUsd(payload.amountUsd);
  if (amountUsd <= 0) throw httpError(400, "wallet.invalid_amount");
  await ensureWallet(conn, orgId);
  if (payload.type === "charge") {
    const [upd] = await conn.query(
      `UPDATE wallets
          SET balance_usd = balance_usd - :amount, updated_at = NOW()
        WHERE organization_id = :orgId AND balance_usd >= :amount`,
      { orgId, amount: amountUsd }
    );
    if (!upd.affectedRows) throw httpError(409, "wallet.insufficient");
  } else {
    await conn.query(
      `UPDATE wallets
          SET balance_usd = balance_usd + :amount, updated_at = NOW()
        WHERE organization_id = :orgId`,
      { orgId, amount: amountUsd }
    );
  }
  const balanceAfter = await readBalance(conn, orgId);
  await conn.query(
    `INSERT INTO wallet_movements
      (organization_id, type, amount_usd, balance_after, mission_id, project_id, title, created_by, created_at)
     VALUES
      (:orgId, :type, :amount, :balanceAfter, :missionId, :projectId, :title, :createdBy, NOW())`,
    {
      orgId,
      type: payload.type,
      amount: amountUsd,
      balanceAfter,
      missionId: payload.missionId || null,
      projectId: payload.projectId || null,
      title: String(payload.title || "").slice(0, 190),
      createdBy: payload.createdBy || null,
    }
  );
  return { balanceUsd: balanceAfter };
}

async function withWalletLock(orgId, fn) {
  const pool = getPool();
  const conn = await pool.getConnection();
  const key = "mklens-wallet-" + String(orgId);
  try {
    const [lock] = await conn.query("SELECT GET_LOCK(:key, 10) AS ok", { key });
    if (!lock[0] || Number(lock[0].ok) !== 1) throw httpError(409, "wallet.busy");
    try {
      return await fn(conn);
    } finally {
      await conn.query("SELECT RELEASE_LOCK(:key) AS ok", { key });
    }
  } catch (err) {
    if (isMissingTable(err)) throw httpError(503, "wallet.not_ready");
    throw err;
  } finally {
    conn.release();
  }
}

async function getWallet(orgId) {
  const pool = getPool();
  try {
    await ensureWallet(pool, orgId);
    const [rows] = await pool.query(
      "SELECT balance_usd FROM wallets WHERE organization_id = :orgId LIMIT 1",
      { orgId }
    );
    const [movements] = await pool.query(
      `SELECT id, type, amount_usd, balance_after, mission_id, project_id, title, created_at
         FROM wallet_movements
        WHERE organization_id = :orgId
        ORDER BY id DESC
        LIMIT 80`,
      { orgId }
    );
    return {
      ready: true,
      balanceUsd: moneyUsd(rows[0] && rows[0].balance_usd),
      movements: movements.map(mapWalletRow),
    };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, balanceUsd: 0, movements: [] };
    throw err;
  }
}

async function getWalletSummary(orgId) {
  const wallet = await getWallet(orgId);
  return { ready: wallet.ready, balanceUsd: wallet.balanceUsd };
}

async function depositFunds(orgId, amount, createdBy) {
  const amountUsd = moneyUsd(amount);
  if (amountUsd < MIN_DEPOSIT || amountUsd > MAX_DEPOSIT) {
    throw httpError(400, "wallet.invalid_amount");
  }
  return withWalletLock(orgId, async (conn) => {
    const result = await applyDelta(conn, orgId, {
      type: "deposit",
      amountUsd,
      title: "Ingreso de prueba (sin tarjeta)",
      createdBy,
    });
    return { balanceUsd: result.balanceUsd, amountUsd };
  });
}

async function chargeStudy(orgId, payload) {
  const amountUsd = moneyUsd(payload.amountUsd);
  if (amountUsd <= 0) return { balanceUsd: (await getWalletSummary(orgId)).balanceUsd, amountUsd: 0 };
  return withWalletLock(orgId, async (conn) => applyDelta(conn, orgId, {
    type: "charge",
    amountUsd,
    missionId: payload.missionId,
    projectId: payload.projectId,
    title: payload.title || "Compra de estudio",
    createdBy: payload.createdBy,
  }));
}

async function chargeStudyOnConn(conn, orgId, payload) {
  const amountUsd = moneyUsd(payload.amountUsd);
  if (amountUsd <= 0) return { balanceUsd: await readBalance(conn, orgId), amountUsd: 0 };
  return applyDelta(conn, orgId, {
    type: "charge",
    amountUsd,
    missionId: payload.missionId,
    projectId: payload.projectId,
    title: payload.title || "Compra de estudio",
    createdBy: payload.createdBy,
  });
}

async function refundStudyOnConn(conn, orgId, payload) {
  const amountUsd = moneyUsd(payload.amountUsd);
  if (amountUsd <= 0) return { balanceUsd: await readBalance(conn, orgId), amountUsd: 0 };
  return applyDelta(conn, orgId, {
    type: "refund",
    amountUsd,
    missionId: payload.missionId,
    projectId: payload.projectId,
    title: payload.title || "Devolución de estudio",
    createdBy: payload.createdBy,
  });
}

module.exports = {
  MIN_DEPOSIT,
  MAX_DEPOSIT,
  moneyUsd,
  getWallet,
  getWalletSummary,
  depositFunds,
  chargeStudy,
  chargeStudyOnConn,
  refundStudyOnConn,
  withWalletLock,
};
