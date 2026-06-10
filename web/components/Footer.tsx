export function Footer() {
  return (
    <footer className="border-t border-border-soft px-6 py-7 flex flex-wrap justify-between items-center gap-3 text-xs text-ink-muted">
      <span>© 2026 Daylog</span>
      <div className="flex gap-4">
        <a href="/privacy" className="hover:text-ink transition-colors">Chính sách bảo mật</a>
        <a href="/terms" className="hover:text-ink transition-colors">Điều khoản sử dụng</a>
      </div>
    </footer>
  )
}
