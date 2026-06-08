import { File } from 'expo-file-system';

export function getLocalFileSize(uri: string): number {
  const file = new File(uri);
  return file.exists ? file.size : 0;
}

/** PUT a local file to a presigned URL via expo-file-system (RN fetch rejects file URIs). */
export async function putLocalFile(
  url: string,
  localUri: string,
  contentType: string,
): Promise<number> {
  const file = new File(localUri);
  const result = await file.upload(url, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
    mimeType: contentType,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed: ${result.status}`);
  }
  return file.exists ? file.size : 0;
}
