import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

export function PolicyLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-ink mb-10">{title}</h1>
        <div className="space-y-8 text-sm text-ink-soft leading-relaxed">{children}</div>
      </main>
      <Footer />
    </>
  )
}
