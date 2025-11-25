import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthenticatedRequest } from "../middleware/auth";
import { executeQuery, withTransaction } from "../db/pool";

const router = Router();

router.get("/", authGuard, async (req: AuthenticatedRequest, res) => {
  // Сотрудники не имеют заказов - возвращаем пустой список
  if (!req.user?.userId || req.user.role !== "user") {
    return res.json([]);
  }

  try {
    // RLS политика автоматически фильтрует по user_id через app.current_user_id
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `
        SELECT s.sale_id,
               s.sale_date,
               s.amount,
               s.status,
               a.app_id,
               a.title,
               a.price
        FROM sales s
        INNER JOIN apps a ON a.app_id = s.app_id
        ORDER BY s.sale_date DESC
      `,
      [],
    );

    return res.json(
      rows.map((row: any) => ({
        id: row.sale_id,
        status: row.status,
        amount: Number(row.amount),
        saleDate: row.sale_date,
        downloadLink: row.status === "Завершен" ? `https://digitaldistributor.com/app/id=${row.app_id}` : null,
        app: {
          id: row.app_id,
          title: row.title,
          price: Number(row.price),
        },
      })),
    );
  } catch (error) {
    console.error("Orders fetch error", error);
    return res.status(500).json({ message: "Не удалось получить заказы" });
  }
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        appId: z.number().int().positive(),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1),
  payment: z.object({
    method: z.enum(["card", "wallet"]),
    cardLast4: z.string().length(4).optional(),
  }),
});

router.patch("/:id/cancel", authGuard, async (req: AuthenticatedRequest, res) => {
  const orderId = Number(req.params.id);
  if (!orderId) {
    return res.status(400).json({ message: "Некорректный идентификатор заказа" });
  }

  try {
    // RLS политика автоматически фильтрует по user_id
    const { rows } = await executeQuery(
      "user",
      req.user.userId,
      `SELECT status FROM sales WHERE sale_id = $1`,
      [orderId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Заказ не найден" });
    }

    if (rows[0].status === "Завершен") {
      return res.status(400).json({ message: "Нельзя отменить завершенный заказ" });
    }

    if (rows[0].status === "Отменен") {
      return res.status(400).json({ message: "Заказ уже отменен" });
    }

    // RLS политика автоматически фильтрует по user_id
    await executeQuery("user", req.user.userId, `UPDATE sales SET status = 'Отменен' WHERE sale_id = $1`, [orderId]);

    return res.json({ message: "Заказ отменен" });
  } catch (error) {
    console.error("Cancel order error", error);
    return res.status(500).json({ message: "Не удалось отменить заказ" });
  }
});

router.post("/checkout", authGuard, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== "user") {
    return res.status(403).json({ message: "Сотрудники не могут совершать покупки" });
  }

  const parseResult = checkoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректный заказ", issues: parseResult.error.flatten() });
  }

  try {
    // Проверяем, что пользователь не пытается купить товар, который у него уже есть
    // RLS политика автоматически фильтрует по user_id
    for (const item of parseResult.data.items) {
      const existing = await executeQuery(
        "user",
        req.user!.userId,
        `SELECT sale_id FROM sales WHERE app_id = $1 AND status != 'Отменен'`,
        [item.appId],
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: `Товар с ID ${item.appId} уже куплен` });
      }
    }

    const orders = await withTransaction(async (client) => {
      const createdOrders = [];
      for (const item of parseResult.data.items) {
        const amount = item.price * item.quantity;
        const { rows } = await client.query(
          `
            INSERT INTO sales (sale_date, amount, status, user_id, app_id)
            VALUES (NOW(), $1, 'Создан', $2, $3)
            RETURNING sale_id, sale_date, amount, status
          `,
          [amount, req.user!.userId, item.appId],
        );
        createdOrders.push({
          id: rows[0].sale_id,
          amount: Number(rows[0].amount),
          saleDate: rows[0].sale_date,
          status: rows[0].status,
          appId: item.appId,
        });
      }
      return createdOrders;
    }, req.user!.userId, "user");

    return res.status(201).json({
      orders,
      payment: {
        status: "mocked",
        method: parseResult.data.payment.method,
        cardLast4: parseResult.data.payment.cardLast4,
      },
    });
  } catch (error) {
    console.error("Checkout error", error);
    return res.status(500).json({ message: "Не удалось оформить заказ" });
  }
});

export default router;

