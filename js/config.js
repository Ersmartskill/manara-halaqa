/* ============================================================
   إعدادات منارة الحلقة
   ------------------------------------------------------------
   الوضع المحلي: اترك رابط Supabase ومفتاحه فارغين.
   الوضع السحابي: ضع رابط المشروع والمفتاح العام (anon key) هنا،
   ثم نفّذ ملف supabase/schema.sql داخل مشروع Supabase.
   لا تضع مفتاح service_role في هذا الملف أبدًا.
   ============================================================ */
window.MANARA_CONFIG = {
  mode: 'auto', // auto | local | supabase

  supabaseUrl: '',      // مثال: https://xxxxxxxxxxxx.supabase.co
  supabaseAnonKey: '',  // مثال: eyJhbGciOiJIUzI1NiIsInR5cCI6...

  edgeFunction: 'admin-user',

  app: {
    name: 'منارة الحلقة',
    version: '1.0.0'
  },

  local: {
    databaseKey: 'manara_halaqa_db_v1',
    sessionKey: 'manara_halaqa_session_v1',
    tempSessionKey: 'manara_halaqa_session_tmp_v1',
    readAnnouncementsKey: 'manara_halaqa_read_announcements_v1'
  }
};
