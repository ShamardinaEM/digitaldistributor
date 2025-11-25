import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { authGuard, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery, getPoolForRole } from "../db/pool";

const router = Router();

const updateUsernameSchema = z.object({
  username: z.string().min(3).max(50),
});

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.patch("/username", authGuard, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const parseResult = updateUsernameSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  const { username } = parseResult.data;

  try {
    // Для обновления профиля нужен админский доступ
    const adminPool = getPoolForRole("admin");
    
    // Проверка уникальности
    const check = await adminPool.query("SELECT user_id FROM users WHERE username = $1 AND user_id != $2", [
      username,
      req.user.userId,
    ]);
    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Никнейм уже занят" });
    }

    const { rows } = await adminPool.query(
      "UPDATE users SET username = $1 WHERE user_id = $2 RETURNING user_id, username, email, reg_date",
      [username, req.user.userId],
    );

    return res.json({
      id: rows[0].user_id,
      username: rows[0].username,
      email: rows[0].email,
      regDate: rows[0].reg_date,
    });
  } catch (error) {
    console.error("Update username error", error);
    return res.status(500).json({ message: "Не удалось изменить никнейм" });
  }
});

router.patch("/password", authGuard, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const parseResult = updatePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  const { oldPassword, newPassword } = parseResult.data;

  try {
    const adminPool = getPoolForRole("admin");
    const { rows } = await adminPool.query("SELECT password_hash FROM users WHERE user_id = $1", [req.user.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const currentHash = rows[0].password_hash;
    if (!currentHash) {
      return res.status(400).json({ message: "У вас нет пароля. Используйте восстановление пароля." });
    }

    const isValid = await bcrypt.compare(oldPassword, currentHash);
    if (!isValid) {
      return res.status(401).json({ message: "Неверный старый пароль" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await adminPool.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [newHash, req.user.userId]);

    return res.json({ message: "Пароль успешно изменен" });
  } catch (error) {
    console.error("Update password error", error);
    return res.status(500).json({ message: "Не удалось изменить пароль" });
  }
});

export default router;

