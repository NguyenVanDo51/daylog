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
