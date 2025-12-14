import { NavLink, Outlet } from "react-router-dom";
import { authStore } from "../../store/authStore";

export default function MainLayout() {
  const user = authStore((state) => state.user);
  const isEmployee = authStore((state) => state.isEmployee);
  const logout = authStore((state) => state.logout);
  const role = user?.role || "user";

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 40px",
          position: "sticky",
          top: 0,
          backdropFilter: "blur(12px)",
          background: "rgba(10,12,20,0.85)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          zIndex: 10,
        }}
      >
        <NavLink to="/" style={{ fontWeight: 700, fontSize: 20, textDecoration: "none", color: "inherit" }}>
          Digital Distributor
        </NavLink>
        <nav style={{ display: "flex", gap: 20 }}>
          {
            <NavLink style={navStyle} to="/">
              Главная страница
            </NavLink>
          }
          {/* Вкладки для сотрудников (по роли, не по isEmployee) */}
          {(role === "moderator" || role === "admin") && (
            <NavLink style={navStyle} to="/moderation">
              Модерация отзывов
            </NavLink>
          )}
          {(role === "support" || role === "admin") && (
            <NavLink style={navStyle} to="/employee-support">
              Техническая Поддержка
            </NavLink>
          )}
          {(role === "analyst" || role === "admin") && (
            <NavLink style={navStyle} to="/analytics">
              Аналитика
            </NavLink>
          )}
          {role === "admin" && (
            <NavLink style={navStyle} to="/add-products">
              Добавление товаров
            </NavLink>
          )}
          {/* Вкладки для обычных пользователей */}
          {role === "user" && (
            <>
              <NavLink style={navStyle} to="/orders">
                Мои заказы
              </NavLink>
              <NavLink style={navStyle} to="/support">
                Техподдержка
              </NavLink>
            </>
          )}
        </nav>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{user?.username}</p>
          <button
            onClick={logout}
            style={{
              background: "transparent",
              color: "#9fb2ff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      <main style={{ padding: "32px 60px", maxWidth: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}

function navStyle({ isActive }: { isActive: boolean }) {
  return {
    color: isActive ? "#ffffff" : "#9fb2ff",
    fontWeight: isActive ? 600 : 500,
  };
}

