/* ============================================================
   أدوات الواجهة: الأيقونات، التنسيق، النوافذ، التنبيهات
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.MANARA_DATA;

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    graduation: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4.1M6.6 6.6A18.4 18.4 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.2-.8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    flame: '<path d="M12 2c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12Z"/><path d="M12 12c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-3 3-5Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    scroll: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V3Z"/><path d="M6 3a2 2 0 0 0-2 2v1h2M10 8h6M10 12h6M10 16h4"/>',
    megaphone: '<path d="m3 11 18-7-4 14-5-3-3 4-1-5-5-3Z"/><path d="M11 12v6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    lamp: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.6-1 1.2-1 2H9c0-.8-.2-1.4-1-2Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="m8.5 13-2 9 5.5-3 5.5 3-2-9"/>',
    trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A6.5 6.5 0 0 0 5.2 12.3 3.9 3.9 0 0 0 6 19Z"/>',
    'hard-drive': '<path d="M4 4h16l2 9v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z"/><path d="M2 13h20M6 17h.01M10 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M17 6l3 3M14 9l3 3"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chevron: '<path d="m15 18-6-6 6-6"/>',
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'external': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    'book-open': '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z"/>',
    mosque: '<path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M9 21v-5a3 3 0 0 1 6 0v5"/><path d="M2 21h20M12 3V1M10 21v-2h4v2"/>',
    'user-check': '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 11l2 2 4-4"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>'
  };

  function icon(name, size, className) {
    const paths = ICONS[name] || ICONS.info;
    const s = size || 20;
    return '<svg class="icon ' + (className || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) { return esc(value); }

  function fmtNum(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    try {
      return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value));
    } catch (err) {
      return String(value);
    }
  }

  function parseDate(value) {
    if (!value) return null;
    const str = String(value);
    const d = str.length === 10 ? new Date(str + 'T12:00:00') : new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(value, short) {
    const d = parseDate(value);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', short
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (err) {
      return d.toLocaleDateString('ar');
    }
  }

  function fmtDateTime(value) {
    const d = parseDate(value);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
    } catch (err) {
      return d.toLocaleString('ar');
    }
  }

  function relative(value) {
    const d = parseDate(value);
    if (!d) return '';
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
    if (abs < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
    if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
    if (abs < 2592000000) return rtf.format(Math.round(diff / 86400000), 'day');
    return rtf.format(Math.round(diff / 2592000000), 'month');
  }

  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(function (w) {
      return w && !['بن', 'بنت', 'ابن', 'ابنة', 'عبد', 'أبو', 'ابو'].includes(w);
    });
    if (!words.length) return '؟';
    if (words.length === 1) return words[0].slice(0, 2);
    return (words[0][0] || '') + (words[words.length - 1][0] || '');
  }

  function toneFor(name) {
    const tones = ['emerald', 'gold', 'teal', 'blue', 'rose', 'violet'];
    let sum = 0;
    for (let i = 0; i < String(name).length; i += 1) sum += String(name).charCodeAt(i);
    return tones[sum % tones.length];
  }

  function levelFor(points) {
    const value = Number(points) || 0;
    let current = DATA.levels[0];
    for (const level of DATA.levels) {
      if (value >= level.min) current = level;
    }
    const next = current.next;
    const percent = next ? Math.max(0, Math.min(100, ((value - current.min) / (next - current.min)) * 100)) : 100;
    return { current: current, next: next, percent: percent };
  }

  function gradeFor(score) {
    const value = Number(score) || 0;
    if (value >= 90) return { label: 'ممتاز', tone: 'success' };
    if (value >= 80) return { label: 'جيد جدًا', tone: 'info' };
    if (value >= 70) return { label: 'جيد', tone: 'warning' };
    if (value >= 60) return { label: 'مقبول', tone: 'warning' };
    return { label: 'يحتاج متابعة', tone: 'danger' };
  }

  function statusBadge(status) {
    const meta = DATA.statuses[status] || { label: status, tone: 'muted' };
    return '<span class="badge badge-' + attr(meta.tone) + '">' + esc(meta.label) + '</span>';
  }

  function roleBadge(role) {
    const meta = DATA.roles[role] || { label: role, tone: 'muted' };
    return '<span class="badge badge-' + attr(meta.tone) + '">' + icon(meta.icon, 13) + esc(meta.label) + '</span>';
  }

  function categoryBadge(category) {
    const meta = DATA.categories[category] || { label: category, tone: 'muted', icon: 'star' };
    return '<span class="badge badge-' + attr(meta.tone) + '">' + icon(meta.icon, 13) + esc(meta.label) + '</span>';
  }

  function avatar(user, size) {
    const s = size || 'md';
    return '<span class="avatar avatar-' + s + ' tone-' + toneFor(user.fullName || user.username) + '">' + esc(initials(user.fullName)) + '</span>';
  }

  function emptyState(iconName, title, message, action) {
    return '<div class="empty-state">' +
      '<span class="empty-icon">' + icon(iconName || 'sparkles', 26) + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(message) + '</p>' +
      (action || '') +
      '</div>';
  }

  function progressRing(percent, label, sublabel, size) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const s = size || 'lg';
    return '<div class="ring ring-' + s + '" style="--ring-value:' + p.toFixed(1) + '%" role="img" aria-label="' + attr(label + ' ' + Math.round(p) + '%') + '">' +
      '<div class="ring-inner"><strong>' + esc(label) + '</strong>' + (sublabel ? '<span>' + esc(sublabel) + '</span>' : '') + '</div>' +
      '</div>';
  }

  let toastTimer = 0;
  function toast(message, type) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const kind = type || 'success';
    const iconName = kind === 'error' ? 'alert' : kind === 'info' ? 'info' : kind === 'warning' ? 'alert' : 'check';
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.innerHTML = '<span class="toast-icon">' + icon(iconName, 18) + '</span><p>' + esc(message) + '</p><button type="button" class="toast-close" aria-label="إغلاق التنبيه">' + icon('x', 15) + '</button>';
    stack.appendChild(el);
    el.querySelector('.toast-close').addEventListener('click', function () { remove(); });
    const remove = function () {
      el.classList.add('toast-out');
      setTimeout(function () { el.remove(); }, 260);
    };
    toastTimer = setTimeout(remove, kind === 'error' ? 6500 : 4200);
  }

  let lastFocus = null;
  function openModal(options) {
    const root = document.getElementById('modal-root');
    if (!root) return null;
    lastFocus = document.activeElement;
    const size = options.size ? ' modal-' + options.size : '';
    root.innerHTML = '<div class="modal-backdrop" data-modal-backdrop>' +
      '<div class="modal-card' + size + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<header class="modal-head">' +
      '<div><span class="eyebrow">' + esc(options.kicker || 'منارة الحلقة') + '</span><h2 id="modal-title">' + esc(options.title) + '</h2>' +
      (options.subtitle ? '<p>' + esc(options.subtitle) + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="إغلاق">' + icon('x', 20) + '</button>' +
      '</header>' +
      '<div class="modal-body">' + options.body + '</div>' +
      (options.footer ? '<footer class="modal-foot">' + options.footer + '</footer>' : '') +
      '</div></div>';
    document.body.classList.add('modal-open');
    const card = root.querySelector('.modal-card');
    if (card) {
      const focusable = card.querySelector('input:not([type="hidden"]), select, textarea, button:not([data-action="close-modal"])');
      setTimeout(function () {
        if (focusable) focusable.focus();
      }, 40);
    }
    return root;
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (err) { /* تجاهل */ }
    }
    lastFocus = null;
  }

  function confirmDialog(options) {
    return new Promise(function (resolve) {
      const root = openModal({
        kicker: options.kicker || 'تأكيد العملية',
        title: options.title,
        subtitle: options.message,
        size: 'sm',
        body: '<div class="confirm-icon tone-' + (options.tone || 'danger') + '">' + icon(options.icon || 'alert', 26) + '</div>',
        footer: '<button type="button" class="btn btn-ghost" data-confirm-no>إلغاء</button>' +
          '<button type="button" class="btn ' + (options.tone === 'danger' ? 'btn-danger' : 'btn-primary') + '" data-confirm-yes>' + esc(options.confirmLabel || 'تأكيد') + '</button>'
      });
      if (!root) { resolve(false); return; }
      let settled = false;
      const finish = function (value) {
        if (settled) return;
        settled = true;
        closeModal();
        resolve(value);
      };
      root.querySelector('[data-confirm-yes]').addEventListener('click', function () { finish(true); });
      root.querySelector('[data-confirm-no]').addEventListener('click', function () { finish(false); });
      root.querySelector('[data-modal-backdrop]').addEventListener('click', function (event) {
        if (event.target === event.currentTarget) finish(false);
      });
    });
  }

  function setBusy(form, busy) {
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-busy');
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> جارٍ الحفظ…';
    } else {
      button.disabled = false;
      button.classList.remove('is-busy');
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  function formError(form, message) {
    if (!form) return;
    let box = form.querySelector('.form-alert');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-alert';
      box.setAttribute('role', 'alert');
      form.prepend(box);
    }
    box.innerHTML = icon('alert', 17) + '<span>' + esc(message) + '</span>';
    box.hidden = false;
    box.animate(
      [{ transform: 'translateY(-4px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 220, easing: 'ease-out' }
    );
  }

  function clearFormError(form) {
    if (!form) return;
    const box = form.querySelector('.form-alert');
    if (box) box.hidden = true;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('تعذر قراءة الملف.')); };
      reader.readAsText(file, 'utf-8');
    });
  }

  function debounce(fn, wait) {
    let timer = 0;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function todayISO() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'طاب مساؤك';
    return 'مساء الخير';
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2).join(' ');
  }

  window.UI = {
    icon: icon,
    esc: esc,
    attr: attr,
    fmtNum: fmtNum,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    relative: relative,
    initials: initials,
    toneFor: toneFor,
    levelFor: levelFor,
    gradeFor: gradeFor,
    statusBadge: statusBadge,
    roleBadge: roleBadge,
    categoryBadge: categoryBadge,
    avatar: avatar,
    emptyState: emptyState,
    progressRing: progressRing,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,
    setBusy: setBusy,
    formError: formError,
    clearFormError: clearFormError,
    downloadFile: downloadFile,
    readFile: readFile,
    debounce: debounce,
    qs: qs,
    qsa: qsa,
    todayISO: todayISO,
    greeting: greeting,
    firstName: firstName
  };
})();
