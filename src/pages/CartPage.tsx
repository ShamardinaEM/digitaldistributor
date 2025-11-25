import { useNavigate } from "react-router-dom";
import { useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "../store/cartStore";
import { checkout } from "../api/orders";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const clearCart = useCartStore((state) => state.clearCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!items.length) return;
    if (!cardNumber.trim()) {
      setError("Введите номер карты");
      return;
    }
    setIsPaying(true);
    setError(null);
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
      navigate("/orders");
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.response?.data?.message || "Не удалось провести оплату";
      setError(errorMessage);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h2>Корзина</h2>
        {items.length === 0 ? (
          <p>Добавьте игры из каталога.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
      </section>

      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h3>Оплата</h3>
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
        {error && <p style={{ color: "#ff8080" }}>{error}</p>}
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

