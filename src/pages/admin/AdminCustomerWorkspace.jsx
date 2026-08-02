import { useMemo, useState } from "react";
import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";

const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress: "إجراءات الإفراغ جارية",
  active_project: "المشروع قيد التنفيذ",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  application_review: "مراجعة طلب العميل",
  waiting_land: "انتظار تقديم الأرض",
  land_review: "فحص الأرض",
  land_transfer: "إفراغ الأرض",
  project_execution: "تنفيذ المشروع",
  project_closure: "إغلاق المشروع",
};

const DECISION_LABELS = {
  approve: "قبول العميل",
  needs_completion: "طلب استكمال",
  reject: "رفض الطلب",
};

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminCustomerWorkspace({
  customerFile,
  notes = [],
  isLoading = false,
  errorMessage = "",
  isSubmittingDecision = false,
  decisionError = "",
  onBack,
  onRefresh,
  onDecision,
}) {
  const [selectedDecision, setSelectedDecision] =
    useState("");

  const [decisionNote, setDecisionNote] =
    useState("");

  const statusLabel =
    STATUS_LABELS[customerFile?.status] ||
    customerFile?.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[customerFile?.current_stage] ||
    customerFile?.current_stage ||
    "غير محددة";

  const canDecide = [
    "under_review",
    "needs_completion",
  ].includes(customerFile?.status);

  const requiresDecisionNote =
    selectedDecision === "needs_completion" ||
    selectedDecision === "reject";

  const decisionButtonDisabled =
    !selectedDecision ||
    isSubmittingDecision ||
    (requiresDecisionNote &&
      decisionNote.trim().length === 0);

  const financingRatio = useMemo(() => {
    return Number(customerFile?.financing_ratio || 0);
  }, [customerFile]);

  const handleSubmitDecision = async (event) => {
    event.preventDefault();

    if (decisionButtonDisabled) {
      return;
    }

    await onDecision({
      customerFileId: customerFile.id,
      decision: selectedDecision,
      note: decisionNote,
    });

    setSelectedDecision("");
    setDecisionNote("");
  };

  if (isLoading) {
    return (
      <main>
        <p role="status">
          جاري تحميل ملف العميل...
        </p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main>
        <h1>تعذر فتح ملف العميل</h1>

        <p role="alert">
          <strong>{errorMessage}</strong>
        </p>

        <button
          type="button"
          onClick={onBack}
        >
          العودة إلى ملفات العملاء
        </button>
      </main>
    );
  }

  if (!customerFile) {
    return (
      <main>
        <h1>ملف العميل غير موجود</h1>

        <button
          type="button"
          onClick={onBack}
        >
          العودة إلى ملفات العملاء
        </button>
      </main>
    );
  }

  return (
    <main>
      <header>
        <div>
          <p>إدارة منصة نايف المزيني</p>

          <h1>
            ملف العميل {customerFile.file_number}
          </h1>

          <p>
            آخر تحديث:{" "}
            <strong>
              {formatDate(customerFile.updated_at)}
            </strong>
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={onRefresh}
          >
            تحديث الملف
          </button>

          <button
            type="button"
            onClick={onBack}
          >
            العودة إلى ملفات العملاء
          </button>
        </div>
      </header>

      <section aria-labelledby="file-status-title">
        <h2 id="file-status-title">
          الحالة التشغيلية
        </h2>

        <dl>
          <div>
            <dt>رقم الملف</dt>
            <dd>
              <strong>
                {customerFile.file_number}
              </strong>
            </dd>
          </div>

          <div>
            <dt>الحالة الحالية</dt>
            <dd>
              <strong>{statusLabel}</strong>
            </dd>
          </div>

          <div>
            <dt>المرحلة الحالية</dt>
            <dd>{stageLabel}</dd>
          </div>

          <div>
            <dt>تاريخ التقديم</dt>
            <dd>
              {formatDate(
                customerFile.submitted_at
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="customer-data-title">
        <h2 id="customer-data-title">
          بيانات العميل
        </h2>

        <dl>
          <div>
            <dt>الاسم الكامل</dt>
            <dd>
              {customerFile.customer_name ||
                "غير متوفر"}
            </dd>
          </div>

          <div>
            <dt>رقم الجوال</dt>
            <dd>
              {customerFile.mobile_number ||
                "غير متوفر"}
            </dd>
          </div>

          <div>
            <dt>البريد الإلكتروني</dt>
            <dd>
              {customerFile.email ||
                "غير مضاف"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="project-data-title">
        <h2 id="project-data-title">
          بيانات المشروع والتمويل
        </h2>

        <dl>
          <div>
            <dt>مساحة الأرض</dt>
            <dd>
              {formatSquareMeters(
                customerFile.land_area
              )}
            </dd>
          </div>

          <div>
            <dt>قيمة الأرض</dt>
            <dd>
              {formatSaudiRiyal(
                customerFile.estimated_land_price
              )}
            </dd>
          </div>

          <div>
            <dt>عدد الأدوار</dt>
            <dd>
              {customerFile.floors}
            </dd>
          </div>

          <div>
            <dt>عرض البنك</dt>
            <dd>
              {formatSaudiRiyal(
                customerFile.bank_offer
              )}
            </dd>
          </div>

          <div>
            <dt>تكلفة البناء التقديرية</dt>
            <dd>
              {formatSaudiRiyal(
                customerFile
                  .estimated_construction_cost
              )}
            </dd>
          </div>

          <div>
            <dt>إجمالي تكلفة المشروع</dt>
            <dd>
              <strong>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_project_cost
                )}
              </strong>
            </dd>
          </div>

          <div>
            <dt>
              نسبة التكلفة إلى عرض البنك
            </dt>
            <dd>
              {formatPercentage(
                financingRatio
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="payment-title">
        <h2 id="payment-title">
          الدفعة المقدمة وتوزيعها
        </h2>

        <dl>
          <div>
            <dt>دفعة العميل الأساسية 12٪</dt>
            <dd>
              {formatSaudiRiyal(
                customerFile.base_customer_payment
              )}
            </dd>
          </div>

          <div>
            <dt>فرق التجاوز عن 80٪</dt>
            <dd>
              {formatSaudiRiyal(
                customerFile.excess_amount
              )}
            </dd>
          </div>

          <div>
            <dt>إجمالي الدفعة المطلوبة</dt>
            <dd>
              <strong>
                {formatSaudiRiyal(
                  customerFile
                    .total_customer_payment
                )}
              </strong>
            </dd>
          </div>

          <div>
            <dt>حصة المنصة 1.5٪</dt>
            <dd>
              {formatSaudiRiyal(
                Number(
                  customerFile
                    .estimated_project_cost || 0
                ) * 0.015
              )}
            </dd>
          </div>

          <div>
            <dt>حصة مشرف المشروع 1.5٪</dt>
            <dd>
              {formatSaudiRiyal(
                Number(
                  customerFile
                    .estimated_project_cost || 0
                ) * 0.015
              )}
            </dd>
          </div>

          <div>
            <dt>حصة المستثمرين 9٪</dt>
            <dd>
              {formatSaudiRiyal(
                Number(
                  customerFile
                    .estimated_project_cost || 0
                ) * 0.09
              )}
            </dd>
          </div>
        </dl>

        {customerFile
          .requires_extra_payment_approval && (
          <p>
            موافقة العميل على الدفعة الإضافية:{" "}
            <strong>
              {customerFile.extra_payment_approved
                ? "تمت الموافقة"
                : "لم تتم الموافقة"}
            </strong>
          </p>
        )}
      </section>

      <section aria-labelledby="stages-title">
        <h2 id="stages-title">
          مراحل ملف العميل
        </h2>

        <ol>
          <li>تقديم الطلب</li>
          <li>مراجعة الإدارة</li>
          <li>قبول العميل</li>
          <li>تقديم الأرض</li>
          <li>فحص الأرض</li>
          <li>إفراغ الأرض</li>
          <li>تعيين مشرف المشروع</li>
          <li>التنفيذ</li>
          <li>الإغلاق</li>
        </ol>

        <p>
          المرحلة الحالية:{" "}
          <strong>{stageLabel}</strong>
        </p>
      </section>

      <section aria-labelledby="notes-title">
        <h2 id="notes-title">
          ملاحظات الملف
        </h2>

        {notes.length === 0 ? (
          <p>لا توجد ملاحظات مسجلة.</p>
        ) : (
          <div>
            {notes.map((noteItem) => (
              <article key={noteItem.id}>
                <h3>
                  {noteItem.note_type}
                </h3>

                <p>{noteItem.note}</p>

                <p>
                  {formatDate(
                    noteItem.created_at
                  )}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {canDecide && (
        <section aria-labelledby="decision-title">
          <h2 id="decision-title">
            قرار إدارة المنصة
          </h2>

          <form onSubmit={handleSubmitDecision}>
            <label htmlFor="adminDecision">
              القرار
            </label>

            <select
              id="adminDecision"
              value={selectedDecision}
              onChange={(event) => {
                setSelectedDecision(
                  event.target.value
                );
                setDecisionNote("");
              }}
              disabled={isSubmittingDecision}
              required
            >
              <option value="">
                اختر القرار
              </option>

              <option value="approve">
                قبول العميل
              </option>

              <option value="needs_completion">
                طلب استكمال
              </option>

              <option value="reject">
                رفض الطلب
              </option>
            </select>

            <label htmlFor="decisionNote">
              {selectedDecision ===
              "needs_completion"
                ? "البيانات المطلوب استكمالها"
                : selectedDecision === "reject"
                  ? "سبب الرفض"
                  : "ملاحظة القبول — اختيارية"}
            </label>

            <textarea
              id="decisionNote"
              value={decisionNote}
              onChange={(event) =>
                setDecisionNote(
                  event.target.value
                )
              }
              rows="5"
              disabled={isSubmittingDecision}
              required={requiresDecisionNote}
            />

            {decisionError && (
              <p role="alert">
                <strong>
                  {decisionError}
                </strong>
              </p>
            )}

            <button
              type="submit"
              disabled={decisionButtonDisabled}
            >
              {isSubmittingDecision
                ? "جاري تنفيذ القرار..."
                : selectedDecision
                  ? DECISION_LABELS[
                      selectedDecision
                    ]
                  : "تنفيذ القرار"}
            </button>
          </form>
        </section>
      )}

      {!canDecide && (
        <section>
          <h2>قرار الطلب الأولي</h2>

          <p>
            لا يمكن تنفيذ قرار جديد على الطلب في
            حالته الحالية.
          </p>
        </section>
      )}
    </main>
  );
}

export default AdminCustomerWorkspace;
