import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, cancelOrder } from "../api/orders";
import { useNotificationStore } from "../store/notificationStore";
import { useState } from "react";

export default function OrdersPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    refetchInterval: 2000, // Обновляем каждые 2 секунды для отслеживания статусов
  });

  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((state) => state.show);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancel = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      await cancelOrder(orderId);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      showNotification("Заказ отменен");
    } catch (error: any) {
      showNotification(error?.response?.data?.message || "Не удалось отменить заказ", "error");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Создан":
        return "#9fb2ff";
      case "В обработке":
        return "#ffa500";
      case "Завершен":
        return "#4a7c5a";
      case "Отменен":
        return "#7c4a4a";
      default:
        return "#b4bfd6";
    }
  };

  return (
    <section
      style={{
        background: "#151b28",
        borderRadius: 24,
        padding: 24,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <h2>Мои заказы</h2>
      {isLoading ? (
        <p>Загружаем заказы...</p>
      ) : data.length === 0 ? (
        <p>Вы ещё ничего не купили.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {data.map((order) => (
            <article
              key={order.id}
              style={{
                padding: 16,
                borderRadius: 16,
                background: "#1b2232",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span
                    style={{
                      color: getStatusColor(order.status),
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {order.status}
                  </span>
                </div>
                <h3 style={{ margin: "4px 0" }}>{order.app.title}</h3>
                <p style={{ margin: 0, color: "#b4bfd6", fontSize: 14 }}>
                  {new Date(order.saleDate).toLocaleDateString("ru-RU")} в{" "}
                  {new Date(order.saleDate).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {order.downloadLink && (
                  <a
                    href={order.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      padding: "6px 12px",
                      background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
                      color: "white",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    Скачать
                  </a>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <strong style={{ fontSize: 18 }}>{order.amount.toLocaleString("ru-RU")} ₽</strong>
                {order.status !== "Завершен" && order.status !== "Отменен" && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={cancellingId === order.id}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "#ff8080",
                      cursor: cancellingId === order.id ? "not-allowed" : "pointer",
                      fontSize: 14,
                      opacity: cancellingId === order.id ? 0.6 : 1,
                    }}
                  >
                    {cancellingId === order.id ? "Отмена..." : "Отменить заказ"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
