# Preview Screen: Note Input

**Date:** 2026-06-08
**Status:** Approved

## Overview

Cho phép user nhập ghi chú (caption) ngay trên màn hình preview sau khi chụp ảnh/video. Caption được lưu cùng ảnh khi nhấn Lưu.

## UI

`TextInput` multiline, luôn visible, nằm trong `ScrollView` giữa preview và phần chọn album:

```
[ảnh/video preview]

┌─────────────────────────────┐
│ Thêm ghi chú...             │  ← TextInput, multiline, maxLength=200
│                             │
└─────────────────────────────┘

Thêm vào album:
☐ Gia đình
☐ Bạn bè

[Lưu lại]
```

### Style

- Border nhẹ (`colors.borderSoft`), border radius 10
- Background `colors.white`
- Font `typography.body`, color `colors.ink`
- Placeholder color `colors.inkMuted`
- Padding `spacing.md` horizontal, `spacing.sm` vertical
- `minHeight` 64 để có room cho 2-3 dòng

### Keyboard handling

Bọc toàn bộ screen trong `KeyboardAvoidingView` (`behavior="padding"` trên iOS, `behavior="height"` trên Android) để footer Save không bị keyboard che. `ScrollView` tự scroll để lộ TextInput khi focus.

## Data Flow

```
caption (useState<string>(''))
  ↓
handleSave()
  ↓
finishCapture(result, asset, albumIds, caption.trim() || null)
  ↓
api.post('/photos', { ..., caption: "Ghi chú..." | null })
```

Caption là optional — nếu user không nhập, truyền `null` (không lưu empty string).

## Code Changes

### `mobile/app/photo-review.tsx`

1. Import thêm: `TextInput, KeyboardAvoidingView, Platform`
2. State: `const [caption, setCaption] = useState('');`
3. Bọc container trong `KeyboardAvoidingView`:
   ```tsx
   <KeyboardAvoidingView
     style={{ flex: 1 }}
     behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
   >
     <View style={[styles.container, { paddingTop: insets.top }]}>
       ...
     </View>
   </KeyboardAvoidingView>
   ```
4. Thêm `TextInput` trong ScrollView sau preview:
   ```tsx
   <TextInput
     style={styles.noteInput}
     placeholder="Thêm ghi chú..."
     placeholderTextColor={colors.inkMuted}
     value={caption}
     onChangeText={setCaption}
     multiline
     maxLength={200}
     testID="review-note-input"
   />
   ```
5. Truyền caption vào `handleSave`:
   ```ts
   await finishCapture(result, asset, albumIds, caption.trim() || null);
   ```

### `mobile/src/hooks/useCapture.ts`

Cập nhật signature `finishCapture`:
```ts
async function finishCapture(
  result: UploadResult,
  asset: ReviewAsset,
  albumIds: string[],
  caption?: string | null,
): Promise<void> {
  await api.post('/photos', {
    ...
    ...(caption ? { caption } : {}),
  });
}
```

### `mobile/app/__tests__/photo-review.test.tsx`

- Cập nhật mock `finishCapture` để nhận tham số thứ 4
- Thêm test: nhập note → Save → `finishCapture` được gọi với caption đúng
- Thêm test: không nhập note → Save → `finishCapture` được gọi với `null`

## Files Changed

| File | Change |
|---|---|
| `mobile/app/photo-review.tsx` | TextInput + KeyboardAvoidingView + caption state |
| `mobile/src/hooks/useCapture.ts` | caption param trong finishCapture |
| `mobile/app/__tests__/photo-review.test.tsx` | Test caption flow |

## Out of Scope

- Chỉnh sửa caption sau khi đã lưu (từ story/album view)
- Character counter UI
- Mention / hashtag trong caption
