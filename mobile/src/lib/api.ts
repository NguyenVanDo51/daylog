import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      SecureStore.deleteItemAsync('auth_token').catch(() => {});
      SecureStore.deleteItemAsync('auth_user').catch(() => {});
    }
    return Promise.reject(err);
  },
);
