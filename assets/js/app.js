// Mobile menu toggle (general)
(function(){
  // homepage mobile toggle
  const mk = document.getElementById('mobile-toggle');
  if(mk){
    mk.addEventListener('click', ()=>{
      document.getElementById('mobile-menu').classList.toggle('hidden');
      document.getElementById('menu-open').classList.toggle('hidden');
      document.getElementById('menu-close').classList.toggle('hidden');
    });
  }
  // generic toggles (for pages that use their own ids)
  const mobileToggles = [
    {btn: 'mobile-toggle-programs', menu: 'mobile-menu-p', open: 'menu-open-p', close: 'menu-close-p'},
    {btn: 'mobile-toggle-about', menu: 'mobile-menu-a', open: 'menu-open-a', close: 'menu-close-a'}
  ];
  mobileToggles.forEach(cfg => {
    const b = document.getElementById(cfg.btn);
    if(b){
      b.addEventListener('click', ()=>{
        document.getElementById(cfg.menu).classList.toggle('hidden');
        document.getElementById(cfg.open).classList.toggle('hidden');
        document.getElementById(cfg.close).classList.toggle('hidden');
      });
    }
  });

  // active nav link highlighting based on current URL
  const links = document.querySelectorAll('nav a');
  links.forEach(a => {
    const href = a.getAttribute('href');
    if(href && (location.pathname.endsWith(href) || location.pathname === '/' && href === 'index.html')){
      a.classList.add('text-primary','font-semibold');
    }
  });

  // footer year filler if present on pages that didn't set it
  document.querySelectorAll('#year, #yearP, #yearR, #yearE, #yearG, #yearAbout, #yearC').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
})();



// Testimonials carousel initialization

  const testimonials = [
    {
      name: "Amara Okafor",
      role: "Data Analyst, Lagos",
      content:
        "AI Literacy Africa transformed my understanding of machine learning. The practical approach and African context made all the difference in my career growth.",
      rating: 5,
    },
    {
      name: "Dr. Kwame Asante",
      role: "University Professor, Accra",
      content:
        "The train-the-trainer program equipped me with resources to teach AI to hundreds of students. The curriculum is world-class yet locally relevant.",
      rating: 5,
    },
    {
      name: "Fatima Hassan",
      role: "Agricultural Consultant, Nairobi",
      content:
        "The Agriculture AI Bootcamp showed me how to use technology to help smallholder farmers. I'm now implementing AI solutions across rural Kenya.",
      rating: 5,
    },
    {
      name: "Mohamed El-Rashid",
      role: "Healthcare Administrator, Cairo",
      content:
        "Understanding AI applications in healthcare has been crucial for our hospital's digital transformation. The course content was excellent and practical.",
      rating: 5,
    },
  ];

  let currentIndex = 0;
  let interval;

  const starsEl = document.getElementById("testimonial-stars");
  const contentEl = document.getElementById("testimonial-content");
  const nameEl = document.getElementById("testimonial-name");
  const roleEl = document.getElementById("testimonial-role");
  const initialsEl = document.getElementById("testimonial-initials");
  const dotsEl = document.getElementById("testimonial-dots");

  function getInitials(name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  }

  function renderStars(rating) {
    starsEl.innerHTML = "";
    for (let i = 0; i < rating; i++) {
      starsEl.innerHTML += `
        <svg class="w-6 h-6 text-secondary fill-current" viewBox="0 0 24 24">
          <polygon
            points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.5 5.8 21 7 14.1 2 9.3 9 8.5"
          />
        </svg>
      `;
    }
  }

  function renderDots() {
    dotsEl.innerHTML = "";
    testimonials.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.className = `w-3 h-3 rounded-full transition-colors ${
        index === currentIndex ? "bg-primary" : "bg-gray-300"
      }`;
      dot.addEventListener("click", () => {
        currentIndex = index;
        renderTestimonial();
        resetInterval();
      });
      dotsEl.appendChild(dot);
    });
  }

  function renderTestimonial() {
    const t = testimonials[currentIndex];
    renderStars(t.rating);
    contentEl.textContent = `"${t.content}"`;
    nameEl.textContent = t.name;
    roleEl.textContent = t.role;
    initialsEl.textContent = getInitials(t.name);
    renderDots();
  }

  function startInterval() {
    interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % testimonials.length;
      renderTestimonial();
    }, 5000);
  }

  function resetInterval() {
    clearInterval(interval);
    startInterval();
  }

  renderTestimonial();
  startInterval();


// Newsletter form submission handling
  const form = document.getElementById("newsletter-form");
  const emailInput = document.getElementById("newsletter-email");
  const successBox = document.getElementById("newsletter-success");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!emailInput.value) return;

    // Hide form
    form.classList.add("hidden");

    // Show success message
    successBox.classList.remove("hidden");
    successBox.classList.add("flex");

    // Clear input
    emailInput.value = "";
  });

  

  // ================= DATA =================

const events = [
  {
    title: "AI for Healthcare Professionals",
    date: "2025-06-15",
    time: "3:00 PM WAT",
    location: "Online • Zoom",
    description: "AI transforming healthcare delivery across Africa."
  },
  {
    title: "Machine Learning Bootcamp",
    date: "2025-06-22",
    time: "10:00 AM WAT",
    location: "In-person • Lagos",
    description: "Hands-on ML workshop with practical exercises."
  },
  {
    title: "AI Ethics & Governance Panel",
    date: "2025-07-05",
    time: "2:00 PM WAT",
    location: "Hybrid • Nairobi / Online",
    description: "Responsible AI governance frameworks."
  }
];

const webinars = [
  {
    title: "Intro to NLP",
    date: "2025-05-20",
    duration: "45 mins",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "AI in African Agriculture",
    date: "2025-05-15",
    duration: "60 mins",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

const speakers = [
  { name: "Dr. Amara Okafor", role: "AI Research Lead" },
  { name: "Prof. Kwame Asante", role: "ML Expert" },
  { name: "Sarah Mwangi", role: "AI Ethics Researcher" },
  { name: "Dr. Olumide Adebayo", role: "Data Science Director" }
];

// ================= RENDER EVENTS =================

const eventsList = document.getElementById("eventsList");
const dateInput = document.getElementById("eventDate");

function renderEvents(filterDate = null) {
  eventsList.innerHTML = "";

  events
    .filter(e => !filterDate || e.date === filterDate)
    .forEach(e => {
      const googleLink =
        `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${e.date.replace(/-/g,"")}T000000Z/${e.date.replace(/-/g,"")}T235900Z`;

      eventsList.innerHTML += `
        <div class="border rounded-lg p-6 hover:shadow-lg">
          <h3 class="text-xl font-semibold mb-2">${e.title}</h3>
          <p class="text-sm text-gray-500 mb-2">${e.date} • ${e.time}</p>
          <p class="text-sm text-gray-500 mb-2">${e.location}</p>
          <p class="text-gray-600 mb-4">${e.description}</p>
          <div class="flex gap-2">
            <button class="bg-indigo-600 text-white px-4 py-2 rounded-lg">
              Register
            </button>
            <a href="${googleLink}" target="_blank"
              class="border px-4 py-2 rounded-lg">
              Add to Calendar
            </a>
          </div>
        </div>
      `;
    });
}

dateInput.addEventListener("change", e => renderEvents(e.target.value));
renderEvents();

// ================= WEBINARS =================

document.getElementById("webinars").innerHTML =
  webinars.map(w => `
    <div class="border rounded-lg overflow-hidden bg-white">
      <iframe src="${w.url}" class="w-full h-48" allowfullscreen></iframe>
      <div class="p-4">
        <h4 class="font-semibold">${w.title}</h4>
        <p class="text-sm text-gray-500">${w.date} • ${w.duration}</p>
      </div>
    </div>
  `).join("");

// ================= SPEAKERS =================

document.getElementById("speakers").innerHTML =
  speakers.map(s => `
    <div class="bg-white/10 p-6 rounded-lg text-center">
      <div class="w-20 h-20 mx-auto bg-white/20 rounded-full mb-4"></div>
      <h4 class="font-semibold">${s.name}</h4>
      <p class="text-sm text-white/80">${s.role}</p>
    </div>
  `).join("");


  // Smooth scroll
document.querySelectorAll('[data-scroll]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.scroll)
      ?.scrollIntoView({ behavior: 'smooth' });
  });
});

// Volunteer modal
const modal = document.getElementById('volunteerModal');
document.getElementById('openVolunteerModal')?.addEventListener('click', () => {
  modal.classList.remove('hidden');
  modal.classList.add('flex');
});

document.getElementById('closeVolunteerModal')?.addEventListener('click', () => {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
});

// Volunteer roles
const roles = [
  { title: "Content Creator", desc: "Create educational content", hours: "4–6 hrs/week" },
  { title: "Community Mentor", desc: "Guide learners", hours: "3–5 hrs/week" },
  { title: "Event Coordinator", desc: "Organize events", hours: "5–8 hrs/week" },
  { title: "Tech Support", desc: "Platform assistance", hours: "2–4 hrs/week" }
];

document.getElementById('volunteer-roles').innerHTML =
  roles.map(r => `
    <div>
      <h3 class="font-semibold text-lg">${r.title}</h3>
      <p class="text-gray-600">${r.desc}</p>
      <span class="text-sm bg-amber-100 px-2 py-1 rounded">${r.hours}</span>
    </div>
  `).join('');

// FAQ accordion (single open)
const faqs = [
  { q: "How much time do volunteers commit?", a: "Typically 2–8 hours per week." },
  { q: "What support do ambassadors receive?", a: "Training, certification, resources." },
  { q: "Can corporate partners customize programs?", a: "Yes, fully bespoke options available." },
  { q: "How are donations used?", a: "100% goes to programme delivery." }
];

document.getElementById('faq').innerHTML =
  faqs.map((f, i) => `
    <div class="border rounded">
      <button class="w-full text-left px-4 py-3 font-semibold faq-toggle">
        ${f.q}
      </button>
      <div class="px-4 py-3 hidden text-gray-600">${f.a}</div>
    </div>
  `).join('');

document.querySelectorAll('.faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#faq div > div').forEach(c => c.classList.add('hidden'));
    btn.nextElementSibling.classList.toggle('hidden');
  });
});


document.querySelectorAll('.faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = btn.nextElementSibling;
    content.classList.toggle('hidden');
  });
});
