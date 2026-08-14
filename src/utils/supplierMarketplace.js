import { supabase } from "../lib/supabase.js";

export const SUPPLIER_PRODUCT_CATEGORIES = [
  { value: "steel", label: "حديد وتسليح", icon: "🏗️" },
  { value: "concrete", label: "خرسانة وأسمنت", icon: "🧱" },
  { value: "blocks", label: "بلوك وطوب", icon: "🧱" },
  { value: "insulation", label: "عزل", icon: "🛡️" },
  { value: "plumbing", label: "سباكة", icon: "🚿" },
  { value: "electrical", label: "كهرباء", icon: "💡" },
  { value: "finishes", label: "تشطيبات", icon: "🎨" },
  { value: "doors_windows", label: "أبواب ونوافذ", icon: "🚪" },
  { value: "tiles_stone", label: "بلاط وحجر", icon: "◻️" },
  { value: "other", label: "مواد أخرى", icon: "📦" },
];

export const HOME_PRODUCT_CATEGORIES = [
  { value: "power_tools", label: "عدد كهربائية", icon: "🔌" },
  { value: "hand_tools", label: "عدد يدوية", icon: "🔨" },
  { value: "home_maintenance", label: "صيانة المنزل", icon: "🧰" },
  { value: "garden_tools", label: "أدوات الحديقة", icon: "🌿" },
  { value: "cleaning_tools", label: "أدوات التنظيف", icon: "🧹" },
  { value: "home_safety", label: "السلامة المنزلية", icon: "🧯" },
  { value: "other_home", label: "منتجات منزلية أخرى", icon: "🏠" },
];

export const MARKETPLACE_SECTIONS = [
  { value: "construction", label: "مواد البناء" },
  { value: "home", label: "متجر المنزل" },
];

export const SUPPLIER_PRODUCT_UNITS = [
  { value: "unit", label: "حبة" },
  { value: "piece", label: "قطعة" },
  { value: "meter", label: "متر" },
  { value: "square_meter", label: "م²" },
  { value: "cubic_meter", label: "م³" },
  { value: "kilogram", label: "كيلو" },
  { value: "ton", label: "طن" },
  { value: "bag", label: "كيس" },
  { value: "carton", label: "كرتون" },
  { value: "roll", label: "لفة" },
  { value: "sheet", label: "لوح" },
  { value: "pallet", label: "طبلية" },
  { value: "package", label: "عبوة" },
];

export const MARKETPLACE_ORDER_STATUSES = {
  submitted: "طلب جديد",
  contacted: "تم التواصل",
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  out_for_delivery: "خرج للتسليم",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const MARKETPLACE_ORDER_NEXT_ACTIONS = {
  submitted: { status: "contacted", label: "تأكيد التواصل مع المشتري" },
  contacted: { status: "confirmed", label: "تأكيد الطلب" },
  confirmed: { status: "preparing", label: "بدء التجهيز" },
  preparing: { status: "out_for_delivery", label: "خرج للتسليم" },
  out_for_delivery: { status: "completed", label: "إكمال الطلب" },
};

const categoryLabels = Object.fromEntries(
  [...SUPPLIER_PRODUCT_CATEGORIES, ...HOME_PRODUCT_CATEGORIES]
    .map((category) => [category.value, category.label])
);

export function getProductCategoriesForSection(section) {
  return section === "home" ? HOME_PRODUCT_CATEGORIES : SUPPLIER_PRODUCT_CATEGORIES;
}

const unitLabels = Object.fromEntries(
  SUPPLIER_PRODUCT_UNITS.map((unit) => [unit.value, unit.label])
);

export function getSupplierCategoryLabel(value) {
  return categoryLabels[value] || "قسم آخر";
}

export function getSupplierUnitLabel(value) {
  return unitLabels[value] || value || "وحدة";
}

export function isDiscreteSupplierUnit(value) {
  return ["unit", "piece", "bag", "carton", "roll", "sheet", "pallet", "package"].includes(value);
}

export function formatMarketplaceMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMarketplaceQuantity(value) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

export function getSupplierProductImageUrl(imagePath) {
  if (!imagePath) return "";
  return supabase.storage.from("supplier-products").getPublicUrl(imagePath).data.publicUrl;
}

export function getMarketplaceErrorMessage(error, fallback = "تعذر إكمال العملية.") {
  const message = String(error?.message || error || "");
  const labels = {
    AUTHENTICATION_REQUIRED: "سجّل الدخول أولًا.",
    MARKETPLACE_BUYER_AUTHORIZATION_REQUIRED: "السوق متاح لحسابات العملاء والمشرفين وإدارة المنصة.",
    BUYER_EMAIL_MISMATCH: "البريد المدخل لا يطابق البريد الذي تم توثيقه.",
    CART_PRODUCT_SECTION_MISMATCH: "لا يمكن خلط منتجات متجر المنزل مع مواد البناء في طلب واحد.",
    INVALID_BUYER_NAME: "اكتب اسم المستلم بشكل صحيح.",
    INVALID_BUYER_MOBILE: "أدخل رقم جوال سعودي يبدأ بـ 05 ويتكون من 10 أرقام.",
    INVALID_DELIVERY_ADDRESS: "اكتب عنوان التسليم بوضوح.",
    INVALID_DELIVERY_MAPS_URL: "رابط موقع التسليم غير صحيح.",
    INVALID_CART_ITEMS: "السلة فارغة أو تتجاوز الحد المسموح.",
    INVALID_CART_ITEM: "توجد كمية غير صحيحة في السلة.",
    INVALID_DISCRETE_PRODUCT_QUANTITY: "الكميات المباعة بالحبة أو القطعة أو العبوة يجب أن تكون أعدادًا صحيحة.",
    INVALID_CART_LINE_TOTAL: "قيمة أحد بنود السلة أصغر أو أكبر من الحد المسموح.",
    ORDER_SUBTOTAL_TOO_LARGE: "إجمالي طلب أحد الموردين يتجاوز الحد المسموح.",
    DUPLICATE_CART_PRODUCT: "تكرر منتج داخل السلة.",
    CART_PRODUCT_UNAVAILABLE: "تغيّر توفر أحد المنتجات أو سعره. حدّث السلة وحاول مجددًا.",
    SUPPLIER_AUTHORIZATION_REQUIRED: "هذا الإجراء متاح للمورد المعتمد فقط.",
    INVALID_PRODUCT_NAME: "اكتب اسم المنتج.",
    INVALID_PRODUCT_PRICE: "أدخل سعرًا صحيحًا أكبر من صفر وبحد أقصى منزلتين عشريتين.",
    INVALID_PRODUCT_UNIT: "اختر وحدة بيع صحيحة.",
    INVALID_PRODUCT_CATEGORY: "اختر قسم المنتج.",
    INVALID_MARKETPLACE_SECTION: "اختر السوق الذي سيظهر فيه المنتج.",
    INVALID_PRODUCT_IMAGE_PATH: "ارفع صورة صحيحة للمنتج.",
    PRODUCT_NOT_FOUND: "المنتج غير موجود أو لا يتبع هذا المورد.",
    ORDER_NOT_FOUND: "الطلب غير موجود أو لا يتبع هذا المورد.",
    INVALID_ORDER_STATUS_TRANSITION: "لا يمكن نقل الطلب إلى هذه الحالة مباشرة.",
  };

  const code = Object.keys(labels).find((key) => message.includes(key));
  return code ? labels[code] : (message || fallback);
}
