import { FormEvent, useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sendSupportRequest, getSupportRequests, getSupportMessages, sendSupportMessage } from "../api/support";
import { getOrders } from "../api/orders";
import { SupportRequest, SupportMessage } from "../types/App";
import { useNotificationStore } from "../store/notificationStore";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((state) => state.show);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["support-requests"],
    queryFn: getSupportRequests,
  });


  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", selectedRequest],
    queryFn: () => selectedRequest ? getSupportMessages(selectedRequest) : Promise.resolve([]),
    enabled: !!selectedRequest,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ requestId, message }: { requestId: number; message: string }) =>
      sendSupportMessage(requestId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      setMessageText("");
      showNotification("Сообщение отправлено");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.response?.data?.issues?.message?._errors?.[0] || "Не удалось отправить сообщение";
      showNotification(message, "error");
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderId) {
      setStatusMessage("Выберите заказ");
      return;
    }
    setIsSending(true);
    setStatusMessage(null);
    try {
      const response = await sendSupportRequest({ subject, message, priority, orderId });
      setSubject("");
      setMessage("");
      setOrderId(null);
      setPriority("normal");
      setStatusMessage(null);
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      // Закрываем форму и показываем список обращений
      setShowForm(false);
      setSelectedRequest(null);
      showNotification(`Обращение №${response.id} успешно создано`);
    } catch (error) {
      console.error(error);
      setStatusMessage("Не удалось отправить обращение");
    } finally {
      setIsSending(false);
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
      case "Закрыт":
        return "#7c4a4a";
      default:
        return "#b4bfd6";
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2>Мои обращения</h2>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) {
                setSelectedRequest(null);
              }
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: showForm ? "#7c4a4a" : "#5b7cfa",
              color: "white",
              cursor: "pointer",
            }}
          >
            {showForm ? "✕ Закрыть" : "+ Новое обращение"}
          </button>
        </div>
        {showForm ? (
          <section
            style={{
              background: "#151b28",
              borderRadius: 24,
              padding: 24,
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h3>Создать обращение</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={labelStyle}>
                Заказ *
                <select
                  value={orderId ?? ""}
                  onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : null)}
                  style={inputStyle}
                  required
                >
                  <option value="">Выберите заказ</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{order.id} - {order.app.title} ({order.status}) - {order.amount.toLocaleString("ru-RU")} ₽
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Тема
                <input value={subject} onChange={(event) => setSubject(event.target.value)} style={inputStyle} required />
              </label>
              <label style={labelStyle}>
                Приоритет
                <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} style={inputStyle}>
                  <option value="low">Низкий</option>
                  <option value="normal">Средний</option>
                  <option value="high">Высокий</option>
                </select>
              </label>
              <label style={labelStyle}>
                Сообщение
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>
              {statusMessage && <p style={{ color: "#ff8080" }}>{statusMessage}</p>}
              <button
                type="submit"
                disabled={isSending}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {isSending ? "Отправляем..." : "Отправить"}
              </button>
            </form>
          </section>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.length === 0 ? (
              <p style={{ color: "#b4bfd6" }}>У вас пока нет обращений</p>
            ) : (
              requests.map((request) => (
              <div
                key={request.id}
                onClick={() => {
                  setSelectedRequest(request.id);
                  setShowForm(false);
                }}
                style={{
                  background: selectedRequest === request.id ? "#1b2232" : "#151b28",
                  padding: 16,
                  borderRadius: 12,
                  cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>{request.subject}</strong>
                  <span style={{ color: getStatusColor(request.status), fontSize: 12 }}>{request.status}</span>
                </div>
                <p style={{ margin: 0, color: "#b4bfd6", fontSize: 12 }}>
                  {new Date(request.createdAt).toLocaleDateString("ru-RU")}
                </p>
                {request.employeeUsername && (
                  <p style={{ margin: "4px 0 0 0", color: "#9fb2ff", fontSize: 12 }}>
                    Сотрудник: {request.employeeUsername}
                  </p>
                )}
              </div>
              ))
            )}
          </div>
        )}
      </div>
      {selectedRequest && !showForm && (
        <div>
          <h2>Чат</h2>
          <div
            style={{
              background: "#151b28",
              padding: 20,
              borderRadius: 16,
              height: "70vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: msg.senderType === "user" ? "#1b2232" : "#0f1419",
                    borderRadius: 8,
                    alignSelf: msg.senderType === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#9fb2ff", marginBottom: 4 }}>{msg.senderUsername}</div>
                  <div>{msg.message}</div>
                  <div style={{ fontSize: 10, color: "#b4bfd6", marginTop: 4 }}>
                    {new Date(msg.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Введите сообщение..."
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "#10141d",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "white",
                }}
              />
              <button
                onClick={() => {
                  if (!messageText.trim()) {
                    showNotification("Сообщение не может быть пустым", "error");
                    return;
                  }
                  if (messageText.trim().length < 1) {
                    showNotification("Сообщение слишком короткое", "error");
                    return;
                  }
                  if (selectedRequest) {
                    sendMessageMutation.mutate({ requestId: selectedRequest, message: messageText });
                  }
                }}
                style={{
                  padding: "10px 20px",
                  background: "#5b7cfa",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  color: "#b4bfd6",
};

const inputStyle: CSSProperties = {
  borderRadius: 12,
  padding: "12px 14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#10141d",
  color: "white",
  width: "100%",
};

