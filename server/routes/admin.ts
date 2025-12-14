import { Router } from "express";
import { z } from "zod";
import {
    authGuard,
    requireRole,
    AuthenticatedRequest,
} from "../middleware/auth";
import { executeQuery } from "../db/pool";
import bcrypt from "bcrypt";

const router = Router();

// Администратор может видеть все данные всех ролей
// Используем маршруты из других модулей с ролью admin

// Получить всех сотрудников
router.get(
    "/employees",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        try {
            const { rows } = await executeQuery(
                "admin",
                undefined,
                `SELECT employee_id, username, position, hire_date 
       FROM employees 
       ORDER BY hire_date DESC`
            );

            return res.json(
                rows.map((row: any) => ({
                    id: row.employee_id,
                    username: row.username,
                    position: row.position,
                    hireDate: row.hire_date,
                }))
            );
        } catch (error) {
            console.error("Fetch employees error", error);
            return res
                .status(500)
                .json({ message: "Не удалось получить список сотрудников" });
        }
    }
);

// Генерация хэша пароля (для администратора)
router.post(
    "/generate-password-hash",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        try {
            const { password } = req.body;
            if (!password || typeof password !== "string") {
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
            return res
                .status(500)
                .json({ message: "Не удалось сгенерировать хэш" });
        }
    }
);

// Получить список поставщиков
router.get(
    "/providers",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        try {
            const { rows } = await executeQuery(
                "admin",
                undefined,
                `SELECT provider_id, provider_name, provider_type, country, founded_date, web
       FROM providers
       ORDER BY provider_name`
            );

            return res.json(
                rows.map((row: any) => ({
                    id: row.provider_id,
                    name: row.provider_name,
                    type: row.provider_type,
                    country: row.country || null,
                    foundedDate: row.founded_date || null,
                    web: row.web || null,
                }))
            );
        } catch (error) {
            console.error("Fetch providers error", error);
            return res
                .status(500)
                .json({ message: "Не удалось получить список поставщиков" });
        }
    }
);

// Добавить поставщика
const addProviderSchema = z.object({
    provider_name: z.string().min(1, "Название обязательно"),
    provider_type: z.enum(["Разработчик", "Издатель"], {
        errorMap: () => ({
            message: "Тип должен быть 'Разработчик' или 'Издатель'",
        }),
    }),
    country: z.string().min(1, "Страна обязательна"),
    founded_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате YYYY-MM-DD"),
    web: z
        .union([
            z.string().url("Веб-страница должна быть валидным URL"),
            z.literal(""),
        ])
        .optional(),
});

router.post(
    "/providers",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        const parseResult = addProviderSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res
                .status(400)
                .json({
                    message: "Некорректные данные",
                    issues: parseResult.error.flatten(),
                });
        }

        try {
            const { provider_name, provider_type, country, founded_date, web } =
                parseResult.data;

            const { rows } = await executeQuery(
                "admin",
                undefined,
                `INSERT INTO providers (provider_name, provider_type, country, founded_date, web)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING provider_id, provider_name, provider_type, country, founded_date, web`,
                [
                    provider_name,
                    provider_type,
                    country,
                    founded_date,
                    (web && web.trim()) || null,
                ]
            );

            return res.status(201).json({
                id: rows[0].provider_id,
                name: rows[0].provider_name,
                type: rows[0].provider_type,
                country: rows[0].country,
                foundedDate: rows[0].founded_date,
                web: rows[0].web,
            });
        } catch (error: any) {
            console.error("Add provider error", error);
            return res
                .status(500)
                .json({ message: "Не удалось добавить поставщика" });
        }
    }
);

// Получить список категорий
router.get(
    "/categories",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        try {
            const { rows } = await executeQuery(
                "admin",
                undefined,
                "SELECT category_id, title, description FROM categories ORDER BY title"
            );

            return res.json(
                rows.map((row: any) => ({
                    id: row.category_id,
                    title: row.title,
                    description: row.description || null,
                }))
            );
        } catch (error) {
            console.error("Fetch categories error", error);
            return res
                .status(500)
                .json({ message: "Не удалось получить список категорий" });
        }
    }
);

// Добавить товар
const addAppSchema = z.object({
    provider_id: z.number().int().positive("Поставщик обязателен"),
    title: z.string().min(1, "Название обязательно"),
    description: z.string().min(1, "Описание обязательно"),
    cost_price: z.number().refine((val) => val >= 0, {
        message: "Цена по себестоимости должна быть 0 или больше",
    }),
    price: z.number().refine((val) => val >= 0, {
        message: "Цена должна быть 0 или больше",
    }),
    release_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате YYYY-MM-DD"),
    category_id: z.number().int().positive("Категория обязательна"),
});

router.post(
    "/apps",
    authGuard,
    requireRole("admin"),
    async (req: AuthenticatedRequest, res) => {
        if (!req.user?.employeeId) {
            return res.status(401).json({ message: "Необходима авторизация" });
        }

        const parseResult = addAppSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res
                .status(400)
                .json({
                    message: "Некорректные данные",
                    issues: parseResult.error.flatten(),
                });
        }

        try {
            const {
                provider_id,
                title,
                description,
                cost_price,
                price,
                release_date,
                category_id,
            } = parseResult.data;
            const employee_id = req.user.employeeId;

            // Создаем запись в apps
            const appResult = await executeQuery(
                "admin",
                undefined,
                `INSERT INTO apps (title, description, price, release_date, category_id, provider_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING app_id`,
                [
                    title,
                    description,
                    price,
                    release_date,
                    category_id,
                    provider_id,
                ]
            );

            const app_id = appResult.rows[0].app_id;

            // Создаем запись в purchases
            await executeQuery(
                "admin",
                undefined,
                `INSERT INTO purchases (app_id, employee_id, purchase_date, cost_price)
       VALUES ($1, $2, CURRENT_DATE, $3)
       RETURNING purchase_id`,
                [app_id, employee_id, cost_price]
            );

            return res.status(201).json({
                id: app_id,
                title,
                description,
                price,
                releaseDate: release_date,
                categoryId: category_id,
                providerId: provider_id,
            });
        } catch (error: any) {
            console.error("Add app error", error);
            return res
                .status(500)
                .json({ message: "Не удалось добавить товар" });
        }
    }
);

export default router;
