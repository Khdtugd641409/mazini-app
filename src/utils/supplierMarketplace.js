import { supabase } from "../lib/supabase.js";

export const SUPPLIER_MARKETPLACE_ROOT_CATEGORIES = [
  { value: "construction", label: "مواد بناء" },
  { value: "home", label: "أدوات منزلية" },
];

export const CONSTRUCTION_PHASE_CATEGORIES = [
  { value: "structure", label: "عظم", enabled: true },
  { value: "finishing", label: "تشطيب", enabled: false },
];

export const STRUCTURAL_LISTING_TYPES = [
  { value: "materials", label: "مواد" },
  { value: "contractors", label: "مقاول" },
];

export const STRUCTURAL_MATERIAL_CATEGORIES = [
  { value: "concrete", label: "خرسانة", icon: "🏗️", listingType: "materials" },
  { value: "steel", label: "حديد", icon: "🔩", listingType: "materials" },
  { value: "blocks", label: "طوب", icon: "🧱", listingType: "materials" },
  { value: "backfill_material", label: "ردمية", icon: "⛰️", listingType: "materials" },
  { value: "plumbing", label: "سباكة", icon: "🚿", listingType: "materials" },
  { value: "electrical", label: "كهرباء", icon: "💡", listingType: "materials" },
  { value: "cement", label: "أسمنت", icon: "🏭", listingType: "materials" },
  { value: "sand", label: "رمل", icon: "🏜️", listingType: "materials" },
];

export const CONCRETE_GRADE_OPTIONS = [
  { value: "c15_250", label: "C15 - 250" },
  { value: "c20_300", label: "C20 - 300" },
  { value: "c25_350", label: "C25 - 350" },
  { value: "c28_400", label: "C28 - 400" },
  { value: "c30_400", label: "C30 - 400" },
  { value: "c32_400", label: "C32 - 400" },
  { value: "c35_425", label: "C35 - 425" },
  { value: "c40_450", label: "C40 - 450" },
  { value: "c45_465", label: "C45 - 465" },
];

export const CONCRETE_RESISTANCE_OPTIONS = [
  { value: "normal", label: "عادي" },
  { value: "resistant", label: "مقاوم" },
];

export const CONCRETE_UNIT_CODE = "cubic_meter";

export const STRUCTURAL_CONTRACTOR_CATEGORIES = [
  { value: "engineering_office", label: "مكتب هندسي", icon: "📐", listingType: "contractors" },
  { value: "excavation", label: "حفر", icon: "🚜", listingType: "contractors" },
  { value: "backfilling", label: "دفن", icon: "⛏️", listingType: "contractors" },
  { value: "carpenter", label: "نجار", icon: "🪚", listingType: "contractors" },
  { value: "blacksmith", label: "حداد", icon: "🔨", listingType: "contractors" },
  { value: "electrician", label: "كهربائي", icon: "⚡", listingType: "contractors" },
  { value: "plumber", label: "سباك", icon: "🔧", listingType: "contractors" },
  { value: "mason", label: "بناء", icon: "🧱", listingType: "contractors" },
  { value: "plasterer", label: "مليس", icon: "🏠", listingType: "contractors" },
];

export const SUPPLIER_PRODUCT_CATEGORIES = [
  ...STRUCTURAL_MATERIAL_CATEGORIES,
  ...STRUCTURAL_CONTRACTOR_CATEGORIES,
];

// These codes may already exist on products created before the cascading
// classification was introduced. They remain readable, but are not offered
// for new supplier listings.
const LEGACY_CONSTRUCTION_PRODUCT_CATEGORIES = [
  { value: "insulation", label: "عزل", icon: "🛡️" },
  { value: "finishes", label: "تشطيبات", icon: "🎨" },
  { value: "doors_windows", label: "أبواب ونوافذ", icon: "🚪" },
  { value: "tiles_stone", label: "بلاط وحجر", icon: "◻️" },
  { value: "other", label: "مواد أخرى", icon: "📦" },
];

// The home-store branches have not been approved yet. Keep the old codes only
// for backward compatibility; the storefront and supplier form do not present
// them as the current classification.
const LEGACY_HOME_PRODUCT_CATEGORIES = [
  { value: "power_tools", label: "عدد كهربائية", icon: "🔌" },
  { value: "hand_tools", label: "عدد يدوية", icon: "🔨" },
  { value: "home_maintenance", label: "صيانة المنزل", icon: "🧰" },
  { value: "garden_tools", label: "أدوات الحديقة", icon: "🌿" },
  { value: "cleaning_tools", label: "أدوات التنظيف", icon: "🧹" },
  { value: "home_safety", label: "السلامة المنزلية", icon: "🧯" },
  { value: "other_home", label: "منتجات منزلية أخرى", icon: "🏠" },
];

export const HOME_PRODUCT_CATEGORIES = [];

export const SUPPLIER_PRODUCT_UNITS = [
  { value: "linear_meter", label: "متر طولي" },
  { value: "square_meter", label: "متر مربع" },
  { value: "flat_meter", label: "متر مسطح" },
  { value: "cubic_meter", label: "متر مكعب" },
  { value: "ton", label: "طن" },
  { value: "unit", label: "حبة" },
  { value: "other", label: "أخرى" },
];

const LEGACY_SUPPLIER_PRODUCT_UNITS = [
  { value: "piece", label: "قطعة" },
  { value: "meter", label: "متر" },
  { value: "kilogram", label: "كيلو" },
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
  [
    ...LEGACY_CONSTRUCTION_PRODUCT_CATEGORIES,
    ...LEGACY_HOME_PRODUCT_CATEGORIES,
    ...SUPPLIER_PRODUCT_CATEGORIES,
  ]
    .map((category) => [category.value, category.label])
);

const constructionCategoryValues = new Set(
  [...SUPPLIER_PRODUCT_CATEGORIES, ...LEGACY_CONSTRUCTION_PRODUCT_CATEGORIES]
    .map((category) => category.value)
);

const homeCategoryValues = new Set(
  LEGACY_HOME_PRODUCT_CATEGORIES.map((category) => category.value)
);

export function getMarketplaceSectionForCategory(categoryCode) {
  if (homeCategoryValues.has(categoryCode)) return "home";
  if (constructionCategoryValues.has(categoryCode)) return "construction";
  return null;
}

const unitLabels = Object.fromEntries(
  [...LEGACY_SUPPLIER_PRODUCT_UNITS, ...SUPPLIER_PRODUCT_UNITS]
    .map((unit) => [unit.value, unit.label])
);

const concreteGradeLabels = Object.fromEntries(
  CONCRETE_GRADE_OPTIONS.map((grade) => [grade.value, grade.label])
);

const concreteResistanceLabels = Object.fromEntries(
  CONCRETE_RESISTANCE_OPTIONS.map((resistance) => [resistance.value, resistance.label])
);

const classificationByCategory = Object.fromEntries(
  SUPPLIER_PRODUCT_CATEGORIES.map((category) => [category.value, {
    marketplaceSection: "construction",
    constructionPhase: "structure",
    structuralType: category.listingType,
    categoryCode: category.value,
  }])
);

export function getSupplierClassificationForCategory(categoryCode) {
  if (classificationByCategory[categoryCode]) {
    return { ...classificationByCategory[categoryCode] };
  }
  if (homeCategoryValues.has(categoryCode)) {
    return {
      marketplaceSection: "home",
      constructionPhase: "",
      structuralType: "",
      categoryCode,
    };
  }
  if (constructionCategoryValues.has(categoryCode)) {
    return {
      marketplaceSection: "construction",
      constructionPhase: "",
      structuralType: "",
      categoryCode,
    };
  }
  return null;
}

export function getSupplierCategoryLabel(value) {
  return categoryLabels[value] || "قسم آخر";
}

export function getSupplierCategoryPathLabel(value) {
  const classification = classificationByCategory[value];
  if (!classification) return getSupplierCategoryLabel(value);
  const listingTypeLabel = classification.structuralType === "contractors" ? "مقاول" : "مواد";
  return `مواد بناء ← عظم ← ${listingTypeLabel} ← ${getSupplierCategoryLabel(value)}`;
}

export function getSupplierUnitLabel(value, customLabel = "") {
  if (value === "other") return String(customLabel || "").trim() || "وحدة أخرى";
  return unitLabels[value] || value || "وحدة";
}

export function getConcreteGradeLabel(value) {
  return concreteGradeLabels[value] || "";
}

export function getConcreteResistanceLabel(value) {
  return concreteResistanceLabels[value] || "";
}

export function getConcreteProductName(gradeCode, resistanceCode) {
  const gradeLabel = getConcreteGradeLabel(gradeCode);
  const resistanceLabel = getConcreteResistanceLabel(resistanceCode);
  if (!gradeLabel || !resistanceLabel) return "";
  return `خرسانة ${gradeLabel} — ${resistanceLabel}`;
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
    INVALID_CUSTOM_UNIT_LABEL: "اكتب اسم الوحدة الأخرى بشكل صحيح.",
    INVALID_CONCRETE_GRADE: "اختر نوع الخرسانة.",
    INVALID_CONCRETE_RESISTANCE: "اختر عادي أو مقاوم.",
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
