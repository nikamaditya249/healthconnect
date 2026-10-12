import jwt from "jsonwebtoken";
import User from "../models/User.js";

import { isFallbackActive, memoryUsers } from "../services/inMemoryStore.js";

const JWT_SECRET = process.env.JWT_SECRET || "healthconnect_fallback_jwt_secret_key_2026";

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No authentication token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (isFallbackActive()) {
      const user = memoryUsers.find((u) => u._id === decoded.id || u.employeeId === decoded.employeeId);
      if (!user) {
        return res.status(401).json({ error: "Invalid token or user not found." });
      }
      req.user = user;
      return next();
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid token or inactive account." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access forbidden: Role '${req.user?.role || "unauthorized"}' cannot perform this action.`,
      });
    }
    next();
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (isFallbackActive()) {
        const user = memoryUsers.find((u) => u._id === decoded.id || u.employeeId === decoded.employeeId);
        if (user) req.user = user;
      } else {
        const user = await User.findById(decoded.id).select("-password");
        if (user) req.user = user;
      }
    }
  } catch (e) {
    // Continue without user
  }
  next();
};
