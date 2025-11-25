import { Link, useNavigate } from "react-router-dom";
import { App } from "../types/App";
import { useCartStore } from "../store/cartStore";
import { useNotificationStore } from "../store/notificationStore";
import { authStore } from "../store/authStore";
import { checkOwnership } from "../api/apps";

interface Props {
  app: App;
  isOwned?: boolean;
}

export default function AppCard({ app, isOwned = false }: Props) {
  const navigate = useNavigate();
  const addToCart = useCartStore((state) => state.addToCart);
  const items = useCartStore((state) => state.items);
  const showNotification = useNotificationStore((state) => state.show);
  const user = authStore((state) => state.user);

  const handleAddToCart = async () => {
    if (isOwned) {
      showNotification("У вас уже есть этот товар", "error");
      return;
    }
    if (!user) {
      showNotification("Необходима авторизация", "error");
      return;
    }
    // Проверяем, есть ли товар уже в корзине
    if (items.some((item) => item.app.id === app.id)) {
      showNotification("Товар уже в корзине", "error");
      return;
    }
    try {
      const owned = await checkOwnership(app.id);
      if (owned) {
        showNotification("У вас уже есть этот товар", "error");
        return;
      }
      addToCart(app);
      showNotification(`${app.title} добавлен в корзину`);
    } catch (error) {
      console.error(error);
      showNotification("Не удалось проверить наличие товара", "error");
    }
  };

  return (
    <div
      style={{
        background: "#191f2c",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {app.imageUrl && (
        <img
          src={app.imageUrl}
          alt={app.title}
          style={{
            width: "100%",
            height: 200,
            objectFit: "cover",
            borderRadius: 12,
            marginBottom: 8,
          }}
        />
      )}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ textTransform: "uppercase", fontSize: 12, color: "#9fb2ff", margin: 0 }}>
            {app.category?.title ?? "Категория"}
          </p>
          {app.releaseDate && (
            <p style={{ fontSize: 12, color: "#b4bfd6", margin: 0 }}>
              {new Date(app.releaseDate).toLocaleDateString("ru-RU", { year: "numeric", month: "long" })}
            </p>
          )}
        </div>
        <h3 style={{ margin: "4px 0", fontSize: 20 }}>{app.title}</h3>
        {app.provider && (
          <Link
            to={`/providers/${app.provider.id}`}
            style={{ fontSize: 12, color: "#9fb2ff", textDecoration: "none", marginTop: 4, display: "block" }}
            onClick={(e) => e.stopPropagation()}
          >
            {app.provider.name}
          </Link>
        )}
      </div>
      <p style={{ color: "#b4bfd6", flexGrow: 1 }}>{app.description.slice(0, 90)}...</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{app.price.toLocaleString("ru-RU")} ₽</span>
        <Link style={{ fontSize: 14, color: "#9fb2ff" }} to={`/apps/${app.id}`}>
          Подробнее
        </Link>
      </div>
      {isOwned ? (
        <button
          onClick={() => navigate(`/apps/${app.id}`)}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(120deg,rgba(250, 181, 91, 0.77),rgba(255, 91, 91, 0.82))",
            color: "white",
          }}
        >
          Оставить отзыв
        </button>
      ) : items.some((item) => item.app.id === app.id) ? (
        <button
          onClick={() => navigate("/cart")}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(120deg, #4a7c5a, #5a9c6a)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span>🛒</span>
          Перейти к покупке
        </button>
      ) : (
        <button
          onClick={handleAddToCart}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
            color: "white",
          }}
        >
          В корзину
        </button>
      )}
    </div>
  );
}
