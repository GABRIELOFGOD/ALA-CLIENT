// admin.js v2 — full admin panel
const BASE  = BASEURL;
const tok   = () => localStorage.getItem('token');
const $     = id => document.getElementById(id);

let activeCourseId  = null; // for adding module/quiz
let activeModuleId  = null; // for adding lesson/quiz
let activeRequestId = null; // for resolving cert
let editingCourse   = null; // course being edited
let editingModule   = null;
let editingEvent    = null;
let editingResource = null;
let quizQuestionCount = 0;

// ── Auth guard ───────────────────────────────────────────────
(async () => {
  if (!tok()) { location.assign('/signin.html'); return; }
  try {
    const res = await apiFetch('/users/profile');
    if (!res.data || res.data.role !== 'ADMIN') location.assign('/dashboard.html');
  } catch(_) { location.assign('/signin.html'); }
})();

$('admin-logout').addEventListener('click', () => { localStorage.clear(); location.assign('/signin.html'); });

// ── Core helpers ─────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type':'application/json', authorization:`Bearer ${tok()}`, ...(opts.headers||{}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function toast(msg, type='success') {
  const t = $('toast'); t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

window.openModal  = id => $(id)?.classList.remove('hidden');
window.closeModal = id => $(id)?.classList.add('hidden');

// ── Tab switching ────────────────────────────────────────────
window.showTab = function(id) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  $(id)?.classList.add('active');
  document.querySelectorAll(`.sidebar-link[onclick*="${id}"]`).forEach(l => l.classList.add('active'));
  const loaders = { 'tab-overview': loadStats, 'tab-courses': loadCourses, 'tab-certificates': loadCertRequests, 'tab-users': loadUsers, 'tab-events': loadEvents, 'tab-resources': loadResources };
  loaders[id]?.();
};

// ════════════════════════════════════════════════════════════
//  STATS
// ════════════════════════════════════════════════════════════
async function loadStats() {
  try {
    const { data: d } = await apiFetch('/course/admin/stats');
    $('s-users').textContent = d.totalUsers; $('s-courses').textContent = d.totalCourses;
    $('s-enrollments').textContent = d.totalEnrollments; $('s-pending').textContent = d.pendingCerts;
  } catch(e) { toast(e.message,'error'); }
}

// ════════════════════════════════════════════════════════════
//  COURSES — with expandable rows for modules/quizzes
// ════════════════════════════════════════════════════════════
async function loadCourses() {
  const container = $('courses-container');
  if (!container) return;
  container.innerHTML = '<p class="text-gray-400 py-8 text-center text-sm">Loading...</p>';
  try {
    const { data: courses } = await apiFetch('/course');
    if (!courses.length) { container.innerHTML = '<p class="text-gray-400 py-8 text-center text-sm">No courses yet.</p>'; return; }

    const rows = await Promise.all(courses.map(async (c) => {
      // Fetch module quizzes for each module
      const modQuizData = {};
      for (const m of (c.modules||[])) {
        try {
          const qr = await apiFetch(`/quiz/admin/module/${m._id}`);
          if (qr.data?.length) modQuizData[m._id] = qr.data;
        } catch(_) {}
      }

      // Fetch course-level quiz
      let courseQuizData = [];
      try {
        const cqr = await apiFetch(`/quiz/admin/course/${c._id}`);
        if (cqr.data?.length) courseQuizData = cqr.data;
      } catch(_) {}

      const modulesHtml = (c.modules||[]).map(m => {
        const quizzes   = modQuizData[m._id] || [];
        const lessonsHtml = (m.lessons||[]).map(l => `
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <i class="fa fa-play text-gray-300 text-xs"></i>
            <span class="text-sm text-gray-700 flex-1">${l.title}</span>
            <span class="text-xs text-gray-400">${l.videoUrl?'video':''}</span>
          </div>`).join('');

        const quizzesHtml = quizzes.map(q => `
          <div class="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="fa fa-pencil-alt text-amber-400 text-xs"></i>
                <span class="text-sm text-gray-800 font-medium">${q.title}</span>
                <span class="text-xs text-gray-400">(${q.questions?.length||0} questions)</span>
              </div>
              <div class="flex gap-1.5">
                <button class="btn-sm btn-outline" onclick="openEditQuizModal(${JSON.stringify(q).replace(/"/g,'&quot;')})"><i class="fa fa-edit"></i></button>
                <button class="btn-sm btn-red" onclick="deleteQuiz('${q._id}')"><i class="fa fa-trash"></i></button>
              </div>
            </div>
          </div>`).join('');

        return `
          <div class="border border-gray-100 rounded-xl overflow-hidden mb-2">
            <div class="flex items-center justify-between px-4 py-3 bg-white">
              <div class="flex items-center gap-2 min-w-0">
                <i class="fa fa-play-circle text-gray-300 text-sm flex-shrink-0"></i>
                <span class="text-sm font-medium text-gray-800 truncate">${m.title}</span>
                ${m.lessons?.length ? `<span class="text-xs text-gray-400 flex-shrink-0">${m.lessons.length} lessons</span>` : ''}
                ${quizzes.length ? `<span class="text-xs text-amber-600 flex-shrink-0">${quizzes.length} quiz</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button class="btn-sm btn-outline" onclick="editModule(${JSON.stringify(m).replace(/"/g,'&quot;')},'${c._id}')"><i class="fa fa-edit"></i></button>
                <button class="btn-sm btn-navy" onclick="openAddLesson('${m._id}')">+ Lesson</button>
                <button class="btn-sm btn-orange" onclick="openAddQuiz(null,'${m._id}','${m.title.replace(/'/g,"\'")}')">+ Quiz</button>
                <button class="btn-sm btn-red" onclick="deleteModule('${m._id}','${c._id}')"><i class="fa fa-trash"></i></button>
              </div>
            </div>
            ${(lessonsHtml||quizzesHtml) ? `
            <div class="px-4 pb-3 pt-1 space-y-1.5 bg-gray-50/80 border-t border-gray-100">
              ${lessonsHtml}
              ${quizzesHtml}
            </div>` : ''}
          </div>`;
      }).join('');

      return `
        <div class="card mb-4 overflow-hidden">
          <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <button class="text-gray-400 hover:text-gray-700 w-6 shrink-0" onclick="toggleCourseExpand('${c._id}',this)">
              <i class="fa fa-chevron-down chevron-${c._id}"></i>
            </button>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-gray-900">${c.title}</div>
              <div class="text-xs text-gray-400">${(c.description||'').slice(0,60)}${(c.description||'').length>60?'...':''}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-xs text-gray-400">${c.modules?.length||0} modules</span>
              <button class="btn-sm btn-outline" onclick="editCourse(${JSON.stringify(c).replace(/"/g,'&quot;')})"><i class="fa fa-edit"></i></button>
              <button class="btn-sm btn-orange" onclick="openAddModule('${c._id}','${c.title.replace(/'/g,"\'")}')">+ Module</button>
              <button class="btn-sm btn-navy" onclick="openAddQuiz('${c._id}',null,'${c.title.replace(/'/g,"\'")}')">+ Quiz</button>
              <button class="btn-sm btn-red" onclick="deleteCourse('${c._id}')"><i class="fa fa-trash"></i></button>
            </div>
          </div>
          <div id="expand-${c._id}" class="hidden px-5 pb-4 pt-3 bg-gray-50/50">
            ${courseQuizData.length ? `
              <div class="mb-3">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Course Quiz</p>
                ${courseQuizData.map(q => `
                  <div class="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <i class="fa fa-list-ol text-blue-400 text-xs"></i>
                      <span class="text-sm text-gray-800 font-medium">${q.title}</span>
                      <span class="text-xs text-gray-400">(${q.questions?.length||0} questions · pass: ${q.passingScore}%)</span>
                    </div>
                    <div class="flex gap-1.5">
                      <button class="btn-sm btn-outline" onclick="openEditQuizModal(${JSON.stringify(q).replace(/"/g,'&quot;')})"><i class="fa fa-edit"></i></button>
                      <button class="btn-sm btn-red" onclick="deleteQuiz('${q._id}')"><i class="fa fa-trash"></i></button>
                    </div>
                  </div>`).join('')}
              </div>` : ''}
            ${modulesHtml || '<p class="text-sm text-gray-400 py-2">No modules yet.</p>'}
          </div>
        </div>`;
    }));

    container.innerHTML = rows.join('');
  } catch(e) { toast(e.message,'error'); }
}

// window.toggleCourseExpand = (cid, btn) => {
// window.toggleCourseExpand = (cid, btn) => {
//   const body = $(`expand-${cid}`);
//   if (!body) return;
//   const open = body.classList.toggle('open');
//   btn.classList.toggle('open', open);
// };

window.toggleCourseExpand = (cid, btn) => {
  const body = document.getElementById(`expand-${cid}`);
  if (!body) return;
  const isHidden = body.classList.toggle('hidden');
  const icon = btn.querySelector('i');
  if (icon) icon.className = `fa fa-chevron-${isHidden ? 'down' : 'up'}`;
};

// ── Course CRUD ──────────────────────────────────────────────
window.editCourse = (c) => {
  editingCourse = c;
  $('modal-course-heading').textContent = 'Edit Course';
  $('c-edit-id').value  = c._id;
  $('c-title').value    = c.title;
  $('c-desc').value     = c.description || '';
  $('c-thumb').value    = c.thumbnail   || '';
  openModal('modal-course');
};

window.submitCourse = async () => {
  const id    = $('c-edit-id').value;
  const title = $('c-title').value.trim();
  const desc  = $('c-desc').value.trim();
  const thumb = $('c-thumb').value.trim();
  if (!title) { toast('Title is required','error'); return; }
  try {
    if (id) {
      await apiFetch(`/course/${id}`, { method:'PUT', body:JSON.stringify({title,description:desc,thumbnail:thumb}) });
      toast('Course updated!');
    } else {
      await apiFetch('/course', { method:'POST', body:JSON.stringify({title,description:desc,thumbnail:thumb}) });
      toast('Course created!');
    }
    closeModal('modal-course');
    $('c-edit-id').value = $('c-title').value = $('c-desc').value = $('c-thumb').value = '';
    editingCourse = null;
    $('modal-course-heading').textContent = 'New Course';
    loadCourses(); loadStats();
  } catch(e) { toast(e.message,'error'); }
};

window.deleteCourse = async (id) => {
  if (!confirm('Delete this course and all its modules?')) return;
  try { await apiFetch(`/course/${id}`,{method:'DELETE'}); toast('Course deleted'); loadCourses(); loadStats(); }
  catch(e) { toast(e.message,'error'); }
};

// ── Module CRUD ──────────────────────────────────────────────
window.openAddModule = (cid, cname) => {
  activeCourseId = cid; editingModule = null;
  $('modal-module-heading').textContent = 'Add Module';
  $('modal-module-sub').textContent     = `To: ${cname}`;
  $('m-edit-id').value = $('m-title').value = $('m-video').value = $('m-desc').value = ''; $('m-order').value = '0';
  openModal('modal-module');
};

window.editModule = (m, cid) => {
  activeCourseId = cid; editingModule = m;
  $('modal-module-heading').textContent = 'Edit Module';
  $('modal-module-sub').textContent     = '';
  $('m-edit-id').value = m._id; $('m-title').value = m.title; $('m-video').value = m.videoUrl||''; $('m-desc').value = m.description||''; $('m-order').value = m.order||0;
  openModal('modal-module');
};

window.submitModule = async () => {
  const id       = $('m-edit-id').value;
  const title    = $('m-title').value.trim();
  const videoUrl = $('m-video').value.trim();
  const desc     = $('m-desc').value.trim();
  const order    = parseInt($('m-order').value)||0;
  if (!title) { toast('Title is required','error'); return; }
  try {
    if (id) {
      await apiFetch(`/course/module/${id}`,{method:'PUT',body:JSON.stringify({title,videoUrl,description:desc,order})});
      toast('Module updated!');
    } else {
      await apiFetch(`/course/${activeCourseId}/module`,{method:'POST',body:JSON.stringify({title,videoUrl,description:desc,order})});
      toast('Module added!');
    }
    closeModal('modal-module'); editingModule = null; loadCourses();
  } catch(e) { toast(e.message,'error'); }
};

window.deleteModule = async (mid, cid) => {
  if (!confirm('Delete this module?')) return;
  try { await apiFetch(`/course/module/${mid}`,{method:'DELETE'}); toast('Module deleted'); loadCourses(); }
  catch(e) { toast(e.message,'error'); }
};

// ── Lesson CRUD ──────────────────────────────────────────────
window.openAddLesson = (mid) => {
  activeModuleId = mid;
  $('modal-lesson-heading').textContent = 'Add Lesson';
  $('l-edit-id').value = $('l-title').value = $('l-video').value = $('l-desc').value = '';
  openModal('modal-lesson');
};

window.submitLesson = async () => {
  const id       = $('l-edit-id').value;
  const title    = $('l-title').value.trim();
  const videoUrl = $('l-video').value.trim();
  const desc     = $('l-desc').value.trim();
  if (!title || !videoUrl) { toast('Title and video URL required','error'); return; }
  try {
    if (id) {
      await apiFetch(`/course/module/${activeModuleId}/lesson/${id}`,{method:'PUT',body:JSON.stringify({title,videoUrl,description:desc})});
      toast('Lesson updated!');
    } else {
      await apiFetch(`/course/module/${activeModuleId}/lesson`,{method:'POST',body:JSON.stringify({title,videoUrl,description:desc})});
      toast('Lesson added!');
    }
    closeModal('modal-lesson'); loadCourses();
  } catch(e) { toast(e.message,'error'); }
};

// ── Quiz Builder ─────────────────────────────────────────────
window.openAddQuiz = (cid, mid, name) => {
  activeCourseId = cid; activeModuleId = mid;
  $('modal-quiz-heading').textContent = 'Create Quiz';
  $('modal-quiz-sub').textContent     = `For: ${name}`;
  $('q-title').value = ''; $('q-pass').value = '70';
  $('q-course-id').value = cid||''; $('q-module-id').value = mid||'';
  quizQuestionCount = 0;
  $('quiz-questions-builder').innerHTML = '';
  addQuizQuestion();
  openModal('modal-quiz');
};

window.addQuizQuestion = () => {
  quizQuestionCount++;
  const qi  = quizQuestionCount;
  const div = document.createElement('div');
  div.className = 'quiz-q-block'; div.id = `qqb-${qi}`;
  div.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-500">Question ${qi}</span>
      <button onclick="document.getElementById('qqb-${qi}').remove();quizQuestionCount--;" class="text-red-400 text-xs hover:text-red-600">✕ Remove</button>
    </div>
    <input class="form-input mb-2" id="qq-text-${qi}" placeholder="Enter question...">
    <div id="qq-opts-${qi}" class="space-y-2 mb-2">
      ${[0,1,2,3].map(oi => `
        <div class="option-row">
          <input type="radio" class="correct-radio" name="correct-${qi}" value="${oi}" id="qr-${qi}-${oi}">
          <label for="qr-${qi}-${oi}" class="text-xs text-gray-500 w-4">${String.fromCharCode(65+oi)}</label>
          <input class="form-input flex-1" id="qo-${qi}-${oi}" placeholder="Option ${String.fromCharCode(65+oi)}">
        </div>`).join('')}
    </div>
    <p class="text-xs text-gray-400">Select the radio button next to the correct answer.</p>`;
  $('quiz-questions-builder').appendChild(div);
};

window.submitQuiz = async () => {
  const title    = $('q-title').value.trim();
  const passing  = parseInt($('q-pass').value)||70;
  const courseId = $('q-course-id').value || null;
  const moduleId = $('q-module-id').value || null;
  if (!title) { toast('Quiz title required','error'); return; }

  // Collect questions
  const questions = [];
  document.querySelectorAll('.quiz-q-block').forEach(block => {
    const qi   = block.id.replace('qqb-','');
    const text = $(`qq-text-${qi}`)?.value.trim();
    if (!text) return;
    const options = [0,1,2,3].map(oi => ({
      text:      ($(`qo-${qi}-${oi}`)?.value.trim() || `Option ${String.fromCharCode(65+oi)}`),
      isCorrect: ($(`qr-${qi}-${oi}`)?.checked || false)
    }));
    questions.push({ question: text, options });
  });

  if (!questions.length) { toast('Add at least one question','error'); return; }
  const hasCorrect = questions.every(q => q.options.some(o => o.isCorrect));
  if (!hasCorrect) { toast('Each question must have one correct answer selected','error'); return; }

  try {
    await apiFetch('/quiz', { method:'POST', body:JSON.stringify({ courseId, moduleId, title, questions, passingScore: passing }) });
    toast('Quiz created!');
    closeModal('modal-quiz');
    loadCourses();
  } catch(e) { toast(e.message,'error'); }
};

// ════════════════════════════════════════════════════════════
//  CERTIFICATES
// ════════════════════════════════════════════════════════════
async function loadCertRequests() {
  const tbody = $('certs-table');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-8">Loading...</td></tr>';
  try {
    const { data: reqs } = await apiFetch('/certificates/admin/all');
    if (!reqs.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-8">No requests yet.</td></tr>'; return; }
    tbody.innerHTML = reqs.map(r => {
      const bc = {pending:'badge-pending',approved:'badge-approved',rejected:'badge-rejected'}[r.status]||'';
      return `<tr>
        <td><div class="font-semibold text-gray-900">${r.user?.name||'—'}</div><div class="text-xs text-gray-400">${r.user?.email||''}</div></td>
        <td class="font-medium text-gray-800">${r.course?.title||'—'}</td>
        <td class="font-semibold text-gray-900">${r.quizScore||0}%</td>
        <td class="text-xs text-gray-500">${fmtDate(r.requestedAt)}</td>
        <td><span class="status-badge ${bc}">${r.status}</span></td>
        <td>${r.status==='pending'?`<button class="btn-sm btn-orange" onclick="openCertModal('${r._id}','${(r.user?.name||'').replace(/'/g,"\\'")}','${(r.course?.title||'').replace(/'/g,"\\'")}','${r.quizScore||0}')">Review</button>`:'<span class="text-xs text-gray-400">Done</span>'}</td>
      </tr>`;
    }).join('');
  } catch(e) { toast(e.message,'error'); }
}

window.openCertModal = (rid, name, course, score) => {
  activeRequestId = rid;
  $('modal-cert-info').innerHTML = `<strong>${name}</strong> requests a certificate for <strong>${course}</strong>. Quiz score: <strong>${score}%</strong>.`;
  openModal('modal-cert');
};

window.resolveCert = async (status) => {
  try {
    await apiFetch(`/certificates/admin/${activeRequestId}/resolve`,{method:'PATCH',body:JSON.stringify({status})});
    toast(status==='approved'?'✓ Approved & email sent!':'Request rejected');
    closeModal('modal-cert'); loadCertRequests(); loadStats();
  } catch(e) { toast(e.message,'error'); }
};

// ════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════
async function loadUsers() {
  const tbody = $('users-table');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-400 py-8">Loading...</td></tr>';
  try {
    const { data: d } = await apiFetch('/users/all');
    const users = d.users||[];
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-400 py-8">No users.</td></tr>'; return; }
    tbody.innerHTML = users.map(u => `<tr>
      <td><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:hsl(240,47%,35%);">${(u.name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div><span class="font-medium text-gray-900">${u.name}</span></div></td>
      <td class="text-gray-600">${u.email}</td>
      <td class="text-xs text-gray-400">${fmtDate(u.createdAt)}</td>
    </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

// ════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════
async function loadEvents() {
  const tbody = $('events-table');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-8">Loading...</td></tr>';
  try {
    const { data: evts } = await apiFetch('/content/admin/events');
    if (!evts.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-8">No events yet.</td></tr>'; return; }
    tbody.innerHTML = evts.map(e => `<tr>
      <td><div class="font-semibold text-gray-900">${e.title}</div><div class="text-xs text-gray-400">${(e.description||'').slice(0,50)}${(e.description||'').length>50?'...':''}</div></td>
      <td class="text-sm text-gray-600">${fmtDate(e.date)}${e.time?' · '+e.time:''}</td>
      <td><span class="text-xs font-semibold px-2 py-1 rounded-full" style="background:${e.isOnline?'#e0f2fe':'#f0fdf4'};color:${e.isOnline?'#0891b2':'#16a34a'};">${e.isOnline?'Online':'In-Person'}</span></td>
      <td><div class="flex gap-1.5">
        <button class="btn-sm btn-outline" onclick="editEvent(${JSON.stringify(e).replace(/"/g,'&quot;')})"><i class="fa fa-edit"></i></button>
        <button class="btn-sm btn-red" onclick="deleteEvent('${e._id}')"><i class="fa fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

window.editEvent = (e) => {
  editingEvent = e;
  $('modal-event-heading').textContent = 'Edit Event';
  $('ev-edit-id').value = e._id; $('ev-title').value = e.title; $('ev-desc').value = e.description||'';
  $('ev-date').value = e.date?.split('T')[0]||''; $('ev-time').value = e.time||'';
  $('ev-location').value = e.location||''; $('ev-url').value = e.meetingUrl||''; $('ev-image').value = e.image||'';
  openModal('modal-event');
};

window.submitEvent = async () => {
  const id    = $('ev-edit-id').value;
  const body  = { title:$('ev-title').value.trim(), description:$('ev-desc').value.trim(), date:$('ev-date').value, time:$('ev-time').value.trim(), location:$('ev-location').value.trim(), meetingUrl:$('ev-url').value.trim(), image:$('ev-image').value.trim(), isOnline: !!$('ev-url').value.trim() };
  if (!body.title||!body.date) { toast('Title and date required','error'); return; }
  try {
    if (id) { await apiFetch(`/content/events/${id}`,{method:'PUT',body:JSON.stringify(body)}); toast('Event updated!'); }
    else     { await apiFetch('/content/events',{method:'POST',body:JSON.stringify(body)}); toast('Event created!'); }
    closeModal('modal-event'); $('ev-edit-id').value=''; $('modal-event-heading').textContent='New Event'; editingEvent=null; loadEvents();
  } catch(e) { toast(e.message,'error'); }
};

window.deleteEvent = async (id) => {
  if (!confirm('Delete this event?')) return;
  try { await apiFetch(`/content/events/${id}`,{method:'DELETE'}); toast('Event deleted'); loadEvents(); }
  catch(e) { toast(e.message,'error'); }
};

// ════════════════════════════════════════════════════════════
//  RESOURCES
// ════════════════════════════════════════════════════════════
async function loadResources() {
  const tbody = $('resources-table');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-8">Loading...</td></tr>';
  try {
    const { data: ress } = await apiFetch('/content/admin/resources');
    if (!ress.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-8">No resources yet.</td></tr>'; return; }
    tbody.innerHTML = ress.map(r => `<tr>
      <td><div class="font-semibold text-gray-900">${r.title}</div><div class="text-xs text-gray-400">${(r.description||'').slice(0,50)}${(r.description||'').length>50?'...':''}</div></td>
      <td><span class="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">${r.type}</span></td>
      <td class="text-xs text-gray-500">${(r.tags||[]).join(', ')||'—'}</td>
      <td><div class="flex gap-1.5">
        <button class="btn-sm btn-outline" onclick="editResource(${JSON.stringify(r).replace(/"/g,'&quot;')})"><i class="fa fa-edit"></i></button>
        <button class="btn-sm btn-red" onclick="deleteResource('${r._id}')"><i class="fa fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

window.editResource = (r) => {
  editingResource = r;
  $('modal-resource-heading').textContent = 'Edit Resource';
  $('r-edit-id').value = r._id; $('r-title').value = r.title; $('r-desc').value = r.description||'';
  $('r-type').value = r.type; $('r-url').value = r.url||''; $('r-image').value = r.image||''; $('r-tags').value = (r.tags||[]).join(', ');
  openModal('modal-resource');
};

window.submitResource = async () => {
  const id   = $('r-edit-id').value;
  const body = { title:$('r-title').value.trim(), description:$('r-desc').value.trim(), type:$('r-type').value, url:$('r-url').value.trim(), image:$('r-image').value.trim(), tags:$('r-tags').value.split(',').map(t=>t.trim()).filter(Boolean) };
  if (!body.title||!body.type) { toast('Title and type required','error'); return; }
  try {
    if (id) { await apiFetch(`/content/resources/${id}`,{method:'PUT',body:JSON.stringify(body)}); toast('Resource updated!'); }
    else     { await apiFetch('/content/resources',{method:'POST',body:JSON.stringify(body)}); toast('Resource created!'); }
    closeModal('modal-resource'); $('r-edit-id').value=''; $('modal-resource-heading').textContent='New Resource'; editingResource=null; loadResources();
  } catch(e) { toast(e.message,'error'); }
};

window.deleteResource = async (id) => {
  if (!confirm('Delete this resource?')) return;
  try { await apiFetch(`/content/resources/${id}`,{method:'DELETE'}); toast('Resource deleted'); loadResources(); }
  catch(e) { toast(e.message,'error'); }
};


// ════════════════════════════════════════════════════════════
//  QUIZ EDIT / DELETE
// ════════════════════════════════════════════════════════════
window.deleteQuiz = async (quizId) => {
  if (!confirm('Delete this quiz and all its questions?')) return;
  try {
    await apiFetch(`/quiz/${quizId}`, { method:'DELETE' });
    toast('Quiz deleted');
    loadCourses();
  } catch(e) { toast(e.message,'error'); }
};

window.openEditQuizModal = (quiz) => {
  // Reuse quiz builder modal, pre-populate
  $('modal-quiz-heading').textContent = 'Edit Quiz';
  $('modal-quiz-sub').textContent     = quiz.title;
  $('q-title').value = quiz.title;
  $('q-pass').value  = quiz.passingScore;
  $('q-course-id').value = quiz.course || '';
  $('q-module-id').value = quiz.module || '';

  // Store quiz id for update
  $('modal-quiz').dataset.editId = quiz._id;

  quizQuestionCount = 0;
  $('quiz-questions-builder').innerHTML = '';

  (quiz.questions || []).forEach(q => {
    quizQuestionCount++;
    const qi  = quizQuestionCount;
    const div = document.createElement('div');
    div.className = 'quiz-q-block'; div.id = `qqb-${qi}`;

    if (quiz.type === 'text') {
      div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-gray-500">Question ${qi}</span>
          <button onclick="document.getElementById('qqb-${qi}').remove();quizQuestionCount--;" class="text-red-400 text-xs hover:text-red-600">✕ Remove</button>
        </div>
        <input class="form-input" id="qq-text-${qi}" placeholder="Enter question..." value="${q.question.replace(/"/g,'&quot;')}">`;
    } else {
      const optRows = [0,1,2,3].map(oi => {
        const opt = q.options?.[oi];
        return `<div class="option-row">
          <input type="radio" class="correct-radio" name="correct-${qi}" value="${oi}" id="qr-${qi}-${oi}" ${opt?.isCorrect?'checked':''}>
          <label for="qr-${qi}-${oi}" class="text-xs text-gray-500 w-4">${String.fromCharCode(65+oi)}</label>
          <input class="form-input flex-1" id="qo-${qi}-${oi}" value="${(opt?.text||'').replace(/"/g,'&quot;')}" placeholder="Option ${String.fromCharCode(65+oi)}">
        </div>`;
      }).join('');
      div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-gray-500">Question ${qi}</span>
          <button onclick="document.getElementById('qqb-${qi}').remove();quizQuestionCount--;" class="text-red-400 text-xs hover:text-red-600">✕ Remove</button>
        </div>
        <input class="form-input mb-2" id="qq-text-${qi}" placeholder="Enter question..." value="${q.question.replace(/"/g,'&quot;')}">
        <div id="qq-opts-${qi}" class="space-y-2 mb-2">${optRows}</div>
        <p class="text-xs text-gray-400">Select the correct answer radio button.</p>`;
    }
    $('quiz-questions-builder').appendChild(div);
  });

  openModal('modal-quiz');
};

// Override submitQuiz to handle both create and edit
const _origSubmitQuiz = window.submitQuiz;
window.submitQuiz = async () => {
  const editId   = $('modal-quiz').dataset.editId;
  const title    = $('q-title').value.trim();
  const passing  = parseInt($('q-pass').value)||70;
  const courseId = $('q-course-id').value || null;
  const moduleId = $('q-module-id').value || null;
  if (!title) { toast('Quiz title required','error'); return; }

  const questions = [];
  const isText    = !!moduleId; // module quizzes = text type

  document.querySelectorAll('.quiz-q-block').forEach(block => {
    const qi   = block.id.replace('qqb-','');
    const text = $(`qq-text-${qi}`)?.value.trim();
    if (!text) return;
    if (isText) {
      questions.push({ question: text, options: [] });
    } else {
      const options = [0,1,2,3].map(oi => ({
        text:      ($(`qo-${qi}-${oi}`)?.value.trim() || `Option ${String.fromCharCode(65+oi)}`),
        isCorrect: ($(`qr-${qi}-${oi}`)?.checked || false)
      }));
      questions.push({ question: text, options });
    }
  });

  if (!questions.length) { toast('Add at least one question','error'); return; }
  if (!isText) {
    const hasCorrect = questions.every(q => q.options.some(o => o.isCorrect));
    if (!hasCorrect) { toast('Each MCQ question needs a correct answer selected','error'); return; }
  }

  try {
    if (editId) {
      await apiFetch(`/quiz/${editId}`, { method:'PUT', body:JSON.stringify({ title, questions, passingScore: passing }) });
      toast('Quiz updated!');
      delete $('modal-quiz').dataset.editId;
    } else {
      await apiFetch('/quiz', { method:'POST', body:JSON.stringify({ courseId, moduleId, title, questions, passingScore: passing }) });
      toast('Quiz created!');
    }
    closeModal('modal-quiz');
    $('quiz-questions-builder').innerHTML = '';
    $('modal-quiz-heading').textContent = 'Create Quiz';
    loadCourses();
  } catch(e) { toast(e.message,'error'); }
};

// Init
loadStats();
