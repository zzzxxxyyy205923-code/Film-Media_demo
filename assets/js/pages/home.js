/* ═══════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════ */
const HomePage = {
  build() {
    this.buildInstructors();
    this.buildResources();
    this.buildFeaturedCourses();
    this._initStickyCollapse();
  },

  // ── Sticky collapse bar ────────────────────────────────────────
  // Appears at bottom of screen when any expand button is out of view while open.
  _initStickyCollapse() {
    const bar = document.getElementById('sticky-collapse');
    const btn = document.getElementById('sticky-collapse-btn');
    if (!bar || !btn) return;

    // Track which expand button is currently "active" (its section is open)
    this._stickyTarget = null; // { collapseBtn, onCollapse }

    window.addEventListener('scroll', () => this._updateStickyBar(), { passive: true });

    btn.addEventListener('click', () => {
      if (this._stickyTarget) this._stickyTarget.onCollapse();
    });
  },

  _updateStickyBar() {
    const bar = document.getElementById('sticky-collapse');
    if (!bar) return;

    // Collect all currently-visible expand buttons that are in "open" state
    const candidates = [
      { el: document.getElementById('inst-expand-btn'), open: !!this._instOpen, collapse: () => this.toggleInstructors() },
    ].filter(c => c.open && c.el && c.el.style.display !== 'none');

    if (!candidates.length) {
      bar.style.display = 'none';
      this._stickyTarget = null;
      return;
    }

    // Show sticky bar if the active expand button has scrolled above the viewport
    const active = candidates[0];
    const rect = active.el.getBoundingClientRect();
    const outOfView = rect.bottom < 0 || rect.top > window.innerHeight;

    if (outOfView) {
      bar.style.display = '';
      this._stickyTarget = { collapseBtn: active.el, onCollapse: active.collapse };
    } else {
      bar.style.display = 'none';
      this._stickyTarget = null;
    }
  },

  // ── Shared grid clamp utility ──────────────────────────────────
  // Collapses a .grid-N to `rows` rows, wires an expand/collapse button.
  // opts: { gridEl, btnEl, rows, open, filter }
  //   filter(card) → bool  optional: extra visibility predicate (for filtered grids)
  // Returns: { open } state object — caller stores and passes back next time.
  _gridClamp(gridEl, btnEl, rows, open, filter) {
    if (!gridEl) return;
    const tpl  = getComputedStyle(gridEl).gridTemplateColumns;
    const cols  = (tpl && tpl !== 'none') ? tpl.split(' ').length : 1;
    const limit = cols * rows;
    let shown = 0;
    Array.from(gridEl.children).forEach(card => {
      const passes = !filter || filter(card);
      const visible = passes && (open || shown < limit);
      card.style.display = visible ? '' : 'none';
      if (passes) shown++;
    });
    if (btnEl) {
      btnEl.style.display = shown > limit || (!open && shown === limit && Array.from(gridEl.children).filter(c => !filter || filter(c)).length > limit) ? '' : 'none';
      // Recalculate: show button only if there are hidden matching cards
      const total = Array.from(gridEl.children).filter(c => !filter || filter(c)).length;
      btnEl.style.display = total > limit ? '' : 'none';
      btnEl.textContent   = open ? '收起' : '展开查看更多';
    }
  },

  // ── Instructors ────────────────────────────────────────────────
  buildInstructors() {
    this._renderInstructorTabs();
    this._renderInstructors('all');
    if (!this._instResizeBound) {
      this._instResizeBound = true;
      let t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { if (!this._instOpen) this._applyInstClamp(); }, 150);
      });
    }
  },

  filterInstructors(type, btn) {
    document.querySelectorAll('#instructor-tabs .filter-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    this._renderInstructors(type);
  },

  /* 导师团队筛选条：按数据里实际存在的 tag 生成选项卡（无数据则整条隐藏） */
  _renderInstructorTabs() {
    const bar = document.getElementById('instructor-tabs');
    if (!bar) return;
    const LABELS = { overseas: '海外教授', industry: '行业导师', research: '学术研究', academic: '院校导师', alumni: '校友' };
    const present = [...new Set((DATA.instructors || [])
      .filter(i => !i.commented_out).map(i => i.tag))]
      .filter(t => LABELS[t]);
    if (present.length < 2) { bar.style.display = 'none'; return; }
    bar.innerHTML =
      '<span class="filter-bar__label">按类型</span>' +
      [['all', '全部']].concat(present.map(t => [t, LABELS[t]]))
        .map(([val, label]) =>
          `<button class="filter-btn${val === 'all' ? ' is-active' : ''}" data-itag="${val}" onclick="HomePage.filterInstructors('${val}',this)">${label}</button>`)
        .join('');
  },

  _renderInstructors(type) {
    const grid = document.getElementById('instructors-grid');
    if (!grid) return;
    const active = DATA.instructors.filter(i => !i.commented_out);
    const TAG_ORDER = ['overseas', 'research', 'academic', 'industry', 'alumni'];
    const items = type === 'all'
               ? [...active].sort((a, b) => TAG_ORDER.indexOf(a.tag) - TAG_ORDER.indexOf(b.tag))
               : type === 'research' ? active.filter(i => i.is_research)
               : active.filter(i => i.tag === type && !i.is_research);
    grid.innerHTML = items.map(inst => this._instructorCard(inst)).join('');
    // preserve open state across filter switches
    this._applyInstClamp();
  },

  _applyInstClamp() {
    this._gridClamp(
      document.getElementById('instructors-grid'),
      document.getElementById('inst-expand-btn'),
      3, !!this._instOpen
    );
  },

  toggleInstructors() {
    this._instOpen = !this._instOpen;
    this._applyInstClamp();
    this._updateStickyBar();
  },

  _instructorCard(inst) {
    const tagClsMap = { 'tag-blue': 'industry', 'tag-lime': 'academic', 'tag-gray': 'alumni', 'tag-purple': 'overseas', 'tag-teal': 'research' };
    const tagCls = inst.is_research ? 'research' : (tagClsMap[inst.tag_cls] || 'industry');
    const base = inst.pseudonym || inst.name;
    const suffix = inst.tag === 'academic' ? '老师'
                 : inst.tag === 'industry' ? '老师'
                 : inst.tag === 'overseas' ? '教授'
                 : inst.tag === 'alumni'   ? '老师'
                 : inst.is_research        ? '老师' : '';
    const displayName = base + suffix;
    const avatar = inst.photo
      ? `<div class="person-card__avatar person-card__avatar--photo"><img src="${inst.photo}" alt="${base}" loading="lazy"></div>`
      : `<div class="person-card__avatar">${base.slice(-1)}</div>`;
    const nameRow = `<div class="person-card__name">${displayName}</div>`;
    const roleTag = `<span class="tag tag--${tagCls}" style="margin-top:6px;">${inst.role}</span>`;
    let body = '';
    if (inst.is_research) {
      body = `${nameRow}<div class="person-card__title">${inst.school || (inst.placeholder ? '待补充' : '')}</div>${inst.academic_branch ? `<div class="person-card__sub">${inst.academic_branch}</div>` : ''}`;
    } else if (inst.tag === 'industry') {
      body = `${nameRow}<div class="person-card__title">${inst.title || ''}</div>${inst.intro ? `<div class="person-card__sub">${inst.intro}</div>` : ''}`;
    } else if (inst.tag === 'academic') {
      body = `${nameRow}<div class="person-card__title">${inst.school || (inst.placeholder ? '待补充' : '')}</div>${inst.academic_branch ? `<div class="person-card__sub">${inst.academic_branch}</div>` : ''}`;
    } else if (inst.tag === 'alumni') {
      const dirs = (inst.directions || []).join(' / ');
      body = `${nameRow}<div class="person-card__title">${inst.school || ''}</div>${dirs ? `<div class="person-card__sub">${dirs}</div>` : ''}`;
    } else if (inst.tag === 'overseas') {
      body = `${nameRow}<div class="person-card__title">${inst.school || (inst.placeholder ? '待补充' : '')}</div>${inst.title ? `<div class="person-card__sub">${inst.title}</div>` : ''}`;
    } else {
      body = `${nameRow}<div class="person-card__title">${inst.title || ''}</div>`;
    }
    return `<div class="person-card">${avatar}${body}${roleTag}</div>`;
  },

  // ── Resources (marquee) ────────────────────────────────────────
  buildResources() {
    const COOP = DATA.resources || [];
    // 来源数据未提供合作方 logo 图片，改用名称首字/缩写文字标（.coop-card__logo--text）
    const card = c => `<div class="coop-card">
      <div class="coop-card__logo coop-card__logo--text">${c.initial || (c.nameCn || '').slice(0, 1)}</div>
      <div class="coop-card__name-en">${c.nameEn}</div>
      <div class="coop-card__name-cn">${c.nameCn}</div>
    </div>`;
    const fill = (id, items) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = [...items, ...items].map(card).join('');
    };
    fill('coop-row-a', COOP);

    const track = document.getElementById('coop-row-a');
    if (track && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => track.classList.toggle('is-paused', !e.isIntersecting));
      }, { threshold: 0.1 });
      obs.observe(track.closest('.coop-marquee-wrap'));
    }
  },

  // ── Featured Courses (homepage teaser rail) ─────────────────────
  // Full course catalog now lives on its own page (#page-course-products);
  // the homepage just teases all 7 products in a horizontal scroll rail.
  FEATURED_ORDER: ['changemakers', 'longform2', 'longform3', 'internship', 'summerwinter', 'bizpractice', 'masterclass'],

  buildFeaturedCourses() {
    const rail = document.getElementById('featured-courses-rail');
    if (!rail || !window.PRODUCTS) return;
    const card = id => {
      const p = window.PRODUCTS[id];
      if (!p) return '';
      const isLongform = p.group === 'longform';
      const bannerCls = 'featured-rail__banner' + (isLongform
        ? (p.tileVariant ? ' featured-rail__banner--' + p.tileVariant : '')
        : ' featured-rail__banner--catalog');
      const tag = isLongform ? '长线' : ('目录 · ' + p.count);
      return `<div class="featured-rail__card" onclick="CourseOverlay.open('${id}')">
        <div class="${bannerCls}"><span class="featured-rail__tag">${tag}</span></div>
        <div class="featured-rail__body">
          <div class="featured-rail__title">${p.meta.titleCn.split(' · ')[0]}</div>
          <div class="featured-rail__desc">${p.meta.chips[0]}</div>
        </div>
      </div>`;
    };
    // Duplicate the list once so the marquee (translateX 0 -> -50%) loops seamlessly —
    // same technique as the resources coop marquee below.
    rail.innerHTML = [...this.FEATURED_ORDER, ...this.FEATURED_ORDER].map(card).join('');

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => rail.classList.toggle('is-paused', !e.isIntersecting));
      }, { threshold: 0.1 });
      obs.observe(rail.closest('.featured-rail-wrap'));
    }
  },

  // Applies the internship type/category filter to the embedded catalog grid
  // (used inside the course-products overlay — no clamp/expand needed there,
  // the overlay itself already scrolls).
  _applyCourseClamp(tabId) {
    const grid = document.getElementById(tabId + '-grid');
    if (!grid) return;
    const filter = tabId === 'internship' ? this._internFilter() : null;
    this._gridClamp(grid, null, 3, true, filter);
  },

  // Returns a filter function for the current internship type+cat selection
  _internFilter() {
    const type = this._internFilterType || 'all';
    const cat  = this._internFilterCat  || 'all';
    return card =>
      (type === 'all' || card.dataset.ptype === type) &&
      (cat  === 'all' || card.dataset.cat   === cat);
  },

  _buildInternshipPanel() {
    const internItems = DATA.courses_industry.filter(c => ['internship', 'industry_class'].includes(c.tab));
    const CATS = ['头部平台', '行业名企', '媒体与内容平台', '影视制作与项目',
                  '动画·视效·声音·科技', '品牌与传播', '艺术与演艺', '数字平台与产品'];
    const catsPresent = CATS.filter(cat => internItems.some(c => c.category === cat));
    const filterBar = `
      <div class="filter-bar" style="margin-bottom:16px;">
        <span class="filter-bar__label">按类型</span>
        <button class="filter-btn is-active" data-itype="all" onclick="HomePage._filterInterns('all',this)">全部</button>
        <button class="filter-btn" data-itype="岗位制实习" onclick="HomePage._filterInterns('岗位制实习',this)">岗位制实习</button>
        <button class="filter-btn" data-itype="行业资源" onclick="HomePage._filterInterns('行业资源',this)">行业资源</button>
        <span class="filter-bar__label" style="margin-left:12px;">按方向</span>
        <button class="filter-btn is-active" data-icat="all" onclick="HomePage._filterInternsCat('all',this)">全部</button>
        ${catsPresent.map(cat => `<button class="filter-btn" data-icat="${cat}" onclick="HomePage._filterInternsCat('${cat}',this)">${cat}</button>`).join('')}
      </div>`;
    const grid = `<div class="grid-4" id="internship-grid">
      ${internItems.map(c => this._internCard(c)).join('')}
    </div>`;
    return filterBar + grid;
  },

  _internCard(c) {
    const typeLabel = c.tab === 'internship' ? '岗位制实习' : '行业资源';
    const statusCls = c.enrollment_status === '招募中' ? 'course-card__badge--status-open' :
                      c.enrollment_status === '已满'   ? 'course-card__badge--status-full' : '';
    const posterClick = c.poster ? `onclick="ImageModal.open('${c.poster}','${c.company}')" style="cursor:pointer"` : '';
    return `<div class="course-card" data-ptype="${typeLabel}" data-cat="${c.category}" ${posterClick}>
      <div class="course-card__img">
        ${c.poster ? `<img src="${c.poster}" alt="${c.company}" loading="lazy">` : `<span style="opacity:.4">${typeLabel}</span>`}
        <span class="course-card__img-label">${c.category || '其他'}</span>
      </div>
      <div class="course-card__body">
        <div class="course-card__company">${c.company}</div>
        <div class="course-card__role">${c.role_or_course}</div>
        <div class="course-card__meta">
          ${c.location ? `<span class="course-card__badge">${c.location}</span>` : ''}
          ${c.duration ? `<span class="course-card__badge">${c.duration}</span>` : ''}
          <span class="course-card__badge">${typeLabel}</span>
          ${c.enrollment_status ? `<span class="course-card__badge ${statusCls}">${c.enrollment_status}</span>` : ''}
        </div>
      </div>
    </div>`;
  },

  _filterInterns(type, btn) {
    document.querySelectorAll('[data-itype]').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const cat = document.querySelector('[data-icat].is-active')?.dataset.icat || 'all';
    this._applyInternFilter(type, cat);
  },

  _filterInternsCat(cat, btn) {
    document.querySelectorAll('[data-icat]').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const type = document.querySelector('[data-itype].is-active')?.dataset.itype || 'all';
    this._applyInternFilter(type, cat);
  },

  _applyInternFilter(type, cat) {
    this._internFilterType = type;
    this._internFilterCat  = cat;
    this._applyCourseClamp('internship');
  },

  _buildCourseGrid(items) {
    return `<div class="grid-4">
      ${items.map(c => `
        <div class="course-card" ${c.poster ? `onclick="ImageModal.open('${c.poster}','${c.company}')" style="cursor:pointer"` : ''}>
          <div class="course-card__img">
            ${c.poster ? `<img src="${c.poster}" alt="${c.company}" loading="lazy">` : `<span style="opacity:.4">${c.program_type}</span>`}
          </div>
          <div class="course-card__body">
            <div class="course-card__company">${c.company}</div>
            <div class="course-card__role">${c.role_or_course}</div>
            <div class="course-card__meta">
              <span class="course-card__badge course-card__badge--price">报名中</span>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
  },

  _buildAcademicGrid(items) {
    return `<div class="grid-4">
      ${items.map(c => `
        <div class="course-card" ${c.poster ? `onclick="ImageModal.open('${c.poster}','${c.role_or_course}')" style="cursor:pointer"` : ''}>
          <div class="course-card__img">
            ${c.poster ? `<img src="${c.poster}" alt="${c.role_or_course}" loading="lazy">` : `<span style="opacity:.4">${c.program_type}</span>`}
            <span class="course-card__img-label">${c.category || ''}</span>
          </div>
          <div class="course-card__body">
            <div class="course-card__company">${c.role_or_course}</div>
            <div class="course-card__role">${c.suitable_for || ''}</div>
            <div class="course-card__meta">
              ${c.location ? `<span class="course-card__badge">${c.location}</span>` : ''}
              <span class="course-card__badge course-card__badge--price">报名中</span>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
  },

  _buildPlaceholderGrid(label) {
    return `<div class="grid-4">
      ${Array.from({length:8}, () => `
        <div class="skeleton-card">
          <div class="skeleton-card__img"><span class="skeleton-card__tag">${label}</span></div>
          <div class="skeleton-card__body">
            <div class="sk-line"></div>
            <div class="sk-line sk-line--narrow"></div>
          </div>
        </div>`).join('')}
    </div>`;
  },
};
window.HomePage = HomePage;
