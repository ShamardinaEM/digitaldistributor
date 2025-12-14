import { Router } from "express";
import { z } from "zod";
import { executeQuery, getPoolForRole } from "../db/pool";
import { authGuard, optionalAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// Helper функция для маппинга данных приложения
export function mapAppRow(row: any) {
  return {
    id: row.app_id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    releaseDate: row.release_date,
    category: row.category_title ? { id: row.category_id, title: row.category_title } : null,
    provider: row.provider_name ? { id: row.provider_id, name: row.provider_name, type: row.provider_type, country: row.provider_country || null } : null,
  };
}

router.get("/", async (req, res) => {
  const search = (req.query.search as string) ?? "";
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

  try {
    const { rows } = await executeQuery(
      "user",
      undefined,
      `
        SELECT a.app_id,
               a.title,
               a.description,
               a.price,
               a.release_date,
               a.category_id,
               c.title AS category_title,
               p.provider_id,
               p.provider_name,
               p.provider_type,
               p.country AS provider_country
        FROM apps a
        LEFT JOIN categories c ON c.category_id = a.category_id
        LEFT JOIN providers p ON p.provider_id = a.provider_id
        WHERE ($1 = '' OR a.title ILIKE '%' || $1 || '%' OR a.description ILIKE '%' || $1 || '%')
          AND ($2::INT IS NULL OR a.category_id = $2)
        ORDER BY a.release_date DESC NULLS LAST, a.title ASC
      `,
      [search.trim(), categoryId],
    );

    console.log(`[Fetch Apps] Found ${rows.length} apps`);
    return res.json(rows.map(mapAppRow));
  } catch (error: any) {
    console.error("Fetch apps error", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return res.status(500).json({ 
      message: "Не удалось получить список приложений",
      error: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const { rows } = await executeQuery("user", undefined, "SELECT category_id, title, description FROM categories ORDER BY title");
    console.log(`[Fetch Categories] Found ${rows.length} categories`);
    return res.json(rows.map((row: any) => ({ id: row.category_id, title: row.title, description: row.description })));
  } catch (error: any) {
    console.error("Fetch categories error", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return res.status(500).json({ 
      message: "Не удалось получить категории",
      error: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

router.get("/owned", authGuard, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  if (req.user.role !== "user") {
    return res.status(403).json({ message: "Доступно только для пользователей" });
  }

  try {
    // RLS политика автоматически фильтрует по user_id
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `
        SELECT DISTINCT ON (a.app_id) a.app_id,
               a.title,
               a.description,
               a.price,
               a.release_date,
               a.category_id,
               c.title AS category_title,
               p.provider_id,
               p.provider_name,
               p.provider_type,
               p.country AS provider_country,
               s.sale_date
        FROM sales s
        INNER JOIN apps a ON a.app_id = s.app_id
        LEFT JOIN categories c ON c.category_id = a.category_id
        LEFT JOIN providers p ON p.provider_id = a.provider_id
        WHERE s.status != 'Отменен'
        ORDER BY a.app_id, s.sale_date DESC
      `,
      [],
    );

    console.log(`[Owned Apps] User ${req.user.userId} has ${rows.length} owned apps`);
    return res.json(rows.map(mapAppRow));
  } catch (error) {
    console.error("Fetch owned apps error", error);
    return res.status(500).json({ message: "Не удалось получить купленные приложения" });
  }
});

router.get("/:id", async (req, res) => {
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректный идентификатор" });
  }

  try {
    const { rows } = await executeQuery(
      "user",
      undefined,
      `
        SELECT a.app_id,
               a.title,
               a.description,
               a.price,
               a.release_date,
               a.category_id,
               c.title AS category_title,
               p.provider_id,
               p.provider_name,
               p.provider_type,
               p.country AS provider_country
        FROM apps a
        LEFT JOIN categories c ON c.category_id = a.category_id
        LEFT JOIN providers p ON p.provider_id = a.provider_id
        WHERE a.app_id = $1
      `,
      [parseResult.data.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Приложение не найдено" });
    }

    return res.json(mapAppRow(rows[0]));
  } catch (error) {
    console.error("Fetch app error", error);
    return res.status(500).json({ message: "Не удалось получить приложение" });
  }
});


router.get("/:id/owned", authGuard, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректный идентификатор" });
  }

  try {
    // RLS политика автоматически фильтрует по user_id
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `SELECT 1 FROM sales WHERE app_id = $1 AND status != 'Отменен' LIMIT 1`,
      [parseResult.data.id],
    );
    return res.json({ owned: rows.length > 0 });
  } catch (error: any) {
    console.error("Check ownership error", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      userId: req.user?.userId,
      appId: parseResult.data.id,
    });
    return res.status(500).json({
      message: "Не удалось проверить наличие товара",
      error: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

// Создать отзыв
const reviewSchema = z.object({
  appId: z.number().int().positive(),
  evaluation: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(2000),
});

router.post("/:id/reviews", authGuard, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }

  const appId = Number(req.params.id);
  const parseResult = reviewSchema.safeParse({ ...req.body, appId });
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректные данные", issues: parseResult.error.flatten() });
  }

  try {
    // Проверяем, что пользователь купил это приложение
    // RLS политика автоматически фильтрует по user_id
    const purchaseCheck = await executeQuery(
      "user",
      req.user.userId,
      `SELECT sale_id FROM sales WHERE app_id = $1 AND status != 'Отменен' LIMIT 1`,
      [appId],
    );

    if (purchaseCheck.rows.length === 0) {
      return res.status(403).json({ message: "Вы можете оставить отзыв только на купленные приложения" });
    }

    // Проверяем, не оставлял ли уже отзыв и что с ним происходит
    // Используем роль admin, чтобы гарантированно найти существующий отзыв
    const existingReviewResult = await executeQuery(
      "admin",
      undefined,
      `SELECT review_id, status FROM reviews WHERE app_id = $1 AND user_id = $2 LIMIT 1`,
      [appId, req.user.userId],
    );

    const existingReview = existingReviewResult.rows;

    if (existingReview.length > 0) {
      const review = existingReview[0];

      if (review.status === "На модерации") {
        return res.status(400).json({ message: "Ваш отзыв уже находится на модерации" });
      }

      if (review.status === "Проверен") {
        return res.status(400).json({ message: "Ваш отзыв уже опубликован" });
      }

      if (review.status === "Отклонен") {
        // Удаляем отклоненный отзыв перед созданием нового
        await executeQuery(
          "admin",
          undefined,
          `DELETE FROM reviews WHERE review_id = $1`,
          [review.review_id],
        );
      } else {
        return res.status(400).json({ message: "Вы уже оставили отзыв на это приложение" });
      }
    }

    console.log(`[Create Review] User ${req.user.userId} creating review for app ${appId}`);
    
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `INSERT INTO reviews (app_id, user_id, evaluation, comment, status, review_date)
       VALUES ($1, $2, $3, $4, 'На модерации', CURRENT_DATE)
       RETURNING review_id, app_id, user_id, evaluation, comment, status, review_date`,
      [appId, req.user.userId, parseResult.data.evaluation, parseResult.data.comment],
    );

    return res.status(201).json({
      id: rows[0].review_id,
      appId: rows[0].app_id,
      userId: rows[0].user_id,
      evaluation: rows[0].evaluation,
      comment: rows[0].comment,
      status: rows[0].status,
      reviewDate: rows[0].review_date,
    });
  } catch (error: any) {
    console.error("Create review error", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      userId: req.user?.userId,
      appId: appId,
    });
    return res.status(500).json({ message: "Не удалось создать отзыв" });
  }
});

router.get("/:id/reviews", optionalAuth, async (req: AuthenticatedRequest, res) => {
  const appId = Number(req.params.id);
  if (!appId) {
    return res.status(400).json({ message: "Некорректный идентификатор" });
  }

  try {
    // Прямой запрос без RLS для публичных опубликованных отзывов (используем роль admin)
    const { rows } = await executeQuery(
      "admin",
      undefined,
      `SELECT r.*, u.username as user_username
       FROM reviews r
       INNER JOIN users u ON u.user_id = r.user_id
       WHERE r.app_id = $1 AND r.status = 'Проверен'
       ORDER BY r.review_date DESC`,
      [appId],
    );

    let userReview: any = null;
    if (req.user?.userId) {
      // Прямой запрос для получения отзыва текущего пользователя
      const userReviewResult = await executeQuery(
        "admin",
        undefined,
        `SELECT r.*, u.username as user_username
         FROM reviews r
         INNER JOIN users u ON u.user_id = r.user_id
         WHERE r.app_id = $1 AND r.user_id = $2
         ORDER BY r.review_date DESC
         LIMIT 1`,
        [appId, req.user.userId],
      );
      userReview = userReviewResult.rows[0] ?? null;
    }

    return res.json({
      reviews: rows.map((row: any) => ({
        id: row.review_id,
        appId: row.app_id,
        userId: row.user_id,
        userUsername: row.user_username,
        evaluation: row.evaluation,
        comment: row.comment,
        status: row.status,
        reviewDate: row.review_date,
      })),
      userReview: userReview
        ? {
            id: userReview.review_id,
            appId: userReview.app_id,
            userId: userReview.user_id,
            userUsername: userReview.user_username,
            evaluation: userReview.evaluation,
            comment: userReview.comment,
            status: userReview.status,
            reviewDate: userReview.review_date,
          }
        : null,
    });
  } catch (error) {
    console.error("Fetch reviews error", error);
    return res.status(500).json({ message: "Не удалось получить отзывы" });
  }
});

export default router;
