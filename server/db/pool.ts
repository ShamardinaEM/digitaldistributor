import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Функция для создания connection string с пользователем
function createConnectionString(user: string, password: string): string {
  const baseUrl = process.env.DATABASE_URL || "";
  if (!baseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  
  try {
    const url = new URL(baseUrl);
    url.username = user;
    url.password = password;
    return url.toString();
  } catch {
    // Если не удалось распарсить как URL, пробуем простую замену
    // Формат: postgresql://user:pass@host:port/db
    const match = baseUrl.match(/^(postgresql:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (match) {
      return `${match[1]}${user}:${password}@${match[4]}`;
    }
    // Если формат другой, просто добавляем пользователя
    return baseUrl.replace(/postgresql:\/\//, `postgresql://${user}:${password}@`);
  }
}

// Создаем пулы для каждой роли
const createPool = (user: string, password: string) => {
  return new Pool({
    connectionString: createConnectionString(user, password),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
};

// Пароли из SQL (можно вынести в .env)
const DB_PASSWORD = process.env.DB_PASSWORD || "secure_pass";

export const pools = {
  admin: createPool("admin_user", DB_PASSWORD),
  analyst: createPool("analyst_user", DB_PASSWORD),
  moderator: createPool("moderator_user", DB_PASSWORD),
  support: createPool("support_user", DB_PASSWORD),
  user: createPool("normal_user", DB_PASSWORD),
};

// Пул с полными правами (postgres) для запросов без RLS
export const superPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// Для обратной совместимости оставляем основной пул (используем admin для полного доступа)
export const pool = pools.admin;

// Тип роли пользователя
export type UserRole = "admin" | "analyst" | "moderator" | "support" | "user";

// Получить пул для роли
export function getPoolForRole(role: UserRole): pg.Pool {
  return pools[role];
}

// Обертка для выполнения запросов с установкой app.current_user_id
export async function queryWithRLS<T = any>(
  pool: pg.Pool,
  userId: number | undefined,
  queryText: string,
  values?: any[]
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    if (userId !== undefined) {
      // SET LOCAL работает только внутри транзакции, поэтому используем BEGIN/COMMIT
      // SET LOCAL не поддерживает параметризованные запросы, используем безопасную конкатенацию
      // userId уже проверен и является числом, поэтому безопасно
      await client.query("BEGIN");
      await client.query(`SET LOCAL app.current_user_id = ${userId}`);
      // Проверяем, что параметр установлен (для отладки)
      const checkResult = await client.query(`SELECT current_setting('app.current_user_id', true) as user_id`);
      const setUserId = checkResult.rows[0]?.user_id;
      if (setUserId !== String(userId)) {
        console.error(`[RLS] ERROR: current_user_id mismatch. Expected: ${userId}, Got: ${setUserId || 'NULL'}`);
      } else {
        console.log(`[RLS] OK: current_user_id set to ${userId}`);
      }
      const result = await client.query<T>(queryText, values || []);
      await client.query("COMMIT");
      return result;
    } else {
      return await client.query<T>(queryText, values || []);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {}); // Игнорируем ошибки при откате
    throw error;
  } finally {
    client.release();
  }
}

// Helper функция для выполнения запроса с правильным пулом и RLS
export async function executeQuery<T = any>(
  role: UserRole,
  userId: number | undefined,
  queryText: string,
  values?: any[]
): Promise<pg.QueryResult<T>> {
  const pool = getPoolForRole(role);
  return queryWithRLS<T>(pool, userId, queryText, values);
}

// Обновленная функция транзакции с поддержкой RLS
export async function withTransaction<T>(
  handler: (client: pg.PoolClient) => Promise<T>,
  userId?: number,
  role: UserRole = "admin"
): Promise<T> {
  const pool = getPoolForRole(role);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (userId !== undefined) {
      // SET LOCAL не поддерживает параметризованные запросы
      await client.query(`SET LOCAL app.current_user_id = ${userId}`);
    }
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

