import { Router } from "express";
import { z } from "zod";
import { authGuard, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery } from "../db/pool";

const router = Router();

// Получить все заявки в поддержку
router.get("/requests", authGuard, requireRole("support", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const query = status
      ? `SELECT sr.*, u.username as user_username, u.email as user_email,
                e.username as employee_username
         FROM support_requests sr
         INNER JOIN users u ON u.user_id = sr.user_id
         LEFT JOIN employees e ON e.employee_id = sr.employee_id
         WHERE sr.status = $1
         ORDER BY sr.created_at DESC`
      : `SELECT sr.*, u.username as user_username, u.email as user_email,
                e.username as employee_username
         FROM support_requests sr
         INNER JOIN users u ON u.user_id = sr.user_id
         LEFT JOIN employees e ON e.employee_id = sr.employee_id
         ORDER BY sr.created_at DESC`;

    const { rows } = await executeQuery(
      "support",
      req.user?.employeeId,
      query,
      status ? [status] : [],
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.request_id,
        userId: row.user_id,
        userUsername: row.user_username,
        userEmail: row.user_email,
        subject: row.subject,
        message: row.message,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        employeeId: row.employee_id,
        employeeUsername: row.employee_username,
        takenAt: row.taken_at,
      })),
    );
  } catch (error) {
    console.error("Fetch support requests error", error);
    return res.status(500).json({ message: "Не удалось получить заявки" });
  }
});

// Взять заявку в работу
router.patch("/requests/:id/take", authGuard, requireRole("support", "admin"), async (req: AuthenticatedRequest, res) => {
  if (!req.user?.employeeId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор заявки" });
  }

  try {
    const { rows } = await executeQuery(
      "support",
      req.user.employeeId,
      `UPDATE support_requests 
       SET employee_id = $1, 
           taken_at = NOW(),
           status = 'В обработке'
       WHERE request_id = $2 
       RETURNING *`,
      [req.user.employeeId, requestId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({ message: "Заявка взята в работу", request: rows[0] });
  } catch (error) {
    console.error("Take request error", error);
    return res.status(500).json({ message: "Не удалось взять заявку в работу" });
  }
});

// Получить сообщения чата для заявки
router.get("/requests/:id/messages", authGuard, requireRole("support", "admin"), async (req: AuthenticatedRequest, res) => {
  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор заявки" });
  }

  try {
    const { rows } = await executeQuery(
      "support",
      req.user?.employeeId,
      `SELECT sm.*, 
              CASE 
                WHEN sm.sender_type = 'user' THEN u.username
                WHEN sm.sender_type = 'employee' THEN e.username
              END as sender_username
       FROM support_messages sm
       LEFT JOIN users u ON u.user_id = sm.sender_id AND sm.sender_type = 'user'
       LEFT JOIN employees e ON e.employee_id = sm.sender_id AND sm.sender_type = 'employee'
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
        senderUsername: row.sender_username,
        message: row.message,
        createdAt: row.created_at,
      })),
    );
  } catch (error) {
    console.error("Fetch messages error", error);
    return res.status(500).json({ message: "Не удалось получить сообщения" });
  }
});

// Отправить сообщение в чат
const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

router.post("/requests/:id/messages", authGuard, requireRole("support", "admin"), async (req: AuthenticatedRequest, res) => {
  if (!req.user?.employeeId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор заявки" });
  }

  const parseResult = messageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  try {
    // Проверяем, что заявка взята в работу этим сотрудником (или администратор может писать в любую)
    const checkRequest = await executeQuery(
      "support",
      req.user.employeeId,
      `SELECT employee_id, status FROM support_requests WHERE request_id = $1`,
      [requestId],
    );

    if (checkRequest.rows.length === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const request = checkRequest.rows[0];
    if (request.status === "Завершен") {
      return res.status(403).json({ message: "Нельзя отправлять сообщения в завершенную заявку" });
    }
    if (req.user.role !== "admin" && request.employee_id !== req.user.employeeId) {
      return res.status(403).json({ message: "Вы не можете отправлять сообщения в эту заявку" });
    }

    const { rows } = await executeQuery(
      "support",
      req.user.employeeId,
      `INSERT INTO support_messages (request_id, sender_type, sender_id, message)
       VALUES ($1, 'employee', $2, $3)
       RETURNING *`,
      [requestId, req.user.employeeId, parseResult.data.message],
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

// Закрыть заявку (только администратор)
router.patch("/requests/:id/close", authGuard, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const requestId = Number(req.params.id);
  if (!requestId) {
    return res.status(400).json({ message: "Некорректный идентификатор заявки" });
  }

  try {
    const { rows } = await executeQuery(
      "admin",
      undefined,
      `UPDATE support_requests 
       SET status = 'Завершен'
       WHERE request_id = $1 
       RETURNING *`,
      [requestId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({ message: "Заявка закрыта", request: rows[0] });
  } catch (error) {
    console.error("Close request error", error);
    return res.status(500).json({ message: "Не удалось закрыть заявку" });
  }
});

export default router;

