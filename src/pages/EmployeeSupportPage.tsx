import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/http";
import { SupportRequest, SupportMessage } from "../types/App";
import { useNotificationStore } from "../store/notificationStore";
import { authStore } from "../store/authStore";

export default function EmployeeSupportPage() {
  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((state) => state.show);
  const employeeId = authStore((state) => state.user?.id);
  const role = authStore((state) => state.user?.role);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["support-requests"],
    queryFn: async () => {
      const { data } = await apiClient.get<SupportRequest[]>("/employee-support/requests");
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await apiClient.get<SupportMessage[]>(`/employee-support/requests/${selectedRequest}/messages`);
      return data;
    },
    enabled: !!selectedRequest,
  });

  const takeMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiClient.patch(`/employee-support/requests/${requestId}/take`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      showNotification("Заявка взята в работу");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: number; message: string }) => {
      await apiClient.post(`/employee-support/requests/${requestId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      setMessageText("");
      showNotification("Сообщение отправлено");
    },
  });

  const closeRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiClient.patch(`/employee-support/requests/${requestId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      showNotification("Заявка закрыта");
    },
  });

  if (isLoading) return <p>Загрузка...</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
      <div>
        <h2>Заявки в поддержку</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((request) => (
            <div
              key={request.id}
              onClick={() => setSelectedRequest(request.id)}
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
                <span style={{ color: "#9fb2ff" }}>{request.status}</span>
              </div>
              <p style={{ margin: 0, color: "#b4bfd6", fontSize: 14 }}>{request.userUsername}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {!request.employeeId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      takeMutation.mutate(request.id);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#5b7cfa",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Взять в работу
                  </button>
                )}
                {role === "admin" && request.status !== "Завершен" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeRequestMutation.mutate(request.id);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#7c4a4a",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Закрыть
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {selectedRequest && (
        <div>
          <h2>Чат</h2>
          <div
            style={{
              background: "#151b28",
              padding: 20,
              borderRadius: 16,
              height: "60vh",
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
                    background: msg.senderType === "employee" ? "#1b2232" : "#0f1419",
                    borderRadius: 8,
                    alignSelf: msg.senderType === "employee" ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#9fb2ff", marginBottom: 4 }}>{msg.senderUsername}</div>
                  <div>{msg.message}</div>
                </div>
              ))}
            </div>
            {selectedRequest && requests.find((r) => r.id === selectedRequest)?.status !== "Завершен" && (
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
                    if (messageText.trim() && selectedRequest) {
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
            )}
            {selectedRequest && requests.find((r) => r.id === selectedRequest)?.status === "Завершен" && (
              <p style={{ color: "#9fb2ff", textAlign: "center", padding: 12 }}>
                Заявка завершена. Сообщения недоступны.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

