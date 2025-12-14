import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { getPoolForRole } from "./db/pool";
import authRouter from "./routes/auth";
import appsRouter from "./routes/apps";
import ordersRouter from "./routes/orders";
import supportRouter from "./routes/support";
import profileRouter from "./routes/profile";
import moderationRouter from "./routes/moderation";
import employeeSupportRouter from "./routes/employee-support";
import analyticsRouter from "./routes/analytics";
import adminRouter from "./routes/admin";
import providersRouter from "./routes/providers";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/apps", appsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/support", supportRouter);
app.use("/api/profile", profileRouter);
app.use("/api/moderation", moderationRouter);
app.use("/api/employee-support", employeeSupportRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/providers", providersRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: "Непредвиденная ошибка" });
});

async function ensureTables() {
  const adminPool = getPoolForRole("admin");
  
  // Добавляем password_hash в users если его нет
  await adminPool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
      ) THEN
        ALTER TABLE users ADD COLUMN password_hash TEXT;
      END IF;
    END $$;
  `);

  // Добавляем username и password_hash в employees если их нет
  await adminPool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'username'
      ) THEN
        ALTER TABLE employees ADD COLUMN username TEXT UNIQUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'password_hash'
      ) THEN
        ALTER TABLE employees ADD COLUMN password_hash TEXT;
      END IF;
    END $$;
  `);

  // Создаем или обновляем support_requests
  await adminPool.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      request_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status statustype NOT NULL DEFAULT 'Создан',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL,
      taken_at TIMESTAMPTZ
    )
  `);

  // Добавляем колонки если таблица уже существовала
  await adminPool.query(`
    DO $$ 
    BEGIN
      -- Исправляем тип status если он был TEXT вместо statustype
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_requests' AND column_name = 'status'
        AND udt_name != 'statustype'
      ) THEN
        -- Удаляем старый constraint если есть
        ALTER TABLE support_requests DROP CONSTRAINT IF EXISTS support_requests_status_check;
        -- Меняем тип на statustype
        ALTER TABLE support_requests ALTER COLUMN status TYPE statustype USING status::statustype;
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_requests' AND column_name = 'employee_id'
      ) THEN
        ALTER TABLE support_requests ADD COLUMN employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_requests' AND column_name = 'taken_at'
      ) THEN
        ALTER TABLE support_requests ADD COLUMN taken_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_requests' AND column_name = 'order_id'
      ) THEN
        ALTER TABLE support_requests ADD COLUMN order_id INT REFERENCES sales(sale_id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'support_requests' AND column_name = 'closed_at'
      ) THEN
        ALTER TABLE support_requests ADD COLUMN closed_at TIMESTAMPTZ;
      END IF;
    END $$;
  `);

  // Создаем таблицу сообщений в поддержке (чат)
  // Убеждаемся, что support_requests существует перед созданием support_messages
  try {
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        message_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        request_id INT REFERENCES support_requests(request_id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'employee')),
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (error: any) {
    // Если таблица support_requests не существует, создадим её сначала
    if (error?.code === '42P01' || error?.message?.includes('support_requests')) {
      console.log("Creating support_requests table first...");
      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS support_requests (
          request_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal',
          status statustype NOT NULL DEFAULT 'Создан',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL,
          taken_at TIMESTAMPTZ
        )
      `);
      // Теперь создаем support_messages
      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS support_messages (
          message_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          request_id INT REFERENCES support_requests(request_id) ON DELETE CASCADE,
          sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'employee')),
          sender_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } else {
      throw error;
    }
  }
}

// Автоматическая смена статусов заказов
function startOrderStatusUpdater() {
  const adminPool = getPoolForRole("admin");
  setInterval(async () => {
    try {
      await adminPool.query(
        `UPDATE sales SET status = 'В обработке' 
         WHERE status = 'Создан' 
         AND sale_date < NOW() - INTERVAL '15 seconds'`,
      );

      await adminPool.query(
        `UPDATE sales SET status = 'Завершен' 
         WHERE status = 'В обработке' 
         AND sale_date < NOW() - INTERVAL '25 seconds'`,
      );
    } catch (error) {
      console.error("Status update error", error);
    }
  }, 5000);
}

const port = Number(process.env.PORT) || 4000;

ensureTables()
  .then(() => {
    startOrderStatusUpdater();
    app.listen(port, () => {
      console.log(`API server listening on http://localhost:${port}`);
    });
  })
  .catch((error: any) => {
    console.error("Failed to start server", error);
    if (error?.code === "42501") {
      console.error("\n❌ ОШИБКА ПРАВ ДОСТУПА:");
      if (error?.message?.includes("must be owner")) {
        console.error("Пользователь БД не является владельцем таблиц.");
        console.error("Для выполнения ALTER TABLE нужно быть владельцем таблицы.");
        console.error("\nВыполните обновленный SQL скрипт: grant_schema_permissions.sql");
        console.error("Он передаст владение всех таблиц роли db_admin.\n");
      } else {
        console.error("У пользователя БД нет прав на схему public.");
        console.error("Выполните SQL скрипт: grant_schema_permissions.sql");
        console.error("Или выполните вручную:");
        console.error("  GRANT USAGE ON SCHEMA public TO db_admin;");
        console.error("  GRANT CREATE ON SCHEMA public TO db_admin;");
        console.error("  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO db_admin;");
        console.error("  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO db_admin;\n");
      }
    }
    process.exit(1);
  });

