/* ═══════════════════════════════════════════
   COURSE PRODUCTS RENDERER — SFK 影视传媒科系
   内容模型见 assets/js/products-film.js（window.PRODUCTS）/ data.js
   （window.SCHOOL_RECS），本文件只负责把「课程产品」渲染进一个共用的
   全屏浮层（见 CourseOverlay）：

   group: 'longform' | 'catalog'
     - longform：旗舰长线产品，含完整模块（hero / snapshot /
       whyNow / appTimeline / curriculum / studentCases / whySFK / cta）
     - catalog：目录产品，沿用同一叙事语气，但把多阶段时间线与案例替换为
       catalogGrid —— 直接复用首页的真实课程卡与筛选器
       （见 assets/js/pages/home.js）。
═══════════════════════════════════════════ */

/* ── Shared HTML builder ── */
function buildCatalogGridHTML(product) {
  const src = product.catalogSource;
  if (!src) return '';
  if (src.tabs && src.tabs.includes('internship')) {
    // 百余条岗位/带训课程 → 复用首页的筛选器 + 网格
    return window.HomePage._buildInternshipPanel();
  }
  const files = src.files || [src.file];
  let html = '';
  files.forEach(file => {
    const dataset = file === 'industry' ? DATA.courses_industry : DATA.courses_academic;
    const items = (dataset || []).filter(c => src.tabs.includes(c.tab));
    if (!items.length) return;
    html += file === 'industry'
      ? window.HomePage._buildCourseGrid(items)
      : window.HomePage._buildAcademicGrid(items);
  });
  return html;
}

function buildProductHTML(product, productId) {
  const SCHOOL_RECS = window.SCHOOL_RECS || [];
  const sec = (id, cnLabel, enLabel, inner) => `
    <section class="cd-section">
      <div class="cd-section__label">${cnLabel} <span class="u-en">${enLabel}</span></div>
      ${inner}
    </section>`;

  const tileCls = 'cd-hero__tile' + (product.tileVariant ? ' cd-hero__tile--' + product.tileVariant : '');

  let html = `
    <div class="cd-hero">
      <div class="cd-hero__content">
        <div class="cd-hero__eyebrow">${product.meta.eyebrow}</div>
        <h1 class="cd-hero__title">${product.meta.titleCn}</h1>
        <div class="cd-hero__subtitle"><span class="u-en">${product.meta.titleEn}</span></div>
        <p class="cd-hero__desc">${product.meta.desc}</p>
        <div class="cd-chips">${product.meta.chips.map(c => `<span class="cd-chip">${c}</span>`).join('')}</div>
      </div>
      <div class="${tileCls}" aria-hidden="true"></div>
    </div>`;

  html += sec('snapshot', '速览', 'Snapshot', `
    <div class="cd-stat-grid">
      ${product.snapshot.map(s => `
        <div class="cd-stat">
          <div class="cd-stat__k">${s.k}</div>
          <div class="cd-stat__v">${s.v}</div>
        </div>`).join('')}
    </div>`);

  // catalog 产品保留 "why now" 卖点；longform 产品改用亮点课程 + 适配人群。
  if (product.group === 'catalog' && product.whyNow) {
    html += sec('why-now', '为什么现在', 'Why Now', `
      <ul class="cd-list">
        ${product.whyNow.map(w => `<li>${w}</li>`).join('')}
      </ul>`);
  }

  const courseCardGrid = (items, keyPrefix) => `
    <div class="cd-curriculum-grid">
      ${items.map((c, i) => {
        const key = `${keyPrefix}-${productId}-${i}`;
        if (c.detail) registerMiniCourse(key, c.detail, c.title, '');
        return `
        <div class="cd-curriculum-card">
          <div class="cd-curriculum-card__img${i === 1 ? ' cd-curriculum-card__img--v2' : i === 2 ? ' cd-curriculum-card__img--v3' : ''}" aria-hidden="true"></div>
          <div class="cd-curriculum-card__body">
            <button type="button" class="cd-curriculum-card__title${c.detail ? ' is-clickable' : ''}"${c.detail ? ` onclick="MiniCourseModal.open('${key}')"` : ''}>${c.title}${c.detail ? '<span class="cd-mini-hint">详情 ›</span>' : ''}</button>
            <p class="cd-curriculum-card__desc">${c.desc}</p>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  if (product.group === 'longform' && product.highlightCourses) {
    html += sec('highlights', '亮点课程', 'Highlight Courses', courseCardGrid(product.highlightCourses, 'hl'));
  }

  if (product.group === 'longform' && product.fitAudience) {
    html += sec('fit-audience', '适配人群', 'Who It\'s For', `
      <ul class="cd-list">
        ${product.fitAudience.map(a => `<li>${a}</li>`).join('')}
      </ul>`);
  }

  // catalog 产品：简洁的三卡片课程概览。
  if (product.curriculum) {
    html += sec('curriculum', '核心课程', 'Curriculum', courseCardGrid(product.curriculum, 'cur'));
  }

  // longform 产品：分类 → 课程 → 课时的详细表格，每一项可点击。
  if (product.curriculumTable) {
    html += sec('curriculum', '核心课程', 'Curriculum', `
      <div class="cd-curric-table">
        ${product.curriculumTable.categories.map((cat, ci) => `
          <div class="cd-curric-cat">
            <div class="cd-curric-cat__head">
              <span class="cd-curric-cat__dot" style="background:var(--color-${cat.color})"></span>
              <span class="cd-curric-cat__name">${cat.name}</span>
              ${cat.subLabel ? `<span class="cd-curric-cat__sub u-en">${cat.subLabel}</span>` : ''}
            </div>
            <div class="cd-curric-cat__items">
              ${cat.items.map((item, ii) => {
                const key = `ct-${productId}-${ci}-${ii}`;
                if (item.detail) registerMiniCourse(key, item.detail, item.name, '');
                return `
                <div class="cd-curric-item">
                  <button type="button" class="cd-curric-item__name${item.detail ? ' is-clickable' : ''}"${item.detail ? ` onclick="MiniCourseModal.open('${key}')"` : ''}>${item.name}${item.detail ? '<span class="cd-mini-hint">详情 ›</span>' : ''}</button>
                  <span class="cd-curric-item__hours">${item.hours}</span>
                </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>`);
  }

  if (product.group === 'longform' && SCHOOL_RECS.length) {
    html += sec('school-recs', '院校与专业推荐', 'School & Major Recommendations', `
      <div class="cd-schoolrec">
        ${SCHOOL_RECS.map(b => `
          <div class="cd-schoolrec-branch">
            <div class="cd-schoolrec-branch__head">
              <span class="cd-schoolrec-branch__dot" style="background:var(--color-${b.key})"></span>
              <span class="cd-schoolrec-branch__name">${b.nameCn}</span>
              <span class="cd-schoolrec-branch__name-en u-en">${b.nameEn}</span>
            </div>
            <div class="cd-schoolrec-featured">
              ${b.featured.map(s => `
                <div class="cd-schoolrec-card">
                  <div class="cd-schoolrec-card__img" style="background:linear-gradient(135deg, var(--color-${b.key}) 0%, var(--color-primary-bright) 100%)" aria-hidden="true"></div>
                  <div class="cd-schoolrec-card__body">
                    <div class="cd-schoolrec-card__school">${s.schoolCn}</div>
                    <div class="cd-schoolrec-card__school-en u-en">${s.schoolEn}</div>
                    <div class="cd-schoolrec-card__program">${s.program}</div>
                    <p class="cd-schoolrec-card__note">${s.note}</p>
                  </div>
                </div>`).join('')}
            </div>
            <div class="cd-schoolrec-more">
              <span class="cd-schoolrec-more__label">同类可选 <span class="u-en">More</span></span>
              ${b.more.map(m => `<span class="cd-schoolrec-more__chip">${m}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>`);
  }

  if (product.studentCases) {
    html += sec('cases', '优秀成功案例', 'Success Stories', `
      <div class="cd-case-grid">
        ${product.studentCases.map((c, i) => `
          <div class="cd-case">
            <div class="cd-case__banner${i % 3 === 1 ? ' cd-case__banner--v2' : i % 3 === 2 ? ' cd-case__banner--v3' : ''}">
              <span class="cd-case__badge">优秀学员</span>
            </div>
            <div class="cd-case__body">
              <div class="cd-case__schools"><span class="cd-case__name">${c.name}</span>Offer · ${c.schools.join(' / ')}</div>
              <div class="cd-case__tagline">${c.tagline}</div>
              <div class="cd-case__highlights">${c.highlights}</div>
              <p class="cd-case__bio">${c.bio}</p>
              ${c.quote ? `<div class="cd-case__quote">${c.quote}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`);
  }

  if (product.group === 'longform' && product.appTimeline) {
    const timeline = product.appTimeline;
    const renderStep = (s) => {
      const key = `tl-${productId}-${s.q}`;
      const isFinal = s === timeline[timeline.length - 1];
      if (s.detail) registerMiniCourse(key, s.detail, s.type, '');
      return `
        <div class="cd-timeline__step${isFinal ? ' cd-timeline__step--final' : ''}">
          <div class="cd-timeline__day">${s.q} · ${s.phase}</div>
          <button type="button" class="cd-timeline__title${s.detail ? ' is-clickable' : ''}"${s.detail ? ` onclick="MiniCourseModal.open('${key}')"` : ''}>${s.type}${s.detail ? '<span class="cd-mini-hint">详情 ›</span>' : ''}</button>
          <div class="cd-timeline__desc">${s.desc}</div>
        </div>`;
    };
    const tlHalf = Math.ceil(timeline.length / 2);
    const tlCols = [timeline.slice(0, tlHalf), timeline.slice(tlHalf)];
    html += sec('app-timeline', '上课时间线', 'Timeline', `
      <div class="cd-timeline">
        ${tlCols.map(col => `<div class="cd-timeline__col">${col.map(renderStep).join('')}</div>`).join('')}
      </div>`);
  }

  if (product.group === 'longform' && product.topicWall) {
    html += sec('topic-wall', '学员课题墙', 'Student Topics', `
      <div class="cd-topic-wall">
        ${product.topicWall.map(t => `<div class="cd-topic-chip">${t}</div>`).join('')}
      </div>`);
  }

  if (product.group === 'catalog') {
    html += `
      <section class="cd-section cd-section--wide">
        <div class="cd-section__label">课程目录 <span class="u-en">Catalog</span></div>
        ${buildCatalogGridHTML(product)}
      </section>`;
  }

  // catalog 把 "why choose us" 作为独立区块；longform 把同样的理由收进结尾 CTA。
  if (product.group === 'catalog' && product.whySFK) {
    html += sec('why-sfk', '为什么选择我们', 'Why SFK', `
      <div class="cd-why-grid">
        ${product.whySFK.map((w, i) => `
          <div class="cd-why">
            <div class="cd-why__num">0${i + 1}</div>
            <div class="cd-why__title">${w.t}</div>
            <div class="cd-why__desc">${w.d}</div>
          </div>`).join('')}
      </div>`);
  }

  const ctaWhyGrid = (product.group === 'longform' && product.whySFK) ? `
      <div class="cd-cta__why cd-why-grid">
        ${product.whySFK.map((w, i) => `
          <div class="cd-why">
            <div class="cd-why__num">0${i + 1}</div>
            <div class="cd-why__title">${w.t}</div>
            <div class="cd-why__desc">${w.d}</div>
          </div>`).join('')}
      </div>` : '';

  html += `
    <div class="cd-cta">
      ${ctaWhyGrid}
      <div class="cd-cta__statement">${product.closingStatementCn}</div>
      <div class="cd-cta__statement-en u-en">${product.closingStatement}</div>
      <button class="cd-cta__btn">咨询课程顾问 <span class="u-en">/ Talk to an Advisor</span></button>
    </div>`;

  return html;
}

/* ── Mini-course detail modal — 浮层内任意小课程的点击详情弹层
   （时间线的某一阶段、课程表某一项），包含课程周期、亮点、可选课程示例
   与简介。渲染 buildProductHTML 时写入 registry，点击时读取。 ── */
const MiniCourseRegistry = {};
function registerMiniCourse(key, detail, titleCn, titleEn) {
  MiniCourseRegistry[key] = { ...detail, titleCn, titleEn };
}

const MiniCourseModal = {
  open(key) {
    const d = MiniCourseRegistry[key];
    if (!d) return;
    document.getElementById('minicourse-body').innerHTML = `
      <div class="mc-modal__title">${d.titleCn}</div>
      ${d.titleEn ? `<div class="mc-modal__title-en u-en">${d.titleEn}</div>` : ''}
      <div class="mc-modal__duration"><span class="mc-modal__duration-label">课程周期 <span class="u-en">Duration</span></span>${d.duration}</div>
      <ul class="mc-modal__highlights">
        ${d.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
      <div class="mc-modal__samples-label">可选课程示例 <span class="u-en">Sample Courses</span></div>
      <div class="mc-modal__samples">
        ${d.sampleCourses.map(s => `<span class="mc-modal__sample-chip">${s}</span>`).join('')}
      </div>
      <p class="mc-modal__intro">${d.intro}</p>`;
    document.getElementById('minicourse-modal').classList.add('is-open');
  },
  close() {
    document.getElementById('minicourse-modal')?.classList.remove('is-open');
  },
};
window.MiniCourseModal = MiniCourseModal;

/* ── Full-screen overlay, opened from any course card / product card ── */
const CourseOverlay = {
  open(productId) {
    const product = (window.PRODUCTS || {})[productId];
    if (!product) return;
    const body = document.getElementById('course-overlay-body');
    body.innerHTML = buildProductHTML(product, productId);
    body.classList.toggle('is-wide', product.group === 'catalog');
    document.getElementById('course-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    body.scrollTop = 0;
  },

  close() {
    document.getElementById('course-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
  },
};
window.CourseOverlay = CourseOverlay;

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('course-overlay');
  if (overlay) {
    overlay.querySelector('.course-overlay__backdrop')?.addEventListener('click', () => CourseOverlay.close());
    overlay.querySelector('.course-overlay__close')?.addEventListener('click', () => CourseOverlay.close());
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { MiniCourseModal.close(); CourseOverlay.close(); }
  });
  const mini = document.getElementById('minicourse-modal');
  if (mini) {
    mini.querySelector('.minicourse-modal__backdrop')?.addEventListener('click', () => MiniCourseModal.close());
    mini.querySelector('.minicourse-modal__close')?.addEventListener('click', () => MiniCourseModal.close());
  }
});
