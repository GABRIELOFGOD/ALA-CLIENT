/**
 * dashboard-api.js
 * ─────────────────────────────────────────────────────────────────
 * Drop this script AFTER dashboard.js in dashboard.html:
 *   <script src="dashboard.js"></script>
 *   <script src="dashboard-api.js"></script>
 *
 * It overrides the dummy DATA object and re-renders every page
 * with live data from the Express API.
 *
 * Configure BASE_URL and USER_ID before use.
 * ─────────────────────────────────────────────────────────────────
 */

const BASE_URL = 'http://72.60.80.28:4500/api';
const user = localStorage.getItem("user");

// Replace with the logged-in user's MongoDB _id (from your auth flow)
// const USER_ID = localStorage.getItem('userId') || 'REPLACE_WITH_USER_ID';
const USER_ID = user?.data._id;

/* ── Helpers ──────────────────────────────────────────────── */

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Unknown API error');
  return json.data;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatUpcomingDate(iso) {
  const d = new Date(iso);
  const monthShort = d.toLocaleString('en', { month: 'short' });
  return { day: d.getDate(), month: monthShort };
}

function formatEventTime(iso) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function formatScheduleDate(iso) {
  return new Date(iso).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ── Country emoji map (ISO → flag) ──────────────────────── */
const COUNTRY_FLAG = {
  Nigeria: '🇳🇬', Kenya: '🇰🇪', Ghana: '🇬🇭', 'South Africa': '🇿🇦',
  Senegal: '🇸🇳', Tanzania: '🇹🇿', Uganda: '🇺🇬', Ethiopia: '🇪🇹',
};

/* ── Skill tag color pairs ────────────────────────────────── */
const TAG_COLORS = [
  ['#e8f0f8', '#1a3a5c'], ['#fff4ed', '#f07d3a'], ['#f0fdf4', '#16a34a'],
  ['#faf5ff', '#7c3aed'], ['#e0f2fe', '#0891b2'], ['#fefce8', '#d97706'],
];

/* ── Top-level orchestrator ───────────────────────────────── */

async function loadDashboard() {
  try {
    const [dashData, leaderboardData, progressData, resources, schedule, activities] =
      await Promise.all([
        apiFetch(`/users/${USER_ID}/dashboard`),
        apiFetch(`/users/${USER_ID}/leaderboard`),
        apiFetch(`/courses/user/${USER_ID}/progress-summary`),
        apiFetch(`/courses/resources`),
        apiFetch(`/users/${USER_ID}/schedule`),
        apiFetch(`/users/${USER_ID}/activities?limit=10`),
      ]);

    hydrateUser(dashData.user);
    hydrateStats(dashData.stats);
    hydrateStreakBanner(dashData.user);
    hydrateContinueLearning(dashData.enrollments);
    hydrateWeeklyChart(dashData.weeklyActivity);
    hydrateOverallRing(dashData.stats);
    hydrateUpcoming(dashData.upcomingEvents);
    hydrateSkillTags(dashData.user.skillTags);
    hydrateActivityFeed(dashData.recentActivities);
    hydrateCourses(dashData.enrollments);
    hydrateProgress(progressData);
    hydrateCertificates(dashData.certificates);
    hydrateSchedule(schedule, dashData.upcomingEvents);
    hydrateLeaderboard(leaderboardData);
    hydrateResources(resources);

  } catch (e) {
    console.error('[dashboard-api] Failed to load:', e.message);
  }
}

/* ── User identity (sidebar + header) ───────────────────── */

function hydrateUser(user) {
  // Sidebar mini-profile
  document.querySelectorAll('.avatar').forEach(el => { el.textContent = user.initials; });
  const sidebarName = document.querySelector('.sidebar .font-semibold.text-white');
  const sidebarEmail = document.querySelector('.sidebar .text-xs.text-white\\/45');
  if (sidebarName) sidebarName.textContent = `${user.firstName} ${user.lastName}`;
  if (sidebarEmail) sidebarEmail.textContent = user.email;

  // Plan badge
  document.querySelectorAll('.badge').forEach(el => {
    if (el.textContent.trim() === 'Pro' || el.textContent.trim() === 'free') {
      el.textContent = user.plan === 'pro' ? 'Pro' : 'Free';
    }
  });

  // Profile completion nudge
  const nudgeBar = document.querySelector('.sidebar .prog-bar-fill[style*="80%"]');
  if (nudgeBar) nudgeBar.style.width = `${user.profileComplete}%`;
  const nudgeText = document.querySelector('.sidebar .text-xs.text-white\\/55');
  if (nudgeText) nudgeText.textContent = `${user.profileComplete}% done — add your skills to unlock more`;

  // Topbar greeting
  const subtitle = document.getElementById('pageSubtitle');
  if (subtitle) subtitle.textContent = `Welcome back, ${user.firstName}! 👋`;

  // Settings page
  const profileAvatar = document.querySelector('.profile-avatar');
  if (profileAvatar) profileAvatar.textContent = user.initials;

  const inputs = document.querySelectorAll('#page-settings input, #page-settings select, #page-settings textarea');
  const fieldMap = { 'First Name': user.firstName, 'Last Name': user.lastName, Email: user.email, Country: user.country };
  inputs.forEach(el => {
    const label = el.previousElementSibling?.textContent?.trim();
    if (label && fieldMap[label] !== undefined) el.value = fieldMap[label];
  });

  // Notification toggles
  const notifSettings = user.notifications || {};
  const notifKeys = ['emailReminders', 'streakAlerts', 'newCourseAlerts', 'webinarReminders'];
  const toggles = document.querySelectorAll('#page-settings .toggle input[type="checkbox"]');
  toggles.forEach((toggle, i) => {
    if (notifKeys[i]) toggle.checked = !!notifSettings[notifKeys[i]];
  });
}

/* ── Stat cards ──────────────────────────────────────────── */

function hydrateStats(stats) {
  const cards = document.querySelectorAll('#page-overview .stat-card');
  if (!cards.length) return;

  const values = [
    stats.totalEnrolled,
    `${stats.avgProgress}%`,
    stats.totalCerts,
    `${stats.totalHours}h`,
  ];
  cards.forEach((card, i) => {
    const big = card.querySelector('.font-heading.font-bold.text-2xl');
    if (big && values[i] !== undefined) big.textContent = values[i];
  });
}

/* ── Streak banner ───────────────────────────────────────── */

function hydrateStreakBanner(user) {
  const banner = document.querySelector('#page-overview .mb-6.rounded-xl.p-4');
  if (!banner) return;
  const title = banner.querySelector('.font-heading.font-bold.text-lg');
  const sub = banner.querySelector('.text-white\\/70.text-sm');
  if (title) title.textContent = `${user.streak}-Day Streak!`;
  if (sub) sub.textContent = user.streak > 0
    ? `Keep it up — you're on a roll. Complete today's lesson to maintain your streak.`
    : `Start learning today to begin your streak!`;
}

/* ── Continue learning list ──────────────────────────────── */

function hydrateContinueLearning(enrollments) {
  const list = document.getElementById('continueLearningList');
  if (!list) return;

  const active = enrollments
    .filter(e => e.status === 'active')
    .slice(0, 3);

  if (!active.length) {
    list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No active courses yet.</p>';
    return;
  }

  list.innerHTML = active.map(e => {
    const c = e.course;
    const total = c.totalLessons || 1;
    return `
      <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white font-heading font-bold text-lg"
             style="background:${c.color || '#1a3a5c'}">${c.title[0]}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-900 text-sm truncate">${c.title}</div>
          <div class="text-xs text-gray-400 mb-2">${e.lessonsCompleted} / ${total} lessons</div>
          <div class="prog-bar"><div class="prog-bar-fill" style="width:${e.progressPercent}%"></div></div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-heading font-bold text-gray-900 text-sm">${e.progressPercent}%</div>
          <span class="badge" style="background:#e8f0f8;color:#1a3a5c;">${c.level}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Weekly activity chart ───────────────────────────────── */

function hydrateWeeklyChart(weeklyActivity) {
  if (!weeklyActivity || !weeklyActivity.length) return;

  // Rebuild DATA arrays used by renderActivityChart()
  const dayOrder = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const minutesArr = new Array(7).fill(0);
  const lessonsArr = new Array(7).fill(0);

  weeklyActivity.forEach(w => {
    const idx = dayOrder.indexOf(w.day);
    if (idx >= 0) {
      minutesArr[idx] = w.minutes;
      lessonsArr[idx] = w.lessonsCompleted;
    }
  });

  // Patch the global DATA object used by dashboard.js
  if (typeof DATA !== 'undefined') {
    DATA.weeklyMinutes = minutesArr;
    DATA.weeklyLessons = lessonsArr;
  }
  if (typeof renderActivityChart === 'function') renderActivityChart('minutes');
}

/* ── Overall progress ring ───────────────────────────────── */

function hydrateOverallRing(stats) {
  const ring = document.getElementById('overallRing');
  const circumference = 364.4;
  if (ring) {
    const offset = circumference - (stats.avgProgress / 100) * circumference;
    ring.setAttribute('stroke-dashoffset', String(offset));
  }

  // Text inside SVG
  const svg = ring?.closest('svg');
  if (svg) {
    const texts = svg.querySelectorAll('text');
    if (texts[0]) texts[0].textContent = `${stats.avgProgress}%`;
  }

  // Bottom 3 numbers
  const nums = document.querySelectorAll('#page-overview .grid.grid-cols-3 .font-heading.font-bold');
  if (nums[0]) nums[0].textContent = stats.totalEnrolled;
  if (nums[1]) nums[1].textContent = stats.totalEnrolled > 0
    ? String(Math.round((stats.completedCourses / stats.totalEnrolled) * 100 * stats.totalEnrolled / 100)) : '0';
  if (nums[2]) nums[2].textContent = stats.totalCerts;
}

/* ── Upcoming events (overview sidebar) ─────────────────── */

function hydrateUpcoming(events) {
  const el = document.getElementById('upcomingList');
  if (!el) return;

  if (!events.length) {
    el.innerHTML = '<p class="text-sm text-gray-400">No upcoming events.</p>';
    return;
  }

  el.innerHTML = events.slice(0, 3).map(ev => {
    const { day, month } = formatUpcomingDate(ev.scheduledAt);
    return `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-white text-xs font-bold leading-tight"
             style="background:${ev.color || '#1a3a5c'}">
          <span>${day}</span>
          <span style="font-size:9px;font-weight:500;opacity:0.8">${month}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${ev.title}</div>
          <div class="text-xs text-gray-400">${formatEventTime(ev.scheduledAt)}</div>
        </div>
      </div>`;
  }).join('');
}

/* ── Skill tags ──────────────────────────────────────────── */

function hydrateSkillTags(tags) {
  const el = document.getElementById('skillTagsCloud');
  if (!el || !tags?.length) return;

  el.innerHTML = tags.map((t, i) => {
    const [bg, color] = TAG_COLORS[i % TAG_COLORS.length];
    return `<span class="badge" style="background:${bg};color:${color};font-size:0.75rem;padding:5px 12px;">${t}</span>`;
  }).join('');

  if (typeof DATA !== 'undefined') DATA.skillTags = tags;
}

/* ── Activity feed ───────────────────────────────────────── */

function hydrateActivityFeed(activities) {
  const el = document.getElementById('activityFeed');
  if (!el) return;

  if (!activities.length) {
    el.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No activity yet.</p>';
    return;
  }

  el.innerHTML = activities.map(a => {
    const ago = timeAgo(a.createdAt);
    return `
      <div class="act-item">
        <div class="act-dot" style="background:${a.bgColor}">${a.icon}</div>
        <div class="flex-1">
          <div class="text-sm text-gray-800">${a.description}</div>
          <div class="text-xs text-gray-400 mt-0.5">${ago}</div>
        </div>
      </div>`;
  }).join('');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/* ── Courses page ────────────────────────────────────────── */

function hydrateCourses(enrollments) {
  // Rebuild the DATA.courses structure dashboard.js expects
  if (typeof DATA !== 'undefined') {
    DATA.courses = enrollments.map(e => {
      const c = e.course;
      return {
        id: e.enrollmentId,
        title: c.title,
        level: c.level,
        color: c.color || '#1a3a5c',
        progress: e.progressPercent,
        lessons: { done: e.lessonsCompleted, total: c.totalLessons || 0 },
        time: formatTime(e.timeSpentMinutes),
        status: e.status,
        bookmarked: e.bookmarked,
        tags: c.tags || [],
        enrollmentId: e.enrollmentId,
      };
    });
  }
  if (typeof renderCourses === 'function') renderCourses('all');
}

/* ── Progress page ───────────────────────────────────────── */

function hydrateProgress(progressData) {
  // Skills bars
  const skillsEl = document.getElementById('skillsBars');
  const colors = ['#1a3a5c','#f07d3a','#7c3aed','#0891b2','#16a34a','#d97706'];
  if (skillsEl && progressData.skillBreakdown?.length) {
    skillsEl.innerHTML = progressData.skillBreakdown.map((s, i) => `
      <div>
        <div class="flex justify-between text-sm mb-1.5">
          <span class="font-medium text-gray-700">${s.name}</span>
          <span class="font-semibold text-gray-900">${s.percent}%</span>
        </div>
        <div class="skill-bar">
          <div class="skill-fill" style="width:${s.percent}%;background:${colors[i % colors.length]}"></div>
        </div>
      </div>`).join('');
  }

  // Progress table
  const tableEl = document.getElementById('progressTable');
  if (tableEl && progressData.courses?.length) {
    tableEl.innerHTML = progressData.courses.map(c => `
      <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
        <td class="py-3 pr-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style="background:${c.courseColor}">${c.courseTitle[0]}</div>
            <span class="font-medium text-gray-800">${c.courseTitle}</span>
          </div>
        </td>
        <td class="py-3 pr-4 w-32">
          <div class="prog-bar mb-1"><div class="prog-bar-fill" style="width:${c.progressPercent}%"></div></div>
          <div class="text-xs text-gray-400">${c.progressPercent}%</div>
        </td>
        <td class="py-3 pr-4 text-gray-600">${c.lessonsCompleted}/${c.totalLessons}</td>
        <td class="py-3 pr-4 text-gray-600">${formatTime(c.timeSpentMinutes)}</td>
        <td class="py-3">
          ${c.status === 'completed'
            ? `<span class="badge" style="background:#f0fdf4;color:#16a34a;">Completed</span>`
            : `<span class="badge" style="background:#fff4ed;color:#f07d3a;">In Progress</span>`}
        </td>
      </tr>`).join('');
  }
}

/* ── Certificates page ───────────────────────────────────── */

function hydrateCertificates(certificates) {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  if (!certificates.length) {
    grid.innerHTML = '<div class="col-span-3 text-center py-16 text-gray-400">No certificates yet. Complete a course to earn one!</div>';
    return;
  }

  grid.innerHTML = certificates.map(c => {
    const course = c.course;
    const color = course?.color || '#1a3a5c';
    return `
      <div class="cert-card">
        <div class="flex items-start gap-4 mb-4">
          <div class="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style="background:${color}20">🎓</div>
          <div>
            <div class="font-heading font-bold text-gray-900">${course?.title || 'Course'}</div>
            <div class="text-sm text-gray-400 mt-0.5">Issued ${formatDate(c.issuedAt)}</div>
            <div class="text-xs text-gray-300 mt-0.5 font-mono">${c.idCode}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 py-2 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" style="border-color:#e2eaf4">View</button>
          <button class="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors" style="background:${color}">Download</button>
        </div>
      </div>`;
  }).join('');
}

/* ── Schedule page ───────────────────────────────────────── */

function hydrateSchedule(events) {
  const el = document.getElementById('scheduleList');
  if (!el) return;

  const typeColors = { Webinar: '#fff4ed', Mentorship: '#e8f0f8', Deadline: '#fef2f2', Study: '#faf5ff', Workshop: '#f0fdf4' };
  const typeText  = { Webinar: '#f07d3a', Mentorship: '#1a3a5c', Deadline: '#dc2626', Study: '#7c3aed', Workshop: '#16a34a' };

  if (!events.length) {
    el.innerHTML = '<p class="text-sm text-gray-400">No upcoming sessions.</p>';
    return;
  }

  el.innerHTML = events.map(ev => {
    const d = new Date(ev.scheduledAt);
    const dateStr = formatScheduleDate(ev.scheduledAt);
    const timeStr = formatEventTime(ev.scheduledAt);
    const duration = ev.durationMinutes > 0 ? `${ev.durationMinutes} min` : '—';
    const dayNum = d.getDate();
    const monthShort = d.toLocaleString('en', { month: 'short' });

    return `
      <div class="flex items-center gap-4 p-4 rounded-xl" style="background:${typeColors[ev.type] || '#f8fafc'}">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white font-heading font-bold text-xs text-center leading-tight"
             style="background:${ev.color || '#1a3a5c'}">
          <div>${dayNum}<br><span style="font-size:9px;opacity:0.8">${monthShort}</span></div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-900 text-sm truncate">${ev.title}</div>
          <div class="text-xs text-gray-400 mt-0.5">${timeStr} · ${duration}</div>
        </div>
        <span class="badge shrink-0" style="background:${typeColors[ev.type]};color:${typeText[ev.type] || '#374151'};border:1px solid ${ev.color || '#ccc'}22;">${ev.type}</span>
      </div>`;
  }).join('');
}

/* ── Leaderboard page ────────────────────────────────────── */

function hydrateLeaderboard(lb) {
  const el = document.getElementById('leaderboardList');
  if (!el) return;

  const maxXP = lb.leaderboard[0]?.xp || 1;
  el.innerHTML = lb.leaderboard.map((u, i) => {
    const rankBg    = i === 0 ? '#fef9c3' : i === 1 ? '#f1f5f9' : i === 2 ? '#fef3c7' : '#f8fafc';
    const rankColor = i === 0 ? '#d97706' : i === 1 ? '#475569' : i === 2 ? '#b45309' : '#9ca3af';
    const medal     = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const flag      = COUNTRY_FLAG[u.country] || '';

    return `
      <div class="lb-row ${u.isMe ? 'rounded-xl px-2' : ''}" style="${u.isMe ? 'background:#fff4ed' : ''}">
        <div class="lb-rank" style="background:${rankBg};color:${rankColor}">${medal}</div>
        <div class="avatar w-9 h-9 rounded-xl flex items-center justify-center text-white font-heading font-bold text-sm shrink-0"
             style="background:linear-gradient(135deg,#1a3a5c,${u.isMe ? '#f07d3a' : '#234b76'})">${u.initials}</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-gray-900">
            ${u.name} ${u.isMe ? '<span style="color:#f07d3a;font-size:11px;">(you)</span>' : ''} ${flag}
          </div>
          <div class="prog-bar mt-1">
            <div style="height:4px;border-radius:999px;background:${u.isMe ? '#f07d3a' : '#1a3a5c'};width:${Math.round((u.xp / maxXP) * 100)}%"></div>
          </div>
        </div>
        <div class="font-heading font-bold text-gray-900 text-sm shrink-0">${u.xp.toLocaleString()} XP</div>
      </div>`;
  }).join('');

  // My rank card
  const rankNum = document.querySelector('#page-leaderboard .font-heading.font-bold.text-3xl');
  if (rankNum) rankNum.textContent = `#${lb.myRank ?? '—'}`;

  const xpProgress = document.querySelector('#page-leaderboard .prog-bar .prog-bar-fill');
  if (xpProgress && lb.nextRankXP) {
    const pct = Math.min(100, Math.round((lb.myXP / lb.nextRankXP) * 100));
    xpProgress.style.width = `${pct}%`;
  }

  const xpLabel = document.querySelector('#page-leaderboard .text-xs.text-gray-400');
  if (xpLabel) xpLabel.textContent = lb.xpToNextRank > 0
    ? `${lb.myXP.toLocaleString()} / ${lb.nextRankXP?.toLocaleString()} XP to next rank`
    : 'You are at the top!';

  // My stats
  const statValues = document.querySelectorAll('#page-leaderboard .font-semibold.text-gray-900');
  if (statValues[0]) statValues[0].textContent = lb.myXP?.toLocaleString();
}

/* ── Resources page ──────────────────────────────────────── */

function hydrateResources(resources) {
  const grid = document.getElementById('resourcesGrid');
  if (!grid) return;

  const tagColors = {
    'AI Foundations': ['#e8f0f8','#1a3a5c'], ML: ['#fff4ed','#f07d3a'], Policy: ['#faf5ff','#7c3aed'],
    NLP: ['#e0f2fe','#0891b2'], Healthcare: ['#f0fdf4','#16a34a'], Ethics: ['#fefce8','#d97706'],
  };

  grid.innerHTML = resources.map(r => {
    const [bg, color] = tagColors[r.tag] || ['#f8fafc', '#374151'];
    return `
      <div class="bg-white rounded-xl shadow-card p-5 hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300">
        <div class="flex items-start gap-3 mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style="background:${bg}">${r.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 text-sm leading-tight">${r.title}</div>
            <div class="text-xs text-gray-400 mt-1">${r.type} · ${r.fileSizeLabel}</div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="badge" style="background:${bg};color:${color}">${r.tag}</span>
          <a href="${r.fileUrl}" target="_blank" class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg" style="background:#1a3a5c;color:#fff;">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>
      </div>`;
  }).join('');
}

/* ── Kick off after DOM + dashboard.js are ready ─────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (USER_ID && USER_ID !== 'REPLACE_WITH_USER_ID') {
    loadDashboard();
  } else {
    console.warn('[dashboard-api] Set USER_ID to the logged-in user\'s _id to load live data.');
  }
});
