import { supabase } from "../lib/supabase.js";

export async function signInAdmin({
  email,
  password,
}) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("أدخل البريد الإلكتروني.");
  }

  if (!password) {
    throw new Error("أدخل كلمة المرور.");
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (signInError) {
    throw new Error(
      "البريد الإلكتروني أو كلمة المرور غير صحيحة."
    );
  }

  if (!signInData.user) {
    throw new Error("تعذر التحقق من حساب المستخدم.");
  }

  const { data: adminProfile, error: profileError } =
    await supabase
      .from("admin_users")
      .select(
        "id, full_name, role, is_active"
      )
      .eq("id", signInData.user.id)
      .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();

    throw new Error(
      "تعذر التحقق من صلاحية إدارة المنصة."
    );
  }

  if (!adminProfile || !adminProfile.is_active) {
    await supabase.auth.signOut();

    throw new Error(
      "هذا الحساب غير مصرح له بدخول إدارة المنصة."
    );
  }

  return {
    user: signInData.user,
    session: signInData.session,
    adminProfile,
  };
}

export async function getCurrentAdmin() {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const { data: adminProfile, error: profileError } =
    await supabase
      .from("admin_users")
      .select(
        "id, full_name, role, is_active"
      )
      .eq("id", userData.user.id)
      .maybeSingle();

  if (
    profileError ||
    !adminProfile ||
    !adminProfile.is_active
  ) {
    return null;
  }

  return {
    user: userData.user,
    adminProfile,
  };
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(
      "تعذر تسجيل الخروج من إدارة المنصة."
    );
  }
}
