import { Router } from "express";
import { z } from "zod";
import { executeQuery } from "../db/pool";
import { mapAppRow } from "./apps";

const router = Router();

const idSchema = z.object({ id: z.coerce.number().int().positive() });

router.get("/:id", async (req, res) => {
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Некорректный идентификатор" });
  }

  try {
    const { rows } = await executeQuery(
      "user",
      undefined,
      `SELECT provider_id, provider_name, provider_type, description, country, founded_date, web
       FROM providers
       WHERE provider_id = $1`,
      [parseResult.data.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Издатель не найден" });
    }

    const provider = rows[0];
    return res.json({
      id: provider.provider_id,
      name: provider.provider_name,
      type: provider.provider_type,
      description: provider.description || null,
      country: provider.country || null,
      foundedDate: provider.founded_date || null,
      web: provider.web || null,
    });
  } catch (error) {
    console.error("Fetch provider error", error);
    return res.status(500).json({ message: "Не удалось получить издателя" });
  }
});

router.get("/:id/apps", async (req, res) => {
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
               a.image_url,
               c.title AS category_title,
               p.provider_id,
               p.provider_name,
               p.provider_type,
               p.country AS provider_country
        FROM apps a
        LEFT JOIN categories c ON c.category_id = a.category_id
        LEFT JOIN providers p ON p.provider_id = a.provider_id
        WHERE a.provider_id = $1
        ORDER BY a.release_date DESC NULLS LAST, a.title ASC
      `,
      [parseResult.data.id],
    );

    return res.json(rows.map(mapAppRow));
  } catch (error) {
    console.error("Fetch provider apps error", error);
    return res.status(500).json({ message: "Не удалось получить приложения издателя" });
  }
});

export default router;

