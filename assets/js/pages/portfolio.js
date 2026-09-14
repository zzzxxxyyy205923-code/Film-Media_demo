/* ═══════════════════════════════════════════
   PORTFOLIO PAGE — 影视传媒录取案例
   数据源：data/portfolio.json（DATA.portfolio）
   卡片：院校 / 专业 / 学生背景 / 方向标签（无图占位，沿用 IST 卡片视觉语言）
   点击：侧栏展示完整案例（背景 · 实习 · 作品 · 奖项 · 申请策略）
═══════════════════════════════════════════ */
const PortfolioPage = {
  build() {
    const data = DATA.portfolio || [];

    // 按学术分支过滤（影视制作与项目 / 艺术与演艺 …），保持源数据顺序
    const branches = ['全部', ...[...new Set(data.map(p => p.academic_branch).filter(Boolean))]];
    const cats = document.getElementById('portfolio-cats');
    if (cats) {
      cats.innerHTML = branches.map((b, i) =>
        `<button class="filter-btn${i === 0 ? ' is-active' : ''}"
                 onclick="PortfolioPage.filter('${b}',this)">${b}</button>`
      ).join('');
    }

    this._render('全部', data);
  },

  filter(branch, btn) {
    document.querySelectorAll('#portfolio-cats .filter-btn').forEach(b => b.classList.remove('is-active'));
    if (btn) btn.classList.add('is-active');
    this._render(branch, DATA.portfolio || []);
  },

  // 无图卡片用院校英文名首字母做占位符
  _initials(p) {
    const en = (p.primary_school_en || '').replace(/[^A-Za-z ]/g, '').trim();
    if (en) return en.split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    return (p.primary_school || '·').slice(0, 2);
  },

  _render(branch, data) {
    const items = branch === '全部' ? data : data.filter(p => p.academic_branch === branch);
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<p class="u-muted" style="padding:32px 0;font-size:13px;">该方向暂无案例数据</p>';
      return;
    }
    grid.innerHTML = items.map(p => {
      const otherSchools = (p.other_schools || []).filter(Boolean);
      const ctx = [p.student, p.bg_school].filter(Boolean).join(' · ');
      return `
      <div class="port-card" onclick="PortfolioPage.open('${p.id}')">
        <div class="port-card__img port-card__img--empty">
          <span>${this._initials(p)}</span>
          <span class="port-card__cat-tag">${p.academic_branch || ''}</span>
        </div>
        <div class="port-card__body">
          <div class="port-card__title">${p.primary_school || '—'}</div>
          <div class="port-card__program">${p.primary_program || ''}</div>
          ${ctx ? `<div class="port-card__other-schools">${ctx}${p.fall ? ' · ' + p.fall : ''}</div>` : ''}
          ${otherSchools.length ? `<div class="port-card__other-schools">另获：${otherSchools.join('　')}</div>` : ''}
          ${p.tags && p.tags.length ? `<div class="port-card__tags">${p.tags.map(t => `<span class="port-card__tag">${t}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  // ── 案例详情侧栏 ──────────────────────────────────────────────
  _list(arr, limit) {
    const items = (arr || []).filter(x => x && String(x).trim().length > 4).slice(0, limit);
    if (!items.length) return '';
    return `<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.85;color:var(--color-text-secondary);">
      ${items.map(x => `<li>${x}</li>`).join('')}
    </ul>`;
  },

  open(id) {
    const p = (DATA.portfolio || []).find(x => x.id === id);
    if (!p) return;
    const scores = Object.entries(p.scores || {});
    const otherSchools = (p.other_schools || []).filter(Boolean);

    const block = (label, body) => body ? `
      <div class="sidebar__section">
        <div class="sidebar__section-label">${label}</div>
        ${body}
      </div>
      <hr class="sidebar__divider">` : '';

    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${p.industry_label || ''} · ${p.academic_branch || ''}</div>
        <div class="sidebar__title">${p.primary_school || '录取案例'}</div>
        <div class="sidebar__subtitle">${[p.primary_program, p.fall].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="sidebar__body">
        <div class="sidebar__section">
          <div class="sidebar__section-label">录取结果</div>
          <div class="sidebar__tags">
            <span class="sidebar__tag" style="border-color:var(--color-primary-bright);color:var(--color-primary-bright)">${p.primary_school || ''}</span>
            ${otherSchools.map(s => `<span class="sidebar__tag">${s}</span>`).join('')}
          </div>
        </div>
        <hr class="sidebar__divider">

        <div class="sidebar__section">
          <div class="sidebar__section-label">学生背景</div>
          <p style="font-size:13px;margin:0 0 6px">${[p.student, p.bg_school].filter(Boolean).join(' · ')}</p>
          ${scores.length ? `<div class="sidebar__tags">${scores.map(([k, v]) =>
            `<span class="sidebar__tag">${k}：${v}</span>`).join('')}</div>` : ''}
        </div>
        <hr class="sidebar__divider">

        ${block('实习 / 背景', this._list(p.intern, 6))}
        ${block('影视作品', this._list(p.works, 4))}
        ${block('获奖经历', this._list(p.awards, 6))}
        ${block('申请策略', this._list(p.strategy, 5))}

        <div class="sidebar__section">
          <div class="sidebar__section-label">继续探索</div>
          <button class="sidebar__tag" style="cursor:pointer"
                  onclick="Sidebar.close();Router.goToIndustry('${p.industry_id || ''}')">查看「${p.industry_label || '对应方向'}」岗位与院校 →</button>
        </div>
      </div>`);
  },
};
window.PortfolioPage = PortfolioPage;
