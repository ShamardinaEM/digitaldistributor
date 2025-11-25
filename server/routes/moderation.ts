import { Router } from "express";
import { z } from "zod";
import { authGuard, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery } from "../db/pool";

const router = Router();

// Получить все отзывы с фильтрацией по статусу
router.get("/reviews", authGuard, requireRole("moderator", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const query = status
      ? `SELECT r.*, a.title as app_title, u.username as user_username
         FROM reviews r
         INNER JOIN apps a ON a.app_id = r.app_id
         INNER JOIN users u ON u.user_id = r.user_id
         WHERE r.status = $1
         ORDER BY r.review_date DESC`
      : `SELECT r.*, a.title as app_title, u.username as user_username
         FROM reviews r
         INNER JOIN apps a ON a.app_id = r.app_id
         INNER JOIN users u ON u.user_id = r.user_id
         ORDER BY r.review_date DESC`;

    // Для модераторов используем пул moderator, но устанавливаем employeeId для RLS
    const { rows } = await executeQuery(
      "moderator",
      req.user?.employeeId,
      query,
      status ? [status] : [],
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.review_id,
        appId: row.app_id,
        appTitle: row.app_title,
        userId: row.user_id,
        userUsername: row.user_username,
        evaluation: row.evaluation,
        comment: row.comment,
        status: row.status,
        reviewDate: row.review_date,
        moderatedAt: row.moderated_at,
        moderatorId: row.moderator_id,
      })),
    );
  } catch (error) {
    console.error("Fetch reviews error", error);
    return res.status(500).json({ message: "Не удалось получить отзывы" });
  }
});

// Одобрить отзыв (изменить статус на "Проверен")
router.patch("/reviews/:id/approve", authGuard, requireRole("moderator", "admin"), async (req: AuthenticatedRequest, res) => {
  if (!req.user?.employeeId) {
    return res.status(403).json({ message: "Доступно только для сотрудников" });
  }

  const reviewId = Number(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: "Некорректный идентификатор отзыва" });
  }

  try {
    const { rows } = await executeQuery(
      "moderator",
      req.user.employeeId,
      `UPDATE reviews 
       SET status = 'Проверен', 
           moderated_at = NOW(), 
           moderator_id = $1 
       WHERE review_id = $2 
       RETURNING *`,
      [req.user.employeeId, reviewId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    return res.json({ message: "Отзыв одобрен", review: rows[0] });
  } catch (error) {
    console.error("Approve review error", error);
    return res.status(500).json({ message: "Не удалось одобрить отзыв" });
  }
});

// Отклонить отзыв
router.patch("/reviews/:id/reject", authGuard, requireRole("moderator", "admin"), async (req: AuthenticatedRequest, res) => {
  if (!req.user?.employeeId) {
    return res.status(403).json({ message: "Доступно только для сотрудников" });
  }

  const reviewId = Number(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: "Некорректный идентификатор отзыва" });
  }

  try {
    const { rows } = await executeQuery(
      "moderator",
      req.user.employeeId,
      `UPDATE reviews 
       SET status = 'Отклонен', 
           moderated_at = NOW(), 
           moderator_id = $1 
       WHERE review_id = $2 
       RETURNING *`,
      [req.user.employeeId, reviewId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    return res.json({ message: "Отзыв отклонен", review: rows[0] });
  } catch (error) {
    console.error("Reject review error", error);
    return res.status(500).json({ message: "Не удалось отклонить отзыв" });
  }
});

export default router;

