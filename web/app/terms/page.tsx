import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/PolicyLayout'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — Daylog',
  description: 'Điều khoản sử dụng ứng dụng Daylog.',
  alternates: { canonical: 'https://getdaylog.com/terms' },
}

export default function TermsPage() {
  return (
    <PolicyLayout title="Điều khoản sử dụng">
      <p className="text-xs text-ink-muted">Cập nhật lần cuối: 10 tháng 6, 2026</p>

      <section>
        <h2 className="font-bold text-ink mb-2">1. Chấp nhận điều khoản</h2>
        <p>
          Bằng việc tạo tài khoản hoặc sử dụng ứng dụng Daylog, bạn đồng ý tuân theo các điều khoản
          này. Nếu bạn không đồng ý, vui lòng không sử dụng ứng dụng.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">2. Mô tả dịch vụ</h2>
        <p>
          Daylog là ứng dụng nhật ký ảnh và video gia đình cho phép bạn lưu giữ, tổ chức và chia sẻ
          khoảnh khắc trong nhóm gia đình riêng tư.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">3. Tài khoản người dùng</h2>
        <p>
          Bạn chịu trách nhiệm bảo mật tài khoản của mình. Thông báo cho chúng tôi ngay nếu phát
          hiện truy cập trái phép vào tài khoản.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">4. Nội dung của bạn</h2>
        <p>
          Bạn giữ toàn quyền sở hữu đối với ảnh, video và ghi chú bạn tải lên. Bằng việc sử dụng
          dịch vụ, bạn cấp cho Daylog quyền lưu trữ và phân phối nội dung đó trong phạm vi nhóm gia
          đình của bạn để cung cấp dịch vụ.
        </p>
        <p className="mt-2">
          Daylog không tuyên bố quyền sở hữu và không sử dụng nội dung của bạn ngoài mục đích cung
          cấp dịch vụ.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">5. Hành vi bị cấm</h2>
        <p>Bạn cam kết không:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Tải lên nội dung vi phạm pháp luật hoặc quyền của người khác.</li>
          <li>Chia sẻ thông tin đăng nhập với người không được mời vào nhóm.</li>
          <li>Cố gắng truy cập trái phép vào dữ liệu người dùng khác.</li>
          <li>Sử dụng ứng dụng theo cách gây hại cho hạ tầng dịch vụ.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">6. Chấm dứt tài khoản</h2>
        <p>
          Bạn có thể xóa tài khoản bất kỳ lúc nào. Chúng tôi có quyền tạm ngừng hoặc xóa tài khoản
          vi phạm các điều khoản này. Khi tài khoản bị xóa, dữ liệu của bạn sẽ bị xóa khỏi máy chủ
          trong vòng 30 ngày.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">7. Giới hạn trách nhiệm</h2>
        <p>
          Daylog cung cấp dịch vụ "như hiện tại". Chúng tôi không chịu trách nhiệm về mất mát dữ liệu
          do sự cố kỹ thuật ngoài tầm kiểm soát. Chúng tôi khuyến khích bạn giữ bản sao dữ liệu quan
          trọng.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">8. Thay đổi điều khoản</h2>
        <p>
          Chúng tôi có thể cập nhật các điều khoản này. Bạn sẽ được thông báo qua ứng dụng khi có
          thay đổi quan trọng. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận điều
          khoản mới.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">9. Liên hệ</h2>
        <p>
          Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ:{' '}
          <a href="mailto:hello@getdaylog.com" className="text-accent-pink underline">
            hello@getdaylog.com
          </a>
        </p>
      </section>
    </PolicyLayout>
  )
}
