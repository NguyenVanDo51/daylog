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
