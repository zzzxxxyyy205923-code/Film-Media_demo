/* ═══════════════════════════════════════════
   OFFERS PAGE — 2026 申请季 offer 展示
═══════════════════════════════════════════ */
const OffersPage = {
  _currentGroup: 'US',

  build() {
    const totalEl = document.getElementById('offers-total');
    if (totalEl && DATA.offers) {
      totalEl.innerHTML = `
        <div class="offers-total">
          <span class="offers-total__num">${DATA.offers.total_offers}+</span>
          <span class="offers-total__label">份 offer</span>
        </div>`;
    }
    this._render('US');
    // Re-render on resize to recalculate cols
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._render(this._currentGroup), 150);
    });
  },

  switchGroup(group, btn) {
    document.querySelectorAll('#offers-country-tabs .filter-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    this._currentGroup = group;
    this._render(group);
  },

  _render(group) {
    const grid = document.getElementById('offers-grid');
    if (!grid || !DATA.offers_featured) return;
    const featured = DATA.offers_featured;
    const label = featured.group_labels[group] || '';

    // Build lookup: school_zh → offer_count from flat offers.json
    const countMap = {};
    (DATA.offers?.schools || []).forEach(s => { countMap[s.school_zh] = s.offer_count; });

    // Enrich featured schools with live offer counts
    const schools = (featured.groups[group] || []).map(s => ({
      ...s, offer_count: countMap[s.school_zh] || 0,
    }));

    const groupTotal = (DATA.offers?.schools || [])
      .filter(s => s.country_group === group)
      .reduce((sum, s) => sum + s.offer_count, 0);

    // Measure actual cols by rendering one dummy card, reading computed style, then replacing
    const probe = document.createElement('div');
    probe.className = 'offers-grid';
    probe.style.visibility = 'hidden';
    probe.innerHTML = '<div class="offer-card"></div>';
    grid.appendChild(probe);
    const cols = getComputedStyle(probe).gridTemplateColumns.split(' ').length;
    grid.removeChild(probe);

    // Smart trim: >6 cols → exactly 2 rows; ≤6 cols → full rows only
    let displayCount = cols > 6
      ? cols * 2
      : Math.floor(schools.length / cols) * cols;
    displayCount = Math.max(12, Math.min(displayCount, schools.length));

    grid.innerHTML = `
      <div class="offers-summary">
        <span class="offers-summary__total">${groupTotal}+</span>
        <span class="offers-summary__label">份 offer · ${label}</span>
      </div>
      <div class="offers-grid">
        ${schools.slice(0, displayCount).map(s => `
          <div class="offer-card">
            <div class="offer-card__count">${s.offer_count || '—'}</div>
            <div class="offer-card__school-zh">${s.school_zh}</div>
            <div class="offer-card__school-en">${s.school_en}</div>
          </div>`).join('')}
      </div>`;
  },
};
// expose for inline event handlers
window.OffersPage = OffersPage;
