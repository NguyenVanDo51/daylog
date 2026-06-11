import { useOnboardingStore } from '../onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ seen: null });
  });

  it('starts with seen=null (loading)', () => {
    expect(useOnboardingStore.getState().seen).toBeNull();
  });

  it('setSeen(true) updates the flag', () => {
    useOnboardingStore.getState().setSeen(true);
    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('setSeen(false) updates the flag', () => {
    useOnboardingStore.getState().setSeen(false);
    expect(useOnboardingStore.getState().seen).toBe(false);
  });
});
