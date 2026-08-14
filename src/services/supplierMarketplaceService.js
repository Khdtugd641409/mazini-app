import { supabase } from "../lib/supabase.js";

const PRODUCT_BUCKET = "supplier-products";
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function getSupplierMarketplaceCatalog() {
  const { data, error } = await supabase.rpc("marketplace_get_catalog");
  if (error) throw error;
  return data || { actor: null, products: [] };
}

export async function getMySupplierMarketplaceOrders() {
  const { data, error } = await supabase.rpc("marketplace_list_my_orders");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function checkoutSupplierMarketplace({
  items,
  buyerName,
  buyerMobile,
  deliveryAddress,
  deliveryMapsUrl,
  buyerNote,
}) {
  const { data, error } = await supabase.rpc("marketplace_checkout", {
    p_items: items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    })),
    p_buyer_name: buyerName,
    p_buyer_mobile: buyerMobile,
    p_delivery_address: deliveryAddress,
    p_delivery_maps_url: deliveryMapsUrl || null,
    p_buyer_note: buyerNote || null,
  });
  if (error) throw error;
  return data;
}

function validateProductImage(file) {
  if (!file) throw new Error("اختر صورة المنتج.");
  if (!IMAGE_EXTENSIONS[file.type]) {
    throw new Error("صيغة الصورة يجب أن تكون JPG أو PNG أو WebP.");
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    throw new Error("حجم صورة المنتج يجب ألا يتجاوز 5 ميجابايت.");
  }
}

async function uploadProductImage(file) {
  validateProductImage(file);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData?.user?.id;
  if (!userId) throw new Error("AUTHENTICATION_REQUIRED");

  const extension = IMAGE_EXTENSIONS[file.type];
  const imagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(imagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return imagePath;
}

export async function saveSupplierMarketplaceProduct(product, imageFile) {
  let uploadedImagePath = "";
  try {
    const imagePath = imageFile
      ? (uploadedImagePath = await uploadProductImage(imageFile))
      : product.imagePath;

    const { data, error } = await supabase.rpc("supplier_save_product", {
      p_product_id: product.id || null,
      p_product_name: product.productName,
      p_description: product.description || null,
      p_price: Number(product.price),
      p_unit_code: product.unitCode,
      p_category_code: product.categoryCode,
      p_image_path: imagePath,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    if (uploadedImagePath) {
      await supabase.storage.from(PRODUCT_BUCKET).remove([uploadedImagePath]);
    }
    throw error;
  }
}

export async function archiveSupplierMarketplaceProduct(productId) {
  const { data, error } = await supabase.rpc("supplier_archive_product", {
    p_product_id: productId,
  });
  if (error) throw error;
  return data;
}

export async function updateSupplierMarketplaceOrderStatus(orderId, status) {
  const { data, error } = await supabase.rpc("supplier_update_marketplace_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}
