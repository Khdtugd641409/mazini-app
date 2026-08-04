import { useEffect, useState } from 'react'
import {
  getCustomerSession,
  getMyCustomerProjects,
  signOutCustomerAccount,
} from '../services/customerAccountAuthService'

function getStatusLabel(status) {
  const labels = {
    submitted: 'متقدم',
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
    waiting_admin_review: 'انتظار مراجعة المنصة',
    waiting_land_submission: 'انتظار تقديم الأرض',
    land_submission: 'تقديم الأرض',
  }

  return labels[stage] || stage || 'لم تحدد المرحلة'
}

export default function CustomerProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let pageIsActive = true

    async function loadPage() {
      try {
        setLoading(true)
        setErrorMessage('')

        const session = await getCustomerSession()

        if (!session) {
          window.location.replace('/customer/account-login')
          return
        }

        const result = await getMyCustomerProjects()

        if (pageIsActive) {
          setProjects(result)
        }
      } catch (error) {
        if (pageIsActive) {
          setErrorMessage(
            error?.message || 'تعذر تحميل مشاريع الحساب.'
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

  async function handleSignOut() {
    if (signingOut) return

    try {
      setSigningOut(true)
      setErrorMessage('')

      await signOutCustomerAccount()

      window.location.replace('/customer/account-login')
    } catch (error) {
      setErrorMessage(
        error?.message || 'تعذر تسجيل الخروج.'
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
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px',
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
              جميع مشاريع البناء المرتبطة بحسابك.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              minHeight: '42px',
              padding: '0 16px',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              background: '#ffffff',
              cursor: signingOut ? 'not-allowed' : 'pointer',
            }}
          >
            {signingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </button>
        </header>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: '18px',
              padding: '14px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              color: '#9f1239',
            }}
          >
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div
            style={{
              padding: '30px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
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
              border: '1px solid #e5e7eb',
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
              لا توجد مشاريع مرتبطة بالحساب
            </h2>

            <p
              style={{
                margin: 0,
                color: '#6b7280',
                lineHeight: '1.8',
              }}
            >
              الحساب جاهز، وسنضيف لاحقًا إمكانية ربط مشاريعك القديمة
              باستخدام رقم الملف ورقم الجوال.
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
                  border: '1px solid #e5e7eb',
                  borderRadius: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
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
                    {getStatusLabel(project.status)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '18px',
                    paddingTop: '16px',
                    borderTop: '1px solid #e5e7eb',
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

                  <div>{getStageLabel(project.current_stage)}</div>
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
