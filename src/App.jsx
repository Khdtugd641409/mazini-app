import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Home,
  Landmark,
  LogOut,
  Mail,
  MapPin,
  Menu,
  PackageSearch,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from './supabase';

const ADMIN_EMAIL = 'tasis2030@gmail.com';

const POLICY = {
  customerDepositRate: 0.12,
  bankEligibilityRate: 0.8,
  liquidityBufferRate: 0.2,
  platformFeeRate: 0.015,
  managerFeeRate: 0.015,
  investorExpectedRate: 0.09,
  documentationDeadlineHours: 48,
};

const DEMO_PROJECT = {
  id: 'MZ-2026-0048',
  type: 'فيلا',
  city: 'الرياض',
  district: 'شمال الرياض',
  landArea: 450,
  estimatedCost: 1_000_000,
  actualCost: 364_000,
  elapsedDays: 67,
  remainingDays: 233,
  currentStage: 'القواعد',
  expectedStage: 'القواعد',
  progress: 32,
  manager: 'خالد العتيبي',
};

const DEMO_CONTRACTORS = [
  { id: 1, name: 'مؤسسة البناء المتقن', category: 'مقاول عظم', rating: 4.9, price: 720, unit: 'م²', projects: 86, onTime: 96 },
  { id: 2, name: 'شركة أساس العمران', category: 'مقاول عظم', rating: 4.7, price: 680, unit: 'م²', projects: 54, onTime: 92 },
  { id: 3, name: 'مؤسسة الركائز', category: 'مقاول عظم', rating: 4.5, price: 640, unit: 'م²', projects: 31, onTime: 88 },
  { id: 4, name: 'خرسانة المدينة', category: 'خرسانة جاهزة', rating: 4.8, price: 245, unit: 'م³', projects: 133, onTime: 97 },
];

const DEMO_INVESTMENT_OPPORTUNITIES = [
  {
    id: 'MZ-2026-0057',
    kind: 'new',
    label: 'تمويل جديد',
    city: 'الرياض',
    type: 'فيلا',
    cost: 1_000_000,
    required: 1_200_000,
    funded: 760_000,
    expectedMonths: 11,
    expectedReturn: 9,
  },
  {
    id: 'MZ-2026-0031',
    kind: 'resale',
    label: 'حصة معروضة',
    city: 'جدة',
    type: 'فيلا',
    sharePrice: 230_000,
    estimatedValue: 224_000,
    remainingProfit: 26_000,
    remainingMonths: 5,
  },
];

function formatMoney(value) {
  return `${new Intl.NumberFormat('ar-SA').format(Math.round(Number(value || 0)))} ر.س`;
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-950 text-lg font-black text-white shadow-lg">
        م
      </div>
      <div>
        <div className="font-black text-stone-900">منصة المزيني</div>
        {!compact && <div className="text-xs text-stone-500">لإدارة مشاريع البناء الممول حسب اختيار العميل</div>}
      </div>
    </div>
  );
}

function Badge({ children, tone = 'green' }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    gold: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}

function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) {
  const styles = {
    primary: 'bg-emerald-950 text-white hover:bg-emerald-900',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:border-emerald-700',
    ghost: 'bg-transparent text-stone-500 hover:bg-stone-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '' }) {
  return <div className={`rounded-[1.4rem] border border-stone-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-stone-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />;
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1.5 text-lg font-black text-stone-900 md:text-xl">{value}</div>
      {note && <div className="mt-1 text-xs text-stone-400">{note}</div>}
    </div>
  );
}

function AppHeader({ title, subtitle, onBack, onHome, right }) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <Button variant="ghost" className="h-11 w-11 px-0" onClick={onBack}><ArrowRight className="h-5 w-5" /></Button>
          ) : (
            <Brand compact />
          )}
          <div className="min-w-0">
            <div className="truncate font-black text-stone-900">{title}</div>
            {subtitle && <div className="truncate text-xs text-stone-500">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {onHome && <Button variant="ghost" className="h-11 w-11 px-0" onClick={onHome}><Home className="h-5 w-5" /></Button>}
        </div>
      </div>
    </header>
  );
}

function ProjectFileDrawer({ open, onClose }) {
  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-label="إغلاق" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[92%] max-w-md overflow-y-auto bg-white p-5 shadow-2xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">ملف المشروع</h3>
            <p className="mt-1 text-sm text-stone-500">تفاصيل مرجعية لا تزاحم المهمة الحالية.</p>
          </div>
          <Button variant="ghost" className="h-10 w-10 px-0" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="mt-6 grid gap-3">
          {[
            ['عقد العميل', 'موقّع'],
            ['عرض البنك', 'مرفق'],
            ['عقد مدير المشروع', 'موقّع'],
            ['تقارير المراحل', '6 مستندات'],
            ['إيصالات التحويلات', '11 إيصالًا'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <span className="font-bold">{label}</span>
              <span className="text-sm text-stone-500">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-7">
          <h4 className="font-black">سجل المشروع</h4>
          <div className="mt-4 grid gap-4 border-r-2 border-emerald-900 pr-4">
            {[
              ['شراء الأرض', '12 يوليو 2026'],
              ['اعتماد المخطط', '20 يوليو 2026'],
              ['مرحلة القواعد', 'المرحلة الحالية'],
            ].map(([label, date]) => (
              <div key={label}>
                <div className="font-bold">{label}</div>
                <div className="text-xs text-stone-500">{date}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [requests, setRequests] = useState([]);
  const [investors, setInvestors] = useState([]);

  const [application, setApplication] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: 'فيلا',
    city: '',
    area: '',
    bankOffer: '',
    estimatedCost: '',
    bankAttachmentName: '',
    acceptDifference: false,
  });

  const [investorEmailInput, setInvestorEmailInput] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [newInvestorEmail, setNewInvestorEmail] = useState('');
  const [removeInvestorEmail, setRemoveInvestorEmail] = useState('');

  const [contractorSort, setContractorSort] = useState('rating');
  const [contractorCategory, setContractorCategory] = useState('الكل');
  const [fundedAmount, setFundedAmount] = useState(760_000);

  const loadRequests = async () => {
    const { data, error } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (!error && data) setRequests(data);
  };

  const loadInvestors = async () => {
    const { data, error } = await supabase.from('investors').select('*').order('created_at', { ascending: false });
    if (!error && data) setInvestors(data);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadRequests(), loadInvestors()]);
      setLoading(false);
    })();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  };

  const deposit = Number(application.estimatedCost || 0) * POLICY.customerDepositRate;
  const bankCostLimit = Number(application.bankOffer || 0) * POLICY.bankEligibilityRate;
  const financiallyEligible = Number(application.estimatedCost || 0) > 0 && Number(application.estimatedCost || 0) <= bankCostLimit;
  const canSubmitCustomerRequest =
    application.name &&
    application.email &&
    application.phone &&
    application.city &&
    Number(application.area || 0) > 0 &&
    Number(application.bankOffer || 0) > 0 &&
    Number(application.estimatedCost || 0) > 0 &&
    (financiallyEligible || application.acceptDifference);

  const submitCustomerRequest = async () => {
    if (!canSubmitCustomerRequest) {
      showToast('أكمل البيانات المطلوبة أولًا', 'error');
      return;
    }

    const requestId = `REQ-${Date.now().toString().slice(-6)}`;
    const payload = {
      request_id: requestId,
      name: application.name,
      contact: `${application.email} | ${application.phone}`,
      type: application.projectType,
      city: application.city,
      area: application.area,
      price: 0,
      location: '',
      amount: Number(application.estimatedCost),
    };

    const { error } = await supabase.from('requests').insert([payload]);
    if (error) {
      console.error(error);
      showToast('تعذر حفظ الطلب في قاعدة البيانات', 'error');
      return;
    }

    await loadRequests();
    showToast(`تم إرسال الطلب رقم ${requestId}`);
    setPage('application-success');
  };

  const addInvestor = async () => {
    if (!newInvestorEmail.trim()) return showToast('أدخل البريد الإلكتروني', 'error');
    if (investors.some((item) => item.email.toLowerCase() === newInvestorEmail.trim().toLowerCase())) {
      return showToast('هذا المستثمر مسجل مسبقًا', 'error');
    }
    const { error } = await supabase.from('investors').insert([{ email: newInvestorEmail.trim() }]);
    if (error) return showToast('تعذر إضافة المستثمر', 'error');
    setNewInvestorEmail('');
    await loadInvestors();
    showToast('تمت إضافة المستثمر');
  };

  const removeInvestor = async () => {
    const match = investors.find((item) => item.email.toLowerCase() === removeInvestorEmail.trim().toLowerCase());
    if (!match) return showToast('المستثمر غير موجود', 'error');
    const { error } = await supabase.from('investors').delete().eq('id', match.id);
    if (error) return showToast('تعذر حذف المستثمر', 'error');
    setRemoveInvestorEmail('');
    await loadInvestors();
    showToast('تم حذف المستثمر');
  };

  const sortedContractors = useMemo(() => {
    let items = [...DEMO_CONTRACTORS];
    if (contractorCategory !== 'الكل') items = items.filter((item) => item.category === contractorCategory);
    if (contractorSort === 'rating') items.sort((a, b) => b.rating - a.rating);
    if (contractorSort === 'price') items.sort((a, b) => a.price - b.price);
    if (contractorSort === 'projects') items.sort((a, b) => b.projects - a.projects);
    if (contractorSort === 'onTime') items.sort((a, b) => b.onTime - a.onTime);
    return items;
  }, [contractorCategory, contractorSort]);

  const goHome = () => setPage('home');

  if (loading) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-stone-50 text-stone-600">
        جاري تحميل بيانات المنصة...
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        body { margin: 0; }
        @media (max-width: 640px) {
          button { min-height: 44px; }
          .mobile-tight { padding-top: 1rem; padding-bottom: 1rem; }
        }
      `}</style>

      {toast && (
        <div className={`fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'}`}>
          {toast.message}
        </div>
      )}

      {page === 'home' && (
        <div>
          <header className="border-b border-stone-200 bg-stone-50 px-4 py-3">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <Brand />
              <Button variant="ghost" onClick={() => setPage('role-hub')}><Menu className="h-5 w-5" /> الدخول</Button>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 md:py-12">
            <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-5 py-7 text-white shadow-xl md:p-10">
              <Badge tone="gold">حرية الاختيار دون التخلي عن التمويل</Badge>
              <h1 className="mt-4 max-w-4xl text-[2.35rem] font-black leading-[1.22] md:text-6xl">
                اشترِ عن طريق البنك… لكن بمنزلك الذي اخترته أنت.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/85 md:text-lg md:leading-8">
                اختر الأرض والتصميم والمقاول والمواد. تنظم المنصة الرحلة، ويوثّق مدير المشروع المراحل، ويموّل المستثمرون المشروع حتى البيع والإفراغ.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                <Button variant="secondary" onClick={() => setPage('customer-apply')}>تقديم طلب عميل</Button>
                <Button className="bg-amber-500 text-emerald-950 hover:bg-amber-400" onClick={() => setPage('role-hub')}>استعراض المنصة <ChevronLeft className="h-4 w-4" /></Button>
              </div>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="الدفعة المقدمة" value="12%" note="تظهر للعميل قبل الإرسال" />
              <Stat label="حد التكلفة" value="80%" note="من عرض البنك" />
              <Stat label="هامش السيولة" value="20%" note="فوق تكلفة المشروع" />
              <Stat label="العائد المتوقع" value="9%" note="للمستثمرين في المتوسط" />
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-black">كيف تعمل الخدمة؟</h2>
              <p className="mt-2 text-stone-500">المنصة تنظم، وكل طرف يختار ما يناسبه ضمن القواعد.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                {[
                  [MapPin, 'اختر الأرض', 'يختارها العميل وتُشترى باسم جهة التملك.'],
                  [Building2, 'صمّم ونفّذ', 'العميل يختار المكتب والمقاول والمواد.'],
                  [WalletCards, 'يموّل المستثمرون', 'لا يفتح المشروع دون اكتمال التكلفة وهامش الأمان.'],
                  [Landmark, 'يشتري البنك', 'يمكن البيع في أي مرحلة ثم يُغلق المشروع.'],
                ].map(([Icon, title, description]) => (
                  <Card key={title} className="flex items-start gap-4 lg:block">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 lg:h-12 lg:w-12"><Icon className="h-5 w-5 lg:h-6 lg:w-6" /></div>
                    <div className="min-w-0">
                      <h3 className="font-black lg:mt-4">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500 lg:mt-2">{description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}

      {page === 'role-hub' && (
        <div>
          <AppHeader title="الدخول إلى المنصة" subtitle="اختر الدور الذي تريد تجربته" onBack={goHome} />
          <main className="mx-auto max-w-5xl px-4 py-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['العميل', Home, 'customer-dashboard', 'متابعة المشروع والاختيارات والبيع أو التقبيل.'],
                ['المستثمر', WalletCards, 'investor-login', 'اختيار الفرص ومتابعة التمويل والحصص.'],
                ['مدير المشروع', UserCheck, 'manager-dashboard', 'اختيار المشاريع وتوثيق مراحلها.'],
                ['إدارة المنصة', ShieldCheck, 'admin-login', 'القبول والحوكمة والاستثناءات.'],
              ].map(([title, Icon, target, description]) => (
                <Card key={title} className="cursor-pointer transition hover:-translate-y-1 hover:shadow-lg">
                  <button className="w-full text-right" onClick={() => setPage(target)}>
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-950 text-white"><Icon className="h-7 w-7" /></div>
                    <h3 className="mt-5 text-lg font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
                  </button>
                </Card>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card>
                <h3 className="font-black">التسجيل كمتعهد</h3>
                <p className="mt-2 text-sm text-stone-500">مقاول، مورد، مكتب هندسي أو مقدم خدمة.</p>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setPage('contractor-register')}>فتح النموذج</Button>
              </Card>
              <Card>
                <h3 className="font-black">التقديم كمدير مشروع</h3>
                <p className="mt-2 text-sm text-stone-500">عمل مرن حسب المشروع دون توظيف ثابت.</p>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setPage('manager-register')}>فتح النموذج</Button>
              </Card>
              <Card>
                <h3 className="font-black">التسجيل كمستثمر</h3>
                <p className="mt-2 text-sm text-stone-500">رفع إثبات القدرة المالية ومراجعته.</p>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setPage('investor-register')}>فتح النموذج</Button>
              </Card>
            </div>
          </main>
        </div>
      )}

      {page === 'customer-apply' && (
        <div>
          <AppHeader title="تقديم طلب مشروع" subtitle="لا يحتاج إلى إنشاء حساب مسبق" onBack={goHome} />
          <main className="mx-auto max-w-4xl px-4 py-6">
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="الاسم الكامل"><Input value={application.name} onChange={(e) => setApplication({ ...application, name: e.target.value })} /></Field>
                <Field label="البريد الإلكتروني"><Input type="email" value={application.email} onChange={(e) => setApplication({ ...application, email: e.target.value })} /></Field>
                <Field label="رقم الجوال"><Input value={application.phone} onChange={(e) => setApplication({ ...application, phone: e.target.value })} /></Field>
                <Field label="نوع المشروع">
                  <Select value={application.projectType} onChange={(e) => setApplication({ ...application, projectType: e.target.value })}>
                    <option>فيلا</option><option>دور</option><option>عمارة</option>
                  </Select>
                </Field>
                <Field label="المدينة"><Input value={application.city} onChange={(e) => setApplication({ ...application, city: e.target.value })} /></Field>
                <Field label="مساحة المشروع"><Input type="number" value={application.area} onChange={(e) => setApplication({ ...application, area: e.target.value })} /></Field>
                <Field label="قيمة عرض البنك"><Input type="number" value={application.bankOffer} onChange={(e) => setApplication({ ...application, bankOffer: e.target.value })} /></Field>
                <Field label="التكلفة التقديرية"><Input type="number" value={application.estimatedCost} onChange={(e) => setApplication({ ...application, estimatedCost: e.target.value })} /></Field>
                <Field label="إرفاق عرض البنك" hint="في هذه النسخة يُحفظ اسم الملف فقط لحين إعداد التخزين">
                  <Input type="file" onChange={(e) => setApplication({ ...application, bankAttachmentName: e.target.files?.[0]?.name || '' })} />
                </Field>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <Stat label="الدفعة المقدمة 12%" value={formatMoney(deposit)} />
                <Stat label="حد التكلفة 80%" value={formatMoney(bankCostLimit)} />
                <Stat label="الأهلية المبدئية" value={financiallyEligible ? 'مؤهل' : 'غير مؤهل'} />
                <Stat label="هامش السيولة المطلوب" value="20%" />
              </div>

              {!financiallyEligible && Number(application.estimatedCost || 0) > 0 && (
                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <input type="checkbox" checked={application.acceptDifference} onChange={(e) => setApplication({ ...application, acceptDifference: e.target.checked })} className="mt-1 h-5 w-5 accent-emerald-900" />
                  <span>
                    <span className="block font-black text-amber-900">أتعهد بدفع فرق التكلفة</span>
                    <span className="mt-1 block text-sm leading-6 text-amber-800">يمكن تقديم الطلب للمراجعة رغم تجاوزه حد 80%، ولا يُعد قبولًا نهائيًا.</span>
                  </span>
                </label>
              )}

              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                بتقديم الطلب، يقر العميل بأنه اطّلع على نسبة وقيمة الدفعة المقدمة، وعلى أن استحقاقها وآلية التصرف فيها يحكمهما العقد المعتمد.
              </div>

              <Button className="mt-5 w-full" disabled={!canSubmitCustomerRequest} onClick={submitCustomerRequest}>إرسال الطلب</Button>
            </Card>
          </main>
        </div>
      )}

      {page === 'application-success' && (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-md text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-11 w-11" /></div>
            <h2 className="mt-5 text-2xl font-black">تم استلام طلبك</h2>
            <p className="mt-2 leading-7 text-stone-500">لن تحتاج إلى إنشاء حساب إلا بعد قبول الطلب من إدارة المنصة.</p>
            <Button className="mt-6 w-full" onClick={goHome}>العودة للرئيسية</Button>
          </Card>
        </div>
      )}

      {page === 'customer-dashboard' && (
        <div>
          <AppHeader
            title={`مشروع ${DEMO_PROJECT.id}`}
            subtitle={`${DEMO_PROJECT.type} — ${DEMO_PROJECT.city} — ${DEMO_PROJECT.landArea} م²`}
            onBack={() => setPage('role-hub')}
            onHome={goHome}
            right={<Button variant="ghost" onClick={() => setDrawerOpen(true)}><FileText className="h-4 w-4" /> ملف المشروع</Button>}
          />
          <ProjectFileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <Card className="bg-gradient-to-br from-white to-amber-50">
              <Badge tone="gold">المطلوب منك الآن</Badge>
              <h2 className="mt-4 text-2xl font-black">اعتماد المقاول المختار</h2>
              <p className="mt-2 text-stone-500">اختر من داخل المنصة أو أضف مقاولًا خارجيًا ليعتمده مدير المشروع.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => setPage('contractors')}>اختيار مقاول</Button>
                <Button variant="secondary" onClick={() => showToast('سيضاف نموذج المتعهد الخارجي في Sprint 2')}>إضافة متعهد خارجي</Button>
              </div>
            </Card>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="التكلفة التقديرية" value={formatMoney(DEMO_PROJECT.estimatedCost)} />
              <Stat label="التكلفة الفعلية" value={formatMoney(DEMO_PROJECT.actualCost)} />
              <Stat label="الوقت المنقضي" value={`${DEMO_PROJECT.elapsedDays} يومًا`} />
              <Stat label="الوقت المتبقي" value={`${DEMO_PROJECT.remainingDays} يومًا`} />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="flex items-center justify-between"><h3 className="font-black">حالة المشروع</h3><Badge>{DEMO_PROJECT.progress}%</Badge></div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-800" style={{ width: `${DEMO_PROJECT.progress}%` }} /></div>
                <div className="mt-5 grid gap-3">
                  <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>المرحلة الحالية</span><strong>{DEMO_PROJECT.currentStage}</strong></div>
                  <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>المرحلة المفترضة</span><strong>{DEMO_PROJECT.expectedStage}</strong></div>
                  <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>مدير المشروع</span><strong>{DEMO_PROJECT.manager}</strong></div>
                </div>
              </Card>

              <Card>
                <h3 className="font-black">خيارات المشروع</h3>
                <p className="mt-1 text-sm text-stone-500">تظهر فقط لأنها متاحة في هذه المرحلة.</p>
                <div className="mt-4 grid gap-3">
                  <button className="flex items-center justify-between rounded-2xl border border-stone-200 p-4 text-right" onClick={() => showToast('بدأت إجراءات التمويل البنكي التجريبية')}>
                    <span><strong className="block">تمويل بنكي</strong><small className="text-stone-500">البيع للبنك وإغلاق المشروع</small></span><ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="flex items-center justify-between rounded-2xl border border-stone-200 p-4 text-right" onClick={() => setPage('project-market')}>
                    <span><strong className="block">بيع مباشر</strong><small className="text-stone-500">إفراغ العقار للمشتري وإغلاق الملف</small></span><ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="flex items-center justify-between rounded-2xl border border-stone-200 p-4 text-right" onClick={() => setPage('project-market')}>
                    <span><strong className="block">تقبيل العقد</strong><small className="text-stone-500">انتقال العميل واستمرار المشروع</small></span><ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
              </Card>
            </div>
          </main>
        </div>
      )}

      {page === 'contractors' && (
        <div>
          <AppHeader title="المتعهدون والموردون" subtitle="رتّب النتائج بحسب نوع المنتج وحاجتك" onBack={() => setPage('customer-dashboard')} onHome={goHome} />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="نوع الخدمة أو المنتج">
                  <Select value={contractorCategory} onChange={(e) => setContractorCategory(e.target.value)}>
                    <option>الكل</option><option>مقاول عظم</option><option>خرسانة جاهزة</option>
                  </Select>
                </Field>
                <Field label="الترتيب">
                  <Select value={contractorSort} onChange={(e) => setContractorSort(e.target.value)}>
                    <option value="rating">الأعلى تقييمًا</option>
                    <option value="price">الأقل سعرًا</option>
                    <option value="projects">الأكثر تنفيذًا</option>
                    <option value="onTime">الأكثر التزامًا</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedContractors.map((item) => (
                <Card key={item.id}>
                  <Badge tone="blue">{item.category}</Badge>
                  <h3 className="mt-4 text-lg font-black">{item.name}</h3>
                  <p className="mt-2 text-sm text-stone-500">⭐ {item.rating} — {item.projects} مشروعًا — التزام {item.onTime}%</p>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-50 p-4">
                    <span className="text-sm text-stone-500">السعر المرجعي</span>
                    <strong>{formatMoney(item.price)} / {item.unit}</strong>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" onClick={() => showToast(`تم ترشيح ${item.name}`)}>اختيار</Button>
                    <Button variant="secondary">التفاصيل</Button>
                  </div>
                </Card>
              ))}
            </div>
          </main>
        </div>
      )}

      {page === 'project-market' && (
        <div>
          <AppHeader title="سوق المشاريع المقبولة" subtitle="لا يظهر إلا للعملاء الذين اجتازوا القبول" onBack={() => setPage('customer-dashboard')} onHome={goHome} />
          <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:grid-cols-2">
            <Card>
              <Badge>بيع مباشر</Badge>
              <h3 className="mt-4 text-lg font-black">مشروع MZ-2026-0035</h3>
              <p className="mt-1 text-sm text-stone-500">فيلا — مرحلة العظم — الرياض</p>
              <div className="mt-4 grid gap-3">
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>التكاليف حتى الآن</span><strong>{formatMoney(610000)}</strong></div>
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>الدفعة المقدمة</span><strong>{formatMoney(120000)}</strong></div>
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>مبلغ إضافي للبائع</span><strong>{formatMoney(45000)}</strong></div>
              </div>
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">بعد السداد والإفراغ يُغلق المشروع نهائيًا.</p>
              <Button className="mt-4 w-full">طلب الشراء</Button>
            </Card>
            <Card>
              <Badge tone="gold">تقبيل عقد</Badge>
              <h3 className="mt-4 text-lg font-black">مشروع MZ-2026-0040</h3>
              <p className="mt-1 text-sm text-stone-500">فيلا — مرحلة التصميم — جدة</p>
              <div className="mt-4 grid gap-3">
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>قيمة الدفعة المقدمة</span><strong>{formatMoney(108000)}</strong></div>
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>مبلغ تقبيل إضافي</span><strong>{formatMoney(25000)}</strong></div>
                <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>المدة المتبقية</span><strong>8 أشهر</strong></div>
              </div>
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">ينتقل العقد إلى العميل الجديد ويستمر المشروع.</p>
              <Button className="mt-4 w-full">طلب التقبيل</Button>
            </Card>
          </main>
        </div>
      )}

      {page === 'investor-login' && (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-md">
            <Brand />
            <h2 className="mt-7 text-2xl font-black">دخول المستثمر</h2>
            <p className="mt-2 text-sm text-stone-500">اكتب البريد المعتمد لدى إدارة المنصة.</p>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={investorEmailInput} onChange={(e) => setInvestorEmailInput(e.target.value)} />
            </Field>
            <Button className="mt-5 w-full" onClick={() => {
              const allowed = investors.some((item) => item.email.toLowerCase() === investorEmailInput.trim().toLowerCase());
              if (!allowed) return showToast('هذا البريد غير معتمد كمستثمر', 'error');
              setPage('investor-dashboard');
            }}>دخول</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setPage('role-hub')}>رجوع</Button>
          </Card>
        </div>
      )}

      {page === 'investor-dashboard' && (
        <div>
          <AppHeader title="فرص الاستثمار" subtitle="مشاريع جديدة وحصص معروضة في صفحة واحدة" onBack={() => setPage('role-hub')} onHome={goHome} />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Stat label="إجمالي استثماراتك" value={formatMoney(640000)} />
              <Stat label="العائد المتوقع" value={formatMoney(57600)} />
              <Stat label="الاستثمارات النشطة" value="3" />
              <Stat label="الاستثمارات المغلقة" value="7" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {DEMO_INVESTMENT_OPPORTUNITIES.map((item) => (
                <Card key={item.id}>
                  <Badge tone={item.kind === 'new' ? 'green' : 'gold'}>{item.label}</Badge>
                  <h3 className="mt-4 text-lg font-black">{item.id}</h3>
                  {item.kind === 'new' ? (
                    <>
                      <p className="mt-1 text-sm text-stone-500">{item.type} — {item.city} — {item.expectedMonths} شهرًا</p>
                      <div className="mt-4 grid gap-3">
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>تكلفة المشروع</span><strong>{formatMoney(item.cost)}</strong></div>
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>المطلوب مع هامش الأمان</span><strong>{formatMoney(item.required)}</strong></div>
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>العائد المتوقع</span><strong>{item.expectedReturn}%</strong></div>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex justify-between text-sm"><span>تم حجز {formatMoney(fundedAmount)}</span><span>المتبقي {formatMoney(item.required - fundedAmount)}</span></div>
                        <div className="h-3 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-amber-500" style={{ width: `${Math.min(100, fundedAmount / item.required * 100)}%` }} /></div>
                      </div>
                      <Button className="mt-4 w-full" onClick={() => {
                        const remaining = item.required - fundedAmount;
                        if (remaining <= 0) return showToast('اكتمل التمويل بالفعل');
                        const amount = Math.min(100000, remaining);
                        setFundedAmount((current) => current + amount);
                        showToast(`تم حجز ${formatMoney(amount)}`);
                      }}>حجز تمويل</Button>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-stone-500">{item.type} — {item.city}</p>
                      <div className="mt-4 grid gap-3">
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>سعر الحصة</span><strong>{formatMoney(item.sharePrice)}</strong></div>
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>القيمة التقديرية</span><strong>{formatMoney(item.estimatedValue)}</strong></div>
                        <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>العائد المتبقي</span><strong>{formatMoney(item.remainingProfit)}</strong></div>
                      </div>
                      <Button className="mt-4 w-full">طلب شراء الحصة</Button>
                    </>
                  )}
                </Card>
              ))}
            </div>
          </main>
        </div>
      )}

      {page === 'manager-dashboard' && (
        <div>
          <AppHeader title="لوحة مدير المشروع" subtitle="اختر المشاريع التي تناسب نطاقك وتفرغك" onBack={() => setPage('role-hub')} onHome={goHome} />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <Card className="border-amber-200 bg-amber-50">
              <Badge tone="gold">مهمة تحتاج إجراء</Badge>
              <h2 className="mt-4 text-2xl font-black">توثيق مرحلة القواعد — MZ-2026-0048</h2>
              <p className="mt-2 text-amber-800">بقي 19 ساعة قبل تجاوز مهلة التوثيق البالغة 48 ساعة.</p>
              <Button className="mt-5" onClick={() => showToast('سيفتح نموذج التوثيق في Sprint 2')}>توثيق المرحلة</Button>
            </Card>

            <section className="mt-7">
              <h2 className="text-xl font-black">مشاريع متاحة للاختيار</h2>
              <p className="mt-1 text-sm text-stone-500">لا تظهر بيانات العميل الشخصية قبل الاعتماد.</p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Card>
                  <Badge tone="blue">مشروع جديد</Badge>
                  <h3 className="mt-4 font-black">MZ-2026-0062</h3>
                  <p className="mt-1 text-sm text-stone-500">فيلا — شمال الرياض — 420 م²</p>
                  <div className="mt-4 grid gap-3">
                    <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>التكلفة</span><strong>{formatMoney(920000)}</strong></div>
                    <div className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>أتعاب المدير</span><strong>1.5%</strong></div>
                  </div>
                  <div className="mt-4 flex gap-2"><Button className="flex-1">التقدم للمشروع</Button><Button variant="secondary">تجاهل</Button></div>
                </Card>
                <Card>
                  <Badge tone="red">مسحوب من مدير</Badge>
                  <h3 className="mt-4 font-black">MZ-2026-0029</h3>
                  <p className="mt-1 text-sm text-stone-500">دور — الخرج — مرحلة العظم</p>
                  <div className="mt-4 rounded-2xl bg-stone-50 p-4">المستندات المكتملة: <strong>74%</strong></div>
                  <div className="mt-4 flex gap-2"><Button className="flex-1">التقدم للمشروع</Button><Button variant="secondary">تجاهل</Button></div>
                </Card>
              </div>
            </section>
          </main>
        </div>
      )}

      {page === 'admin-login' && (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-md">
            <Brand />
            <h2 className="mt-7 text-2xl font-black">دخول إدارة المنصة</h2>
            <Field label="البريد الإداري"><Input type="email" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} /></Field>
            <Button className="mt-5 w-full" onClick={() => {
              if (adminEmailInput.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return showToast('البريد الإداري غير صحيح', 'error');
              setPage('admin-dashboard');
            }}>دخول</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setPage('role-hub')}>رجوع</Button>
          </Card>
        </div>
      )}

      {page === 'admin-dashboard' && (
        <div>
          <AppHeader title="إدارة المنصة" subtitle="لا تظهر إلا الحالات التي تحتاج قرارًا" onBack={() => setPage('role-hub')} onHome={goHome} />
          <main className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="blue">جهة التملك الحالية: نايف المزيني</Badge>
              <Button variant="ghost" onClick={() => setPage('role-hub')}><LogOut className="h-4 w-4" /> خروج</Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="طلبات العملاء" value={requests.length} />
              <Stat label="طلبات المستثمرين" value={investors.length} />
              <Stat label="طلبات المديرين" value="11" />
              <Stat label="المشاريع النشطة" value="42" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="font-black">حالات تحتاج قرارًا</h3>
                <div className="mt-4 grid gap-3">
                  <button className="flex justify-between rounded-2xl border border-stone-200 p-4 text-right"><span>مدير لم يوثق خلال 48 ساعة</span><Badge tone="red">فتح</Badge></button>
                  <button className="flex justify-between rounded-2xl border border-stone-200 p-4 text-right"><span>مشروع يريد البيع في مرحلة العظم</span><Badge tone="gold">مراجعة</Badge></button>
                  <button className="flex justify-between rounded-2xl border border-stone-200 p-4 text-right"><span>تغيير تصميم يحتاج ملحقًا</span><Badge tone="blue">مراجعة</Badge></button>
                </div>
              </Card>

              <Card>
                <h3 className="font-black">السياسات الحالية</h3>
                <div className="mt-4 grid gap-3">
                  {[
                    ['الدفعة المقدمة', '12%'],
                    ['رسوم المنصة', '1.5%'],
                    ['أتعاب مدير المشروع', '1.5%'],
                    ['هامش السيولة', '20%'],
                    ['مهلة التوثيق', '48 ساعة'],
                  ].map(([label, value]) => <div key={label} className="flex justify-between rounded-2xl bg-stone-50 p-4"><span>{label}</span><strong>{value}</strong></div>)}
                </div>
              </Card>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="flex items-center justify-between"><h3 className="font-black">إدارة المستثمرين</h3><Users className="h-5 w-5 text-stone-400" /></div>
                <div className="mt-4 grid gap-3">
                  <Field label="إضافة مستثمر"><div className="flex gap-2"><Input type="email" value={newInvestorEmail} onChange={(e) => setNewInvestorEmail(e.target.value)} /><Button onClick={addInvestor}><Plus className="h-4 w-4" /></Button></div></Field>
                  <Field label="حذف مستثمر"><div className="flex gap-2"><Input type="email" value={removeInvestorEmail} onChange={(e) => setRemoveInvestorEmail(e.target.value)} /><Button variant="danger" onClick={removeInvestor}><Trash2 className="h-4 w-4" /></Button></div></Field>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between"><h3 className="font-black">أحدث طلبات العملاء</h3><Search className="h-5 w-5 text-stone-400" /></div>
                <div className="mt-4 grid gap-3">
                  {requests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex items-center justify-between gap-3"><strong>{request.name}</strong><Badge tone="stone">{request.request_id}</Badge></div>
                      <div className="mt-2 text-sm text-stone-500">{request.type} — {request.city} — {formatMoney(request.amount)}</div>
                    </div>
                  ))}
                  {requests.length === 0 && <div className="rounded-2xl bg-stone-50 p-5 text-center text-sm text-stone-500">لا توجد طلبات بعد.</div>}
                </div>
              </Card>
            </div>
          </main>
        </div>
      )}

      {['contractor-register', 'manager-register', 'investor-register'].includes(page) && (
        <GenericRegistration
          type={page}
          onBack={() => setPage('role-hub')}
          onSubmit={() => showToast('تم إرسال الطلب التجريبي للمراجعة')}
        />
      )}
    </div>
  );
}

function GenericRegistration({ type, onBack, onSubmit }) {
  const config = {
    'contractor-register': {
      title: 'التسجيل كمتعهد',
      subtitle: 'مقاول، مورد، مكتب هندسي أو مقدم خدمة',
      fields: ['البريد الإلكتروني', 'اسم المؤسسة', 'نوع الخدمات', 'السجل التجاري', 'الموقع الإلكتروني', 'رابط الموقع الجغرافي', 'رقم التواصل', 'المنتجات والأسعار'],
    },
    'manager-register': {
      title: 'التقديم كمدير مشروع',
      subtitle: 'عمل مرن حسب المشروع ودون توظيف ثابت',
      fields: ['الاسم الكامل', 'البريد الإلكتروني', 'رقم الجوال', 'المؤهل', 'سنوات الخبرة', 'هل لديه سيارة؟', 'مدى التفرغ', 'المدن المتاحة', 'رقم الآيبان'],
    },
    'investor-register': {
      title: 'التسجيل كمستثمر',
      subtitle: 'يراجع إثبات القدرة المالية قبل فتح الفرص',
      fields: ['الاسم الكامل', 'البريد الإلكتروني', 'رقم الجوال', 'نوع المستثمر', 'السيولة المتاحة', 'رقم الآيبان', 'إثبات القدرة المالية'],
    },
  }[type];

  return (
    <div>
      <AppHeader title={config.title} subtitle={config.subtitle} onBack={onBack} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            {config.fields.map((field) => (
              <Field key={field} label={field}>
                {field.includes('إثبات') || field.includes('المنتجات') ? <Input type="file" /> : <Input />}
              </Field>
            ))}
          </div>
          <Button className="mt-6 w-full" onClick={onSubmit}>تقديم الطلب</Button>
        </Card>
      </main>
    </div>
  );
}
