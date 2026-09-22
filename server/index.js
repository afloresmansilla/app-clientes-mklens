require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { getPool } = require("./db");
const {
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
} = require("./lensCatalog");
const { getWallet, getWalletSummary, depositFunds } = require("./wallet");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
const logosDir = process.env.LOGOS_DIR || path.resolve(__dirname, "../../FrontEndDecoderAndExecute/public/logos");
app.use("/logos", express.static(logosDir, { index: false, fallthrough: true, maxAge: "7d" }));

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function fail(res, status, code, error) {
  return res.status(status).json({ ok: false, code, error });
}

function mapPeriod(period) {
  if (period === "año" || period === "year") return "year";
  if (period === "a medida" || period === "custom") return "custom";
  return "month";
}

function publicUser(row) {
  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    company: row.org_name,
    organizationId: row.organization_id,
    plan: row.plan_code,
    planName: row.plan_name,
  };
}

function catalogError(res, err, fallbackCode, fallbackMessage) {
  if (catalogUnavailable(err)) {
    return fail(res, 503, "projects.catalog_unavailable", "No se pudo cargar el catálogo de proyectos.");
  }
  if (err && err.code && (String(err.code).startsWith("projects.") || String(err.code).startsWith("wallet.") || String(err.code).startsWith("parseo."))) {
    const messages = {
      "projects.not_found": "Proyecto no encontrado.",
      "projects.not_open": "Este proyecto no está abierto a suscripciones.",
      "projects.not_subscribed": "Suscríbete al proyecto para comprar misiones.",
      "projects.subscribe_failed": "No se pudo suscribir al proyecto.",
      "projects.mission_not_found": "Esa misión no pertenece a este proyecto.",
      "projects.mission_not_buyable": "Esta misión no se puede comprar ahora.",
      "projects.already_bought": "Ya tienes esta misión.",
      "projects.not_purchased": "Compra la edición para descargar los precios.",
      "parseo.empty": "No hay precios para esta edición.",
      "parseo.selection_required": "Elige al menos un tipo de seguro y una compañía.",
      "parseo.download_failed": "No se pudo descargar el fichero de precios.",
      "wallet.insufficient": "No hay saldo suficiente en el monedero para este estudio.",
      "wallet.busy": "El monedero está ocupado. Inténtalo de nuevo.",
      "wallet.not_ready": "El monedero aún no está disponible.",
      "wallet.invalid_amount": "El importe no es válido.",
    };
    return fail(res, err.status || 400, err.code, messages[err.code] || fallbackMessage);
  }
  console.error(err);
  return fail(res, 500, fallbackCode, fallbackMessage);
}

async function loadMembership(userId, organizationId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      u.id AS user_id, u.email, u.name, u.status AS user_status,
      m.role, m.status AS member_status, m.organization_id,
      o.name AS org_name, o.legal_name, o.tax_id, o.address, o.billing_email, o.status AS org_status,
      p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.price_amount, p.period,
      p.seats, p.projects_included, p.blurb
     FROM organization_members m
     JOIN users u ON u.id = m.user_id
     JOIN organizations o ON o.id = m.organization_id
     LEFT JOIN subscriptions s ON s.organization_id = o.id
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE m.user_id = :userId AND m.organization_id = :organizationId
       AND m.status = 'active' AND u.status = 'active'
     LIMIT 1`,
    { userId, organizationId }
  );
  return rows[0] || null;
}

async function createSession(userId, organizationId, req) {
  const pool = getPool();
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO user_sessions (user_id, organization_id, token_hash, user_agent, ip, expires_at)
     VALUES (:userId, :organizationId, :tokenHash, :userAgent, :ip, :expiresAt)`,
    {
      userId,
      organizationId,
      tokenHash: hashToken(token),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 255),
      ip: String(req.ip || "").slice(0, 64),
      expiresAt: expires,
    }
  );
  return token;
}

async function auth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return fail(res, 401, "auth.required", "Debes iniciar sesión.");
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT s.user_id, s.organization_id
       FROM user_sessions s
       WHERE s.token_hash = :hash
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      { hash: hashToken(token) }
    );
    if (!rows[0]) return fail(res, 401, "auth.invalid_session", "La sesión no es válida.");
    const member = await loadMembership(rows[0].user_id, rows[0].organization_id);
    if (!member) return fail(res, 403, "auth.no_access", "Sin acceso a la organización.");
    req.token = token;
    req.member = member;
    next();
  } catch (err) {
    console.error(err);
    fail(res, 500, "auth.check_failed", "No se pudo comprobar la sesión.");
  }
}

app.get("/healthz", (_req, res) => {
  res.type("text/plain").send("ok\n");
});

app.get("/api/health", async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    fail(res, 503, "health.db", "No hay conexión con MySQL.");
  }
});

app.post("/api/auth/register", (_req, res) => {
  fail(res, 403, "auth.register_disabled", "El alta de cuentas la hace Market Lens.");
});

app.post("/api/auth/login", async (req, res) => {
  const email = String((req.body && req.body.email) || "")
    .trim()
    .toLowerCase();
  const password = String((req.body && req.body.password) || "");
  if (!email || !password) return fail(res, 400, "auth.missing_credentials", "Faltan email o contraseña.");
  try {
    const pool = getPool();
    const [users] = await pool.query(
      "SELECT id, password_hash, status FROM users WHERE email = :email LIMIT 1",
      { email }
    );
    const user = users[0];
    if (!user || user.status !== "active") {
      return fail(res, 401, "auth.invalid_credentials", "Email o contraseña incorrectos.");
    }
    const okPass = await bcrypt.compare(password, user.password_hash);
    if (!okPass) return fail(res, 401, "auth.invalid_credentials", "Email o contraseña incorrectos.");
    const [memberships] = await pool.query(
      `SELECT organization_id FROM organization_members
       WHERE user_id = :userId AND status = 'active' ORDER BY id ASC LIMIT 1`,
      { userId: user.id }
    );
    if (!memberships[0]) return fail(res, 403, "auth.no_organization", "La cuenta no pertenece a ninguna organización.");
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = :id", { id: user.id });
    const token = await createSession(user.id, memberships[0].organization_id, req);
    const member = await loadMembership(user.id, memberships[0].organization_id);
    res.json({ ok: true, token, user: publicUser(member) });
  } catch (err) {
    console.error(err);
    fail(res, 500, "auth.login_failed", "No se pudo iniciar sesión.");
  }
});

app.post("/api/auth/logout", auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = :hash", {
      hash: hashToken(req.token),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    fail(res, 500, "auth.logout_failed", "No se pudo cerrar la sesión.");
  }
});

app.get("/api/me", auth, async (req, res) => {
  const m = req.member;
  try {
    const wallet = await getWalletSummary(m.organization_id);
    res.json({
      ok: true,
      user: publicUser(m),
      org: {
        id: m.organization_id,
        name: m.org_name,
        taxId: m.tax_id || "",
        address: m.address || "",
        billingEmail: m.billing_email || "",
      },
      plan: {
        id: m.plan_code || "starter",
        name: m.plan_name || "Starter",
        price: Number(m.price_amount || 0),
        period: mapPeriod(m.period),
        seats: Number(m.seats || 0),
        projectsIncluded: Number(m.projects_included || 0),
        blurb: m.blurb || "",
      },
      wallet,
    });
  } catch (err) {
    console.error(err);
    fail(res, 500, "auth.check_failed", "No se pudo comprobar la sesión.");
  }
});

function editionIdOf(req) {
  return req.params.editionId || req.params.missionId;
}

async function listStudies(req, res) {
  try {
    const projects = await listCatalogProjects(req.member.organization_id);
    res.json({ ok: true, projects });
  } catch (err) {
    catalogError(res, err, "projects.load_failed", "No se pudieron cargar los proyectos.");
  }
}

async function getStudyLogo(req, res) {
  try {
    const logo = await loadProjectLogo(req.params.id);
    if (!logo || !logo.data) return res.status(404).end();
    res.set("Content-Type", logo.mime || "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(logo.data);
  } catch (err) {
    if (catalogUnavailable(err)) return res.status(404).end();
    console.error(err);
    res.status(500).end();
  }
}

function createStudyDisabled(_req, res) {
  fail(res, 403, "projects.create_disabled", "Los proyectos se eligen del catálogo de LensRewards.");
}

async function getStudy(req, res) {
  try {
    const data = await loadCatalogProject(req.params.id, req.member.organization_id);
    if (!data) return fail(res, 404, "projects.not_found", "Proyecto no encontrado.");
    res.json({ ok: true, project: data.project, missions: data.missions });
  } catch (err) {
    catalogError(res, err, "projects.detail_failed", "No se pudo cargar el proyecto.");
  }
}

async function subscribeStudy(req, res) {
  try {
    const data = await subscribeToProject(req.params.id, req.member);
    if (!data) return fail(res, 404, "projects.not_found", "Proyecto no encontrado.");
    res.json({ ok: true, project: data.project, missions: data.missions });
  } catch (err) {
    catalogError(res, err, "projects.subscribe_failed", "No se pudo suscribir al proyecto.");
  }
}

async function unsubscribeStudy(req, res) {
  try {
    const data = await unsubscribeFromProject(req.params.id, req.member);
    if (!data) return fail(res, 404, "projects.not_found", "Proyecto no encontrado.");
    res.json({ ok: true, project: data.project, missions: data.missions });
  } catch (err) {
    catalogError(res, err, "projects.unsubscribe_failed", "No se pudo cancelar la suscripción.");
  }
}

async function getEdition(req, res) {
  try {
    const data = await loadCatalogMission(req.params.id, editionIdOf(req), req.member.organization_id);
    if (!data) return fail(res, 404, "projects.mission_not_found", "Esa misión no pertenece a este proyecto.");
    const wallet = await getWalletSummary(req.member.organization_id);
    res.json({ ok: true, project: data.project, mission: data.mission, wallet });
  } catch (err) {
    catalogError(res, err, "projects.detail_failed", "No se pudo cargar el proyecto.");
  }
}

async function exportEditionPrices(req, res) {
  try {
    const file = await exportCatalogMissionPrices(
      req.params.id,
      editionIdOf(req),
      req.member.organization_id,
      {
        covers: req.body && req.body.covers,
        brands: req.body && req.body.brands,
        coverLabels: req.body && req.body.coverLabels,
        includeSample: !(req.body && req.body.includeSample === false),
        locale: req.get("Accept-Language") || "es",
      }
    );
    res.setHeader("Content-Type", file.mime || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="' + file.filename + '"');
    res.send(file.buffer);
  } catch (err) {
    catalogError(res, err, "parseo.download_failed", "No se pudo descargar el fichero de precios.");
  }
}

async function buyEdition(req, res) {
  try {
    const data = await buyProjectMission(req.params.id, editionIdOf(req), req.member);
    if (!data) return fail(res, 404, "projects.not_found", "Proyecto no encontrado.");
    const wallet = await getWalletSummary(req.member.organization_id);
    res.json({ ok: true, project: data.project, mission: data.mission, wallet });
  } catch (err) {
    catalogError(res, err, "projects.buy_failed", "No se pudo comprar la misión.");
  }
}

app.get("/api/ediciones", auth, async (req, res) => {
  try {
    const editions = await listPurchasedEditions(req.member.organization_id);
    res.json({ ok: true, editions });
  } catch (err) {
    catalogError(res, err, "projects.load_failed", "No se pudieron cargar los proyectos.");
  }
});

app.get("/api/estudios", auth, listStudies);
app.get("/api/estudios/:id/logo", getStudyLogo);
app.post("/api/estudios", auth, createStudyDisabled);
app.get("/api/estudios/:id", auth, getStudy);
app.post("/api/estudios/:id/subscribe", auth, subscribeStudy);
app.post("/api/estudios/:id/unsubscribe", auth, unsubscribeStudy);
app.get("/api/estudios/:id/ediciones/:editionId", auth, getEdition);
app.post("/api/estudios/:id/ediciones/:editionId/prices/export", auth, exportEditionPrices);
app.post("/api/estudios/:id/ediciones/:editionId/buy", auth, buyEdition);

app.get("/api/projects", auth, listStudies);
app.get("/api/projects/:id/logo", getStudyLogo);
app.post("/api/projects", auth, createStudyDisabled);
app.get("/api/projects/:id", auth, getStudy);
app.post("/api/projects/:id/subscribe", auth, subscribeStudy);
app.post("/api/projects/:id/unsubscribe", auth, unsubscribeStudy);
app.get("/api/projects/:id/missions/:missionId", auth, getEdition);
app.post("/api/projects/:id/missions/:missionId/prices/export", auth, exportEditionPrices);
app.post("/api/projects/:id/missions/:missionId/buy", auth, buyEdition);

app.get("/api/team", auth, async (req, res) => {
  try {
    const pool = getPool();
    const orgId = req.member.organization_id;
    const [members] = await pool.query(
      `SELECT m.id, u.name, u.email, m.role, m.status
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = :orgId
       ORDER BY m.id ASC`,
      { orgId }
    );
    const [invites] = await pool.query(
      `SELECT id, name, email, role, accepted_at, expires_at
       FROM organization_invitations
       WHERE organization_id = :orgId AND accepted_at IS NULL
       ORDER BY id DESC`,
      { orgId }
    );
    res.json({
      ok: true,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
      })),
      invitations: invites.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        role: i.role,
        status: "invited",
      })),
    });
  } catch (err) {
    console.error(err);
    fail(res, 500, "team.load_failed", "No se pudo cargar el equipo.");
  }
});

app.post("/api/team/invite", auth, async (req, res) => {
  if (req.member.role !== "admin") return fail(res, 403, "team.admin_only", "Solo un admin puede invitar.");
  const email = String((req.body && req.body.email) || "")
    .trim()
    .toLowerCase();
  const name = String((req.body && req.body.name) || "").trim();
  const role = ["admin", "analista", "visor"].includes(req.body && req.body.role) ? req.body.role : "visor";
  if (!email || !name) return fail(res, 400, "team.missing_fields", "Faltan nombre o email.");
  try {
    const pool = getPool();
    const token = crypto.randomBytes(32).toString("hex");
    const [ins] = await pool.query(
      `INSERT INTO organization_invitations
        (organization_id, email, name, role, token_hash, invited_by, expires_at)
       VALUES (:orgId, :email, :name, :role, :tokenHash, :invitedBy, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
      {
        orgId: req.member.organization_id,
        email,
        name,
        role,
        tokenHash: hashToken(token),
        invitedBy: req.member.user_id,
      }
    );
    res.json({
      ok: true,
      invitation: { id: ins.insertId, name, email, role, status: "invited" },
    });
  } catch (err) {
    console.error(err);
    fail(res, 500, "team.invite_failed", "No se pudo crear la invitación.");
  }
});

app.delete("/api/team/:id", auth, async (req, res) => {
  if (req.member.role !== "admin") return fail(res, 403, "team.admin_only", "Solo un admin puede quitar miembros.");
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT id, role FROM organization_members WHERE id = :id AND organization_id = :orgId LIMIT 1",
      { id: req.params.id, orgId: req.member.organization_id }
    );
    if (!rows[0]) return fail(res, 404, "team.member_not_found", "Miembro no encontrado.");
    if (rows[0].role === "admin") return fail(res, 400, "team.cannot_remove_admin", "No se puede quitar a un admin.");
    await pool.query("DELETE FROM organization_members WHERE id = :id", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    fail(res, 500, "team.remove_failed", "No se pudo quitar al miembro.");
  }
});

app.get("/api/billing", auth, async (req, res) => {
  try {
    const pool = getPool();
    const orgId = req.member.organization_id;
    const [plans] = await pool.query(
      "SELECT id, code, name, blurb, price_amount, period, seats, projects_included FROM plans WHERE is_public = 1 ORDER BY price_amount ASC"
    );
    const [methods] = await pool.query(
      "SELECT brand, last4, exp_month, exp_year, is_default FROM payment_methods WHERE organization_id = :orgId ORDER BY is_default DESC, id DESC",
      { orgId }
    );
    const [invoices] = await pool.query(
      "SELECT id, number, issued_at, total_amount, status FROM invoices WHERE organization_id = :orgId ORDER BY id DESC",
      { orgId }
    );
    const m = req.member;
    const method = methods[0];
    res.json({
      ok: true,
      org: {
        name: m.org_name,
        taxId: m.tax_id || "",
        address: m.address || "",
        billingEmail: m.billing_email || "",
      },
      plan: {
        id: m.plan_code || "starter",
        name: m.plan_name || "Starter",
        price: Number(m.price_amount || 0),
        period: mapPeriod(m.period),
        seats: Number(m.seats || 0),
        projectsIncluded: Number(m.projects_included || 0),
      },
      plans: plans.map((p) => ({
        id: p.code,
        name: p.name,
        blurb: p.blurb,
        price: Number(p.price_amount || 0),
        period: mapPeriod(p.period),
        seats: Number(p.seats),
        projectsIncluded: Number(p.projects_included),
      })),
      payment: method
        ? {
            brand: method.brand || "card",
            last4: method.last4 || "----",
            exp: method.exp_month && method.exp_year ? String(method.exp_month).padStart(2, "0") + "/" + String(method.exp_year).slice(-2) : "—",
          }
        : { brand: "none", last4: "----", exp: "—" },
      invoices: invoices.map((i) => ({
        id: i.number,
        date: i.issued_at ? String(i.issued_at).slice(0, 10) : "",
        amount: Number(i.total_amount || 0),
        status: i.status,
      })),
    });
  } catch (err) {
    console.error(err);
    fail(res, 500, "billing.load_failed", "No se pudo cargar la facturación.");
  }
});

app.post("/api/billing/plan", auth, (_req, res) => {
  fail(res, 403, "billing.plans_undefined", "Los planes y precios aún no están definidos.");
});

app.get("/api/wallet", auth, async (req, res) => {
  try {
    const wallet = await getWallet(req.member.organization_id);
    res.json({ ok: true, wallet });
  } catch (err) {
    catalogError(res, err, "wallet.load_failed", "No se pudo cargar el monedero.");
  }
});

app.post("/api/wallet/deposit", auth, async (req, res) => {
  try {
    const result = await depositFunds(req.member.organization_id, req.body && req.body.amount, req.member.user_id);
    const wallet = await getWallet(req.member.organization_id);
    res.json({ ok: true, deposited: result.amountUsd, wallet });
  } catch (err) {
    catalogError(res, err, "wallet.deposit_failed", "No se pudo ingresar el saldo.");
  }
});

app.put("/api/organization", auth, async (req, res) => {
  if (req.member.role !== "admin") return fail(res, 403, "org.admin_only", "Solo un admin puede editar la organización.");
  const name = String((req.body && req.body.name) || "").trim();
  const taxId = String((req.body && req.body.taxId) || "").trim();
  const address = String((req.body && req.body.address) || "").trim();
  const billingEmail = String((req.body && req.body.billingEmail) || "").trim();
  if (!name) return fail(res, 400, "org.missing_name", "Falta la razón social.");
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE organizations
       SET name = :name, legal_name = :name, tax_id = :taxId, address = :address, billing_email = :billingEmail
       WHERE id = :id`,
      { name, taxId, address, billingEmail, id: req.member.organization_id }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    fail(res, 500, "org.save_failed", "No se pudo guardar la organización.");
  }
});

const port = Number(process.env.PORT || 3080);
app.listen(port, "0.0.0.0", () => {
  console.log("API clientes en puerto " + port);
});
