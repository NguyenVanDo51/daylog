import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/PolicyLayout'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — Daylog',
  description: 'Chính sách bảo mật của ứng dụng Daylog.',
  alternates: { canonical: 'https://getdaylog.com/privacy' },
}

export default function PrivacyPage() {
  return (
    <PolicyLayout title="Chính sách bảo mật">
      <p className="text-xs text-ink-muted">Cập nhật lần cuối: 10 tháng 6, 2026</p>

      <section>
        <h2 className="font-bold text-ink mb-2">1. Giới thiệu</h2>
        <p>
          Daylog ("chúng tôi") xây dựng ứng dụng nhật ký ảnh gia đình dành riêng cho bạn. Chính sách
          này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn khi sử dụng
          ứng dụng Daylog.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">2. Thông tin chúng tôi thu thập</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Tài khoản:</strong> tên hiển thị và địa chỉ email từ Apple ID hoặc tài khoản
            Google khi bạn đăng nhập.
          </li>
          <li>
            <strong>Ảnh và video:</strong> các tệp bạn chủ động tải lên ứng dụng.
          </li>
          <li>
            <strong>Dữ liệu sử dụng:</strong> nhật ký lỗi ẩn danh (qua Sentry) để cải thiện ứng dụng.
          </li>
          <li>
            <strong>Mã thông báo đẩy:</strong> nếu bạn bật thông báo, thiết bị của bạn sẽ gửi token
            để nhận thông báo.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">3. Mục đích sử dụng</h2>
        <p>Chúng tôi sử dụng thông tin của bạn để:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Cung cấp và duy trì dịch vụ nhật ký ảnh gia đình.</li>
          <li>Cho phép bạn chia sẻ ảnh với các thành viên trong nhóm gia đình.</li>
          <li>Gửi thông báo đẩy khi có ảnh mới (nếu bạn cho phép).</li>
          <li>Phát hiện và sửa lỗi ứng dụng.</li>
        </ul>
        <p className="mt-2">
          Chúng tôi <strong>không</strong> bán, cho thuê hay chia sẻ thông tin của bạn với bên thứ ba
          vì mục đích quảng cáo.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">4. Bên thứ ba</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Cloudflare R2:</strong> lưu trữ ảnh và video của bạn trên hạ tầng đám mây an toàn.
          </li>
          <li>
            <strong>Sentry:</strong> nhận nhật ký lỗi ẩn danh để chúng tôi có thể khắc phục sự cố.
          </li>
          <li>
            <strong>Apple / Google:</strong> xác thực danh tính khi bạn đăng nhập.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">5. Bảo mật dữ liệu</h2>
        <p>
          Dữ liệu truyền tải được mã hóa bằng HTTPS. Quyền truy cập vào ảnh và video được kiểm soát
          bởi token xác thực — chỉ bạn và các thành viên gia đình bạn mời mới có thể xem.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">6. Quyền của bạn</h2>
        <p>Bạn có quyền:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Xóa tài khoản và toàn bộ dữ liệu bất kỳ lúc nào.</li>
          <li>Tắt thông báo đẩy trong phần Cài đặt của ứng dụng.</li>
          <li>Liên hệ chúng tôi để yêu cầu xuất hoặc xóa dữ liệu.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">7. Trẻ em</h2>
        <p>
          Ứng dụng không dành cho trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập thông tin cá
          nhân từ trẻ em. Nội dung ảnh về trẻ em được tải lên bởi phụ huynh/người giám hộ và được lưu
          trữ riêng tư trong nhóm gia đình.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">8. Liên hệ</h2>
        <p>
          Mọi câu hỏi về chính sách bảo mật, vui lòng liên hệ:{' '}
          <a href="mailto:hello@getdaylog.com" className="text-accent-pink underline">
            hello@getdaylog.com
          </a>
        </p>
      </section>
    </PolicyLayout>
  )
}
