# Login Screen Redesign — Design Spec

**Date:** 2026-06-04
**Status:** Approved

---

## Overview

Redesign màn hình login hiện tại để tích hợp thông điệp cảm xúc ngay khi người dùng mở app lần đầu. Mục tiêu: người dùng chưa biết app là gì đã hiểu ngay giá trị và muốn đăng ký.

**Pain point hiện tại:** Màn hình login hiện tại chỉ có logo + tagline + 2 nút — chưa đủ để tạo emotional hook với phụ huynh Việt Nam.

---

## Layout: Warm Split (Option B)

Màn hình chia 2 phần trên cùng 1 screen — không có carousel, không có swipe onboarding riêng:

```
┌─────────────────────────┐
│                         │
│   [warm gradient top]   │  ~55% màn hình
│   👶                    │
│   "Mỗi ngày bé lớn      │
│    thêm một chút"       │
│   sub-copy              │
│                         │
├─────────────────────────┤
│   [cream background]    │  ~45% màn hình
│                         │
│   [Apple Sign In btn]   │
│   [Google Sign In btn]  │
│                         │
│   privacy note          │
└─────────────────────────┘
```

---

## Copy

| Element | Nội dung |
|---|---|
| Headline | Mỗi ngày bé lớn thêm một chút |
| Sub-copy | Đừng để những khoảnh khắc đó chỉ nằm trong ký ức |
| Privacy | Bằng cách đăng nhập, bạn đồng ý với Điều khoản & Chính sách bảo mật |

---

## Visual

**Top section:**
- Background: gradient `#FF9A9E → #FECFEF → #FFE8C8` (hồng sang peach ấm)
- Icon: 👶 emoji, 72px (giữ nguyên từ màn hình hiện tại)
- Headline: Fredoka_700Bold, 22–24px, color `ink (#3D2A1F)`
- Sub-copy: Fredoka_500Medium, 13px, color `inkMuted`
- Floating dots: giữ nguyên animation hiện tại (yellow, pink, mint, peach, sky) — một phần nằm ở top section

**Bottom section:**
- Background: `cream (#FFFBF0)` — giữ nguyên
- Padding: `spacing['3xl']` ngang, như hiện tại

---

## Buttons — Không thay đổi

Giữ nguyên 100% implementation hiện tại:

- **Apple:** `AppleAuthentication.AppleAuthenticationButton` — `BLACK` style, `cornerRadius: 22`, height 52
- **Google:** `Button` component — `ghost` variant, `fullWidth`, label `t('signin.google')`

Logic auth (`handleApple`, `handleGoogle`, `finishAuth`) không đổi.

---

## Thay đổi code

Chỉ thay đổi phần `render` trong `app/(auth)/index.tsx`:

1. Bọc content trong `ScrollView` hoặc dùng absolute positioning để split layout
2. Thêm top section với gradient background (`LinearGradient` từ `expo-linear-gradient`)
3. Headline + sub-copy mới thay cho `appName` + `tagline` hiện tại
4. Bottom section giữ nguyên `View style={styles.buttons}` và privacy text

**Không đổi:** auth logic, button components, store calls, routing.

---

## Mockup Reference

File: `.superpowers/brainstorm/53904-1780539328/content/login-b-refined.html` (option A)
Mở server: `skills/brainstorming/scripts/start-server.sh --project-dir .`

---

## Out of Scope

- Carousel / swipe onboarding screens (không build)
- A/B testing copy (chọn 1 message duy nhất)
- Dark mode variant
