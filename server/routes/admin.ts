import { Router } from "express";
import { authGuard, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery } from "../db/pool";
import bcrypt from "bcrypt";

const router = Router();

// Администратор может видеть все данные всех ролей
// Используем маршруты из других модулей с ролью admin

// Получить всех сотрудников
router.get("/employees", authGuard, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await executeQuery(
      "admin",
      undefined,
      `SELECT employee_id, username, position, hire_date 
       FROM employees 
       ORDER BY hire_date DESC`,
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.employee_id,
        username: row.username,
        position: row.position,
        hireDate: row.hire_date,
      })),
    );
  } catch (error) {
    console.error("Fetch employees error", error);
    return res.status(500).json({ message: "Не удалось получить список сотрудников" });
  }
});

// Генерация хэша пароля (для администратора)
router.post("/generate-password-hash", authGuard, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: "Пароль обязателен" });
    }

    const hash = await bcrypt.hash(password, 10);
    return res.json({
      password,
      hash,
      sqlQuery: `UPDATE employees SET password_hash = '${hash}' WHERE username IS NOT NULL;`,
    });
  } catch (error) {
    console.error("Generate hash error", error);
    return res.status(500).json({ message: "Не удалось сгенерировать хэш" });
  }
});

export default router;
