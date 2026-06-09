# Web Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold and ship a pre-launch landing page for Daylog at getdaylog.com with an email waitlist form backed by the family-guy API.

**Architecture:** Next.js 14 App Router project at `web/` (sibling to `mobile/` and `backend/`). A server action (`submitWaitlist`) calls a new `POST /waitlist` endpoint on the Express backend, which stores emails in a new `waitlist` Postgres table. Blog is pre-wired as a placeholder at `/blog`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS v3, DM Sans (Google Fonts), Express + Drizzle ORM (backend), Vercel (deployment).

---

## File Map

**Backend (modify existing project):**
- Modify: `backend/src/db/schema.ts` — add `waitlist` table definition
- Create: `backend/src/routes/waitlist.ts` — `POST /waitlist` route handler
- Create: `backend/src/routes/waitlist.test.ts` — integration tests
- Modify: `backend/src/app.ts` — register `/waitlist` route

**Frontend (new project at `web/`):**
- Create: `web/app/layout.tsx` — root layout, DM Sans font, metadata, `lang="vi"`
- Create: `web/app/globals.css` — Tailwind base + design token CSS vars
- Create: `web/app/page.tsx` — landing page, composes all section components
- Create: `web/app/blog/page.tsx` — blog placeholder
- Create: `web/components/Nav.tsx` — sticky nav, logo + CTA
- Create: `web/components/Hero.tsx` — headline, tagline, WaitlistForm
- Create: `web/components/WaitlistForm.tsx` — email input, calls server action, shows state
- Create: `web/components/PhoneMockup.tsx` — phone frame with placeholder emoji grid
- Create: `web/components/Features.tsx` — 3-card feature grid
- Create: `web/components/Footer.tsx` — minimal footer
- Create: `web/lib/actions.ts` — `submitWaitlist()` server action
- Modify: `web/tailwind.config.ts` — extend with Daylog color tokens
- Create: `web/.env.example`

---

## Task 1: Backend — Add waitlist table to schema

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add the waitlist table to schema.ts**

Open `backend/src/db/schema.ts` and append at the end of the file:

```ts
export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate the migration**

```bash
cd backend && npm run migrate:generate
```

Expected: a new file appears in `backend/src/db/migrations/` containing `CREATE TABLE "waitlist" (...)`.

- [ ] **Step 3: Apply the migration**

```bash
cd backend && npm run migrate:push
```

Expected: `All migrations applied` (or similar success message).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/
git commit -m "feat(backend): add waitlist table"
```

---

## Task 2: Backend — POST /waitlist route (TDD)

**Files:**
- Create: `backend/src/routes/waitlist.test.ts`
- Create: `backend/src/routes/waitlist.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/waitlist.test.ts`:

```ts
import request from 'supertest';
const app = require('../app');
import { pool } from '../db';

describe('POST /waitlist', () => {
  afterEach(async () => {
    await pool.query("DELETE FROM waitlist WHERE email LIKE 'wl-test-%'");
  });

  it('returns 201 and { message: "ok" } for a valid email', async () => {
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-1@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('ok');
  });

  it('returns 409 for a duplicate email', async () => {
    await request(app).post('/waitlist').send({ email: 'wl-test-2@example.com' });
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-2@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_registered');
  });

  it('returns 400 for a missing email', async () => {
    const res = await request(app).post('/waitlist').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('returns 400 for an email without @', async () => {
    const res = await request(app).post('/waitlist').send({ email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('normalizes email to lowercase before storing', async () => {
    await request(app).post('/waitlist').send({ email: 'WL-TEST-3@EXAMPLE.COM' });
    const row = await pool.query(
      "SELECT email FROM waitlist WHERE email = 'wl-test-3@example.com'"
    );
    expect(row.rows[0]?.email).toBe('wl-test-3@example.com');
  });

  it('does not require an Authorization header', async () => {
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-4@example.com' });
    expect(res.status).not.toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd backend && npm test -- --testPathPattern=waitlist
```

Expected: all 6 tests FAIL (route not registered yet).

- [ ] **Step 3: Implement the route**

Create `backend/src/routes/waitlist.ts`:

```ts
import { Router } from 'express';
import { db } from '../db';
import { waitlist } from '../db/schema';
import { inviteLookupLimiter } from '../lib/rateLimit';

const router = Router();

router.post('/', inviteLookupLimiter, async (req, res) => {
  const { email } = req.body as { email?: unknown };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const normalized = email.trim().toLowerCase();

  try {
    await db.insert(waitlist).values({ email: normalized });
    return res.status(201).json({ message: 'ok' });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'already_registered' });
    }
    throw err;
  }
});

export default router;
```

- [ ] **Step 4: Run tests — they should still fail (route not registered)**

```bash
cd backend && npm test -- --testPathPattern=waitlist
```

Expected: still FAIL on the 201/400/409 tests — the route isn't mounted yet.

---

## Task 3: Backend — Register the waitlist route + verify

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Import and mount the waitlist route**

In `backend/src/app.ts`, add the import alongside the other route imports:

```ts
import waitlistRoutes from './routes/waitlist';
```

Then add the route registration after the existing `app.use('/version', versionRoutes)` line:

```ts
app.use('/waitlist', waitlistRoutes);
```

- [ ] **Step 2: Run waitlist tests — all should pass**

```bash
cd backend && npm test -- --testPathPattern=waitlist
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
cd backend && npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/waitlist.ts backend/src/routes/waitlist.test.ts backend/src/app.ts
git commit -m "feat(backend): add POST /waitlist endpoint"
```

---

## Task 4: Scaffold the Next.js web/ project

**Files:**
- Create: `web/` (entire directory via create-next-app)

- [ ] **Step 1: Scaffold the project**

From the repo root:

```bash
npx create-next-app@latest web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git \
  --yes
```

Expected: `web/` directory created with `app/`, `components/` (may be empty), `public/`, `tailwind.config.ts`, `next.config.ts`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Verify the project runs**

```bash
cd web && npm run dev
```

Expected: server starts at `http://localhost:3000` with the default Next.js welcome page.

Stop the server (`Ctrl-C`) before continuing.

- [ ] **Step 3: Remove the default boilerplate**

Delete the generated placeholder content so you have clean files to work with:

```bash
# Remove default page content and global CSS boilerplate
```

Replace `web/app/page.tsx` with a minimal placeholder:

```tsx
export default function HomePage() {
  return <main />
}
```

Replace `web/app/globals.css` with only the Tailwind directives (remove everything else):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create the .env.example**

Create `web/.env.example`:

```
# Family-guy API base URL (no trailing slash)
API_URL=https://api.getdaylog.com
```

Create `web/.env.local` for local development (not committed):

```
API_URL=http://localhost:3000
```

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Next.js project"
```

---

## Task 5: Configure Tailwind with Daylog design tokens

**Files:**
- Modify: `web/tailwind.config.ts`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Replace tailwind.config.ts with Daylog tokens**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FFFBF0',
        ink: '#3D2A1F',
        'ink-soft': '#7B5544',
        'ink-muted': '#B5A89C',
        'border-soft': '#F0E6D6',
        'accent-pink': '#FF7AA8',
        'accent-yellow': '#FFD66B',
        'accent-mint': '#7FD7B5',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Commit**

```bash
git add web/tailwind.config.ts web/app/globals.css
git commit -m "feat(web): configure Tailwind with Daylog design tokens"
```

---

## Task 6: Root layout with DM Sans font and SEO metadata

**Files:**
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Write layout.tsx**

```tsx
import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Daylog — Nhật ký video gia đình',
  description:
    'Lưu lại khoảnh khắc con lớn lên mỗi ngày. Ảnh và video chất lượng cao, riêng tư, chỉ dành cho gia đình bạn.',
  metadataBase: new URL('https://getdaylog.com'),
  openGraph: {
    title: 'Daylog — Nhật ký video gia đình',
    description:
      'Lưu lại khoảnh khắc con lớn lên mỗi ngày. Ảnh và video chất lượng cao, riêng tư, chỉ dành cho gia đình bạn.',
    url: 'https://getdaylog.com',
    siteName: 'Daylog',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'vi_VN',
    type: 'website',
  },
  alternates: { canonical: 'https://getdaylog.com' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={dmSans.variable}>
      <body className="font-sans bg-cream text-ink antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Add an OG image placeholder**

Place any 1200×630 PNG at `web/public/og-image.png`. For now, create an empty placeholder — replace with a real branded image before launch.

```bash
# Use any existing PNG from the project as a placeholder
cp mobile/assets/images/icon.png web/public/og-image.png 2>/dev/null || touch web/public/og-image.png
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/layout.tsx web/public/og-image.png
git commit -m "feat(web): root layout with DM Sans and SEO metadata"
```

---

## Task 7: Server action — submitWaitlist

**Files:**
- Create: `web/lib/actions.ts`

- [ ] **Step 1: Create lib/actions.ts**

```ts
'use server'

export type WaitlistResult =
  | { success: true }
  | { success: false; error: 'already_registered' | 'invalid_email' | 'server_error' }

export async function submitWaitlist(_prev: WaitlistResult | null, formData: FormData): Promise<WaitlistResult> {
  const email = formData.get('email')
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'invalid_email' }
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) throw new Error('API_URL env var is not set')

  let res: Response
  try {
    res = await fetch(`${apiUrl}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
  } catch {
    return { success: false, error: 'server_error' }
  }

  if (res.status === 201) return { success: true }
  if (res.status === 409) return { success: false, error: 'already_registered' }
  if (res.status === 400) return { success: false, error: 'invalid_email' }
  return { success: false, error: 'server_error' }
}
```

Note: the signature is `(_prev, formData)` — `useActionState` passes the previous state as the first argument.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/actions.ts
git commit -m "feat(web): add submitWaitlist server action"
```

---

## Task 8: WaitlistForm component

**Files:**
- Create: `web/components/WaitlistForm.tsx`

- [ ] **Step 1: Create WaitlistForm.tsx**

```tsx
'use client'

import { useActionState } from 'react'
import { submitWaitlist, WaitlistResult } from '@/lib/actions'

const ERROR_MESSAGES: Record<string, string> = {
  already_registered: 'Email này đã đăng ký rồi.',
  invalid_email: 'Email không hợp lệ.',
  server_error: 'Có lỗi xảy ra. Vui lòng thử lại.',
}

export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistResult | null, FormData>(
    submitWaitlist,
    null
  )

  if (state?.success) {
    return (
      <p className="text-sm text-ink-soft text-center">
        Cảm ơn! Chúng tôi sẽ thông báo khi Daylog ra mắt. 🎉
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col items-center gap-3 w-full max-w-sm">
      <div className="flex gap-2 w-full">
        <input
          name="email"
          type="email"
          required
          placeholder="email của bạn"
          className="flex-1 px-4 py-3 rounded-full border border-border-soft bg-white text-ink text-sm focus:outline-none focus:border-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-3 rounded-full bg-ink text-cream text-sm font-semibold whitespace-nowrap disabled:opacity-60 transition-opacity"
        >
          {pending ? '...' : 'Thông báo tôi'}
        </button>
      </div>
      {state && !state.success && (
        <p className="text-sm text-accent-pink">
          {ERROR_MESSAGES[state.error] ?? 'Có lỗi xảy ra.'}
        </p>
      )}
      <p className="text-xs text-ink-muted">Miễn phí · Không spam · Thông báo khi ra mắt</p>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/WaitlistForm.tsx
git commit -m "feat(web): add WaitlistForm component"
```

---

## Task 9: Nav, Hero, PhoneMockup components

**Files:**
- Create: `web/components/Nav.tsx`
- Create: `web/components/Hero.tsx`
- Create: `web/components/PhoneMockup.tsx`

- [ ] **Step 1: Create Nav.tsx**

```tsx
export function Nav() {
  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-cream border-b border-border-soft">
      <span className="text-lg font-bold tracking-tight text-ink">Daylog</span>
      <a
        href="#waitlist"
        className="px-5 py-2.5 rounded-full bg-ink text-cream text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Đăng ký sớm
      </a>
    </nav>
  )
}
```

- [ ] **Step 2: Create Hero.tsx**

```tsx
import { WaitlistForm } from './WaitlistForm'

export function Hero() {
  return (
    <section
      id="waitlist"
      className="flex flex-col items-center text-center px-6 pt-16 pb-12 gap-6 max-w-xl mx-auto"
    >
      <span className="inline-flex items-center gap-1.5 bg-[#FFF4E0] border border-accent-yellow rounded-full px-3.5 py-1.5 text-sm font-medium text-ink">
        ✨ Sắp ra mắt
      </span>
      <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-ink">
        Nhật ký video
        <br />
        cho <span className="text-accent-pink">gia đình</span> bạn
      </h1>
      <p className="text-base sm:text-lg text-ink-soft leading-relaxed max-w-md">
        Lưu lại khoảnh khắc con lớn lên mỗi ngày — bằng ảnh và video dọc chất lượng cao, chỉ dành
        cho gia đình bạn.
      </p>
      <WaitlistForm />
    </section>
  )
}
```

- [ ] **Step 3: Create PhoneMockup.tsx**

```tsx
export function PhoneMockup() {
  return (
    <section className="flex justify-center px-6 py-10 bg-gradient-to-b from-cream to-[#FFF4E0]">
      <div className="w-[200px] h-[420px] bg-ink rounded-[36px] p-3 shadow-2xl shadow-ink/20">
        <div className="w-full h-full bg-cream rounded-[26px] overflow-hidden flex flex-col">
          <div className="px-3 pt-3 pb-2 text-[11px] font-bold text-ink border-b border-border-soft">
            📅 Hôm nay · Tháng 6
          </div>
          <div className="flex-1 grid grid-cols-2 gap-1 p-1.5 overflow-hidden">
            <div className="row-span-2 bg-border-soft rounded-[10px] flex items-center justify-center text-2xl">
              🌅
            </div>
            <div className="bg-border-soft rounded-[10px] flex items-center justify-center text-xl">
              🍼
            </div>
            <div className="bg-border-soft rounded-[10px] flex items-center justify-center text-xl">
              😄
            </div>
            <div className="col-span-2 bg-border-soft rounded-[10px] flex items-center justify-center text-xl">
              🌸
            </div>
          </div>
          <div className="border-t border-border-soft px-3 py-2 flex justify-around">
            <span className="text-lg opacity-40">📷</span>
            <span className="text-lg">📚</span>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/Nav.tsx web/components/Hero.tsx web/components/PhoneMockup.tsx
git commit -m "feat(web): add Nav, Hero, PhoneMockup components"
```

---

## Task 10: Features and Footer components

**Files:**
- Create: `web/components/Features.tsx`
- Create: `web/components/Footer.tsx`

- [ ] **Step 1: Create Features.tsx**

```tsx
const FEATURES = [
  {
    icon: '📸',
    bg: 'bg-[#FFF4E0]',
    title: 'Ảnh & video chất lượng cao',
    description:
      'Lưu trữ khoảnh khắc ở chất lượng gốc — không nén, không mất màu, không lo mất dữ liệu.',
  },
  {
    icon: '🔒',
    bg: 'bg-[#F0FFF8]',
    title: 'Riêng tư hoàn toàn',
    description:
      'Chỉ gia đình bạn mới xem được. Không phải mạng xã hội, không quảng cáo, không lo lộ thông tin.',
  },
  {
    icon: '📖',
    bg: 'bg-[#FFF0F5]',
    title: 'Xem lại dạng story',
    description:
      'Mỗi ngày là một trang nhật ký. Lướt xem lại hành trình lớn lên của con theo từng ngày, từng tháng.',
  },
] as const

export function Features() {
  return (
    <section className="px-6 py-16 max-w-3xl mx-auto">
      <p className="text-center text-xs font-semibold tracking-widest uppercase text-ink-muted mb-10">
        Tại sao chọn Daylog
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-white border border-border-soft rounded-[20px] p-7 flex flex-col gap-3"
          >
            <div
              className={`w-11 h-11 ${f.bg} rounded-[14px] flex items-center justify-center text-2xl`}
            >
              {f.icon}
            </div>
            <h3 className="text-sm font-bold text-ink">{f.title}</h3>
            <p className="text-xs text-ink-soft leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Footer.tsx**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-border-soft px-6 py-7 flex justify-between items-center text-xs text-ink-muted">
      <span>© 2026 Daylog</span>
      <span>getdaylog.com</span>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/Features.tsx web/components/Footer.tsx
git commit -m "feat(web): add Features and Footer components"
```

---

## Task 11: Assemble the landing page and blog placeholder

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/app/blog/page.tsx`

- [ ] **Step 1: Write app/page.tsx**

```tsx
import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { PhoneMockup } from '@/components/PhoneMockup'
import { Features } from '@/components/Features'
import { Footer } from '@/components/Footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PhoneMockup />
        <Features />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Create app/blog/page.tsx**

```tsx
export default function BlogPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-center px-6 bg-cream">
      <h1 className="text-2xl font-bold text-ink">Blog</h1>
      <p className="text-ink-soft">Sắp ra mắt.</p>
      <a href="/" className="text-sm text-ink-soft underline">
        ← Về trang chủ
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Run the dev server and visually verify the full page**

```bash
cd web && npm run dev
```

Open `http://localhost:3000` in your browser and verify:
- Nav is sticky at the top with "Daylog" logo and "Đăng ký sớm" button
- Hero shows badge, headline with pink "gia đình", tagline, email form, helper text
- Phone mockup shows centered phone frame below the hero
- Features shows 3 cards with icons and Vietnamese copy
- Footer shows "© 2026 Daylog" and "getdaylog.com"
- Navigate to `http://localhost:3000/blog` — shows "Blog / Sắp ra mắt."
- Click "Đăng ký sớm" in nav — scrolls to the email form
- Try submitting the form with an invalid email — shows validation error from the browser (HTML5 `required` + `type="email"`)

Stop the server (`Ctrl-C`).

- [ ] **Step 4: Run a production build to confirm no errors**

```bash
cd web && npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript or build errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/app/blog/page.tsx
git commit -m "feat(web): assemble landing page and blog placeholder"
```

---

## Task 12: End-to-end waitlist form test

This task verifies the form works against the real backend.

- [ ] **Step 1: Start the backend**

In a separate terminal:

```bash
cd backend && npm run dev
```

Confirm it starts on port 3000.

- [ ] **Step 2: Start the web dev server with API_URL set**

```bash
cd web && API_URL=http://localhost:3000 npm run dev
```

- [ ] **Step 3: Test the happy path**

Open `http://localhost:3001` (Next.js uses 3001 if 3000 is taken). Enter a real email address and click "Thông báo tôi". Expected: the form replaces with "Cảm ơn! Chúng tôi sẽ thông báo khi Daylog ra mắt. 🎉"

- [ ] **Step 4: Test the duplicate path**

Submit the same email again (reload the page first). Expected: error message "Email này đã đăng ký rồi."

- [ ] **Step 5: Verify the email was stored**

```bash
cd backend && psql $DATABASE_URL -c "SELECT email, created_at FROM waitlist ORDER BY created_at DESC LIMIT 5;"
```

Expected: your test email appears in the results.

- [ ] **Step 6: Commit (if any adjustments were made)**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(web): adjust waitlist form based on e2e testing"
```

---

## Task 13: Vercel deployment configuration

This project lives at `web/` inside a monorepo. Vercel needs to know the root directory.

**Files:**
- Create: `web/vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "framework": "nextjs"
}
```

This minimal config is enough — Vercel auto-detects Next.js. The key step is setting the root directory in the Vercel dashboard.

- [ ] **Step 2: Configure the Vercel project (one-time, in the dashboard)**

When creating the Vercel project from this repo:
1. Go to [vercel.com/new](https://vercel.com/new) and import the repo
2. Under **Root Directory**, set it to `web`
3. Under **Environment Variables**, add `API_URL` = your backend URL (e.g. `https://api.getdaylog.com`)
4. Deploy

- [ ] **Step 3: Add the domain**

In the Vercel project settings → Domains, add `getdaylog.com` and follow the DNS instructions.

- [ ] **Step 4: Commit**

```bash
git add web/vercel.json
git commit -m "chore(web): add Vercel config"
```

---

## Task 14: Add .gitignore entries for web/

**Files:**
- Modify: root `.gitignore` (or create `web/.gitignore`)

- [ ] **Step 1: Ensure web build artifacts and secrets are gitignored**

Check if the root `.gitignore` already covers `web/.next` and `web/.env.local`. If not, add to the root `.gitignore`:

```
# Next.js
web/.next/
web/out/
web/.env.local
```

Also add `.superpowers/` if not already present (brainstorm server files):

```
# Superpowers brainstorm files
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore web build artifacts and superpowers dir"
```
