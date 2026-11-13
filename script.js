(() => {
'use strict';

/* ---------- Shared data: single source of truth for prices ---------- */
const MATERIALS = [
  { id: 'newspaper', name: 'Old Newspapers', price: 12, icon: '📰', desc: 'Dry newspapers, magazines and paper waste.' },
  { id: 'cardboard', name: 'Cardboard', price: 8, icon: '📦', desc: 'Clean, dry boxes and corrugated sheets.' },
  { id: 'metal', name: 'Iron/Metal Scrap', price: 32, icon: '🔩', desc: 'Iron, steel and mixed metal items.' },
  { id: 'plastic', name: 'Plastic Bottles', price: 15, icon: '🧴', desc: 'PET bottles and rigid plastic containers.' },
  { id: 'ewaste', name: 'E-Waste', price: 40, icon: '💻', desc: 'Old chargers, cables and electronics.' },
  { id: 'glass', name: 'Glass', price: 3, icon: '🍾', desc: 'Glass bottles and jars (handled with care).' },
  { id: 'other', name: 'Other Recyclable Materials', price: 5, icon: '♻️', desc: 'Mixed recyclables, assessed at pickup.' }
];
const FAQS = [
  ['What types of scrap do you accept?', 'We accept newspapers, cardboard, iron/metal, plastic bottles, e-waste, glass and other recyclables.'],
  ['How are scrap prices calculated?', 'Price = weight in kg × rate per kg. The rates on this site are illustrative demo rates and vary with quality and market conditions.'],
  ['Is the pickup free?', 'In this demo, pickup is shown as free. A real service would confirm any charges before pickup.'],
  ['How do I book a collection?', 'Fill the Book a Doorstep Pickup form with your address, material, weight, date and time slot, then submit.'],
  ['How is the scrap weighed?', 'The project concept is weighing on a digital scale at your doorstep. The final weight must be verified at pickup; no scale is connected to this website.'],
  ['When will I receive payment?', 'In a real service, payment would follow weight verification at pickup. This demo does not process payments.'],
  ['Can I cancel a booking?', 'Yes. Pending bookings can be cancelled from My Dashboard after a confirmation prompt.'],
  ['Do you provide doorstep pickup?', 'Yes, doorstep pickup is the core idea. Real scheduling needs a backend, so this prototype simulates it.']
];
const KEYS = { bookings: 'kw_bookings', user: 'kw_user', theme: 'kw_theme' };
const FLOW = ['Pending', 'Confirmed', 'Pickup Completed'];

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const mat = id => MATERIALS.find(m => m.id === id);
const fmtDate = d => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const todayStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const load = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Browser storage is unavailable; data will not be saved.', 'error'); } };
const getBookings = () => { const b = load(KEYS.bookings, []); return Array.isArray(b) ? b.filter(x => x && x.id && mat(x.material) && Number(x.qty) > 0) : []; };
const setBookings = b => save(KEYS.bookings, b);
const statusClass = s => 'st-' + String(s).replace(/\s+/g, '-');

let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Reusable validation ---------- */
const RULES = {
  required: v => v.trim() ? '' : 'This field is required.',
  min3: v => v.trim().length >= 3 ? '' : 'Please enter at least 3 characters.',
  min10: v => v.trim().length >= 10 ? '' : 'Please enter at least 10 characters.',
  phone: v => /^[6-9]\d{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number.',
  pin: v => /^[1-9]\d{5}$/.test(v.trim()) ? '' : 'Enter a valid 6-digit PIN code.',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address.',
  qty: v => { const n = Number(v); return isFinite(n) && n > 0 && n <= 5000 ? '' : 'Enter a weight above 0 and up to 5000 kg.'; },
  date: v => v >= todayStr() ? '' : 'Pickup date cannot be in the past.',
  pass: v => v.length >= 6 ? '' : 'Password must be at least 6 characters.',
  match: (v, el) => v === $(el.dataset.match).value ? '' : 'Passwords do not match.'
};
function validateField(el) {
  let msg = '';
  for (const r of el.dataset.rules.split(',')) { msg = RULES[r](el.value, el); if (msg) break; }
  const box = el.closest('.field'), err = box && $('.err', box);
  el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) err.textContent = msg;
  return !msg;
}
function validateForm(form) {
  const bad = $$('[data-rules]', form).filter(el => !validateField(el));
  if (bad.length) bad[0].focus();
  return !bad.length;
}
function clearForm(form) {
  form.reset();
  $$('.invalid', form).forEach(el => el.classList.remove('invalid'));
  $$('.err', form).forEach(e => e.textContent = '');
}
// Remove errors as soon as the user fixes the input
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.rules && el.classList.contains('invalid')) validateField(el);
  if (el.id === 'sPass' && $('#sPass2').classList.contains('invalid')) validateField($('#sPass2'));
});

/* ---------- Render: categories, rates, selects ---------- */
function renderCats(q = '') {
  const list = MATERIALS.filter(m => (m.name + ' ' + m.desc).toLowerCase().includes(q.trim().toLowerCase()));
  $('#catGrid').innerHTML = list.map(m => `<button class="card cat" data-cat="${m.id}" type="button" aria-label="Select ${esc(m.name)}">
    <div class="ico">${m.icon}</div><h3>${esc(m.name)}</h3><p>${esc(m.desc)}</p><div class="rate">${money(m.price)}/kg</div></button>`).join('');
  $('#catEmpty').hidden = list.length > 0;
}
function renderRates() {
  $('#rateBody').innerHTML = MATERIALS.map(m => `<tr><td><span class="mi">${m.icon}</span><b>${esc(m.name)}</b></td><td>${esc(m.desc)}</td><td><b>${money(m.price)}</b>/kg</td></tr>`).join('');
  $('#lastUpdated').textContent = 'Last updated: ' + fmtDate(new Date()) + ' (demo rates)';
}
function fillSelects() {
  const opts = MATERIALS.map(m => `<option value="${m.id}">${m.icon} ${esc(m.name)} — ${money(m.price)}/kg</option>`).join('');
  $('#calcMaterial').innerHTML = opts;
  $('#bMaterial').innerHTML = '<option value="">Select material</option>' + opts;
}

/* ---------- Calculator ---------- */
function calculate() {
  const qtyEl = $('#calcQty'), out = $('#calcResult');
  if (!validateField(qtyEl)) { out.innerHTML = '<p class="empty">Enter a valid quantity to see your estimate.</p>'; return; }
  const m = mat($('#calcMaterial').value), q = Number(qtyEl.value), total = q * m.price;
  out.innerHTML = `<h3>${m.icon} Estimated earnings</h3><div class="big">${money(total)}</div>
    <table class="brk" style="min-width:0"><tr><td>Material</td><td>${esc(m.name)}</td></tr><tr><td>Rate</td><td>${money(m.price)}/kg</td></tr>
    <tr><td>Quantity</td><td>${q} kg</td></tr><tr><td>${q} kg × ${money(m.price)}</td><td><b>${money(total)}</b></td></tr></table>
    <p class="note">Estimated earnings only, not a guaranteed final payment. Final weight and price are verified at pickup.</p>
    <button class="btn sm" type="button" data-prefill>Book this pickup</button>`;
}

/* ---------- Booking estimate + image preview ---------- */
function updateBookSummary() {
  const m = mat($('#bMaterial').value), q = Number($('#bQty').value);
  $('#bookSummary').textContent = m && q > 0
    ? `Estimated payout: ${money(q * m.price)} (${q} kg × ${money(m.price)}/kg) — estimate only, verified at pickup.`
    : 'Estimated payout: select material and weight.';
}
let previewUrl = null;
function clearImage() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null; $('#scrapImg').value = ''; $('#imgPreview').hidden = true; $('#imgTag').removeAttribute('src');
}
function handleImage(file) {
  const err = $('#imgErr'); err.textContent = '';
  if (!file) return clearImage();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { clearImage(); err.textContent = 'Invalid file type. Please choose a JPG, PNG or WebP image.'; return; }
  if (file.size > 3 * 1024 * 1024) { clearImage(); err.textContent = 'Image is too large. Maximum size is 3 MB.'; return; }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file); $('#imgTag').src = previewUrl; $('#imgPreview').hidden = false;
}
function newId() { return 'KW-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }

function submitBooking(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) { toast('Please fix the highlighted fields.', 'error'); return; }
  if ($('#imgErr').textContent) { toast('Please fix or remove the invalid image.', 'error'); return; }
  const m = mat($('#bMaterial').value), qty = Number($('#bQty').value);
  const b = {
    id: newId(), createdAt: new Date().toISOString(), name: $('#bName').value.trim(), phone: $('#bPhone').value.trim(),
    address: $('#bAddress').value.trim(), city: $('#bCity').value.trim(), pin: $('#bPin').value.trim(),
    material: m.id, qty, date: $('#bDate').value, slot: $('#bSlot').value, amount: qty * m.price, status: 'Pending', hasImage: !!previewUrl, demo: false
  };
  setBookings([b, ...getBookings()]);
  clearForm(form); clearImage(); updateBookSummary(); prefillName();
  renderAll();
  $('#modalBody').innerHTML = `<div class="tick">✓</div><h3 id="modalTitle">Booking submitted!</h3>
    <p class="sub">Your booking ID is <b>${esc(b.id)}</b>. Status: <span class="st ${statusClass(b.status)}">${b.status}</span></p>
    <div class="kv"><div><small>Material</small>${esc(m.name)}</div><div><small>Quantity</small>${b.qty} kg</div><div><small>Pickup</small>${fmtDate(b.date)}, ${esc(b.slot)}</div><div><small>Est. payout</small>${money(b.amount)}</div></div>
    <p class="note">Frontend simulation: real pickup scheduling and live status updates require a backend.</p>`;
  openModal();
}

/* ---------- Confirmation + timeline ---------- */
function timeline(status) {
  const cancelled = status === 'Cancelled', idx = FLOW.indexOf(status);
  const steps = FLOW.map((s, i) => `<li class="${cancelled ? (i === 0 ? 'done' : '') : i <= idx ? 'done' : ''} ${!cancelled && i === idx ? 'active' : ''}">${s}</li>`);
  steps.push(`<li class="${cancelled ? 'bad active' : ''}">Cancelled</li>`);
  return `<ol class="timeline" aria-label="Booking status timeline">${steps.join('')}</ol>`;
}
function actionButtons(b) {
  let h = '';
  if (b.status === 'Pending') h += `<button class="btn btn-ghost sm" data-act="advance" data-id="${esc(b.id)}">Confirm (demo)</button><button class="btn danger sm" data-act="cancel" data-id="${esc(b.id)}">Cancel</button>`;
  else if (b.status === 'Confirmed') h += `<button class="btn btn-ghost sm" data-act="advance" data-id="${esc(b.id)}">Mark completed (demo)</button>`;
  return h || '—';
}
function renderConfirm() {
  const b = getBookings()[0], box = $('#confirmBox');
  if (!b) { box.innerHTML = '<p class="empty">No booking yet. Submit the pickup form above to see your confirmation and status here.</p>'; return; }
  const m = mat(b.material);
  box.innerHTML = `<h3>Booking ID: ${esc(b.id)} ${b.demo ? '<span class="pill">Demo data</span>' : ''}</h3>
    <p>Status: <span class="st ${statusClass(b.status)}">${esc(b.status)}</span></p>${timeline(b.status)}
    <div class="kv"><div><small>Material</small>${m.icon} ${esc(m.name)}</div><div><small>Quantity</small>${b.qty} kg</div>
    <div><small>Address</small>${esc(b.address)}, ${esc(b.city)} – ${esc(b.pin)}</div><div><small>Preferred pickup</small>${fmtDate(b.date)}, ${esc(b.slot || '')}</div>
    <div><small>Estimated payout</small>${money(b.amount)}</div></div>
    <div class="acts" style="margin-top:16px">${b.status === 'Pending' || b.status === 'Confirmed' ? actionButtons(b) : ''}</div>
    <p class="note">Frontend simulation: real pickup scheduling and live status updates require a backend. "Demo" buttons only simulate status changes.</p>`;
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const all = getBookings(), live = all.filter(b => b.status !== 'Cancelled');
  $('#dTotal').textContent = all.length;
  $('#dPending').textContent = all.filter(b => b.status === 'Pending').length;
  $('#dDone').textContent = all.filter(b => b.status === 'Pickup Completed').length;
  $('#dEarn').textContent = money(live.reduce((s, b) => s + Number(b.amount || 0), 0));
  const f = $('#statusFilter').value, q = $('#bookSearch').value.trim().toLowerCase();
  const list = all.filter(b => (f === 'all' || b.status === f) && (b.id + mat(b.material).name + (b.city || '')).toLowerCase().includes(q));
  $('#bookBody').innerHTML = list.map(b => `<tr><td><b>${esc(b.id)}</b>${b.demo ? ' <span class="pill">Demo</span>' : ''}</td><td>${fmtDate(b.createdAt)}</td>
    <td>${mat(b.material).icon} ${esc(mat(b.material).name)}</td><td>${b.qty} kg</td><td>${money(b.amount)}</td><td>${fmtDate(b.date)}</td>
    <td><span class="st ${statusClass(b.status)}">${esc(b.status)}</span></td><td><div class="acts">${actionButtons(b)}</div></td></tr>`).join('');
  $('#bookEmpty').hidden = list.length > 0;
  $('#loadDemo').hidden = all.length > 0;
  $('#bookEmptyMsg').textContent = all.length ? 'No bookings match your search or filter.' : 'No bookings yet. Book a pickup or load sample data to explore the dashboard.';
}
function renderAll() { renderConfirm(); renderDashboard(); }
function updateBooking(id, fn) { setBookings(getBookings().map(b => b.id === id ? fn(b) : b)); renderAll(); }

function loadDemoData() {
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const mk = (i, material, qty, off, status) => ({ id: 'DEMO-00' + i, createdAt: new Date(Date.now() - i * 864e5).toISOString(), name: 'Demo User', phone: '9876543210',
    address: '12 Sample Street', city: 'Phagwara', pin: '144401', material, qty, date: d(off), slot: '09:00 AM – 12:00 PM', amount: qty * mat(material).price, status, hasImage: false, demo: true });
  setBookings([...getBookings(), mk(1, 'newspaper', 25, 2, 'Pending'), mk(2, 'metal', 18, -3, 'Pickup Completed'), mk(3, 'plastic', 8, 1, 'Confirmed')]);
  renderAll(); toast('Sample demo bookings loaded.');
}

/* ---------- Auth demo (no passwords stored) ---------- */
function renderAuth() {
  const u = load(KEYS.user, null), ok = u && typeof u.name === 'string';
  $('#guestBox').hidden = ok; $('#userBox').hidden = !ok; $('#authForms').hidden = ok; $('#sessionBox').hidden = !ok;
  if (ok) {
    $('#userName').textContent = u.name;
    $('#sessionBox').innerHTML = `<h3>Welcome, ${esc(u.name)}!</h3><p class="sub">${esc(u.email)} — demo session. No real authentication is performed.</p><button id="logout2" class="btn btn-ghost" type="button">Logout</button>`;
  }
  prefillName();
}
function prefillName() { const u = load(KEYS.user, null); if (u && u.name && !$('#bName').value) $('#bName').value = u.name; }
function showTab(which) {
  const login = which === 'login';
  $('#loginForm').hidden = !login; $('#signupForm').hidden = login;
  $('#tabLogin').classList.toggle('active', login); $('#tabSignup').classList.toggle('active', !login);
  $('#tabLogin').setAttribute('aria-selected', login); $('#tabSignup').setAttribute('aria-selected', !login);
}
function goAuth(tab) { showTab(tab); $('#auth').scrollIntoView({ behavior: 'smooth' }); }
function logout() { localStorage.removeItem(KEYS.user); renderAuth(); toast('Logged out of demo session.'); }

/* ---------- Modal, theme, FAQ ---------- */
function openModal() { $('#modal').hidden = false; $('#modalClose').focus(); }
function closeModal() { $('#modal').hidden = true; }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeBtn').textContent = t === 'dark' ? '☀' : '🌙';
  $('#themeBtn').setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
function renderFaq() {
  $('#faqList').innerHTML = FAQS.map((f, i) => `<div><button class="faq-q" aria-expanded="false" aria-controls="fa${i}" id="fq${i}">${esc(f[0])}</button><div class="faq-a" id="fa${i}" role="region" aria-labelledby="fq${i}" hidden>${esc(f[1])}</div></div>`).join('');
}
function countUp() {
  $$('[data-count]').forEach(el => {
    const end = Number(el.dataset.count), suf = el.dataset.suffix || '', t0 = performance.now();
    const step = t => { const p = Math.min((t - t0) / 1200, 1); el.textContent = Math.round(end * p).toLocaleString('en-IN') + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function selectCategory(id) {
  $('#calcMaterial').value = id; $('#bMaterial').value = id; updateBookSummary();
  if ($('#calcQty').value) calculate();
  $('#calculator').scrollIntoView({ behavior: 'smooth' }); toast(mat(id).name + ' selected in calculator and booking form.');
}

/* ---------- Event wiring (each listener added once) ---------- */
function init() {
  applyTheme(load(KEYS.theme, 'dark') === 'light' ? 'light' : 'dark');
  fillSelects(); renderCats(); renderRates(); renderFaq(); renderAuth(); renderAll(); countUp();
  $('#bDate').min = todayStr();

  $('#themeBtn').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); save(KEYS.theme, t); });
  $('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o); });
  $('#nav').addEventListener('click', e => { if (e.target.closest('a')) { $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); } });

  $('#catSearch').addEventListener('input', e => renderCats(e.target.value));
  $('#catGrid').addEventListener('click', e => { const c = e.target.closest('[data-cat]'); if (c) selectCategory(c.dataset.cat); });

  $('#calcForm').addEventListener('submit', e => { e.preventDefault(); calculate(); });
  $('#calcQty').addEventListener('input', calculate);
  $('#calcMaterial').addEventListener('change', () => { if ($('#calcQty').value) calculate(); });
  $('#calcResult').addEventListener('click', e => {
    if (!e.target.closest('[data-prefill]')) return;
    $('#bMaterial').value = $('#calcMaterial').value; $('#bQty').value = $('#calcQty').value; updateBookSummary(); $('#book').scrollIntoView({ behavior: 'smooth' });
  });

  $('#bMaterial').addEventListener('change', updateBookSummary);
  $('#bQty').addEventListener('input', updateBookSummary);
  $('#scrapImg').addEventListener('change', e => handleImage(e.target.files[0]));
  $('#imgRemove').addEventListener('click', () => { clearImage(); $('#imgErr').textContent = ''; });
  $('#bookForm').addEventListener('submit', submitBooking);

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const id = a.dataset.id;
    if (a.dataset.act === 'cancel') {
      if (confirm('Cancel booking ' + id + '? This cannot be undone.')) { updateBooking(id, b => ({ ...b, status: 'Cancelled' })); toast('Booking cancelled.'); }
    } else {
      updateBooking(id, b => ({ ...b, status: FLOW[Math.min(FLOW.indexOf(b.status) + 1, FLOW.length - 1)] })); toast('Demo status updated.');
    }
  });
  $('#statusFilter').addEventListener('change', renderDashboard);
  $('#bookSearch').addEventListener('input', renderDashboard);
  $('#loadDemo').addEventListener('click', loadDemoData);

  $('#loginBtn').addEventListener('click', () => goAuth('login'));
  $('#signupBtn').addEventListener('click', () => goAuth('signup'));
  $('#tabLogin').addEventListener('click', () => showTab('login'));
  $('#tabSignup').addEventListener('click', () => showTab('signup'));
  $('#logoutBtn').addEventListener('click', logout);
  $('#sessionBox').addEventListener('click', e => { if (e.target.id === 'logout2') logout(); });
  $$('.toggle-pw').forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.target), show = i.type === 'password'; i.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault(); if (!validateForm(e.target)) return;
    const email = $('#lEmail').value.trim(), name = email.split('@')[0];
    save(KEYS.user, { name: name.charAt(0).toUpperCase() + name.slice(1), email, demo: true });
    clearForm(e.target); renderAuth(); toast('Demo login successful.');
  });
  $('#signupForm').addEventListener('submit', e => {
    e.preventDefault(); if (!validateForm(e.target)) return;
    save(KEYS.user, { name: $('#sName').value.trim(), email: $('#sEmail').value.trim(), demo: true }); // password intentionally not stored
    clearForm(e.target); renderAuth(); toast('Demo account created.');
  });

  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault(); if (!validateForm(e.target)) return;
    clearForm(e.target); toast('Thanks! Your message was recorded in this demo (not actually sent).');
  });
  $('#faqList').addEventListener('click', e => {
    const q = e.target.closest('.faq-q'); if (!q) return;
    const open = q.getAttribute('aria-expanded') === 'true';
    q.setAttribute('aria-expanded', !open); $('#' + q.getAttribute('aria-controls')).hidden = open;
  });

  $('#modalClose').addEventListener('click', closeModal);
  $('#modalView').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
document.addEventListener('DOMContentLoaded', init);
})();
