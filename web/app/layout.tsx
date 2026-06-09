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
