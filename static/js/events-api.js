// Pull real events from API and render into eventsList
(async function() {
  const list = document.getElementById('eventsList');
  if (!list) return;
  try {
    const url = typeof BASEURL !== 'undefined' ? BASEURL : 'http://localhost:4400/api';
    const q   = document.getElementById('eventDate')?.value;
    const res = await fetch(`${url}/content/events${q?'?date='+q:''}`);
    const { data } = await res.json();

    if (!data || !data.length) {
      list.innerHTML = `<div class="text-center py-16 text-gray-400"><div class="text-4xl mb-3">📅</div><p>No upcoming events. Check back soon!</p></div>`;
      return;
    }

    list.innerHTML = data.map(ev => {
      const d = new Date(ev.date);
      const dateStr = d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6">
          <div class="flex-shrink-0 w-20 h-20 rounded-xl flex flex-col items-center justify-center font-heading font-bold" style="background:hsl(240,47%,35%);color:#fff;">
            <span class="text-2xl">${d.getDate()}</span>
            <span class="text-xs uppercase">${d.toLocaleString('en',{month:'short'})}</span>
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between gap-4">
              <h3 class="font-heading font-bold text-gray-900 text-lg">${ev.title}</h3>
              <span class="text-xs font-semibold px-3 py-1 rounded-full shrink-0" style="background:${ev.isOnline?'#e0f2fe':'#f0fdf4'};color:${ev.isOnline?'#0891b2':'#16a34a'};">${ev.isOnline?'Online':'In-Person'}</span>
            </div>
            <p class="text-gray-500 text-sm mt-1">${ev.description||''}</p>
            <div class="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span><i class="fa fa-calendar mr-1.5"></i>${dateStr}</span>
              ${ev.time?`<span><i class="fa fa-clock mr-1.5"></i>${ev.time}</span>`:''}
              ${ev.location?`<span><i class="fa fa-map-marker-alt mr-1.5"></i>${ev.location}</span>`:''}
            </div>
            ${ev.meetingUrl?`<a href="${ev.meetingUrl}" target="_blank" class="inline-block mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:hsl(240,47%,35%);">Join Event</a>`:''}
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">Could not load events.</div>`;
    console.error(e);
  }
})();
