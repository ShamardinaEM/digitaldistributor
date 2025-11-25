import { useState, FormEvent, type CSSProperties } from "react";
import { authStore } from "../store/authStore";
import { updateUsername, updatePassword } from "../api/profile";
import { getOwnedApps } from "../api/apps";
import { useQuery } from "@tanstack/react-query";
import { useNotificationStore } from "../store/notificationStore";
import { checkUsername } from "../api/auth";
import AppCard from "../components/AppCard";

export default function ProfilePage() {
  const user = authStore((state) => state.user);
  const setUser = authStore((state) => state.setUser);
  const showNotification = useNotificationStore((state) => state.show);

  const [usernameEdit, setUsernameEdit] = useState(user?.username || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const { data: ownedApps = [], isLoading: isLoadingOwned, error: ownedError } = useQuery({
    queryKey: ["ownedApps"],
    queryFn: getOwnedApps,
    enabled: !!user,
    retry: 1,
  });

  if (ownedError) {
    console.error("Error loading owned apps:", ownedError);
  }

  const handleCheckUsername = async (value: string) => {
    if (value.length >= 3 && value !== user?.username) {
      setCheckingUsername(true);
      try {
        const result = await checkUsername(value);
        setUsernameAvailable(result.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleSaveUsername = async (e: FormEvent) => {
    e.preventDefault();
    if (usernameEdit === user?.username) {
      setIsEditingUsername(false);
      return;
    }
    if (usernameAvailable !== true) {
      showNotification("Никнейм недоступен", "error");
      return;
    }
    try {
      const updatedUser = await updateUsername({ username: usernameEdit });
      setUser(updatedUser);
      setIsEditingUsername(false);
      showNotification("Никнейм успешно изменен");
    } catch (error: any) {
      showNotification(error?.response?.data?.message || "Не удалось изменить никнейм", "error");
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotification("Пароли не совпадают", "error");
      return;
    }
    if (newPassword.length < 6) {
      showNotification("Пароль должен быть не менее 6 символов", "error");
      return;
    }
    setIsPasswordLoading(true);
    try {
      await updatePassword({ oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
      showNotification("Пароль успешно изменен");
    } catch (error: any) {
      showNotification(error?.response?.data?.message || "Не удалось изменить пароль", "error");
    } finally {
      setIsPasswordLoading(false);
    }
  };

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
        <h2>Профиль</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div>
            <p style={{ margin: 0, color: "#b4bfd6" }}>Email</p>
            <p style={{ margin: "4px 0 0 0", fontWeight: 600 }}>{user?.email}</p>
          </div>

          {!isEditingUsername ? (
            <div>
              <p style={{ margin: 0, color: "#b4bfd6" }}>Никнейм</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <p style={{ margin: "5px 10px 0 0", fontWeight: 600 }}>{user?.username}</p>
                <button
                  onClick={() => {
                    setIsEditingUsername(true);
                    setUsernameEdit(user?.username || "");
                    setUsernameAvailable(null);
                  }}
                  style={buttonStyle}
                >
                  Изменить
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveUsername} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "#9fb2ff" }}>Никнейм</span>
                <input
                  value={usernameEdit}
                  onChange={(e) => {
                    setUsernameEdit(e.target.value);
                    handleCheckUsername(e.target.value);
                  }}
                  required
                  minLength={3}
                  style={inputStyle}
                />
                {usernameEdit.length >= 3 && usernameEdit !== user?.username && (
                  <span style={{ fontSize: 12, color: usernameAvailable ? "#4a7c5a" : "#7c4a4a" }}>
                    {checkingUsername
                      ? "Проверяем..."
                      : usernameAvailable === true
                        ? "✓ Никнейм свободен"
                        : usernameAvailable === false
                          ? "✗ Никнейм занят"
                          : null}
                  </span>
                )}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={usernameAvailable !== true} style={buttonStyle}>
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameEdit(user?.username || "");
                    setUsernameAvailable(null);
                  }}
                  style={{ ...buttonStyle, background: "transparent", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          <div>
            <p style={{ margin: 0, color: "#b4bfd6" }}>Дата регистрации</p>
            <p style={{ margin: "4px 0 0 0", fontWeight: 600 }}>
              {user?.regDate ? new Date(user.regDate).toLocaleDateString("ru-RU") : "—"}
            </p>
          </div>

          {!isChangingPassword ? (
            <div>
              <p style={{ margin: 0, color: "#b4bfd6" }}>Пароль</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <p style={{ margin: "5px 10px 0 0", fontWeight: 600 }}>******</p>
                <button
                  onClick={() => setIsChangingPassword(true)}
                  style={{ ...buttonStyle, padding: "6px 12px", fontSize: 14 }}
                >
                  Изменить пароль
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "#9fb2ff" }}>Старый пароль</span>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "#9fb2ff" }}>Новый пароль</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "#9fb2ff" }}>Подтвердите пароль</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={isPasswordLoading} style={buttonStyle}>
                  {isPasswordLoading ? "Сохраняем..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  style={{ ...buttonStyle, background: "transparent", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  Отмена
                </button>
              </div>
            </form>
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
        <h2>Мои продукты</h2>
        {isLoadingOwned ? (
          <p style={{ color: "#b4bfd6" }}>Загрузка...</p>
        ) : ownedError ? (
          <p style={{ color: "#ff8080" }}>Ошибка загрузки продуктов. Проверьте консоль.</p>
        ) : ownedApps.length === 0 ? (
          <p style={{ color: "#b4bfd6" }}>Вы ещё ничего не купили.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, marginTop: 16 }}>
            {ownedApps.map((app) => (
              <AppCard key={app.id} app={app} isOwned={true} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#10141d",
  color: "white",
  padding: "12px 14px",
};

const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};
