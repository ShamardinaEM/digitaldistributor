import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "user" | "admin" | "moderator" | "support" | "analyst";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId?: number;
    employeeId?: number;
    username: string;
    email?: string;
    role: UserRole;
  };
}

export function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret") as any;
    req.user = {
      userId: payload.userId,
      employeeId: payload.employeeId,
      username: payload.username,
      email: payload.email,
      role: payload.role || "user",
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Недействительный токен" });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret") as any;
      req.user = {
        userId: payload.userId,
        employeeId: payload.employeeId,
        username: payload.username,
        email: payload.email,
        role: payload.role || "user",
      };
    } catch {
      // Игнорируем ошибки, чтобы не блокировать публичные запросы
    }
  }
  return next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Недостаточно прав доступа" });
    }
    return next();
  };
}

export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.userId || req.user.role !== "user") {
    return res.status(403).json({ message: "Доступно только для пользователей" });
  }
  return next();
}

