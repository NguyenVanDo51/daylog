import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function compressToWebP(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 2048 } }],
    { compress: 0.85, format: SaveFormat.WEBP },
  );
  return result.uri;
}
