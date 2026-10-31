// ============================================================
//  منارة الحلقة — دالة إدارة المستخدمين (Supabase Edge Function)
//  الاسم المطلوب عند النشر: admin-user
//  تتطلب مفتاح service_role، ولا يُوضع هذا المفتاح في الواجهة أبدًا.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function fail(message: string, status = 200) {
  return json({ error: message }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUsername(value: string) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(value);
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return fail('الطريقة غير مدعومة.', 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail('يجب تسجيل الدخول أولًا.', 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return fail('جلسة غير صالحة. سجّل الدخول من جديد.', 401);
    }

    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (callerError) return fail('تعذر التحقق من صلاحيات الحساب: ' + callerError.message, 500);
    if (!caller || caller.active === false || caller.role !== 'admin') {
      return fail('هذه العملية متاحة لمدير الحلقة فقط.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action);

    if (action === 'create') {
      const email = clean(body.email).toLowerCase();
      const password = String(body.password ?? '');
      const fullName = clean(body.full_name);
      const username = clean(body.username);
      const phone = clean(body.phone);
      const role = clean(body.role) || 'student';
      const active = body.active !== false;

      if (!isEmail(email)) return fail('صيغة البريد الإلكتروني غير صحيحة.');
      if (password.length < 8) return fail('كلمة المرور يجب أن تكون ٨ أحرف على الأقل.');
      if (!isUsername(username)) {
        return fail('اسم المستخدم يجب أن يكون ٣ إلى ٣٢ حرفًا إنجليزيًا أو رقمًا أو ( _ . - ).');
      }
      if (!['student', 'teacher', 'admin'].includes(role)) return fail('الدور غير صحيح.');
      if (fullName.length < 3) return fail('الاسم الكامل مطلوب.');

      const { data: byUsername } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle();
      if (byUsername) return fail('اسم المستخدم مستخدم بالفعل.');

      const { data: byEmail } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) return fail('البريد الإلكتروني مستخدم بالفعل.');

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username, phone, role }
      });
      if (createError || !created.user) {
        return fail('تعذر إنشاء الحساب: ' + (createError?.message ?? 'خطأ غير معروف'), 500);
      }

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .upsert(
          {
            id: created.user.id,
            role,
            full_name: fullName,
            username,
            email,
            phone,
            active
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return fail('تعذر إنشاء الملف الشخصي: ' + profileError.message, 500);
      }

      return json({ user: profile });
    }

    if (action === 'update-email') {
      const userId = clean(body.user_id);
      const email = clean(body.email).toLowerCase();
      if (!userId) return fail('معرّف المستخدم مطلوب.');
      if (!isEmail(email)) return fail('صيغة البريد الإلكتروني غير صحيحة.');

      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .maybeSingle();
      if (existing) return fail('البريد الإلكتروني مستخدم بالفعل.');

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true
      });
      if (authUpdateError) return fail('تعذر تحديث بريد الدخول: ' + authUpdateError.message, 500);

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ email })
        .eq('id', userId);
      if (profileUpdateError) {
        return fail('تم تحديث بريد الدخول، لكن تعذر تحديث الملف الشخصي: ' + profileUpdateError.message, 500);
      }

      return json({ ok: true, email });
    }

    if (action === 'reset-password') {
      const userId = clean(body.user_id);
      const password = String(body.password ?? '');
      if (!userId) return fail('معرّف المستخدم مطلوب.');
      if (password.length < 8) return fail('كلمة المرور يجب أن تكون ٨ أحرف على الأقل.');

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return fail('تعذر تغيير كلمة المرور: ' + error.message, 500);
      return json({ ok: true });
    }

    if (action === 'delete') {
      const userId = clean(body.user_id);
      if (!userId) return fail('معرّف المستخدم مطلوب.');
      if (userId === caller.id) return fail('لا يمكنك حذف حسابك الحالي.');

      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) return fail('تعذر التحقق من الحساب: ' + targetError.message, 500);
      if (!target) return fail('الحساب غير موجود.');

      if (target.role === 'admin') {
        const { count } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin')
          .eq('active', true);
        if ((count ?? 0) <= 1) return fail('لا يمكن حذف آخر حساب مدير في الحلقة.');
      }

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return fail('تعذر حذف الحساب: ' + error.message, 500);
      return json({ ok: true });
    }

    return fail('إجراء غير معروف.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع.';
    return fail('تعذر تنفيذ الطلب: ' + message, 500);
  }
});
