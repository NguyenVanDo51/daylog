# Share Video — Design Spec

**Date:** 2026-06-08  
**Updated:** 2026-06-09 (reflect actual implementation — server-side export, not on-device FFmpeg)  
**Status:** Implemented

## Summary

Story viewer download button that exports the day's story as a compiled MP4. Compilation runs **server-side** via `GET /stories/export`. No FFmpeg on device.

## Scope

- **In scope:** Download button in story viewer, server-side MP4 download, camera roll save
- **Out of scope:** System share sheet, individual photo/video download, on-device FFmpeg

## Backend: `GET /stories/export`

Accepts `?photo_ids=id1,id2,id3` (comma-separated, ordered). Returns a compiled MP4 stream.

Auth required. The mobile client passes `Authorization: Bearer <token>` header.

## Mobile: `useStoryExport` Hook

**Location:** `mobile/src/hooks/useStoryExport.ts`

**Signature:**
```ts
function useStoryExport(photos: DayPhoto[], date: string): {
  exporting: boolean;
  exportStory: () => Promise<void>;
}
```

**Flow:**
1. Set `exporting = true`
2. Early return if `photos.length === 0`
3. Build output path: `${FileSystem.cacheDirectory}story_${date}.mp4`
4. Request `MediaLibrary` permission; if denied, show alert pointing to Settings
5. Build URL: `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photos.map(p=>p.id).join(','))}`
6. `FileSystem.downloadAsync(url, outputPath, { headers: { Authorization: Bearer token } })`
7. If `result.status !== 200` → throw
8. `MediaLibrary.saveToLibraryAsync(outputPath)`
9. Delete temp file (idempotent)
10. Set `exporting = false`

**Error handling:** Any failure → `Alert('Lỗi', 'Không thể xuất video. Thử lại nhé.')`, temp file cleaned up in `finally`.

**Known issue:** `success()` haptic is called but `success` is not imported — this is a bug to fix.

## Story Viewer UI

**File:** `mobile/app/story/[albumId]/[date].tsx`

Download button in `topActions` row:
```tsx
{photos.length > 0 && (
  exporting
    ? <ActivityIndicator color={colors.white} size="small" style={{ width: 32 }} />
    : <TouchableOpacity onPress={exportStory} testID="story-export">
        <Ionicons name="arrow-down-circle-outline" size={26} color={colors.white} />
      </TouchableOpacity>
)}
```

## Dependencies

- `expo-file-system` (legacy import) — download and temp file management  
- `expo-media-library` — save to camera roll  
- No FFmpeg dependency
