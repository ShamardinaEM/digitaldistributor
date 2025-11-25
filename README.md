# Digital Distributor

React + TypeScript витрина в стиле Steam с сервером на Express и PostgreSQL.

## Фичи
- Авторизация по email/нику с созданием пользователя в таблице `users`.
- Каталог приложений с поиском и фильтром по категориям.
- Карточки товаров, детальная страница, корзина, оформление заказа и мок-оплата.
- Лента заказов на основе таблицы `sales`.
- Форма обращения в техподдержку с записью в таблицу `support_requests`.
- Подключение к PostgreSQL согласно схеме из задания.

## Быстрый старт

```bash
npm install
```

1. Поднимите PostgreSQL и выполните SQL из задания. Дополнительно сервер сам создаст таблицу `support_requests`, но вы можете создать её вручную:
   ```sql
   CREATE TABLE IF NOT EXISTS support_requests (
       request_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
       subject TEXT NOT NULL,
       message TEXT NOT NULL,
       priority TEXT NOT NULL DEFAULT 'normal',
       status statusType DEFAULT 'Создан',
       created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. Создайте `.env` на основе `env.example` и заполните `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`.

3. Укажите базу API для фронта:
   - либо задайте `VITE_API_BASE_URL` в `.env` (например, `http://localhost:4000/api`);
   - либо используйте значение по умолчанию (такое же).

4. Запустите фронт и сервер параллельно:
   ```bash
   npm run dev:full
   ```
   или по отдельности `npm run dev` и `npm run dev:server`.

## Структура API

- `POST /api/auth/login` — вход/регистрация клиента.
- `GET /api/apps` (+ `search`, `categoryId`) и `GET /api/apps/:id`.
- `GET /api/apps/categories` — список категорий.
- `GET /api/orders` и `POST /api/orders/checkout` — работа с заказами (JWT).
- `POST /api/support` — отправка обращения в поддержку (JWT).

## Тестовые шаги

1. Выполните SQL и наполните таблицы `providers`, `categories`, `apps`.
2. Запустите бекенд: `npm run dev:server`.
3. Запустите фронт: `npm run dev`.
4. При открытии сайта появится модальное окно авторизации; введите email/ник.
5. Проверьте поиск, фильтрацию, добавление в корзину и оформление заказа.
6. Убедитесь, что заказы появляются во вкладке «Мои заказы» и создаются записи в `sales`.
7. Отправьте обращение в поддержку и проверьте таблицу `support_requests`.

