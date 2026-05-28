import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Building2, Home, User, Mail, Trash2, UserPlus, Eye, LogOut, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from './supabase';

const ADMIN_EMAIL = 'tasis2030@gmail.com';

export default function App() {
  const [page, setPage] = useState('home');
  const [propertyType, setPropertyType] = useState(null);
  const [formData, setFormData] = useState({
    city: '',
    area: '',
    price: '',
    location: '',
    floors: 1,
  });
  const [contact, setContact] = useState({ name: '', contact: '' });
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [requestNumber, setRequestNumber] = useState(null);

  const [investorEmailInput, setInvestorEmailInput] = useState('');
  const [investorAuthEmail, setInvestorAuthEmail] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [newInvestorEmail, setNewInvestorEmail] = useState('');
  const [removeInvestorEmail, setRemoveInvestorEmail] = useState('');

  const [requests, setRequests] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // ===== Supabase functions =====
  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data);
  };

  const loadInvestors = async () => {
    const { data, error } = await supabase
      .from('investors')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setInvestors(data);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadRequests(), loadInvestors()]);
      setLoading(false);
    })();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const calculate = () => {
    const area = parseFloat(formData.area) || 0;
    const price = parseFloat(formData.price) || 0;
    const buildArea = area * 0.6;
    let pricePerMeter = 2000;
    if (propertyType === 'villa') {
      if (formData.floors === 2) pricePerMeter = 1700;
      else if (formData.floors === 3) pricePerMeter = 1500;
    }
    const floors = propertyType === 'villa' ? formData.floors : 1;
    return (buildArea * floors * pricePerMeter) + price;
  };

  const handleCalculate = () => {
    setCalculatedAmount(calculate());
    setPage('result');
  };

  const submitRequest = async () => {
    if (!contact.name || !contact.contact) {
      showToast('الرجاء تعبئة جميع البيانات', 'error');
      return;
    }
    const reqNo = 'REQ-' + Date.now().toString().slice(-6);
    const newReq = {
      request_id: reqNo,
      name: contact.name,
      contact: contact.contact,
      type: propertyType === 'villa' ? `فيلا (${formData.floors} ${formData.floors === 1 ? 'دور' : 'أدوار'})` : 'دور',
      city: formData.city,
      area: formData.area,
      price: formData.price,
      location: formData.location,
      amount: calculatedAmount,
    };
    const { error } = await supabase.from('requests').insert([newReq]);
    if (error) {
      showToast('حدث خطأ، حاول مرة أخرى', 'error');
      console.error(error);
      return;
    }
    await loadRequests();
    setRequestNumber(reqNo);
    setPage('success');
  };

  const resetFlow = () => {
    setPage('home');
    setPropertyType(null);
    setFormData({ city: '', area: '', price: '', location: '', floors: 1 });
    setContact({ name: '', contact: '' });
    setCalculatedAmount(0);
    setRequestNumber(null);
  };

  const fmt = (n) => new Intl.NumberFormat('ar-SA').format(Math.round(n));

  const checkInvestorAccess = () => {
    if (investorEmailInput.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setPage('admin-interested');
      return;
    }
    const match = investors.find(inv => inv.email.toLowerCase() === investorEmailInput.trim().toLowerCase());
    if (match) {
      setInvestorAuthEmail(investorEmailInput.trim());
      setPage('investor-data');
    } else {
      showToast('هذا الإيميل غير مسجل كمستثمر', 'error');
    }
  };

  const addInvestor = async () => {
    if (!newInvestorEmail.trim()) {
      showToast('الرجاء إدخال إيميل', 'error');
      return;
    }
    if (investors.find(i => i.email.toLowerCase() === newInvestorEmail.trim().toLowerCase())) {
      showToast('هذا المستثمر مضاف مسبقاً', 'error');
      return;
    }
    const { error } = await supabase.from('investors').insert([{ email: newInvestorEmail.trim() }]);
    if (error) {
      showToast('حدث خطأ', 'error');
      return;
    }
    await loadInvestors();
    setNewInvestorEmail('');
    showToast('تم إضافة المستثمر بنجاح');
  };

  const removeInvestor = async () => {
    if (!removeInvestorEmail.trim()) {
      showToast('الرجاء إدخال إيميل', 'error');
      return;
    }
    const match = investors.find(i => i.email.toLowerCase() === removeInvestorEmail.trim().toLowerCase());
    if (!match) {
      showToast('هذا المستثمر غير موجود', 'error');
      return;
    }
    const { error } = await supabase.from('investors').delete().eq('id', match.id);
    if (error) {
      showToast('حدث خطأ', 'error');
      return;
    }
    await loadInvestors();
    setRemoveInvestorEmail('');
    showToast('تم حذف المستثمر');
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-50 flex items-center justify-center" style={{ fontFamily: "'Tajawal', sans-serif" }}>
        <div className="text-stone-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-50" style={{ fontFamily: "'Tajawal', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&family=Amiri:wght@400;700&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        .arabic-display { font-family: 'Amiri', serif; }
        .gold-gradient { background: linear-gradient(135deg, #c9a961 0%, #e8d4a0 50%, #c9a961 100%); }
        .dark-card { background: linear-gradient(160deg, #1a1614 0%, #2a2420 100%); }
        .fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slide-in { animation: slideIn 0.4s ease-out; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="max-w-md mx-auto bg-stone-50 min-h-screen relative overflow-hidden shadow-2xl">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-white text-sm font-medium shadow-lg fade-in ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {toast.msg}
          </div>
        )}

        {page === 'home' && (
          <div className="fade-in min-h-screen flex flex-col">
            <div className="dark-card px-6 py-10 relative">
              <div className="absolute top-3 right-3 text-amber-600/40 text-xs">◆ ◆ ◆</div>
              <div className="absolute bottom-3 left-3 text-amber-600/40 text-xs">◆ ◆ ◆</div>
              <div className="text-center">
                <div className="text-amber-200/80 text-xs tracking-[0.3em] mb-2">EST · 2026</div>
                <h1 className="arabic-display text-white text-4xl mb-1 leading-tight">
                  <span className="text-amber-400 italic font-bold">نايف المزيني</span>
                </h1>
                <div className="h-px w-24 mx-auto my-3 gold-gradient"></div>
                <p className="arabic-display text-stone-200 text-xl">للبناء الذاتي</p>
              </div>
              <button
                onClick={() => setPage('investor-login')}
                className="absolute bottom-4 left-4 bg-amber-500/90 hover:bg-amber-400 text-stone-900 text-xs font-bold px-4 py-2 rounded transition-all shadow-lg"
              >
                مستثمر
              </button>
            </div>

            <div className="flex-1 px-6 py-8 bg-gradient-to-b from-stone-50 to-stone-100">
              <div className="text-center mb-6">
                <p className="text-stone-500 text-sm tracking-wider">رحلتك نحو بيتك تبدأ هنا</p>
              </div>
              <div className="space-y-3">
                {[
                  { num: '١', text: 'اختر أرضك', icon: MapPin },
                  { num: '٢', text: 'صمّم المنزل', icon: Home },
                  { num: '٣', text: 'اتفق مع المقاول', icon: User },
                  { num: '٤', text: 'انتقِ المواد', icon: Sparkles },
                  { num: '٥', text: 'اشرف على بنائه', icon: Eye },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white rounded-lg p-3 border border-stone-200 shadow-sm slide-in" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center arabic-display text-stone-900 font-bold text-lg flex-shrink-0">
                      {step.num}
                    </div>
                    <span className="text-stone-800 font-medium flex-1">{step.text}</span>
                    <step.icon className="w-4 h-4 text-amber-600/60" />
                  </div>
                ))}
              </div>

              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-stone-300"></div>
                <span className="text-amber-600 text-xs">◆</span>
                <div className="flex-1 h-px bg-stone-300"></div>
              </div>

              <div className="bg-amber-50 border-2 border-amber-200 border-dashed rounded-lg p-4 text-center">
                <p className="text-stone-700 leading-relaxed">
                  ثم اذهب للبنك واشترِ
                  <br />
                  <span className="text-amber-700 font-bold">العقار عن طريقه</span>
                </p>
              </div>
            </div>

            <div className="px-6 pb-8 bg-stone-100">
              <button
                onClick={() => setPage('select-type')}
                className="w-full dark-card text-white py-4 rounded-lg shadow-xl border border-amber-600/30 hover:border-amber-400 transition-all"
              >
                <span className="arabic-display text-2xl text-amber-300">لنبدأ</span>
                <span className="block text-xs text-stone-400 mt-1 tracking-widest">LET'S BEGIN</span>
              </button>
            </div>
          </div>
        )}

        {page === 'select-type' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('home')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">اختيار العقار</h2>
            </div>
            <div className="flex-1 px-6 py-10">
              <div className="text-center mb-10">
                <div className="text-amber-600 text-2xl mb-3">◆ ◆ ◆</div>
                <h3 className="arabic-display text-stone-800 text-3xl mb-2">ايش العقار اللي نفسك فيه؟</h3>
                <p className="text-stone-500 text-sm">اختر نوع العقار الذي ترغب ببنائه</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setPropertyType('floor'); setPage('details'); }} className="bg-white rounded-xl p-6 border-2 border-stone-200 hover:border-amber-500 transition-all shadow-md hover:shadow-xl group">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 className="w-8 h-8 text-amber-700" />
                  </div>
                  <div className="arabic-display text-2xl text-stone-800">دور</div>
                  <div className="text-xs text-stone-500 mt-1">شقة أو دور كامل</div>
                </button>
                <button onClick={() => { setPropertyType('villa'); setPage('details'); }} className="bg-white rounded-xl p-6 border-2 border-stone-200 hover:border-amber-500 transition-all shadow-md hover:shadow-xl group">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Home className="w-8 h-8 text-amber-700" />
                  </div>
                  <div className="arabic-display text-2xl text-stone-800">فيلا</div>
                  <div className="text-xs text-stone-500 mt-1">منزل مستقل</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {page === 'details' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('select-type')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">بيانات {propertyType === 'villa' ? 'الفيلا' : 'الدور'}</h2>
            </div>
            <div className="flex-1 px-6 py-6 space-y-4">
              <div>
                <label className="block text-stone-700 text-sm mb-2 font-medium">المدينة التي بها العقار</label>
                <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="مثال: الرياض" />
              </div>
              <div>
                <label className="block text-stone-700 text-sm mb-2 font-medium">مساحة الأرض التي عينك عليها (م²)</label>
                <input type="number" value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })} className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="مثال: 500" />
              </div>
              <div>
                <label className="block text-stone-700 text-sm mb-2 font-medium">سعرها (ريال)</label>
                <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="مثال: 800000" />
              </div>
              <div>
                <label className="block text-stone-700 text-sm mb-2 font-medium">موقعها</label>
                <div className="flex gap-2">
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="رابط قوقل ماب" />
                  <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="px-4 py-3 bg-amber-500 text-white rounded-lg flex items-center justify-center hover:bg-amber-600 transition"><MapPin className="w-5 h-5" /></a>
                </div>
                <p className="text-xs text-stone-400 mt-1">انسخ رابط الموقع من Google Maps والصقه هنا</p>
              </div>
              {propertyType === 'villa' && (
                <div>
                  <label className="block text-stone-700 text-sm mb-2 font-medium">عدد الأدوار التي تنويها</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((n) => (
                      <button key={n} onClick={() => setFormData({ ...formData, floors: n })} className={`py-3 rounded-lg arabic-display text-2xl transition-all ${formData.floors === n ? 'gold-gradient text-stone-900 shadow-lg scale-105' : 'bg-white border border-stone-300 text-stone-600 hover:border-amber-400'}`}>
                        {n === 1 ? '١' : n === 2 ? '٢' : '٣'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-8">
              <button onClick={handleCalculate} disabled={!formData.city || !formData.area || !formData.price} className="w-full dark-card text-white py-4 rounded-lg shadow-xl border border-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <span className="arabic-display text-xl text-amber-300">أكمل</span>
              </button>
            </div>
          </div>
        )}

        {page === 'result' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('details')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">الحسبة التقريبية</h2>
            </div>
            <div className="flex-1 px-6 py-8">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-200">
                <div className="dark-card p-6 text-center">
                  <div className="text-amber-400 text-xs tracking-[0.3em] mb-2">ESTIMATED COST</div>
                  <div className="arabic-display text-white text-lg">التكلفة التقديرية</div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">المساحة المبنية (60٪)</span>
                    <span className="text-stone-800 font-medium">{fmt(parseFloat(formData.area) * 0.6)} م²</span>
                  </div>
                  {propertyType === 'villa' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">عدد الأدوار</span>
                      <span className="text-stone-800 font-medium">{formData.floors}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">سعر المتر للبناء</span>
                    <span className="text-stone-800 font-medium">{fmt(propertyType === 'villa' ? (formData.floors === 1 ? 2000 : formData.floors === 2 ? 1700 : 1500) : 2000)} ريال</span>
                  </div>
                  <div className="flex justify-between text-sm pb-3 border-b border-stone-200">
                    <span className="text-stone-500">سعر الأرض</span>
                    <span className="text-stone-800 font-medium">{fmt(parseFloat(formData.price))} ريال</span>
                  </div>
                  <div className="pt-3 text-center">
                    <div className="text-stone-500 text-xs mb-1">المجموع</div>
                    <div className="arabic-display text-4xl text-amber-700 font-bold">{fmt(calculatedAmount)}</div>
                    <div className="text-stone-600 text-sm mt-1">ريال سعودي</div>
                    <div className="inline-block mt-3 px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">(تقريباً)</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center text-xs text-stone-500 leading-relaxed">* هذه حسبة تقديرية وقد تختلف حسب نوع المواد والتشطيبات والمقاول</div>
            </div>
            <div className="px-6 pb-8">
              <button onClick={() => setPage('contact')} className="w-full dark-card text-white py-4 rounded-lg shadow-xl border border-amber-600/30">
                <span className="arabic-display text-xl text-amber-300">أكمل</span>
              </button>
            </div>
          </div>
        )}

        {page === 'contact' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('result')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">للتواصل</h2>
            </div>
            <div className="flex-1 px-6 py-8">
              <div className="text-center mb-8">
                <div className="text-amber-600 text-xl mb-2">◆ ◆ ◆</div>
                <h3 className="arabic-display text-stone-800 text-2xl">بيانات التواصل</h3>
                <p className="text-stone-500 text-sm mt-2">سنتواصل معك بأقرب وقت بإذن الله</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-stone-700 text-sm mb-2 font-medium">الاسم</label>
                  <input type="text" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="اسمك الكريم" />
                </div>
                <div>
                  <label className="block text-stone-700 text-sm mb-2 font-medium">إيميلك أو رقم جوالك</label>
                  <input type="text" value={contact.contact} onChange={(e) => setContact({ ...contact, contact: e.target.value })} className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="example@email.com أو 05xxxxxxxx" />
                </div>
              </div>
            </div>
            <div className="px-6 pb-8">
              <button onClick={submitRequest} className="w-full dark-card text-white py-4 rounded-lg shadow-xl border border-amber-600/30">
                <span className="arabic-display text-xl text-amber-300">إرسال الطلب</span>
              </button>
            </div>
          </div>
        )}

        {page === 'success' && (
          <div className="fade-in min-h-screen flex flex-col items-center justify-center bg-stone-50 px-6">
            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-600" />
            </div>
            <h2 className="arabic-display text-3xl text-stone-800 mb-3">تم استلام طلبك</h2>
            <p className="text-stone-600 text-center mb-6">سيتم التواصل معك في أقرب وقت بإذن الله</p>
            <div className="bg-white border border-stone-200 rounded-xl px-6 py-4 mb-8 shadow-sm">
              <div className="text-xs text-stone-500 mb-1">رقم الطلب</div>
              <div className="arabic-display text-2xl text-amber-700 font-bold">{requestNumber}</div>
            </div>
            <button onClick={resetFlow} className="dark-card text-white px-8 py-3 rounded-lg shadow-lg border border-amber-600/30">
              <span className="arabic-display text-lg text-amber-300">العودة للرئيسية</span>
            </button>
          </div>
        )}

        {page === 'investor-login' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => { setPage('home'); setInvestorEmailInput(''); }} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">دخول المستثمر</h2>
            </div>
            <div className="flex-1 px-6 py-10 flex flex-col justify-center">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full gold-gradient flex items-center justify-center shadow-xl">
                  <User className="w-10 h-10 text-stone-900" />
                </div>
                <h3 className="arabic-display text-stone-800 text-2xl mb-2">منطقة المستثمرين</h3>
                <p className="text-stone-500 text-sm">ادخل إيميلك للوصول</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-stone-700 text-sm mb-2 font-medium">الإيميل</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input type="email" value={investorEmailInput} onChange={(e) => setInvestorEmailInput(e.target.value)} className="w-full pr-11 pl-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="your@email.com" />
                  </div>
                </div>
                <button onClick={checkInvestorAccess} className="w-full dark-card text-white py-3 rounded-lg shadow-lg border border-amber-600/30">
                  <span className="arabic-display text-lg text-amber-300">دخول</span>
                </button>
                <div className="text-center pt-4">
                  <button onClick={() => setPage('admin-login')} className="text-xs text-stone-400 hover:text-amber-600 transition">دخول المدير</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {page === 'admin-login' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => { setPage('investor-login'); setAdminEmailInput(''); }} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">دخول المدير</h2>
            </div>
            <div className="flex-1 px-6 py-10 flex flex-col justify-center">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-stone-800 flex items-center justify-center shadow-xl border-2 border-amber-500">
                  <span className="arabic-display text-3xl text-amber-400">م</span>
                </div>
                <h3 className="arabic-display text-stone-800 text-2xl mb-2">منطقة المدير</h3>
                <p className="text-stone-500 text-sm">للوصول إلى لوحة التحكم</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-stone-700 text-sm mb-2 font-medium">إيميل المدير</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input type="email" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} className="w-full pr-11 pl-4 py-3 bg-white border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="إيميل المدير" />
                  </div>
                </div>
                <button onClick={() => {
                  if (adminEmailInput.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    setPage('admin-dashboard');
                  } else {
                    showToast('إيميل المدير غير صحيح', 'error');
                  }
                }} className="w-full dark-card text-white py-3 rounded-lg shadow-lg border border-amber-600/30">
                  <span className="arabic-display text-lg text-amber-300">دخول</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {page === 'admin-dashboard' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center justify-between">
              <h2 className="arabic-display text-white text-xl">لوحة المدير</h2>
              <button onClick={() => { setPage('home'); setAdminEmailInput(''); }} className="text-amber-400 flex items-center gap-1 text-sm">
                <LogOut className="w-4 h-4" /><span>خروج</span>
              </button>
            </div>
            <div className="flex-1 px-6 py-6 space-y-4">
              <button onClick={() => setPage('admin-interested')} className="w-full bg-white border-2 border-stone-200 hover:border-amber-500 rounded-xl p-5 text-right transition-all shadow-sm hover:shadow-lg group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="arabic-display text-xl text-stone-800 mb-1">بيانات المهتمين</div>
                    <div className="text-xs text-stone-500">عرض جميع طلبات العملاء</div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center group-hover:scale-110 transition">
                    <Eye className="w-6 h-6 text-amber-700" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-stone-400">{requests.length} طلب</div>
              </button>
              <button onClick={() => setPage('manage-investors')} className="w-full bg-white border-2 border-stone-200 hover:border-amber-500 rounded-xl p-5 text-right transition-all shadow-sm hover:shadow-lg group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="arabic-display text-xl text-stone-800 mb-1">رشّح مستثمر</div>
                    <div className="text-xs text-stone-500">إضافة أو حذف مستثمر</div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center group-hover:scale-110 transition">
                    <UserPlus className="w-6 h-6 text-amber-700" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-stone-400">{investors.length} مستثمر</div>
              </button>
              <button onClick={() => setPage('investors-data')} className="w-full bg-white border-2 border-stone-200 hover:border-amber-500 rounded-xl p-5 text-right transition-all shadow-sm hover:shadow-lg group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="arabic-display text-xl text-stone-800 mb-1">بيانات المستثمرين</div>
                    <div className="text-xs text-stone-500">عرض قائمة المستثمرين</div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center group-hover:scale-110 transition">
                    <User className="w-6 h-6 text-amber-700" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {page === 'admin-interested' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('admin-dashboard')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">بيانات المهتمين</h2>
            </div>
            <div className="flex-1 px-4 py-6">
              {requests.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <div className="text-5xl mb-3">◆</div>
                  <p>لا توجد طلبات حتى الآن</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="dark-card text-amber-300">
                        <tr>
                          <th className="px-3 py-3 text-right font-medium">رقم الطلب</th>
                          <th className="px-3 py-3 text-right font-medium">الاسم</th>
                          <th className="px-3 py-3 text-right font-medium">التواصل</th>
                          <th className="px-3 py-3 text-right font-medium">الطلب</th>
                          <th className="px-3 py-3 text-right font-medium">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((r, i) => (
                          <tr key={r.id} className={i % 2 ? 'bg-stone-50' : 'bg-white'}>
                            <td className="px-3 py-3 text-stone-700 font-mono text-xs whitespace-nowrap">{r.request_id}</td>
                            <td className="px-3 py-3 text-stone-800 whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-3 text-stone-600 whitespace-nowrap">{r.contact}</td>
                            <td className="px-3 py-3 text-stone-700 whitespace-nowrap">{r.type} - {r.city}</td>
                            <td className="px-3 py-3 text-amber-700 font-bold whitespace-nowrap">{fmt(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'manage-investors' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('admin-dashboard')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">رشّح مستثمر</h2>
            </div>
            <div className="flex-1 px-6 py-6 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="arabic-display text-lg text-stone-800">إضافة مستثمر</div>
                    <div className="text-xs text-stone-500">أدخل إيميل المستثمر الجديد</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input type="email" value={newInvestorEmail} onChange={(e) => setNewInvestorEmail(e.target.value)} className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="investor@email.com" />
                  <button onClick={addInvestor} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg transition font-medium">إضافة</button>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="arabic-display text-lg text-stone-800">حذف مستثمر</div>
                    <div className="text-xs text-stone-500">أدخل إيميل المستثمر للحذف</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input type="email" value={removeInvestorEmail} onChange={(e) => setRemoveInvestorEmail(e.target.value)} className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" placeholder="investor@email.com" />
                  <button onClick={removeInvestor} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg transition font-medium">حذف</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {page === 'investors-data' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center gap-3">
              <button onClick={() => setPage('admin-dashboard')} className="text-amber-400"><ArrowRight className="w-5 h-5" /></button>
              <h2 className="arabic-display text-white text-xl">بيانات المستثمرين</h2>
            </div>
            <div className="flex-1 px-4 py-6">
              {investors.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <div className="text-5xl mb-3">◆</div>
                  <p>لا يوجد مستثمرون حتى الآن</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {investors.map((inv, i) => (
                    <div key={inv.id} className="bg-white rounded-lg border border-stone-200 p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-stone-900 font-bold">{i + 1}</div>
                      <div className="flex-1">
                        <div className="text-stone-800 font-medium text-sm">{inv.email}</div>
                        <div className="text-xs text-stone-400 mt-0.5">أُضيف: {new Date(inv.created_at).toLocaleDateString('ar-SA')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'investor-data' && (
          <div className="fade-in min-h-screen flex flex-col bg-stone-50">
            <div className="dark-card px-6 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="arabic-display text-white text-xl">الطلبات المتاحة</h2>
              </div>
              <button onClick={() => { setPage('home'); setInvestorEmailInput(''); setInvestorAuthEmail(''); }} className="text-amber-400 flex items-center gap-1 text-sm">
                <LogOut className="w-4 h-4" /><span>خروج</span>
              </button>
            </div>
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
              <div className="text-xs text-stone-600">
                <span className="text-stone-500">مرحباً بك،</span> <span className="font-medium">{investorAuthEmail}</span>
              </div>
            </div>
            <div className="flex-1 px-4 py-6">
              {requests.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <div className="text-5xl mb-3">◆</div>
                  <p>لا توجد طلبات حتى الآن</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="dark-card text-amber-300">
                        <tr>
                          <th className="px-3 py-3 text-right font-medium">رقم الطلب</th>
                          <th className="px-3 py-3 text-right font-medium">الطلب</th>
                          <th className="px-3 py-3 text-right font-medium">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((r, i) => (
                          <tr key={r.id} className={i % 2 ? 'bg-stone-50' : 'bg-white'}>
                            <td className="px-3 py-3 text-stone-700 font-mono text-xs whitespace-nowrap">{r.request_id}</td>
                            <td className="px-3 py-3 text-stone-700 whitespace-nowrap">{r.type} / {r.city}</td>
                            <td className="px-3 py-3 text-amber-700 font-bold whitespace-nowrap">{fmt(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
