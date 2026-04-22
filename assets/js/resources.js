// resources.js — load from API instead of static array
(async function() {
  const grid = document.getElementById('resourcesGrid');
  if (!grid) return;
  try {
    const url = typeof BASEURL !== 'undefined' ? BASEURL : 'http://localhost:4400/api';
    const type = new URLSearchParams(location.search).get('type') || '';
    const res  = await fetch(`${url}/content/resources${type?'?type='+type:''}`);
    const { data } = await res.json();

    if (!data || !data.length) {
      grid.innerHTML = `<div class="col-span-3 text-center py-16 text-gray-400"><div class="text-4xl mb-3">📂</div><p>No resources yet. Check back soon!</p></div>`;
      return;
    }

    const typeColors = { blog:'#e8f0f8', video:'#faf5ff', framework:'#f0fdf4', 'case-study':'#fff4ed', pdf:'#fef3c7', other:'#f1f5f9' };
    const typeText   = { blog:'#1a3a5c', video:'#7c3aed', framework:'#16a34a', 'case-study':'#f07d3a', pdf:'#d97706', other:'#374151' };
    const typeIcons  = { blog:'📝', video:'🎥', framework:'📋', 'case-study':'🔬', pdf:'📄', other:'📎' };

    grid.innerHTML = data.map(r => {
      const bg  = typeColors[r.type]||'#f9fafb';
      const txt = typeText[r.type]  ||'#374151';
      const ico = typeIcons[r.type] ||'📎';
      return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          ${r.image?`<img src="${r.image}" class="w-full h-40 object-cover rounded-xl">`:
            `<div class="w-full h-40 rounded-xl flex items-center justify-center text-5xl" style="background:${bg};">${ico}</div>`}
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:${bg};color:${txt};">${r.type}</span>
              ${(r.tags||[]).slice(0,2).map(t=>`<span class="text-xs font-medium text-gray-400">${t}</span>`).join('')}
            </div>
            <h3 class="font-heading font-bold text-gray-900 mb-1">${r.title}</h3>
            <p class="text-sm text-gray-500 line-clamp-2">${r.description||''}</p>
          </div>
          ${r.url?`<a href="${r.url}" target="_blank" class="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white" style="background:hsl(240,47%,35%);">View Resource</a>`:''}
        </div>`;
    }).join('');
  } catch(e) {
    console.error('Resources load error:', e);
  }
})();
