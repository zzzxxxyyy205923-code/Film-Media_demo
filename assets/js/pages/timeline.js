/* ═══════════════════════════════════════════
   TIMELINE PAGE — 升学与求职时间轴（甘特图）
   ───────────────────────────────────────────
   数据源：data/timeline.json（DATA.timeline）
     data.timeline = { cats, cohorts, routes, views, tracks, bars }
   三段控制：申请季（cohort）× 国家/地区路线（route）× 视图（view）
   横轴：该 track 的 12 个压缩月份列（跨月超过 12 个月时按比例压缩）
   纵轴：年份分组 × 维度（关键节点 / 专业成长 / 求职准备），同类重叠自动分层
   点击任一条 → 侧栏查看该阶段的作品集 / AI 工具 / 关键行动 / 阶段产出
═══════════════════════════════════════════ */

const TL_CAT_CLS = { '关键节点': 'milestone', '专业成长': 'growth', '求职准备': 'career' };

const TimelinePage = {
  _data: null,
  _cohort: '',
  _route: '',
  _view: 'all',

  build() {
    this._data = DATA.timeline || {};
    const cohorts = this._data.cohorts || [];
    const routes = this._data.routes || [];
    const views = this._data.views || [{ id: 'all', label: '全部' }];

    this._cohort = cohorts[0] || '';
    this._route = routes[0] || '';
    this._view = (views[0] && views[0].id) || 'all';

    this._renderTabGroup('tl-tabs-cohort', cohorts, this._cohort, 'selectCohort');
    this._renderTabGroup('tl-tabs-route', routes, this._route, 'selectRoute');
    this._renderTabGroup('tl-tabs-view', views, this._view, 'selectView');

    this._render();
  },

  selectCohort(v) { this._cohort = v; this._renderTabGroup('tl-tabs-cohort', this._data.cohorts || [], v, 'selectCohort'); this._render(); },
  selectRoute(v)  { this._route  = v; this._renderTabGroup('tl-tabs-route',  this._data.routes  || [], v, 'selectRoute');  this._render(); },
  selectView(v)   { this._view   = v; this._renderTabGroup('tl-tabs-view',   this._data.views   || [], v, 'selectView');   this._render(); },

  _renderTabGroup(elId, items, activeVal, handler) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = items.map(it => {
      const val = typeof it === 'string' ? it : it.id;
      const label = typeof it === 'string' ? it : it.label;
      return `<button class="tl-seg-tab${val === activeVal ? ' is-active' : ''}" data-val="${val}"
                onclick="TimelinePage.${handler}('${val}')">${label}</button>`;
    }).join('');
  },

  // ── 视图过滤：关键节点=apply / 专业成长+求职准备=job / 全部=不过滤 ──
  _matchView(b) {
    if (this._view === 'all') return true;
    const tags = b.tags || [];
    if (this._view === 'apply') return tags.includes('apply');
    if (this._view === 'job') return tags.includes('job') && !tags.includes('apply');
    return true;
  },

  // ── 由 track 内的 period 反推 12 列月份标签 ──────────────────
  _months(trackId) {
    const abs = (y, m) => y * 12 + (m - 1);
    const fmt = a => `${Math.floor(a / 12)}.${String((a % 12) + 1).padStart(2, '0')}`;
    const set = new Set();
    (this._data.bars || []).forEach(b => {
      if (b.track !== trackId) return;
      const re = /(\d{4})[.\-/](\d{1,2})/g;
      let m;
      while ((m = re.exec(b.period || ''))) set.add(abs(+m[1], +m[2]));
    });
    if (!set.size) return Array.from({ length: 12 }, (_, i) => 'M' + (i + 1));
    const arr = [...set];
    const anchor = Math.min(...arr);
    const span = Math.max(...arr) - anchor + 1;
    const scale = span > 12 ? 12 / span : 1;
    return Array.from({ length: 12 }, (_, i) => fmt(anchor + Math.round(i / scale)));
  },

  // 贪心分层：同一维度内时间重叠的条自动排到下一层
  _pack(items) {
    const lanes = [];
    return items.map(it => {
      for (let li = 0; li < lanes.length; li++) {
        if (!lanes[li].some(b => it.b.start <= b.end && it.b.end >= b.start)) {
          lanes[li].push(it.b);
          return { b: it.b, i: it.i, lane: li };
        }
      }
      lanes.push([it.b]);
      return { b: it.b, i: it.i, lane: lanes.length - 1 };
    });
  },

  _summaryHtml(t) {
    if (!t) return '';
    return `<div class="tl-ctrl-group" style="max-width:860px;">
      <div class="tl-ctrl-label">当前路线</div>
      <div style="font-size:var(--text-sm);font-weight:700;color:var(--color-text);">
        ${t.cohort} · ${t.route}${t.windowLabel ? ' · ' + t.windowLabel : ''}
      </div>
      ${t.firstWindow ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">主窗口 ${t.firstWindow}</div>` : ''}
      ${t.lead ? `<p style="font-size:var(--text-sm);color:var(--color-text-secondary);line-height:1.8;margin:8px 0 0;">${t.lead}</p>` : ''}
      ${t.note ? `<p style="font-size:var(--text-xs);color:var(--color-text-faint);line-height:1.7;margin:4px 0 0;">${t.note}</p>` : ''}
    </div>`;
  },

  _ganttHtml(trackId) {
    const months = this._months(trackId);
    const cats = (this._data.cats || []).map(c => c.name);
    const rows = [];
    (this._data.bars || []).forEach((b, i) => {
      if (b.track === trackId && this._matchView(b)) rows.push({ b, i });
    });
    if (!rows.length) return '<div class="tl-gantt-empty">该申请季 / 路线在所选视图下暂无数据</div>';

    let html = '';
    html += `<div class="tl-gh" style="grid-column:1;grid-row:1">年级</div>`;
    html += `<div class="tl-gh tl-gh--cat" style="grid-column:2;grid-row:1">维度</div>`;
    months.forEach((m, i) => html += `<div class="tl-gh" style="grid-column:${i + 3};grid-row:1">${m}</div>`);

    let row = 2;
    [...new Set(rows.map(r => r.b.year))].forEach(year => {
      html += `<div class="tl-year-band" style="grid-row:${row}">${year}</div>`;
      row++;
      cats.forEach(cat => {
        const catBars = rows.filter(x => x.b.year === year && x.b.category === cat);
        if (!catBars.length) return;
        const packed = this._pack(catBars);
        const lanes = Math.max(...packed.map(p => p.lane)) + 1;
        const cls = TL_CAT_CLS[cat] || 'milestone';
        for (let li = 0; li < lanes; li++) {
          if (li === 0) html += `<div class="tl-cat tl-cat--${cls}" style="grid-column:2;grid-row:${row}/${row + lanes}">${cat}</div>`;
          months.forEach((_, mi) =>
            html += `<div class="tl-mc${mi % 2 ? ' tl-mc--odd' : ''}" style="grid-column:${mi + 3};grid-row:${row}"></div>`
          );
          packed.filter(p => p.lane === li).forEach(p => {
            const title = `${p.b.label || ''} · ${p.b.period || ''}`;
            html += `<div class="tl-bar tl-bar--${cls}" title="${title}"
                       style="grid-column:${p.b.start + 2}/${p.b.end + 3};grid-row:${row};z-index:2;cursor:pointer"
                       onclick="TimelinePage.openBar(${p.i})">${p.b.label || ''}</div>`;
          });
          row++;
        }
      });
    });
    return html;
  },

  _render() {
    const trackId = this._cohort + '|' + this._route;
    const track = (this._data.tracks || []).find(t => t.id === trackId);
    const sum = document.getElementById('tl-track-summary');
    if (sum) sum.innerHTML = this._summaryHtml(track);
    const g = document.getElementById('tl-gantt');
    if (g) g.innerHTML = this._ganttHtml(trackId);
  },

  // ── 阶段详情侧栏 ─────────────────────────────────────────────
  openBar(i) {
    const b = (this._data.bars || [])[i];
    if (!b) return;
    const cls = TL_CAT_CLS[b.category] || 'milestone';
    const section = (label, val) => val ? `
      <div class="sidebar__section">
        <div class="sidebar__section-label">${label}</div>
        <p style="font-size:13px;line-height:1.8;margin:0;">${val}</p>
      </div>` : '';
    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${b.cohort || ''} · ${b.route || ''} · ${b.year || ''}</div>
        <div class="sidebar__title">${b.label || ''}</div>
        <div class="sidebar__subtitle">${b.period || ''}</div>
      </div>
      <div class="sidebar__body">
        <div class="sidebar__section">
          <span class="port-card__tag" style="display:inline-block">${b.category || ''}</span>
        </div>
        ${section('作品集推进', b.portfolio)}
        ${section('AI 工具 / 实训', b.ai)}
        ${section('关键行动', b.action)}
        ${section('阶段产出', b.output)}
      </div>`);
  },
};
window.TimelinePage = TimelinePage;
