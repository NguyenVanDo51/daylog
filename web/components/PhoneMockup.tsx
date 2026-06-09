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
