/* ═══════════════════════════════════════════
   PLAN PAGE — 我的规划 × 行动清单
   ───────────────────────────────────────────
   沿用 IST_demo 的「左侧条件区 + 右侧结果区」布局，
   结果由三部分真实数据合成：
     1) 行动清单  ← data/timeline.json（指定申请季 × 路线的月度 bar）
     2) 匹配院校  ← data/school_recs.json（对应产业方向的推荐专业）
     3) 推荐课程  ← window.PRODUCTS + data/courses_industry.json
   规划模式决定视图（双规划 = 全部 / 申请 = 关键节点 / 求职 = 专业成长+求职准备）。
   勾选进度与选择项一并存入 localStorage。
═══════════════════════════════════════════ */

const PLAN_STORE = 'sfk_film_plan_v1';
const PLAN_SEED = 'sfk_film_plan_seed_v1';
const PLAN_VIEW = { '关键节点': 'milestone', '专业成长': 'growth', '求职准备': 'career' };

const PlanPage = {
  _state: null,

  _defaults() {
    const tl = DATA.timeline || {};
    return {
      mode: 'dual',
      cohort: (tl.cohorts && tl.cohorts[0]) || '',
      industryId: (DATA.industries && DATA.industries[0] && DATA.industries[0].id) || '',
      roleTitle: '',
      route: (tl.routes && (tl.routes.includes('英研') ? '英研' : tl.routes[0])) || '',
      done: {},
    };
  },

  _load() {
    let s = this._defaults();
    try {
      const raw = JSON.parse(localStorage.getItem(PLAN_STORE));
      if (raw) s = Object.assign(s, raw, { done: raw.done || {} });
    } catch (e) { /* 忽略 */ }
    // 测评结果优先（首次进入时自动带入方向与岗位）
    try {
      const seed = JSON.parse(localStorage.getItem(PLAN_SEED));
      const neverEdited = !localStorage.getItem(PLAN_STORE);
      if (seed && neverEdited) {
        if (seed.industryId) s.industryId = seed.industryId;
        if (seed.roleTitle) s.roleTitle = seed.roleTitle;
      }
    } catch (e) { /* 忽略 */ }
    this._state = s;
    return s;
  },

  _save() { try { localStorage.setItem(PLAN_STORE, JSON.stringify(this._state)); } catch (e) { /* 忽略 */ } },

  /* ── 岗位方向（按产业方向过滤、去重） ── */
  _roleOptions(industryId) {
    const seen = new Set();
    const out = [];
    (DATA.careers || []).forEach(c => {
      if (industryId && c.industry_id !== industryId) return;
      const t = c.direction_zh || c.job_title_zh;
      if (!t || seen.has(t)) return;
      seen.add(t); out.push(t);
    });
    return out;
  },

  _industries() { return DATA.industries || []; },

  build() {
    const s = this._load();

    // 规划模式
    const modes = document.getElementById('pl-modes');
    if (modes) {
      modes.innerHTML = [
        { id: 'dual', label: '留学 + 就业双规划', desc: '同时覆盖申请节点与求职动作' },
        { id: 'apply', label: '留学申请规划', desc: '聚焦选校、作品集与申请节点' },
        { id: 'job', label: '求职准备规划', desc: '聚焦实习、岗位与投递节奏' },
      ].map(m => `
        <button class="pl-mode${s.mode === m.id ? ' is-active' : ''}" data-mode="${m.id}">
          ${m.label}<span class="pl-mode__desc">${m.desc}</span>
        </button>`).join('');
      modes.querySelectorAll('.pl-mode').forEach(b => {
        b.onclick = () => {
          this._state.mode = b.dataset.mode;
          modes.querySelectorAll('.pl-mode').forEach(x => x.classList.toggle('is-active', x === b));
          this._save(); this.render();
        };
      });
    }

    // 申请季
    const cohort = document.getElementById('pl-cohort');
    if (cohort) {
      cohort.innerHTML = (DATA.timeline.cohorts || []).map(c => `<option value="${c}">${c}</option>`).join('');
      cohort.value = s.cohort;
      cohort.onchange = () => { this._state.cohort = cohort.value; this._save(); this.render(); };
    }

    // 目标产业方向
    const ind = document.getElementById('pl-industry');
    if (ind) {
      ind.innerHTML = this._industries().map(i => `<option value="${i.id}">${i.name}</option>`).join('');
      ind.value = s.industryId;
      ind.onchange = () => {
        this._state.industryId = ind.value;
        this._state.roleTitle = '';
        this._fillRoles(); this._save(); this.render();
      };
    }

    this._fillRoles();
    this.render();
  },

  _fillRoles() {
    const sel = document.getElementById('pl-role');
    if (!sel) return;
    const opts = this._roleOptions(this._state.industryId);
    sel.innerHTML = `<option value="">全部岗位方向</option>` +
      opts.map(t => `<option value="${t}">${t}</option>`).join('');
    if (this._state.roleTitle && opts.includes(this._state.roleTitle)) sel.value = this._state.roleTitle;
    else this._state.roleTitle = '';
    sel.onchange = () => { this._state.roleTitle = sel.value; this._save(); this.render(); };
  },

  /* ═══ 生成规划 ═══ */
  generate() {
    this._state.cohort = (document.getElementById('pl-cohort') || {}).value || this._state.cohort;
    this._state.industryId = (document.getElementById('pl-industry') || {}).value || this._state.industryId;
    this._state.roleTitle = (document.getElementById('pl-role') || {}).value || '';
    this._save();
    this.render();
    const main = document.getElementById('pl-main');
    if (main && main.scrollIntoView) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /* 把测评带入的种子同步到当前规划（测评页点「生成我的规划」时调用） */
  applySeed() {
    try {
      if (!this._state) this._load();
      const seed = JSON.parse(localStorage.getItem(PLAN_SEED));
      if (!seed) return;
      if (seed.industryId) this._state.industryId = seed.industryId;
      if (seed.roleTitle) this._state.roleTitle = seed.roleTitle;
      const ind = document.getElementById('pl-industry');
      if (ind && seed.industryId) ind.value = seed.industryId;
      this._fillRoles();
      this._save();
      this.render();
    } catch (e) { /* 忽略 */ }
  },

  reset() {
    this._state = this._defaults();
    try { localStorage.removeItem(PLAN_STORE); } catch (e) { /* 忽略 */ }
    this.build();
    const main = document.getElementById('pl-main');
    if (main) main.innerHTML = '<div class="pl-empty">规划已清空，请重新选择申请季、产业方向与岗位目标后生成。</div>';
  },

  toggleTask(key, checked) {
    this._state.done[key] = checked;
    this._save();
    const el = document.querySelector(`[data-task-key="${key}"]`);
    if (el) el.classList.toggle('is-done', checked);
    const stat = document.getElementById('pl-stat-done');
    if (stat) stat.textContent = Object.values(this._state.done).filter(Boolean).length;
  },

  /* ── 行动项：timeline bars → tasks ── */
  _bars() {
    const s = this._state;
    const trackId = s.cohort + '|' + s.route;
    const view = { dual: 'all', apply: 'apply', job: 'job' }[s.mode] || 'all';
    const all = (DATA.timeline.bars || []).map((b, i) => ({ b, i })).filter(x => x.b.track === trackId);
    const hit = all.filter(x => {
      if (view === 'all') return true;
      const tags = x.b.tags || [];
      if (view === 'apply') return tags.includes('apply');
      return tags.includes('job') && !tags.includes('apply');
    });
    // 该申请季已过申请节点时，避免出现空白页：回退为完整节点并标注
    if (hit.length) return { list: hit, fallback: false };
    return { list: all, fallback: view !== 'all' && all.length > 0 };
  },

  _taskKey(b) { return `${b.track}|${b.period}|${b.label}`; },

  _taskHtml(b) {
    const key = this._taskKey(b);
    const done = !!this._state.done[key];
    const cls = PLAN_VIEW[b.category] || 'milestone';
    const meta = [
      b.portfolio ? `作品集：${b.portfolio}` : '',
      b.ai ? `AI 工具：${b.ai}` : '',
      b.action ? `关键行动：${b.action}` : '',
      b.output ? `阶段产出：${b.output}` : '',
    ].filter(Boolean).join('<br>');
    return `
      <div class="pl-task${done ? ' is-done' : ''}" data-task-key="${key}">
        <input type="checkbox" ${done ? 'checked' : ''} onchange="PlanPage.toggleTask('${key.replace(/'/g, "\\'")}', this.checked)">
        <div>
          <div class="pl-task__title">${b.period} · ${b.label}</div>
          <div class="pl-task__meta">${meta}</div>
          <div class="pl-task__tags">
            <span class="cd-chip tl-chip--${cls}">${b.category}</span>
            ${b.type ? `<span class="cd-chip">${b.type}</span>` : ''}
          </div>
        </div>
      </div>`;
  },

  /* ── 匹配院校 / 推荐课程 ── */
  _schoolHtml() {
    const rec = (DATA.school_recs || []).find(r => r.industryId === this._state.industryId);
    if (!rec) return '<div class="pl-empty">该产业方向暂无院校推荐数据。</div>';
    const featured = rec.featured || [];
    const more = rec.more || [];
    return `
      <div class="pl-group__head">
        <div class="pl-group__title">匹配院校专业 · ${rec.nameCn}</div>
        <div class="pl-group__meta">${featured.length} 个重点推荐 / ${more.length} 个备选</div>
      </div>
      <div class="pl-tasks">
        ${featured.map(f => `
          <div class="pl-task" style="grid-template-columns:1fr">
            <div>
              <div class="pl-task__title">${f.schoolCn} <span style="color:var(--color-text-muted);font-size:var(--text-sm)">${f.schoolEn}</span></div>
              <div class="pl-task__meta"><strong>${f.program}</strong><br>${f.note || ''}</div>
              <div class="pl-task__tags">
                <button class="cd-chip" style="cursor:pointer"
                        onclick="Search.jumpTo('school', encodeURIComponent('${f.schoolEn.replace(/'/g, "\\'")}'))">查看开设专业 →</button>
              </div>
            </div>
          </div>`).join('')}
        ${more.map(m => `
          <div class="pl-task" style="grid-template-columns:1fr">
            <div class="pl-task__title" style="font-size:var(--text-sm);color:var(--color-text-secondary)">${m}</div>
          </div>`).join('')}
      </div>`;
  },

  _courseHtml() {
    const s = this._state;
    const roleText = s.roleTitle || '';
    const ind = this._industries().find(i => i.id === s.industryId) || {};

    // 1) 旗舰长线产品：按规划模式推荐
    const longMap = { dual: ['changemakers', 'internship'], apply: ['changemakers', 'masterclass'], job: ['internship', 'summerwinter'] };
    const ids = longMap[s.mode] || ['changemakers'];
    const productRows = ids.filter(id => window.PRODUCTS && window.PRODUCTS[id]).map(id => {
      const p = window.PRODUCTS[id];
      const m = p.meta || {};
      return `
        <div class="pl-task" style="grid-template-columns:1fr">
          <div>
            <div class="pl-task__title">${m.titleCn || id}</div>
            <div class="pl-task__meta">${m.desc || ''}</div>
            <div class="pl-task__tags">
              <button class="cd-chip" style="cursor:pointer" onclick="CourseOverlay.open('${id}')">查看课程产品 →</button>
            </div>
          </div>
        </div>`;
    }).join('');

    // 2) 行业课程：按岗位关键词命中
    const kws = roleText ? roleText.split(/[\s/／、]+/).filter(x => x.length > 1) : [];
    const hit = (DATA.courses_industry || []).filter(c => {
      const t = `${c.company} ${c.role_or_course} ${c.description}`;
      if (kws.length && kws.some(k => t.includes(k))) return true;
      return !kws.length && (c.suitable_for || '').includes(ind.name || '影视传媒方向');
    }).slice(0, 4);

    const courseRows = hit.map(c => `
      <div class="pl-task" style="grid-template-columns:1fr">
        <div>
          <div class="pl-task__title">${c.role_or_course || c.company}</div>
          <div class="pl-task__meta">${[c.program_type, c.location, c.level, c.enrollment_status].filter(Boolean).join(' · ')}</div>
        </div>
      </div>`).join('');

    return `
      <div class="pl-group__head">
        <div class="pl-group__title">推荐课程产品</div>
        <div class="pl-group__meta">${ids.length + hit.length} 项</div>
      </div>
      <div class="pl-tasks">${productRows}${courseRows || ''}</div>`;
  },

  /* ═══ 结果渲染 ═══ */
  render() {
    const main = document.getElementById('pl-main');
    if (!main) return;
    const s = this._state;
    const ind = this._industries().find(i => i.id === s.industryId) || {};
    const barsMeta = this._bars();
    const bars = barsMeta.list;
    const doneCount = Object.values(s.done).filter(Boolean).length;
    const track = (DATA.timeline.tracks || []).find(t => t.id === s.cohort + '|' + s.route);

    // 路线选择（结果区顶部，避免与左侧固定字段冲突）
    const routeTabs = (DATA.timeline.routes || []).map(r =>
      `<button class="pl-mode${s.route === r ? ' is-active' : ''}" style="flex:0 0 auto;padding:8px 14px"
               onclick="PlanPage.setRoute('${r}')">${r}</button>`).join('');

    // 目标岗位档案
    const roleRecord = s.roleTitle
      ? (DATA.careers || []).find(c => (c.direction_zh || c.job_title_zh) === s.roleTitle)
      : null;
    const roleHtml = roleRecord ? `
      <div class="pl-group">
        <div class="pl-group__head">
          <div class="pl-group__title">目标岗位 · ${s.roleTitle}</div>
          <div class="pl-group__meta">${roleRecord.industry || ''}</div>
        </div>
        <div class="pl-tasks">
          <div class="pl-task" style="grid-template-columns:1fr">
            <div>
              <div class="pl-task__meta" style="margin-top:0">
                ${roleRecord.responsibilities ? `<strong>典型职责</strong>：${roleRecord.responsibilities}<br><br>` : ''}
                ${roleRecord.talent_summary ? `<strong>人才要求</strong>：${roleRecord.talent_summary}<br><br>` : ''}
                ${roleRecord.tools ? `<strong>核心工具</strong>：${roleRecord.tools}<br><br>` : ''}
                ${roleRecord.career_path ? `<strong>晋升路径</strong>：${roleRecord.career_path}` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>` : '';

    // 按年份分组的行动清单
    const years = [...new Set(bars.map(x => x.b.year))];
    const taskHtml = years.map(y => {
      const list = bars.filter(x => x.b.year === y);
      return `
        <div class="pl-group">
          <div class="pl-group__head">
            <div class="pl-group__title">${y} 年 · 行动清单</div>
            <div class="pl-group__meta">${list.length} 项</div>
          </div>
          <div class="pl-tasks">${list.map(x => this._taskHtml(x.b)).join('')}</div>
        </div>`;
    }).join('');

    main.innerHTML = `
      <div class="pl-card">
        <div class="pl-card__label">国家 / 地区路线</div>
        <div class="pl-modes" style="flex-direction:row;flex-wrap:wrap">${routeTabs}</div>
        ${track && track.lead ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);line-height:1.7;margin-top:var(--space-3)">${track.lead}</p>` : ''}
      </div>

      <div class="pl-summary">
        <div class="pl-stat"><div class="pl-stat__k">Cohort</div><div class="pl-stat__v">${s.cohort}</div></div>
        <div class="pl-stat"><div class="pl-stat__k">Route</div><div class="pl-stat__v">${s.route}</div></div>
        <div class="pl-stat"><div class="pl-stat__k">产业方向</div><div class="pl-stat__v" style="font-size:var(--text-md)">${ind.name || '—'}</div></div>
        <div class="pl-stat"><div class="pl-stat__k">目标岗位</div><div class="pl-stat__v" style="font-size:var(--text-md)">${s.roleTitle || '全部方向'}</div></div>
        <div class="pl-stat"><div class="pl-stat__k">行动项</div><div class="pl-stat__v">${bars.length}</div></div>
        <div class="pl-stat"><div class="pl-stat__k">已完成</div><div class="pl-stat__v" id="pl-stat-done">${doneCount}</div></div>
      </div>

      ${roleHtml}

      ${barsMeta.fallback ? `<div class="pl-card"><div class="pl-card__label">提示</div><p style="font-size:var(--text-sm);color:var(--color-text-muted);line-height:1.8;margin:0">
        当前模式对应的节点在「${s.cohort} · ${s.route}」中已经结束，以下展示该路线的完整节点，便于对照整体节奏。</p></div>` : ''}

      ${taskHtml || '<div class="pl-group"><div class="pl-empty">该申请季 / 路线暂无行动项数据，可切换申请季或路线查看。</div></div>'}

      <div class="pl-group">${this._schoolHtml()}</div>
      <div class="pl-group">${this._courseHtml()}</div>

      <p style="font-size:var(--text-xs);color:var(--color-text-faint);line-height:1.7">
        规划内容由「申请季 × 路线 × 规划模式」实时合成，勾选进度与选择项仅保存在当前浏览器，可随时修改或清空。
      </p>`;
  },

  setRoute(r) {
    this._state.route = r;
    this._save();
    this.render();
  },
};

window.PlanPage = PlanPage;
