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
