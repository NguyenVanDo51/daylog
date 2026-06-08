# Share Video — Design Spec

Date: 2026-06-08

## Summary

Add a download button to the story viewer that exports the entire day's story (all photos + videos) as a single compiled MP4 saved to the device camera roll. Compilation runs on-device using `ffmpeg-kit-react-native`.

---

## Scope

- **In scope:** Story viewer download button, on-device ffmpeg compilation, camera roll save, backend media-serving endpoints (prerequisite)
- **Out of scope:** System share sheet, individual photo/video download, photo detail screen, pre-generated exports, audio mixing

---

## Backend: Media-Serving Endpoints

The mobile app already references `GET /photos/:id/full` and `GET /photos/:id/thumb` throughout but these routes are not yet implemented. This feature requires them.

### `GET /photos/:id/full`

- Auth required (`requireAuth` middleware)
- Membership check: query `album_photos` join to find any album containing this photo, then verify the requesting user has an `albumMembers` row for that album (a photo can belong to multiple albums)
- Streams the R2 object at `photo.r2Key` back to the client with the appropriate `Content-Type` (`video/mp4` or `image/webp`/`image/jpeg`)
- Returns `404` if photo not found, `403` if not a member

### `GET /photos/:id/thumb`

- Same auth + membership check
- Streams the R2 object at `photo.thumbnailKey`
- Returns `404` if photo or thumbnail not found, `403` if not a member

### Implementation note

Both endpoints use `getObjectBuffer` from `services/r2.ts` (already exists) and pipe the buffer via `res.send()`. No new R2 utility needed.

---

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

1. Set `exporting = true`, disable the button
2. Request `MediaLibrary` permission; if denied, show an `Alert` pointing to Settings and return
3. Create temp dir `${FileSystem.cacheDirectory}export_${date}/`
4. Download each photo/video to the temp dir in serial (not parallel — avoids memory spikes on large stories):
   - URL: `${API_URL}/photos/${photo.id}/full`
   - Filename: `${index.toString().padStart(3, '0')}_${photo.id}.{mp4|jpg}`
   - Use `FileSystem.downloadAsync`
5. Write a concat list file `concat_${date}.txt`:
   ```
   file '/path/to/000_id.jpg'
   duration 3
   file '/path/to/001_id.mp4'
   ```
   Photos get `duration 3` (matching `PHOTO_DURATION_MS = 3000`). Videos get no duration entry (ffmpeg reads their native duration). The concat demuxer requires the last entry to also have a `duration` line to avoid a hanging final frame — duplicate the last entry's path with a 0.001s duration as a terminator if the final item is a video.
6. Run ffmpeg via `FFmpegKit.executeAsync`:
   ```
   -f concat -safe 0 -i /tmp/concat.txt
   -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
   -c:v libx264 -preset fast -crf 23 -an
   /tmp/story_DATE.mp4
   ```
   `-an` drops audio (app plays videos muted; keeps output size small).
7. Check `ReturnCode.isSuccess(session.getReturnCode())` — if failure, show error alert and clean up
8. `MediaLibrary.saveToLibraryAsync(outputPath)`
9. Delete temp dir and output file
10. Fire `success()` haptic
11. Set `exporting = false`

**Error handling:**
- Camera roll permission denied → `Alert` with message "Cần quyền truy cập Ảnh. Vui lòng bật trong Cài đặt." and no-op
- Download failure → generic alert "Không thể xuất video. Thử lại nhé."
- FFmpeg failure → same generic alert
- All errors clean up temp files before returning

---

## Mobile: Story Viewer UI

**File:** `mobile/app/story/[albumId]/[date].tsx`

### Download button placement

Replace the existing left placeholder `<View style={{ width: 32 }} />` inside `topActions` with a conditional download button:

```tsx
{photos.length > 0 && (
  exporting
    ? <ActivityIndicator color={colors.white} size="small" style={{ width: 32 }} />
    : <TouchableOpacity onPress={exportStory} testID="story-export" disabled={exporting}>
        <Ionicons name="arrow-down-circle-outline" size={26} color={colors.white} />
      </TouchableOpacity>
)}
```

The button is always visible (for any day with photos), since even a photo-only day compiles to a valid video.

### State

`useStoryExport(photos, date)` is called at the top of `StoryScreen`. The `exporting` boolean drives the button state.

---

## Dependencies

### New package

`ffmpeg-kit-react-native` — add to `mobile/package.json`. Use the `min` variant (H.264 only, smallest binary). Requires EAS Build dev client (already configured in `eas.json`).

### Existing packages used

- `expo-file-system` (already installed) — download and temp file management
- `expo-media-library` (already installed) — save to camera roll

---

## Testing

- Unit tests for `useStoryExport` are impractical (ffmpeg-kit is a native module); manual testing covers the happy path
- Backend GET endpoints get unit tests in `photos.test.ts` covering: 200 streams correct content, 403 for non-member, 404 for unknown photo
- Existing story viewer tests (`story-vlog-overlay.test.tsx`) should continue to pass unmodified — the new button renders with `testID="story-export"` for any future test additions
