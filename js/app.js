/* ============================================================
   منارة الحلقة — تطبيق سجل إنجاز الطلاب
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const DATA = window.MANARA_DATA;
  const CFG = window.MANARA_CONFIG;
  const Store = window.ManaraStore;
  const icon = UI.icon;
  const esc = UI.esc;

  const state = {
    store: null,
    me: null,
    settings: {},
    directory: [],
    achievements: [],
    evaluations: [],
    announcements: [],
    leaderboard: [],
    route: { name: 'dashboard', id: null, query: new URLSearchParams() },
    filters: {
      achievements: { q: '', status: 'all', category: 'all', student: 'all' },
      users: { q: '', role: 'all' },
      students: { q: '' },
      evaluations: { q: '', student: 'all' }
    },
    fatal: null
  };

  let refreshTimer = 0;

  /* ==========================================================
     أدوات مساعدة
     ========================================================== */
  function userById(id) {
    if (!id) return null;
    if (state.me && state.me.id === id) return state.me;
    return state.directory.find(function (u) { return u.id === id; }) || null;
  }
  function nameOf(id) {
    const user = userById(id);
    return user ? user.fullName : 'حساب غير متاح';
  }
  function isStaff() { return state.me && (state.me.role === 'teacher' || state.me.role === 'admin'); }
  function isAdmin() { return state.me && state.me.role === 'admin'; }
  function students() { return state.directory.filter(function (u) { return u.role === 'student'; }); }
  function pendingAchievements() { return state.achievements.filter(function (a) { return a.status === 'pending'; }); }
  function achievementsFor(id) { return state.achievements.filter(function (a) { return a.studentId === id; }); }
  function evaluationsFor(id) { return state.evaluations.filter(function (e) { return e.studentId === id; }); }
  function approvedFor(id) { return achievementsFor(id).filter(function (a) { return a.status === 'approved'; }); }

  function statsFor(id) {
    const all = achievementsFor(id);
    const approved = all.filter(function (a) { return a.status === 'approved'; });
    const pending = all.filter(function (a) { return a.status === 'pending'; });
    const evals = evaluationsFor(id);
    const points = approved.reduce(function (sum, a) { return sum + (Number(a.points) || 0); }, 0);
    const average = evals.length
      ? Math.round(evals.reduce(function (sum, e) { return sum + (Number(e.score) || 0); }, 0) / evals.length)
      : null;
    return { all: all, approved: approved, pending: pending, points: points, average: average, evaluations: evals };
  }

  function rankFor(id) {
    return state.leaderboard.find(function (row) { return row.userId === id; }) || null;
  }

  function rankLabel(rank) {
    const labels = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس' };
    if (!rank) return '—';
    return 'المركز ' + (labels[rank] || UI.fmtNum(rank));
  }

  function latestEvaluation(id) {
    const list = evaluationsFor(id).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return list[0] || null;
  }

  function teacherNotesFor(id) {
    return achievementsFor(id)
      .filter(function (a) { return a.teacherNote; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const pieces = raw.split('?');
    const parts = pieces[0].split('/').filter(Boolean);
    return {
      name: parts[0] || 'dashboard',
      id: parts[1] || null,
      query: new URLSearchParams(pieces[1] || '')
    };
  }

  function navigate(hash) {
    if (location.hash === hash) {
      state.route = parseRoute();
      renderShell();
    } else {
      location.hash = hash;
    }
  }

  function routeMeta(route) {
    const titles = {
      dashboard: { title: 'نظرة عامة', subtitle: 'ملخص رحلتك في الحلقة' },
      achievements: { title: state.me && state.me.role === 'student' ? 'إنجازاتي' : 'سجل الإنجازات', subtitle: 'كل خطوة محفوظة وموثّقة' },
      evaluations: { title: 'التقييمات', subtitle: 'مستواك وتقدّمك مع ملاحظات المعلمين' },
      students: { title: 'طلاب الحلقة', subtitle: 'متابعة المستويات والإنجازات' },
      approvals: { title: 'بانتظار الاعتماد', subtitle: 'إنجازات أرسلها الطلاب وتنتظر مراجعتك' },
      users: { title: 'المستخدمون', subtitle: 'إدارة حسابات الطلاب والمعلمين' },
      announcements: { title: 'إعلانات الحلقة', subtitle: 'آخر الأخبار والتنبيهات' },
      settings: { title: 'إعدادات الحلقة', subtitle: 'بيانات الحلقة والنسخ الاحتياطي' },
      profile: { title: 'ملفي الشخصي', subtitle: 'بياناتك وكلمة المرور' }
    };
    if (route.name === 'students' && route.id) {
      const student = userById(route.id);
      return { title: student ? student.fullName : 'سجل الطالب', subtitle: 'السجل الكامل للإنجازات والتقييمات' };
    }
    return titles[route.name] || titles.dashboard;
  }

  function allowedRoutes(role) {
    if (role === 'student') return ['dashboard', 'achievements', 'evaluations', 'announcements', 'profile'];
    if (role === 'teacher') return ['dashboard', 'students', 'approvals', 'achievements', 'evaluations', 'announcements', 'profile'];
    return ['dashboard', 'students', 'approvals', 'achievements', 'evaluations', 'users', 'announcements', 'settings', 'profile'];
  }

  function logoStrip(mode) {
    const cls = mode === 'mini' ? ' logo-strip-mini' : mode === 'auth' ? ' logo-strip-auth' : '';
    return '<div class="logo-strip' + cls + '">' +
      '<div class="logo-item"><img src="./assets/logos/manara.svg" alt="شعار المنارة الوقفية"><span>المنارة الوقفية</span></div>' +
      '<div class="logo-item"><img src="./assets/logos/rajhi.svg" alt="شعار جامع الراجحي"><span>جامع الراجحي</span></div>' +
      '<div class="logo-item"><img src="./assets/logos/qabas.svg" alt="شعار جمعية قبس"><span>قبس للقرآن والسنة والخطابة</span></div>' +
      '</div>';
  }

  function brand(size) {
    return '<a class="brand" href="#/dashboard" aria-label="منارة الحلقة — الرئيسية">' +
      '<img class="brand-logo" src="./assets/logos/manara.svg" alt="" width="' + (size || 46) + '" height="' + (size || 46) + '">' +
      '<span class="brand-text"><strong>منارة الحلقة</strong><small>المنارة المتقدمة · جامع الراجحي</small></span>' +
      '</a>';
  }

  function markAnnouncementsRead() {
    try {
      localStorage.setItem(CFG.local.readAnnouncementsKey, JSON.stringify(state.announcements.map(function (n) { return n.id; })));
    } catch (err) { /* تجاهل */ }
  }

  function unreadAnnouncements() {
    try {
      const raw = localStorage.getItem(CFG.local.readAnnouncementsKey);
      const read = raw ? JSON.parse(raw) : [];
      return state.announcements.filter(function (n) { return !read.includes(n.id); }).length;
    } catch (err) {
      return 0;
    }
  }

  /* ==========================================================
     التهيئة والتحديث
     ========================================================== */
  async function boot() {
    state.fatal = null;
    try {
      state.store = await Store.createStore();
      state.me = await state.store.getSession();
      if (state.me) await refreshData();
      render();
      if (state.store && typeof state.store.subscribe === 'function') {
        state.store.subscribe(function () {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(async function () {
            if (!state.me) return;
            try {
              await refreshData();
              renderShell();
            } catch (err) {
              /* يتم التعامل مع أخطاء الجلسة عند الطلب التالي */
            }
          }, 400);
        });
      }
    } catch (error) {
      state.fatal = error;
      renderFatal(error);
    }
  }

  async function refreshData() {
    if (!state.me) return;
    state.settings = await state.store.getSettings();
    state.directory = await state.store.listUsers();
    state.achievements = await state.store.listAchievements();
    state.evaluations = await state.store.listEvaluations();
    state.announcements = await state.store.listAnnouncements();
    try {
      state.leaderboard = await state.store.getLeaderboard();
    } catch (err) {
      state.leaderboard = [];
    }
  }

  async function commit(message) {
    try {
      await refreshData();
      renderShell();
      if (message) UI.toast(message, 'success');
    } catch (error) {
      UI.toast(error.message || 'تعذر تحديث البيانات.', 'error');
    }
  }

  function render() {
    if (state.fatal) renderFatal(state.fatal);
    else if (!state.me) renderAuth();
    else renderShell();
  }

  function renderFatal(error) {
    document.title = 'تعذر تشغيل منارة الحلقة';
    const app = document.getElementById('app');
    app.innerHTML = '<div class="fatal-screen">' +
      '<img src="./assets/logos/manara.svg" alt="" width="76" height="76">' +
      '<span class="eyebrow">منارة الحلقة</span>' +
      '<h1>تعذّر تشغيل السجل</h1>' +
      '<p>' + esc(error && error.message ? error.message : 'حدث خطأ غير متوقع أثناء تهيئة التطبيق.') + '</p>' +
      '<div class="fatal-actions">' +
      '<button type="button" class="btn btn-primary" data-action="retry-boot">' + icon('refresh', 18) + ' إعادة المحاولة</button>' +
      '<button type="button" class="btn btn-outline" data-action="use-local">' + icon('hard-drive', 18) + ' استخدام النسخة المحلية</button>' +
      '</div>' +
      '<p class="fatal-note">إذا استمرت المشكلة، افتح وحدة التحكم في المتصفح وتحقق من إعدادات Supabase في <code>js/config.js</code>.</p>' +
      '</div>';
  }

  /* ==========================================================
     صفحة الدخول
     ========================================================== */
  function renderAuth() {
    document.title = 'تسجيل الدخول | منارة الحلقة';
    const mode = state.store ? state.store.mode : 'local';
    const cloudWarning = state.store && state.store.cloudError
      ? '<div class="inline-alert warning">' + icon('alert', 18) + '<div><strong>تعذر الاتصال بالسحابة</strong><p>تم تشغيل النسخة المحلية مؤقتًا. راجع إعدادات Supabase في <code>js/config.js</code>.</p></div></div>'
      : '';
    const demo = DATA.demoAccounts.map(function (account) {
      return '<button type="button" class="demo-chip" data-action="fill-demo" data-username="' + esc(account.username) + '" data-password="' + esc(account.password) + '">' +
        '<span class="demo-role">' + esc(account.label) + '</span>' +
        '<span class="demo-user" dir="ltr">' + esc(account.username) + '</span>' +
        '<span class="demo-pass" dir="ltr">' + esc(account.password) + '</span>' +
        '</button>';
    }).join('');

    document.getElementById('app').innerHTML = '<div class="auth-page">' +
      '<section class="auth-visual">' +
      '<div class="auth-pattern" aria-hidden="true"></div>' +
      '<div class="auth-orbit orbit-a" aria-hidden="true"></div>' +
      '<div class="auth-orbit orbit-b" aria-hidden="true"></div>' +
      '<div class="auth-visual-head">' +
      '<div class="auth-brand">' +
      '<img src="./assets/logos/manara.svg" alt="المنارة الوقفية" width="54" height="54">' +
      '<div><span>المنارة المتقدمة</span><strong>منارة الحلقة</strong></div>' +
      '</div>' +
      '<span class="pill pill-gold">' + icon('book-open', 15) + ' سجل الإنجاز</span>' +
      '</div>' +
      '<div class="auth-copy">' +
      '<span class="eyebrow light">حلقة جامع الراجحي · بإشراف جمعية قبس</span>' +
      '<h1>كل إنجاز<br><em>يستحق أن يروى.</em></h1>' +
      '<p>سجلٌ رقميٌّ يجمع إنجازات طلاب حلقة المنارة المتقدمة، وتقييمات معلميهم وملاحظاتهم، في مكانٍ واحدٍ يسهل الرجوع إليه.</p>' +
      '<div class="verse-card">' +
      '<span class="verse-mark">﴿</span>' +
      '<p>وَقُل رَّبِّ زِدْنِي عِلْمًا</p>' +
      '<span class="verse-mark">﴾</span>' +
      '</div>' +
      '</div>' +
      '<div class="auth-visual-foot">' +
      logoStrip('auth') +
      '<div class="auth-meta"><span>' + icon('calendar', 15) + ' ' + esc(state.settings && state.settings.year ? state.settings.year : 'العام الدراسي ١٤٤٨هـ') + '</span><span>' + icon('mosque', 15) + ' ' + esc(state.settings && state.settings.mosque ? state.settings.mosque : 'جامع الراجحي') + '</span></div>' +
      '</div>' +
      '</section>' +
      '<section class="auth-panel">' +
      '<div class="auth-card">' +
      '<div class="auth-card-head">' +
      '<span class="eyebrow">مرحبًا بعودتك</span>' +
      '<h2>تسجيل الدخول</h2>' +
      '<p>ادخل باسم المستخدم أو البريد الإلكتروني للمتابعة إلى سجلك.</p>' +
      '</div>' +
      cloudWarning +
      '<form id="login-form" data-form="login" novalidate>' +
      '<div class="form-alert" id="login-alert" role="alert" hidden></div>' +
      '<label class="field">' +
      '<span class="field-label">اسم المستخدم أو البريد الإلكتروني</span>' +
      '<span class="input-wrap">' + icon('user', 18) + '<input type="text" name="identifier" id="login-identifier" autocomplete="username" placeholder="مثال: student أو student@manara.sa" required></span>' +
      '</label>' +
      '<label class="field">' +
      '<span class="field-label">كلمة المرور</span>' +
      '<span class="input-wrap">' + icon('lock', 18) + '<input type="password" name="password" id="login-password" autocomplete="current-password" placeholder="••••••••" required>' +
      '<button type="button" class="input-action" data-action="toggle-password" data-target="login-password" aria-label="إظهار كلمة المرور">' + icon('eye', 18) + '</button></span>' +
      '</label>' +
      '<div class="form-row between">' +
      '<label class="check"><input type="checkbox" name="remember" checked><span>تذكرني على هذا الجهاز</span></label>' +
      '<button type="button" class="link-btn" data-action="forgot-password">نسيت كلمة المرور؟</button>' +
      '</div>' +
      '<button type="submit" class="btn btn-primary btn-block">' + icon('logout', 18) + ' دخول إلى السجل</button>' +
      '</form>' +
      '<div class="demo-box">' +
      '<div class="demo-head"><span>' + icon('sparkles', 16) + ' حسابات تجريبية جاهزة</span><small>اضغط للتعبئة</small></div>' +
      '<div class="demo-grid">' + demo + '</div>' +
      '<p class="demo-note">' + (mode === 'local' ? 'النسخة المحلية: البيانات محفوظة في هذا المتصفح فقط.' : 'النسخة السحابية: متصلة بقاعدة بيانات Supabase.') + '</p>' +
      '</div>' +
      '<div class="auth-card-foot">' +
      '<span class="mode-pill mode-' + mode + '">' + icon(mode === 'supabase' ? 'cloud' : 'hard-drive', 14) + (mode === 'supabase' ? ' نسخة سحابية' : ' نسخة محلية') + '</span>' +
      '<button type="button" class="link-btn" data-action="open-about">عن الحلقة وسياسة البيانات</button>' +
      '</div>' +
      '</div>' +
      '<p class="auth-copyright">© ' + new Date().getFullYear() + ' منارة الحلقة · جامع الراجحي — بإشراف جمعية قبس للقرآن والسنة والخطابة</p>' +
      '</section>' +
      '</div>';
  }

  /* ==========================================================
     هيكل التطبيق
     ========================================================== */
  function navItems() {
    if (state.me.role === 'student') {
      return [
        { section: 'مساحتي' },
        { route: 'dashboard', label: 'نظرة عامة', icon: 'dashboard' },
        { route: 'achievements', label: 'إنجازاتي', icon: 'trophy' },
        { route: 'evaluations', label: 'تقييماتي', icon: 'star' },
        { section: 'الحلقة' },
        { route: 'announcements', label: 'الإعلانات', icon: 'bell' },
        { route: 'profile', label: 'ملفي', icon: 'user' }
      ];
    }
    if (state.me.role === 'teacher') {
      return [
        { section: 'المتابعة' },
        { route: 'dashboard', label: 'نظرة عامة', icon: 'dashboard' },
        { route: 'students', label: 'طلابي', icon: 'users' },
        { route: 'approvals', label: 'بانتظار الاعتماد', icon: 'clipboard', badge: pendingAchievements().length },
        { section: 'السجل' },
        { route: 'achievements', label: 'كل الإنجازات', icon: 'trophy' },
        { route: 'evaluations', label: 'التقييمات', icon: 'star' },
        { route: 'announcements', label: 'الإعلانات', icon: 'bell' },
        { route: 'profile', label: 'ملفي', icon: 'user' }
      ];
    }
    return [
      { section: 'الإدارة' },
      { route: 'dashboard', label: 'نظرة عامة', icon: 'dashboard' },
      { route: 'users', label: 'المستخدمون', icon: 'users' },
      { route: 'students', label: 'الطلاب', icon: 'graduation' },
      { route: 'approvals', label: 'بانتظار الاعتماد', icon: 'clipboard', badge: pendingAchievements().length },
      { section: 'السجل' },
      { route: 'achievements', label: 'كل الإنجازات', icon: 'trophy' },
      { route: 'evaluations', label: 'التقييمات', icon: 'star' },
      { route: 'announcements', label: 'الإعلانات', icon: 'bell' },
      { section: 'النظام' },
      { route: 'settings', label: 'إعدادات الحلقة', icon: 'settings' },
      { route: 'profile', label: 'ملفي', icon: 'user' }
    ];
  }

  function isActive(item, route) {
    if (item.route === route.name) return true;
    if (item.route === 'students' && route.name === 'students') return true;
    if (item.route === 'achievements' && route.name === 'achievements') return true;
    return false;
  }

  function renderShell() {
    const route = parseRoute();
    if (!allowedRoutes(state.me.role).includes(route.name)) {
      location.hash = '#/dashboard';
      return;
    }
    state.route = route;
    const meta = routeMeta(route);
    if (route.name === 'announcements') markAnnouncementsRead();
    const unread = route.name === 'announcements' ? 0 : unreadAnnouncements();
    const mode = state.store.mode;
    const pending = pendingAchievements().length;

    document.title = meta.title + ' | منارة الحلقة';

    const nav = navItems().map(function (item) {
      if (item.section) return '<span class="nav-section">' + esc(item.section) + '</span>';
      return '<a href="#/' + item.route + '" class="nav-item' + (isActive(item, route) ? ' active' : '') + '">' +
        icon(item.icon, 19) +
        '<span>' + esc(item.label) + '</span>' +
        (item.badge ? '<span class="nav-badge">' + UI.fmtNum(item.badge) + '</span>' : '') +
        '</a>';
    }).join('');

    document.getElementById('app').innerHTML = '<div class="shell">' +
      '<div class="sidebar-scrim" data-action="toggle-sidebar"></div>' +
      '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-head">' +
      brand(44) +
      '<button type="button" class="icon-btn sidebar-close" data-action="toggle-sidebar" aria-label="إغلاق القائمة">' + icon('x', 20) + '</button>' +
      '</div>' +
      '<div class="halaqa-pill">' +
      '<span class="halaqa-dot">' + icon('mosque', 17) + '</span>' +
      '<div><strong>' + esc(state.settings.name || 'حلقة المنارة المتقدمة') + '</strong><span>' + esc(state.settings.mosque || 'جامع الراجحي') + ' · ' + esc(state.settings.year || '') + '</span></div>' +
      '</div>' +
      '<nav class="side-nav" aria-label="التنقل الرئيسي">' + nav + '</nav>' +
      '<div class="sidebar-bottom">' +
      logoStrip('mini') +
      '<div class="sidebar-user">' +
      UI.avatar(state.me, 'sm') +
      '<div class="sidebar-user-info"><strong>' + esc(state.me.fullName) + '</strong><span>' + esc(DATA.roles[state.me.role] ? DATA.roles[state.me.role].label : state.me.role) + ' · @' + esc(state.me.username) + '</span></div>' +
      '<button type="button" class="icon-btn" data-action="logout" title="تسجيل الخروج" aria-label="تسجيل الخروج">' + icon('logout', 18) + '</button>' +
      '</div>' +
      '</div>' +
      '</aside>' +
      '<main class="main">' +
      '<header class="topbar">' +
      '<div class="topbar-start">' +
      '<button type="button" class="icon-btn menu-btn" data-action="toggle-sidebar" aria-label="فتح القائمة">' + icon('menu', 21) + '</button>' +
      '<div class="page-title"><span class="eyebrow">' + esc(state.settings.name || 'منارة الحلقة') + '</span><h1>' + esc(meta.title) + '</h1><p>' + esc(meta.subtitle) + '</p></div>' +
      '</div>' +
      '<div class="topbar-actions">' +
      '<span class="mode-chip mode-' + mode + '" title="' + (mode === 'supabase' ? 'متصل بقاعدة بيانات Supabase' : 'البيانات محفوظة في هذا المتصفح') + '">' + icon(mode === 'supabase' ? 'cloud' : 'hard-drive', 14) + '<span>' + (mode === 'supabase' ? 'سحابي' : 'محلي') + '</span></span>' +
      '<button type="button" class="icon-btn bell-btn" data-action="open-announcements" aria-label="الإعلانات">' + icon('bell', 20) + (unread ? '<span class="bell-dot">' + UI.fmtNum(unread) + '</span>' : '') + '</button>' +
      '<a class="topbar-profile" href="#/profile" aria-label="ملفي الشخصي">' + UI.avatar(state.me, 'sm') + '<span>' + esc(UI.firstName(state.me.fullName)) + '</span></a>' +
      '</div>' +
      '</header>' +
      '<div class="content" id="view">' + renderRoute() + '</div>' +
      '<footer class="app-footer"><span>© ' + new Date().getFullYear() + ' منارة الحلقة · ' + esc(state.settings.mosque || 'جامع الراجحي') + '</span><span class="footer-sep">·</span><span>بإشراف ' + esc(state.settings.association || 'جمعية قبس للقرآن والسنة والخطابة') + '</span></footer>' +
      '</main>' +
      '</div>';
  }

  function renderView() {
    const view = document.getElementById('view');
    if (view) view.innerHTML = renderRoute();
  }

  function renderViewPreserveFocus() {
    const active = document.activeElement;
    const id = active && active.id;
    const start = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    renderView();
    if (id) {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        if (start !== null && typeof el.setSelectionRange === 'function') {
          try { el.setSelectionRange(start, start); } catch (err) { /* تجاهل */ }
        }
      }
    }
  }

  /* ==========================================================
     محتوى الصفحات
     ========================================================== */
  function renderRoute() {
    const route = state.route;
    switch (route.name) {
      case 'dashboard': return renderDashboard();
      case 'achievements': return renderAchievementsPage();
      case 'evaluations': return renderEvaluationsPage();
      case 'students': return route.id ? renderStudentDetail(route.id) : renderStudentsPage();
      case 'approvals': return renderApprovalsPage();
      case 'users': return renderUsersPage();
      case 'announcements': return renderAnnouncementsPage();
      case 'settings': return renderSettingsPage();
      case 'profile': return renderProfilePage();
      default: return renderDashboard();
    }
  }

  function statCard(options) {
    return '<article class="stat-card">' +
      '<span class="stat-icon tone-' + esc(options.tone || 'emerald') + '">' + icon(options.icon || 'star', 21) + '</span>' +
      '<div class="stat-body"><span>' + esc(options.label) + '</span><strong>' + options.value + '</strong>' + (options.note ? '<small>' + esc(options.note) + '</small>' : '') + '</div>' +
      '</article>';
  }

  function sectionHead(title, subtitle, action) {
    return '<div class="section-head"><div><h2>' + esc(title) + '</h2>' + (subtitle ? '<p>' + esc(subtitle) + '</p>' : '') + '</div>' + (action || '') + '</div>';
  }

  function achievementItem(a, options) {
    const opts = options || {};
    const student = userById(a.studentId);
    const teacher = userById(a.teacherId);
    const category = DATA.categories[a.category] || { label: a.category, icon: 'star', tone: 'muted' };
    const canStaff = isStaff();
    const canEdit = canStaff || (state.me.id === a.studentId && a.status === 'pending');
    let actions = '<button type="button" class="icon-btn" data-action="view-achievement" data-id="' + esc(a.id) + '" title="عرض التفاصيل" aria-label="عرض التفاصيل">' + icon('eye', 17) + '</button>';
    if (canEdit) actions += '<button type="button" class="icon-btn" data-action="edit-achievement" data-id="' + esc(a.id) + '" title="تعديل" aria-label="تعديل">' + icon('edit', 17) + '</button>';
    if (canStaff && a.status === 'pending') {
      actions = '<button type="button" class="btn btn-sm btn-success" data-action="review-achievement" data-id="' + esc(a.id) + '" data-status="approved">' + icon('check', 15) + ' اعتماد</button>' +
        '<button type="button" class="icon-btn danger" data-action="review-achievement" data-id="' + esc(a.id) + '" data-status="rejected" title="إعادة للمراجعة" aria-label="إعادة للمراجعة">' + icon('x', 17) + '</button>' + actions;
    }
    if (canStaff || (state.me.id === a.studentId && a.status === 'pending')) {
      actions += '<button type="button" class="icon-btn danger" data-action="delete-achievement" data-id="' + esc(a.id) + '" title="حذف" aria-label="حذف">' + icon('trash', 17) + '</button>';
    }

    return '<article class="achievement-item' + (opts.compact ? ' compact' : '') + '">' +
      '<span class="ach-icon tone-' + esc(category.tone) + '">' + icon(category.icon, 20) + '</span>' +
      '<div class="ach-main">' +
      '<div class="ach-title-row"><h3>' + esc(a.title) + '</h3>' + UI.statusBadge(a.status) + '</div>' +
      '<div class="ach-meta">' +
      (opts.showStudent && student ? '<span class="meta-strong">' + icon('user', 14) + ' ' + esc(student.fullName) + '</span>' : '') +
      '<span>' + icon(category.icon, 14) + ' ' + esc(category.label) + '</span>' +
      '<span>' + icon('calendar', 14) + ' ' + UI.fmtDate(a.date, true) + '</span>' +
      '<span class="points-chip">' + icon('star', 14) + ' ' + UI.fmtNum(a.points) + ' نقطة</span>' +
      '</div>' +
      (a.description && !opts.compact ? '<p class="ach-desc">' + esc(a.description) + '</p>' : '') +
      (a.teacherNote ? '<div class="teacher-note">' + icon('message', 15) + '<div><strong>ملاحظة المعلم' + (teacher ? ' · ' + esc(teacher.fullName) : '') + '</strong><p>' + esc(a.teacherNote) + '</p></div></div>' : '') +
      '</div>' +
      (opts.compact ? '' : '<div class="ach-actions">' + actions + '</div>') +
      '</article>';
  }

  function evaluationCard(e, options) {
    const opts = options || {};
    const grade = UI.gradeFor(e.score);
    const teacher = userById(e.teacherId);
    const student = userById(e.studentId);
    let actions = '';
    if (isStaff()) {
      actions = '<div class="eval-actions">' +
        '<button type="button" class="icon-btn" data-action="edit-evaluation" data-id="' + esc(e.id) + '" title="تعديل" aria-label="تعديل">' + icon('edit', 17) + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-evaluation" data-id="' + esc(e.id) + '" title="حذف" aria-label="حذف">' + icon('trash', 17) + '</button>' +
        '</div>';
    }
    return '<article class="evaluation-item">' +
      '<div class="score-badge tone-' + grade.tone + '"><strong>' + UI.fmtNum(e.score) + '</strong><span>من ١٠٠</span></div>' +
      '<div class="eval-main">' +
      '<div class="eval-head"><div><h3>' + esc(e.term) + '</h3>' +
      (opts.showStudent && student ? '<span class="eval-student">' + esc(student.fullName) + '</span>' : '') +
      '</div><span class="badge badge-' + grade.tone + '">' + esc(grade.label) + '</span></div>' +
      (e.notes ? '<p>' + esc(e.notes) + '</p>' : '<p class="muted">لا توجد ملاحظات مرفقة.</p>') +
      '<div class="eval-meta"><span>' + icon('calendar', 14) + ' ' + UI.fmtDate(e.date, true) + '</span>' + (teacher ? '<span>' + icon('user-check', 14) + ' ' + esc(teacher.fullName) + '</span>' : '') + '</div>' +
      '</div>' + actions + '</article>';
  }

  function studentCard(student) {
    const stats = statsFor(student.id);
    const rank = rankFor(student.id);
    const level = UI.levelFor(stats.points);
    const last = stats.all.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0];
    return '<a class="student-card" href="#/students/' + esc(student.id) + '">' +
      '<div class="student-card-head">' + UI.avatar(student, 'md') +
      '<div class="student-card-name"><strong>' + esc(student.fullName) + '</strong><span>@' + esc(student.username) + '</span></div>' +
      (rank ? '<span class="rank-chip">' + icon('award', 13) + ' ' + esc(rankLabel(rank.rank)) + '</span>' : '') +
      '</div>' +
      '<div class="student-card-stats"><span><strong>' + UI.fmtNum(stats.points) + '</strong> نقطة</span><span><strong>' + UI.fmtNum(stats.approved.length) + '</strong> إنجاز</span><span><strong>' + (stats.average === null ? '—' : UI.fmtNum(stats.average)) + '</strong> تقييم</span></div>' +
      '<div class="student-progress"><div class="progress"><span style="width:' + level.percent.toFixed(1) + '%"></span></div><small>' + esc(level.current.name) + (level.next ? ' · ' + UI.fmtNum(Math.max(0, level.next - stats.points)) + ' نقطة للمستوى التالي' : ' · أعلى مستوى') + '</small></div>' +
      '<div class="student-card-foot">' +
      (last ? '<span>' + icon('clock', 13) + ' آخر إنجاز: ' + esc(last.title) + '</span>' : '<span class="muted">لا توجد إنجازات بعد</span>') +
      (stats.pending.length ? '<span class="mini-badge">' + UI.fmtNum(stats.pending.length) + ' بانتظار الاعتماد</span>' : '') +
      '</div>' +
      '</a>';
  }

  function announcementCard(n, options) {
    const opts = options || {};
    const author = userById(n.createdBy);
    const actions = opts.manage && isAdmin()
      ? '<div class="ann-actions">' +
        '<button type="button" class="icon-btn" data-action="edit-announcement" data-id="' + esc(n.id) + '" title="تعديل" aria-label="تعديل">' + icon('edit', 17) + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-announcement" data-id="' + esc(n.id) + '" title="حذف" aria-label="حذف">' + icon('trash', 17) + '</button>' +
        '</div>'
      : '';
    return '<article class="announcement-item">' +
      '<span class="ann-icon">' + icon('megaphone', 20) + '</span>' +
      '<div class="ann-main"><div class="ann-head"><h3>' + esc(n.title) + '</h3><span class="badge badge-muted">' + esc(DATA.audiences[n.audience] || n.audience) + '</span></div>' +
      '<p>' + esc(n.body) + '</p>' +
      '<div class="ann-meta"><span>' + icon('calendar', 14) + ' ' + UI.fmtDateTime(n.createdAt) + '</span>' + (author ? '<span>' + icon('user', 14) + ' ' + esc(author.fullName) + '</span>' : '') + '</div></div>' + actions +
      '</article>';
  }

  /* ==========================================================
     لوحات التحكم
     ========================================================== */
  function renderDashboard() {
    if (state.me.role === 'student') return studentDashboard();
    if (state.me.role === 'teacher') return teacherDashboard();
    return adminDashboard();
  }

  function studentDashboard() {
    const stats = statsFor(state.me.id);
    const level = UI.levelFor(stats.points);
    const rank = rankFor(state.me.id);
    const recent = stats.all.slice(0, 4);
    const latest = latestEvaluation(state.me.id);
    const notes = teacherNotesFor(state.me.id).slice(0, 3);
    const announcements = state.announcements.slice(0, 2);

    return '<div class="stack-lg">' +
      '<section class="hero-card">' +
      '<div class="hero-pattern" aria-hidden="true"></div>' +
      '<div class="hero-copy">' +
      '<span class="eyebrow light">' + esc(UI.greeting()) + '، ' + esc(UI.firstName(state.me.fullName)) + '</span>' +
      '<h2>رحلةُ العلمِ مستمرة…<br><em>وسجلُّك يكبر معك.</em></h2>' +
      '<p>' + (stats.pending.length
        ? 'لديك ' + UI.fmtNum(stats.pending.length) + ' إنجاز بانتظار اعتماد معلمك، و' + UI.fmtNum(stats.points) + ' نقطة معتمدة في رصيدك.'
        : 'كل إنجاز تسجّله خطوة جديدة في رحلتك. شارك معلمك بما أنجزته هذا الأسبوع.') + '</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-gold" data-action="add-achievement">' + icon('plus', 18) + ' أضف إنجازًا</button>' +
      '<a class="btn btn-ghost-light" href="#/achievements">' + icon('trophy', 18) + ' عرض السجل</a>' +
      '</div>' +
      '</div>' +
      '<div class="hero-side">' +
      UI.progressRing(level.percent, UI.fmtNum(stats.points), 'نقطة', 'lg') +
      '<div class="hero-level"><span>' + icon(level.current.icon, 15) + ' مستوى ' + esc(level.current.name) + '</span>' +
      (level.next ? '<small>' + UI.fmtNum(Math.max(0, level.next - stats.points)) + ' نقطة للمستوى التالي</small>' : '<small>وصلت أعلى مستوى</small>') +
      '</div>' +
      '</div>' +
      '</section>' +

      '<section class="stats-grid">' +
      statCard({ label: 'النقاط المعتمدة', value: UI.fmtNum(stats.points), icon: 'trophy', tone: 'gold', note: 'من الإنجازات المعتمدة' }) +
      statCard({ label: 'الإنجازات المعتمدة', value: UI.fmtNum(stats.approved.length), icon: 'check', tone: 'emerald', note: 'من أصل ' + UI.fmtNum(stats.all.length) + ' إنجاز' }) +
      statCard({ label: 'بانتظار الاعتماد', value: UI.fmtNum(stats.pending.length), icon: 'clock', tone: 'warning', note: stats.pending.length ? 'يراجعها معلمك قريبًا' : 'لا توجد إنجازات معلّقة' }) +
      statCard({ label: 'متوسط التقييم', value: stats.average === null ? '—' : UI.fmtNum(stats.average), icon: 'star', tone: 'blue', note: stats.average === null ? 'لم يُسجّل تقييم بعد' : 'من ' + UI.fmtNum(stats.evaluations.length) + ' تقييم' }) +
      '</section>' +

      '<div class="dash-grid">' +
      '<div class="stack">' +
      '<section class="card">' +
      sectionHead('أحدث إنجازاتي', 'آخر ما سجّلته أو اعتمده معلمك', '<a class="text-link" href="#/achievements">عرض الكل ' + icon('chevron', 15) + '</a>') +
      (recent.length ? '<div class="achievement-list">' + recent.map(function (a) { return achievementItem(a, { compact: true }); }).join('') + '</div>'
        : UI.emptyState('trophy', 'سجلّك ينتظر أول إنجاز', 'اضغط «أضف إنجازًا» لتسجيل ما أنجزته، وسيراجعه معلمك.', '<button type="button" class="btn btn-primary btn-sm" data-action="add-achievement">' + icon('plus', 16) + ' أضف إنجازًا</button>')) +
      '</section>' +
      '<section class="card">' +
      sectionHead('ترتيب الحلقة', 'النقاط المعتمدة لجميع الطلاب', '<span class="subtle-chip">' + (rank ? esc(rankLabel(rank.rank)) : '—') + '</span>') +
      leaderboardList(5, true) +
      '</section>' +
      '</div>' +
      '<aside class="stack">' +
      '<section class="card accent-card">' +
      '<div class="card-kicker">' + icon('star', 16) + ' آخر تقييم</div>' +
      (latest
        ? '<div class="latest-eval"><div class="latest-score tone-' + UI.gradeFor(latest.score).tone + '">' + UI.fmtNum(latest.score) + '</div><div><strong>' + esc(latest.term) + '</strong><span>' + esc(UI.gradeFor(latest.score).label) + ' · ' + UI.fmtDate(latest.date, true) + '</span></div></div>' +
          '<p class="latest-notes">' + esc(latest.notes || 'لا توجد ملاحظات مرفقة.') + '</p>' +
          '<a class="text-link" href="#/evaluations">كل التقييمات ' + icon('chevron', 15) + '</a>'
        : UI.emptyState('star', 'لا يوجد تقييم بعد', 'سيظهر تقييم معلمك هنا بعد أول جلسة تقييم.')) +
      '</section>' +
      '<section class="card">' +
      sectionHead('ملاحظات معلميّ', 'توجيهات تُعينك على الاستمرار') +
      (notes.length ? '<div class="note-list">' + notes.map(function (a) {
        const teacher = userById(a.teacherId);
        return '<div class="note-item"><span class="note-icon">' + icon('message', 15) + '</span><div><p>' + esc(a.teacherNote) + '</p><small>' + esc(teacher ? teacher.fullName : 'معلم الحلقة') + ' · ' + UI.fmtDate(a.date, true) + '</small></div></div>';
      }).join('') + '</div>' : '<p class="muted small">لا توجد ملاحظات بعد. ستظهر هنا ملاحظات معلميك على إنجازاتك.</p>') +
      '</section>' +
      '<section class="card">' +
      sectionHead('إعلانات الحلقة', '', '<a class="text-link" href="#/announcements">الكل</a>') +
      (announcements.length ? announcements.map(function (n) {
        return '<a class="mini-ann" href="#/announcements"><strong>' + esc(n.title) + '</strong><span>' + esc(n.body.slice(0, 78)) + (n.body.length > 78 ? '…' : '') + '</span><small>' + UI.relative(n.createdAt) + '</small></a>';
      }).join('') : '<p class="muted small">لا توجد إعلانات حاليًا.</p>') +
      '</section>' +
      '</aside>' +
      '</div>' +
      '</div>';
  }

  function leaderboardList(limit, highlightMe) {
    const rows = state.leaderboard.slice(0, limit);
    if (!rows.length) return '<p class="muted small">لا يوجد ترتيب بعد.</p>';
    return '<div class="leaderboard">' + rows.map(function (row) {
      const user = userById(row.userId) || { fullName: row.fullName, username: row.username };
      return '<div class="leader-row' + (highlightMe && state.me.id === row.userId ? ' me' : '') + '">' +
        '<span class="leader-rank' + (row.rank <= 3 ? ' top' : '') + '">' + UI.fmtNum(row.rank) + '</span>' +
        UI.avatar(user, 'xs') +
        '<div class="leader-name"><strong>' + esc(row.fullName) + '</strong><span>@' + esc(row.username) + '</span></div>' +
        '<span class="leader-points">' + UI.fmtNum(row.points) + ' <small>نقطة</small></span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function monthlySeries() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const count = state.achievements.filter(function (a) {
        return a.status === 'approved' && String(a.date).startsWith(key);
      }).length;
      months.push({ key: key, label: new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'short' }).format(d), count: count });
    }
    return months;
  }

  function monthlyChart() {
    const series = monthlySeries();
    const max = Math.max.apply(null, series.map(function (m) { return m.count; }).concat([1]));
    return '<div class="bar-chart" role="img" aria-label="نشاط الإنجازات خلال الأشهر الستة الماضية">' + series.map(function (m) {
      const h = Math.max(6, Math.round((m.count / max) * 100));
      return '<div class="bar-col"><span class="bar-value">' + UI.fmtNum(m.count) + '</span><div class="bar-track"><span style="height:' + h + '%"></span></div><small>' + esc(m.label) + '</small></div>';
    }).join('') + '</div>';
  }

  function teacherDashboard() {
    const studentList = students();
    const pending = pendingAchievements();
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthCount = state.achievements.filter(function (a) { return String(a.date).startsWith(monthKey); }).length;
    const allScores = state.evaluations.map(function (e) { return Number(e.score) || 0; });
    const avg = allScores.length ? Math.round(allScores.reduce(function (s, v) { return s + v; }, 0) / allScores.length) : null;
    const top = state.leaderboard.slice(0, 5);

    return '<div class="stack-lg">' +
      '<section class="hero-card compact-hero">' +
      '<div class="hero-pattern" aria-hidden="true"></div>' +
      '<div class="hero-copy"><span class="eyebrow light">' + esc(UI.greeting()) + '، ' + esc(UI.firstName(state.me.fullName)) + '</span>' +
      '<h2>متابعةٌ تصنع الفرق.</h2>' +
      '<p>' + (pending.length ? 'لديك ' + UI.fmtNum(pending.length) + ' إنجاز بانتظار المراجعة، و' + UI.fmtNum(studentList.length) + ' طالبًا في الحلقة.' : 'كل الإنجازات مُراجعة. تابع مستويات طلابك وسجّل ملاحظاتك.') + '</p>' +
      '<div class="hero-actions"><button type="button" class="btn btn-gold" data-action="add-achievement">' + icon('plus', 18) + ' تسجيل إنجاز</button><button type="button" class="btn btn-ghost-light" data-action="add-evaluation">' + icon('star', 18) + ' تقييم طالب</button></div></div>' +
      '<div class="hero-side hero-side-row">' +
      '<div class="hero-mini-stat"><strong>' + UI.fmtNum(pending.length) + '</strong><span>بانتظار الاعتماد</span></div>' +
      '<div class="hero-mini-stat"><strong>' + UI.fmtNum(studentList.length) + '</strong><span>طالبًا في الحلقة</span></div>' +
      '</div>' +
      '</section>' +

      '<section class="stats-grid">' +
      statCard({ label: 'طلاب الحلقة', value: UI.fmtNum(studentList.length), icon: 'users', tone: 'emerald', note: 'حساب طالب نشط' }) +
      statCard({ label: 'إنجازات هذا الشهر', value: UI.fmtNum(monthCount), icon: 'trophy', tone: 'gold', note: 'مسجّلة خلال الشهر الحالي' }) +
      statCard({ label: 'بانتظار المراجعة', value: UI.fmtNum(pending.length), icon: 'clipboard', tone: 'warning', note: pending.length ? 'تحتاج اعتمادك' : 'لا شيء معلّق' }) +
      statCard({ label: 'متوسط التقييمات', value: avg === null ? '—' : UI.fmtNum(avg), icon: 'star', tone: 'blue', note: 'لجميع تقييمات الحلقة' }) +
      '</section>' +

      '<div class="dash-grid">' +
      '<div class="stack">' +
      '<section class="card">' +
      sectionHead('بانتظار اعتمادك', 'إنجازات أرسلها الطلاب وتنتظر ملاحظتك', '<a class="text-link" href="#/approvals">عرض الكل ' + icon('chevron', 15) + '</a>') +
      (pending.length ? '<div class="achievement-list">' + pending.slice(0, 4).map(function (a) { return achievementItem(a, { showStudent: true }); }).join('') + '</div>'
        : UI.emptyState('check', 'كل شيء تحت السيطرة', 'لا توجد إنجازات بانتظار الاعتماد حاليًا.')) +
      '</section>' +
      '<section class="card">' +
      sectionHead('نشاط الحلقة', 'الإنجازات المعتمدة خلال ستة أشهر') + monthlyChart() +
      '</section>' +
      '</div>' +
      '<aside class="stack">' +
      '<section class="card">' +
      sectionHead('أعلى الطلاب', 'حسب النقاط المعتمدة', '<a class="text-link" href="#/students">الطلاب</a>') +
      leaderboardList(5, false) +
      '</section>' +
      '<section class="card">' +
      sectionHead('أحدث الطلاب', 'الملفات التي انضمت حديثًا') +
      '<div class="simple-list">' + studentList.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 4).map(function (s) {
        return '<a class="simple-row" href="#/students/' + esc(s.id) + '">' + UI.avatar(s, 'xs') + '<div><strong>' + esc(s.fullName) + '</strong><span>@' + esc(s.username) + '</span></div>' + icon('chevron', 16) + '</a>';
      }).join('') + '</div>' +
      '</section>' +
      '<section class="card">' +
      sectionHead('آخر الإعلانات', '', '<a class="text-link" href="#/announcements">الكل</a>') +
      (state.announcements.length ? state.announcements.slice(0, 2).map(function (n) {
        return '<a class="mini-ann" href="#/announcements"><strong>' + esc(n.title) + '</strong><span>' + esc(n.body.slice(0, 72)) + (n.body.length > 72 ? '…' : '') + '</span><small>' + UI.relative(n.createdAt) + '</small></a>';
      }).join('') : '<p class="muted small">لا توجد إعلانات.</p>') +
      '</section>' +
      '</aside>' +
      '</div>' +
      '</div>';
  }

  function adminDashboard() {
    const allUsers = state.directory;
    const studentList = students();
    const teachers = allUsers.filter(function (u) { return u.role === 'teacher'; });
    const pending = pendingAchievements();
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthCount = state.achievements.filter(function (a) { return String(a.date).startsWith(monthKey); }).length;
    const allScores = state.evaluations.map(function (e) { return Number(e.score) || 0; });
    const avg = allScores.length ? Math.round(allScores.reduce(function (s, v) { return s + v; }, 0) / allScores.length) : null;
    const categories = Object.keys(DATA.categories).map(function (key) {
      return {
        key: key,
        label: DATA.categories[key].label,
        tone: DATA.categories[key].tone,
        icon: DATA.categories[key].icon,
        count: state.achievements.filter(function (a) { return a.category === key && a.status === 'approved'; }).length
      };
    }).sort(function (a, b) { return b.count - a.count; });
    const maxCat = Math.max.apply(null, categories.map(function (c) { return c.count; }).concat([1]));

    return '<div class="stack-lg">' +
      '<section class="hero-card compact-hero">' +
      '<div class="hero-pattern" aria-hidden="true"></div>' +
      '<div class="hero-copy"><span class="eyebrow light">' + esc(UI.greeting()) + '، ' + esc(UI.firstName(state.me.fullName)) + '</span>' +
      '<h2>إدارةٌ تُبقي الأثر.</h2>' +
      '<p>لديك ' + UI.fmtNum(studentList.length) + ' طالبًا و' + UI.fmtNum(teachers.length) + ' معلمًا، و' + UI.fmtNum(pending.length) + ' إنجاز بانتظار المراجعة.</p>' +
      '<div class="hero-actions"><button type="button" class="btn btn-gold" data-action="add-user">' + icon('plus', 18) + ' إضافة مستخدم</button><a class="btn btn-ghost-light" href="#/settings">' + icon('settings', 18) + ' إعدادات الحلقة</a></div></div>' +
      '<div class="hero-side hero-side-row">' +
      '<div class="hero-mini-stat"><strong>' + UI.fmtNum(allUsers.length) + '</strong><span>إجمالي الحسابات</span></div>' +
      '<div class="hero-mini-stat"><strong>' + UI.fmtNum(state.achievements.length) + '</strong><span>إجمالي الإنجازات</span></div>' +
      '</div>' +
      '</section>' +

      '<section class="stats-grid">' +
      statCard({ label: 'الطلاب', value: UI.fmtNum(studentList.length), icon: 'graduation', tone: 'emerald', note: 'حساب طالب نشط' }) +
      statCard({ label: 'المعلمون', value: UI.fmtNum(teachers.length), icon: 'book', tone: 'gold', note: 'يشرفون على السجل' }) +
      statCard({ label: 'إنجازات الشهر', value: UI.fmtNum(monthCount), icon: 'trophy', tone: 'blue', note: 'خلال الشهر الحالي' }) +
      statCard({ label: 'متوسط التقييمات', value: avg === null ? '—' : UI.fmtNum(avg), icon: 'star', tone: 'violet', note: 'لجميع الطلاب' }) +
      '</section>' +

      '<div class="dash-grid">' +
      '<div class="stack">' +
      '<section class="card">' +
      sectionHead('نشاط الإنجازات', 'آخر ستة أشهر', '<span class="subtle-chip">' + UI.fmtNum(state.achievements.length) + ' إنجاز</span>') + monthlyChart() +
      '</section>' +
      '<section class="card">' +
      sectionHead('بانتظار الاعتماد', 'يمكن للمدير اعتماد الإنجازات أيضًا', '<a class="text-link" href="#/approvals">عرض الكل ' + icon('chevron', 15) + '</a>') +
      (pending.length ? '<div class="achievement-list">' + pending.slice(0, 4).map(function (a) { return achievementItem(a, { showStudent: true }); }).join('') + '</div>'
        : UI.emptyState('check', 'لا توجد طلبات معلّقة', 'جميع الإنجازات تمت مراجعتها.')) +
      '</section>' +
      '</div>' +
      '<aside class="stack">' +
      '<section class="card">' +
      sectionHead('توزيع الإنجازات', 'حسب الفئة') +
      '<div class="category-bars">' + categories.map(function (c) {
        return '<div class="cat-row"><span class="cat-label">' + icon(c.icon, 15) + ' ' + esc(c.label) + '</span><div class="cat-track"><span class="tone-' + c.tone + '" style="width:' + Math.max(3, Math.round((c.count / maxCat) * 100)) + '%"></span></div><strong>' + UI.fmtNum(c.count) + '</strong></div>';
      }).join('') + '</div>' +
      '</section>' +
      '<section class="card">' +
      sectionHead('أحدث الحسابات', 'آخر من انضم إلى الحلقة', '<a class="text-link" href="#/users">المستخدمون</a>') +
      '<div class="simple-list">' + allUsers.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 5).map(function (u) {
        return '<a class="simple-row" href="#/users">' + UI.avatar(u, 'xs') + '<div><strong>' + esc(u.fullName) + '</strong><span>' + esc(DATA.roles[u.role] ? DATA.roles[u.role].label : u.role) + ' · @' + esc(u.username) + '</span></div>' + icon('chevron', 16) + '</a>';
      }).join('') + '</div>' +
      '</section>' +
      '<section class="card">' +
      sectionHead('ملخص سريع', '') +
      '<div class="summary-grid"><div><strong>' + UI.fmtNum(state.evaluations.length) + '</strong><span>تقييم</span></div><div><strong>' + UI.fmtNum(state.announcements.length) + '</strong><span>إعلان</span></div><div><strong>' + UI.fmtNum(pending.length) + '</strong><span>معلّق</span></div><div><strong>' + UI.fmtNum(state.leaderboard.length) + '</strong><span>طالب في الترتيب</span></div></div>' +
      '</section>' +
      '</aside>' +
      '</div>' +
      '</div>';
  }

  /* ==========================================================
     صفحات السجل
     ========================================================== */
  function filteredAchievements() {
    const f = state.filters.achievements;
    const q = f.q.trim().toLowerCase();
    return state.achievements.filter(function (a) {
      if (f.status !== 'all' && a.status !== f.status) return false;
      if (f.category !== 'all' && a.category !== f.category) return false;
      if (isStaff() && f.student !== 'all' && a.studentId !== f.student) return false;
      if (q) {
        const student = userById(a.studentId);
        const haystack = [a.title, a.description, a.teacherNote, student ? student.fullName : '', student ? student.username : ''].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function renderAchievementsPage() {
    const f = state.filters.achievements;
    const list = filteredAchievements();
    const staff = isStaff();
    const categories = DATA.categoryList.map(function (c) {
      return '<option value="' + esc(c.key) + '"' + (f.category === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');
    const studentOptions = students().map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (f.student === s.id ? ' selected' : '') + '>' + esc(s.fullName) + '</option>';
    }).join('');

    return '<div class="stack-lg">' +
      '<section class="page-toolbar card">' +
      '<div class="toolbar-row">' +
      '<label class="search-field">' + icon('search', 18) + '<input id="ach-search" type="search" data-filter="ach-q" value="' + esc(f.q) + '" placeholder="ابحث في الإنجازات أو الملاحظات…" aria-label="بحث في الإنجازات"></label>' +
      '<div class="filter-group">' +
      '<select id="ach-status" data-filter="ach-status" aria-label="تصفية حسب الحالة"><option value="all">كل الحالات</option>' +
      Object.keys(DATA.statuses).map(function (key) { return '<option value="' + key + '"' + (f.status === key ? ' selected' : '') + '>' + esc(DATA.statuses[key].label) + '</option>'; }).join('') +
      '</select>' +
      '<select id="ach-category" data-filter="ach-category" aria-label="تصفية حسب الفئة"><option value="all">كل الفئات</option>' + categories + '</select>' +
      (staff ? '<select id="ach-student" data-filter="ach-student" aria-label="تصفية حسب الطالب"><option value="all">كل الطلاب</option>' + studentOptions + '</select>' : '') +
      '</div>' +
      '</div>' +
      '<div class="toolbar-foot"><span class="result-count">' + icon('filter', 15) + ' ' + UI.fmtNum(list.length) + ' إنجاز</span>' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="add-achievement">' + icon('plus', 16) + ' إضافة إنجاز</button></div>' +
      '</section>' +

      (list.length
        ? '<section class="card list-card"><div class="achievement-list">' + list.map(function (a) { return achievementItem(a, { showStudent: staff }); }).join('') + '</div></section>'
        : '<section class="card">' + UI.emptyState('trophy', 'لا توجد إنجازات مطابقة', 'جرّب تغيير كلمة البحث أو الفلاتر، أو أضف إنجازًا جديدًا.', '<button type="button" class="btn btn-primary btn-sm" data-action="add-achievement">' + icon('plus', 16) + ' إضافة إنجاز</button>') + '</section>') +
      '</div>';
  }

  function renderApprovalsPage() {
    const pending = pendingAchievements();
    return '<div class="stack-lg">' +
      '<section class="approval-banner card">' +
      '<span class="approval-icon">' + icon('clipboard', 24) + '</span>' +
      '<div><h2>' + UI.fmtNum(pending.length) + ' إنجاز بانتظار المراجعة</h2><p>راجع ما أرسله الطلاب، أضف ملاحظتك، ثم اعتمد الإنجاز أو أعده للمراجعة.</p></div>' +
      '</section>' +
      (pending.length
        ? '<section class="card list-card"><div class="achievement-list">' + pending.map(function (a) { return achievementItem(a, { showStudent: true }); }).join('') + '</div></section>'
        : '<section class="card">' + UI.emptyState('check', 'لا يوجد شيء بانتظار الاعتماد', 'عندما يرسل الطلاب إنجازات جديدة ستظهر هنا لمراجعتها.') + '</section>') +
      '</div>';
  }

  function renderEvaluationsPage() {
    if (state.me.role === 'student') {
      const stats = statsFor(state.me.id);
      const list = state.evaluations.slice();
      return '<div class="stack-lg">' +
        '<section class="evaluation-summary card">' +
        '<div class="summary-score tone-' + (stats.average === null ? 'muted' : UI.gradeFor(stats.average).tone) + '">' + (stats.average === null ? '—' : UI.fmtNum(stats.average)) + '</div>' +
        '<div><span class="eyebrow">متوسط تقييمك</span><h2>' + (stats.average === null ? 'لم يُسجّل تقييم بعد' : esc(UI.gradeFor(stats.average).label)) + '</h2><p>' + (stats.average === null ? 'سيظهر تقييم معلمك هنا بعد أول جلسة تقييم.' : 'بناءً على ' + UI.fmtNum(stats.evaluations.length) + ' تقييم من معلمي الحلقة.') + '</p></div>' +
        '<div class="summary-level">' + icon('star', 18) + '<span>مستوى ' + esc(UI.levelFor(stats.points).current.name) + '</span></div>' +
        '</section>' +
        (list.length ? '<section class="card list-card"><div class="evaluation-list">' + list.map(function (e) { return evaluationCard(e); }).join('') + '</div></section>'
          : '<section class="card">' + UI.emptyState('star', 'سجل التقييمات فارغ', 'سيضيف معلمك تقييمًا بعد المراجعة الدورية لمستواك.') + '</section>') +
        '</div>';
    }

    const f = state.filters.evaluations;
    const q = f.q.trim().toLowerCase();
    let list = state.evaluations.slice();
    if (f.student !== 'all') list = list.filter(function (e) { return e.studentId === f.student; });
    if (q) {
      list = list.filter(function (e) {
        const student = userById(e.studentId);
        return [e.term, e.notes, student ? student.fullName : ''].join(' ').toLowerCase().includes(q);
      });
    }
    const studentOptions = students().map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (f.student === s.id ? ' selected' : '') + '>' + esc(s.fullName) + '</option>';
    }).join('');

    return '<div class="stack-lg">' +
      '<section class="page-toolbar card">' +
      '<div class="toolbar-row"><label class="search-field">' + icon('search', 18) + '<input id="eval-search" type="search" data-filter="eval-q" value="' + esc(f.q) + '" placeholder="ابحث في التقييمات…" aria-label="بحث في التقييمات"></label>' +
      '<div class="filter-group"><select id="eval-student" data-filter="eval-student" aria-label="تصفية حسب الطالب"><option value="all">كل الطلاب</option>' + studentOptions + '</select></div></div>' +
      '<div class="toolbar-foot"><span class="result-count">' + icon('star', 15) + ' ' + UI.fmtNum(list.length) + ' تقييم</span><button type="button" class="btn btn-primary btn-sm" data-action="add-evaluation">' + icon('plus', 16) + ' تقييم جديد</button></div>' +
      '</section>' +
      (list.length ? '<section class="card list-card"><div class="evaluation-list">' + list.map(function (e) { return evaluationCard(e, { showStudent: true }); }).join('') + '</div></section>'
        : '<section class="card">' + UI.emptyState('star', 'لا توجد تقييمات مطابقة', 'غيّر الفلاتر أو أضف تقييمًا جديدًا لطالب.', '<button type="button" class="btn btn-primary btn-sm" data-action="add-evaluation">' + icon('plus', 16) + ' تقييم جديد</button>') + '</section>') +
      '</div>';
  }

  function renderStudentsPage() {
    const q = state.filters.students.q.trim().toLowerCase();
    let list = students();
    if (q) {
      list = list.filter(function (s) {
        return [s.fullName, s.username, s.email, s.phone].join(' ').toLowerCase().includes(q);
      });
    }
    list = list.slice().sort(function (a, b) {
      const ra = rankFor(a.id);
      const rb = rankFor(b.id);
      return (ra ? ra.rank : 999) - (rb ? rb.rank : 999);
    });
    return '<div class="stack-lg">' +
      '<section class="page-toolbar card">' +
      '<div class="toolbar-row"><label class="search-field">' + icon('search', 18) + '<input id="student-search" type="search" data-filter="student-q" value="' + esc(state.filters.students.q) + '" placeholder="ابحث باسم الطالب أو اسم المستخدم…" aria-label="بحث في الطلاب"></label>' +
      '<div class="filter-group">' + (isAdmin() ? '<button type="button" class="btn btn-primary btn-sm" data-action="add-user" data-role="student">' + icon('plus', 16) + ' إضافة طالب</button>' : '') + '</div></div>' +
      '<div class="toolbar-foot"><span class="result-count">' + icon('users', 15) + ' ' + UI.fmtNum(list.length) + ' طالبًا</span><span class="muted small">مرتبون حسب النقاط المعتمدة</span></div>' +
      '</section>' +
      (list.length ? '<section class="student-grid">' + list.map(studentCard).join('') + '</section>'
        : '<section class="card">' + UI.emptyState('users', 'لا يوجد طلاب مطابقون', 'جرّب كلمة بحث أخرى أو أضف حساب طالب جديد.') + '</section>') +
      '</div>';
  }

  function printHeader() {
    return '<div class="print-header">' +
      '<div class="print-brand"><img src="./assets/logos/manara.svg" alt="" width="46" height="46"><div><strong>منارة الحلقة</strong><span>' + esc(state.settings.name || '') + ' · ' + esc(state.settings.mosque || '') + '</span></div></div>' +
      '<div class="print-logos"><img src="./assets/logos/rajhi.svg" alt="جامع الراجحي" width="38" height="38"><img src="./assets/logos/qabas.svg" alt="قبس" width="38" height="38"></div>' +
      '</div>';
  }

  function renderStudentDetail(id) {
    const student = userById(id);
    if (!student) {
      return '<section class="card">' + UI.emptyState('user', 'الطالب غير موجود', 'ربما تم حذف الحساب أو تغيّر الرابط.') + '</section>';
    }
    if (state.me.role === 'student' && state.me.id !== id) {
      location.hash = '#/dashboard';
      return '';
    }
    const stats = statsFor(id);
    const level = UI.levelFor(stats.points);
    const rank = rankFor(id);
    const notes = teacherNotesFor(id);
    const all = stats.all.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const evals = stats.evaluations.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

    return '<div class="stack-lg">' +
      printHeader() +
      '<section class="record-head card">' +
      '<div class="record-person">' + UI.avatar(student, 'xl') +
      '<div class="record-identity"><div class="record-name-row"><h2>' + esc(student.fullName) + '</h2>' + UI.roleBadge(student.role) + (student.active === false ? '<span class="badge badge-danger">معطّل</span>' : '') + '</div>' +
      '<p class="record-handle">@' + esc(student.username) + ' · <span dir="ltr">' + esc(student.email) + '</span></p>' +
      '<div class="record-meta"><span>' + icon('phone', 14) + ' ' + esc(student.phone || 'لا يوجد جوال') + '</span><span>' + icon('calendar', 14) + ' انضم ' + UI.fmtDate(student.createdAt, true) + '</span><span>' + icon('award', 14) + ' ' + esc(rank ? rankLabel(rank.rank) : 'غير مصنّف') + '</span></div></div></div>' +
      '<div class="record-actions no-print">' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="add-achievement" data-student="' + esc(student.id) + '">' + icon('plus', 16) + ' إنجاز</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-action="add-evaluation" data-student="' + esc(student.id) + '">' + icon('star', 16) + ' تقييم</button>' +
      (isAdmin() ? '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-user" data-id="' + esc(student.id) + '">' + icon('edit', 16) + ' تعديل الحساب</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="print-record">' + icon('printer', 16) + ' طباعة</button>' +
      '</div>' +
      '<div class="record-stats">' +
      '<div><strong>' + UI.fmtNum(stats.points) + '</strong><span>نقطة معتمدة</span></div>' +
      '<div><strong>' + UI.fmtNum(stats.approved.length) + '</strong><span>إنجاز معتمد</span></div>' +
      '<div><strong>' + UI.fmtNum(stats.pending.length) + '</strong><span>بانتظار الاعتماد</span></div>' +
      '<div><strong>' + (stats.average === null ? '—' : UI.fmtNum(stats.average)) + '</strong><span>متوسط التقييم</span></div>' +
      '<div class="record-level"><div class="progress"><span style="width:' + level.percent.toFixed(1) + '%"></span></div><small>مستوى ' + esc(level.current.name) + '</small></div>' +
      '</div>' +
      '</section>' +

      '<div class="dash-grid">' +
      '<div class="stack">' +
      '<section class="card">' +
      sectionHead('سجل الإنجازات', UI.fmtNum(all.length) + ' إنجاز مسجّل', '<button type="button" class="btn btn-primary btn-sm no-print" data-action="add-achievement" data-student="' + esc(student.id) + '">' + icon('plus', 16) + ' إضافة</button>') +
      (all.length ? '<div class="achievement-list">' + all.map(function (a) { return achievementItem(a); }).join('') + '</div>'
        : UI.emptyState('trophy', 'لا توجد إنجازات بعد', 'ابدأ بتسجيل أول إنجاز لهذا الطالب.')) +
      '</section>' +
      '</div>' +
      '<aside class="stack">' +
      '<section class="card">' +
      sectionHead('التقييمات', UI.fmtNum(evals.length) + ' تقييم', '<button type="button" class="btn btn-outline btn-sm no-print" data-action="add-evaluation" data-student="' + esc(student.id) + '">' + icon('plus', 15) + ' إضافة</button>') +
      (evals.length ? '<div class="evaluation-list compact">' + evals.map(function (e) { return evaluationCard(e); }).join('') + '</div>'
        : '<p class="muted small">لم يُسجّل تقييم لهذا الطالب بعد.</p>') +
      '</section>' +
      '<section class="card">' +
      sectionHead('ملاحظات المعلمين', '') +
      (notes.length ? '<div class="note-list">' + notes.slice(0, 6).map(function (a) {
        const teacher = userById(a.teacherId);
        return '<div class="note-item"><span class="note-icon">' + icon('message', 15) + '</span><div><p>' + esc(a.teacherNote) + '</p><small>' + esc(teacher ? teacher.fullName : 'معلم') + ' · ' + UI.fmtDate(a.date, true) + '</small></div></div>';
      }).join('') + '</div>' : '<p class="muted small">لا توجد ملاحظات مسجّلة.</p>') +
      '</section>' +
      '</aside>' +
      '</div>' +
      '</div>';
  }

  function renderUsersPage() {
    const f = state.filters.users;
    const q = f.q.trim().toLowerCase();
    let list = state.directory.slice();
    if (f.role !== 'all') list = list.filter(function (u) { return u.role === f.role; });
    if (q) list = list.filter(function (u) { return [u.fullName, u.username, u.email, u.phone].join(' ').toLowerCase().includes(q); });
    list.sort(function (a, b) { return String(a.fullName).localeCompare(String(b.fullName), 'ar'); });
    const counts = { admin: 0, teacher: 0, student: 0 };
    state.directory.forEach(function (u) { counts[u.role] = (counts[u.role] || 0) + 1; });

    return '<div class="stack-lg">' +
      '<section class="stats-grid stats-grid-3">' +
      statCard({ label: 'الطلاب', value: UI.fmtNum(counts.student || 0), icon: 'graduation', tone: 'emerald', note: 'حساب طالب' }) +
      statCard({ label: 'المعلمون', value: UI.fmtNum(counts.teacher || 0), icon: 'book', tone: 'gold', note: 'حساب معلم' }) +
      statCard({ label: 'المديرون', value: UI.fmtNum(counts.admin || 0), icon: 'shield', tone: 'blue', note: 'صلاحيات كاملة' }) +
      '</section>' +
      '<section class="page-toolbar card">' +
      '<div class="toolbar-row"><label class="search-field">' + icon('search', 18) + '<input id="user-search" type="search" data-filter="user-q" value="' + esc(f.q) + '" placeholder="ابحث بالاسم أو اسم المستخدم أو البريد…" aria-label="بحث في المستخدمين"></label>' +
      '<div class="filter-group"><select id="user-role" data-filter="user-role" aria-label="تصفية حسب الدور"><option value="all">كل الأدوار</option>' +
      Object.keys(DATA.roles).map(function (key) { return '<option value="' + key + '"' + (f.role === key ? ' selected' : '') + '>' + esc(DATA.roles[key].label) + '</option>'; }).join('') +
      '</select><button type="button" class="btn btn-primary btn-sm" data-action="add-user">' + icon('plus', 16) + ' مستخدم جديد</button></div></div>' +
      '<div class="toolbar-foot"><span class="result-count">' + icon('users', 15) + ' ' + UI.fmtNum(list.length) + ' حساب</span><span class="muted small">كلمات المرور مشفّرة ولا تُعرض للمدير</span></div>' +
      '</section>' +
      '<section class="card table-card">' +
      (list.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>المستخدم</th><th>الدور</th><th>البريد الإلكتروني</th><th>الحالة</th><th>الإنجازات</th><th class="no-print">إجراءات</th></tr></thead><tbody>' +
        list.map(function (u) {
          const stats = u.role === 'student' ? statsFor(u.id) : null;
          const isSelf = u.id === state.me.id;
          return '<tr>' +
            '<td><div class="table-user">' + UI.avatar(u, 'xs') + '<div><strong>' + esc(u.fullName) + '</strong><span>@' + esc(u.username) + (isSelf ? ' · أنت' : '') + '</span></div></div></td>' +
            '<td>' + UI.roleBadge(u.role) + '</td>' +
            '<td><span dir="ltr">' + esc(u.email) + '</span></td>' +
            '<td>' + (u.active === false ? '<span class="badge badge-danger">معطّل</span>' : '<span class="badge badge-success">نشط</span>') + '</td>' +
            '<td>' + (stats ? '<span class="points-cell">' + icon('trophy', 14) + ' ' + UI.fmtNum(stats.approved.length) + '</span>' : '<span class="muted">—</span>') + '</td>' +
            '<td class="no-print"><div class="table-actions">' +
            '<button type="button" class="icon-btn" data-action="edit-user" data-id="' + esc(u.id) + '" title="تعديل" aria-label="تعديل">' + icon('edit', 16) + '</button>' +
            '<button type="button" class="icon-btn" data-action="reset-password" data-id="' + esc(u.id) + '" title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور">' + icon('key', 16) + '</button>' +
            (!isSelf ? '<button type="button" class="icon-btn ' + (u.active === false ? '' : 'danger') + '" data-action="toggle-user" data-id="' + esc(u.id) + '" title="' + (u.active === false ? 'تفعيل' : 'تعطيل') + '" aria-label="' + (u.active === false ? 'تفعيل' : 'تعطيل') + '">' + icon(u.active === false ? 'check' : 'x', 16) + '</button>' : '') +
            (!isSelf ? '<button type="button" class="icon-btn danger" data-action="delete-user" data-id="' + esc(u.id) + '" title="حذف" aria-label="حذف">' + icon('trash', 16) + '</button>' : '') +
            '</div></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
        : UI.emptyState('users', 'لا يوجد مستخدمون مطابقون', 'غيّر كلمة البحث أو الدور، أو أضف مستخدمًا جديدًا.')) +
      '</section>' +
      '</div>';
  }

  function renderAnnouncementsPage() {
    return '<div class="stack-lg">' +
      '<section class="page-toolbar card">' +
      '<div class="toolbar-row"><div><span class="eyebrow">لوحة الإعلانات</span><h2 class="toolbar-title">' + UI.fmtNum(state.announcements.length) + ' إعلان</h2></div>' +
      (isAdmin() ? '<button type="button" class="btn btn-primary btn-sm" data-action="add-announcement">' + icon('plus', 16) + ' إعلان جديد</button>' : '') + '</div>' +
      '</section>' +
      (state.announcements.length ? '<section class="card list-card"><div class="announcement-list">' + state.announcements.map(function (n) { return announcementCard(n, { manage: true }); }).join('') + '</div></section>'
        : '<section class="card">' + UI.emptyState('bell', 'لا توجد إعلانات', isAdmin() ? 'أضف أول إعلان ليصل إلى طلاب الحلقة ومعلميها.' : 'ستظهر إعلانات الحلقة هنا.', isAdmin() ? '<button type="button" class="btn btn-primary btn-sm" data-action="add-announcement">' + icon('plus', 16) + ' إعلان جديد</button>' : '') + '</section>') +
      '</div>';
  }

  function renderSettingsPage() {
    const s = state.settings;
    const mode = state.store.mode;
    const info = state.store.storageInfo ? state.store.storageInfo() : { mode: mode };
    const bytes = info.bytes ? (info.bytes / 1024).toFixed(1) + ' كيلوبايت' : '—';
    return '<div class="stack-lg">' +
      '<section class="card">' +
      sectionHead('بيانات الحلقة', 'تظهر هذه البيانات في الشعار والواجهات والتقارير', '<span class="badge badge-gold">' + icon('settings', 13) + ' إعدادات المدير</span>') +
      '<form data-form="settings" class="form-grid">' +
      '<label class="field"><span class="field-label">اسم الحلقة</span><input type="text" name="name" value="' + esc(s.name || '') + '" required></label>' +
      '<label class="field"><span class="field-label">المسجد</span><input type="text" name="mosque" value="' + esc(s.mosque || '') + '"></label>' +
      '<label class="field"><span class="field-label">الجمعية المشرفة</span><input type="text" name="association" value="' + esc(s.association || '') + '"></label>' +
      '<label class="field"><span class="field-label">المشرف العام</span><input type="text" name="supervisor" value="' + esc(s.supervisor || '') + '"></label>' +
      '<label class="field"><span class="field-label">المعلم المسؤول</span><input type="text" name="teacher" value="' + esc(s.teacher || '') + '"></label>' +
      '<label class="field"><span class="field-label">العام الدراسي</span><input type="text" name="year" value="' + esc(s.year || '') + '"></label>' +
      '<label class="field"><span class="field-label">موعد الحلقة</span><input type="text" name="schedule" value="' + esc(s.schedule || '') + '"></label>' +
      '<label class="field"><span class="field-label">المكان</span><input type="text" name="location" value="' + esc(s.location || '') + '"></label>' +
      '<label class="field field-full"><span class="field-label">وصف الحلقة</span><textarea name="description" rows="4">' + esc(s.description || '') + '</textarea></label>' +
      '<div class="form-actions field-full"><button type="submit" class="btn btn-primary">' + icon('save', 18) + ' حفظ الإعدادات</button></div>' +
      '</form>' +
      '</section>' +

      '<div class="grid-2">' +
      '<section class="card">' +
      sectionHead('الشعارات الرسمية', 'شعارات الجهات المشرفة على الحلقة') +
      '<div class="logo-cards">' +
      '<div class="logo-card"><img src="./assets/logos/manara.svg" alt="المنارة الوقفية" width="54" height="54"><div><strong>المنارة الوقفية</strong><span>assets/logos/manara.svg</span></div></div>' +
      '<div class="logo-card"><img src="./assets/logos/rajhi.svg" alt="جامع الراجحي" width="54" height="54"><div><strong>جامع الراجحي</strong><span>assets/logos/rajhi.svg</span></div></div>' +
      '<div class="logo-card"><img src="./assets/logos/qabas.svg" alt="قبس للقرآن والسنة والخطابة" width="54" height="54"><div><strong>قبس للقرآن والسنة والخطابة</strong><span>assets/logos/qabas.svg</span></div></div>' +
      '</div>' +
      '<p class="form-note">الملفات الحالية شعارات تعريفية مرسومة للمشروع. لاستخدام الشعارات الرسمية، استبدل الملفات الثلاثة بنفس الأسماء والأبعاد المربعة.</p>' +
      '</section>' +

      '<section class="card">' +
      sectionHead('حالة الاتصال والتخزين', '') +
      '<div class="status-list">' +
      '<div class="status-row"><span class="status-icon tone-' + (mode === 'supabase' ? 'blue' : 'emerald') + '">' + icon(mode === 'supabase' ? 'cloud' : 'hard-drive', 18) + '</span><div><strong>' + (mode === 'supabase' ? 'متصل بـ Supabase' : 'تخزين محلي في المتصفح') + '</strong><span>' + (mode === 'supabase' ? esc(CFG.supabaseUrl) : 'البيانات محفوظة على هذا الجهاز فقط') + '</span></div></div>' +
      (mode === 'local' ? '<div class="status-row"><span class="status-icon tone-gold">' + icon('database', 18) + '</span><div><strong>حجم البيانات</strong><span>' + esc(bytes) + ' · المفتاح: ' + esc(info.key || '') + '</span></div></div>' : '<div class="status-row"><span class="status-icon tone-gold">' + icon('shield', 18) + '</span><div><strong>الحماية</strong><span>صلاحيات RLS مطبّقة على قاعدة البيانات</span></div></div>') +
      '</div>' +
      '<div class="inline-alert ' + (mode === 'supabase' ? 'info' : 'warning') + '">' + icon(mode === 'supabase' ? 'cloud' : 'alert', 18) + '<div><strong>' + (mode === 'supabase' ? 'نسخة سحابية' : 'نسخة محلية للتجربة') + '</strong><p>' + (mode === 'supabase' ? 'أي تعديل يُحفظ مباشرة في قاعدة البيانات ويظهر لجميع المستخدمين.' : 'البيانات لا تُزامن بين الأجهزة. للانتقال إلى السحابة، أضف بيانات Supabase في js/config.js ونفّذ ملف schema.sql.') + '</p></div></div>' +
      (mode === 'local' ? '<div class="form-actions"><button type="button" class="btn btn-outline btn-sm" data-action="export-data">' + icon('download', 16) + ' تصدير نسخة احتياطية</button><button type="button" class="btn btn-ghost btn-sm" data-action="import-data">' + icon('upload', 16) + ' استيراد نسخة</button><input type="file" id="import-file" accept="application/json,.json" hidden></div>' : '<div class="form-actions"><a class="btn btn-outline btn-sm" href="https://supabase.com/dashboard" target="_blank" rel="noopener">' + icon('external', 16) + ' لوحة Supabase</a></div>') +
      '</section>' +
      '</div>' +

      (mode === 'local' ? '<section class="card danger-zone">' +
        sectionHead('منطقة الخطر', 'عمليات لا يمكن التراجع عنها') +
        '<div class="danger-row"><div><strong>إعادة ضبط البيانات التجريبية</strong><p>سيتم حذف جميع الحسابات والإنجازات الحالية واستبدالها بالبيانات التجريبية الأصلية.</p></div><button type="button" class="btn btn-danger btn-sm" data-action="reset-demo">' + icon('refresh', 16) + ' إعادة الضبط</button></div>' +
        '</section>' : '') +
      '</div>';
  }

  function renderProfilePage() {
    const me = state.me;
    const stats = statsFor(me.id);
    const level = UI.levelFor(stats.points);
    return '<div class="stack-lg">' +
      '<section class="profile-hero card">' +
      UI.avatar(me, 'xl') +
      '<div class="profile-identity"><span class="eyebrow">' + esc(DATA.roles[me.role] ? DATA.roles[me.role].label : me.role) + ' الحلقة</span><h2>' + esc(me.fullName) + '</h2><p>@' + esc(me.username) + ' · <span dir="ltr">' + esc(me.email) + '</span></p></div>' +
      '<div class="profile-level">' + icon(level.current.icon, 18) + '<strong>' + esc(level.current.name) + '</strong><span>' + UI.fmtNum(stats.points) + ' نقطة</span></div>' +
      '</section>' +
      '<div class="grid-2">' +
      '<section class="card">' +
      sectionHead('البيانات الشخصية', 'يمكنك تعديل اسمك ورقم جوالك') +
      '<form data-form="profile" class="form-grid">' +
      '<label class="field field-full"><span class="field-label">الاسم الكامل</span><input type="text" name="fullName" value="' + esc(me.fullName) + '" required></label>' +
      '<label class="field"><span class="field-label">اسم المستخدم</span><input type="text" value="' + esc(me.username) + '" disabled><small>يُعدّل من قِبل المدير</small></label>' +
      '<label class="field"><span class="field-label">البريد الإلكتروني</span><input type="email" value="' + esc(me.email) + '" disabled><small>يُستخدم لتسجيل الدخول</small></label>' +
      '<label class="field"><span class="field-label">رقم الجوال</span><input type="tel" name="phone" value="' + esc(me.phone || '') + '" placeholder="05xxxxxxxx"></label>' +
      '<label class="field"><span class="field-label">الدور</span><input type="text" value="' + esc(DATA.roles[me.role] ? DATA.roles[me.role].label : me.role) + '" disabled></label>' +
      '<div class="form-actions field-full"><button type="submit" class="btn btn-primary">' + icon('save', 18) + ' حفظ البيانات</button></div>' +
      '</form>' +
      '</section>' +
      '<section class="card">' +
      sectionHead('كلمة المرور', 'غيّرها دوريًا للحفاظ على حسابك') +
      '<form data-form="password" class="stack-sm">' +
      '<label class="field"><span class="field-label">كلمة المرور الحالية</span><input type="password" name="current" autocomplete="current-password" required></label>' +
      '<label class="field"><span class="field-label">كلمة المرور الجديدة</span><input type="password" name="next" autocomplete="new-password" minlength="8" required><small>٨ أحرف على الأقل</small></label>' +
      '<label class="field"><span class="field-label">تأكيد كلمة المرور</span><input type="password" name="confirm" autocomplete="new-password" minlength="8" required></label>' +
      '<div class="form-actions"><button type="submit" class="btn btn-primary">' + icon('key', 18) + ' تغيير كلمة المرور</button></div>' +
      '</form>' +
      '</section>' +
      '</div>' +
      '<section class="card">' +
      sectionHead('معلومات الحساب', '') +
      '<div class="account-grid">' +
      '<div><span>تاريخ الانضمام</span><strong>' + UI.fmtDate(me.createdAt) + '</strong></div>' +
      '<div><span>آخر تحديث للبيانات</span><strong>عند كل حفظ</strong></div>' +
      '<div><span>نوع التخزين</span><strong>' + (state.store.mode === 'supabase' ? 'سحابي — Supabase' : 'محلي — هذا المتصفح') + '</strong></div>' +
      '<div><span>حالة الحساب</span><strong>' + (me.active === false ? 'معطّل' : 'نشط') + '</strong></div>' +
      '</div>' +
      '</section>' +
      '</div>';
  }

  /* ==========================================================
     النوافذ المنبثقة
     ========================================================== */
  function achievementModal(options) {
    const opts = options || {};
    const editing = opts.id ? state.achievements.find(function (a) { return a.id === opts.id; }) : null;
    if (opts.id && !editing) { UI.toast('سجل الإنجاز غير موجود.', 'error'); return; }
    const staff = isStaff();
    const studentId = editing ? editing.studentId : (opts.studentId || '');
    const studentOptions = students().map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === studentId ? ' selected' : '') + '>' + esc(s.fullName) + '</option>';
    }).join('');
    const categoryOptions = DATA.categoryList.map(function (c) {
      return '<option value="' + esc(c.key) + '"' + (editing && editing.category === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');
    const points = editing ? editing.points : (staff ? 15 : 10);
    const body = '<form data-form="achievement" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(editing ? editing.id : '') + '">' +
      (staff
        ? '<label class="field"><span class="field-label">الطالب</span><select name="studentId" required><option value="">اختر الطالب…</option>' + studentOptions + '</select></label>'
        : '<input type="hidden" name="studentId" value="' + esc(state.me.id) + '">') +
      '<label class="field"><span class="field-label">عنوان الإنجاز</span><input type="text" name="title" value="' + esc(editing ? editing.title : '') + '" placeholder="مثال: إتمام حفظ سورة الكهف" required maxlength="120"></label>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="field-label">الفئة</span><select name="category" required><option value="">اختر الفئة…</option>' + categoryOptions + '</select></label>' +
      '<label class="field"><span class="field-label">تاريخ الإنجاز</span><input type="date" name="date" value="' + esc(editing ? editing.date : UI.todayISO()) + '" required></label>' +
      (staff ? '<label class="field"><span class="field-label">النقاط</span><input type="number" name="points" min="0" max="1000" step="5" value="' + esc(points) + '" required><small>من ٠ إلى ١٠٠٠</small></label>' : '<input type="hidden" name="points" value="10">') +
      '</div>' +
      '<label class="field"><span class="field-label">وصف الإنجاز</span><textarea name="description" rows="4" placeholder="اكتب تفاصيل مختصرة عمّا أنجزته…" maxlength="800">' + esc(editing ? editing.description : '') + '</textarea></label>' +
      (staff ? '<label class="field"><span class="field-label">ملاحظة المعلم</span><textarea name="teacherNote" rows="3" placeholder="ملاحظة تظهر للطالب مع الإنجاز…" maxlength="600">' + esc(editing ? editing.teacherNote : '') + '</textarea></label>' : '') +
      '<div class="form-note">' + icon('info', 16) + '<span>' + (staff ? 'سيُحفظ الإنجاز معتمدًا ويظهر فورًا في سجل الطالب.' : 'سيُرسل الإنجاز إلى معلمك للاعتماد، وسيحدد هو النقاط النهائية والملاحظة.') + '</span></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('save', 17) + (editing ? ' حفظ التعديل' : ' حفظ الإنجاز') + '</button></div>' +
      '</form>';
    UI.openModal({
      kicker: staff ? 'سجل الطالب' : 'مساحتي',
      title: editing ? 'تعديل الإنجاز' : 'تسجيل إنجاز جديد',
      subtitle: staff ? 'أضف الإنجاز وملاحظتك إلى سجل الطالب.' : 'شارك معلمك بما أنجزته هذا الأسبوع.',
      body: body,
      size: 'md'
    });
  }

  function viewAchievementModal(id) {
    const a = state.achievements.find(function (item) { return item.id === id; });
    if (!a) return;
    const student = userById(a.studentId);
    const teacher = userById(a.teacherId);
    const category = DATA.categories[a.category] || { label: a.category, icon: 'star', tone: 'muted' };
    const body = '<div class="detail-stack">' +
      '<div class="detail-head"><span class="ach-icon tone-' + esc(category.tone) + '">' + icon(category.icon, 24) + '</span><div><h3>' + esc(a.title) + '</h3><div class="ach-meta"><span>' + esc(category.label) + '</span><span>' + icon('calendar', 14) + ' ' + UI.fmtDate(a.date) + '</span><span class="points-chip">' + icon('star', 14) + ' ' + UI.fmtNum(a.points) + ' نقطة</span></div></div>' + UI.statusBadge(a.status) + '</div>' +
      '<div class="detail-grid"><div><span>الطالب</span><strong>' + esc(student ? student.fullName : '—') + '</strong></div><div><span>المعلم</span><strong>' + esc(teacher ? teacher.fullName : '—') + '</strong></div><div><span>تاريخ التسجيل</span><strong>' + UI.fmtDateTime(a.createdAt) + '</strong></div><div><span>آخر تحديث</span><strong>' + UI.fmtDateTime(a.updatedAt || a.createdAt) + '</strong></div></div>' +
      '<div class="detail-block"><span>الوصف</span><p>' + esc(a.description || 'لا يوجد وصف.') + '</p></div>' +
      (a.teacherNote ? '<div class="detail-block note"><span>ملاحظة المعلم</span><p>' + esc(a.teacherNote) + '</p></div>' : '') +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إغلاق</button>' +
      (isStaff() || (state.me.id === a.studentId && a.status === 'pending') ? '<button type="button" class="btn btn-primary" data-action="edit-achievement" data-id="' + esc(a.id) + '">' + icon('edit', 16) + ' تعديل</button>' : '') +
      '</div></div>';
    UI.openModal({ kicker: 'تفاصيل الإنجاز', title: 'سجل الإنجاز', body: body, size: 'md' });
  }

  function reviewModal(id, status) {
    const a = state.achievements.find(function (item) { return item.id === id; });
    if (!a) return;
    const student = userById(a.studentId);
    const approving = status === 'approved';
    const body = '<form data-form="review" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(a.id) + '">' +
      '<input type="hidden" name="status" value="' + esc(status) + '">' +
      '<div class="review-summary"><span class="ach-icon tone-' + esc((DATA.categories[a.category] || {}).tone || 'emerald') + '">' + icon((DATA.categories[a.category] || {}).icon || 'star', 20) + '</span><div><strong>' + esc(a.title) + '</strong><span>' + esc(student ? student.fullName : '') + ' · ' + UI.fmtDate(a.date, true) + ' · ' + UI.fmtNum(a.points) + ' نقطة</span></div></div>' +
      (a.description ? '<p class="review-desc">' + esc(a.description) + '</p>' : '') +
      '<label class="field"><span class="field-label">' + (approving ? 'ملاحظة المعلم (اختياري)' : 'سبب الإعادة للمراجعة') + '</span><textarea name="note" rows="4" placeholder="' + (approving ? 'كلمة تشجيع أو توجيه للطالب…' : 'وضّح للطالب ما يحتاج إلى تعديل…') + '" maxlength="600">' + esc(a.teacherNote || '') + '</textarea></label>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn ' + (approving ? 'btn-success' : 'btn-danger') + '">' + icon(approving ? 'check' : 'x', 17) + (approving ? ' اعتماد الإنجاز' : ' إعادة للمراجعة') + '</button></div>' +
      '</form>';
    UI.openModal({
      kicker: approving ? 'اعتماد إنجاز' : 'مراجعة إنجاز',
      title: approving ? 'اعتماد الإنجاز وإضافة ملاحظة' : 'إعادة الإنجاز للطالب',
      subtitle: approving ? 'سيظهر الإنجاز في سجل الطالب فور الاعتماد.' : 'سيبقى الإنجاز في سجل الطالب بحالة «مُعاد للمراجعة».',
      body: body,
      size: 'md'
    });
  }

  function evaluationModal(options) {
    const opts = options || {};
    const editing = opts.id ? state.evaluations.find(function (e) { return e.id === opts.id; }) : null;
    if (opts.id && !editing) { UI.toast('التقييم غير موجود.', 'error'); return; }
    const studentId = editing ? editing.studentId : (opts.studentId || '');
    const studentOptions = students().map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === studentId ? ' selected' : '') + '>' + esc(s.fullName) + '</option>';
    }).join('');
    const termList = DATA.terms.slice();
    if (editing && !termList.includes(editing.term)) termList.push(editing.term);
    const termOptions = termList.map(function (term) {
      return '<option value="' + esc(term) + '"' + (editing && editing.term === term ? ' selected' : '') + '>' + esc(term) + '</option>';
    }).join('');
    const body = '<form data-form="evaluation" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(editing ? editing.id : '') + '">' +
      '<label class="field"><span class="field-label">الطالب</span><select name="studentId" required><option value="">اختر الطالب…</option>' + studentOptions + '</select></label>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="field-label">الفصل / الدورة</span><select name="term" required>' + termOptions + '</select></label>' +
      '<label class="field"><span class="field-label">التقييم من ١٠٠</span><input type="number" name="score" min="0" max="100" value="' + esc(editing ? editing.score : 85) + '" required></label>' +
      '<label class="field"><span class="field-label">تاريخ التقييم</span><input type="date" name="date" value="' + esc(editing ? editing.date : UI.todayISO()) + '" required></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">الملاحظات والتوجيهات</span><textarea name="notes" rows="5" placeholder="اكتب تقييمك لمستوى الطالب في الحفظ والتلاوة والسلوك والمشاركة…" maxlength="1200">' + esc(editing ? editing.notes : '') + '</textarea></label>' +
      '<div class="form-note">' + icon('info', 16) + '<span>يظهر التقييم للطالب في صفحة «تقييماتي» ويُحتسب في متوسط تقييمه.</span></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('save', 17) + (editing ? ' حفظ التعديل' : ' حفظ التقييم') + '</button></div>' +
      '</form>';
    UI.openModal({
      kicker: 'متابعة المستوى',
      title: editing ? 'تعديل التقييم' : 'تقييم طالب',
      subtitle: 'سجّل مستوى الطالب وملاحظاتك التوجيهية.',
      body: body,
      size: 'md'
    });
  }

  function userModal(options) {
    const opts = options || {};
    const editing = opts.id ? state.directory.find(function (u) { return u.id === opts.id; }) : null;
    if (opts.id && !editing) { UI.toast('الحساب غير موجود.', 'error'); return; }
    const role = editing ? editing.role : (opts.role || 'student');
    const roleOptions = Object.keys(DATA.roles).map(function (key) {
      return '<option value="' + key + '"' + (role === key ? ' selected' : '') + '>' + esc(DATA.roles[key].label) + '</option>';
    }).join('');
    const body = '<form data-form="user" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(editing ? editing.id : '') + '">' +
      '<div class="form-grid">' +
      '<label class="field field-full"><span class="field-label">الاسم الكامل</span><input type="text" name="fullName" value="' + esc(editing ? editing.fullName : '') + '" required maxlength="80"></label>' +
      '<label class="field"><span class="field-label">اسم المستخدم</span><input type="text" name="username" value="' + esc(editing ? editing.username : '') + '" required pattern="[A-Za-z0-9_.-]{3,32}" dir="ltr" placeholder="student9"><small>حروف إنجليزية وأرقام فقط</small></label>' +
      '<label class="field"><span class="field-label">البريد الإلكتروني</span><input type="email" name="email" value="' + esc(editing ? editing.email : '') + '" required dir="ltr" placeholder="name@manara.sa"></label>' +
      '<label class="field"><span class="field-label">رقم الجوال</span><input type="tel" name="phone" value="' + esc(editing ? editing.phone || '' : '') + '" placeholder="05xxxxxxxx"></label>' +
      '<label class="field"><span class="field-label">الدور</span><select name="role" required>' + roleOptions + '</select></label>' +
      '<label class="field field-full"><span class="field-label">' + (editing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور') + '</span><input type="password" name="password" autocomplete="new-password" minlength="8" ' + (editing ? '' : 'required') + ' placeholder="' + (editing ? 'اتركها فارغة للإبقاء على الحالية' : '٨ أحرف على الأقل') + '"><small>' + (state.store.mode === 'supabase' ? 'في النسخة السحابية تُنشأ الحسابات عبر دالة admin-user.' : 'تُحفظ كلمة المرور مشفّرة.') + '</small></label>' +
      '</div>' +
      '<label class="check"><input type="checkbox" name="active" ' + (!editing || editing.active !== false ? 'checked' : '') + '><span>الحساب نشط ويمكنه تسجيل الدخول</span></label>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('save', 17) + (editing ? ' حفظ التعديل' : ' إنشاء الحساب') + '</button></div>' +
      '</form>';
    UI.openModal({
      kicker: 'إدارة الحسابات',
      title: editing ? 'تعديل حساب' : 'إضافة مستخدم جديد',
      subtitle: editing ? 'حدّث بيانات الحساب أو كلمة المرور.' : 'أنشئ حسابًا لطالب أو معلم أو مدير.',
      body: body,
      size: 'md'
    });
  }

  function resetPasswordModal(id) {
    const user = state.directory.find(function (u) { return u.id === id; });
    if (!user) return;
    const body = '<form data-form="reset-password" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(user.id) + '">' +
      '<div class="review-summary">' + UI.avatar(user, 'sm') + '<div><strong>' + esc(user.fullName) + '</strong><span>@' + esc(user.username) + '</span></div></div>' +
      '<label class="field"><span class="field-label">كلمة المرور الجديدة</span><input type="password" name="password" minlength="8" required autocomplete="new-password"><small>٨ أحرف على الأقل. أبلغ المستخدم بالكلمة الجديدة بطريقة آمنة.</small></label>' +
      '<label class="field"><span class="field-label">تأكيد كلمة المرور</span><input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('key', 17) + ' تغيير كلمة المرور</button></div>' +
      '</form>';
    UI.openModal({ kicker: 'أمان الحساب', title: 'تعيين كلمة مرور جديدة', body: body, size: 'sm' });
  }

  function announcementModal(id) {
    const editing = id ? state.announcements.find(function (n) { return n.id === id; }) : null;
    if (id && !editing) return;
    const audienceOptions = Object.keys(DATA.audiences).map(function (key) {
      return '<option value="' + key + '"' + (editing && editing.audience === key ? ' selected' : '') + '>' + esc(DATA.audiences[key]) + '</option>';
    }).join('');
    const body = '<form data-form="announcement" class="stack-sm">' +
      '<input type="hidden" name="id" value="' + esc(editing ? editing.id : '') + '">' +
      '<label class="field"><span class="field-label">عنوان الإعلان</span><input type="text" name="title" value="' + esc(editing ? editing.title : '') + '" required maxlength="120"></label>' +
      '<label class="field"><span class="field-label">نص الإعلان</span><textarea name="body" rows="5" required maxlength="1200">' + esc(editing ? editing.body : '') + '</textarea></label>' +
      '<label class="field"><span class="field-label">الجمهور</span><select name="audience">' + audienceOptions + '</select></label>' +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('save', 17) + (editing ? ' حفظ التعديل' : ' نشر الإعلان') + '</button></div>' +
      '</form>';
    UI.openModal({ kicker: 'لوحة الإعلانات', title: editing ? 'تعديل الإعلان' : 'إعلان جديد', body: body, size: 'md' });
  }

  function aboutModal() {
    const s = state.settings;
    const body = '<div class="about-modal">' +
      '<div class="about-hero"><img src="./assets/logos/manara.svg" alt="" width="64" height="64"><div><h3>' + esc(s.name || 'حلقة المنارة المتقدمة') + '</h3><p>' + esc(s.mosque || 'جامع الراجحي') + ' · ' + esc(s.year || '') + '</p></div></div>' +
      '<p>' + esc(s.description || 'سجل رقمي لإنجازات طلاب الحلقة وتقييمات معلميهم.') + '</p>' +
      '<div class="detail-grid"><div><span>المشرف العام</span><strong>' + esc(s.supervisor || '—') + '</strong></div><div><span>المعلم المسؤول</span><strong>' + esc(s.teacher || '—') + '</strong></div><div><span>موعد الحلقة</span><strong>' + esc(s.schedule || '—') + '</strong></div><div><span>المكان</span><strong>' + esc(s.location || '—') + '</strong></div></div>' +
      '<div class="inline-alert info">' + icon('shield', 18) + '<div><strong>سياسة البيانات</strong><p>' + (state.store.mode === 'supabase' ? 'تُحفظ البيانات في قاعدة بيانات Supabase محمية بصلاحيات RLS، ولا يرى الطالب إلا سجله وتقييماته، بينما يرى المعلم والمدير سجلات الطلاب.' : 'في النسخة المحلية تُحفظ البيانات في localStorage داخل هذا المتصفح فقط، ولا تُرسل إلى أي خادم. لا تستخدمها لبيانات حساسة قبل الانتقال إلى السحابة.') + '</p></div></div>' +
      '<div class="logo-strip logo-strip-auth">' +
      '<div class="logo-item"><img src="./assets/logos/manara.svg" alt=""><span>المنارة الوقفية</span></div>' +
      '<div class="logo-item"><img src="./assets/logos/rajhi.svg" alt=""><span>جامع الراجحي</span></div>' +
      '<div class="logo-item"><img src="./assets/logos/qabas.svg" alt=""><span>قبس للقرآن والسنة والخطابة</span></div>' +
      '</div>' +
      '<div class="form-actions"><button type="button" class="btn btn-primary" data-action="close-modal">إغلاق</button></div>' +
      '</div>';
    UI.openModal({ kicker: 'عن الحلقة', title: 'منارة الحلقة', body: body, size: 'md' });
  }

  function forgotModal() {
    const cloud = state.store.mode === 'supabase';
    const body = cloud
      ? '<form data-form="reset-request" class="stack-sm"><p class="modal-text">أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور عبر Supabase.</p><label class="field"><span class="field-label">البريد الإلكتروني</span><input type="email" name="email" required dir="ltr" placeholder="name@manara.sa"></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">إلغاء</button><button type="submit" class="btn btn-primary">' + icon('mail', 17) + ' إرسال الرابط</button></div></form>'
      : '<div class="stack-sm"><p class="modal-text">في النسخة المحلية لا يوجد بريد لاستعادة كلمة المرور. تواصل مع مدير الحلقة ليعيّن لك كلمة مرور جديدة من صفحة «المستخدمون».</p><div class="inline-alert warning">' + icon('info', 18) + '<div><strong>للمدير</strong><p>افتح «المستخدمون» ثم اختر أيقونة المفتاح بجانب الحساب لتعيين كلمة مرور جديدة.</p></div></div><div class="form-actions"><button type="button" class="btn btn-primary" data-action="close-modal">فهمت</button></div></div>';
    UI.openModal({ kicker: 'استعادة الحساب', title: 'نسيت كلمة المرور؟', body: body, size: 'sm' });
  }

  function guideModal() {
    const body = '<div class="guide-modal">' +
      '<p class="modal-text">هذا الموقع جاهز للعمل محليًا، ويمكن ربطه بـ Supabase ثم استضافته على أي خدمة استضافة ثابتة.</p>' +
      '<ol class="guide-steps"><li><strong>محليًا:</strong> افتح <code>index.html</code> مباشرة أو عبر خادم محلي. البيانات تُحفظ في localStorage.</li><li><strong>السحابة:</strong> أنشئ مشروع Supabase، ثم نفّذ <code>supabase/schema.sql</code> من SQL Editor.</li><li>أنشئ حساب المدير من Authentication > Users، ثم حدّث دوره إلى <code>admin</code> كما في README.</li><li>ضع <code>supabaseUrl</code> و<code>supabaseAnonKey</code> في <code>js/config.js</code>.</li><li>انشر مجلد المشروع على Netlify أو Vercel أو Cloudflare Pages أو GitHub Pages.</li></ol>' +
      '<div class="form-actions"><button type="button" class="btn btn-primary" data-action="close-modal">إغلاق</button></div></div>';
    UI.openModal({ kicker: 'دليل سريع', title: 'من المحلي إلى السحابة', body: body, size: 'md' });
  }

  /* ==========================================================
     الأحداث
     ========================================================== */
  async function handleAction(actionEl) {
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    const studentId = actionEl.dataset.student;

    switch (action) {
      case 'toggle-sidebar': {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('open');
        document.body.classList.toggle('nav-open');
        break;
      }
      case 'logout': {
        await state.store.logout();
        state.me = null;
        state.directory = [];
        state.achievements = [];
        state.evaluations = [];
        state.announcements = [];
        state.leaderboard = [];
        try { history.replaceState(null, '', '#/login'); } catch (err) { location.hash = '#/login'; }
        renderAuth();
        UI.toast('تم تسجيل الخروج بنجاح.', 'info');
        break;
      }
      case 'retry-boot':
        boot();
        break;
      case 'use-local':
        CFG.mode = 'local';
        boot();
        break;
      case 'fill-demo': {
        const userInput = document.getElementById('login-identifier');
        const passInput = document.getElementById('login-password');
        if (userInput && passInput) {
          userInput.value = actionEl.dataset.username || '';
          passInput.value = actionEl.dataset.password || '';
          passInput.focus();
        }
        break;
      }
      case 'toggle-password': {
        const target = document.getElementById(actionEl.dataset.target);
        if (target) {
          const show = target.type === 'password';
          target.type = show ? 'text' : 'password';
          actionEl.innerHTML = icon(show ? 'eye-off' : 'eye', 18);
          actionEl.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
        }
        break;
      }
      case 'forgot-password':
        forgotModal();
        break;
      case 'open-about':
        aboutModal();
        break;
      case 'open-guide':
        guideModal();
        break;
      case 'close-modal':
        UI.closeModal();
        break;
      case 'open-announcements':
        navigate('#/announcements');
        break;
      case 'add-achievement':
        achievementModal({ studentId: studentId || '' });
        break;
      case 'edit-achievement':
        achievementModal({ id: id });
        break;
      case 'view-achievement':
        viewAchievementModal(id);
        break;
      case 'delete-achievement': {
        const ok = await UI.confirmDialog({
          title: 'حذف الإنجاز؟',
          message: 'سيُحذف هذا الإنجاز نهائيًا من سجل الطالب. لا يمكن التراجع.',
          confirmLabel: 'حذف الإنجاز',
          tone: 'danger',
          icon: 'trash'
        });
        if (!ok) break;
        try {
          await state.store.deleteAchievement(id);
          await commit('تم حذف الإنجاز.');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'review-achievement':
        reviewModal(id, actionEl.dataset.status || 'approved');
        break;
      case 'add-evaluation':
        evaluationModal({ studentId: studentId || '' });
        break;
      case 'edit-evaluation':
        evaluationModal({ id: id });
        break;
      case 'delete-evaluation': {
        const ok = await UI.confirmDialog({
          title: 'حذف التقييم؟',
          message: 'سيُحذف هذا التقييم نهائيًا من سجل الطالب.',
          confirmLabel: 'حذف التقييم',
          tone: 'danger',
          icon: 'trash'
        });
        if (!ok) break;
        try {
          await state.store.deleteEvaluation(id);
          await commit('تم حذف التقييم.');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'add-user':
        userModal({ role: actionEl.dataset.role || 'student' });
        break;
      case 'edit-user':
        userModal({ id: id });
        break;
      case 'reset-password':
        resetPasswordModal(id);
        break;
      case 'toggle-user': {
        const user = state.directory.find(function (u) { return u.id === id; });
        if (!user) break;
        const activating = user.active === false;
        const ok = await UI.confirmDialog({
          title: activating ? 'تفعيل الحساب؟' : 'تعطيل الحساب؟',
          message: activating ? 'سيتمكن المستخدم من تسجيل الدخول مرة أخرى.' : 'لن يتمكن المستخدم من تسجيل الدخول حتى تعيد تفعيله. ستبقى سجلاته محفوظة.',
          confirmLabel: activating ? 'تفعيل' : 'تعطيل',
          tone: activating ? 'success' : 'danger',
          icon: activating ? 'check' : 'x'
        });
        if (!ok) break;
        try {
          await state.store.updateUser(id, { active: activating });
          await commit(activating ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب.');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'delete-user': {
        const user = state.directory.find(function (u) { return u.id === id; });
        if (!user) break;
        const deletingStudent = user.role === 'student';
        const ok = await UI.confirmDialog({
          title: 'حذف الحساب نهائيًا؟',
          message: deletingStudent
            ? 'سيُحذف حساب ' + user.fullName + ' وجميع إنجازاته وتقييماته. لا يمكن التراجع عن هذه العملية.'
            : 'سيُحذف حساب ' + user.fullName + ' نهائيًا، وستبقى إنجازات الطلاب وتقييماتهم محفوظة مع إزالة اسمه من الإشراف عليها.',
          confirmLabel: 'حذف الحساب',
          tone: 'danger',
          icon: 'trash'
        });
        if (!ok) break;
        try {
          await state.store.deleteUser(id);
          await commit('تم حذف الحساب.');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'add-announcement':
        announcementModal();
        break;
      case 'edit-announcement':
        announcementModal(id);
        break;
      case 'delete-announcement': {
        const ok = await UI.confirmDialog({
          title: 'حذف الإعلان؟',
          message: 'سيُحذف الإعلان من صفحة الإعلانات نهائيًا.',
          confirmLabel: 'حذف',
          tone: 'danger',
          icon: 'trash'
        });
        if (!ok) break;
        try {
          await state.store.deleteAnnouncement(id);
          await commit('تم حذف الإعلان.');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'print-record':
        window.print();
        break;
      case 'export-data': {
        try {
          const data = await state.store.exportData();
          UI.downloadFile('manara-halaqa-backup-' + UI.todayISO() + '.json', JSON.stringify(data, null, 2));
          UI.toast('تم تصدير النسخة الاحتياطية.', 'success');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'import-data': {
        const input = document.getElementById('import-file');
        if (input) input.click();
        break;
      }
      case 'reset-demo': {
        const ok = await UI.confirmDialog({
          title: 'إعادة ضبط البيانات؟',
          message: 'سيتم حذف جميع الحسابات والإنجازات الحالية واستبدالها بالبيانات التجريبية. صدّر نسخة احتياطية أولًا إن كنت تحتاجها.',
          confirmLabel: 'إعادة الضبط',
          tone: 'danger',
          icon: 'refresh'
        });
        if (!ok) break;
        try {
          await state.store.resetDemo();
          await refreshData();
          state.me = await state.store.getSession();
          if (!state.me) { renderAuth(); break; }
          renderShell();
          UI.toast('تمت إعادة البيانات التجريبية.', 'success');
        } catch (error) { UI.toast(error.message, 'error'); }
        break;
      }
      case 'copy-text': {
        const value = actionEl.dataset.text || '';
        try {
          await navigator.clipboard.writeText(value);
          UI.toast('تم النسخ.', 'info');
        } catch (error) { UI.toast('تعذر النسخ تلقائيًا.', 'error'); }
        break;
      }
      default:
        break;
    }
  }

  document.addEventListener('click', function (event) {
    const backdrop = event.target.closest('[data-modal-backdrop]');
    if (backdrop && !event.target.closest('.modal-card')) {
      UI.closeModal();
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    event.preventDefault();
    handleAction(actionEl).catch(function (error) {
      UI.toast(error.message || 'حدث خطأ غير متوقع.', 'error');
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (document.getElementById('modal-root').children.length) UI.closeModal();
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        document.body.classList.remove('nav-open');
      }
    }
  });

  document.addEventListener('submit', async function (event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    UI.clearFormError(form);
    UI.setBusy(form, true);
    const fd = new FormData(form);
    const kind = form.dataset.form;

    try {
      if (kind === 'login') {
        const identifier = String(fd.get('identifier') || '').trim();
        const password = String(fd.get('password') || '');
        if (!identifier || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور.');
        state.me = await state.store.login(identifier, password, fd.get('remember') === 'on');
        await refreshData();
        try { history.replaceState(null, '', '#/dashboard'); } catch (err) { location.hash = '#/dashboard'; }
        state.route = parseRoute();
        render();
        UI.toast('أهلًا بك، ' + UI.firstName(state.me.fullName) + '.', 'success');
      }

      if (kind === 'achievement') {
        const payload = {
          id: String(fd.get('id') || '') || undefined,
          studentId: String(fd.get('studentId') || ''),
          title: String(fd.get('title') || ''),
          category: String(fd.get('category') || ''),
          date: String(fd.get('date') || ''),
          points: Number(fd.get('points') || 0),
          description: String(fd.get('description') || ''),
          teacherNote: String(fd.get('teacherNote') || '')
        };
        await state.store.saveAchievement(payload);
        UI.closeModal();
        await commit(state.me.role === 'student' ? 'أُرسل الإنجاز إلى معلمك للاعتماد.' : 'تم حفظ الإنجاز في سجل الطالب.');
      }

      if (kind === 'review') {
        await state.store.reviewAchievement(String(fd.get('id')), String(fd.get('status')), String(fd.get('note') || ''));
        UI.closeModal();
        await commit(String(fd.get('status')) === 'approved' ? 'تم اعتماد الإنجاز.' : 'تمت إعادة الإنجاز للطالب.');
      }

      if (kind === 'evaluation') {
        await state.store.saveEvaluation({
          id: String(fd.get('id') || '') || undefined,
          studentId: String(fd.get('studentId') || ''),
          term: String(fd.get('term') || ''),
          score: Number(fd.get('score') || 0),
          date: String(fd.get('date') || ''),
          notes: String(fd.get('notes') || '')
        });
        UI.closeModal();
        await commit('تم حفظ التقييم.');
      }

      if (kind === 'user') {
        const userId = String(fd.get('id') || '');
        const password = String(fd.get('password') || '');
        const payload = {
          fullName: String(fd.get('fullName') || ''),
          username: String(fd.get('username') || ''),
          email: String(fd.get('email') || ''),
          phone: String(fd.get('phone') || ''),
          role: String(fd.get('role') || 'student'),
          active: fd.get('active') === 'on'
        };
        if (userId) {
          await state.store.updateUser(userId, payload);
          if (password) await state.store.resetPassword(userId, password);
          UI.closeModal();
          await commit('تم تحديث الحساب.');
        } else {
          payload.password = password;
          await state.store.createUser(payload);
          UI.closeModal();
          await commit('تم إنشاء الحساب بنجاح.');
        }
      }

      if (kind === 'reset-password') {
        const password = String(fd.get('password') || '');
        const confirm = String(fd.get('confirm') || '');
        if (password !== confirm) throw new Error('كلمتا المرور غير متطابقتين.');
        await state.store.resetPassword(String(fd.get('id')), password);
        UI.closeModal();
        UI.toast('تم تعيين كلمة المرور الجديدة.', 'success');
      }

      if (kind === 'announcement') {
        await state.store.saveAnnouncement({
          id: String(fd.get('id') || '') || undefined,
          title: String(fd.get('title') || ''),
          body: String(fd.get('body') || ''),
          audience: String(fd.get('audience') || 'all')
        });
        UI.closeModal();
        await commit('تم نشر الإعلان.');
      }

      if (kind === 'profile') {
        await state.store.updateUser(state.me.id, {
          fullName: String(fd.get('fullName') || ''),
          phone: String(fd.get('phone') || '')
        });
        await commit('تم تحديث بياناتك.');
      }

      if (kind === 'password') {
        const next = String(fd.get('next') || '');
        const confirm = String(fd.get('confirm') || '');
        if (next !== confirm) throw new Error('كلمتا المرور الجديدتان غير متطابقتين.');
        await state.store.changePassword(String(fd.get('current') || ''), next);
        form.reset();
        UI.toast('تم تغيير كلمة المرور بنجاح.', 'success');
      }

      if (kind === 'settings') {
        await state.store.updateSettings({
          name: String(fd.get('name') || ''),
          mosque: String(fd.get('mosque') || ''),
          association: String(fd.get('association') || ''),
          supervisor: String(fd.get('supervisor') || ''),
          teacher: String(fd.get('teacher') || ''),
          year: String(fd.get('year') || ''),
          schedule: String(fd.get('schedule') || ''),
          location: String(fd.get('location') || ''),
          description: String(fd.get('description') || '')
        });
        await commit('تم حفظ إعدادات الحلقة.');
      }

      if (kind === 'reset-request') {
        await state.store.requestPasswordReset(String(fd.get('email') || ''));
        UI.closeModal();
        UI.toast('أُرسل رابط إعادة التعيين إلى بريدك.', 'success');
      }
    } catch (error) {
      UI.formError(form, error.message || 'تعذر إتمام العملية.');
    } finally {
      UI.setBusy(form, false);
    }
  });

  const debouncedFilter = UI.debounce(renderViewPreserveFocus, 180);

  document.addEventListener('input', function (event) {
    const el = event.target.closest('[data-filter]');
    if (!el || el.tagName === 'SELECT') return;
    const key = el.dataset.filter;
    if (key === 'ach-q') state.filters.achievements.q = el.value;
    if (key === 'eval-q') state.filters.evaluations.q = el.value;
    if (key === 'student-q') state.filters.students.q = el.value;
    if (key === 'user-q') state.filters.users.q = el.value;
    debouncedFilter();
  });

  document.addEventListener('change', async function (event) {
    const el = event.target.closest('[data-filter]');
    if (el && el.tagName === 'SELECT') {
      const key = el.dataset.filter;
      if (key === 'ach-status') state.filters.achievements.status = el.value;
      if (key === 'ach-category') state.filters.achievements.category = el.value;
      if (key === 'ach-student') state.filters.achievements.student = el.value;
      if (key === 'eval-student') state.filters.evaluations.student = el.value;
      if (key === 'user-role') state.filters.users.role = el.value;
      renderViewPreserveFocus();
      return;
    }

    if (event.target.id === 'import-file') {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      try {
        const raw = await UI.readFile(file);
        const data = JSON.parse(raw);
        const ok = await UI.confirmDialog({
          title: 'استيراد نسخة احتياطية؟',
          message: 'سيتم استبدال جميع البيانات الحالية ببيانات الملف. تأكد من أن الملف هو النسخة الصحيحة.',
          confirmLabel: 'استيراد',
          tone: 'danger',
          icon: 'upload'
        });
        if (!ok) return;
        await state.store.importData(data);
        await refreshData();
        state.me = await state.store.getSession();
        if (!state.me) { renderAuth(); return; }
        renderShell();
        UI.toast('تم استيراد البيانات بنجاح.', 'success');
      } catch (error) {
        UI.toast(error.message || 'تعذر قراءة ملف النسخة الاحتياطية.', 'error');
      }
    }
  });

  window.addEventListener('hashchange', function () {
    if (!state.me) {
      renderAuth();
      return;
    }
    renderShell();
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    document.body.classList.remove('nav-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  boot();
})();

