// programs-api.js — loads real courses from API and renders them on programs.html
(async function() {
  const BASE  = BASEURL;
  const token = localStorage.getItem('token');

  const grid = document.getElementById('programGrid') || document.getElementById('coursesGrid');
  if (!grid) return; // not on programs page

  try {
    const res     = await fetch(`${BASE}/course`);
    const data    = await res.json();
    const courses = data.data || [];

    if (!courses.length) return; // keep static content if no courses yet

    const colors  = ['hsl(240,47%,35%)', 'hsl(24,67%,51%)', 'hsl(186,35%,28%)', 'hsl(240,47%,50%)'];
    const levels  = { 0: 'Beginner', 1: 'Intermediate', 2: 'Advanced', 3: 'Expert' };

    grid.innerHTML = courses.map((c, i) => {
      const color  = colors[i % colors.length];
      const mods   = c.modules?.length || 0;
      const level  = levels[Math.min(i, 3)];
      return `
        <div class="rounded-lg border bg-white shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden">
          <div class="h-36 relative" style="background:linear-gradient(135deg,${color},${color}cc);">
            <div class="absolute inset-0 bg-black/10"></div>
            <div class="absolute top-3 left-3">
              <span class="bg-white/90 text-gray-900 px-3 py-1 rounded-full text-xs font-semibold">${level}</span>
            </div>
            ${c.thumbnail ? `<img src="${c.thumbnail}" class="absolute inset-0 w-full h-full object-cover opacity-30">` : ''}
          </div>
          <div class="p-5">
            <h3 class="font-heading font-bold text-gray-900 text-base mb-1 line-clamp-1">${c.title}</h3>
            <p class="text-sm text-gray-500 mb-3 line-clamp-2">${c.description || 'Explore this course to build practical AI skills.'}</p>
            <div class="flex items-center justify-between text-xs text-gray-400 mb-4">
              <span><i class="fa fa-play-circle mr-1"></i>${mods} module${mods !== 1 ? 's' : ''}</span>
              <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Free</span>
            </div>
            <a href="course.html?id=${c._id}" class="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style="background:hsl(240,47%,35%);">
              ${token ? 'View Course' : 'Start Learning'}
            </a>
          </div>
        </div>`;
    }).join('');

    // Also update hero stats if present
    const statEls = document.querySelectorAll('[data-stat]');
    statEls.forEach(el => {
      if (el.dataset.stat === 'courses') el.textContent = courses.length + '+';
    });

  } catch (e) {
    console.warn('[programs-api] Could not load courses:', e.message);
  }
})();
