import axios, { AxiosRequestConfig, Method } from 'axios';

export interface ApiRequestOptions {
    url: string;
    method?: Method;
    params?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
}

let authHeaders: Record<string, string> = {};

export function setHeaders(headers: Record<string, string>) {
    authHeaders = headers;
}

export async function apiRequest<T = any>({
    url,
    method = 'GET',
    params,
    body,
    headers,
    timeout = 30000,
}: ApiRequestOptions): Promise<T> {
    // Merge global authHeaders with per-request headers
    const mergedHeaders = { ...authHeaders, ...headers };

    const config: AxiosRequestConfig = {
        url,
        method,
        params,
        data: body,
        headers: mergedHeaders,
        timeout,
        responseType: 'json',
    };

    try {
        const response = await axios.request<T>(config);
        return response.data;
    } catch (error: any) {
        throw error.response?.data || error.message || error;
    }
}
