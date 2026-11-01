/* بيانات الحلقة والثوابت والبيانات التجريبية */
(function () {
  'use strict';

  const categories = {
    memorization: { label: 'حفظ القرآن', short: 'حفظ', icon: 'book', tone: 'emerald' },
    recitation: { label: 'التلاوة والتجويد', short: 'تلاوة', icon: 'mic', tone: 'teal' },
    sunnah: { label: 'السنة والحديث', short: 'سنة', icon: 'scroll', tone: 'amber' },
    oratory: { label: 'الخطابة والإلقاء', short: 'خطابة', icon: 'megaphone', tone: 'rose' },
    behavior: { label: 'السلوك والانتظام', short: 'سلوك', icon: 'heart', tone: 'blue' },
    participation: { label: 'المشاركة والمبادرة', short: 'مشاركة', icon: 'sparkles', tone: 'violet' },
    project: { label: 'مشروع أو بحث', short: 'مشروع', icon: 'lamp', tone: 'gold' }
  };

  const roles = {
    student: { label: 'طالب', icon: 'graduation', tone: 'emerald' },
    teacher: { label: 'معلم', icon: 'book', tone: 'gold' },
    admin: { label: 'مدير', icon: 'shield', tone: 'blue' }
  };

  const statuses = {
    pending: { label: 'بانتظار الاعتماد', tone: 'warning' },
    approved: { label: 'معتمد', tone: 'success' },
    rejected: { label: 'مُعاد للمراجعة', tone: 'danger' }
  };

  const terms = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني', 'الفصل الدراسي الثالث', 'الدورة الصيفية'];

  const levels = [
    { min: 0, name: 'مبتدئ', icon: 'sparkles', next: 100 },
    { min: 100, name: 'متقدّم', icon: 'trending', next: 250 },
    { min: 250, name: 'متميّز', icon: 'award', next: 500 },
    { min: 500, name: 'منارة', icon: 'trophy', next: null }
  ];

  const audiences = {
    all: 'الجميع',
    students: 'الطلاب',
    teachers: 'المعلمون'
  };

  function isoDaysAgo(days) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - days);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function isoHoursAgo(hours) {
    const d = new Date();
    d.setHours(d.getHours() - hours);
    return d.toISOString();
  }

  const seed = {
    version: 1,
    settings: {
      name: 'حلقة المنارة المتقدمة',
      mosque: 'حلقات جامع الراجحي',
      association: 'جمعية قبس للقرآن والسنة والخطابة',
      supervisor: 'الشيخ د. عبدالله بن محمد العمري',
      teacher: 'الأستاذ محمد بن عبدالله العمري',
      year: '١٤٤٨هـ — 2026م',
      schedule: 'السبت والأحد والثلاثاء بعد صلاة العصر',
      location: 'حلقات جامع الراجحي — القاعة الشرقية',
      description: 'حلقة متقدمة لطلاب حلقات جامع الراجحي تجمع بين حفظ القرآن الكريم وعلوم السنة والخطابة، بإشراف جمعية قبس للقرآن والسنة والخطابة. يتابع المعلمون إنجاز كل طالب ويسجّلون ملاحظاتهم وتقييماتهم في سجل رقمي واحد.'
    },
    users: [
      {
        id: 'u_admin', role: 'admin', fullName: 'عبدالرحمن بن سعد الحربي',
        username: 'admin', email: 'admin@manara.sa', phone: '0500000001',
        password: 'Admin@123', active: true, createdAt: isoHoursAgo(24 * 120)
      },
      {
        id: 'u_t1', role: 'teacher', fullName: 'محمد بن عبدالله العمري',
        username: 'ustadh', email: 'teacher@manara.sa', phone: '0500000002',
        password: 'Teacher@123', active: true, createdAt: isoHoursAgo(24 * 110)
      },
      {
        id: 'u_t2', role: 'teacher', fullName: 'سعد بن علي القحطاني',
        username: 'ustadh2', email: 'teacher2@manara.sa', phone: '0500000003',
        password: 'Teacher@123', active: true, createdAt: isoHoursAgo(24 * 100)
      },
      {
        id: 'u_s1', role: 'student', fullName: 'عبدالرحمن بن خالد الشهري',
        username: 'student', email: 'student@manara.sa', phone: '0500000011',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 95)
      },
      {
        id: 'u_s2', role: 'student', fullName: 'يوسف بن سعد الدوسري',
        username: 'student2', email: 'student2@manara.sa', phone: '0500000012',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 94)
      },
      {
        id: 'u_s3', role: 'student', fullName: 'معاذ بن إبراهيم العسيري',
        username: 'student3', email: 'student3@manara.sa', phone: '0500000013',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 92)
      },
      {
        id: 'u_s4', role: 'student', fullName: 'أنس بن فهد الزهراني',
        username: 'student4', email: 'student4@manara.sa', phone: '0500000014',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 88)
      },
      {
        id: 'u_s5', role: 'student', fullName: 'خالد بن عمر الغامدي',
        username: 'student5', email: 'student5@manara.sa', phone: '0500000015',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 80)
      },
      {
        id: 'u_s6', role: 'student', fullName: 'بدر بن ناصر الشمري',
        username: 'student6', email: 'student6@manara.sa', phone: '0500000016',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 72)
      },
      {
        id: 'u_s7', role: 'student', fullName: 'تميم بن عبدالعزيز المالكي',
        username: 'student7', email: 'student7@manara.sa', phone: '0500000017',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 60)
      },
      {
        id: 'u_s8', role: 'student', fullName: 'سلمان بن أحمد القرني',
        username: 'student8', email: 'student8@manara.sa', phone: '0500000018',
        password: 'Student@123', active: true, createdAt: isoHoursAgo(24 * 45)
      }
    ],
    achievements: [
      { id: 'a01', studentId: 'u_s1', teacherId: 'u_t1', title: 'إتمام حفظ سورة الكهف كاملة', category: 'memorization', date: isoDaysAgo(1), points: 40, description: 'حفظ متقن مع مراجعة الآيات المتشابهات، واختبار سماعي أمام المعلم.', teacherNote: 'ما شاء الله، إتقان واضح. واصل مراجعة الآيات ٤٥–٥٥ أسبوعيًا.', status: 'approved', createdAt: isoHoursAgo(30) },
      { id: 'a02', studentId: 'u_s1', teacherId: 'u_t1', title: 'تلاوة سورة الملك بتجويد صحيح', category: 'recitation', date: isoDaysAgo(4), points: 25, description: 'تلاوة كاملة مع تطبيق أحكام المد والقلقلة.', teacherNote: 'أحكام المد ممتازة، وانتبه إلى مخارج حروف الإظهار.', status: 'approved', createdAt: isoHoursAgo(24 * 4) },
      { id: 'a03', studentId: 'u_s1', teacherId: null, title: 'تلخيص حديث «إنما الأعمال بالنيات»', category: 'sunnah', date: isoDaysAgo(2), points: 15, description: 'أضفت تلخيصًا للحديث مع ثلاثة فوائد عملية من شرح المعلم.', teacherNote: '', status: 'pending', createdAt: isoHoursAgo(20) },
      { id: 'a04', studentId: 'u_s1', teacherId: 'u_t2', title: 'مشاركة في مجلس الخطابة الأسبوعي', category: 'oratory', date: isoDaysAgo(9), points: 20, description: 'خطبة قصيرة عن بر الوالدين مدتها ثلاث دقائق أمام طلاب الحلقة.', teacherNote: 'أسلوب مؤثر وثقة جيدة، وعليك تقليل سرعة الكلام في المقدمة.', status: 'approved', createdAt: isoHoursAgo(24 * 9) },
      { id: 'a05', studentId: 'u_s1', teacherId: 'u_t1', title: 'الانتظام والحضور الكامل خلال الشهر', category: 'behavior', date: isoDaysAgo(14), points: 15, description: 'حضور جميع جلسات الحلقة في الوقت المحدد دون تأخر.', teacherNote: 'انتظامك قدوة لزملائك، بارك الله فيك.', status: 'approved', createdAt: isoHoursAgo(24 * 14) },

      { id: 'a06', studentId: 'u_s2', teacherId: 'u_t1', title: 'حفظ الجزء الثلاثين كاملًا', category: 'memorization', date: isoDaysAgo(2), points: 60, description: 'اختبار ختامي للجزء الثلاثين مع التلاوة غيبًا.', teacherNote: 'إنجاز كبير، نسأل الله أن يجعله في ميزان حسناتك. راجع المتشابهات كل خميس.', status: 'approved', createdAt: isoHoursAgo(24 * 2) },
      { id: 'a07', studentId: 'u_s2', teacherId: 'u_t2', title: 'بحث عن فضل طلب العلم', category: 'project', date: isoDaysAgo(7), points: 30, description: 'بحث من ثلاث صفحات جمع فيه أدلة من القرآن والسنة مع المصادر.', teacherNote: 'جهد مميز في التوثيق، وأضف خاتمة عملية في المرة القادمة.', status: 'approved', createdAt: isoHoursAgo(24 * 7) },
      { id: 'a08', studentId: 'u_s2', teacherId: 'u_t1', title: 'قيادة فريق ترتيب المصاحف', category: 'participation', date: isoDaysAgo(12), points: 20, description: 'تنظيم فريق من ثلاثة طلاب لترتيب المصاحف قبل الدرس.', teacherNote: 'روح المبادرة واضحة، جزاك الله خيرًا.', status: 'approved', createdAt: isoHoursAgo(24 * 12) },
      { id: 'a09', studentId: 'u_s2', teacherId: null, title: 'إتمام قراءة كتاب «مدارج السالكين»', category: 'project', date: isoDaysAgo(3), points: 25, description: 'قراءة مختارات من الكتاب وتدوين خمس فوائد.', teacherNote: '', status: 'pending', createdAt: isoHoursAgo(24 * 3) },

      { id: 'a10', studentId: 'u_s3', teacherId: 'u_t2', title: 'حفظ سورة يس مع المراجعة', category: 'memorization', date: isoDaysAgo(3), points: 35, description: 'حفظ السورة كاملة مع ضبط الوقفات.', teacherNote: 'حفظ جيد، وستكون المراجعة اليومية كفيلة بتثبيته.', status: 'approved', createdAt: isoHoursAgo(24 * 3) },
      { id: 'a11', studentId: 'u_s3', teacherId: 'u_t1', title: 'تطبيق أحكام النون الساكنة', category: 'recitation', date: isoDaysAgo(8), points: 20, description: 'اختبار عملي في أحكام الإظهار والإدغام والإقلاب والإخفاء.', teacherNote: 'ممتاز، مع ملاحظة تطبيق الإخفاء في مواضعه.', status: 'approved', createdAt: isoHoursAgo(24 * 8) },
      { id: 'a12', studentId: 'u_s3', teacherId: 'u_t2', title: 'إلقاء كلمة عن صلة الأرحام', category: 'oratory', date: isoDaysAgo(16), points: 20, description: 'كلمة قصيرة في مجلس الحلقة بحضور المعلمين.', teacherNote: 'بدأت قويًا، وتدرّب على النظر إلى الجمهور.', status: 'approved', createdAt: isoHoursAgo(24 * 16) },

      { id: 'a13', studentId: 'u_s4', teacherId: 'u_t1', title: 'حفظ الأربعين النووية — عشرة أحاديث', category: 'sunnah', date: isoDaysAgo(5), points: 30, description: 'حفظ عشرة أحاديث مع شرح معاني الكلمات.', teacherNote: 'ما شاء الله، احرص على مراجعة الشرح مع الحفظ.', status: 'approved', createdAt: isoHoursAgo(24 * 5) },
      { id: 'a14', studentId: 'u_s4', teacherId: 'u_t2', title: 'مبادرة «مصحف للزائر»', category: 'participation', date: isoDaysAgo(11), points: 25, description: 'اقتراح وتنفيذ رف مصاحف للزوار في مدخل القاعة.', teacherNote: 'فكرة نافعة، ننتظر استمرارها وتقييم أثرها.', status: 'approved', createdAt: isoHoursAgo(24 * 11) },
      { id: 'a15', studentId: 'u_s4', teacherId: null, title: 'تسجيل تلاوة سورة الرحمن', category: 'recitation', date: isoDaysAgo(1), points: 15, description: 'سجلت تلاوة للمراجعة وأرسلتها للمعلم.', teacherNote: '', status: 'pending', createdAt: isoHoursAgo(18) },

      { id: 'a16', studentId: 'u_s5', teacherId: 'u_t1', title: 'إتمام حفظ سورة مريم', category: 'memorization', date: isoDaysAgo(6), points: 35, description: 'حفظ ومراجعة مع اختبار في الآيات الأولى.', teacherNote: 'أداء ثابت، وواصل المراجعة الأسبوعية.', status: 'approved', createdAt: isoHoursAgo(24 * 6) },
      { id: 'a17', studentId: 'u_s5', teacherId: 'u_t2', title: 'ضبط مخارج الحروف', category: 'recitation', date: isoDaysAgo(13), points: 20, description: 'تدريب عملي على مخارج الحروف مع تصحيح فردي.', teacherNote: 'تحسن ملحوظ في حرف الضاد، استمر في التدريب.', status: 'approved', createdAt: isoHoursAgo(24 * 13) },
      { id: 'a18', studentId: 'u_s5', teacherId: 'u_t1', title: 'مساعدة زملائه في المراجعة', category: 'behavior', date: isoDaysAgo(21), points: 15, description: 'خصص وقتًا لمراجعة الحفظ مع طالبين من المستوى الأدنى.', teacherNote: 'بارك الله فيك، التعليم يثبت العلم.', status: 'approved', createdAt: isoHoursAgo(24 * 21) },

      { id: 'a19', studentId: 'u_s6', teacherId: 'u_t2', title: 'خطبة الجمعة المصغرة — آداب المسجد', category: 'oratory', date: isoDaysAgo(4), points: 30, description: 'إلقاء خطبة قصيرة أمام المعلمين والطلاب.', teacherNote: 'بناء ممتاز، واهتم بالوقفة المناسبة بين الفقرات.', status: 'approved', createdAt: isoHoursAgo(24 * 4) },
      { id: 'a20', studentId: 'u_s6', teacherId: 'u_t1', title: 'حفظ سورة الحجرات', category: 'memorization', date: isoDaysAgo(10), points: 30, description: 'حفظ السورة مع فهم معاني الآداب الواردة فيها.', teacherNote: 'ربط الآيات بآداب التعامل فكرة رائعة.', status: 'approved', createdAt: isoHoursAgo(24 * 10) },
      { id: 'a21', studentId: 'u_s6', teacherId: 'u_t2', title: 'بحث عن آداب الخطابة', category: 'project', date: isoDaysAgo(19), points: 25, description: 'جمع آداب الخطابة من السنة وتجارب الخطباء.', teacherNote: 'مادة جيدة، وتحتاج ترتيب المصادر في قائمة موحدة.', status: 'approved', createdAt: isoHoursAgo(24 * 19) },

      { id: 'a22', studentId: 'u_s7', teacherId: 'u_t1', title: 'حفظ جزء تبارك', category: 'memorization', date: isoDaysAgo(7), points: 45, description: 'حفظ جزء تبارك كاملًا مع اختبار ختامي.', teacherNote: 'إنجاز يستحق الاحتفاء، راجع من أول الجزء كل أسبوع.', status: 'approved', createdAt: isoHoursAgo(24 * 7) },
      { id: 'a23', studentId: 'u_s7', teacherId: 'u_t2', title: 'مشاركة في تنظيم مسابقة الحفظ', category: 'participation', date: isoDaysAgo(15), points: 20, description: 'ساعد في تنظيم مسابقة الحفظ الداخلية وتوزيع المهام.', teacherNote: 'تنظيم دقيق وتعاون مثمر.', status: 'approved', createdAt: isoHoursAgo(24 * 15) },

      { id: 'a24', studentId: 'u_s8', teacherId: 'u_t1', title: 'بداية حفظ جزء عمّ', category: 'memorization', date: isoDaysAgo(2), points: 20, description: 'حفظ سور النبأ والنازعات والتكوير.', teacherNote: 'بداية موفقة، ثبّت الحفظ بالمراجعة اليومية.', status: 'approved', createdAt: isoHoursAgo(24 * 2) },
      { id: 'a25', studentId: 'u_s8', teacherId: 'u_t2', title: 'قراءة حديث «الدين النصيحة»', category: 'sunnah', date: isoDaysAgo(9), points: 15, description: 'قراءة الحديث وشرح معانيه مع أمثلة تطبيقية.', teacherNote: 'شرح واضح، وفقك الله.', status: 'approved', createdAt: isoHoursAgo(24 * 9) }
    ],
    evaluations: [
      { id: 'e01', studentId: 'u_s1', teacherId: 'u_t1', term: 'الفصل الدراسي الأول', score: 94, notes: 'طالب مجتهد ومنتظم، حفظه متين ومشاركته فعّالة. نوصي بإشراكه في مجلس الخطابة القادم.', date: isoDaysAgo(5), createdAt: isoHoursAgo(24 * 5) },
      { id: 'e02', studentId: 'u_s2', teacherId: 'u_t1', term: 'الفصل الدراسي الأول', score: 91, notes: 'إنجاز مميز في الحفظ، ويحتاج إلى مزيد من التدريب على الإلقاء والتعبير.', date: isoDaysAgo(6), createdAt: isoHoursAgo(24 * 6) },
      { id: 'e03', studentId: 'u_s3', teacherId: 'u_t2', term: 'الفصل الدراسي الأول', score: 86, notes: 'تحسن واضح في التجويد، وننصح بمراجعة يومية قصيرة لتثبيت المحفوظ.', date: isoDaysAgo(8), createdAt: isoHoursAgo(24 * 8) },
      { id: 'e04', studentId: 'u_s4', teacherId: 'u_t1', term: 'الفصل الدراسي الأول', score: 89, notes: 'طالب مبادر ومتعاون، حفظه جيد ويحتاج إلى انتظام أكبر في المراجعة.', date: isoDaysAgo(9), createdAt: isoHoursAgo(24 * 9) },
      { id: 'e05', studentId: 'u_s5', teacherId: 'u_t2', term: 'الفصل الدراسي الأول', score: 83, notes: 'أداء ثابت، ونوصي بالتركيز على مخارج الحروف والتدرب على التلاوة الجهرية.', date: isoDaysAgo(12), createdAt: isoHoursAgo(24 * 12) },
      { id: 'e06', studentId: 'u_s6', teacherId: 'u_t2', term: 'الفصل الدراسي الأول', score: 88, notes: 'قدرة جيدة على الإلقاء، ويحتاج إلى تنظيم الوقت بين الحفظ والمراجعة.', date: isoDaysAgo(11), createdAt: isoHoursAgo(24 * 11) },
      { id: 'e07', studentId: 'u_s7', teacherId: 'u_t1', term: 'الفصل الدراسي الأول', score: 96, notes: 'من أبرز طلاب الحلقة في الحفظ والانتظام، نوصي بترشيحه لمسابقة المنطقة.', date: isoDaysAgo(4), createdAt: isoHoursAgo(24 * 4) },
      { id: 'e08', studentId: 'u_s8', teacherId: 'u_t1', term: 'الفصل الدراسي الأول', score: 79, notes: 'بداية جيدة، ونحتاج إلى متابعة أسبوعية مع ولي الأمر لتثبيت الحفظ.', date: isoDaysAgo(3), createdAt: isoHoursAgo(24 * 3) }
    ],
    announcements: [
      { id: 'n01', title: 'انطلاق مسابقة الحفظ الداخلية', body: 'تبدأ مسابقة الحفظ الداخلية يوم السبت القادم بعد صلاة العصر. على الراغبين في المشاركة تسجيل أسمائهم لدى المعلم قبل يوم الخميس.', audience: 'all', createdBy: 'u_admin', createdAt: isoHoursAgo(8) },
      { id: 'n02', title: 'مجلس الخطابة الأسبوعي', body: 'يقام مجلس الخطابة كل يوم أحد بعد الدرس. مدة المشاركة ثلاث دقائق، والموضوع هذا الأسبوع: «أثر العلم في حياة المسلم».', audience: 'students', createdBy: 'u_t1', createdAt: isoHoursAgo(30) },
      { id: 'n03', title: 'تذكير بتسجيل الإنجازات', body: 'على الطلاب تسجيل إنجازات الأسبوع قبل يوم الخميس، حتى يتمكن المعلمون من اعتمادها وإضافة الملاحظات.', audience: 'students', createdBy: 'u_admin', createdAt: isoHoursAgo(24 * 2) },
      { id: 'n04', title: 'اجتماع المعلمين الشهري', body: 'اجتماع المعلمين يوم الثلاثاء بعد صلاة المغرب في غرفة الاجتماعات، لمناقشة مستويات الطلاب وخطة الشهر القادم.', audience: 'teachers', createdBy: 'u_admin', createdAt: isoHoursAgo(24 * 3) }
    ]
  };

  const demoAccounts = [
    { role: 'admin', label: 'مدير الحلقة', username: 'admin', password: 'Admin@123' },
    { role: 'teacher', label: 'معلم', username: 'ustadh', password: 'Teacher@123' },
    { role: 'student', label: 'طالب', username: 'student', password: 'Student@123' }
  ];

  window.MANARA_DATA = {
    categories: categories,
    roles: roles,
    statuses: statuses,
    terms: terms,
    levels: levels,
    audiences: audiences,
    seed: seed,
    demoAccounts: demoAccounts,
    categoryList: Object.keys(categories).map(function (key) {
      return { key: key, label: categories[key].label, icon: categories[key].icon, tone: categories[key].tone };
    })
  };
})();
