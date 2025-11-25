import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/http";
import { Review } from "../types/App";
import { useNotificationStore } from "../store/notificationStore";

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((state) => state.show);
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  const { data: reviews = [], isLoading, error } = useQuery({
    queryKey: ["reviews", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/moderation/reviews?status=${encodeURIComponent(statusFilter)}` : "/moderation/reviews";
      const { data } = await apiClient.get<Review[]>(url);
      return data;
    },
    retry: 1,
  });

  const approveMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await apiClient.patch(`/moderation/reviews/${reviewId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      showNotification("Отзыв одобрен");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await apiClient.patch(`/moderation/reviews/${reviewId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      showNotification("Отзыв отклонен");
    },
  });

  if (isLoading) return <p>Загрузка...</p>;
  if (error) return <p style={{ color: "#ff8080" }}>Ошибка загрузки отзывов. Проверьте консоль.</p>;

  return (
    <div>
      <h1>Отзывы</h1>
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button
          onClick={() => setStatusFilter("")}
          style={{ padding: "8px 16px", background: statusFilter === "" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Все
        </button>
        <button
          onClick={() => setStatusFilter("На модерации")}
          style={{ padding: "8px 16px", background: statusFilter === "На модерации" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          На модерации
        </button>
        <button
          onClick={() => setStatusFilter("Проверен")}
          style={{ padding: "8px 16px", background: statusFilter === "Проверен" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Проверенные
        </button>
        <button
          onClick={() => setStatusFilter("Отклонен")}
          style={{ padding: "8px 16px", background: statusFilter === "Отклонен" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Отклоненные
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {reviews.map((review) => (
          <div
            key={review.id}
            style={{
              background: "#151b28",
              padding: 20,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{review.appTitle}</h3>
                <p style={{ margin: 0, color: "#b4bfd6" }}>От {review.userUsername}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#9fb2ff" }}>{"★".repeat(review.evaluation)}</span>
                <span style={{ color: "#b4bfd6" }}>{review.status}</span>
              </div>
            </div>
            <p style={{ margin: "12px 0", color: "#e0e6ed" }}>{review.comment}</p>
            {review.status === "На модерации" && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => approveMutation.mutate(review.id)}
                  style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                >
                  Одобрить
                </button>
                <button
                  onClick={() => rejectMutation.mutate(review.id)}
                  style={{ padding: "8px 16px", background: "#f44336", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                >
                  Отклонить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

