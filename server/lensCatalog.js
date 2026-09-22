const { getLensPool } = require("./db");
const { loadParseo, emptyParseo, redactParseoPrices, exportParseoPrices, loadBrandLogosForRefs } = require("./parseo");
const { withWalletLock, chargeStudyOnConn, refundStudyOnConn } = require("./wallet");

const POINTS_TO_USD_RATE = 0.0001;
const STUDY_PRICE_MARKUP = 1.5;
const CATALOG_STATUSES = ["open", "active"];

function moneyUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number(n.toFixed(2));
}

function priceFromPaidPoints(points) {
  const paidPoints = Number(points || 0);
  const costUsd = moneyUsd(paidPoints * POINTS_TO_USD_RATE);
  return {
    paidPoints,
    studyCostUsd: costUsd,
    studyPriceUsd: moneyUsd(costUsd * STUDY_PRICE_MARKUP),
  };
}

function orgExternalRef(organizationId) {
  return "mklens-org-" + String(organizationId);
}

function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function truthyFlag(value) {
  if (value == null || value === false || value === 0 || value === "0") return false;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.length > 0 && value.some((byte) => byte !== 0);
  }
  if (typeof value === "bigint") return value !== 0n;
  const n = Number(value);
  if (Number.isFinite(n)) return n !== 0;
  return Boolean(value);
}

function mapCatalogProject(row) {
  const id = String(row.id);
  const hasLogo = truthyFlag(row.has_logo);
  const logoVersion = row.logo_updated_at ? encodeURIComponent(String(row.logo_updated_at)) : String(Date.now());
  return {
    id,
    name: row.name,
    sourceKey: row.source_key || "",
    sourceName: row.source_name || "",
    sourceUrl: row.source_url || "",
    market: row.market || "",
    product: row.product || "",
    status: row.status,
    coverage: Number(row.coverage || 0),
    missionsCount: Number(row.missions_count || 0),
    notes: row.notes || "",
    description: row.description || "",
    hasLogo,
    logoUrl: "/api/estudios/" + id + "/logo?v=" + logoVersion,
    subscribed: row.subscription_status === "active",
    updatedAt: formatDate(row.updated_at),
  };
}

function packCounts(paid, cancelled) {
  const paidMissions = Number(paid || 0);
  const cancelledMissions = Number(cancelled || 0);
  return {
    paidMissions,
    cancelledMissions,
    pseudocompras: paidMissions + cancelledMissions,
    verifiedPseudocompras: paidMissions,
  };
}

function emptyFieldStats() {
  return Object.assign(packCounts(0, 0), priceFromPaidPoints(0), {
    fieldStartedAt: "",
    fieldEndedAt: "",
    dailyPaid: [],
  });
}

function addDaysIso(iso, days) {
  const parts = String(iso)
    .split("-")
    .map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return iso;
  const date = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return formatDate(date);
}

function fillDailySeries(startedAt, endedAt, countsByDay) {
  if (!startedAt || !endedAt) return [];
  const series = [];
  let cursor = startedAt;
  let guard = 0;
  while (cursor <= endedAt && guard < 400) {
    series.push({ day: cursor, count: Number(countsByDay[cursor] || 0) });
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  return series;
}

function mapFieldStats(totalRow, dailyRows) {
  const paidMissions = Number((totalRow && totalRow.paid_missions) || 0);
  const cancelledMissions = Number((totalRow && totalRow.cancelled_missions) || 0);
  const fieldStartedAt = (totalRow && totalRow.field_started_at) || "";
  const fieldEndedAt = (totalRow && totalRow.field_ended_at) || "";
  const countsByDay = {};
  (dailyRows || []).forEach((row) => {
    if (!row.day) return;
    countsByDay[row.day] = Number(row.paid_missions || 0);
  });
  return Object.assign(packCounts(paidMissions, cancelledMissions), priceFromPaidPoints(totalRow && totalRow.paid_points), {
    fieldStartedAt,
    fieldEndedAt,
    dailyPaid: fillDailySeries(fieldStartedAt, fieldEndedAt, countsByDay),
  });
}

function aggregateFieldStats(perMission) {
  const missions = Object.values(perMission || {});
  if (!missions.length) return emptyFieldStats();
  const countsByDay = {};
  let paidMissions = 0;
  let cancelledMissions = 0;
  let paidPoints = 0;
  let fieldStartedAt = "";
  let fieldEndedAt = "";
  missions.forEach((stats) => {
    paidMissions += Number(stats.paidMissions || 0);
    cancelledMissions += Number(stats.cancelledMissions || 0);
    paidPoints += Number(stats.paidPoints || 0);
    if (stats.fieldStartedAt && (!fieldStartedAt || stats.fieldStartedAt < fieldStartedAt)) {
      fieldStartedAt = stats.fieldStartedAt;
    }
    if (stats.fieldEndedAt && (!fieldEndedAt || stats.fieldEndedAt > fieldEndedAt)) {
      fieldEndedAt = stats.fieldEndedAt;
    }
    (stats.dailyPaid || []).forEach((point) => {
      countsByDay[point.day] = Number(countsByDay[point.day] || 0) + Number(point.count || 0);
    });
  });
  return Object.assign(packCounts(paidMissions, cancelledMissions), priceFromPaidPoints(paidPoints), {
    fieldStartedAt,
    fieldEndedAt,
    dailyPaid: fillDailySeries(fieldStartedAt, fieldEndedAt, countsByDay),
  });
}

async function loadProjectFieldStats(pool, projectId, missionId) {
  const missionFilter = missionId ? " AND ma.mission_id = :missionId" : "";
  const params = { projectId, missionId: missionId || 0 };
  const [totals] = await pool.query(
    `SELECT ma.mission_id,
            SUM(ma.status = 'paid') AS paid_missions,
            SUM(ma.status = 'cancelled') AS cancelled_missions,
            SUM(CASE WHEN ma.status = 'paid' THEN m.reward_points ELSE 0 END) AS paid_points,
            DATE_FORMAT(
              MIN(CASE WHEN ma.status = 'paid' THEN COALESCE(ma.updated_at, ma.assigned_at) END),
              '%Y-%m-%d'
            ) AS field_started_at,
            DATE_FORMAT(
              MAX(CASE WHEN ma.status = 'paid' THEN COALESCE(ma.updated_at, ma.assigned_at) END),
              '%Y-%m-%d'
            ) AS field_ended_at
       FROM mission_assignments ma
       JOIN missions m ON m.id = ma.mission_id
       JOIN general_project_missions gpm ON gpm.mission_id = ma.mission_id
      WHERE gpm.project_id = :projectId
        AND ma.status IN ('paid', 'cancelled')${missionFilter}
      GROUP BY ma.mission_id`,
    params
  );
  const [daily] = await pool.query(
    `SELECT ma.mission_id,
            DATE_FORMAT(COALESCE(ma.updated_at, ma.assigned_at), '%Y-%m-%d') AS day,
            COUNT(*) AS paid_missions
       FROM mission_assignments ma
       JOIN general_project_missions gpm ON gpm.mission_id = ma.mission_id
      WHERE gpm.project_id = :projectId
        AND ma.status = 'paid'${missionFilter}
      GROUP BY ma.mission_id, DATE_FORMAT(COALESCE(ma.updated_at, ma.assigned_at), '%Y-%m-%d')
      ORDER BY day ASC`,
    params
  );
  const dailyByMission = {};
  daily.forEach((row) => {
    const id = String(row.mission_id);
    if (!dailyByMission[id]) dailyByMission[id] = [];
    dailyByMission[id].push(row);
  });
  const byMission = {};
  totals.forEach((row) => {
    const id = String(row.mission_id);
    byMission[id] = mapFieldStats(row, dailyByMission[id] || []);
  });
  return byMission;
}

function mapCatalogMission(row, fieldStats) {
  const status = String(row.mission_status || "").toLowerCase();
  const purchased = row.purchase_status === "active";
  const stats = fieldStats || emptyFieldStats();
  const parseo = row.parseo || emptyParseo(row.mission_external_ref);
  return {
    id: String(row.mission_id),
    title: row.mission_title || "",
    status,
    rewardPoints: Number(row.mission_reward_points || 0),
    countryCode: row.mission_country_code || "",
    externalRef: row.mission_external_ref || "",
    purchased,
    purchasedAt: formatDate(row.purchased_at),
    buyable: !purchased,
    paidMissions: stats.paidMissions,
    cancelledMissions: stats.cancelledMissions,
    pseudocompras: stats.pseudocompras,
    verifiedPseudocompras: stats.verifiedPseudocompras,
    fieldStartedAt: stats.fieldStartedAt,
    fieldEndedAt: stats.fieldEndedAt,
    dailyPaid: stats.dailyPaid,
    paidPoints: stats.paidPoints,
    studyCostUsd: stats.studyCostUsd,
    studyPriceUsd: stats.studyPriceUsd,
    parseo: purchased ? parseo : redactParseoPrices(parseo),
  };
}

function catalogUnavailable(err) {
  const code = err && (err.code || err.errno);
  return (
    code === "LENS_DB_UNCONFIGURED" ||
    code === "ER_NO_SUCH_TABLE" ||
    code === "ER_BAD_DB_ERROR" ||
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "ECONNREFUSED"
  );
}

function projectSelectSql() {
  return `SELECT p.id, p.name, p.source_key, p.source_name, p.source_url, p.product, p.market,
      p.status, p.notes, p.description, p.started_at, p.ended_at, p.created_at, p.updated_at,
      gpc.status AS subscription_status,
      (SELECT COUNT(*) FROM general_project_missions gpm WHERE gpm.project_id = p.id) AS missions_count,
      (SELECT COALESCE(SUM(m.reward_points), 0)
         FROM general_project_missions gpm
         JOIN missions m ON m.id = gpm.mission_id
        WHERE gpm.project_id = p.id) AS coverage,
      gpl.updated_at AS logo_updated_at,
      (gpl.project_id IS NOT NULL) AS has_logo
     FROM general_projects p
     LEFT JOIN general_project_clients gpc
       ON gpc.project_id = p.id
      AND gpc.client_id = :clientId
      AND gpc.status = 'active'
     LEFT JOIN general_project_logos gpl
       ON gpl.project_id = p.id`;
}

async function loadProjectLogo(projectId) {
  const pool = getLensPool();
  const [rows] = await pool.query(
    "SELECT mime, data FROM general_project_logos WHERE project_id = :id LIMIT 1",
    { id: Number(projectId) }
  );
  return rows[0] || null;
}

async function findLensClientId(organizationId) {
  const pool = getLensPool();
  const [rows] = await pool.query(
    "SELECT id FROM clients WHERE external_ref = :ref LIMIT 1",
    { ref: orgExternalRef(organizationId) }
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function ensureLensClient(member) {
  const pool = getLensPool();
  const existingId = await findLensClientId(member.organization_id);
  if (existingId) return existingId;
  try {
    const [ins] = await pool.query(
      `INSERT INTO clients (name, legal_name, external_ref, billing_email, tax_id, notes, status)
       VALUES (:name, :legalName, :ref, :billingEmail, :taxId, :notes, 'active')`,
      {
        name: member.org_name,
        legalName: member.legal_name || member.org_name,
        ref: orgExternalRef(member.organization_id),
        billingEmail: member.billing_email || null,
        taxId: member.tax_id || null,
        notes: "Alta desde el área de clientes Market Lens",
      }
    );
    return Number(ins.insertId);
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      const again = await findLensClientId(member.organization_id);
      if (again) return again;
    }
    throw err;
  }
}

async function listCatalogProjects(organizationId) {
  const pool = getLensPool();
  const clientId = await findLensClientId(organizationId);
  const [rows] = await pool.query(
    `${projectSelectSql()}
     WHERE p.status IN ('open', 'active')
     ORDER BY (gpc.status = 'active') DESC, p.updated_at DESC, p.id DESC`,
    { clientId: clientId || 0 }
  );
  return rows.map(mapCatalogProject);
}

async function listPurchasedEditions(organizationId) {
  const pool = getLensPool();
  const clientId = await findLensClientId(organizationId);
  if (!clientId) return [];
  const [rows] = await pool.query(
    `SELECT p.id AS project_id,
            p.name AS project_name,
            p.market,
            p.product,
            m.id AS mission_id,
            cm.joined_at AS purchased_at
       FROM client_missions cm
       JOIN missions m ON m.id = cm.mission_id
       JOIN general_project_missions gpm ON gpm.mission_id = cm.mission_id
       JOIN general_projects p ON p.id = gpm.project_id
      WHERE cm.client_id = :clientId
        AND cm.status = 'active'
      ORDER BY cm.joined_at DESC, m.id DESC
      LIMIT 20`,
    { clientId }
  );
  const byProject = {};
  for (const row of rows) {
    const projectId = Number(row.project_id);
    if (!byProject[projectId]) {
      byProject[projectId] = await loadProjectFieldStats(pool, projectId);
    }
  }
  return rows.map((row) => {
    const stats = (byProject[Number(row.project_id)] || {})[String(row.mission_id)] || emptyFieldStats();
    return {
      id: String(row.mission_id),
      projectId: String(row.project_id),
      projectName: row.project_name || "",
      market: row.market || "",
      product: row.product || "",
      purchasedAt: formatDate(row.purchased_at),
      fieldStartedAt: stats.fieldStartedAt || "",
      fieldEndedAt: stats.fieldEndedAt || "",
    };
  });
}

async function loadCatalogProject(projectId, organizationId) {
  const pool = getLensPool();
  const clientId = await findLensClientId(organizationId);
  const [rows] = await pool.query(
    `${projectSelectSql()}
     WHERE p.id = :projectId
     LIMIT 1`,
    { projectId, clientId: clientId || 0 }
  );
  const row = rows[0];
  if (!row) return null;
  const project = mapCatalogProject(row);
  const visible = CATALOG_STATUSES.includes(row.status) || project.subscribed;
  if (!visible) return null;
  const [missionRows] = await pool.query(
    `SELECT gpm.mission_id,
            m.title AS mission_title,
            m.status AS mission_status,
            m.reward_points AS mission_reward_points,
            m.country_code AS mission_country_code,
            m.external_ref AS mission_external_ref,
            cm.status AS purchase_status,
            cm.joined_at AS purchased_at
       FROM general_project_missions gpm
       JOIN missions m ON m.id = gpm.mission_id
       LEFT JOIN client_missions cm
         ON cm.mission_id = gpm.mission_id
        AND cm.client_id = :clientId
        AND cm.status = 'active'
      WHERE gpm.project_id = :projectId
      ORDER BY m.title ASC`,
    { projectId, clientId: clientId || 0 }
  );
  const fieldByMission = await loadProjectFieldStats(pool, projectId);
  const missions = missionRows.map((missionRow) =>
    mapCatalogMission(missionRow, fieldByMission[String(missionRow.mission_id)])
  );
  const brandRefs = missions
    .slice()
    .sort((a, b) => String(b.fieldStartedAt || "").localeCompare(String(a.fieldStartedAt || "")))
    .map((mission) => mission.externalRef);
  project.brands = await loadBrandLogosForRefs(brandRefs);
  return {
    project,
    missions,
  };
}

async function loadCatalogMission(projectId, missionId, organizationId) {
  const data = await loadCatalogProject(projectId, organizationId);
  if (!data) return null;
  const pool = getLensPool();
  const clientId = await findLensClientId(organizationId);
  const [missionRows] = await pool.query(
    `SELECT gpm.mission_id,
            m.title AS mission_title,
            m.status AS mission_status,
            m.reward_points AS mission_reward_points,
            m.country_code AS mission_country_code,
            m.external_ref AS mission_external_ref,
            cm.status AS purchase_status,
            cm.joined_at AS purchased_at
       FROM general_project_missions gpm
       JOIN missions m ON m.id = gpm.mission_id
       LEFT JOIN client_missions cm
         ON cm.mission_id = gpm.mission_id
        AND cm.client_id = :clientId
        AND cm.status = 'active'
      WHERE gpm.project_id = :projectId
        AND gpm.mission_id = :missionId
      LIMIT 1`,
    { projectId, missionId, clientId: clientId || 0 }
  );
  if (!missionRows[0]) return null;
  const fieldByMission = await loadProjectFieldStats(pool, projectId, missionId);
  const mission = mapCatalogMission(missionRows[0], fieldByMission[String(missionId)]);
  mission.parseo = await loadParseo(mission.externalRef);
  return {
    project: data.project,
    mission,
  };
}

function httpError(status, code) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

async function subscribeToProject(projectId, member) {
  const pool = getLensPool();
  const [projects] = await pool.query(
    "SELECT id, status FROM general_projects WHERE id = :id LIMIT 1",
    { id: projectId }
  );
  if (!projects[0]) throw httpError(404, "projects.not_found");
  if (!CATALOG_STATUSES.includes(projects[0].status)) throw httpError(409, "projects.not_open");
  const clientId = await ensureLensClient(member);
  await pool.query(
    `INSERT INTO general_project_clients (project_id, client_id, status, joined_at, left_at, notes)
     VALUES (:projectId, :clientId, 'active', NOW(), NULL, NULL)
     ON DUPLICATE KEY UPDATE
       joined_at = IF(status = 'left', NOW(), joined_at),
       left_at = NULL,
       status = 'active'`,
    { projectId, clientId }
  );
  return loadCatalogProject(projectId, member.organization_id);
}

async function unsubscribeFromProject(projectId, member) {
  const pool = getLensPool();
  const clientId = await findLensClientId(member.organization_id);
  if (!clientId) throw httpError(409, "projects.not_subscribed");
  const [upd] = await pool.query(
    `UPDATE general_project_clients
        SET status = 'left', left_at = NOW()
      WHERE project_id = :projectId AND client_id = :clientId AND status = 'active'`,
    { projectId, clientId }
  );
  if (!upd.affectedRows) throw httpError(409, "projects.not_subscribed");
  return loadCatalogProject(projectId, member.organization_id);
}

async function buyProjectMission(projectId, missionId, member) {
  const pool = getLensPool();
  const clientId = await findLensClientId(member.organization_id);
  if (!clientId) throw httpError(409, "projects.not_subscribed");
  const [subs] = await pool.query(
    `SELECT id FROM general_project_clients
     WHERE project_id = :projectId AND client_id = :clientId AND status = 'active'
     LIMIT 1`,
    { projectId, clientId }
  );
  if (!subs[0]) throw httpError(409, "projects.not_subscribed");
  const [links] = await pool.query(
    `SELECT gpm.mission_id, m.status AS mission_status, m.title AS mission_title
       FROM general_project_missions gpm
       JOIN missions m ON m.id = gpm.mission_id
      WHERE gpm.project_id = :projectId AND gpm.mission_id = :missionId
      LIMIT 1`,
    { projectId, missionId }
  );
  if (!links[0]) throw httpError(404, "projects.mission_not_found");
  const fieldByMission = await loadProjectFieldStats(pool, projectId, missionId);
  const stats = fieldByMission[String(missionId)] || emptyFieldStats();
  const amountUsd = Number(stats.studyPriceUsd || 0);
  const studyTitle = links[0].mission_title || "Estudio";
  return withWalletLock(member.organization_id, async (conn) => {
    const [owned] = await pool.query(
      `SELECT id FROM client_missions
       WHERE client_id = :clientId AND mission_id = :missionId AND status = 'active'
       LIMIT 1`,
      { clientId, missionId }
    );
    if (owned[0]) throw httpError(409, "projects.already_bought");
    let charged = 0;
    try {
      if (amountUsd > 0) {
        await chargeStudyOnConn(conn, member.organization_id, {
          amountUsd,
          missionId,
          projectId,
          title: studyTitle,
          createdBy: member.user_id,
        });
        charged = amountUsd;
      }
      await pool.query(
        `INSERT INTO client_missions
          (client_id, mission_id, billing_share_percent, margin_percent, joined_at, left_at, status, notes)
         VALUES
          (:clientId, :missionId, 100.00, 0.0000, NOW(), NULL, 'active', :notes)`,
        {
          clientId,
          missionId,
          notes: "Compra desde el área de clientes Market Lens",
        }
      );
    } catch (err) {
      if (charged > 0) {
        try {
          await refundStudyOnConn(conn, member.organization_id, {
            amountUsd: charged,
            missionId,
            projectId,
            title: studyTitle,
            createdBy: member.user_id,
          });
        } catch (refundErr) {
          console.error("[wallet] refund failed", refundErr);
        }
      }
      throw err;
    }
    return loadCatalogMission(projectId, missionId, member.organization_id);
  });
}

async function exportCatalogMissionPrices(projectId, missionId, organizationId, filters) {
  const data = await loadCatalogMission(projectId, missionId, organizationId);
  if (!data) throw httpError(404, "projects.mission_not_found");
  if (!data.mission.purchased) throw httpError(403, "projects.not_purchased");
  return exportParseoPrices(data.mission.externalRef, Object.assign({}, filters, {
    product: data.project && data.project.product,
  }));
}

module.exports = {
  catalogUnavailable,
  listCatalogProjects,
  listPurchasedEditions,
  loadCatalogProject,
  loadCatalogMission,
  loadProjectLogo,
  subscribeToProject,
  unsubscribeFromProject,
  buyProjectMission,
  exportCatalogMissionPrices,
};
