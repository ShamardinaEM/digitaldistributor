import { Router } from "express";
import { z } from "zod";
import { authGuard, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery } from "../db/pool";

const router = Router();

// Получить метрики (дашборд)
router.get("/metrics", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const period = (req.query.period as string) || "day"; // day, week, month

    let dateFilter = "";
    if (period === "day") {
      dateFilter = "sale_date >= CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "sale_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "sale_date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Количество заказов
    const ordersCount = await executeQuery(
      "analyst",
      undefined,
      `SELECT COUNT(*) as count FROM sales WHERE status != 'Отменен' ${dateFilter ? `AND ${dateFilter}` : ""}`,
    );

    // Общая выручка
    const revenue = await executeQuery(
      "analyst",
      undefined,
      `SELECT COALESCE(SUM(amount), 0) as total FROM sales WHERE status != 'Отменен' ${dateFilter ? `AND ${dateFilter}` : ""}`,
    );

    // Новые пользователи
    const newUsers = await executeQuery(
      "analyst",
      undefined,
      `SELECT COUNT(*) as count FROM users WHERE reg_date >= CURRENT_DATE - INTERVAL '${period === "day" ? "1" : period === "week" ? "7" : "30"} days'`,
    );

    // Количество возвратов (отмененных заказов)
    const returns = await executeQuery(
      "analyst",
      undefined,
      `SELECT COUNT(*) as count FROM sales WHERE status = 'Отменен' ${dateFilter ? `AND ${dateFilter}` : ""}`,
    );

    // Средний чек
    const avgCheck = await executeQuery(
      "analyst",
      undefined,
      `SELECT COALESCE(AVG(amount), 0) as avg FROM sales WHERE status != 'Отменен' ${dateFilter ? `AND ${dateFilter}` : ""}`,
    );

    // Количество обращений в поддержку
    const supportRequests = await executeQuery(
      "analyst",
      undefined,
      `SELECT COUNT(*) as count FROM support_requests ${dateFilter ? `WHERE created_at >= CURRENT_DATE - INTERVAL '${period === "day" ? "1" : period === "week" ? "7" : "30"} days'` : ""}`,
    );

    return res.json({
      ordersCount: Number(ordersCount.rows[0].count),
      revenue: Number(revenue.rows[0].total),
      newUsers: Number(newUsers.rows[0].count),
      returns: Number(returns.rows[0].count),
      avgCheck: Number(avgCheck.rows[0].avg),
      supportRequests: Number(supportRequests.rows[0].count),
    });
  } catch (error) {
    console.error("Fetch metrics error", error);
    return res.status(500).json({ message: "Не удалось получить метрики" });
  }
});

// Топ продаваемых приложений
router.get("/top-apps", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const { rows } = await executeQuery(
      "analyst",
      undefined,
      `SELECT a.app_id, a.title, COUNT(s.sale_id) as sales_count, SUM(s.amount) as total_revenue
       FROM apps a
       INNER JOIN sales s ON s.app_id = a.app_id
       WHERE s.status != 'Отменен'
       GROUP BY a.app_id, a.title
       ORDER BY sales_count DESC
       LIMIT $1`,
      [limit],
    );

    return res.json(
      rows.map((row: any) => ({
        appId: row.app_id,
        title: row.title,
        salesCount: Number(row.sales_count),
        totalRevenue: Number(row.total_revenue),
      })),
    );
  } catch (error) {
    console.error("Fetch top apps error", error);
    return res.status(500).json({ message: "Не удалось получить топ приложений" });
  }
});

// Продажи по дням (для графика)
router.get("/sales-by-day", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const { rows } = await executeQuery(
      "analyst",
      undefined,
      `SELECT DATE(sale_date) as date, 
              COUNT(*) as orders_count, 
              SUM(amount) as revenue
       FROM sales
       WHERE status != 'Отменен' 
         AND sale_date >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY DATE(sale_date)
       ORDER BY date ASC`,
    );

    return res.json(
      rows.map((row: any) => ({
        date: row.date,
        ordersCount: Number(row.orders_count),
        revenue: Number(row.revenue),
      })),
    );
  } catch (error) {
    console.error("Fetch sales by day error", error);
    return res.status(500).json({ message: "Не удалось получить данные по продажам" });
  }
});

// Продажи по категориям
router.get("/sales-by-category", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await executeQuery(
      "analyst",
      undefined,
      `SELECT c.category_id, c.title, 
              COUNT(s.sale_id) as sales_count, 
              SUM(s.amount) as revenue
       FROM categories c
       INNER JOIN apps a ON a.category_id = c.category_id
       INNER JOIN sales s ON s.app_id = a.app_id
       WHERE s.status != 'Отменен'
       GROUP BY c.category_id, c.title
       ORDER BY revenue DESC`,
    );

    return res.json(
      rows.map((row: any) => ({
        categoryId: row.category_id,
        categoryTitle: row.title,
        salesCount: Number(row.sales_count),
        revenue: Number(row.revenue),
      })),
    );
  } catch (error) {
    console.error("Fetch sales by category error", error);
    return res.status(500).json({ message: "Не удалось получить данные по категориям" });
  }
});

// Динамика новых пользователей
router.get("/users-growth", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const { rows } = await executeQuery(
      "analyst",
      undefined,
      `SELECT DATE(reg_date) as date, COUNT(*) as count
       FROM users
       WHERE reg_date >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY DATE(reg_date)
       ORDER BY date ASC`,
    );

    return res.json(
      rows.map((row: any) => ({
        date: row.date,
        count: Number(row.count),
      })),
    );
  } catch (error) {
    console.error("Fetch users growth error", error);
    return res.status(500).json({ message: "Не удалось получить данные по пользователям" });
  }
});

// Получить все заказы с фильтрацией
const ordersFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  userId: z.coerce.number().optional(),
  appId: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

router.get("/orders", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = ordersFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Некорректные параметры фильтрации" });
    }

    const { startDate, endDate, status, userId, appId, limit = 50, offset = 0 } = parseResult.data;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`s.sale_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`s.sale_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    if (status) {
      whereConditions.push(`s.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (userId) {
      whereConditions.push(`s.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    if (appId) {
      whereConditions.push(`s.app_id = $${paramIndex}`);
      params.push(appId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const { rows } = await executeQuery(
      "analyst",
      undefined,
      `SELECT s.*, 
              u.username as user_username, u.email as user_email,
              a.title as app_title, a.price as app_price
       FROM sales s
       INNER JOIN users u ON u.user_id = s.user_id
       INNER JOIN apps a ON a.app_id = s.app_id
       ${whereClause}
       ORDER BY s.sale_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    // Получаем общее количество для пагинации
    const countResult = await executeQuery(
      "analyst",
      undefined,
      `SELECT COUNT(*) as total
       FROM sales s
       ${whereClause}`,
      params,
    );

    return res.json({
      orders: rows.map((row: any) => ({
        id: row.sale_id,
        saleDate: row.sale_date,
        amount: Number(row.amount),
        status: row.status,
        user: {
          id: row.user_id,
          username: row.user_username,
          email: row.user_email,
        },
        app: {
          id: row.app_id,
          title: row.app_title,
          price: Number(row.app_price),
        },
      })),
      total: Number(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Fetch orders error", error);
    return res.status(500).json({ message: "Не удалось получить заказы" });
  }
});

// Получить информацию о клиенте и его покупках
router.get("/users/:id/purchases", authGuard, requireRole("analyst", "admin"), async (req: AuthenticatedRequest, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ message: "Некорректный идентификатор пользователя" });
  }

  try {
    const userResult = await executeQuery(
      "analyst",
      undefined,
      `SELECT user_id, username, email, reg_date FROM users WHERE user_id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const user = userResult.rows[0];

    const purchasesResult = await executeQuery(
      "analyst",
      undefined,
      `SELECT s.*, a.title as app_title, a.price as app_price
       FROM sales s
       INNER JOIN apps a ON a.app_id = s.app_id
       WHERE s.user_id = $1
       ORDER BY s.sale_date DESC`,
      [userId],
    );

    return res.json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        regDate: user.reg_date,
      },
      purchases: purchasesResult.rows.map((row: any) => ({
        id: row.sale_id,
        saleDate: row.sale_date,
        amount: Number(row.amount),
        status: row.status,
        app: {
          id: row.app_id,
          title: row.app_title,
          price: Number(row.app_price),
        },
      })),
    });
  } catch (error) {
    console.error("Fetch user purchases error", error);
    return res.status(500).json({ message: "Не удалось получить данные о покупках" });
  }
});

export default router;

