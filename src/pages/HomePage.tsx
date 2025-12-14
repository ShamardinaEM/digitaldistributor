import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApps, getCategories, getOwnedApps } from "../api/apps";
import AppCard from "../components/AppCard";
import { authStore } from "../store/authStore";
import ProfileSection from "../components/ProfileSection";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const user = authStore((state) => state.user);
  const role = user?.role || "user";
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: role === "user",
  });

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps", { search, categoryId }],
    queryFn: () => getApps({ search, categoryId }),
    enabled: role === "user",
  });

  const { data: ownedApps = [] } = useQuery({
    queryKey: ["ownedApps"],
    queryFn: getOwnedApps,
    enabled: role === "user"
  });

  const ownedAppIds = useMemo(() => new Set(ownedApps.map((a) => a.id)), [ownedApps]);
  const catalog = useMemo(() => apps, [apps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {user && <ProfileSection />}
      {role === "user" && (
        <>
      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Поиск</h2>
        <p style={{ margin: "4px 0", color: "#b4bfd6" }}>Поиск:</p>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            placeholder="Найти игру или приложение"
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
      </section>

      <section
        style={{
          background: "#151b28",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Каталог</h2>
          <span style={{ color: "#9fb2ff", fontSize: 14 }}>Найдено: {apps.length}</span>
        </div>

        {isLoading ? (
          <span style={{ color: "#b4bfd6" }}>Загружаем каталог...</span>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: "100%",
            }}
          >
            {catalog.map((app) => (
              <AppCard key={app.id} app={app} isOwned={ownedAppIds.has(app.id)} />
            ))}
          </div>
        )}
      </section>
    </>)} 
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
