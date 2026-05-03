import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Resolve DB settings from discrete vars or a Railway-style mysql URL.
 * Railway MySQL plugin exposes MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT, MYSQL_URL.
 */
function resolveDb() {
  const urlStr =
    process.env.MYSQL_URL ||
    (typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.startsWith("mysql")
      ? process.env.DATABASE_URL
      : null);

  if (urlStr) {
    try {
      const normalized = urlStr.trim().replace(/^mysql:\/\//i, "http://");
      const u = new URL(normalized);
      const dbName = (u.pathname || "").replace(/^\//, "").split("?")[0];
      return {
        host: u.hostname,
        port: Number(u.port || 3306),
        name: dbName || process.env.MYSQLDATABASE || "railway",
        user: decodeURIComponent(u.username || ""),
        pass: decodeURIComponent(u.password || "")
      };
    } catch {
      console.warn("[env] MYSQL_URL / DATABASE_URL could not be parsed; using discrete DB_* / MYSQL* variables.");
    }
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    name: process.env.DB_NAME || process.env.MYSQLDATABASE || "discopain",
    user: process.env.DB_USER || process.env.MYSQLUSER || "root",
    pass: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || ""
  };
}

const dbConnBase = resolveDb();
const useSsl = process.env.MYSQL_SSL === "true" || process.env.DB_SSL === "true";

export const env = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  db: {
    ...dbConnBase,
    ...(useSsl ? { ssl: { rejectUnauthorized: process.env.MYSQL_SSL_STRICT === "true" } } : {})
  }
};
