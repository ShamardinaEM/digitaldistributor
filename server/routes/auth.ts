import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { executeQuery, getPoolForRole } from "../db/pool";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  const { email, username, password } = parseResult.data;

  try {
    // Для регистрации нужен админский доступ (создание пользователей)
    const adminPool = getPoolForRole("admin");
    
    // Проверка уникальности email
    const emailCheck = await adminPool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: "Email уже используется" });
    }

    // Проверка уникальности username
    const usernameCheck = await adminPool.query("SELECT user_id FROM users WHERE username = $1", [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: "Никнейм уже занят" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await adminPool.query(
      "INSERT INTO users (username, email, password_hash, reg_date) VALUES ($1, $2, $3, CURRENT_DATE) RETURNING user_id, username, email, reg_date",
      [username, email, passwordHash],
    );

    const user = rows[0];
    const token = jwt.sign(
      { userId: user.user_id, username: user.username, email: user.email },
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        regDate: user.reg_date,
      },
    });
  } catch (error) {
    console.error("Register error", error);
    return res.status(500).json({ message: "Не удалось зарегистрироваться" });
  }
});

router.get("/check-username", async (req, res) => {
  const username = req.query.username as string;
  if (!username || username.length < 3) {
    return res.json({ available: false });
  }

  try {
    const adminPool = getPoolForRole("admin");
    const { rows } = await adminPool.query("SELECT user_id FROM users WHERE username = $1", [username]);
    return res.json({ available: rows.length === 0 });
  } catch (error) {
    console.error("Check username error", error);
    return res.status(500).json({ message: "Не удалось проверить никнейм" });
  }
});

router.post("/login", async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  const { username, password } = parseResult.data;

  try {
    // Для проверки сотрудников используем админский доступ
    const adminPool = getPoolForRole("admin");
    
    // Сначала проверяем сотрудников (если таблица существует)
    let employeeRows;
    try {
      employeeRows = await adminPool.query(
        `SELECT e.employee_id, e.username, e.password_hash, p.title as position_name
         FROM employees e
         LEFT JOIN positions p ON p.position_id = e.position_id
         WHERE e.username = $1`,
        [username],
      );
    } catch (error: any) {
      employeeRows = { rows: [] };
    }

    if (employeeRows.rows.length > 0) {
      const employee = employeeRows.rows[0];
      
      let isValid = false;
      if (!employee.password_hash || (typeof employee.password_hash === 'string' && employee.password_hash.trim() === "")) {
        isValid = true;
      } else {
        try {
          isValid = await bcrypt.compare(password, employee.password_hash);
        } catch (error: any) {
          isValid = false;
        }
      }
      
      if (!isValid) {
        return res.status(401).json({ message: "Неверный никнейм или пароль" });
      }

      const positionName = (employee.position_name || "").toLowerCase();
      const usernameLower = employee.username.toLowerCase();
      let role: string = "user";
      
      console.log(`[Auth] Employee login: username=${employee.username}, position="${employee.position_name}"`);
      
      // Проверяем по названию должности ИЛИ по username
      if (positionName.includes("администратор") || positionName.includes("директор") || positionName.includes("admin") ||
          usernameLower.includes("admin") || usernameLower === "administrator") {
        role = "admin";
      } else if (positionName.includes("модератор") || positionName.includes("moderator") ||
                 usernameLower.includes("moderator") || usernameLower.includes("модератор")) {
        role = "moderator";
      } else if (positionName.includes("поддержк") || positionName.includes("support") ||
                 usernameLower.includes("support") || usernameLower.includes("поддержк")) {
        role = "support";
      } else if (positionName.includes("аналитик") || positionName.includes("analyst") ||
                 usernameLower.includes("analyst") || usernameLower.includes("аналитик")) {
        role = "analyst";
      }
      
      console.log(`[Auth] Assigned role: ${role}`);

      const token = jwt.sign(
        { employeeId: employee.employee_id, username: employee.username, role },
        process.env.JWT_SECRET ?? "secret",
        { expiresIn: "7d" },
      );

      return res.json({
        token,
        user: {
          id: employee.employee_id,
          username: employee.username,
          role,
        },
        isEmployee: true,
      });
    }

    // Если не сотрудник, проверяем обычных пользователей (используем админский доступ для чтения)
    const { rows } = await adminPool.query(
      "SELECT user_id, username, email, password_hash, reg_date FROM users WHERE username = $1",
      [username],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Неверный никнейм или пароль" });
    }

    const user = rows[0];
    
    // Проверяем, что у пользователя установлен пароль
    if (!user.password_hash || (typeof user.password_hash === 'string' && user.password_hash.trim() === "")) {
      return res.status(401).json({ message: "Пароль не установлен. Обратитесь к администратору." });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Неверный никнейм или пароль" });
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, email: user.email, role: "user" },
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        regDate: user.reg_date,
        role: "user",
      },
      isEmployee: false,
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Не удалось выполнить вход" });
  }
});

export default router;

