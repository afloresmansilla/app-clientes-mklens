const { getExtractPool, getApiPool } = require("./db");

const REF_RE = /^[a-zA-Z0-9_-]+$/;
const LOGO_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|svg|gif)$/i;

function redactParseoPrices(parseo) {
  const data = parseo || emptyParseo();
  return {
    ...data,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    brandRows: (data.brandRows || []).map((brand) => ({
      ...brand,
      avgPrice: null,
      products: (brand.products || []).map((item) => ({
        ...item,
        avgPrice: null,
        minPrice: null,
        maxPrice: null,
      })),
    })),
  };
}

function emptyParseo(ref) {
  return {
    exists: false,
    ref: ref || "",
    table: ref ? ref + "-precios" : "",
    quotes: 0,
    insurers: 0,
    brands: 0,
    covers: 0,
    comparisons: 0,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    coverBreakdown: [],
    brandRows: [],
  };
}

function money(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function logoUrl(file) {
  const name = String(file || "").trim().split(/[/\\]/).pop();
  if (!name || !LOGO_RE.test(name)) return "";
  return "/logos/" + name;
}

function historyKey(brand, modality) {
  return String(brand || "").trim() + "||" + String(modality || "").trim();
}

function guessBrand(code, brands) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return null;
  let best = null;
  for (const brand of brands) {
    const id = String(brand.brand_id || "").trim().toUpperCase();
    if (!id) continue;
    if (upper === id || upper.startsWith(id + "_")) {
      if (!best || id.length > String(best.brand_id || "").length) best = brand;
    }
  }
  return best;
}

async function loadBrandCatalog(codes) {
  const unique = [...new Set(codes.map((code) => String(code || "").trim()).filter(Boolean))];
  const brands = [];
  const byKey = new Map();
  const byCode = new Map();
  try {
    const pool = getApiPool();
    const [brandRows] = await pool.query(
      "SELECT `brand_id`, `brand_name`, `logo` FROM `data-brand`"
    );
    for (const row of brandRows) brands.push(row);
    if (unique.length) {
      const placeholders = unique.map(() => "?").join(", ");
      const [histRows] = await pool.query(
        `SELECT h.insurance_brand, h.modality, h.product_name, h.brand_id,
                b.brand_name, b.logo
           FROM historial h
           INNER JOIN (
             SELECT insurance_brand, modality, MAX(id) AS id
               FROM historial
              WHERE insurance_brand IN (${placeholders})
              GROUP BY insurance_brand, modality
           ) latest ON latest.id = h.id
           LEFT JOIN \`data-brand\` b ON b.brand_id = h.brand_id`,
        unique
      );
      for (const row of histRows) {
        const meta = {
          code: row.insurance_brand || "",
          cover: row.modality || "",
          productName: row.product_name || "",
          brandId: row.brand_id || "",
          brandName: row.brand_name || row.brand_id || "",
          logo: logoUrl(row.logo),
        };
        byKey.set(historyKey(row.insurance_brand, row.modality), meta);
        if (!byCode.has(row.insurance_brand)) byCode.set(row.insurance_brand, meta);
      }
    }
  } catch (err) {
    if (err && err.code !== "API_DB_UNCONFIGURED") {
      console.error("[parseo] historial", err);
    }
  }
  return { brands, byKey, byCode };
}

function resolveMeta(row, catalog) {
  const code = row.aseguradora || "";
  const cover = row.tipo || "";
  const found =
    catalog.byKey.get(historyKey(code, cover)) ||
    catalog.byCode.get(code) ||
    null;
  if (found) {
    return {
      code,
      cover,
      productName: found.productName || "",
      brandId: found.brandId || code,
      brandName: found.brandName || found.brandId || code,
      logo: found.logo || "",
    };
  }
  const guessed = guessBrand(code, catalog.brands);
  if (guessed) {
    return {
      code,
      cover,
      productName: "",
      brandId: guessed.brand_id || code,
      brandName: guessed.brand_name || guessed.brand_id || code,
      logo: logoUrl(guessed.logo),
    };
  }
  return {
    code,
    cover,
    productName: "",
    brandId: code,
    brandName: code.replace(/_/g, " "),
    logo: "",
  };
}

function groupBrandRows(priceRows, catalog) {
  const grouped = new Map();
  for (const row of priceRows) {
    const meta = resolveMeta(row, catalog);
    const key = String(meta.brandId || meta.brandName || meta.code);
    let brand = grouped.get(key);
    if (!brand) {
      brand = {
        brandId: meta.brandId,
        brandName: meta.brandName,
        logo: meta.logo,
        quotes: 0,
        avgPrice: null,
        products: [],
      };
      grouped.set(key, brand);
    }
    if (!brand.logo && meta.logo) brand.logo = meta.logo;
    if (meta.brandName && meta.brandName !== meta.code) brand.brandName = meta.brandName;
    const quotes = Number(row.quotes || 0);
    brand.quotes += quotes;
    brand.products.push({
      code: meta.code,
      cover: meta.cover,
      productName: meta.productName,
      quotes,
      avgPrice: money(row.avg_price),
      minPrice: money(row.min_price),
      maxPrice: money(row.max_price),
    });
  }
  return [...grouped.values()]
    .map((brand) => {
      brand.products.sort((a, b) => b.quotes - a.quotes);
      return brand;
    })
    .sort((a, b) => b.quotes - a.quotes || String(a.brandName).localeCompare(String(b.brandName)));
}

async function loadParseo(externalRef) {
  const ref = String(externalRef || "").trim();
  if (!REF_RE.test(ref)) return emptyParseo(ref);
  const table = ref + "-precios";
  try {
    const pool = getExtractPool();
    const [statsRows] = await pool.query(
      `SELECT COUNT(*) AS quotes,
              COUNT(DISTINCT aseguradora) AS insurers,
              COUNT(DISTINCT tipo) AS covers,
              COUNT(DISTINCT id_comparacion) AS comparisons,
              MIN(precio) AS min_price,
              MAX(precio) AS max_price,
              AVG(precio) AS avg_price
         FROM ??`,
      [table]
    );
    const stats = statsRows[0] || {};
    const [coverRows] = await pool.query(
      `SELECT tipo, COUNT(*) AS quotes
         FROM ??
        GROUP BY tipo
        ORDER BY quotes DESC`,
      [table]
    );
    const [priceRows] = await pool.query(
      `SELECT aseguradora, tipo,
              COUNT(*) AS quotes,
              AVG(precio) AS avg_price,
              MIN(precio) AS min_price,
              MAX(precio) AS max_price
         FROM ??
        GROUP BY aseguradora, tipo
        ORDER BY quotes DESC, aseguradora ASC`,
      [table]
    );
    const catalog = await loadBrandCatalog(priceRows.map((row) => row.aseguradora));
    const brandRows = groupBrandRows(priceRows, catalog);
    return {
      exists: Number(stats.quotes || 0) > 0,
      ref,
      table,
      quotes: Number(stats.quotes || 0),
      insurers: Number(stats.insurers || 0),
      brands: brandRows.length,
      covers: Number(stats.covers || 0),
      comparisons: Number(stats.comparisons || 0),
      minPrice: money(stats.min_price),
      maxPrice: money(stats.max_price),
      avgPrice: money(stats.avg_price),
      coverBreakdown: coverRows.map((row) => ({
        cover: row.tipo || "",
        quotes: Number(row.quotes || 0),
      })),
      brandRows,
    };
  } catch (err) {
    if (err && (err.code === "ER_NO_SUCH_TABLE" || err.code === "EXTRACT_DB_UNCONFIGURED")) {
      return emptyParseo(ref);
    }
    console.error("[parseo]", err);
    return emptyParseo(ref);
  }
}

function cleanList(values, max) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter((value) => value && value.length <= 80)
    ),
  ].slice(0, max);
}

function quoteIdent(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    const err = new Error("parseo.invalid_table");
    err.code = "parseo.invalid_table";
    err.status = 400;
    throw err;
  }
  return "`" + name + "`";
}

function excelLabels(locale) {
  const lang = String(locale || "es").slice(0, 2);
  if (lang === "en") {
    return {
      results: "Results",
      sample: "Sample",
      headers: ["Company", "Cover type", "Product", "Price", "Deductible", "Comparison"],
    };
  }
  if (lang === "pt") {
    return {
      results: "Resultados",
      sample: "Amostra",
      headers: ["Companhia", "Tipo de seguro", "Produto", "Preço", "Franquia", "Comparação"],
    };
  }
  if (lang === "fr") {
    return {
      results: "Résultats",
      sample: "Échantillon",
      headers: ["Compagnie", "Type d’assurance", "Produit", "Prix", "Franchise", "Comparaison"],
    };
  }
  if (lang === "it") {
    return {
      results: "Risultati",
      sample: "Campione",
      headers: ["Compagnia", "Tipo di assicurazione", "Prodotto", "Prezzo", "Franchigia", "Comparazione"],
    };
  }
  return {
    results: "Resultados",
    sample: "Muestra",
    headers: ["Compañía", "Tipo de seguro", "Producto", "Precio", "Franquicia", "Comparación"],
  };
}

function guessSampleTable(product) {
  const value = String(product || "").toLowerCase();
  if (/moto/.test(value)) return "SAMPLE-MOTORCYCLE";
  if (/hogar|home|casa/.test(value)) return "SAMPLE-HOME";
  if (/vida|life/.test(value)) return "SAMPLE-LIFE";
  if (/salud|health/.test(value)) return "SAMPLE-HEALTH";
  return "SAMPLE-CARS";
}

async function resolveSampleTable(externalRef, product) {
  try {
    const pool = getApiPool();
    const [rows] = await pool.query(
      `SELECT sample_table, COUNT(*) AS n
         FROM historial
        WHERE extraction = ?
          AND sample_table IS NOT NULL
          AND sample_table <> ''
        GROUP BY sample_table
        ORDER BY n DESC
        LIMIT 1`,
      [externalRef]
    );
    const name = rows[0] && String(rows[0].sample_table || "").trim();
    if (name && /^SAMPLE-[A-Z0-9][A-Z0-9_-]{0,54}$/i.test(name)) return name;
  } catch (err) {
    if (err && err.code !== "API_DB_UNCONFIGURED") {
      console.error("[parseo] sample_table", err);
    }
  }
  return guessSampleTable(product);
}

async function loadSampleMap(table, ids) {
  const unique = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!table || !unique.length) return { columns: [], byId: new Map() };
  const pool = getExtractPool();
  const [cols] = await pool.query("SHOW COLUMNS FROM " + quoteIdent(table));
  const columns = (cols || [])
    .filter((col) => !/blob|binary/i.test(col.Type || ""))
    .map((col) => col.Field)
    .filter((field) => /^[a-zA-Z0-9_]+$/.test(field));
  const idCol = columns.find((field) => field.toLowerCase() === "id") || "ID";
  const byId = new Map();
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const marks = chunk.map(() => "?").join(", ");
    const [rows] = await pool.query(
      "SELECT " +
        columns.map((field) => quoteIdent(field)).join(", ") +
        " FROM " +
        quoteIdent(table) +
        " WHERE " +
        quoteIdent(idCol) +
        " IN (" +
        marks +
        ")",
      chunk
    );
    (rows || []).forEach((row) => byId.set(String(row[idCol]), row));
  }
  return {
    columns: columns.filter((field) => field.toLowerCase() !== "id"),
    byId,
  };
}

function toExcel(sheets) {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();
  (sheets || []).forEach((sheet) => {
    if (!sheet || !sheet.headers) return;
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers].concat(sheet.rows || []));
    XLSX.utils.book_append_sheet(wb, ws, String(sheet.name || "Hoja").slice(0, 31));
  });
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function codesForBrands(parseo, brandIds) {
  const wanted = new Set(cleanList(brandIds, 200));
  const codes = [];
  (parseo.brandRows || []).forEach((brand) => {
    if (!wanted.has(String(brand.brandId))) return;
    (brand.products || []).forEach((item) => {
      if (item.code) codes.push(item.code);
    });
  });
  return cleanList(codes, 400);
}

async function exportParseoPrices(externalRef, filters) {
  const parseo = await loadParseo(externalRef);
  if (!parseo.exists) {
    const err = new Error("parseo.empty");
    err.code = "parseo.empty";
    err.status = 404;
    throw err;
  }
  const covers = cleanList(filters && filters.covers, 40);
  const codes = codesForBrands(parseo, filters && filters.brands);
  if (!covers.length || !codes.length) {
    const err = new Error("parseo.selection_required");
    err.code = "parseo.selection_required";
    err.status = 400;
    throw err;
  }
  const coverLabels = (filters && filters.coverLabels) || {};
  const catalog = await loadBrandCatalog(codes);
  const pool = getExtractPool();
  const table = parseo.table;
  const coverMarks = covers.map(() => "?").join(", ");
  const codeMarks = codes.map(() => "?").join(", ");
  const params = covers.concat(codes);
  const quoted = quoteIdent(table);
  const whereSql = `WHERE tipo IN (${coverMarks}) AND aseguradora IN (${codeMarks})`;
  const variants = [
    "aseguradora, tipo, precio, franquicia, id_comparacion",
    "aseguradora, tipo, precio, franquicia",
    "aseguradora, tipo, precio, id_comparacion",
    "aseguradora, tipo, precio",
  ];
  let rows = [];
  for (const fields of variants) {
    try {
      [rows] = await pool.query(
        `SELECT ${fields} FROM ${quoted} ${whereSql} ORDER BY aseguradora ASC, tipo ASC LIMIT 50000`,
        params
      );
      break;
    } catch (err) {
      if (!err || err.code !== "ER_BAD_FIELD_ERROR") throw err;
    }
  }
  const labels = excelLabels(filters && filters.locale);
  const includeSample = !(filters && filters.includeSample === false);
  let sample = { columns: [], byId: new Map() };
  if (includeSample) {
    try {
      const sampleTable = await resolveSampleTable(parseo.ref, filters && filters.product);
      sample = await loadSampleMap(
        sampleTable,
        rows.map((row) => row.id_comparacion)
      );
    } catch (err) {
      if (err && err.code !== "ER_NO_SUCH_TABLE") {
        console.error("[parseo] sample", err);
      }
    }
  }
  const resultRows = rows.map((row) => {
    const meta = resolveMeta(row, catalog);
    const base = [
      meta.brandName,
      coverLabels[meta.cover] || meta.cover,
      meta.productName || coverLabels[meta.cover] || meta.cover,
      money(row.precio),
      money(row.franquicia),
      row.id_comparacion || "",
    ];
    if (!sample.columns.length) return base;
    const profile = sample.byId.get(String(row.id_comparacion || "")) || {};
    return base.concat(sample.columns.map((field) => (profile[field] == null ? "" : profile[field])));
  });
  const sheets = [
    {
      name: labels.results,
      headers: sample.columns.length ? labels.headers.concat(sample.columns) : labels.headers,
      rows: resultRows,
    },
  ];
  if (sample.columns.length) {
    const seen = new Set();
    const sampleRows = [];
    rows.forEach((row) => {
      const id = String(row.id_comparacion || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      const profile = sample.byId.get(id);
      if (!profile) return;
      sampleRows.push(["ID"].concat(sample.columns).map((field, index) => {
        if (index === 0) return id;
        return profile[field] == null ? "" : profile[field];
      }));
    });
    sheets.push({
      name: labels.sample,
      headers: ["ID"].concat(sample.columns),
      rows: sampleRows,
    });
  }
  return {
    filename: (parseo.ref || "precios") + "-precios.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: toExcel(sheets),
    count: rows.length,
  };
}

async function loadBrandLogosForRef(externalRef) {
  const ref = String(externalRef || "").trim();
  if (!REF_RE.test(ref)) return [];
  const table = ref + "-precios";
  try {
    const pool = getExtractPool();
    const [rows] = await pool.query(
      `SELECT aseguradora, COUNT(*) AS quotes
         FROM ??
        GROUP BY aseguradora
        ORDER BY quotes DESC`,
      [table]
    );
    if (!rows.length) return [];
    const catalog = await loadBrandCatalog(rows.map((row) => row.aseguradora));
    const grouped = new Map();
    for (const row of rows) {
      const meta = resolveMeta({ aseguradora: row.aseguradora, tipo: "" }, catalog);
      const key = String(meta.brandId || meta.brandName || meta.code);
      const current = grouped.get(key);
      if (current) {
        current.quotes += Number(row.quotes || 0);
        if (!current.logo && meta.logo) current.logo = meta.logo;
        continue;
      }
      grouped.set(key, {
        brandId: meta.brandId,
        brandName: meta.brandName,
        logo: meta.logo,
        quotes: Number(row.quotes || 0),
      });
    }
    return [...grouped.values()]
      .filter((brand) => brand.logo)
      .sort((a, b) => b.quotes - a.quotes || String(a.brandName).localeCompare(String(b.brandName)))
      .slice(0, 36)
      .map((brand) => ({
        brandId: brand.brandId,
        brandName: brand.brandName,
        logo: brand.logo,
      }));
  } catch (err) {
    if (err && (err.code === "ER_NO_SUCH_TABLE" || err.code === "EXTRACT_DB_UNCONFIGURED")) {
      return [];
    }
    console.error("[parseo] brands", err);
    return [];
  }
}

async function loadBrandLogosForRefs(refs) {
  const unique = [...new Set((Array.isArray(refs) ? refs : []).map((ref) => String(ref || "").trim()).filter(Boolean))];
  for (const ref of unique) {
    const brands = await loadBrandLogosForRef(ref);
    if (brands.length) return brands;
  }
  return [];
}

module.exports = {
  loadParseo,
  emptyParseo,
  redactParseoPrices,
  exportParseoPrices,
  loadBrandLogosForRefs,
};
