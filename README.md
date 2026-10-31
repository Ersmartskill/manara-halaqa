# منارة الحلقة

سجل رقمي عربي (RTL) لإنجازات طلاب **حلقة المنارة المتقدمة** في **جامع الراجحي**، بإشراف **جمعية قبس للقرآن والسنة والخطابة**.

يعمل الموقع مباشرة من المتصفح دون خطوة بناء، ويحفظ البيانات محليًا في `localStorage`، مع طبقة جاهزة للانتقال إلى **Supabase** عند الحاجة.

---

## ما الذي يقدمه الموقع؟

### للطالب
- تسجيل الدخول باسم المستخدم أو البريد الإلكتروني.
- عرض سجل إنجازاته ونقاطه ومستواه وترتيبه في الحلقة.
- إضافة إنجاز جديد وإرساله للمعلم للاعتماد.
- متابعة ملاحظات المعلمين وتقييماتهم.
- طباعة سجل الإنجاز أو حفظه PDF من المتصفح.

### للمعلم
- تسجيل الإنجازات للطلاب مباشرة.
- اعتماد إنجازات الطلاب أو إعادتها للمراجعة مع ملاحظة.
- إضافة تقييمات ومتابعة مستويات الطلاب.
- الاطلاع على ترتيب الطلاب وإعلانات الحلقة.

### لمدير الحلقة
- إدارة الحسابات (إضافة، تعديل، تعطيل، حذف، إعادة تعيين كلمة المرور).
- إدارة جميع الإنجازات والتقييمات والإعلانات.
- تعديل بيانات الحلقة والشعارات.
- تصدير/استيراد نسخة احتياطية محلية وإعادة ضبط البيانات التجريبية.

---

## التشغيل المحلي

الطريقة الأسهل: افتح `index.html` مباشرة في المتصفح. التطبيق يستخدم سكربتات عادية (وليست ES Modules)، لذلك يعمل من `file://`.

للحصول على رابط محلي `http://localhost` (مفيد عند تجربة Supabase أو الجوال على نفس الشبكة):

```powershell
cd manara-halaqa
powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1
```

ثم افتح: <http://localhost:8787>

### الحسابات التجريبية (الوضع المحلي فقط)

| الدور | اسم المستخدم | كلمة المرور |
|---|---|---|
| مدير الحلقة | `admin` | `Admin@123` |
| معلم | `ustadh` | `Teacher@123` |
| طالب | `student` | `Student@123` |

يوجد أيضًا 7 طلاب وهميون وحساب معلم ثانٍ داخل البيانات التجريبية.

> البيانات المحلية محفوظة في متصفحك تحت المفتاح `manara_halaqa_db_v1`. مسح بيانات المتصفح يمسحها. استخدم **إعدادات الحلقة ← تصدير نسخة احتياطية** قبل أي تغيير كبير.

---

## الانتقال إلى Supabase (السحابة)

### 1) إنشاء المشروع
1. أنشئ مشروعًا جديدًا على <https://supabase.com>.
2. من **Project Settings ← API** انسخ:
   - `Project URL`
   - `anon public key`

### 2) تنفيذ مخطط قاعدة البيانات
1. افتح **SQL Editor** في مشروع Supabase.
2. انسخ محتوى الملف `supabase/schema.sql` كاملًا ونفّذه.
3. الملف ينشئ الجداول، وسياسات RLS، والمشغلات، ودوال تسجيل الدخول والترتيب، وصف إعدادات الحلقة.

### 3) إنشاء أول مدير
لا يمكن للواجهة إنشاء أول مدير قبل وجود مدير. أنشئ الحساب من لوحة Supabase:

1. اذهب إلى **Authentication ← Users ← Add user**.
2. أدخل البريد وكلمة المرور، وفعّل **Auto Confirm User**.
3. بعد إنشاء الحساب سيُنشئ المشغّل صفًا في `public.profiles` بدور `student`.
4. رقِّ الحساب إلى مدير من **SQL Editor**:

```sql
update public.profiles
set role = 'admin',
    full_name = 'اسم مدير الحلقة',
    username = 'admin'
where email = 'YOUR_EMAIL@example.com';
```

بعد ذلك سجّل الدخول من الموقع، وستستطيع إنشاء بقية الحسابات من صفحة **المستخدمون**.

### 4) نشر دالة إدارة المستخدمين
دالة `admin-user` هي التي تنشئ الحسابات وتغيّر كلمات المرور والبريد وتحذف الحسابات باستخدام مفتاح `service_role` على الخادم فقط.

```powershell
# ثبّت Supabase CLI أولًا من:
# https://supabase.com/docs/guides/cli

supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-user
```

لا تحتاج إلى إضافة `SUPABASE_URL` أو `SUPABASE_SERVICE_ROLE_KEY` كأسرار يدويًا؛ Supabase يوفرهما للدالة تلقائيًا. **لا تضع مفتاح `service_role` في `js/config.js` أو في أي ملف واجهة.**

### 5) ربط الواجهة
افتح `js/config.js` وضع:

```js
window.MANARA_CONFIG = {
  mode: 'auto',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_PUBLIC_KEY',
  edgeFunction: 'admin-user',
  // ...
};
```

عند وجود الرابط والمفتاح، سيتحول التطبيق تلقائيًا إلى وضع Supabase. إذا تعذّر الاتصال في وضع `auto` سيعود إلى الوضع المحلي مع تنبيه.

### 6) إعدادات موصى بها في Supabase
- **Authentication ← Providers ← Email**: أوقف تسجيل الدخول الذاتي (Sign ups) إن كنت تنشئ الحسابات من لوحة الإدارة فقط.
- **Authentication ← URL Configuration**: أضف رابط موقعك إلى `Site URL` و`Redirect URLs` حتى يعمل رابط استعادة كلمة المرور.
- **Authentication ← Emails**: فعّل تأكيد البريد أو استخدم إنشاء الحسابات من لوحة الإدارة مع `email_confirm`.

---

## النشر على GitHub Pages باستخدام رمز GitHub

المشروع يحتوي على سكربت جاهز ينشئ المستودع (أو يحدّثه) ويرفع الملفات ويفعّل GitHub Pages. **لا تحتاج إلى تثبيت Git.**

### 1) إنشاء رمز GitHub
من GitHub: **Settings ← Developer settings ← Personal access tokens**.

- **Fine-grained token** (مستحسن): امنحه صلاحيات:
  - `Administration: Read and write` (لإنشاء المستودع وتفعيل Pages)
  - `Contents: Read and write` (لرفع الملفات)
  - `Pages: Read and write`
  - `Metadata: Read`
- أو **Classic token** بصلاحية `repo` و`workflow`.

### 2) إنشاء ملف `.env`
انسخ `.env.example` إلى `.env` داخل مجلد `manara-halaqa`، ثم املأ:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxx
GITHUB_OWNER=
GITHUB_REPO=manara-halaqa
GITHUB_VISIBILITY=public
GITHUB_BRANCH=
```

- اترك `GITHUB_OWNER` فارغًا لاستخدام صاحب الرمز.
- `GITHUB_VISIBILITY=private` يتطلب خطة GitHub مدفوعة لتفعيل Pages.
- **ملف `.env` مستبعد في `.gitignore` ولا يرفعه السكربت إلى المستودع. لا تشاركه مع أحد.**

### 3) تشغيل النشر

```powershell
cd manara-halaqa
powershell -ExecutionPolicy Bypass -File scripts/deploy-github.ps1
```

سيطبع السكربت رابط المستودع ورابط الموقع، مثل:

```
https://YOUR_USERNAME.github.io/manara-halaqa/
```

قد يستغرق ظهور الموقع أول مرة دقيقة أو دقيقتين.

> إذا كان المستودع موجودًا مسبقًا، سيحدّث السكربت الملفات فقط. الملفات القديمة غير الموجودة في المشروع لن تُحذف تلقائيًا.

### بدائل الاستضافة
الموقع ثابت بالكامل، لذا يعمل على أي استضافة ملفات:

- **Netlify**: اسحب مجلد `manara-halaqa` إلى لوحة Netlify، أو اربط المستودع. Build command فارغ، Publish directory: `.`
- **Vercel**: Framework Preset: `Other`، Root Directory: `manara-halaqa`، Build Command فارغ، Output Directory: `.`
- **Cloudflare Pages**: Build command فارغ، Build output directory: `/` (أو ارفع الملفات مباشرة).
- **GitHub Pages**: استخدم السكربت أعلاه أو ارفع المشروع يدويًا وفعّل Pages من **Settings ← Pages**.

---

## الشعارات

الشعارات الحالية مؤقتة بصيغة SVG داخل `assets/logos/`:

- `manara.svg` — المنارة الوقفية
- `rajhi.svg` — جامع الراجحي
- `qabas.svg` — جمعية قبس للقرآن والسنة والخطابة

لاستبدالها بالشعارات الرسمية، ضع الملفات الجديدة بنفس الأسماء والمسارات (يُفضّل SVG أو PNG شفاف). لا تحتاج إلى تعديل الكود.

---

## بنية المشروع

```
manara-halaqa/
├─ index.html                  نقطة الدخول
├─ css/styles.css              التصميم العربي RTL والطباعة
├─ js/config.js                إعدادات Supabase والوضع المحلي
├─ js/data.js                  الفئات والمستويات والبيانات التجريبية
├─ js/store.js                 طبقة البيانات: LocalStore + SupabaseStore
├─ js/ui.js                    الأيقونات والنوافذ والتنبيهات
├─ js/app.js                   الواجهات والتوجيه والنماذج
├─ assets/logos/               الشعارات
├─ supabase/schema.sql         مخطط قاعدة البيانات وRLS
├─ supabase/functions/admin-user/index.ts
├─ scripts/serve-local.ps1     خادم محلي بسيط
├─ scripts/deploy-github.ps1   نشر GitHub + Pages
├─ .env.example                نموذج أسرار النشر
└─ .gitignore                  يستبعد .env
```

---

## نموذج البيانات

| الجدول | الغرض |
|---|---|
| `profiles` | حسابات الطلاب والمعلمين والمديرين، مرتبطة بـ `auth.users` |
| `achievements` | الإنجازات، نقاطها، حالتها، وملاحظات المعلم |
| `evaluations` | تقييمات الطلاب حسب الفصل/الدورة |
| `announcements` | إعلانات الحلقة حسب الجمهور |
| `halaqa_settings` | بيانات الحلقة الظاهرة في الواجهة |

### الأمان في Supabase
- RLS مفعّل على كل الجداول.
- الطالب يرى إنجازاته وتقييماته فقط، ولا يستطيع اعتماد إنجاز أو تغيير دوره.
- المعلم يرى الطلاب والإنجازات والتقييمات ويستطيع الاعتماد والتقييم.
- المدير يدير الحسابات والإعلانات والإعدادات.
- الطلاب يستخدمون عرض `profiles_public` الذي لا يحتوي البريد أو الهاتف.
- `email_for_username` تسمح بتسجيل الدخول باسم المستخدم دون كشف قائمة المستخدمين.
- دالة `admin-user` تتحقق من أن المستدعي مدير قبل أي عملية إدارية.

---

## استكشاف الأخطاء

**الموقع يفتح لكن لا تظهر بيانات سحابية**
- تحقق من `supabaseUrl` و`supabaseAnonKey` في `js/config.js`.
- نفّذ `schema.sql` كاملًا.
- افتح Console في المتصفح واقرأ رسالة الخطأ.

**تعذر إنشاء/تعديل مستخدم في الوضع السحابي**
- تأكد من نشر دالة `admin-user`.
- تأكد أن حسابك الحالي `role = 'admin'` في جدول `profiles`.
- راجع **Edge Functions ← admin-user ← Logs** في Supabase.

**اسم المستخدم غير موجود عند تسجيل الدخول**
- تأكد أن `username` مملوء في `profiles` وأن الحساب `active = true`.
- تأكد من تنفيذ دالة `email_for_username`.

**رابط استعادة كلمة المرور لا يعمل**
- أضف رابط الموقع إلى `Site URL` و`Redirect URLs` في إعدادات Authentication.

**الموقع على GitHub Pages لا يظهر**
- انتظر دقيقة أو دقيقتين بعد أول نشر.
- تحقق من **Settings ← Pages** أن المصدر هو الفرع الصحيح والمجلد `/ (root)`.

---

## ملاحظات مهمة

- النسخة المحلية مناسبة للتجربة والاستخدام على جهاز واحد؛ البيانات لا تتزامن بين الأجهزة.
- النسخة السحابية هي المناسبة للاستخدام الفعلي متعدد المستخدمين.
- لا تضع مفتاح `service_role` أو رمز GitHub داخل ملفات الواجهة أو المستودع.
- ملف `.env` مخصص للنشر المحلي فقط، ومستبعد من الرفع.

---

© 2026 منارة الحلقة — جامع الراجحي، بإشراف جمعية قبس للقرآن والسنة والخطابة.
