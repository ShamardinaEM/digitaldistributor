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
        borderRadius: 14,
        padding: 16,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {app.imageUrl && (
        <img
          src={app.imageUrl}
          alt={app.title}
          style={{
            width: "100%",
            height: 140,
            objectFit: "cover",
            borderRadius: 10,
            marginBottom: 4,
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
        <Link
          to={`/apps/${app.id}`}
          style={{ margin: "2px 0", fontSize: 20, fontWeight: 700, color: "white", textDecoration: "none" }}
        >
          {app.title}
        </Link>
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
      <p style={{ color: "#b4bfd6", flexGrow: 1, margin: "2px 0" }}>{app.description.slice(0, 70)}...</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{app.price.toLocaleString("ru-RU")} ₽</span>
        {isOwned ? (
          <button
            onClick={() => navigate(`/apps/${app.id}`)}
            style={actionButtonStyle("linear-gradient(120deg,rgba(250, 181, 91, 0.77),rgba(255, 91, 91, 0.82))")}
          >
            Оставить отзыв
          </button>
        ) : items.some((item) => item.app.id === app.id) ? (
          <button
            onClick={() => navigate("/cart")}
            style={actionButtonStyle("linear-gradient(120deg, #4a7c5a, #5a9c6a)")}
          >
            🛒 В корзине
          </button>
        ) : (
          <button onClick={handleAddToCart} style={actionButtonStyle("linear-gradient(120deg, #5b7cfa, #7a5bff)")}>
            В корзину
          </button>
        )}
      </div>
    </div>
  );
}

function actionButtonStyle(background: string) {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background,
    color: "white",
    fontWeight: 600,
    minWidth: 120,
  };
}
