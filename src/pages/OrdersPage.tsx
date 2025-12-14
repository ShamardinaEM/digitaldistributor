import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, cancelOrder, checkout } from "../api/orders";
import { useNotificationStore } from "../store/notificationStore";
import { useCartStore } from "../store/cartStore";
import { useState, type CSSProperties } from "react";

export default function OrdersPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    refetchInterval: 2000, // Обновляем каждые 2 секунды для отслеживания статусов
  });

  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((state) => state.show);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const clearCart = useCartStore((state) => state.clearCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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

  const handleCheckout = async () => {
    if (!items.length) return;
    if (!cardNumber.trim()) {
      setPayError("Введите номер карты");
      return;
    }
    setIsPaying(true);
    setPayError(null);
    try {
      await checkout({
        items: items.map((item) => ({
          appId: item.app.id,
          price: item.app.price,
          quantity: item.quantity,
        })),
        payment: { method: "card", cardLast4: cardNumber.slice(-4) || "0000" },
      });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      clearCart();
      showNotification("Заказ оформлен");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Не удалось провести оплату";
      setPayError(errorMessage);
    } finally {
      setIsPaying(false);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.05)",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
        }}
      >
        <div>
          <h2 style={{ marginTop: 0 }}>Оформление заказа</h2>
          {items.length === 0 ? (
            <p style={{ color: "#b4bfd6" }}>Добавьте продукты из каталога.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((item) => (
                <article
                  key={item.app.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 16,
                    background: "#1b2232",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{item.app.title}</h3>
                    <p style={{ margin: 0, color: "#b4bfd6" }}>
                      {item.quantity} x {item.app.price.toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 600 }}>
                      {(item.app.price * item.quantity).toLocaleString("ru-RU")} ₽
                    </span>
                    <button
                      onClick={() => removeFromCart(item.app.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "#ff8080",
                        borderRadius: 8,
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Оплата</h3>
          <label style={labelStyle}>
            <span>Номер карты</span>
            <input
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              placeholder="0000 0000 0000 0000"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>CVV</span>
            <input value={cvv} onChange={(event) => setCvv(event.target.value)} placeholder="123" style={inputStyle} />
          </label>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <span>Итого:</span>
            <strong>{total().toLocaleString("ru-RU")} ₽</strong>
          </div>
          {payError && <p style={{ color: "#ff8080" }}>{payError}</p>}
          <button
            onClick={handleCheckout}
            disabled={!items.length || isPaying}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
              color: "white",
              cursor: "pointer",
            }}
          >
            {isPaying ? "Оплата..." : "Оплатить и оформить"}
          </button>
        </div>
      </section>

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
          <p>У вас ещё нет заказов.</p>
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
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 12,
  color: "#b4bfd6",
};

const inputStyle: CSSProperties = {
  borderRadius: 12,
  padding: "12px 14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#10141d",
  color: "white",
};
