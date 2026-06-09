'use server'

export type WaitlistResult =
  | { success: true }
  | { success: false; error: 'already_registered' | 'invalid_email' | 'server_error' }

export async function submitWaitlist(
  _prev: WaitlistResult | null,
  formData: FormData
): Promise<WaitlistResult> {
  const email = formData.get('email')
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'invalid_email' }
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) throw new Error('API_URL env var is not set')

  let res: Response
  try {
    res = await fetch(`${apiUrl}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
  } catch {
    return { success: false, error: 'server_error' }
  }

  if (res.status === 201) return { success: true }
  if (res.status === 409) return { success: false, error: 'already_registered' }
  if (res.status === 400) return { success: false, error: 'invalid_email' }
  return { success: false, error: 'server_error' }
}
