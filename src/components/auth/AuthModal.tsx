import { FormEvent, useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { checkUsername } from "../../api/auth";

export default function AuthModal() {
  const navigate = useNavigate();
  const { isAuthenticated, login, register, isLoading, error } = authStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    login: state.login,
    register: state.register,
    isLoading: state.isLoading,
    error: state.error,
  }));

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (isRegisterMode && username.length >= 3) {
      const timer = setTimeout(async () => {
        setCheckingUsername(true);
        try {
          const result = await checkUsername(username);
          setUsernameAvailable(result.available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
    }
  }, [username, isRegisterMode]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isRegisterMode) {
        await register({ email, username, password });
      } else {
        await login({ username, password });
      }
      navigate("/");
    } catch {
      // Ошибка уже в store
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backdropFilter: "blur(10px)",
        background: "rgba(7,9,14,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          background: "#151a24",
          padding: 32,
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2 style={{ margin: 0 }}>{isRegisterMode ? "Регистрация" : "Вход"}</h2>
        <p style={{ margin: 0, color: "#b4bfd6" }}>
          {isRegisterMode ? "Создайте аккаунт" : "Авторизуйтесь, чтобы попасть в магазин"}
        </p>

        {isRegisterMode && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 14, color: "#9fb2ff" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#9fb2ff" }}>Никнейм</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            style={inputStyle}
            placeholder="Имя пользователя"
          />
          {isRegisterMode && username.length >= 3 && (
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

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#9fb2ff" }}>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegisterMode ? 6 : 1}
            style={inputStyle}
            placeholder="••••••"
          />
        </label>

        {error && (
          <span style={{ color: "#ff8080", fontSize: 14 }}>
            {error}
          </span>
        )}

        <button
          type="submit"
          disabled={isLoading || (isRegisterMode && usernameAvailable === false)}
          style={{
            padding: "12px 16px",
            border: "none",
            borderRadius: 12,
            background: "linear-gradient(120deg, #5b7cfa, #7a5bff)",
            color: "white",
            cursor: isLoading || (isRegisterMode && usernameAvailable === false) ? "not-allowed" : "pointer",
            fontWeight: 600,
            opacity: isLoading || (isRegisterMode && usernameAvailable === false) ? 0.6 : 1,
          }}
        >
          {isLoading ? (isRegisterMode ? "Регистрируем..." : "Входим...") : isRegisterMode ? "Зарегистрироваться" : "Войти"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setEmail("");
            setUsername("");
            setPassword("");
            setUsernameAvailable(null);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#9fb2ff",
            cursor: "pointer",
            fontSize: 14,
            padding: 8,
          }}
        >
          {isRegisterMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </form>
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
