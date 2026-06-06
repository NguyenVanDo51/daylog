import { File } from 'expo-file-system';

type ReactNativeFileBody = {
  uri: string;
  type: string;
  name: string;
};

function toFileBody(uri: string, contentType: string): ReactNativeFileBody {
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'bin';
  return { uri, type: contentType, name: `upload.${ext}` };
}

export function getLocalFileSize(uri: string): number {
  const file = new File(uri);
  return file.exists ? file.size : 0;
}

/** PUT a local file to a presigned URL (React Native — no Blob). */
export async function putLocalFile(
  url: string,
  localUri: string,
  contentType: string,
): Promise<number> {
  const res = await fetch(url, {
    method: 'PUT',
    body: toFileBody(localUri, contentType) as unknown as BodyInit,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  return getLocalFileSize(localUri);
}
