import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getProviders,
    addProvider,
    getCategories,
    addApp,
    type AddProviderData,
    type AddAppData,
} from "../api/admin";
import { useNotificationStore } from "../store/notificationStore";

export default function AddProductsPage() {
    const queryClient = useQueryClient();
    const showNotification = useNotificationStore((state) => state.show);

    // Форма добавления поставщика
    const [providerForm, setProviderForm] = useState<AddProviderData>({
        provider_name: "",
        provider_type: "Разработчик",
        country: "",
        founded_date: "",
        web: "",
    });

    // Форма добавления товара
    const [appForm, setAppForm] = useState<AddAppData>({
        provider_id: 0,
        title: "",
        description: "",
        cost_price: 0,
        price: 0,
        release_date: "",
        category_id: 0,
    });

    // Загрузка данных
    const { data: providers = [], isLoading: providersLoading } = useQuery({
        queryKey: ["admin-providers"],
        queryFn: getProviders,
    });

    const { data: categories = [], isLoading: categoriesLoading } = useQuery({
        queryKey: ["admin-categories"],
        queryFn: getCategories,
    });

    // Мутации
    const addProviderMutation = useMutation({
        mutationFn: addProvider,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
            showNotification("Поставщик успешно добавлен", "success");
            setProviderForm({
                provider_name: "",
                provider_type: "Разработчик",
                country: "",
                founded_date: "",
                web: "",
            });
        },
        onError: (error: any) => {
            showNotification(
                error.response?.data?.message ||
                    "Ошибка при добавлении поставщика",
                "error"
            );
        },
    });

    const addAppMutation = useMutation({
        mutationFn: addApp,
        onSuccess: () => {
            showNotification("Товар успешно добавлен", "success");
            setAppForm({
                provider_id: 0,
                title: "",
                description: "",
                cost_price: 0,
                price: 0,
                release_date: "",
                category_id: 0,
            });
        },
        onError: (error: any) => {
            showNotification(
                error.response?.data?.message || "Ошибка при добавлении товара",
                "error"
            );
        },
    });

    const handleProviderSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Проверка заполненности всех полей
        if (!providerForm.provider_name.trim()) {
            showNotification("Название поставщика обязательно", "error");
            return;
        }
        if (!providerForm.country.trim()) {
            showNotification("Страна обязательна", "error");
            return;
        }
        if (!providerForm.founded_date) {
            showNotification("Дата основания обязательна", "error");
            return;
        }
        const providerData: AddProviderData = {
            ...providerForm,
            web:
                providerForm.web && providerForm.web.trim()
                    ? providerForm.web.trim()
                    : undefined,
        };

        addProviderMutation.mutate(providerData);
    };

    const handleAppSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Проверка заполненности всех полей
        if (!appForm.provider_id) {
            showNotification("Выберите поставщика", "error");
            return;
        }
        if (!appForm.title.trim()) {
            showNotification("Название товара обязательно", "error");
            return;
        }
        if (!appForm.description.trim()) {
            showNotification("Описание обязательно", "error");
            return;
        }
        if (typeof(appForm.cost_price) !== "string" && appForm.cost_price < 0) {
            showNotification(
                "Цена по себестоимости должна быть положительной",
                "error"
            );
            return;
        }
        if (typeof appForm.price !== "string" && appForm.price < 0) {
            showNotification("Цена должна быть положительной", "error");
            return;
        }
        if (!appForm.release_date) {
            showNotification("Дата выпуска обязательна", "error");
            return;
        }
        if (!appForm.category_id) {
            showNotification("Выберите категорию", "error");
            return;
        }

        addAppMutation.mutate(appForm);
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "12px",
        background: "#151b28",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        color: "#e0e6ed",
        fontSize: 14,
        boxSizing: "border-box",
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        marginBottom: 8,
        color: "#b4bfd6",
        fontSize: 14,
        fontWeight: 500,
    };

    const sectionStyle: React.CSSProperties = {
        background: "#151b28",
        padding: 24,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.05)",
        marginBottom: 32,
    };

    return (
        <div>
            <h1 style={{ marginBottom: 32 }}>Добавление товаров</h1>

            {/* Раздел добавления поставщика */}
            <section style={sectionStyle}>
                <h2
                    style={{ marginTop: 0, marginBottom: 24, color: "#9fb2ff" }}
                >
                    Добавление поставщика
                </h2>
                <form onSubmit={handleProviderSubmit}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <label style={labelStyle}>Название *</label>
                            <input
                                type="text"
                                value={providerForm.provider_name}
                                onChange={(e) =>
                                    setProviderForm({
                                        ...providerForm,
                                        provider_name: e.target.value,
                                    })
                                }
                                style={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Тип *</label>
                            <select
                                value={providerForm.provider_type}
                                onChange={(e) =>
                                    setProviderForm({
                                        ...providerForm,
                                        provider_type: e.target.value as
                                            | "Разработчик"
                                            | "Издатель",
                                    })
                                }
                                style={inputStyle}
                                required
                            >
                                <option value="Разработчик">Разработчик</option>
                                <option value="Издатель">Издатель</option>
                            </select>
                        </div>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <label style={labelStyle}>Страна *</label>
                            <input
                                type="text"
                                value={providerForm.country}
                                onChange={(e) =>
                                    setProviderForm({
                                        ...providerForm,
                                        country: e.target.value,
                                    })
                                }
                                style={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Дата основания *</label>
                            <input
                                type="date"
                                value={providerForm.founded_date}
                                onChange={(e) =>
                                    setProviderForm({
                                        ...providerForm,
                                        founded_date: e.target.value,
                                    })
                                }
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Веб-страница</label>
                        <input
                            type="url"
                            value={providerForm.web}
                            onChange={(e) =>
                                setProviderForm({
                                    ...providerForm,
                                    web: e.target.value,
                                })
                            }
                            style={inputStyle}
                            placeholder="https://example.com"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={addProviderMutation.isPending}
                        style={{
                            padding: "12px 24px",
                            background: "#5b7cfa",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: addProviderMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 14,
                            fontWeight: 600,
                            opacity: addProviderMutation.isPending ? 0.6 : 1,
                        }}
                    >
                        {addProviderMutation.isPending
                            ? "Добавление..."
                            : "Добавить поставщика"}
                    </button>
                </form>
            </section>

            {/* Раздел добавления товаров */}
            <section style={sectionStyle}>
                <h2
                    style={{ marginTop: 0, marginBottom: 24, color: "#9fb2ff" }}
                >
                    Добавление товаров
                </h2>
                <form onSubmit={handleAppSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Поставщик *</label>
                        <select
                            value={appForm.provider_id}
                            onChange={(e) =>
                                setAppForm({
                                    ...appForm,
                                    provider_id: Number(e.target.value),
                                })
                            }
                            style={inputStyle}
                            required
                            disabled={providersLoading}
                        >
                            <option value={0}>Выберите поставщика</option>
                            {providers.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Название *</label>
                        <input
                            type="text"
                            value={appForm.title}
                            onChange={(e) =>
                                setAppForm({
                                    ...appForm,
                                    title: e.target.value,
                                })
                            }
                            style={inputStyle}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Описание *</label>
                        <textarea
                            value={appForm.description}
                            onChange={(e) =>
                                setAppForm({
                                    ...appForm,
                                    description: e.target.value,
                                })
                            }
                            style={{
                                ...inputStyle,
                                minHeight: 100,
                                resize: "vertical",
                            }}
                            required
                        />
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <label style={labelStyle}>
                                Цена по себестоимости *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={appForm.cost_price}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Если пустая строка - сохраняем как пустую строку
                                    // Если число - сохраняем как число
                                    setAppForm({
                                        ...appForm,
                                        cost_price:
                                            value === "" ? "" : Number(value),
                                    });
                                }}
                                onBlur={(e) => {
                                    // При потере фокуса, если поле пустое, возвращаем 0
                                    if (e.target.value === "") {
                                        setAppForm({
                                            ...appForm,
                                            cost_price: 0,
                                        });
                                    }
                                }}
                                style={inputStyle}
                                required
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Цена *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={appForm.price}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setAppForm({
                                        ...appForm,
                                        price:
                                            value === "" ? "" : Number(value),
                                    });
                                }}
                                onBlur={(e) => {
                                    // При потере фокуса, если поле пустое, возвращаем 0
                                    if (e.target.value === "") {
                                        setAppForm({
                                            ...appForm,
                                            price: 0,
                                        });
                                    }
                                }}
                                style={inputStyle}
                                required
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <label style={labelStyle}>Дата выпуска *</label>
                            <input
                                type="date"
                                value={appForm.release_date}
                                onChange={(e) =>
                                    setAppForm({
                                        ...appForm,
                                        release_date: e.target.value,
                                    })
                                }
                                style={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Категория *</label>
                            <select
                                value={appForm.category_id}
                                onChange={(e) =>
                                    setAppForm({
                                        ...appForm,
                                        category_id: Number(e.target.value),
                                    })
                                }
                                style={inputStyle}
                                required
                                disabled={categoriesLoading}
                            >
                                <option value={0}>Выберите категорию</option>
                                {categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={addAppMutation.isPending}
                        style={{
                            padding: "12px 24px",
                            background: "#5b7cfa",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: addAppMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 14,
                            fontWeight: 600,
                            opacity: addAppMutation.isPending ? 0.6 : 1,
                        }}
                    >
                        {addAppMutation.isPending
                            ? "Добавление..."
                            : "Добавить"}
                    </button>
                </form>
            </section>
        </div>
    );
}
