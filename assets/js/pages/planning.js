/* ═══════════════════════════════════════════
   PLANNING PAGE
═══════════════════════════════════════════ */
// 8 大影视传媒产业方向 —— 直接由 data/industries.json（DATA.industries）驱动，
// 在 PlanningPage.build() 时同步，避免常量与数据源脱节。
let INDUSTRIES = [];

function getIndustries() {
  return (DATA.industries || []).map((it, i) => ({
    id: it.id,
    name: it.name,
    num: String(i + 1).padStart(2, '0'),
    acad: it.acad,
    acadEn: it.acadEn,
    scope: it.scope,
  }));
}

// Geometric line glyphs per industry (2px stroke, currentColor) — brand-consistent iconography
const IND_ICONS = {
  film_tv:           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 9.5h18"/><circle cx="7" cy="7.7" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="7.7" r=".9" fill="currentColor" stroke="none"/><circle cx="17" cy="7.7" r=".9" fill="currentColor" stroke="none"/><path d="M10.2 12.6l4 2.2-4 2.2z"/></svg>',
  digital_platform:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/><path d="M10.5 8.4l3.6 2-3.6 2z"/></svg>',
  advertising_brand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/></svg>',
  entertainment:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.3 4.9 5.2.7-3.8 3.6 1 5.3L12 15.6l-4.7 2.4 1-5.3-3.8-3.6 5.2-.7z"/></svg>',
  media_program:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V20.5M9 20.5h6"/></svg>',
  corporate_pr:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10H9l-4 3.5V15.5H4z"/><path d="M8 9.5h8M8 12h5"/></svg>',
  rights_ip:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l7 2.6v5.2c0 4.2-2.9 7.7-7 9.2-4.1-1.5-7-5-7-9.2V6.1z"/><path d="M9.5 12.4l1.8 1.8 3.4-3.8"/></svg>',
  ai_filmtech:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4" rx=".5"/><path d="M10 7V4.2M14 7V4.2M10 19.8V17M14 19.8V17M7 10H4.2M7 14H4.2M19.8 10H17M19.8 14H17"/></svg>',
};

const PlanningPage = {
  build() {
    // 数据源就绪后再同步 8 大产业方向，避免模块加载顺序问题
    INDUSTRIES = getIndustries();
    this._buildNav();
    this._buildSections();
    ScrollSpy.init();
    this._initRailCollapse();
  },

  _buildNav() {
    const nav = document.getElementById('industry-nav');
    nav.innerHTML = INDUSTRIES.map((ind, i) => `
      <button class="industry-nav__btn${i===0?' is-active':''}"
              id="nav-${ind.id}"
              onclick="Router.goToIndustry('${ind.id}')">
        <span class="ind-ico">${IND_ICONS[ind.id]||''}</span>
        <span class="ind-meta">
          <span class="ind-num">${ind.num}</span>
          <span class="ind-name">${ind.name}</span>
          <span class="ind-acad">${ind.acad}</span>
          <span class="ind-acad-en">${ind.acadEn}</span>
        </span>
        <span class="ind-arrow">→</span>
      </button>`).join('');
  },

  _initRailCollapse() {
    const nav = document.getElementById('industry-nav');
    if (!nav) return;
    const navbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-h'), 10) || 56;
    // A 1px sentinel sits just above the rail. While it stays below the navbar
    // line the rail shows full cards; once it scrolls past (rail pins) → collapse.
    // IntersectionObserver fires on the display:none → visible transition too, so
    // arriving on the page at the top always resolves to the expanded state.
    let sentinel = document.getElementById('industry-nav-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'industry-nav-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
      nav.parentNode.insertBefore(sentinel, nav);
    }
    if (this._railIO) this._railIO.disconnect();
    if (!('IntersectionObserver' in window)) return;
    this._railIO = new IntersectionObserver((entries) => {
      entries.forEach(e => nav.classList.toggle('is-collapsed', !e.isIntersecting));
    }, { rootMargin: `-${navbarH + 1}px 0px 0px 0px`, threshold: 0 });
    this._railIO.observe(sentinel);
  },

  _buildSections() {
    const container = document.getElementById('industry-sections');
    const taxo = DATA.taxonomy;

    container.innerHTML = INDUSTRIES.map(ind => {
      // taxonomy 以产业方向 id 为键（film_tv / digital_platform / …）
      const t = taxo[ind.id] || {};

      // Companies for this industry (all entries, may have duplicates per company)
      const companies = DATA.careers.filter(c => c.industry_id === ind.id);
      const tiers = [...new Set(companies.map(c => c.tier))];

      // Deduplicated company list for tags (max 20 unique companies)
      const uniqueCompanies = [];
      const seenCompanies = new Set();
      for (const c of companies) {
        if (!seenCompanies.has(c.company)) {
          seenCompanies.add(c.company);
          uniqueCompanies.push(c);
        }
        if (uniqueCompanies.length >= 25) break;
      }

      // Job directions — deduplicated by direction_zh
      const directions = [...new Map(companies.map(c => [c.direction_zh, c])).values()];

      // Core skills from taxonomy
      const skills = (t.legacy_subdirections || []).concat(t.new_subdirections || []);

      // School match partial — use first direction as default context for section header
      const defaultDir = directions[0] ? directions[0].direction_zh : '';
      const schoolPicks = Schools.pickForSidebar(ind.id, 3, defaultDir, '');

      const copy = PlanningPage._getIntro(ind.id);
      return `
      <div class="industry-section" id="sec-${ind.id}">
        <div class="industry-section__header">
          <span class="industry-section__num">${ind.num}</span>
          <div style="flex:1">
            <div class="industry-section__title">${ind.name}<span class="industry-section__acad">— ${ind.acad}</span></div>
            <div class="industry-section__scope">${ind.scope}</div>
          </div>
          <div class="cv-actions">
            <button class="cv-btn cv-btn--primary" onclick="PlanningPage.openCareerJourneySidebar('${ind.id}')">岗位晋升路径 →</button>
            <button class="cv-btn cv-btn--secondary" onclick="Router.goToPortfolioFilter('${ind.acad}')">优秀案例 →</button>
          </div>
        </div>

        <div class="industry-section__intro" id="intro-wrap-${ind.id}">
          <p class="intro-short">${copy.short}</p>
          <div class="intro-full" id="intro-full-${ind.id}" style="display:none;">
            ${copy.full}
            <div class="intro-tags">
              <div class="intro-tag-row">
                <span class="intro-tag-label">核心学术方向</span>
                <span>${copy.skills}</span>
              </div>
              <div class="intro-tag-row">
                <span class="intro-tag-label">代表升学项目</span>
                <span>${copy.programs}</span>
              </div>
            </div>
          </div>
          <button class="intro-expand-btn" onclick="PlanningPage.toggleIntro('${ind.id}',this)">
            展开详情 <span class="intro-expand-arrow">↓</span>
          </button>
        </div>

        <div class="industry-cols">
          <!-- Col 1: Companies -->
          <div class="industry-col">
            <div class="industry-col__label">就业企业</div>
            <div class="company-filter" id="cfilter-${ind.id}">
              <button class="company-filter__btn is-active" data-tier="all"
                      onclick="PlanningPage.filterTier('${ind.id}','all',this)">全部</button>
              ${tiers.map(t => `
                <button class="company-filter__btn" data-tier="${t}"
                        onclick="PlanningPage.filterTier('${ind.id}','${t}',this)">${t}</button>`).join('')}
            </div>
            <div class="company-tag-cloud" id="colist-${ind.id}">
              ${uniqueCompanies.map(c => `
                <span class="company-tag" data-tier="${c.tier}"
                      onclick="PlanningPage.openCompanyGroupSidebar('${ind.id}','${c.company.replace(/'/g,"\\'")}')">
                  ${c.company}
                </span>`).join('')}
            </div>
          </div>

          <!-- Col 2: Job directions -->
          <div class="industry-col">
            <div class="industry-col__label">岗位方向</div>
            <ul class="job-dir-list">
              ${directions.map(c => `
                <li class="job-dir-list__item"
                    onclick="PlanningPage.openJobSidebar('${ind.id}','${c.direction_zh.replace(/'/g,"\\'")}')">
                  <span>${c.direction_zh}</span>
                  <span class="job-dir-list__item-en">${c.direction_en}</span>
                  <span class="job-dir-list__count">${companies.filter(x=>x.direction_zh===c.direction_zh).length}</span>
                </li>`).join('')}
            </ul>
          </div>

          <!-- Col 3: Core skills -->
          <div class="industry-col">
            <div class="industry-col__label">核心学术方向</div>
            <div class="skill-tags" style="margin-bottom:16px;">
              ${(t.legacy_subdirections||[]).map((s,i) =>
                `<span class="skill-tag${i<3?' skill-tag--key':''}">${s}</span>`
              ).join('')}
              ${(t.new_subdirections||[]).slice(0,4).map(s =>
                `<span class="skill-tag">${s}</span>`
              ).join('')}
            </div>
            <div class="industry-col__label">常用工具</div>
            <div class="skill-tags">
              ${(t.tools_hint||[]).map(s =>
                `<span class="skill-tag">${s}</span>`
              ).join('')}
            </div>
          </div>
        </div>

        <!-- School match area -->
        <div class="school-match-area">
          <div class="school-match-area__header">
            <div class="school-match-area__title">代表性可匹配院校</div>
            <div class="school-match-area__actions">
              <div class="country-pills" id="cpills-${ind.id}">
                ${[['US','🇺🇸 美国'],['UK','🇬🇧 英国'],['HK_SG','🇭🇰 港新'],['OTHER','🌏 其他']].map((g,i) =>
                  `<button class="country-pill${i===0?' is-active':''}" data-group="${g[0]}"
                           onclick="PlanningPage.switchCountry('${ind.id}','${g[0]}',this)">${g[1]}</button>`
                ).join('')}
              </div>
              <button class="school-match-area__view-all"
                      onclick="PlanningPage.openFullSchoolSidebar('${ind.id}', document.querySelector('#cpills-${ind.id} .country-pill.is-active')?.dataset.group || 'US')">
                查看全部 →
              </button>
            </div>
          </div>
          ${['US','UK','HK_SG','OTHER'].map((g,i) => `
            <div class="school-country-panel${i===0?'':' u-visually-hidden'}" id="sgrid-${ind.id}-${g}">
              ${this._renderSchoolGrid(ind.id, g, schoolPicks)}
            </div>`).join('')}
        </div>
      </div>`;
    }).join('');
  },

  // 产业方向介绍文案 —— 完全由 data/industries.json + data/taxonomy.json 驱动
  _getIntro(indId) {
    const t = (DATA.taxonomy || {})[indId] || {};
    const ind = (DATA.industries || []).find(i => i.id === indId) || {};
    const skills = [...new Set((t.legacy_subdirections || []).concat(t.new_subdirections || []))];
    const short = ind.observation || (ind.scope ? `${ind.name}：${ind.scope}。` : '');
    const full = [
      ind.observation ? `<p>${ind.observation}</p>` : '',
      ind.coreLogic ? `<p><strong>核心逻辑</strong>：${ind.coreLogic}</p>` : '',
      ind.aiImpact ? `<p><strong>AI 影响</strong>：${ind.aiImpact}</p>` : '',
      ind.audience ? `<p><strong>适合人群</strong>：${ind.audience}</p>` : '',
    ].join('');
    return {
      short,
      full,
      skills: skills.join(' · '),
      programs: (t.program_tags_hint || []).join(' · '),
    };
  },

  // 岗位晋升路径 —— 由 taxonomy.job_clusters + data/careers.json 驱动
  openCareerJourneySidebar(indId) {
    const ind = INDUSTRIES.find(i => i.id === indId) || {};
    const t = (DATA.taxonomy || {})[indId] || {};
    const clusters = t.job_clusters || [];
    const companies = DATA.careers.filter(c => c.industry_id === indId);
    const tiers = [...new Map(companies.map(c => [c.company, c])).values()].slice(0, 14);
    const paths = [...new Set(companies.map(c => c.career_path).filter(Boolean))].slice(0, 6);

    const clusterHtml = clusters.map((cl, i) => `
      <div class="sidebar__job-entry${i > 0 ? ' sidebar__job-entry--divider' : ''}">
        <div class="sidebar__section">
          <p style="font-weight:600;margin:0 0 2px">${cl.name}</p>
          <p style="font-size:12px;color:var(--color-text-muted);margin:0">${cl.en || ''}</p>
        </div>
        ${cl.note ? `<div class="sidebar__section"><p>${cl.note}</p></div>` : ''}
      </div>`).join('<hr class="sidebar__divider">');

    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${ind.name || ''} · 职业发展</div>
        <div class="sidebar__title">岗位晋升路径</div>
        <div class="sidebar__subtitle">${ind.acad || ''}</div>
      </div>
      <div class="sidebar__body">
        <div class="sidebar__section">
          <div class="sidebar__section-label">岗位序列（${clusters.length}）</div>
          ${clusterHtml || '<p class="u-muted">暂无数据</p>'}
        </div>
        <hr class="sidebar__divider">
        <div class="sidebar__section">
          <div class="sidebar__section-label">典型晋升路径</div>
          ${paths.map(p => `<p style="margin:0 0 10px">${p}</p>`).join('') || '<p class="u-muted">暂无数据</p>'}
        </div>
        <hr class="sidebar__divider">
        <div class="sidebar__section">
          <div class="sidebar__section-label">代表企业</div>
          <div class="sidebar__tags">${tiers.map(c =>
            `<span class="sidebar__tag" style="cursor:pointer"
                   onclick="PlanningPage.openCompanyGroupSidebar('${indId}','${c.company.replace(/'/g,"\\'")}')">${c.company}</span>`
          ).join('')}</div>
        </div>
      </div>`);
  },

  _renderSchoolGrid(indId, group, picks) {
    const groupPicks = picks[group] || [];
    if (!groupPicks.length) {
      return `<div class="school-grid__placeholder">该地区数据建设中，请联系升学顾问获取定制匹配方案</div>`;
    }
    return `<div class="school-grid">
      ${groupPicks.map(s => `
        <div class="school-grid-card">
          <div class="school-grid-card__name">
            ${s.school_en} <span class="zh">${s.school_zh}</span>
          </div>
          <div class="school-grid-card__progs">
            <div class="school-grid-card__prog"
                 onclick="window.open('${s.prog.program_url || 'https://www.google.com/search?q=' + encodeURIComponent(s.school_en + ' ' + s.prog.program_name_en)}','_blank')">
              ${s.prog.program_name_en || s.prog.program_name_zh}
            </div>
            <div class="school-grid-card__meta">
              ${s.prog.program_name_zh || ''}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
  },

  switchCountry(indId, group, btn) {
    document.querySelectorAll(`#cpills-${indId} .country-pill`).forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll(`[id^="sgrid-${indId}-"]`).forEach(p => p.classList.add('u-visually-hidden'));
    const panel = document.getElementById(`sgrid-${indId}-${group}`);
    if (panel) {
      panel.classList.remove('u-visually-hidden');
      // Lazy-render if not yet rendered
      if (!panel.dataset.rendered) {
        const picks = Schools.pickForSidebar(indId, 3, panel.dataset.roleText || '', panel.dataset.companyText || '');
        panel.innerHTML = this._renderSchoolGrid(indId, group, picks);
        panel.dataset.rendered = '1';
      }
    }
  },

  openFullSchoolSidebar(indId, group) {
    const ind = INDUSTRIES.find(i => i.id === indId);
    const GROUPS = [['US','🇺🇸 美国'],['UK','🇬🇧 英国'],['HK_SG','🇭🇰 港新'],['OTHER','🌏 其他']];
    const activeGroup = group || 'US';

    const tabs = GROUPS.map(([g, label]) =>
      `<button class="country-tab${g===activeGroup?' is-active':''}"
               onclick="Tabs.switchCountrySidebar('${g}',this)">${label}</button>`
    ).join('');

    const panels = GROUPS.map(([g]) => `
      <div class="country-tab-panel${g===activeGroup?' is-active':''}" data-group="${g}">
        ${Schools.renderFullList(indId, g, '', '')}
      </div>`).join('');

    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${ind.name} · 院校匹配</div>
        <div class="sidebar__title">可匹配院校专业</div>
        <div class="sidebar__subtitle">${ind.acad}</div>
      </div>
      <div class="sidebar__body">
        <div class="country-tabs">${tabs}</div>
        ${panels}
      </div>`);
  },

  openCompanyGroupSidebar(indId, companyName) {
    const ind = INDUSTRIES.find(i => i.id === indId)
      || (DATA.industries || []).find(i => i.id === indId) || {};
    const jobs = DATA.careers.filter(c => c.industry_id === indId && c.company === companyName);
    if (!jobs.length) return;
    const first = jobs[0];
    const jobContext = jobs.map(j => j.direction_zh).join(' ');
    const schoolPicks = Schools.pickForCompany(indId, 10, jobContext, companyName);

    const jobsHtml = jobs.map((c, i) => `
      <div class="sidebar__job-entry${i > 0 ? ' sidebar__job-entry--divider' : ''}">
        <div class="sidebar__section">
          <p style="font-weight:600;margin:0 0 2px">${c.job_title_zh}</p>
          <p style="font-size:12px;color:var(--color-text-muted);margin:0 0 4px">${c.job_title_en}</p>
          ${c.department ? `<p style="font-size:12px;color:var(--color-text-muted);">${c.department}</p>` : ''}
        </div>
        <div class="sidebar__section">
          <div class="sidebar__section-label">岗位职责</div>
          <p>${c.responsibilities}</p>
        </div>
        <div class="sidebar__section">
          <div class="sidebar__section-label">人才要求</div>
          <p>${c.talent_summary}</p>
        </div>
        ${c.tools ? `
        <div class="sidebar__section">
          <div class="sidebar__section-label">核心工具</div>
          <div class="sidebar__tags">${c.tools.split(/[,，、]/).map(t=>t.trim()).filter(Boolean)
            .map(t=>`<span class="sidebar__tag">${t}</span>`).join('')}</div>
        </div>` : ''}
        ${c.salary_usd ? `
        <div class="sidebar__section">
          <div class="sidebar__section-label">薪资参考</div>
          <span class="salary-badge">${c.salary_usd}</span>
          ${c.career_path ? `<p style="font-size:12px;color:var(--color-text-muted);margin-top:6px;">${c.career_path}</p>` : ''}
        </div>` : (c.career_path ? `
        <div class="sidebar__section">
          <div class="sidebar__section-label">晋升路径</div>
          <p style="font-size:12px;color:var(--color-text-muted);">${c.career_path}</p>
        </div>` : '')}
      </div>`).join('<hr class="sidebar__divider">');

    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${ind.name || ''} · ${first.tier || ''}</div>
        <div class="sidebar__title">${companyName}</div>
        <div class="sidebar__subtitle">${jobs.length > 1 ? jobs.length + ' 个岗位方向' : first.department}</div>
      </div>
      <div class="sidebar__body">
        ${jobsHtml}
        <hr class="sidebar__divider">
        <div class="sidebar__section">
          <div class="sidebar__section-label">代表性学历背景</div>
          ${Schools._renderFlat(schoolPicks)}
        </div>
      </div>`);
  },

  openCompanySidebar(c) {
    if (!c) return;
    this.openCompanyGroupSidebar(c.industry_id, c.company);
  },

  openJobSidebar(indId, directionZh) {
    const ind = INDUSTRIES.find(i => i.id === indId) || (DATA.industries || []).find(i => i.id === indId) || {};
    const jobs = DATA.careers.filter(c => c.direction_zh === directionZh && c.industry_id === indId);
    const job = jobs[0] || {};
    const companyContext = jobs.map(j => j.company).join(' ');
    const roleContext = [directionZh, job.direction_en || '', jobs.map(j => j.responsibilities || '').join(' ')].join(' ');
    const schoolPicks = Schools.pickForJob(indId, roleContext, companyContext);
    const dirEn = job.direction_en || '';
    const companies = [...new Set(jobs.map(j => j.company))];
    const tools = [...new Set(jobs.map(j => j.tools).filter(Boolean).join('|').split(/[,，、|]/).map(t => t.trim()).filter(Boolean))];
    Sidebar.open(`
      <div class="sidebar__header">
        <div class="sidebar__eyebrow">${ind.name || ''}</div>
        <div class="sidebar__title">${directionZh}</div>
        <div class="sidebar__subtitle">${dirEn}</div>
      </div>
      <div class="sidebar__body">
        ${job.responsibilities ? `
          <div class="sidebar__section">
            <div class="sidebar__section-label">典型职责</div>
            <p>${job.responsibilities}</p>
          </div>` : ''}
        ${job.talent_summary ? `
          <div class="sidebar__section">
            <div class="sidebar__section-label">人才要求</div>
            <p>${job.talent_summary}</p>
          </div>` : ''}
        ${tools.length ? `
          <div class="sidebar__section">
            <div class="sidebar__section-label">核心工具</div>
            <div class="sidebar__tags">${tools.map(t => `<span class="sidebar__tag">${t}</span>`).join('')}</div>
          </div>` : ''}
        ${job.career_path ? `
          <div class="sidebar__section">
            <div class="sidebar__section-label">晋升路径</div>
            <p style="font-size:12px;color:var(--color-text-muted);">${job.career_path}</p>
          </div>` : ''}
        ${companies.length ? `
          <div class="sidebar__section">
            <div class="sidebar__section-label">招聘企业（${companies.length}）</div>
            <div class="sidebar__tags">${companies.map(c =>
              `<span class="sidebar__tag" style="cursor:pointer"
                     onclick="PlanningPage.openCompanyGroupSidebar('${indId}','${c.replace(/'/g,"\\'")}')">${c}</span>`
            ).join('')}</div>
          </div>` : ''}
        <hr class="sidebar__divider">
        <div class="sidebar__section">
          <div class="sidebar__section-label">代表性可匹配专业</div>
          ${Schools._renderFlat(schoolPicks)}
        </div>
      </div>`);
  },

  toggleIntro(indId, btn) {
    const full = document.getElementById('intro-full-' + indId);
    const isOpen = full.style.display !== 'none';
    full.style.display = isOpen ? 'none' : 'block';
    btn.innerHTML = isOpen
      ? '展开详情 <span class="intro-expand-arrow">↓</span>'
      : '收起 <span class="intro-expand-arrow">↑</span>';
  },

  filterTier(indId, tier, btn) {
    document.querySelectorAll(`#cfilter-${indId} .company-filter__btn`).forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll(`#colist-${indId} .company-tag`).forEach(tag => {
      if (tier === 'all') { tag.classList.remove('is-active','is-dimmed'); }
      else if (tag.dataset.tier === tier) { tag.classList.add('is-active'); tag.classList.remove('is-dimmed'); }
      else { tag.classList.add('is-dimmed'); tag.classList.remove('is-active'); }
    });
  },
};
window.PlanningPage = PlanningPage;
