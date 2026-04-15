import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "discopain",
    user: process.env.DB_USER || "root",
    pass: process.env.DB_PASSWORD || ""
  }
};
