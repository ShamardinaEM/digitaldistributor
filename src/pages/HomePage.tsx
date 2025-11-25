import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApps, getCategories, getOwnedApps } from "../api/apps";
import { App } from "../types/App";
import AppCard from "../components/AppCard";
import { authStore } from "../store/authStore";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const user = authStore((state) => state.user);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps", { search, categoryId }],
    queryFn: () => getApps({ search, categoryId }),
  });

  const { data: ownedApps = [] } = useQuery({
    queryKey: ["ownedApps"],
    queryFn: getOwnedApps,
    enabled: !!user,
  });

  const ownedAppIds = useMemo(() => new Set(ownedApps.map((a) => a.id)), [ownedApps]);

  // Фиксированная новинка недели - берем первый товар из всех (независимо от фильтров)
  const { data: allApps = [] } = useQuery({
    queryKey: ["apps", {}],
    queryFn: () => getApps({}),
  });

  const heroApp = useMemo(() => allApps[0] || null, [allApps]);
  const catalog = useMemo(() => apps, [apps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            padding: 32,
            borderRadius: 24,
            background: "linear-gradient(135deg, #25335e, #121a2d)",
            minHeight: 260,
          }}
        >
          <p style={{ color: "#9fb2ff", textTransform: "uppercase", letterSpacing: 2 }}> Новые релизы</p>
          <h1 style={{ fontSize: 36, margin: "12px 0" }}>Цифровой дистрибьютор</h1>
          <p style={{ color: "#b4bfd6" }}>Соберите бандл, отсортируйте по жанрам, оплачивайте в один клик.</p>
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <input
              placeholder="Найти игру или приложение..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={searchInputStyle}
            />
            <select
              value={categoryId ?? ""}
              onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)}
              style={selectStyle}
            >
              <option value="">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {heroApp && <HeroApp app={heroApp} />}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Каталог</h2>
          <span style={{ color: "#9fb2ff" }}>({apps.length} приложений найдено)</span>
        </div>

        {isLoading ? (
          <span>Загружаем каталог...</span>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
              maxWidth: "100%",
            }}
          >
            {catalog.map((app) => (
              <AppCard key={app.id} app={app} isOwned={ownedAppIds.has(app.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroApp({ app }: { app: App }) {
  return (
    <div
      style={{
        background: "#151b28",
        borderRadius: 24,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p style={{ color: "#9fb2ff", margin: 0 }}>Новинка недели</p>
      <h3 style={{ margin: 0 }}>{app.title}</h3>
      <p style={{ color: "#b4bfd6", flexGrow: 1 }}>{app.description.slice(0, 140)}...</p>
      <span style={{ fontSize: 18, fontWeight: 600 }}>{app.price.toLocaleString("ru-RU")} ₽</span>
    </div>
  );
}

const searchInputStyle: CSSProperties = {
  flex: 1,
  borderRadius: 16,
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
};

const selectStyle: CSSProperties = {
  borderRadius: 16,
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
};
