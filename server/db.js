const mysql = require("mysql2/promise");

let pool;
let lensPool;
let extractPool;
let apiPool;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
  return pool;
}

function getLensPool() {
  if (lensPool) return lensPool;
  const host = process.env.LENS_MYSQL_HOST;
  const user = process.env.LENS_MYSQL_USER;
  const database = process.env.LENS_MYSQL_DATABASE || "lensrewards";
  if (!host || !user || !process.env.LENS_MYSQL_PASSWORD) {
    const err = new Error("LensRewards MySQL is not configured");
    err.code = "LENS_DB_UNCONFIGURED";
    throw err;
  }
  lensPool = mysql.createPool({
    host,
    port: Number(process.env.LENS_MYSQL_PORT || 3306),
    user,
    password: process.env.LENS_MYSQL_PASSWORD,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
  return lensPool;
}

function getExtractPool() {
  if (extractPool) return extractPool;
  const host = process.env.EXTRACT_MYSQL_HOST || process.env.LENS_MYSQL_HOST;
  const user = process.env.EXTRACT_MYSQL_USER || process.env.LENS_MYSQL_USER;
  const password = process.env.EXTRACT_MYSQL_PASSWORD || process.env.LENS_MYSQL_PASSWORD;
  const database = process.env.EXTRACT_MYSQL_DATABASE || "extracciones";
  if (!host || !user || !password) {
    const err = new Error("Extracciones MySQL is not configured");
    err.code = "EXTRACT_DB_UNCONFIGURED";
    throw err;
  }
  extractPool = mysql.createPool({
    host,
    port: Number(process.env.EXTRACT_MYSQL_PORT || process.env.LENS_MYSQL_PORT || 3306),
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return extractPool;
}

function getApiPool() {
  if (apiPool) return apiPool;
  const host = process.env.API_MYSQL_HOST || process.env.EXTRACT_MYSQL_HOST || process.env.LENS_MYSQL_HOST;
  const user = process.env.API_MYSQL_USER || process.env.EXTRACT_MYSQL_USER || process.env.LENS_MYSQL_USER;
  const password = process.env.API_MYSQL_PASSWORD || process.env.EXTRACT_MYSQL_PASSWORD || process.env.LENS_MYSQL_PASSWORD;
  const database = process.env.API_MYSQL_DATABASE || "apiv2";
  if (!host || !user || !password) {
    const err = new Error("apiv2 MySQL is not configured");
    err.code = "API_DB_UNCONFIGURED";
    throw err;
  }
  apiPool = mysql.createPool({
    host,
    port: Number(process.env.API_MYSQL_PORT || process.env.EXTRACT_MYSQL_PORT || process.env.LENS_MYSQL_PORT || 3306),
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return apiPool;
}

module.exports = { getPool, getLensPool, getExtractPool, getApiPool };
