(async function() {
  const programContainer = document.getElementById("home-program-grid");
  const getStarted = document.getElementById("start");

  const token = localStorage.getItem("token");
  if (!token) {
    getStarted.innerText = "Get started"
    getStarted.setAttribute("href", "get-started.html");
  }
  
  const BASE  = BASEURL;

  try {
    const res     = await fetch(`${BASE}/course`);
    const data    = await res.json();
    const courses = data.data || [];

    if (!courses.length) return;

    const levels  = { 0: 'Beginner', 1: 'Intermediate', 2: 'Advanced', 3: 'Expert' };

    programContainer.innerHTML = courses.map((c, i) => {
      const mods = c.modules?.length || 0;
      const level  = levels[Math.min(i, 3)];
      
      return `
        <div class="group rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden">

          <div class="h-48 bg-gradient-to-br from-primary to-primary/80 relative">
            <div class="absolute inset-0 bg-black/10"></div>
            <div class="absolute top-3 left-3">
              <span class="bg-white/90 text-gray-900 px-3 py-1 rounded-full text-xs font-semibold">${level}</span>
            </div>
            ${c.thumbnail ? `<img src="${c.thumbnail}" class="absolute inset-0 w-full h-full object-cover opacity-30">` : ''}
          </div>

          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="font-heading font-bold text-xl text-gray-900 line-clamp-1">
              ${c.title}
            </h3>
          </div>

          <div class="p-6 pt-0">
            <p class="text-gray-600 mb-6 line-clamp-3">
              ${c.description}
            </p>

            <ul class="text-sm text-gray-600 mb-6 space-y-2">
              <li class="flex items-center">
                <!-- Award Icon -->
                <svg class="w-4 h-4 text-secondary mr-2" fill="none" stroke="currentColor" stroke-width="2"
                  viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="7"/>
                  <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11"/>
                </svg>
                ${mods} ${mods > 1 ? 'modules' : 'module'}
              </li>
              <li class="flex items-center">
                <svg class="w-4 h-4 text-secondary mr-2" fill="none" stroke="currentColor" stroke-width="2"
                  viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="7"/>
                  <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11"/>
                </svg>
                Test quiz
              </li>
              <li class="flex items-center">
                <svg class="w-4 h-4 text-secondary mr-2" fill="none" stroke="currentColor" stroke-width="2"
                  viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="7"/>
                  <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11"/>
                </svg>
                Certificate of completion
              </li>
            </ul>

            <a href="course.html?id=${c._id}" class="w-full h-10 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
              Enroll Now
            </a>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    console.warn('[programs-api] Could not load courses:', e.message);
  }
})();