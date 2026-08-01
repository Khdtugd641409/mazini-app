export const BUILDING_RATES = {
  1: 2300,
  2: 1700,
  3: 1400,
};

const toPositiveNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
};

export function calculateProjectCosts({
  landArea,
  landPrice,
  floors,
  bankOffer,
}) {
  const safeLandArea = toPositiveNumber(landArea);
  const safeLandPrice = toPositiveNumber(landPrice);
  const safeBankOffer = toPositiveNumber(bankOffer);
  const safeFloors = Number(floors);

  const meterRate = BUILDING_RATES[safeFloors] ?? 0;

  const buildingAreaPerFloor = safeLandArea * 0.6;

  const totalBuildingArea =
    buildingAreaPerFloor * safeFloors;

  const constructionCost =
    totalBuildingArea * meterRate;

  const estimatedProjectCost =
    safeLandPrice + constructionCost;

  const bankLimitAt80Percent =
    safeBankOffer * 0.8;

  const baseCustomerPayment =
    estimatedProjectCost * 0.12;

  const excessAmount =
    estimatedProjectCost > bankLimitAt80Percent
      ? estimatedProjectCost - bankLimitAt80Percent
      : 0;

  const totalCustomerPayment =
    baseCustomerPayment + excessAmount;

  const financingRatio =
    safeBankOffer > 0
      ? estimatedProjectCost / safeBankOffer
      : 0;

  const isComplete =
    safeLandArea > 0 &&
    safeLandPrice >= 0 &&
    meterRate > 0 &&
    safeBankOffer > 0;

  const requiresPaymentApproval =
    isComplete &&
    estimatedProjectCost > bankLimitAt80Percent;

  let eligibilityStatus = "incomplete";
  let eligibilityLabel =
    "أكمل بيانات المشروع والتمويل";
  let canSubmit = false;

  if (isComplete) {
    if (requiresPaymentApproval) {
      eligibilityStatus =
        "eligible_with_extra_payment";

      eligibilityLabel =
        "مؤهل بعد الموافقة على الدفعة المقدمة";

      canSubmit = true;
    } else {
      eligibilityStatus = "eligible";
      eligibilityLabel = "مؤهل للتقديم";
      canSubmit = true;
    }
  }

  return {
    landArea: safeLandArea,
    landPrice: safeLandPrice,
    floors: safeFloors,
    bankOffer: safeBankOffer,

    meterRate,
    buildingAreaPerFloor,
    totalBuildingArea,
    constructionCost,
    estimatedProjectCost,

    bankLimitAt80Percent,
    financingRatio,

    baseCustomerPayment,
    excessAmount,
    totalCustomerPayment,

    isComplete,
    requiresPaymentApproval,
    eligibilityStatus,
    eligibilityLabel,
    canSubmit,
  };
}

export function formatSaudiRiyal(value) {
  const safeValue = Number(value) || 0;

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatSquareMeters(value) {
  const safeValue = Number(value) || 0;

  return `${new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(safeValue)} م²`;
}

export function formatPercentage(value) {
  const safeValue = Number(value) || 0;

  return `${new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 1,
  }).format(safeValue * 100)}٪`;
}
