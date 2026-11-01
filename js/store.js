/* ============================================================
   طبقة البيانات: تخزين محلي (localStorage) + Supabase
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.MANARA_CONFIG;
  const DATA = window.MANARA_DATA;
  const DB_KEY = CFG.local.databaseKey;
  const SESSION_KEY = CFG.local.sessionKey;
  const TEMP_SESSION_KEY = CFG.local.tempSessionKey;

  class StoreError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'StoreError';
      this.code = code || 'error';
    }
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowISO() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }

  function normalizeLegacyBranding(settings) {
    if (!settings) return settings;
    const normalized = Object.assign({}, settings);
    if (normalized.mosque === 'جامع الراجحي') {
      normalized.mosque = 'حلقات جامع الراجحي';
    }
    if (normalized.location === 'جامع الراجحي — القاعة الشرقية') {
      normalized.location = 'حلقات جامع الراجحي — القاعة الشرقية';
    }
    if (normalized.description && normalized.description.indexOf('لطلاب جامع الراجحي') !== -1) {
      normalized.description = normalized.description.replace('لطلاب جامع الراجحي', 'لطلاب حلقات جامع الراجحي');
    }
    return normalized;
  }

  function randomId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return (prefix || 'id_') + window.crypto.randomUUID();
    }
    return (prefix || 'id_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function randomSalt() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function fallbackHash(value) {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < value.length; i += 1) {
      const c = value.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= c + i;
      h2 = Math.imul(h2, 0x85ebca6b);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  async function hashPassword(password, salt) {
    const value = salt + ':' + password;
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      try {
        const encoded = new TextEncoder().encode(value);
        const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(buffer), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (err) {
        /* المتصفحات القديمة أو السياقات غير الآمنة */
      }
    }
    return fallbackHash(value);
  }

  function sanitizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      active: user.active !== false,
      createdAt: user.createdAt
    };
  }

  function normalizeProfile(row) {
    return {
      id: row.id,
      role: row.role,
      fullName: row.full_name,
      username: row.username,
      email: row.email || '',
      phone: row.phone || '',
      active: row.active !== false,
      createdAt: row.created_at
    };
  }

  function normalizeAchievement(row) {
    return {
      id: row.id,
      studentId: row.student_id,
      teacherId: row.teacher_id,
      title: row.title,
      category: row.category,
      date: row.achievement_date,
      points: Number(row.points) || 0,
      description: row.description || '',
      teacherNote: row.teacher_note || '',
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at
    };
  }

  function normalizeEvaluation(row) {
    return {
      id: row.id,
      studentId: row.student_id,
      teacherId: row.teacher_id,
      term: row.term,
      score: Number(row.score) || 0,
      notes: row.notes || '',
      date: row.evaluation_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function normalizeAnnouncement(row) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  }

  function validateUsername(username) {
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      throw new StoreError('اسم المستخدم يجب أن يكون ٣ إلى ٣٢ حرفًا إنجليزيًا أو رقمًا أو ( _ . - ).', 'validation');
    }
  }
  function validateEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new StoreError('صيغة البريد الإلكتروني غير صحيحة.', 'validation');
    }
  }
  function validatePassword(password) {
    if (!password || password.length < 8) {
      throw new StoreError('كلمة المرور يجب أن تكون ٨ أحرف على الأقل.', 'validation');
    }
  }

  async function buildSeedDatabase() {
    const db = clone(DATA.seed);
    for (const user of db.users) {
      user.salt = randomSalt();
      user.passwordHash = await hashPassword(user.password, user.salt);
      delete user.password;
    }
    db.meta = { createdAt: nowISO(), seeded: true };
    return db;
  }

  function readJSON(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /* ==========================================================
     المتجر المحلي
     ========================================================== */
  class LocalStore {
    constructor() {
      this.mode = 'local';
      this.db = null;
      this.session = null;
      this.listeners = [];
      this.bound = false;
    }

    async init() {
      const existing = readJSON(localStorage, DB_KEY);
      if (!existing || !Array.isArray(existing.users) || !existing.users.length) {
        this.db = await buildSeedDatabase();
        this.persist();
      } else {
        this.db = existing;
        if (!this.db.settings) this.db.settings = clone(DATA.seed.settings);
        if (!Array.isArray(this.db.announcements)) this.db.announcements = [];
      }

      const saved = readJSON(localStorage, SESSION_KEY) || readJSON(sessionStorage, TEMP_SESSION_KEY);
      if (saved && saved.userId) {
        const user = this.db.users.find(function (u) { return u.id === saved.userId; });
        if (user && user.active !== false) {
          this.session = sanitizeUser(user);
        } else {
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(TEMP_SESSION_KEY);
        }
      }

      if (!this.bound) {
        this.bound = true;
        window.addEventListener('storage', (event) => {
          if (event.key === DB_KEY) {
            const next = readJSON(localStorage, DB_KEY);
            if (next && Array.isArray(next.users)) {
              this.db = next;
              if (this.session) {
                const fresh = this.db.users.find((u) => u.id === this.session.id);
                this.session = fresh && fresh.active !== false ? sanitizeUser(fresh) : null;
              }
              this.emit();
            }
          }
        });
      }
      return this;
    }

    persist() {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(this.db));
      } catch (err) {
        throw new StoreError('تعذر حفظ البيانات في المتصفح. قد تكون مساحة التخزين ممتلئة.', 'storage');
      }
    }

    emit() {
      this.listeners.forEach(function (fn) {
        try { fn(); } catch (err) { /* تجاهل */ }
      });
    }

    subscribe(callback) {
      this.listeners.push(callback);
      return function () {
        const index = this.listeners.indexOf(callback);
        if (index >= 0) this.listeners.splice(index, 1);
      }.bind(this);
    }

    requireSession() {
      if (!this.session) throw new StoreError('انتهت الجلسة. سجّل الدخول من جديد.', 'auth');
      return this.session;
    }

    requireStaff() {
      const me = this.requireSession();
      if (me.role !== 'teacher' && me.role !== 'admin') {
        throw new StoreError('هذه العملية متاحة للمعلمين والمدير فقط.', 'forbidden');
      }
      return me;
    }

    requireAdmin() {
      const me = this.requireSession();
      if (me.role !== 'admin') throw new StoreError('هذه العملية متاحة للمدير فقط.', 'forbidden');
      return me;
    }

    async login(identifier, password, remember) {
      const key = lower(identifier);
      const user = this.db.users.find(function (u) {
        return lower(u.username) === key || lower(u.email) === key;
      });
      if (!user || user.active === false) {
        throw new StoreError('اسم المستخدم أو البريد الإلكتروني غير صحيح.', 'auth');
      }
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        throw new StoreError('كلمة المرور غير صحيحة. تحقق منها وحاول مرة أخرى.', 'auth');
      }
      this.session = sanitizeUser(user);
      const payload = JSON.stringify({ userId: user.id, at: nowISO() });
      if (remember === false) {
        sessionStorage.setItem(TEMP_SESSION_KEY, payload);
        localStorage.removeItem(SESSION_KEY);
      } else {
        localStorage.setItem(SESSION_KEY, payload);
        sessionStorage.removeItem(TEMP_SESSION_KEY);
      }
      this.emit();
      return this.session;
    }

    async getSession() {
      return this.session;
    }

    async logout() {
      this.session = null;
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TEMP_SESSION_KEY);
      this.emit();
    }

    async listUsers(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      let users = this.db.users.slice();
      if (me.role === 'student') {
        users = users.filter(function (u) {
          return u.id === me.id || u.role === 'teacher';
        });
      }
      if (opts.role && opts.role !== 'all') users = users.filter(function (u) { return u.role === opts.role; });
      if (opts.active !== undefined) users = users.filter(function (u) { return (u.active !== false) === opts.active; });
      const q = lower(opts.query);
      if (q) {
        users = users.filter(function (u) {
          return lower(u.fullName).includes(q) || lower(u.username).includes(q) || lower(u.email).includes(q);
        });
      }
      users.sort(function (a, b) { return a.fullName.localeCompare(b.fullName, 'ar'); });
      return users.map(function (u) {
        const safe = sanitizeUser(u);
        if (me.role === 'student' && u.id !== me.id) {
          safe.email = '';
          safe.phone = '';
        }
        return safe;
      });
    }

    async getUser(id) {
      const me = this.requireSession();
      const user = this.db.users.find(function (u) { return u.id === id; });
      if (!user) return null;
      if (me.role === 'student' && user.id !== me.id && user.role !== 'teacher') {
        throw new StoreError('لا تملك صلاحية عرض هذا الحساب.', 'forbidden');
      }
      const safe = sanitizeUser(user);
      if (me.role === 'student' && user.id !== me.id) {
        safe.email = '';
        safe.phone = '';
      }
      return safe;
    }

    async createUser(payload) {
      this.requireAdmin();
      const fullName = text(payload.fullName);
      const username = text(payload.username);
      const email = lower(payload.email);
      const role = payload.role;
      const password = payload.password || '';
      if (fullName.length < 3) throw new StoreError('الاسم الكامل مطلوب (٣ أحرف على الأقل).', 'validation');
      validateUsername(username);
      validateEmail(email);
      validatePassword(password);
      if (!DATA.roles[role]) throw new StoreError('الدور المحدد غير صحيح.', 'validation');
      if (this.db.users.some(function (u) { return lower(u.username) === lower(username); })) {
        throw new StoreError('اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.', 'validation');
      }
      if (this.db.users.some(function (u) { return lower(u.email) === email; })) {
        throw new StoreError('البريد الإلكتروني مسجل بالفعل.', 'validation');
      }
      const salt = randomSalt();
      const user = {
        id: randomId('u_'),
        role: role,
        fullName: fullName,
        username: username,
        email: email,
        phone: text(payload.phone),
        salt: salt,
        passwordHash: await hashPassword(password, salt),
        active: payload.active !== false,
        createdAt: nowISO()
      };
      this.db.users.push(user);
      this.persist();
      this.emit();
      return sanitizeUser(user);
    }

    async updateUser(id, patch) {
      const me = this.requireSession();
      const user = this.db.users.find(function (u) { return u.id === id; });
      if (!user) throw new StoreError('الحساب غير موجود.', 'notfound');
      const isSelf = me.id === id;
      if (!isSelf && me.role !== 'admin') throw new StoreError('لا تملك صلاحية تعديل هذا الحساب.', 'forbidden');

      if (patch.fullName !== undefined) {
        const value = text(patch.fullName);
        if (value.length < 3) throw new StoreError('الاسم الكامل قصير جدًا.', 'validation');
        user.fullName = value;
      }
      if (patch.phone !== undefined) user.phone = text(patch.phone);

      if (me.role === 'admin') {
        if (patch.username !== undefined) {
          const value = text(patch.username);
          validateUsername(value);
          if (this.db.users.some(function (u) { return u.id !== id && lower(u.username) === lower(value); })) {
            throw new StoreError('اسم المستخدم مستخدم بالفعل.', 'validation');
          }
          user.username = value;
        }
        if (patch.email !== undefined) {
          const value = lower(patch.email);
          validateEmail(value);
          if (this.db.users.some(function (u) { return u.id !== id && lower(u.email) === value; })) {
            throw new StoreError('البريد الإلكتروني مسجل بالفعل.', 'validation');
          }
          user.email = value;
        }
        if (patch.role !== undefined) {
          if (!DATA.roles[patch.role]) throw new StoreError('الدور غير صحيح.', 'validation');
          if (isSelf && patch.role !== 'admin') {
            throw new StoreError('لا يمكنك إزالة دور المدير عن حسابك الحالي.', 'validation');
          }
          user.role = patch.role;
        }
        if (patch.active !== undefined) {
          if (isSelf && patch.active === false) {
            throw new StoreError('لا يمكنك تعطيل حسابك الحالي.', 'validation');
          }
          user.active = patch.active !== false;
        }
      }

      user.updatedAt = nowISO();
      this.persist();
      if (isSelf) this.session = sanitizeUser(user);
      this.emit();
      return sanitizeUser(user);
    }

    async changePassword(currentPassword, newPassword) {
      const me = this.requireSession();
      const user = this.db.users.find(function (u) { return u.id === me.id; });
      validatePassword(newPassword);
      const currentHash = await hashPassword(currentPassword, user.salt);
      if (currentHash !== user.passwordHash) {
        throw new StoreError('كلمة المرور الحالية غير صحيحة.', 'auth');
      }
      user.salt = randomSalt();
      user.passwordHash = await hashPassword(newPassword, user.salt);
      user.updatedAt = nowISO();
      this.persist();
      this.emit();
      return true;
    }

    async resetPassword(id, newPassword) {
      this.requireAdmin();
      const user = this.db.users.find(function (u) { return u.id === id; });
      if (!user) throw new StoreError('الحساب غير موجود.', 'notfound');
      validatePassword(newPassword);
      user.salt = randomSalt();
      user.passwordHash = await hashPassword(newPassword, user.salt);
      user.updatedAt = nowISO();
      this.persist();
      this.emit();
      return true;
    }

    async deleteUser(id) {
      const me = this.requireAdmin();
      if (id === me.id) throw new StoreError('لا يمكنك حذف حسابك الحالي.', 'validation');
      const user = this.db.users.find(function (u) { return u.id === id; });
      if (!user) throw new StoreError('الحساب غير موجود.', 'notfound');
      const deletingStudent = user.role === 'student';

      this.db.users = this.db.users.filter(function (u) { return u.id !== id; });

      if (deletingStudent) {
        /* حذف الطالب يعني حذف سجله الشخصي كاملًا */
        this.db.achievements = this.db.achievements.filter(function (a) { return a.studentId !== id; });
        this.db.evaluations = this.db.evaluations.filter(function (e) { return e.studentId !== id; });
      } else {
        /* حذف معلم أو مدير لا يحذف إنجازات الطلاب؛ نزيل الإشارة إلى الحساب فقط */
        this.db.achievements.forEach(function (a) {
          if (a.teacherId === id) a.teacherId = null;
        });
        this.db.evaluations.forEach(function (e) {
          if (e.teacherId === id) e.teacherId = null;
        });
      }

      this.db.announcements.forEach(function (n) {
        if (n.createdBy === id) n.createdBy = me.id;
      });
      this.persist();
      this.emit();
      return true;
    }

    async listAchievements(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      let rows = this.db.achievements.slice();
      if (me.role === 'student') {
        rows = rows.filter(function (a) { return a.studentId === me.id; });
      } else if (opts.studentId) {
        rows = rows.filter(function (a) { return a.studentId === opts.studentId; });
      }
      if (opts.status && opts.status !== 'all') rows = rows.filter(function (a) { return a.status === opts.status; });
      if (opts.category && opts.category !== 'all') rows = rows.filter(function (a) { return a.category === opts.category; });
      const q = lower(opts.query);
      if (q) {
        rows = rows.filter(function (a) {
          return lower(a.title).includes(q) || lower(a.description).includes(q) || lower(a.teacherNote).includes(q);
        });
      }
      rows.sort(function (a, b) {
        const dateDiff = String(b.date).localeCompare(String(a.date));
        if (dateDiff !== 0) return dateDiff;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
      return rows.map(function (a) { return Object.assign({}, a); });
    }

    async saveAchievement(payload) {
      const me = this.requireSession();
      const existing = payload.id ? this.db.achievements.find(function (a) { return a.id === payload.id; }) : null;
      if (payload.id && !existing) throw new StoreError('سجل الإنجاز غير موجود.', 'notfound');

      if (existing) {
        const ownerPending = existing.studentId === me.id && existing.status === 'pending';
        if (me.role === 'student' && !ownerPending) {
          throw new StoreError('لا يمكنك تعديل إنجاز بعد اعتماده.', 'forbidden');
        }
        if (me.role !== 'student' && me.role !== 'teacher' && me.role !== 'admin') {
          throw new StoreError('لا تملك صلاحية التعديل.', 'forbidden');
        }
      }

      const title = text(payload.title);
      const category = payload.category;
      const date = payload.date || todayISO();
      const points = Number(payload.points);
      const description = text(payload.description);
      if (title.length < 3) throw new StoreError('عنوان الإنجاز مطلوب (٣ أحرف على الأقل).', 'validation');
      if (!DATA.categories[category]) throw new StoreError('اختر فئة الإنجاز.', 'validation');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new StoreError('تاريخ الإنجاز غير صحيح.', 'validation');
      if (!Number.isFinite(points) || points < 0 || points > 1000) {
        throw new StoreError('النقاط يجب أن تكون بين ٠ و١٠٠٠.', 'validation');
      }

      let studentId = payload.studentId;
      let teacherId = payload.teacherId || null;
      let status = payload.status || 'pending';
      let teacherNote = text(payload.teacherNote);

      if (me.role === 'student') {
        studentId = me.id;
        teacherId = null;
        status = 'pending';
        teacherNote = '';
      } else {
        const student = this.db.users.find(function (u) { return u.id === studentId; });
        if (!student || student.role !== 'student') throw new StoreError('اختر طالبًا صحيحًا.', 'validation');
        teacherId = teacherId || me.id;
        if (status === 'pending') status = 'approved';
      }

      if (existing) {
        existing.title = title;
        existing.category = category;
        existing.date = date;
        existing.points = points;
        existing.description = description;
        existing.updatedAt = nowISO();
        if (me.role !== 'student') {
          existing.teacherNote = teacherNote;
          if (existing.status === 'pending' && status === 'approved') {
            existing.status = 'approved';
            existing.reviewedAt = nowISO();
            existing.teacherId = teacherId;
          }
        }
        this.persist();
        this.emit();
        return Object.assign({}, existing);
      }

      const achievement = {
        id: randomId('a_'),
        studentId: studentId,
        teacherId: teacherId,
        title: title,
        category: category,
        date: date,
        points: points,
        description: description,
        teacherNote: teacherNote,
        status: status,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        reviewedAt: status === 'approved' && me.role !== 'student' ? nowISO() : null
      };
      this.db.achievements.push(achievement);
      this.persist();
      this.emit();
      return Object.assign({}, achievement);
    }

    async reviewAchievement(id, status, note) {
      const me = this.requireStaff();
      if (status !== 'approved' && status !== 'rejected') {
        throw new StoreError('حالة المراجعة غير صحيحة.', 'validation');
      }
      const achievement = this.db.achievements.find(function (a) { return a.id === id; });
      if (!achievement) throw new StoreError('سجل الإنجاز غير موجود.', 'notfound');
      achievement.status = status;
      achievement.teacherNote = text(note);
      achievement.teacherId = achievement.teacherId || me.id;
      achievement.reviewedAt = nowISO();
      achievement.updatedAt = nowISO();
      this.persist();
      this.emit();
      return Object.assign({}, achievement);
    }

    async deleteAchievement(id) {
      const me = this.requireSession();
      const achievement = this.db.achievements.find(function (a) { return a.id === id; });
      if (!achievement) throw new StoreError('سجل الإنجاز غير موجود.', 'notfound');
      const ownerPending = achievement.studentId === me.id && achievement.status === 'pending';
      if (me.role !== 'admin' && me.role !== 'teacher' && !ownerPending) {
        throw new StoreError('لا تملك صلاحية حذف هذا السجل.', 'forbidden');
      }
      this.db.achievements = this.db.achievements.filter(function (a) { return a.id !== id; });
      this.persist();
      this.emit();
      return true;
    }

    async listEvaluations(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      let rows = this.db.evaluations.slice();
      if (me.role === 'student') {
        rows = rows.filter(function (e) { return e.studentId === me.id; });
      } else if (opts.studentId) {
        rows = rows.filter(function (e) { return e.studentId === opts.studentId; });
      }
      rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      return rows.map(function (e) { return Object.assign({}, e); });
    }

    async saveEvaluation(payload) {
      const me = this.requireStaff();
      const student = this.db.users.find(function (u) { return u.id === payload.studentId; });
      if (!student || student.role !== 'student') throw new StoreError('اختر طالبًا صحيحًا.', 'validation');
      const score = Number(payload.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new StoreError('التقييم يجب أن يكون بين ٠ و١٠٠.', 'validation');
      }
      const term = text(payload.term);
      if (!term) throw new StoreError('اختر الفصل الدراسي.', 'validation');
      const date = payload.date || todayISO();
      const notes = text(payload.notes);
      const existing = payload.id ? this.db.evaluations.find(function (e) { return e.id === payload.id; }) : null;
      if (payload.id && !existing) throw new StoreError('التقييم غير موجود.', 'notfound');
      if (existing) {
        existing.studentId = payload.studentId;
        existing.term = term;
        existing.score = score;
        existing.notes = notes;
        existing.date = date;
        existing.teacherId = existing.teacherId || me.id;
        existing.updatedAt = nowISO();
        this.persist();
        this.emit();
        return Object.assign({}, existing);
      }
      const evaluation = {
        id: randomId('e_'),
        studentId: payload.studentId,
        teacherId: me.id,
        term: term,
        score: score,
        notes: notes,
        date: date,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      this.db.evaluations.push(evaluation);
      this.persist();
      this.emit();
      return Object.assign({}, evaluation);
    }

    async deleteEvaluation(id) {
      this.requireStaff();
      const exists = this.db.evaluations.some(function (e) { return e.id === id; });
      if (!exists) throw new StoreError('التقييم غير موجود.', 'notfound');
      this.db.evaluations = this.db.evaluations.filter(function (e) { return e.id !== id; });
      this.persist();
      this.emit();
      return true;
    }

    async listAnnouncements() {
      const me = this.requireSession();
      let rows = this.db.announcements.slice();
      if (me.role === 'student') rows = rows.filter(function (n) { return n.audience === 'all' || n.audience === 'students'; });
      if (me.role === 'teacher') rows = rows.filter(function (n) { return n.audience === 'all' || n.audience === 'teachers'; });
      rows.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return rows.map(function (n) { return Object.assign({}, n); });
    }

    async saveAnnouncement(payload) {
      const me = this.requireAdmin();
      const title = text(payload.title);
      const body = text(payload.body);
      const audience = payload.audience || 'all';
      if (title.length < 3) throw new StoreError('عنوان الإعلان مطلوب.', 'validation');
      if (body.length < 3) throw new StoreError('نص الإعلان مطلوب.', 'validation');
      if (!DATA.audiences[audience]) throw new StoreError('الجمهور غير صحيح.', 'validation');
      const existing = payload.id ? this.db.announcements.find(function (n) { return n.id === payload.id; }) : null;
      if (payload.id && !existing) throw new StoreError('الإعلان غير موجود.', 'notfound');
      if (existing) {
        existing.title = title;
        existing.body = body;
        existing.audience = audience;
        this.persist();
        this.emit();
        return Object.assign({}, existing);
      }
      const announcement = {
        id: randomId('n_'),
        title: title,
        body: body,
        audience: audience,
        createdBy: me.id,
        createdAt: nowISO()
      };
      this.db.announcements.push(announcement);
      this.persist();
      this.emit();
      return Object.assign({}, announcement);
    }

    async deleteAnnouncement(id) {
      this.requireAdmin();
      const exists = this.db.announcements.some(function (n) { return n.id === id; });
      if (!exists) throw new StoreError('الإعلان غير موجود.', 'notfound');
      this.db.announcements = this.db.announcements.filter(function (n) { return n.id !== id; });
      this.persist();
      this.emit();
      return true;
    }

    async getSettings() {
      return normalizeLegacyBranding(this.db.settings);
    }

    async updateSettings(payload) {
      this.requireAdmin();
      const fields = ['name', 'mosque', 'association', 'supervisor', 'teacher', 'year', 'schedule', 'location', 'description'];
      fields.forEach((field) => {
        if (payload[field] !== undefined) this.db.settings[field] = text(payload[field]);
      });
      if (!this.db.settings.name) throw new StoreError('اسم الحلقة مطلوب.', 'validation');
      this.persist();
      this.emit();
      return Object.assign({}, this.db.settings);
    }

    async getLeaderboard() {
      this.requireSession();
      const students = this.db.users.filter(function (u) { return u.role === 'student' && u.active !== false; });
      const rows = students.map((student) => {
        const approved = this.db.achievements.filter(function (a) {
          return a.studentId === student.id && a.status === 'approved';
        });
        return {
          userId: student.id,
          fullName: student.fullName,
          username: student.username,
          points: approved.reduce(function (sum, a) { return sum + (Number(a.points) || 0); }, 0),
          count: approved.length
        };
      });
      rows.sort(function (a, b) {
        if (b.points !== a.points) return b.points - a.points;
        return b.count - a.count;
      });
      rows.forEach(function (row, index) {
        const previous = rows[index - 1];
        row.rank = previous && previous.points === row.points && previous.count === row.count ? previous.rank : index + 1;
      });
      return rows;
    }

    async exportData() {
      this.requireAdmin();
      return clone(this.db);
    }

    async importData(data) {
      this.requireAdmin();
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.achievements)) {
        throw new StoreError('ملف النسخة الاحتياطية غير صالح.', 'validation');
      }
      if (!data.users.some(function (u) { return u.role === 'admin'; })) {
        throw new StoreError('النسخة الاحتياطية لا تحتوي على حساب مدير.', 'validation');
      }
      this.db = data;
      if (!this.db.settings) this.db.settings = clone(DATA.seed.settings);
      if (!Array.isArray(this.db.evaluations)) this.db.evaluations = [];
      if (!Array.isArray(this.db.announcements)) this.db.announcements = [];
      this.persist();
      const fresh = this.db.users.find((u) => u.id === this.session.id);
      this.session = fresh && fresh.active !== false ? sanitizeUser(fresh) : null;
      this.emit();
      return true;
    }

    async resetDemo() {
      this.requireAdmin();
      this.db = await buildSeedDatabase();
      this.persist();
      const fresh = this.db.users.find((u) => u.id === this.session.id);
      this.session = fresh ? sanitizeUser(fresh) : null;
      this.emit();
      return true;
    }

    async requestPasswordReset() {
      throw new StoreError('في النسخة المحلية يمكن لمدير الحلقة إعادة تعيين كلمة المرور من صفحة المستخدمين.', 'local');
    }

    storageInfo() {
      const raw = localStorage.getItem(DB_KEY) || '';
      return { mode: 'local', bytes: new Blob([raw]).size, key: DB_KEY };
    }
  }

  /* ==========================================================
     متجر Supabase
     ========================================================== */
  class SupabaseStore {
    constructor() {
      this.mode = 'supabase';
      this.client = null;
      this.session = null;
      this.listeners = [];
      this.channel = null;
    }

    async init() {
      await this.loadSdk();
      this.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const result = await this.client.auth.getSession();
      const authSession = result.data ? result.data.session : null;
      if (authSession) await this.loadProfile();
      this.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          this.session = null;
          this.emit();
        }
      });
      return this;
    }

    loadSdk() {
      if (window.supabase && window.supabase.createClient) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-supabase-sdk]');
        if (existing) {
          existing.addEventListener('load', resolve);
          existing.addEventListener('error', reject);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.dataset.supabaseSdk = 'true';
        script.onload = resolve;
        script.onerror = function () {
          reject(new StoreError('تعذر تحميل مكتبة Supabase. تحقق من الاتصال بالإنترنت.', 'network'));
        };
        document.head.appendChild(script);
      });
    }

    async loadProfile() {
      const userResult = await this.client.auth.getUser();
      const user = userResult.data ? userResult.data.user : null;
      if (!user) { this.session = null; return null; }
      const result = await this.client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (result.error) throw new StoreError('تعذر قراءة الملف الشخصي: ' + result.error.message, 'cloud');
      if (!result.data) {
        throw new StoreError('لا يوجد ملف شخصي مرتبط بهذا الحساب. تأكد من تنفيذ ملف schema.sql ومن إنشاء المستخدم عبر لوحة Supabase.', 'cloud');
      }
      this.session = normalizeProfile(result.data);
      return this.session;
    }

    emit() {
      this.listeners.forEach(function (fn) {
        try { fn(); } catch (err) { /* تجاهل */ }
      });
    }

    subscribe(callback) {
      this.listeners.push(callback);
      if (!this.channel) {
        let timer = null;
        const ping = () => {
          clearTimeout(timer);
          timer = setTimeout(() => this.emit(), 350);
        };
        this.channel = this.client.channel('manara-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements' }, ping)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, ping)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, ping)
          .subscribe();
      }
      return function () {
        const index = this.listeners.indexOf(callback);
        if (index >= 0) this.listeners.splice(index, 1);
      }.bind(this);
    }

    requireSession() {
      if (!this.session) throw new StoreError('انتهت الجلسة. سجّل الدخول من جديد.', 'auth');
      return this.session;
    }

    requireStaff() {
      const me = this.requireSession();
      if (me.role !== 'teacher' && me.role !== 'admin') {
        throw new StoreError('هذه العملية متاحة للمعلمين والمدير فقط.', 'forbidden');
      }
      return me;
    }

    requireAdmin() {
      const me = this.requireSession();
      if (me.role !== 'admin') throw new StoreError('هذه العملية متاحة للمدير فقط.', 'forbidden');
      return me;
    }

    async login(identifier, password) {
      let email = text(identifier);
      if (!email.includes('@')) {
        const result = await this.client.rpc('email_for_username', { uname: email });
        if (result.error) throw new StoreError('تعذر البحث عن اسم المستخدم: ' + result.error.message, 'cloud');
        if (!result.data) throw new StoreError('اسم المستخدم غير موجود.', 'auth');
        email = result.data;
      }
      const result = await this.client.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        const msg = /invalid/i.test(result.error.message)
          ? 'بيانات الدخول غير صحيحة. تحقق من اسم المستخدم أو البريد وكلمة المرور.'
          : result.error.message;
        throw new StoreError(msg, 'auth');
      }
      return this.loadProfile();
    }

    async getSession() {
      return this.session;
    }

    async logout() {
      await this.client.auth.signOut();
      this.session = null;
      this.emit();
    }

    async listUsers(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      const table = me.role === 'student' ? 'profiles_public' : 'profiles';
      let query = this.client.from(table).select('*').order('full_name', { ascending: true });
      if (opts.role && opts.role !== 'all') query = query.eq('role', opts.role);
      if (opts.active !== undefined) query = query.eq('active', opts.active);
      const result = await query;
      if (result.error) throw new StoreError('تعذر تحميل المستخدمين: ' + result.error.message, 'cloud');
      let rows = (result.data || []).map(normalizeProfile);
      if (me.role === 'student') {
        rows = rows.map(function (u) {
          if (u.id !== me.id) { u.email = ''; u.phone = ''; }
          return u;
        });
      }
      const q = lower(opts.query);
      if (q) {
        rows = rows.filter(function (u) {
          return lower(u.fullName).includes(q) || lower(u.username).includes(q) || lower(u.email).includes(q);
        });
      }
      return rows;
    }

    async getUser(id) {
      const me = this.requireSession();
      const table = me.role === 'student' ? 'profiles_public' : 'profiles';
      const result = await this.client.from(table).select('*').eq('id', id).maybeSingle();
      if (result.error) throw new StoreError('تعذر تحميل الحساب: ' + result.error.message, 'cloud');
      return result.data ? normalizeProfile(result.data) : null;
    }

    async createUser(payload) {
      this.requireAdmin();
      const result = await this.client.functions.invoke(CFG.edgeFunction, {
        body: {
          action: 'create',
          email: text(payload.email),
          password: payload.password,
          full_name: text(payload.fullName),
          username: text(payload.username),
          phone: text(payload.phone),
          role: payload.role,
          active: payload.active !== false
        }
      });
      if (result.error) {
        throw new StoreError('تعذر إنشاء الحساب السحابي: ' + (result.error.message || 'راجع إعداد الدالة admin-user.'), 'cloud');
      }
      if (result.data && result.data.error) throw new StoreError(result.data.error, 'cloud');
      return result.data ? result.data.user : null;
    }

    async updateUser(id, patch) {
      const me = this.requireSession();
      const isSelf = me.id === id;
      if (!isSelf && me.role !== 'admin') throw new StoreError('لا تملك صلاحية تعديل هذا الحساب.', 'forbidden');
      if (isSelf && me.role === 'admin' && patch.role && patch.role !== 'admin') {
        throw new StoreError('لا يمكنك إزالة دور المدير عن حسابك الحالي.', 'validation');
      }
      if (isSelf && patch.active === false) {
        throw new StoreError('لا يمكنك تعطيل حسابك الحالي.', 'validation');
      }
      const update = {};
      let nextEmail = null;
      if (patch.fullName !== undefined) update.full_name = text(patch.fullName);
      if (patch.phone !== undefined) update.phone = text(patch.phone);
      if (me.role === 'admin') {
        if (patch.username !== undefined) update.username = text(patch.username);
        if (patch.email !== undefined) nextEmail = lower(patch.email);
        if (patch.role !== undefined) update.role = patch.role;
        if (patch.active !== undefined) update.active = patch.active !== false;
      }

      /* البريد مرتبط بحساب Supabase Auth؛ لا يكفي تحديث جدول profiles وحده */
      if (nextEmail) {
        const emailResult = await this.client.functions.invoke(CFG.edgeFunction, {
          body: { action: 'update-email', user_id: id, email: nextEmail }
        });
        if (emailResult.error) {
          throw new StoreError('تعذر تحديث البريد الإلكتروني: ' + emailResult.error.message, 'cloud');
        }
        if (emailResult.data && emailResult.data.error) throw new StoreError(emailResult.data.error, 'cloud');
      }

      let result;
      if (Object.keys(update).length) {
        result = await this.client.from('profiles').update(update).eq('id', id).select().maybeSingle();
      } else {
        result = await this.client.from('profiles').select('*').eq('id', id).maybeSingle();
      }
      if (result.error) throw new StoreError('تعذر تحديث الحساب: ' + result.error.message, 'cloud');
      if (patch.password) {
        const reset = await this.client.functions.invoke(CFG.edgeFunction, {
          body: { action: 'reset-password', user_id: id, password: patch.password }
        });
        if (reset.error) throw new StoreError('تم تحديث البيانات، لكن تعذر تغيير كلمة المرور: ' + reset.error.message, 'cloud');
        if (reset.data && reset.data.error) throw new StoreError(reset.data.error, 'cloud');
      }
      if (isSelf) await this.loadProfile();
      this.emit();
      return result.data ? normalizeProfile(result.data) : null;
    }

    async changePassword(currentPassword, newPassword) {
      const me = this.requireSession();
      validatePassword(newPassword);
      const verify = await this.client.auth.signInWithPassword({ email: me.email, password: currentPassword });
      if (verify.error) throw new StoreError('كلمة المرور الحالية غير صحيحة.', 'auth');
      const result = await this.client.auth.updateUser({ password: newPassword });
      if (result.error) throw new StoreError('تعذر تغيير كلمة المرور: ' + result.error.message, 'cloud');
      return true;
    }

    async resetPassword(id, newPassword) {
      this.requireAdmin();
      validatePassword(newPassword);
      const result = await this.client.functions.invoke(CFG.edgeFunction, {
        body: { action: 'reset-password', user_id: id, password: newPassword }
      });
      if (result.error) throw new StoreError('تعذر تغيير كلمة المرور: ' + result.error.message, 'cloud');
      if (result.data && result.data.error) throw new StoreError(result.data.error, 'cloud');
      return true;
    }

    async deleteUser(id) {
      const me = this.requireAdmin();
      if (id === me.id) throw new StoreError('لا يمكنك حذف حسابك الحالي.', 'validation');
      const result = await this.client.functions.invoke(CFG.edgeFunction, {
        body: { action: 'delete', user_id: id }
      });
      if (result.error) throw new StoreError('تعذر حذف الحساب: ' + result.error.message, 'cloud');
      if (result.data && result.data.error) throw new StoreError(result.data.error, 'cloud');
      this.emit();
      return true;
    }

    async listAchievements(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      let query = this.client.from('achievements').select('*');
      if (me.role === 'student') query = query.eq('student_id', me.id);
      else if (opts.studentId) query = query.eq('student_id', opts.studentId);
      if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
      if (opts.category && opts.category !== 'all') query = query.eq('category', opts.category);
      query = query.order('achievement_date', { ascending: false }).order('created_at', { ascending: false });
      const result = await query;
      if (result.error) throw new StoreError('تعذر تحميل الإنجازات: ' + result.error.message, 'cloud');
      let rows = (result.data || []).map(normalizeAchievement);
      const q = lower(opts.query);
      if (q) {
        rows = rows.filter(function (a) {
          return lower(a.title).includes(q) || lower(a.description).includes(q) || lower(a.teacherNote).includes(q);
        });
      }
      return rows;
    }

    async saveAchievement(payload) {
      const me = this.requireSession();
      const title = text(payload.title);
      const category = payload.category;
      const date = payload.date || todayISO();
      const points = Number(payload.points);
      if (title.length < 3) throw new StoreError('عنوان الإنجاز مطلوب.', 'validation');
      if (!DATA.categories[category]) throw new StoreError('اختر فئة الإنجاز.', 'validation');
      if (!Number.isFinite(points) || points < 0 || points > 1000) throw new StoreError('النقاط غير صحيحة.', 'validation');

      const record = {
        title: title,
        category: category,
        achievement_date: date,
        points: points,
        description: text(payload.description)
      };

      if (me.role === 'student') {
        record.student_id = me.id;
        record.teacher_id = null;
        record.status = 'pending';
        record.teacher_note = '';
      } else {
        if (!payload.studentId) throw new StoreError('اختر الطالب.', 'validation');
        record.student_id = payload.studentId;
        record.teacher_id = me.id;
        record.status = payload.status === 'rejected' ? 'rejected' : 'approved';
        record.teacher_note = text(payload.teacherNote);
        record.reviewed_at = nowISO();
      }

      let result;
      if (payload.id) {
        if (me.role === 'student') {
          throw new StoreError('لا يمكنك تعديل إنجاز بعد إرساله.', 'forbidden');
        }
        result = await this.client.from('achievements').update(record).eq('id', payload.id).select().maybeSingle();
      } else {
        result = await this.client.from('achievements').insert(record).select().maybeSingle();
      }
      if (result.error) throw new StoreError('تعذر حفظ الإنجاز: ' + result.error.message, 'cloud');
      this.emit();
      return result.data ? normalizeAchievement(result.data) : null;
    }

    async reviewAchievement(id, status, note) {
      this.requireStaff();
      if (status !== 'approved' && status !== 'rejected') throw new StoreError('حالة المراجعة غير صحيحة.', 'validation');
      const result = await this.client.from('achievements').update({
        status: status,
        teacher_note: text(note),
        teacher_id: this.session.id,
        reviewed_at: nowISO(),
        updated_at: nowISO()
      }).eq('id', id).select().maybeSingle();
      if (result.error) throw new StoreError('تعذر اعتماد الإنجاز: ' + result.error.message, 'cloud');
      this.emit();
      return result.data ? normalizeAchievement(result.data) : null;
    }

    async deleteAchievement(id) {
      const me = this.requireSession();
      let query = this.client.from('achievements').delete().eq('id', id);
      if (me.role === 'student') query = query.eq('student_id', me.id).eq('status', 'pending');
      const result = await query;
      if (result.error) throw new StoreError('تعذر حذف الإنجاز: ' + result.error.message, 'cloud');
      this.emit();
      return true;
    }

    async listEvaluations(filters) {
      const me = this.requireSession();
      const opts = filters || {};
      let query = this.client.from('evaluations').select('*');
      if (me.role === 'student') query = query.eq('student_id', me.id);
      else if (opts.studentId) query = query.eq('student_id', opts.studentId);
      query = query.order('evaluation_date', { ascending: false });
      const result = await query;
      if (result.error) throw new StoreError('تعذر تحميل التقييمات: ' + result.error.message, 'cloud');
      return (result.data || []).map(normalizeEvaluation);
    }

    async saveEvaluation(payload) {
      const me = this.requireStaff();
      const score = Number(payload.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) throw new StoreError('التقييم بين ٠ و١٠٠.', 'validation');
      const record = {
        student_id: payload.studentId,
        teacher_id: me.id,
        term: text(payload.term),
        score: score,
        notes: text(payload.notes),
        evaluation_date: payload.date || todayISO()
      };
      if (!record.term) throw new StoreError('اختر الفصل الدراسي.', 'validation');
      let result;
      if (payload.id) result = await this.client.from('evaluations').update(record).eq('id', payload.id).select().maybeSingle();
      else result = await this.client.from('evaluations').insert(record).select().maybeSingle();
      if (result.error) throw new StoreError('تعذر حفظ التقييم: ' + result.error.message, 'cloud');
      this.emit();
      return result.data ? normalizeEvaluation(result.data) : null;
    }

    async deleteEvaluation(id) {
      this.requireStaff();
      const result = await this.client.from('evaluations').delete().eq('id', id);
      if (result.error) throw new StoreError('تعذر حذف التقييم: ' + result.error.message, 'cloud');
      this.emit();
      return true;
    }

    async listAnnouncements() {
      const me = this.requireSession();
      const result = await this.client.from('announcements').select('*').order('created_at', { ascending: false });
      if (result.error) throw new StoreError('تعذر تحميل الإعلانات: ' + result.error.message, 'cloud');
      let rows = (result.data || []).map(normalizeAnnouncement);
      if (me.role === 'student') rows = rows.filter(function (n) { return n.audience === 'all' || n.audience === 'students'; });
      if (me.role === 'teacher') rows = rows.filter(function (n) { return n.audience === 'all' || n.audience === 'teachers'; });
      return rows;
    }

    async saveAnnouncement(payload) {
      const me = this.requireAdmin();
      const record = {
        title: text(payload.title),
        body: text(payload.body),
        audience: payload.audience || 'all',
        created_by: me.id
      };
      if (record.title.length < 3 || record.body.length < 3) throw new StoreError('أكمل عنوان الإعلان ونصه.', 'validation');
      let result;
      if (payload.id) result = await this.client.from('announcements').update(record).eq('id', payload.id).select().maybeSingle();
      else result = await this.client.from('announcements').insert(record).select().maybeSingle();
      if (result.error) throw new StoreError('تعذر حفظ الإعلان: ' + result.error.message, 'cloud');
      this.emit();
      return result.data ? normalizeAnnouncement(result.data) : null;
    }

    async deleteAnnouncement(id) {
      this.requireAdmin();
      const result = await this.client.from('announcements').delete().eq('id', id);
      if (result.error) throw new StoreError('تعذر حذف الإعلان: ' + result.error.message, 'cloud');
      this.emit();
      return true;
    }

    async getSettings() {
      const result = await this.client.from('halaqa_settings').select('*').eq('id', 1).maybeSingle();
      if (result.error) throw new StoreError('تعذر تحميل إعدادات الحلقة: ' + result.error.message, 'cloud');
      if (!result.data) return clone(DATA.seed.settings);
      const row = result.data;
      return normalizeLegacyBranding({
        name: row.name,
        mosque: row.mosque,
        association: row.association,
        supervisor: row.supervisor,
        teacher: row.teacher,
        year: row.year,
        schedule: row.schedule,
        location: row.location,
        description: row.description
      });
    }

    async updateSettings(payload) {
      this.requireAdmin();
      const record = {
        name: text(payload.name),
        mosque: text(payload.mosque),
        association: text(payload.association),
        supervisor: text(payload.supervisor),
        teacher: text(payload.teacher),
        year: text(payload.year),
        schedule: text(payload.schedule),
        location: text(payload.location),
        description: text(payload.description),
        updated_at: nowISO()
      };
      const result = await this.client.from('halaqa_settings').upsert(Object.assign({ id: 1 }, record)).select().maybeSingle();
      if (result.error) throw new StoreError('تعذر حفظ الإعدادات: ' + result.error.message, 'cloud');
      this.emit();
      return payload;
    }

    async getLeaderboard() {
      this.requireSession();
      const result = await this.client.rpc('student_leaderboard');
      if (result.error) throw new StoreError('تعذر تحميل الترتيب: ' + result.error.message, 'cloud');
      return (result.data || []).map(function (row) {
        return {
          userId: row.user_id,
          fullName: row.full_name,
          username: row.username,
          points: Number(row.points) || 0,
          count: Number(row.achievements_count) || 0,
          rank: Number(row.rank) || 0
        };
      });
    }

    async exportData() {
      throw new StoreError('التصدير متاح في النسخة المحلية. في النسخة السحابية استخدم نسخ Supabase الاحتياطي.', 'cloud');
    }

    async importData() {
      throw new StoreError('الاستيراد متاح في النسخة المحلية فقط.', 'cloud');
    }

    async resetDemo() {
      throw new StoreError('إعادة البيانات التجريبية متاحة في النسخة المحلية فقط.', 'cloud');
    }

    async requestPasswordReset(email) {
      if (!email) throw new StoreError('أدخل بريدك الإلكتروني أولًا.', 'validation');
      const result = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (result.error) throw new StoreError('تعذر إرسال رابط الاستعادة: ' + result.error.message, 'cloud');
      return true;
    }

    storageInfo() {
      return { mode: 'supabase', url: CFG.supabaseUrl };
    }
  }

  async function createStore() {
    const hasCloud = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
    const wantsCloud = CFG.mode === 'supabase' || (CFG.mode === 'auto' && hasCloud);
    if (wantsCloud) {
      try {
        return await new SupabaseStore().init();
      } catch (error) {
        if (CFG.mode === 'supabase') throw error;
        console.warn('[منارة الحلقة] تعذر الاتصال بـ Supabase، سيتم استخدام التخزين المحلي.', error);
        const fallback = await new LocalStore().init();
        fallback.cloudError = error.message;
        return fallback;
      }
    }
    return new LocalStore().init();
  }

  window.ManaraStore = {
    createStore: createStore,
    StoreError: StoreError,
    hashPassword: hashPassword,
    todayISO: todayISO
  };
})();
