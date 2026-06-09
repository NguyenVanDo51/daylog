# Daylog Web — Landing Page Design

**Date:** 2026-06-09  
**Status:** Approved  
**Domain:** getdaylog.com

## Overview

A simple, optimized pre-launch landing page for the Daylog app. Primary goal: collect email waitlist signups before the iOS/Android release. Built as a Next.js project (`web/`) at the repo root, structured to support a blog section added later.

## Goals

- Collect email addresses for the waitlist via a form that POSTs to the family-guy API
- Communicate Daylog's core value proposition to Vietnamese-speaking parents of young children
- Load fast, look good on mobile and desktop
- Be easy to maintain: swap placeholder visuals for real screenshots, add blog posts as MDX files

## Non-Goals

- Language toggle (Vietnamese-only for now)
- App Store / Play Store download links (pre-launch)
- Blog content (structure is wired up; content comes later)
- Analytics / tracking (out of scope for initial launch)

## Layout — Sections

The page uses layout B (Hero + App Preview + Features):

1. **Nav** — sticky, `Daylog` logo left + `Đăng ký sớm` CTA button right
2. **Hero** — badge "✨ Sắp ra mắt", headline, tagline, email waitlist form, helper text
3. **App Preview** — centered phone frame with placeholder content (swap for real screenshots later)
4. **Features** — 3 cards: Ảnh & video chất lượng cao / Riêng tư hoàn toàn / Xem lại dạng story
5. **Footer** — minimal: `© 2026 Daylog` + `getdaylog.com`

## Vietnamese Copy

| Element | Copy |
|---|---|
| Badge | ✨ Sắp ra mắt |
| Headline | Nhật ký video cho gia đình bạn |
| Tagline | Lưu lại khoảnh khắc con lớn lên mỗi ngày — bằng ảnh và video dọc chất lượng cao, chỉ dành cho gia đình bạn. |
| Email placeholder | email của bạn |
| Submit button | Thông báo tôi |
| Helper text | Miễn phí · Không spam · Thông báo khi ra mắt |
| Nav CTA | Đăng ký sớm |
| Features label | Tại sao chọn Daylog |
| Feature 1 | Ảnh & video chất lượng cao — Lưu trữ khoảnh khắc ở chất lượng gốc — không nén, không mất màu, không lo mất dữ liệu. |
| Feature 2 | Riêng tư hoàn toàn — Chỉ gia đình bạn mới xem được. Không phải mạng xã hội, không quảng cáo, không lo lộ thông tin. |
| Feature 3 | Xem lại dạng story — Mỗi ngày là một trang nhật ký. Lướt xem lại hành trình lớn lên của con theo từng ngày, từng tháng. |

## Visual Design

Inherits the Daylog mobile design system:

| Token | Value |
|---|---|
| Background | `#FFFBF0` (cream) |
| Text primary | `#3D2A1F` (ink) |
| Text secondary | `#7B5544` (inkSoft) |
| Text muted | `#B5A89C` (inkMuted) |
| Border soft | `#F0E6D6` |
| Accent pink | `#FF7AA8` |
| Accent yellow | `#FFD66B` |
| Accent mint | `#7FD7B5` |

Font: **DM Sans** (Google Fonts) — supports full Vietnamese diacritics.  
Border radius: pill buttons (`9999px`), feature cards (`20px`), phone frame (`36px`).

## Project Structure

```
web/                          # sibling to mobile/ and backend/
├── app/
│   ├── layout.tsx            # root layout: DM Sans font, meta tags, og image
│   ├── page.tsx              # landing page (composes section components)
│   ├── globals.css           # Tailwind base + CSS variables for design tokens
│   └── blog/
│       └── page.tsx          # placeholder blog index (shows "Sắp ra mắt" message)
├── components/
│   ├── Nav.tsx               # sticky nav with logo + CTA
│   ├── Hero.tsx              # headline, tagline, WaitlistForm
│   ├── PhoneMockup.tsx       # phone frame with placeholder content
│   ├── Features.tsx          # 3-card feature grid
│   ├── Footer.tsx            # minimal footer
│   └── WaitlistForm.tsx      # email input + submit, calls submitWaitlist() action
├── lib/
│   └── actions.ts            # submitWaitlist() server action → POST /waitlist
├── public/
│   └── og-image.png          # Open Graph image (placeholder initially)
├── next.config.ts
├── tailwind.config.ts        # extends with Daylog color tokens
├── tsconfig.json
└── package.json
```

## Waitlist Flow

1. User enters email in `WaitlistForm`, clicks "Thông báo tôi"
2. `submitWaitlist(formData)` server action is called (no client-side fetch)
3. Server action POSTs `{ email }` to the family-guy API at `POST /waitlist`
4. On success: inline confirmation message replaces the form ("Cảm ơn! Chúng tôi sẽ thông báo khi Daylog ra mắt.")
5. On error (duplicate email, invalid): inline error message, form stays editable

### Backend endpoint required

A new endpoint must be added to the family-guy API:

```
POST /waitlist
Body: { email: string }
Response 201: { message: "ok" }
Response 409: { error: "already_registered" }
```

Stores `{ email, created_at }` in a `waitlist` table. No auth required (public endpoint). Rate-limited to prevent abuse (5 req/IP/minute).

## Blog Structure (future)

The `app/blog/` directory is pre-created with a placeholder. When ready to add blog content:

1. Install `@next/mdx` and `gray-matter`
2. Add `.mdx` files under `app/blog/[slug]/page.mdx`
3. Update `app/blog/page.tsx` to list posts from the filesystem
4. Update `next.config.ts` to enable MDX at that point

## SEO & Meta

- `<title>` — "Daylog — Nhật ký video gia đình"
- `<meta description>` — "Lưu lại khoảnh khắc con lớn lên mỗi ngày. Ảnh và video chất lượng cao, riêng tư, chỉ dành cho gia đình bạn."
- Open Graph image: `public/og-image.png` (placeholder; replace before launch)
- `lang="vi"` on `<html>`
- Canonical URL: `https://getdaylog.com`

## Deployment

- **Platform:** Vercel (free tier)
- **Domain:** getdaylog.com (DNS pointed to Vercel)
- **Build:** `next build` — no `output: 'export'`, server actions require Node.js runtime
- **Env var:** `API_URL` — family-guy API base URL (e.g. `https://api.getdaylog.com`). Private server-only var; not exposed to the browser bundle.
