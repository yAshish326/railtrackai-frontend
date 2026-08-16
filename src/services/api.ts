import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";

import { env } from "../config/env";
import { authStore } from "../store/authStore";
import { ROUTES } from "../utils/constants";
import { getToken } from "../utils/storage";

const BASE_TIMEOUT_MS = 30000;

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

class ApiService {
    private readonly client: AxiosInstance;
    private readonly inFlightGets = new Map<string, Promise<AxiosResponse<unknown>>>();

    constructor() {
        this.client = axios.create({
            baseURL: env.apiBaseUrl,
            timeout: BASE_TIMEOUT_MS,
            headers: {
                "Content-Type": "application/json",
            },
        });

        this.client.interceptors.request.use((config) => {
            const token = getToken();

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            return config;
        });

        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    const requestUrl = String(error.config?.url ?? "");

                    if (!requestUrl.includes("/auth/")) {
                        authStore.logout();

                        if (typeof window !== "undefined" && window.location.pathname !== ROUTES.LOGIN) {
                            window.location.replace(ROUTES.LOGIN);
                        }
                    }
                }

                return Promise.reject(error);
            },
        );
    }

    private async request<T>(config: AxiosRequestConfig, retries = 1): Promise<AxiosResponse<T>> {
        try {
            return await this.client.request<T>(config);
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            const shouldRetry = retries > 0 && (!status || status >= 500 || status === 429 || status === 408);

            if (shouldRetry) {
                await wait(300);
                return this.request<T>(config, retries - 1);
            }

            throw error;
        }
    }

    get<T>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
        // Prevent any frontend GETs to history endpoints — server-side handles storage.
        if (typeof url === "string" && url.includes("/history")) {
            // return an empty successful response without making a network call
            // eslint-disable-next-line no-console
            console.info(`Blocked frontend GET to history endpoint: ${url}`);
            const fake: AxiosResponse<T> = {
                data: ([]) as unknown as T,
                status: 200,
                statusText: "OK",
                headers: {},
                config: { headers: {} } as any,
                request: {} as any,
            };
            return Promise.resolve(fake);
        }

        const key = `${url}:${JSON.stringify(config.params ?? {})}`;
        const existing = this.inFlightGets.get(key) as Promise<AxiosResponse<T>> | undefined;

        if (existing) {
            return existing;
        }

        const pending = this.request<T>({ ...config, url, method: "GET" }).finally(() => {
            this.inFlightGets.delete(key);
        });

        this.inFlightGets.set(key, pending as Promise<AxiosResponse<unknown>>);
        return pending;
    }

    post<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, url, data, method: "POST" });
    }

    put<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, url, data, method: "PUT" });
    }

    delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, url, method: "DELETE" });
    }
}

const api = new ApiService();

export default api;