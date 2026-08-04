import { useEffect, useState } from 'react'
import {
  claimExistingCustomerProject,
  getCustomerSession,
  getMyCustomerProjects,
  signOutCustomerAccount,
} from '../services/customerAccountAuthService'

function getStatusLabel(status) {
  const labels = {
    submitted: 'متقدم',
    under_review: 'تحت المراجعة',
    pending: 'تحت المراجعة',
    accepted: 'مقبول',
    needs_completion: 'مطلوب استكمال',
    rejected: 'مرفوض',
    active: 'نشط',
    completed: 'مكتمل',
  }

  return labels[status] || status || 'غير محدد'
}

function getStageLabel(stage) {
  const labels = {
    initial_application: 'التقديم الأولي',
    waiting_admin_review:
      'انتظار مراجعة المنصة',
    waiting_land_submission:
      'انتظار تقديم الأرض',
    land_submission: 'تقديم الأرض',
  }

  return (
    labels[stage] ||
    stage ||
    'لم تحدد المرحلة'
  )
}

export default function CustomerProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] =
    useState(false)

  const [
    showClaimForm,
    setShowClaimForm,
  ] = useState(false)

  const [fileNumber, setFileNumber] =
    useState('')

  const [mobileNumber, setMobileNumber] =
    useState('')

  const [
    isClaimingProject,
    setIsClaimingProject,
  ] = useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [
    claimErrorMessage,
    setClaimErrorMessage,
  ] = useState('')

  const [
    claimSuccessMessage,
    setClaimSuccessMessage,
  ] = useState('')

  useEffect(() => {
    let pageIsActive = true

    async function loadPage() {
      try {
        setLoading(true)
        setErrorMessage('')

        const session =
          await getCustomerSession()

        if (!session) {
          window.location.replace(
            '/customer/account-login'
          )
          return
        }

        const result =
          await getMyCustomerProjects()

        if (pageIsActive) {
          setProjects(result)
        }
      } catch (error) {
        if (pageIsActive) {
          setErrorMessage(
            error?.message ||
              'تعذر تحميل مشاريع الحساب.'
          )
        }
      } finally {
        if (pageIsActive) {
          setLoading(false)
        }
      }
    }

    loadPage()

    return () => {
      pageIsActive = false
    }
  }, [])

  async function handleClaimProject(event) {
    event.preventDefault()

    if (isClaimingProject) return

    try {
      setIsClaimingProject(true)
      setClaimErrorMessage('')
      setClaimSuccessMessage('')

      const linkedProject =
        await claimExistingCustomerProject({
          fileNumber,
          mobileNumber,
        })

      const updatedProjects =
        await getMyCustomerProjects()

      setProjects(updatedProjects)
      setFileNumber('')
      setMobileNumber('')

      setClaimSuccessMessage(
        `تم ربط المشروع ${linkedProject.file_number} بحسابك بنجاح.`
      )
    } catch (error) {
      setClaimErrorMessage(
        error?.message ||
          'تعذر ربط المشروع بالحساب.'
      )
    } finally {
      setIsClaimingProject(false)
    }
  }

  function handleToggleClaimForm() {
    if (isClaimingProject) return

    setShowClaimForm((current) => !current)
    setClaimErrorMessage('')
    setClaimSuccessMessage('')
  }

  async function handleSignOut() {
    if (signingOut) return

    try {
      setSigningOut(true)
      setErrorMessage('')

      await signOutCustomerAccount()

      window.location.replace(
        '/customer/account-login'
      )
    } catch (error) {
      setErrorMessage(
        error?.message ||
          'تعذر تسجيل الخروج.'
      )

      setSigningOut(false)
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                marginBottom: '6px',
                fontSize: '28px',
              }}
            >
              مشاريعي
            </h1>

            <p
              style={{
                margin: 0,
                color: '#6b7280',
              }}
            >
              جميع مشاريع البناء المرتبطة
              بحسابك.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              minHeight: '42px',
              padding: '0 16px',
              border:
                '1px solid #d1d5db',
              borderRadius: '10px',
              background: '#ffffff',
              cursor: signingOut
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {signingOut
              ? 'جاري الخروج...'
              : 'تسجيل الخروج'}
          </button>
        </header>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: '18px',
              padding: '14px',
              background: '#fff1f2',
              border:
                '1px solid #fecdd3',
              borderRadius: '10px',
              color: '#9f1239',
            }}
          >
            {errorMessage}
          </div>
        )}

        <section
          style={{
            marginBottom: '20px',
            padding: '20px',
            background: '#ffffff',
            border:
              '1px solid #e5e7eb',
            borderRadius: '14px',
          }}
        >
          <button
            type="button"
            onClick={handleToggleClaimForm}
            disabled={isClaimingProject}
            style={{
              width: '100%',
              minHeight: '48px',
              border: 0,
              borderRadius: '10px',
              background: '#111827',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: isClaimingProject
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {showClaimForm
              ? 'إغلاق ربط المشروع'
              : 'ربط مشروع حالي'}
          </button>

          {showClaimForm && (
            <form
              onSubmit={handleClaimProject}
              style={{
                marginTop: '20px',
              }}
            >
              <p
                style={{
                  marginTop: 0,
                  marginBottom: '18px',
                  color: '#4b5563',
                  lineHeight: '1.8',
                }}
              >
                أدخل رقم الملف ورقم الجوال
                المستخدمين في نظام الدخول
                القديم. لن يتوقف الدخول القديم
                بعد الربط.
              </p>

              {claimErrorMessage && (
                <div
                  role="alert"
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#fff1f2',
                    border:
                      '1px solid #fecdd3',
                    borderRadius: '10px',
                    color: '#9f1239',
                  }}
                >
                  {claimErrorMessage}
                </div>
              )}

              {claimSuccessMessage && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#f0fdf4',
                    border:
                      '1px solid #bbf7d0',
                    borderRadius: '10px',
                    color: '#166534',
                  }}
                >
                  {claimSuccessMessage}
                </div>
              )}

              <label
                htmlFor="claim-file-number"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '700',
                }}
              >
                رقم الملف
              </label>

              <input
                id="claim-file-number"
                type="text"
                dir="ltr"
                autoComplete="off"
                value={fileNumber}
                onChange={(event) =>
                  setFileNumber(
                    event.target.value
                  )
                }
                disabled={isClaimingProject}
                placeholder="NM-100001"
                required
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  border:
                    '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '16px',
                  textAlign: 'left',
                }}
              />

              <label
                htmlFor="claim-mobile-number"
                style={{
                  display: 'block',
                  marginTop: '16px',
                  marginBottom: '8px',
                  fontWeight: '700',
                }}
              >
                رقم الجوال
              </label>

              <input
                id="claim-mobile-number"
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                value={mobileNumber}
                onChange={(event) =>
                  setMobileNumber(
                    event.target.value
                  )
                }
                disabled={isClaimingProject}
                placeholder="05xxxxxxxx"
                required
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  border:
                    '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '16px',
                  textAlign: 'left',
                }}
              />

              <button
                type="submit"
                disabled={
                  isClaimingProject ||
                  !fileNumber.trim() ||
                  !mobileNumber.trim()
                }
                style={{
                  width: '100%',
                  minHeight: '48px',
                  marginTop: '18px',
                  border: 0,
                  borderRadius: '10px',
                  background:
                    isClaimingProject ||
                    !fileNumber.trim() ||
                    !mobileNumber.trim()
                      ? '#9ca3af'
                      : '#111827',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor:
                    isClaimingProject ||
                    !fileNumber.trim() ||
                    !mobileNumber.trim()
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {isClaimingProject
                  ? 'جاري التحقق والربط...'
                  : 'تحقق واربط المشروع'}
              </button>
            </form>
          )}
        </section>

        {loading ? (
          <div
            style={{
              padding: '30px',
              background: '#ffffff',
              border:
                '1px solid #e5e7eb',
              borderRadius: '14px',
              textAlign: 'center',
            }}
          >
            جاري تحميل المشاريع...
          </div>
        ) : projects.length === 0 ? (
          <div
            style={{
              padding: '30px',
              background: '#ffffff',
              border:
                '1px solid #e5e7eb',
              borderRadius: '14px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: '10px',
                fontSize: '21px',
              }}
            >
              لا توجد مشاريع مرتبطة
              بالحساب
            </h2>

            <p
              style={{
                margin: 0,
                color: '#6b7280',
                lineHeight: '1.8',
              }}
            >
              استخدم زر «ربط مشروع حالي»
              وأدخل رقم الملف ورقم الجوال.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '14px',
            }}
          >
            {projects.map((project) => (
              <article
                key={project.id}
                style={{
                  padding: '20px',
                  background: '#ffffff',
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'flex-start',
                    justifyContent:
                      'space-between',
                    gap: '14px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        marginBottom: '8px',
                        color: '#6b7280',
                        fontSize: '14px',
                      }}
                    >
                      رقم الملف
                    </div>

                    <strong
                      dir="ltr"
                      style={{
                        display: 'block',
                        fontSize: '21px',
                      }}
                    >
                      {project.file_number}
                    </strong>
                  </div>

                  <span
                    style={{
                      padding: '7px 12px',
                      background: '#f3f4f6',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: '700',
                    }}
                  >
                    {getStatusLabel(
                      project.status
                    )}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '18px',
                    paddingTop: '16px',
                    borderTop:
                      '1px solid #e5e7eb',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '6px',
                      color: '#6b7280',
                      fontSize: '14px',
                    }}
                  >
                    المرحلة الحالية
                  </div>

                  <div>
                    {getStageLabel(
                      project.current_stage
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      `/customer/project/${project.id}`
                  }}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    marginTop: '18px',
                    border: 0,
                    borderRadius: '10px',
                    background: '#111827',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  فتح المشروع
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
