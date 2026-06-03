import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('authStore', () => {
  it('starts with no token or user', () => {
    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth stores token and user', () => {
    const user = { id: '1', display_name: 'Sarah', email: 'sarah@example.com', avatar_url: null };
    useAuthStore.getState().setAuth('jwt-token', user);
    expect(useAuthStore.getState().token).toBe('jwt-token');
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('clearAuth removes token and user', () => {
    useAuthStore.setState({ token: 'abc', user: { id: '1', display_name: 'Sarah', email: '', avatar_url: null } });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
