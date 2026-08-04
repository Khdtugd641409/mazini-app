import { useState } from 'react'
import {
  sendCustomerLoginCode,
  verifyCustomerLoginCode,
} from '../services/customerAccountAuthService'

export default function CustomerAccountLoginPage() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSendCode(event) {
    event.preventDefault()

    if (loading) return

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await sendCustomerLoginCode(email)

      setEmail(result.email)
      setStep('otp')
      setSuccessMessage('تم إرسال رمز الدخول إلى بريدك الإلكتروني.')
    } catch (error) {
      setErrorMessage(
        error?.message || 'تعذر إرسال رمز الدخول.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()

    if (loading) return

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await verifyCustomerLoginCode(email, otp)

      setSuccessMessage('تم تسجيل الدخول بنجاح.')

      window.location.href = '/customer/projects'
    } catch (error) {
      setErrorMessage(
        error?.message || 'تعذر التحقق من رمز الدخول.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleChangeEmail() {
    if (loading) return

    setStep('email')
    setOtp('')
    setErrorMessage('')
    setSuccessMessage('')
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: '32px 16px',
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: '8px',
            fontSize: '26px',
          }}
        >
          دخول العميل
        </h1>

        <p
          style={{
            marginTop: 0,
            marginBottom: '24px',
            color: '#555',
            lineHeight: '1.8',
          }}
        >
          ادخل إلى حسابك لمتابعة جميع مشاريعك.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              color: '#9f1239',
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              color: '#166534',
            }}
          >
            {successMessage}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode}>
            <label
              htmlFor="customer-email"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '700',
              }}
            >
              البريد الإلكتروني
            </label>

            <input
              id="customer-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              placeholder="name@example.com"
              required
              style={{
                width: '100%',
                height: '48px',
                padding: '0 12px',
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '16px',
                textAlign: 'left',
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                minHeight: '48px',
                marginTop: '18px',
                border: 0,
                borderRadius: '10px',
                background: loading ? '#9ca3af' : '#111827',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز الدخول'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <p
              style={{
                marginTop: 0,
                marginBottom: '18px',
                lineHeight: '1.8',
              }}
            >
              أرسلنا رمزًا مكونًا من 8 أرقام إلى:
              <br />
              <strong dir="ltr">{email}</strong>
            </p>

            <label
              htmlFor="customer-otp"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '700',
              }}
            >
              رمز الدخول
            </label>

            <input
              id="customer-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              value={otp}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/[^\d٠-٩۰-۹]/g, '')
                  .slice(0, 8)

                setOtp(value)
              }}
              disabled={loading}
              placeholder="00000000"
              required
              maxLength={8}
              style={{
                width: '100%',
                height: '54px',
                padding: '0 12px',
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '24px',
                letterSpacing: '6px',
                textAlign: 'center',
              }}
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 8}
              style={{
                width: '100%',
                minHeight: '48px',
                marginTop: '18px',
                border: 0,
                borderRadius: '10px',
                background:
                  loading || otp.length !== 8
                    ? '#9ca3af'
                    : '#111827',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                cursor:
                  loading || otp.length !== 8
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>

            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={loading}
              style={{
                width: '100%',
                minHeight: '44px',
                marginTop: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                background: '#ffffff',
                color: '#111827',
                fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              تغيير البريد الإلكتروني
            </button>
          </form>
        )}

        <hr
          style={{
            margin: '24px 0',
            border: 0,
            borderTop: '1px solid #e5e7eb',
          }}
        />

        <a
          href="/customer/access"
          style={{
            display: 'block',
            textAlign: 'center',
            color: '#374151',
            textDecoration: 'underline',
          }}
        >
          الدخول القديم برقم الملف والجوال
        </a>
      </section>
    </main>
  )
}
