// course.js v3 — sequential modules, text quizzes, course MCQ quiz, cert download
AuthManager.init();

const BASE  = BASEURL;
const tok   = () => localStorage.getItem('token');
const $     = id => document.getElementById(id);
const params   = new URLSearchParams(location.search);
const courseId = params.get('id');
if (!courseId) location.assign('/dashboard.html');

let courseData    = null;
let enrollment    = null;
let isEnrolled    = false;
let activeMod     = null;
let activeLesson  = null;
let quizData      = null;      // course MCQ quiz (fetched only when ready)
let myBestAttempt = null;
let certData      = null;
let lastAttemptId = null;
let quizAnswers   = {};
let quizSubmitted = false;
// module text quiz state
let activeModQuiz   = null;    // quiz object currently shown in module dropdown
let modQuizAnswers  = {};      // questionId -> text answer

window.courseData = null;

async function api(path, opts = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (tok()) h.authorization = `Bearer ${tok()}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...h, ...(opts.headers||{}) } });
  const d   = await res.json();
  if (!res.ok) throw new Error(d.message || 'Error');
  return d;
}

// ── Video embed ───────────────────────────────────────────────
function toEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

function renderVideo(url, wrap) {
  const embed = url ? toEmbed(url) : null;
  if (!embed) {
    wrap.innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center" style="background:#0f172a;border-radius:12px;color:#fff;">
      <i class="fa fa-play-circle text-5xl mb-3 opacity-40"></i>
      <p class="text-sm opacity-40">Select a module to start watching</p></div>`;
    return;
  }
  if (embed.match(/\.(mp4|webm|ogg)$/i)) {
    wrap.innerHTML = `<video controls autoplay style="width:100%;height:100%;"><source src="${embed}"></video>`;
  } else {
    wrap.innerHTML = `<iframe src="${embed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
  }
}

// ── Module lock logic ─────────────────────────────────────────
function isModuleLocked(idx) {
  if (!isEnrolled) return idx > 0; // first always playable even before enroll
  if (idx === 0) return false;
  const mods = courseData?.modules || [];
  const prevId = mods[idx - 1]?._id;
  return !isDone(prevId);
}

function isDone(modId) {
  if (!modId) return false;
  return enrollment?.completedModules?.some(m => m.toString() === modId.toString()) ?? false;
}

// ── Mark complete UI ──────────────────────────────────────────
function updateMarkBtn(modId) {
  if (!isEnrolled) {
    $('mark-done-btn').classList.add('hidden');
    $('already-done-tag').classList.add('hidden');
    return;
  }
  const done = isDone(modId);
  $('mark-done-btn').classList.toggle('hidden', done);
  $('mark-done-btn').textContent = 'Mark as Complete';
  $('mark-done-btn').disabled    = false;
  const tag = $('already-done-tag');
  if (done) { tag.classList.remove('hidden'); tag.style.display = 'inline-flex'; }
  else       { tag.classList.add('hidden');    tag.style.display = 'none'; }
}

// ── Play a module / lesson ────────────────────────────────────
function playItem(mod, lesson = null) {
  activeMod    = mod;
  activeLesson = lesson;
  const url    = lesson ? lesson.videoUrl : mod.videoUrl;
  const title  = lesson ? `${mod.title} › ${lesson.title}` : mod.title;
  const desc   = lesson ? (lesson.description||'') : (mod.description||'');

  renderVideo(url, $('video-wrap'));
  $('now-playing').textContent = title;
  $('module-desc').textContent  = desc;

  document.querySelectorAll('.module-item, .lesson-item').forEach(e => e.classList.remove('active'));
  if (lesson) document.querySelector(`.lesson-item[data-lid="${lesson._id}"]`)?.classList.add('active');
  else        document.querySelector(`.module-item[data-id="${mod._id}"]`)?.classList.add('active');

  if (!lesson) updateMarkBtn(mod._id);
  else {
    // Lessons inside a module: show mark-complete for the parent module
    // only if the module itself isn't already done
    updateMarkBtn(mod._id);
  }
}

// ── Render sidebar module list ────────────────────────────────
async function renderModules() {
  const mods      = courseData?.modules || [];
  const totalMods = mods.length;
  const doneMods  = mods.filter(m => isDone(m._id)).length;
  const pct       = totalMods > 0 ? Math.round((doneMods / totalMods) * 100) : 0;
  $('prog-fill').style.width  = `${pct}%`;
  $('prog-pct').textContent   = `${pct}%`;
  $('prog-label').textContent = `${doneMods} of ${totalMods} modules completed`;

  if (!totalMods) { $('module-list').innerHTML = `<div class="text-center py-6 text-gray-400 text-sm">No content yet.</div>`; return; }

  // Fetch module quizzes for each module (if enrolled)
  let modQuizMap = {}; // moduleId -> quiz[]
  if (isEnrolled) {
    await Promise.all(mods.map(async (m) => {
      try {
        const r = await api(`/quiz/module/${m._id}`);
        if (r.data?.length) modQuizMap[m._id] = r.data;
      } catch(_) {}
    }));
  }

  // Fetch user's text quiz submissions for this course
  let myModAttempts = {}; // quizId -> attempt
  if (isEnrolled) {
    for (const mId of Object.keys(modQuizMap)) {
      for (const q of modQuizMap[mId]) {
        try {
          const r = await api(`/quiz/module-attempt/${q._id}`);
          if (r.data) myModAttempts[q._id] = r.data;
        } catch(_) {}
      }
    }
  }

  $('module-list').innerHTML = mods.map((m, i) => {
    const done       = isDone(m._id);
    const locked     = isModuleLocked(i);
    const hasLessons = m.lessons?.length > 0;
    const quizzes    = modQuizMap[m._id] || [];
    const hasQuizzes = quizzes.length > 0;
    const hasDropdown = hasLessons || hasQuizzes;

    const iconContent = locked
      ? `<i class="fa fa-lock text-gray-400" style="font-size:.75rem;"></i>`
      : done
        ? `<i class="fa fa-check"></i>`
        : `<span style="font-size:.75rem;font-weight:700;">${i+1}</span>`;

    const lessonsHtml = hasLessons ? m.lessons.sort((a,b)=>a.order-b.order).map((l, li) => `
      <div class="lesson-item ${locked?'opacity-40 pointer-events-none':''}" data-lid="${l._id}"
           onclick="${locked?'':'playItem(courseData.modules['+i+'], courseData.modules['+i+'].lessons['+li+'])'}">
        <i class="fa fa-play text-gray-300 text-xs flex-shrink-0"></i>
        <span class="text-xs text-gray-700 truncate flex-1">${l.title}</span>
      </div>`).join('') : '';

    const quizzesHtml = hasQuizzes && isEnrolled ? quizzes.map(q => {
      const submitted = !!myModAttempts[q._id];
      return `
        <div class="lesson-item cursor-pointer" onclick="openModuleQuiz(${JSON.stringify(q).replace(/"/g,'&quot;')}, '${m._id}')">
          <i class="fa fa-pencil-alt text-gray-300 text-xs flex-shrink-0"></i>
          <span class="text-xs text-gray-700 truncate flex-1">${q.title}</span>
          ${submitted ? `<i class="fa fa-check-circle text-green-500 text-xs"></i>` : `<span class="text-xs text-gray-400">Open</span>`}
        </div>`;
    }).join('') : '';

    return `
      <div>
        <div class="module-item ${done?'done':''} ${locked?'opacity-60':''}"
             data-id="${m._id}"
             onclick="${locked ? `showLockedMsg(${i})` : `handleModClick('${m._id}',${i})`}"
             style="${locked?'cursor:not-allowed;':''}" title="${locked?'Complete the previous module first':''}">
          <div class="mod-icon ${locked?'':''}${done?'done':''}">${iconContent}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate" style="color:${locked?'#9ca3af':'#111827'};">${m.title}</div>
            ${locked ? `<div class="text-xs text-gray-400">🔒 Locked</div>`
                     : done ? `<div class="text-xs text-green-600 font-medium">Completed</div>`
                     : `<div class="text-xs text-gray-400">${hasLessons?m.lessons.length+' lessons ':''}${hasQuizzes?quizzes.length+' quiz':''}${!hasLessons&&!hasQuizzes?'Click to start':''}</div>`}
          </div>
          ${hasDropdown && !locked ? `<i class="fa fa-chevron-down text-gray-300 text-xs flex-shrink-0 mod-chevron-${m._id}"></i>` : ''}
          ${!hasDropdown && !locked ? `<i class="fa fa-play-circle text-gray-300 text-sm"></i>` : ''}
        </div>
        ${(hasDropdown && !locked) ? `
          <div id="dropdown-${m._id}" class="mt-1 space-y-1 pl-2 hidden">
            ${lessonsHtml}
            ${quizzesHtml}
          </div>` : ''}
      </div>`;
  }).join('');

  window.courseData = courseData;

  // Show/hide cert section
  updateCertSection();
}

window.showLockedMsg = (idx) => {
  const mods   = courseData?.modules || [];
  const prevMod = mods[idx - 1];
  alert(`🔒 Complete "${prevMod?.title || 'the previous module'}" first to unlock this module.`);
};

function handleModClick(modId, idx) {
  const mod = courseData.modules[idx];
  const hasDropdown = (mod.lessons?.length > 0) || false;
  // Check quizzes from rendered DOM
  const dropdownEl = $(`dropdown-${modId}`);
  const hasQuizzesEl = dropdownEl?.querySelector('.lesson-item');

  if (dropdownEl && (hasDropdown || hasQuizzesEl)) {
    const hidden = dropdownEl.classList.contains('hidden');
    dropdownEl.classList.toggle('hidden', !hidden);
    const chevron = document.querySelector(`.mod-chevron-${modId}`);
    if (chevron) chevron.className = `fa fa-chevron-${hidden?'up':'down'} text-gray-300 text-xs flex-shrink-0 mod-chevron-${modId}`;
    if (mod.videoUrl) playItem(mod);
    else document.querySelector(`.module-item[data-id="${modId}"]`)?.classList.add('active');
  } else {
    playItem(mod);
  }
}
window.handleModClick = handleModClick;
window.playItem = playItem;

// ── Module text quiz dropdown ─────────────────────────────────
window.openModuleQuiz = async (quiz, moduleId) => {
  activeModQuiz  = { ...quiz, moduleId };
  modQuizAnswers = {};

  const panel = $('module-quiz-panel');
  if (!panel) return;

  $('module-quiz-title').textContent = quiz.title;
  $('module-quiz-questions').innerHTML = quiz.questions.map((q, i) => `
    <div class="mb-5">
      <p class="font-semibold text-gray-900 text-sm mb-2">${i+1}. ${q.question}</p>
      <textarea id="mqa-${q._id || i}" rows="3"
        class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors resize-none"
        placeholder="Type your answer here..."
        oninput="modQuizAnswers['${q._id || i}'] = { questionId:'${q._id || i}', questionText:${JSON.stringify(q.question)}, answer:this.value };"
      ></textarea>
    </div>`).join('');

  // Check for existing submission
  try {
    const r = await api(`/quiz/module-attempt/${quiz._id}`);
    if (r.data?.answers?.length) {
      r.data.answers.forEach(a => {
        const ta = document.getElementById(`mqa-${a.questionId}`);
        if (ta) { ta.value = a.answer; modQuizAnswers[a.questionId] = a; }
      });
      $('module-quiz-submit-btn').textContent = 'Resubmit Answers';
    }
  } catch(_) {}

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

document.addEventListener('DOMContentLoaded', () => {
  $('module-quiz-submit-btn')?.addEventListener('click', async () => {
    if (!activeModQuiz) return;
    const answers = Object.values(modQuizAnswers).filter(a => a.answer?.trim());
    if (!answers.length) { alert('Please answer at least one question.'); return; }

    $('module-quiz-submit-btn').textContent = 'Submitting...';
    $('module-quiz-submit-btn').disabled    = true;
    try {
      await api('/quiz/submit-module', { method:'POST', body: JSON.stringify({
        quizId:   activeModQuiz._id,
        moduleId: activeModQuiz.moduleId,
        courseId,
        answers:  Object.values(modQuizAnswers)
      })});
      $('module-quiz-submit-btn').textContent = '✓ Submitted!';
      setTimeout(() => {
        $('module-quiz-panel').classList.add('hidden');
        $('module-quiz-submit-btn').textContent = 'Submit Answers';
        $('module-quiz-submit-btn').disabled    = false;
        activeModQuiz = null;
        renderModules();
      }, 1200);
    } catch(e) {
      alert(e.message);
      $('module-quiz-submit-btn').textContent = 'Submit Answers';
      $('module-quiz-submit-btn').disabled    = false;
    }
  });

  $('module-quiz-close-btn')?.addEventListener('click', () => {
    $('module-quiz-panel').classList.add('hidden');
    activeModQuiz = null;
  });
});

// ── Mark module complete ──────────────────────────────────────
$('mark-done-btn').addEventListener('click', async () => {
  if (!activeMod || !isEnrolled) return;
  const modId = activeMod._id;
  $('mark-done-btn').textContent = 'Saving...';
  $('mark-done-btn').disabled    = true;
  try {
    const res = await api(`/course/${courseId}/module/${modId}/complete`, { method:'POST' });
    enrollment = { ...enrollment, ...res.data };

    // Check if this was the last module
    const mods       = courseData?.modules || [];
    const allDone    = mods.every(m => isDone(m._id) || m._id === modId);
    const isLastMod  = mods[mods.length - 1]?._id === modId;

    await renderModules();
    updateMarkBtn(modId);

    // If last module just completed, show course quiz prompt
    if (isLastMod && res.data.isCompleted) {
      showCourseQuizPrompt();
    }
  } catch(e) {
    $('mark-done-btn').textContent = 'Mark as Complete';
    $('mark-done-btn').disabled    = false;
    alert(e.message);
  }
});

// ── Course quiz (MCQ) — shown only after all modules done ─────
function showCourseQuizPrompt() {
  if (!quizData) {
    // No quiz — go straight to cert
    updateCertSection();
    return;
  }
  $('quiz-section').classList.remove('hidden');
  $('quiz-locked').classList.add('hidden');
  $('quiz-content').classList.remove('hidden');
  $('quiz-section').scrollIntoView({ behavior: 'smooth' });
  renderQuiz();
}

function updateQuizSection(allModsDone) {
  if (!isEnrolled) return;
  if (!quizData) {
    $('quiz-section').classList.add('hidden');
    return;
  }
  $('quiz-section').classList.remove('hidden');
  if (!allModsDone) {
    $('quiz-locked').classList.remove('hidden');
    $('quiz-content').classList.add('hidden');
  } else {
    $('quiz-locked').classList.add('hidden');
    $('quiz-content').classList.remove('hidden');
    renderQuiz();
  }
}

function renderQuiz() {
  if (!quizData) return;
  $('quiz-title').textContent         = quizData.title;
  $('quiz-passing-badge').textContent = `Pass: ${quizData.passingScore}%`;

  if (myBestAttempt?.passed) {
    showQuizResult(myBestAttempt, false);
    return;
  }
  quizAnswers   = {};
  quizSubmitted = false;
  $('quiz-status-bar').classList.add('hidden');
  $('quiz-retake-btn').classList.add('hidden');
  $('quiz-email-btn').classList.add('hidden');
  $('quiz-submit-btn').classList.remove('hidden');

  $('quiz-questions').innerHTML = quizData.questions.map((q, qi) => `
    <div class="quiz-question" data-qi="${qi}">
      <p class="font-semibold text-gray-900 mb-3 text-sm">${qi+1}. ${q.question}</p>
      <div class="space-y-2">
        ${q.options.map((o, oi) => `
          <div class="quiz-option" data-qi="${qi}" data-oi="${oi}" onclick="selectOption(${qi},${oi})">
            <div class="option-circle">${String.fromCharCode(65+oi)}</div>
            <span class="text-sm text-gray-800">${o.text}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

window.selectOption = (qi, oi) => {
  if (quizSubmitted) return;
  quizAnswers[qi] = oi;
  document.querySelectorAll(`.quiz-option[data-qi="${qi}"]`).forEach(el => el.classList.remove('selected'));
  document.querySelector(`.quiz-option[data-qi="${qi}"][data-oi="${oi}"]`)?.classList.add('selected');
};

$('quiz-submit-btn').addEventListener('click', async () => {
  if (!quizData) return;
  const total    = quizData.questions.length;
  const answered = Object.keys(quizAnswers).length;
  if (answered < total) { alert(`Please answer all ${total} questions.`); return; }
  $('quiz-submit-btn').textContent = 'Submitting...';
  $('quiz-submit-btn').disabled    = true;
  try {
    const answers = quizData.questions.map((q, i) => ({
      questionId:    (q._id || String(i)),
      selectedIndex: quizAnswers[i] ?? -1
    }));
    const res = await api('/quiz/submit', { method:'POST', body: JSON.stringify({ quizId: quizData._id, courseId, answers }) });
    lastAttemptId = res.data.attemptId;
    myBestAttempt = { score: res.data.score, passed: res.data.passed, passingScore: res.data.passingScore, results: res.data.results };
    showQuizResult(myBestAttempt, true);
    if (res.data.passed) {
      // Auto-apply for certificate
      try {
        const certRes = await api(`/certificates/${courseId}/request`, { method:'POST' });
        certData = certRes.data;
      } catch(_) {}
      updateCertSection();
    }
  } catch(e) {
    $('quiz-submit-btn').textContent = 'Submit Quiz';
    $('quiz-submit-btn').disabled    = false;
    alert(e.message);
  }
});

function showQuizResult(attempt, showAnswers) {
  quizSubmitted = true;
  const passed  = attempt.passed;
  const bar     = $('quiz-status-bar');
  bar.classList.remove('hidden');
  bar.style.background = passed ? '#f0fdf4' : '#fef2f2';
  bar.style.color      = passed ? '#16a34a' : '#dc2626';
  bar.textContent      = passed
    ? `✓ Passed! Score: ${attempt.score}% (Required: ${attempt.passingScore}%) — Certificate applied automatically!`
    : `✗ Not passed. Score: ${attempt.score}% (Required: ${attempt.passingScore}%). You can retake anytime.`;

  $('quiz-submit-btn').classList.add('hidden');
  $('quiz-retake-btn').classList.remove('hidden');
  if (lastAttemptId) $('quiz-email-btn').classList.remove('hidden');

  if (showAnswers && attempt.results) {
    attempt.results.forEach((r, qi) => {
      document.querySelectorAll(`.quiz-option[data-qi="${qi}"]`).forEach((el, oi) => {
        const txt = el.querySelector('span')?.textContent?.trim();
        if (txt === r.correctAnswer)           el.classList.add('reveal-correct');
        if (txt === r.yourAnswer && !r.isCorrect) el.classList.add('wrong');
        if (txt === r.yourAnswer && r.isCorrect)  el.classList.add('correct');
      });
    });
  }
}

$('quiz-retake-btn').addEventListener('click', () => {
  myBestAttempt = null; quizSubmitted = false; lastAttemptId = null;
  $('quiz-status-bar').classList.add('hidden');
  $('quiz-retake-btn').classList.add('hidden');
  $('quiz-email-btn').classList.add('hidden');
  renderQuiz();
});

$('quiz-email-btn').addEventListener('click', async () => {
  if (!lastAttemptId) return;
  $('quiz-email-btn').textContent = 'Sending...';
  $('quiz-email-btn').disabled    = true;
  try {
    await api(`/quiz/attempts/${lastAttemptId}/email-score`, { method:'POST' });
    $('quiz-email-btn').textContent = '✓ Sent!';
    setTimeout(() => { $('quiz-email-btn').textContent = '✉ Email Score'; $('quiz-email-btn').disabled = false; }, 2500);
  } catch(e) {
    $('quiz-email-btn').textContent = '✉ Email Score'; $('quiz-email-btn').disabled = false; alert(e.message);
  }
});

// ── Certificate section ───────────────────────────────────────
function updateCertSection() {
  if (!isEnrolled) return;
  const allDone   = enrollment?.isCompleted;
  const quizOk    = !quizData || myBestAttempt?.passed;
  if (!allDone || !quizOk) return;

  $('cert-wrap').classList.remove('hidden');

  if (certData) {
    $('cert-request-btn').classList.add('hidden');
    const msg = $('cert-status-msg');
    msg.classList.remove('hidden');
    if (certData.status === 'approved') {
      msg.textContent = '🎓 Certificate approved!';
      const dw = $('cert-download-wrap');
      dw.classList.remove('hidden'); dw.style.display = 'flex';
    } else if (certData.status === 'pending') {
      msg.textContent = '⏳ Certificate request pending admin review';
    } else {
      msg.textContent = '❌ Request rejected — contact support';
    }
  }
}

$('cert-request-btn').addEventListener('click', async () => {
  $('cert-request-btn').textContent = 'Submitting...';
  $('cert-request-btn').disabled    = true;
  try {
    const res = await api(`/certificates/${courseId}/request`, { method:'POST' });
    certData = res.data; updateCertSection();
  } catch(e) {
    $('cert-request-btn').textContent = '🎓 Request Certificate';
    $('cert-request-btn').disabled    = false; alert(e.message);
  }
});

// ITEM 8: Direct blob download — no redirect
$('cert-download-btn')?.addEventListener('click', async () => {
  if (!certData?._id) return;
  $('cert-download-btn').textContent = 'Preparing...';
  $('cert-download-btn').disabled    = true;
  try {
    const res = await fetch(`${BASE}/certificates/${certData._id}/download`, {
      headers: { authorization: `Bearer ${tok()}` }
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `AI-Literacy-Certificate.pdf`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(e) { alert(e.message); }
  finally {
    $('cert-download-btn').textContent = '⬇ Download PDF';
    $('cert-download-btn').disabled    = false;
  }
});

$('cert-email-btn')?.addEventListener('click', async () => {
  if (!certData?._id) return;
  $('cert-email-btn').textContent = 'Sending...';
  $('cert-email-btn').disabled    = true;
  try {
    await api(`/certificates/${certData._id}/email`, { method:'POST' });
    $('cert-email-btn').textContent = '✓ Sent!';
    setTimeout(() => { $('cert-email-btn').textContent = '✉ Email Me'; $('cert-email-btn').disabled = false; }, 2500);
  } catch(e) {
    $('cert-email-btn').textContent = '✉ Email Me'; $('cert-email-btn').disabled = false; alert(e.message);
  }
});

// ── Enroll ────────────────────────────────────────────────────
$('enroll-btn').addEventListener('click', async () => {
  if (!tok()) { location.assign('/signin.html'); return; }
  $('enroll-btn').textContent = 'Enrolling...'; $('enroll-btn').disabled = true;
  try { await api(`/course/${courseId}/enroll`, { method:'POST' }); location.reload(); }
  catch(e) { alert(e.message); $('enroll-btn').textContent = 'Enroll Now'; $('enroll-btn').disabled = false; }
});

// ── Load ──────────────────────────────────────────────────────
async function load() {
  try {
    const courseRes = await api(`/course/${courseId}`);
    courseData          = courseRes.data;
    window.courseData   = courseData;
    $('course-title').textContent = courseData.title;
    $('course-desc').textContent  = courseData.description || '';

    if (tok()) {
      try {
        const er    = await api('/course/user/enrollments');
        const match = (er.data||[]).find(e => {
          const id = e.course?._id || e.course;
          return id?.toString() === courseId;
        });
        if (match) { isEnrolled = true; enrollment = match; }
      } catch(_) {}

      // Don't fetch course quiz here — only fetch when user clicks quiz after completing all modules
      // But DO fetch if they already have an attempt (so returning users see their result)
      try {
        const qr = await api(`/quiz/course/${courseId}`);
        quizData = qr.data;
        if (quizData && isEnrolled && enrollment?.isCompleted) {
          const ar = await api(`/quiz/attempts/${quizData._id}`);
          if (ar.data?.length) {
            myBestAttempt = ar.data.reduce((best, a) => a.score > (best?.score||0) ? a : best, null);
            if (myBestAttempt) lastAttemptId = myBestAttempt._id || myBestAttempt.attemptId;
          }
        }
      } catch(_) {}

      try {
        const cr = await api('/certificates/mine');
        certData = (cr.data||[]).find(c => {
          const id = c.course?._id || c.course;
          return id?.toString() === courseId;
        }) || null;
      } catch(_) {}
    }

    if (!isEnrolled && tok()) $('enroll-btn').classList.remove('hidden');
    await renderModules();

    // Update quiz section state based on loaded data
    if (isEnrolled && enrollment?.isCompleted) {
      updateQuizSection(true);
    }

    // Auto-play first unlocked module
    if (courseData.modules?.length) {
      const firstUnlocked = courseData.modules.find((_, i) => !isModuleLocked(i));
      if (firstUnlocked) playItem(firstUnlocked);
    }
  } catch(e) {
    $('course-title').textContent = 'Course not found';
    console.error(e);
  }
}

load();
