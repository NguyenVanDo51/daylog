import { QueryClient } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';

describe('queryClient', () => {
  it('exports a QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('has a default staleTime of 2 minutes', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(120000);
  });

  it('has a default retry of 1', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1);
  });
});
