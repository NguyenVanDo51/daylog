import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  }
});

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('api baseURL', () => {
  it('defaults to http://localhost:3000 when EXPO_PUBLIC_API_URL is not set', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_API_URL;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { api: freshApi } = require('@/lib/api');
      expect(freshApi.defaults.baseURL).toBe('http://localhost:3000');
    });
  });

  it('uses EXPO_PUBLIC_API_URL when set', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { api: freshApi } = require('@/lib/api');
      expect(freshApi.defaults.baseURL).toBe('https://api.example.com');
    });
  });
});

describe('api request interceptor', () => {
  it('attaches Authorization header when a token exists in the store', () => {
    useAuthStore.setState({ token: 'abc' });
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.request.handlers[0];
    const result = handler.fulfilled({ headers: {} });
    expect(result).toEqual({ headers: { Authorization: 'Bearer abc' } });
  });

  it('leaves headers alone when no token is present', () => {
    useAuthStore.setState({ token: null });
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.request.handlers[0];
    const result = handler.fulfilled({ headers: {} });
    expect(result).toEqual({ headers: {} });
    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('api response interceptor', () => {
  it('passes successful responses through untouched', () => {
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.response.handlers[0];
    const res = { data: 'ok' };
    expect(handler.fulfilled(res)).toBe(res);
  });

  it('calls clearAuth on 401 and rejects with the error', async () => {
    const clearAuth = jest.fn();
    useAuthStore.setState({ clearAuth });
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.response.handlers[0];
    const err = { response: { status: 401 } };
    await expect(handler.rejected(err)).rejects.toEqual(err);
    expect(clearAuth).toHaveBeenCalledTimes(1);
  });

  it('does NOT call clearAuth on non-401 errors (e.g. 500)', async () => {
    const clearAuth = jest.fn();
    useAuthStore.setState({ clearAuth });
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.response.handlers[0];
    const err = { response: { status: 500 } };
    await expect(handler.rejected(err)).rejects.toEqual(err);
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it('handles errors with no response object (e.g. network failure)', async () => {
    const clearAuth = jest.fn();
    useAuthStore.setState({ clearAuth });
    // @ts-expect-error axios interceptor manager exposes handlers at runtime
    const handler = api.interceptors.response.handlers[0];
    const err = { message: 'Network error' };
    await expect(handler.rejected(err)).rejects.toEqual(err);
    expect(clearAuth).not.toHaveBeenCalled();
  });
});
