import { useState, FormEvent, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApp, checkOwnership } from "../api/apps";
import { apiClient } from "../api/http";
import { useCartStore } from "../store/cartStore";
import { useNotificationStore } from "../store/notificationStore";
import { authStore } from "../store/authStore";
import { AppReviewsResponse } from "../types/App";

export default function AppPage() {
  const params = useParams();
  const appId = Number(params.id);
  const user = authStore((state) => state.user);
  const showNotification = useNotificationStore((state) => state.show);
  const queryClient = useQueryClient();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  if (!appId) {
    return <p>Некорректное приложение</p>;
  }
  const { data: app, isLoading } = useQuery({
    queryKey: ["app", appId],
    queryFn: () => getApp(appId),
    enabled: !!appId,
  });

  const { data: isOwned = false } = useQuery({
    queryKey: ["appOwned", appId],
    queryFn: () => checkOwnership(appId),
    enabled: !!appId && !!user,
  });

  const { data: reviewsResponse } = useQuery({
    queryKey: ["app-reviews", appId],
    queryFn: async () => {
      const { data } = await apiClient.get<AppReviewsResponse>(`/apps/${appId}/reviews`);
      return data;
    },
    enabled: !!appId,
  });
  const reviews = reviewsResponse?.reviews ?? [];
  const userReview = reviewsResponse?.userReview ?? null;
  const hasPendingReview = userReview?.status === "На модерации";
  const hasApprovedReview = userReview?.status === "Проверен";
  const canSubmitReview = Boolean(isOwned && user && !hasPendingReview && !hasApprovedReview);

  useEffect(() => {
    if (!canSubmitReview && showReviewForm) {
      setShowReviewForm(false);
    }
  }, [canSubmitReview, showReviewForm]);

  const createReviewMutation = useMutation({
    mutationFn: async ({ appId, evaluation, comment }: { appId: number; evaluation: number; comment: string }) => {
      const { data } = await apiClient.post(`/apps/${appId}/reviews`, { appId, evaluation, comment });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-reviews", appId] });
      setShowReviewForm(false);
      setReviewText("");
      setReviewRating(5);
      showNotification("Отзыв отправлен на модерацию");
    },
  });

  const addToCart = useCartStore((state) => state.addToCart);

  const handleAddToCart = async () => {
    if (isOwned) {
      showNotification("У вас уже есть этот товар", "error");
      return;
    }
    if (!user) {
      showNotification("Необходима авторизация", "error");
      return;
    }
    try {
      const owned = await checkOwnership(appId);
      if (owned) {
        showNotification("У вас уже есть этот товар", "error");
        return;
      }
      if (app) {
        addToCart(app);
        showNotification(`${app.title} добавлен в корзину`);
      }
    } catch (error) {
      console.error(error);
      showNotification("Не удалось проверить наличие товара", "error");
    }
  };

  if (isLoading || !app) {
    return <p>Загружаем приложение...</p>;
  }

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!isOwned) {
      showNotification("Вы можете оставить отзыв только на купленные приложения", "error");
      return;
    }
    if (!user) {
      showNotification("Необходима авторизация", "error");
      return;
    }
    if (!canSubmitReview) {
      showNotification("Вы уже оставили отзыв на это приложение", "error");
      return;
    }
    createReviewMutation.mutate({ appId, evaluation: reviewRating, comment: reviewText });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        <section
          style={{
            background: "#151b28",
            borderRadius: 24,
            padding: 32,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {app.imageUrl && (
            <img
              src={app.imageUrl}
              alt={app.title}
              style={{
                width: "100%",
                maxHeight: 400,
                objectFit: "cover",
                borderRadius: 16,
                marginBottom: 24,
              }}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ color: "#9fb2ff", margin: 0 }}>{app.category?.title}</p>
            {app.releaseDate && (
              <p style={{ color: "#b4bfd6", margin: 0, fontSize: 14 }}>
                {new Date(app.releaseDate).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
          <h1 style={{ margin: "8px 0" }}>{app.title}</h1>
          {app.provider && (
            <Link
              to={`/providers/${app.provider.id}`}
              style={{
                color: "#9fb2ff",
                textDecoration: "none",
                fontSize: 16,
                display: "inline-block",
                marginBottom: 8,
              }}
            >
              Издатель: {app.provider.name}
            </Link>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {app.releaseDate && (
              <div>
                <span style={{ color: "#9fb2ff", fontSize: 14 }}>Дата релиза: </span>
                <span style={{ color: "#b4bfd6" }}>
                  {new Date(app.releaseDate).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            )}
            {app.provider?.country && (
              <div>
                <span style={{ color: "#9fb2ff", fontSize: 14 }}>Страна: </span>
                <span style={{ color: "#b4bfd6" }}>{app.provider.country}</span>
              </div>
            )}
          </div>
          <p style={{ color: "#b4bfd6" }}>{app.description}</p>
        </section>
        <aside
          style={{
            background: "#151b28",
            borderRadius: 24,
            padding: 24,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <p style={{ margin: 0, color: "#b4bfd6" }}>Цена</p>
          <h2 style={{ margin: "8px 0" }}>{app.price.toLocaleString("ru-RU")} ₽</h2>
          <button
            onClick={handleAddToCart}
            disabled={isOwned}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: isOwned
                ? "#3a3a3a"
                : "linear-gradient(120deg, #5b7cfa, #7a5bff)",
              color: "white",
              cursor: isOwned ? "not-allowed" : "pointer",
              opacity: isOwned ? 0.6 : 1,
            }}
          >
            {isOwned ? "Уже куплено" : "Добавить в корзину"}
          </button>
        </aside>
      </div>

      {/* Отзывы */}
      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 32,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h2>Отзывы</h2>
        {isOwned && user && !showReviewForm && (
          <>
            {hasPendingReview && (
              <p style={{ color: "#ffa500", marginBottom: 20, padding: 12, background: "#1b2232", borderRadius: 12 }}>
                Отзыв отправлен на модерацию
              </p>
            )}
            {hasApprovedReview && (
              <p style={{ color: "#4caf50", marginBottom: 20, padding: 12, background: "#1b2232", borderRadius: 12 }}>
                Ваш отзыв опубликован
              </p>
            )}
            {canSubmitReview && (
              <button
                onClick={() => setShowReviewForm(true)}
                style={{
                  marginBottom: 20,
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(120deg, #4a7c5a, #5a9c6a)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Оставить отзыв
              </button>
            )}
          </>
        )}
        {showReviewForm && (
          <form onSubmit={handleSubmitReview} style={{ marginBottom: 24, padding: 20, background: "#1b2232", borderRadius: 16 }}>
            <h3 style={{ marginTop: 0 }}>Написать отзыв</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, color: "#b4bfd6" }}>Оценка</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      color: star <= reviewRating ? "#ffd700" : "#666",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <span style={{ color: "#b4bfd6" }}>Текст отзыва</span>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#10141d",
                  color: "white",
                  resize: "vertical",
                }}
                placeholder="Напишите ваш отзыв..."
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={createReviewMutation.isPending}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {createReviewMutation.isPending ? "Отправляем..." : "Отправить на модерацию"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewText("");
                  setReviewRating(5);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
        {reviews.length === 0 ? (
          <p style={{ color: "#b4bfd6" }}>Отзывов пока нет...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {reviews.map((review) => (
              <div
                key={review.id}
                style={{
                  padding: 20,
                  background: "#1b2232",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <strong>{review.userUsername}</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#b4bfd6", fontSize: 12 }}>
                      {new Date(review.reviewDate).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <div style={{ color: "#ffd700", fontSize: 20 }}>{"★".repeat(review.evaluation)}</div>
                </div>
                <p style={{ margin: 0, color: "#e0e6ed" }}>{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
