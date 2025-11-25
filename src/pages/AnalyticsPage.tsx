import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/http";
import { AnalyticsMetrics, Order } from "../types/App";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "",
    userId: "",
    appId: "",
  });

  const { data: metrics } = useQuery({
    queryKey: ["analytics-metrics", period],
    queryFn: async () => {
      const { data } = await apiClient.get<AnalyticsMetrics>(`/analytics/metrics?period=${period}`);
      return data;
    },
  });

  const { data: topApps } = useQuery({
    queryKey: ["analytics-top-apps"],
    queryFn: async () => {
      const { data } = await apiClient.get("/analytics/top-apps");
      return data;
    },
  });

  const { data: salesByDay } = useQuery({
    queryKey: ["analytics-sales-by-day"],
    queryFn: async () => {
      const { data } = await apiClient.get("/analytics/sales-by-day?days=30");
      return data;
    },
  });

  const { data: ordersData } = useQuery({
    queryKey: ["analytics-orders", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.status) params.append("status", filters.status);
      if (filters.userId) params.append("userId", filters.userId);
      if (filters.appId) params.append("appId", filters.appId);
      const { data } = await apiClient.get<{ orders: Order[]; total: number }>(`/analytics/orders?${params}`);
      return data;
    },
  });

  return (
    <div>
      <h1>Аналитика</h1>

      {/* Период для метрик */}
      <div style={{ marginBottom: 24, display: "flex", gap: 10 }}>
        <button
          onClick={() => setPeriod("day")}
          style={{ padding: "8px 16px", background: period === "day" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          День
        </button>
        <button
          onClick={() => setPeriod("week")}
          style={{ padding: "8px 16px", background: period === "week" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Неделя
        </button>
        <button
          onClick={() => setPeriod("month")}
          style={{ padding: "8px 16px", background: period === "month" ? "#5b7cfa" : "#1b2232", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Месяц
        </button>
      </div>

      {/* Метрики */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Заказы</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.ordersCount}</p>
          </div>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Выручка</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.revenue.toLocaleString("ru-RU")} ₽</p>
          </div>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Новые пользователи</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.newUsers}</p>
          </div>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Возвраты</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.returns}</p>
          </div>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Средний чек</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.avgCheck.toLocaleString("ru-RU")} ₽</p>
          </div>
          <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: 0, color: "#9fb2ff" }}>Обращения в поддержку</h3>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{metrics.supportRequests}</p>
          </div>
        </div>
      )}

      {/* Топ приложений */}
      {topApps && (
        <div style={{ background: "#151b28", padding: 20, borderRadius: 16, marginBottom: 24 }}>
          <h2>Топ продаваемых приложений</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topApps.map((app: any, index: number) => (
              <div key={app.appId} style={{ display: "flex", justifyContent: "space-between", padding: 12, background: "#1b2232", borderRadius: 8 }}>
                <div>
                  <strong>{index + 1}. {app.title}</strong>
                  <p style={{ margin: 0, color: "#b4bfd6" }}>Продаж: {app.salesCount}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{app.totalRevenue.toLocaleString("ru-RU")} ₽</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Фильтры заказов */}
      <div style={{ background: "#151b28", padding: 20, borderRadius: 16, marginBottom: 24 }}>
        <h2>Фильтры заказов</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <input
            type="date"
            placeholder="Начальная дата"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            style={{ padding: "10px 14px", background: "#10141d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white" }}
          />
          <input
            type="date"
            placeholder="Конечная дата"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            style={{ padding: "10px 14px", background: "#10141d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white" }}
          />
          <input
            placeholder="Статус"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{ padding: "10px 14px", background: "#10141d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white" }}
          />
          <input
            type="number"
            placeholder="ID пользователя"
            value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            style={{ padding: "10px 14px", background: "#10141d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white" }}
          />
          <input
            type="number"
            placeholder="ID приложения"
            value={filters.appId}
            onChange={(e) => setFilters({ ...filters, appId: e.target.value })}
            style={{ padding: "10px 14px", background: "#10141d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white" }}
          />
        </div>
      </div>

      {/* Список заказов */}
      {ordersData && (
        <div style={{ background: "#151b28", padding: 20, borderRadius: 16 }}>
          <h2>Заказы ({ordersData.total})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ordersData.orders.map((order: any) => (
              <div key={order.id} style={{ padding: 16, background: "#1b2232", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>{order.app.title}</strong>
                    <p style={{ margin: 0, color: "#b4bfd6" }}>Пользователь: {order.user.username}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0 }}>{order.amount.toLocaleString("ru-RU")} ₽</p>
                    <p style={{ margin: 0, color: "#9fb2ff" }}>{order.status}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#b4bfd6" }}>{new Date(order.saleDate).toLocaleDateString("ru-RU")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

