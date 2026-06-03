import * as ImagePicker from 'expo-image-picker';

export function extractTakenAt(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.exif?.DateTimeOriginal) {
    const raw = asset.exif.DateTimeOriginal as string;
    // EXIF format: "2024:10:15 14:30:00"
    const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
