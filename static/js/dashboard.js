// dashboard.js v2
AuthManager.requireAuth();
AuthManager.init();

const BASE = BASEURL;
const tok  = () => localStorage.getItem('token');
const $    = id => document.getElementById(id);

async function api(path, opts={}) {
  const res  = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type':'application/json', authorization:`Bearer ${tok()}`, ...(opts.headers||{}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error');
  return data;
}

function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

// ── Stats ────────────────────────────────────────────────────
function renderStats(enr, certs) {
  $('stat-enrolled').textContent  = enr.length;
  $('stat-completed').textContent = enr.filter(e=>e.isCompleted).length;
  $('stat-certs').textContent     = certs.filter(c=>c.status==='approved').length;
}

// ── Courses ──────────────────────────────────────────────────
function renderCourses(enr) {
  const el = $('courses-list');
  if (!enr.length) {
    el.innerHTML = `<div class="text-center py-10"><div class="text-4xl mb-3">📭</div><p class="text-gray-500 text-sm mb-4">Not enrolled in any courses yet.</p><a href="programs.html" class="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style="background:hsl(240,47%,35%);">Browse Courses</a></div>`;
    return;
  }
  el.innerHTML = enr.map(e => {
    const c     = e.course;
    const total = c.modules?.length || 0;
    const done  = e.completedModules?.length || 0;
    const pct   = total > 0 ? Math.round((done/total)*100) : 0;
    const badge = e.isCompleted
      ? `<span style="background:#f0fdf4;color:#16a34a;" class="status-badge">✓ Completed</span>`
      : `<span style="background:#fff4ed;color:#f07d3a;" class="status-badge">In Progress</span>`;
    return `
      <div class="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-heading font-bold text-xl shrink-0" style="background:hsl(240,47%,35%);">${c.title?.[0]||'?'}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-900 text-sm">${c.title}</div>
          <div class="text-xs text-gray-400 mt-0.5 mb-2">${done}/${total} modules</div>
          <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          ${badge}
          <a href="course.html?id=${c._id}" class="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style="background:hsl(240,47%,35%);">${e.isCompleted?'Review':'Continue'} →</a>
        </div>
      </div>`;
  }).join('');
}

// ── Certificates ─────────────────────────────────────────────
function renderCertificates(certs, enr) {
  const el = $('certs-list');
  const requestedIds = certs.map(c => (c.course?._id||c.course)?.toString());
  const canRequest   = enr.filter(e => e.isCompleted && !requestedIds.includes((e.course?._id||e.course)?.toString()));

  let html = '';

  certs.forEach(c => {
    const bg  = {approved:'#f0fdf4',pending:'#fef3c7',rejected:'#fef2f2'}[c.status]||'#f9fafb';
    const txt = {approved:'#16a34a',pending:'#d97706',rejected:'#dc2626'}[c.status]||'#374151';
    const ico = {approved:'🎓',pending:'⏳',rejected:'❌'}[c.status]||'📄';
    const statusTxt = {approved:'Certificate approved!',pending:'Awaiting admin review',rejected:'Request rejected — contact support'}[c.status]||'';
    html += `
      <div class="flex items-center gap-4 p-4 rounded-xl" style="background:${bg};">
        <div class="text-2xl">${ico}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-900 text-sm">${c.course?.title||'Course'}</div>
          <div class="text-xs mt-0.5" style="color:${txt};">${statusTxt}</div>
          ${c.quizScore ? `<div class="text-xs text-gray-400 mt-0.5">Quiz score: ${c.quizScore}%</div>` : ''}
        </div>
        ${c.status==='approved' ? `
          <div class="flex gap-2 shrink-0">
            <button onclick="dlCert('${c._id}')" class="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style="background:hsl(240,47%,35%);">⬇ Download</button>
            <button onclick="emailCert('${c._id}',this)" class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-white">✉ Email</button>
          </div>` : ''}
      </div>`;
  });

  canRequest.forEach(e => {
    const cid = (e.course?._id||e.course)?.toString();
    html += `
      <div class="flex items-center gap-4 p-4 rounded-xl border border-gray-200">
        <div class="text-2xl">🏆</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-900 text-sm">${e.course?.title||'Course'}</div>
          <div class="text-xs text-gray-400 mt-0.5">Course completed — request your certificate</div>
        </div>
        <button onclick="requestCert('${cid}',this)" class="text-xs font-semibold px-3 py-1.5 rounded-lg text-white shrink-0" style="background:hsl(24,67%,51%);">Request</button>
      </div>`;
  });

  if (!html) html = `<div class="text-center py-6 text-gray-400 text-sm">Complete a course and pass the quiz to apply for your certificate.</div>`;
  el.innerHTML = html;
}

window.requestCert = async (courseId, btn) => {
  btn.textContent = '...'; btn.disabled = true;
  try { await api(`/certificates/${courseId}/request`,{method:'POST'}); load(); }
  catch(e) { btn.textContent='Request'; btn.disabled=false; alert(e.message); }
};

window.dlCert = async (certId) => {
  const btn = event?.target;
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const res = await fetch(`${BASE}/certificates/${certId}/download`, {
      headers: { authorization: `Bearer ${tok()}` }
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url; a.download = 'AI-Literacy-Certificate.pdf';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(e) { alert(e.message); }
  finally { if (btn) { btn.textContent = '⬇ Download'; btn.disabled = false; } }
};

window.emailCert = async (certId, btn) => {
  btn.textContent = '...'; btn.disabled = true;
  try {
    await api(`/certificates/${certId}/email`,{method:'POST'});
    btn.textContent = '✓ Sent!';
    setTimeout(()=>{ btn.textContent='✉ Email'; btn.disabled=false; },2500);
  } catch(e) { btn.textContent='✉ Email'; btn.disabled=false; alert(e.message); }
};

async function load() {
  try {
    const [er, cr, pr] = await Promise.all([
      api('/course/user/enrollments'),
      api('/certificates/mine'),
      api('/users/profile')
    ]);
    const enr   = er.data||[];
    const certs = cr.data||[];
    const user  = pr.data||{};

    const first = (user.name||'').split(' ')[0];
    $('greeting').textContent  = `Welcome back, ${first||'there'}! 👋`;
    $('sb-name').textContent   = user.name||'';
    $('sb-email').textContent  = user.email||'';
    $('sb-avatar').textContent = (user.name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    renderStats(enr, certs);
    renderCourses(enr);
    renderCertificates(certs, enr);
  } catch(e) { console.error(e); }
}

['logout-sidebar','logout-top'].forEach(id => {
  const el = $(id);
  if(el) el.addEventListener('click',()=>{ AuthManager.logout(); location.assign('/signin.html'); });
});

load();
