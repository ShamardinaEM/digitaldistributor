import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/http";
import { App } from "../types/App";
import AppCard from "../components/AppCard";

interface Provider {
  id: number;
  name: string;
  type: string;
  description?: string;
  country?: string | null;
  foundedDate?: string | null;
  web?: string | null;
}

export default function ProviderPage() {
  const params = useParams();
  const providerId = Number(params.id);

  const { data: provider, isLoading: isLoadingProvider } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const { data } = await apiClient.get<Provider>(`/providers/${providerId}`);
      return data;
    },
    enabled: !!providerId,
  });

  const { data: apps = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ["provider-apps", providerId],
    queryFn: async () => {
      const { data } = await apiClient.get<App[]>(`/providers/${providerId}/apps`);
      return data;
    },
    enabled: !!providerId,
  });

  if (isLoadingProvider || !provider) {
    return <p>Загрузка...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 32,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 600,
              color: "white",
            }}
          >
            {provider.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>{provider.name}</h1>
            <p style={{ margin: "4px 0 0 0", color: "#9fb2ff" }}>{provider.type}</p>
          </div>
        </div>
        {provider.description && <p style={{ color: "#b4bfd6", marginBottom: 16 }}>{provider.description}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {provider.country && (
            <div>
              <span style={{ color: "#9fb2ff", fontSize: 14 }}>Страна: </span>
              <span style={{ color: "#b4bfd6" }}>{provider.country}</span>
            </div>
          )}
          {provider.foundedDate && (
            <div>
              <span style={{ color: "#9fb2ff", fontSize: 14 }}>Дата основания: </span>
              <span style={{ color: "#b4bfd6" }}>
                {new Date(provider.foundedDate).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          )}
          {provider.web && (
            <div>
              <span style={{ color: "#9fb2ff", fontSize: 14 }}>Веб-сайт: </span>
              <a href={provider.web} target="_blank" rel="noopener noreferrer" style={{ color: "#5b7cfa", textDecoration: "none" }}>
                {provider.web}
              </a>
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 32,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h2>Приложения</h2>
        {isLoadingApps ? (
          <p>Загрузка приложений...</p>
        ) : apps.length === 0 ? (
          <p style={{ color: "#b4bfd6" }}>У этого издателя пока нет приложений</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20, marginTop: 16 }}>
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

