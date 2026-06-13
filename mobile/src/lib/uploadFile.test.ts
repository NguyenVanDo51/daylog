jest.mock('expo-file-system', () => {
  const state = { exists: true, size: 1234 };
  const upload = jest.fn();
  const FileCtor = jest.fn().mockImplementation(() => ({
    get exists() { return state.exists; },
    get size() { return state.size; },
    upload,
  }));
  // Expose handles for the test to drive.
  (FileCtor as unknown as { __state: typeof state }).__state = state;
  (FileCtor as unknown as { __upload: typeof upload }).__upload = upload;
  return { File: FileCtor };
});

import { File } from 'expo-file-system';
import { getLocalFileSize, putLocalFile } from '@/lib/uploadFile';

const state = (File as unknown as { __state: { exists: boolean; size: number } }).__state;
const mockUpload = (File as unknown as { __upload: jest.Mock }).__upload;

beforeEach(() => {
  mockUpload.mockReset();
  state.exists = true;
  state.size = 1234;
});

describe('getLocalFileSize', () => {
  test('returns the file size when the file exists', () => {
    state.exists = true;
    state.size = 4096;
    expect(getLocalFileSize('file:///tmp/a.webp')).toBe(4096);
  });

  test('returns 0 when the file does not exist', () => {
    state.exists = false;
    expect(getLocalFileSize('file:///tmp/missing.webp')).toBe(0);
  });
});

describe('putLocalFile', () => {
  test('PUTs with the given content type and resolves to the file size on 2xx', async () => {
    state.size = 9999;
    mockUpload.mockResolvedValueOnce({ status: 200 });
    const size = await putLocalFile('https://r2/sig', 'file:///tmp/x.webp', 'image/webp');
    expect(mockUpload).toHaveBeenCalledWith('https://r2/sig', {
      httpMethod: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      mimeType: 'image/webp',
    });
    expect(size).toBe(9999);
  });

  test('throws when the upload returns a non-2xx status', async () => {
    mockUpload.mockResolvedValueOnce({ status: 403 });
    await expect(putLocalFile('https://r2/sig', 'file:///x', 'image/webp')).rejects.toThrow(
      /Upload failed: 403/,
    );
  });

  test('returns 0 when the file does not exist after upload', async () => {
    state.exists = false;
    mockUpload.mockResolvedValueOnce({ status: 204 });
    const size = await putLocalFile('https://r2/sig', 'file:///x', 'image/webp');
    expect(size).toBe(0);
  });

  test('treats 5xx as failure', async () => {
    mockUpload.mockResolvedValueOnce({ status: 500 });
    await expect(putLocalFile('https://r2/sig', 'file:///x', 'image/webp')).rejects.toThrow(
      /Upload failed: 500/,
    );
  });
});
