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
