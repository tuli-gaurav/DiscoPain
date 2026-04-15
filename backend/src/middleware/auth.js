import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Token missing" });
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function permit(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const allowed = roles.some((r) => userRoles.includes(r));
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    return next();
  };
}
