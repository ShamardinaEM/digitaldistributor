import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery } from "../db/pool";

const router = Router();

const supportSchema = z.object({
  subject: z.string().min(5).max(120),
  message: z.string().min(10).max(1000),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  orderId: z.number().int().positive(),
});

router.post("/", authGuard, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "user") {
    return res.status(403).json({ message: "Сотрудники не могут создавать заявки в поддержку" });
  }

  const parseResult = supportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректное обращение", issues: parseResult.error.flatten() });
  }

  const { subject, message, priority, orderId } = parseResult.data;

  // Проверяем, что заказ принадлежит пользователю
  const orderCheck = await executeQuery(
    "user",
    req.user!.userId,
    `SELECT sale_id FROM sales WHERE sale_id = $1 AND user_id = $2`,
    [orderId, req.user!.userId],
  );
  if (orderCheck.rows.length === 0) {
    return res.status(403).json({ message: "Заказ не найден или не принадлежит вам" });
  }

  try {
    // Создаем обращение
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `
        INSERT INTO support_requests (user_id, subject, message, priority, status, created_at)
        VALUES ($1, $2, $3, $4, 'Создан', NOW())
        RETURNING request_id, created_at, status
      `,
      [req.user.userId, subject, message, priority],
    );

    const requestId = rows[0].request_id;

    // Отправляем первое сообщение в чат от пользователя
    await executeQuery(
      "user",
      req.user!.userId,
      `INSERT INTO support_messages (request_id, sender_type, sender_id, message)
       VALUES ($1, 'user', $2, $3)`,
      [requestId, req.user!.userId, message],
    ).catch((error) => {
      console.error("Failed to create support message:", error);
    });

    return res.status(201).json({
      id: rows[0].request_id,
      status: rows[0].status,
      createdAt: rows[0].created_at,
    });
  } catch (error: any) {
    console.error("Support error", error);
    return res.status(500).json({ 
      message: "Не удалось отправить обращение",
      error: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

// Получить обращения пользователя
router.get("/", authGuard, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "user" || !req.user?.userId) {
    return res.status(403).json({ message: "Доступно только для пользователей" });
  }

  try {
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `SELECT sr.*
       FROM support_requests sr
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC`,
      [req.user.userId],
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.request_id,
        subject: row.subject,
        message: row.message,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        takenAt: row.taken_at,
      })),
    );
  } catch (error) {
    console.error("Fetch support requests error", error);
    return res.status(500).json({ message: "Не удалось получить обращения" });
  }
});

// Получить сообщения чата для обращения пользователя
router.get("/:id/messages", authGuard, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "user" || !req.user?.userId) {
    return res.status(403).json({ message: "Доступно только для пользователей" });
  }

  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор обращения" });
  }

  try {
    // Проверяем, что обращение принадлежит пользователю
    const checkRequest = await executeQuery(
      "user",
      req.user.userId,
      `SELECT request_id FROM support_requests WHERE request_id = $1 AND user_id = $2`,
      [requestId, req.user.userId],
    );

    if (checkRequest.rows.length === 0) {
      return res.status(403).json({ message: "Обращение не найдено" });
    }

    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `SELECT sm.*, 
              u.username as user_username
       FROM support_messages sm
       LEFT JOIN users u ON u.user_id = sm.sender_id AND sm.sender_type = 'user'
       WHERE sm.request_id = $1
       ORDER BY sm.created_at ASC`,
      [requestId],
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.message_id,
        requestId: row.request_id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        // Для сообщений от пользователя показываем username, для сотрудников - общее имя
        senderUsername: row.sender_type === 'user' 
          ? row.user_username 
          : (row.sender_type === 'employee' ? "Сотрудник поддержки" : "Система"),
        message: row.message,
        createdAt: row.created_at,
      })),
    );
  } catch (error) {
    console.error("Fetch messages error", error);
    return res.status(500).json({ message: "Не удалось получить сообщения" });
  }
});

// Отправить сообщение в чат (пользователь)
const messageSchema = z.object({
  message: z.string().min(1, "Сообщение не может быть пустым").max(2000, "Сообщение слишком длинное"),
});

router.post("/:id/messages", authGuard, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "user" || !req.user?.userId) {
    return res.status(403).json({ message: "Доступно только для пользователей" });
  }

  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор обращения" });
  }

  const parseResult = messageSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errors = parseResult.error.flatten();
    const message = errors.fieldErrors.message?.[0] || errors.formErrors[0] || "Некорректные данные";
    return res.status(400).json({ message, issues: errors });
  }

  try {
    // Проверяем, что обращение принадлежит пользователю И его статус не завершен
    const checkRequest = await executeQuery(
      "user",
      req.user.userId,
      `SELECT request_id, status FROM support_requests WHERE request_id = $1 AND user_id = $2`,
      [requestId, req.user.userId],
    );

    if (checkRequest.rows.length === 0) {
      return res.status(403).json({ message: "Обращение не найдено" });
    }

    const requestStatus = checkRequest.rows[0].status;
    
    // Определяем завершенные статусы
    const completedStatuses = ['Завершен', 'Закрыт', 'Решен', 'Выполнен'];
    
    if (completedStatuses.includes(requestStatus)) {
      return res.status(400).json({ 
        message: "Нельзя отправить сообщение в завершенную заявку",
        details: `Статус заявки: ${requestStatus}`
      });
    }

    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `INSERT INTO support_messages (request_id, sender_type, sender_id, message)
       VALUES ($1, 'user', $2, $3)
       RETURNING *`,
      [requestId, req.user.userId, parseResult.data.message],
    );

    return res.status(201).json({
      id: rows[0].message_id,
      requestId: rows[0].request_id,
      senderType: rows[0].sender_type,
      senderId: rows[0].sender_id,
      message: rows[0].message,
      createdAt: rows[0].created_at,
    });
  } catch (error) {
    console.error("Send message error", error);
    return res.status(500).json({ message: "Не удалось отправить сообщение" });
  }
});

export default router;