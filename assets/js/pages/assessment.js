/* ═══════════════════════════════════════════
   ASSESSMENT PAGE — 影视传媒职业方向测评
   ───────────────────────────────────────────
   沿用 IST_demo 的「单页状态机 + 进度条」交互骨架，
   题库与画像逻辑来自源项目（data/assessment.json +
   10 维能力模型 + 岗位规则匹配）：
     1) 6 道题依次作答（背景题 / 多选题 / 双组题）
     2) 归一化为 10 个能力维度画像
     3) 用规则加权把画像匹配到岗位库（DATA.careers，61 个岗位方向）
     4) 汇总出最匹配的产业方向、代表人物与职业取舍建议
     5) 结果落盘 localStorage，一键带入「我的规划」
═══════════════════════════════════════════ */

const AS_DIMS = {
  story: '故事创作', reality: '真实观察', visual: '视觉表达', organize: '统筹协作',
  business: '商业传播', tech: '技术创新', stability: '稳定偏好', public: '公共价值',
  pace: '高频执行', people: '人物沟通',
};

/* 岗位规则：正则命中岗位文本后，为维度加权（沿用源项目规则） */
const AS_ROLE_RULES = [
  { m: /编剧|剧本|故事开发|IP改编|内容开发/, w: { story: 5, reality: 1, organize: 1 }, why: ['喜欢建立人物、结构与世界观', '愿意长期阅读、写作和反复迭代'] },
  { m: /导演(?!助理)|MV导演|创意导演|总导演/, w: { story: 3, visual: 5, people: 1, organize: 1 }, why: ['重视视听表达和整体创作判断', '愿意承担作品最终方向'] },
  { m: /纪录片|调查记者|视频记者|新闻/, w: { reality: 5, public: 4, people: 2, visual: 1 }, why: ['偏好真实人物、现场观察与公共议题', '能够通过采访和调研建立内容'] },
  { m: /播客|音频/, w: { reality: 3, people: 3, story: 2, public: 1 }, why: ['适合通过谈话、声音和长期选题建立内容', '重视人物沟通与信息组织'] },
  { m: /制片|项目管理|执行导演|统筹|制作人/, w: { organize: 5, people: 2, business: 1, pace: 2 }, why: ['擅长协调资源、时间和团队', '能够在复杂项目中持续推进结果'] },
  { m: /摄影|剪辑|声音|美术|视效|调色|后期|数字绘景/, w: { visual: 5, tech: 2, organize: 1 }, why: ['对画面、声音和制作质量敏感', '愿意通过专业技能形成竞争力'] },
  { m: /品牌|广告|创意策划|商业|营销|宣发/, w: { business: 5, visual: 2, pace: 2, people: 1 }, why: ['能够在创意与商业目标之间建立连接', '接受客户反馈和明确交付'] },
  { m: /公关|企业传播|媒体关系|国际传播|舆情/, w: { business: 4, people: 4, public: 2, stability: 2 }, why: ['适合组织信息并与多方沟通', '能够理解组织声誉与传播目标'] },
  { m: /平台|运营|短视频|直播|账号|MCN/, w: { pace: 5, business: 4, tech: 1 }, why: ['适应快速迭代和持续发布', '愿意结合用户反馈与数据优化内容'] },
  { m: /经纪|艺人|演出|演唱会|舞台/, w: { people: 5, organize: 3, business: 2, visual: 1 }, why: ['擅长人物沟通和长期关系管理', '能够适应现场、高协作和娱乐项目'] },
  { m: /AI|虚拟|实时|Unreal|数字人|生成式/, w: { tech: 6, visual: 2, organize: 1 }, why: ['愿意持续学习快速变化的工具', '适合把技术转化为新的内容工作流'] },
  { m: /版权|IP运营|版权经理|发行/, w: { story: 2, business: 4, organize: 3, stability: 2 }, why: ['兼顾内容价值、合同和商业判断', '适合长期管理项目与权利关系'] },
  { m: /数据|分析|核验|事实核查/, w: { tech: 3, reality: 3, public: 2, stability: 1 }, why: ['擅长证据、信息和结构化判断', '愿意处理复杂材料并进行核验'] },
];

const AS_STORE = 'sfk_film_assessment_v1';
const AS_PLAN_SEED = 'sfk_film_plan_seed_v1';

const DIM_GIFTS = {
  story: '能够从人物、冲突与细节中发现故事',
  reality: '对真实世界保持敏锐，并愿意追问事实背后的原因',
  visual: '对画面、声音、节奏和整体呈现有天然感受力',
  organize: '能把复杂任务拆开，并推动不同的人一起完成目标',
  business: '能理解受众、平台与客户，也知道创意需要产生真实结果',
  tech: '对新工具和新流程保持好奇，并愿意把技术转化为表达',
  stability: '重视长期积累和可持续成长，而不是只追逐短期刺激',
  public: '希望内容不仅好看，也能回应真实的人和社会',
  pace: '有快速行动、持续迭代和把想法落地的能量',
  people: '容易理解他人，也有通过沟通建立信任与内容的潜力',
};

const AssessmentPage = {
  _ans: {},
  _step: 0,
  _result: null,

  _questions() { return (DATA.assessment && DATA.assessment.questions) || []; },

  /* ── 岗位库：按 role_id 去重为「岗位方向」 ── */
  _roles() {
    const seen = new Map();
    (DATA.careers || []).forEach(c => {
      if (!seen.has(c.role_id)) {
        seen.set(c.role_id, {
          id: String(c.role_id),
          // 与「我的规划」岗位下拉、PlanningPage.openJobSidebar 保持一致，统一用 direction_zh
          title: c.direction_zh || c.job_title_zh,
          en: c.direction_en || c.job_title_en || '',
          industry: c.industry || '',
          industryId: c.industry_id || '',
          intro: c.responsibilities || '',
          note: c.background || '',
          workFocus: c.work_focus || '',
          talent: c.talent_summary || '',
          education: c.education || '',
          companies: [],
        });
      }
      seen.get(c.role_id).companies.push(c.company);
    });
    return [...seen.values()];
  },

  /* ── 本地存档 ── */
  _load() { try { return JSON.parse(localStorage.getItem(AS_STORE)) || null; } catch (e) { return null; } },
  _save() { try { localStorage.setItem(AS_STORE, JSON.stringify({ answers: this._ans, result: this._result })); } catch (e) { /* 忽略隐私模式 */ } },

  build() {
    const saved = this._load();
    if (saved) {
      this._ans = saved.answers || {};
      this._result = saved.result || null;
    }
    if (this._result) this.renderResult();
    else this.renderQuestion();
  },

  /* ═══ 答题 ═══ */
  _complete(q, a) {
    if (q.kind === 'multi') return Array.isArray(a) && a.length > 0;
    if (q.kind === 'dual') return !!a && q.groups.every(g => Number.isInteger(a[g.id]));
    return Number.isInteger(a);
  },

  _selectedOptions(q, a) {
    if (!this._complete(q, a)) return [];
    if (q.kind === 'multi') return a.map(i => q.options[i]).filter(Boolean);
    if (q.kind === 'dual') return q.groups.map(g => g.options[a[g.id]]).filter(Boolean);
    return q.options && q.options[a] ? [q.options[a]] : [];
  },

  _progress(done) {
    const qs = this._questions();
    const fill = document.getElementById('as-progress-fill');
    const label = document.getElementById('as-progress-label');
    if (fill) fill.style.width = Math.round(done / qs.length * 100) + '%';
    if (label) label.textContent = done + ' / ' + qs.length;
  },

  _optionsHtml(q, a) {
    if (q.kind === 'dual') {
      return q.groups.map(g => `
        <div style="margin-bottom:var(--space-4)">
          <div class="as-panel__label">${g.title}</div>
          <div class="as-opts">
            ${g.options.map((o, i) => `
              <button class="as-opt${a && a[g.id] === i ? ' is-active' : ''}" data-group="${g.id}" data-i="${i}">
                <span class="as-opt__key">${'ABCDE'[i] || i + 1}</span>
                <span><strong>${o.t}</strong>${o.d ? `<small style="display:block;color:var(--color-text-muted);font-size:var(--text-sm);margin-top:2px">${o.d}</small>` : ''}</span>
              </button>`).join('')}
          </div>
        </div>`).join('');
    }
    const multi = q.kind === 'multi';
    const sel = multi && Array.isArray(a) ? a : [];
    return `<div class="as-opts">
      ${q.options.map((o, i) => `
        <button class="as-opt${multi ? (sel.includes(i) ? ' is-active' : '') : (a === i ? ' is-active' : '')}" data-i="${i}">
          <span class="as-opt__key">${'ABCDEFG'[i] || i + 1}</span>
          <span><strong>${o.t}</strong>${o.d ? `<small style="display:block;color:var(--color-text-muted);font-size:var(--text-sm);margin-top:2px">${o.d}</small>` : ''}</span>
          ${multi ? `<em style="margin-left:auto;font-size:var(--text-xs);color:${sel.includes(i) ? 'var(--color-accent)' : 'var(--color-text-faint)'}">${sel.includes(i) ? '已选' : '选择'}</em>` : ''}
        </button>`).join('')}
    </div>`;
  },

  renderQuestion() {
    const qs = this._questions();
    const stage = document.getElementById('as-stage');
    if (!stage || !qs.length) return;
    const i = Math.min(Math.max(this._step, 0), qs.length - 1);
    this._step = i;
    const q = qs[i];
    const a = this._ans[q.id];
    const complete = this._complete(q, a);

    this._progress(i);

    stage.innerHTML = `
      <div class="as-card">
        <div class="as-q__index">QUESTION ${i + 1} / ${qs.length}${q.scored === false ? ' · 背景题（不计分）' : ''}</div>
        <div class="as-q__title">${q.title}</div>
        ${q.help ? `<p style="color:var(--color-text-muted);font-size:var(--text-sm);margin:0 0 var(--space-4)">${q.help}</p>` : ''}
        ${this._optionsHtml(q, a)}
        <div class="as-nav">
          <button class="as-btn" data-act="prev" ${i === 0 ? 'disabled' : ''}>上一步</button>
          <button class="as-btn as-btn--primary" data-act="next" ${complete ? '' : 'disabled'}>
            ${i === qs.length - 1 ? '查看结果' : '下一步'}
          </button>
        </div>
      </div>`;

    stage.querySelectorAll('.as-opt').forEach(btn => {
      btn.onclick = () => this._pick(q, btn);
    });
    const prev = stage.querySelector('[data-act="prev"]');
    const next = stage.querySelector('[data-act="next"]');
    if (prev) prev.onclick = () => { if (this._step > 0) { this._step--; this.renderQuestion(); } };
    if (next) next.onclick = () => {
      if (!this._complete(q, this._ans[q.id])) return;
      if (this._step < qs.length - 1) { this._step++; this.renderQuestion(); }
      else {
        this._result = this._compute();
        this._save();
        this.renderResult();
      }
    };
  },

  _pick(q, btn) {
    const i = Number(btn.dataset.i);
    if (q.kind === 'multi') {
      let arr = Array.isArray(this._ans[q.id]) ? [...this._ans[q.id]] : [];
      const opt = q.options[i];
      if (opt.exclusive) arr = arr.includes(i) ? [] : [i];
      else {
        arr = arr.filter(x => !q.options[x].exclusive);
        const pos = arr.indexOf(i);
        if (pos >= 0) arr.splice(pos, 1);
        else if (arr.length < (q.max || 2)) arr.push(i);
      }
      this._ans[q.id] = arr;
    } else if (q.kind === 'dual') {
      this._ans[q.id] = Object.assign({}, this._ans[q.id] || {}, { [btn.dataset.group]: i });
    } else {
      this._ans[q.id] = i;
    }
    this._save();
    this.renderQuestion();
  },

  retake() {
    this._ans = {}; this._step = 0; this._result = null;
    this._save();
    this.renderQuestion();
  },

  /* ═══ 打分引擎 ═══ */
  _maxContribution(q, k) {
    if (q.scored === false) return 0;
    if (q.kind === 'multi') {
      return q.options.map(o => Math.max(0, (o.w && o.w[k]) || 0)).sort((a, b) => b - a)
        .slice(0, q.max || 2).reduce((a, b) => a + b, 0);
    }
    if (q.kind === 'dual') {
      return q.groups.reduce((s, g) => s + Math.max(0, ...g.options.map(o => (o.w && o.w[k]) || 0)), 0);
    }
    return Math.max(0, ...(q.options || []).map(o => (o.w && o.w[k]) || 0));
  },

  _raw() {
    const raw = {};
    Object.keys(AS_DIMS).forEach(k => raw[k] = 0);
    this._questions().forEach(q => {
      if (q.scored === false) return;
      this._selectedOptions(q, this._ans[q.id]).forEach(o => {
        Object.entries(o.w || {}).forEach(([k, v]) => { raw[k] = (raw[k] || 0) + v; });
      });
    });
    return raw;
  },

  _profile() {
    const raw = this._raw();
    const out = {};
    Object.keys(AS_DIMS).forEach(k => {
      const max = this._questions().reduce((s, q) => s + this._maxContribution(q, k), 0) || 1;
      out[k] = Math.max(0, Math.min(100, Math.round((raw[k] || 0) / max * 100)));
    });
    return out;
  },

  _roleVector(role) {
    const v = {};
    Object.keys(AS_DIMS).forEach(k => v[k] = 0);
    const text = `${role.title} ${role.en} ${role.intro} ${role.workFocus} ${role.industry}`;
    AS_ROLE_RULES.forEach(r => { if (r.m.test(text)) Object.entries(r.w).forEach(([k, n]) => v[k] += n); });
    if (!Object.values(v).some(Boolean)) { v.organize = 1; v.visual = 1; }
    return v;
  },

  _scoreRole(role, p) {
    const rv = this._roleVector(role);
    let dot = 0, den = 0;
    Object.keys(AS_DIMS).forEach(k => { if (rv[k] > 0) { dot += (p[k] || 0) * rv[k]; den += rv[k]; } });
    const fit = den ? dot / den : 0;
    const breadth = Object.values(rv).filter(x => x > 0).length;
    return Math.max(0, Math.min(98, Math.round(fit * 0.92 + breadth * 1.2)));
  },

  _reasons(role, p) {
    const text = `${role.title} ${role.intro}`;
    const matched = AS_ROLE_RULES.filter(r => r.m.test(text)).flatMap(r => r.why);
    const rv = this._roleVector(role);
    const dims = Object.keys(rv).filter(k => rv[k] > 0)
      .sort((a, b) => (p[b] || 0) * rv[b] - (p[a] || 0) * rv[a]).slice(0, 2)
      .map(k => `你的「${AS_DIMS[k]}」倾向与该岗位要求较一致`);
    return [...new Set(dims.concat(matched))].slice(0, 3);
  },

  _family(role) {
    const t = `${role.title} ${role.industry}`;
    if (/AI|虚拟|数字人|实时|Unreal|智能/.test(t)) return 'tech';
    if (/编剧|剧本|故事|内容开发|IP开发|改编/.test(t)) return 'story';
    if (/导演|摄影|剪辑|声音|美术|视效|后期|调色/.test(t)) return 'craft';
    if (/纪录片|新闻|记者|播客|调查|非虚构/.test(t)) return 'reality';
    if (/制片|统筹|项目|执行导演|制作人/.test(t)) return 'production';
    if (/品牌|广告|传播|公关|营销|宣发/.test(t)) return 'business';
    if (/平台|运营|短视频|直播|账号|MCN/.test(t)) return 'platform';
    if (/经纪|艺人|演出|舞台/.test(t)) return 'people';
    if (/版权|发行|IP运营/.test(t)) return 'rights';
    return 'other';
  },

  _evidence() {
    const q = this._questions().find(x => x.id === 'evidence');
    const a = this._ans.evidence || [];
    if (!q || !Array.isArray(a) || !a.length) {
      return { level: '待验证', copy: '目前没有足够的项目证据，推荐结果主要来自兴趣与行为倾向。' };
    }
    const hasNone = a.some(i => q.options[i] && q.options[i].exclusive);
    const count = a.filter(i => !(q.options[i] && q.options[i].exclusive)).length;
    if (hasNone || count === 0) return { level: '待验证', copy: '目前还没有完整项目经历，建议先用短期课程或小型项目验证方向。' };
    return count >= 2
      ? { level: '已有初步证据', copy: '已有两类学习或项目经历，可以用于初步验证岗位。' }
      : { level: '有单项证据', copy: '已有一类相关经历，但仍需要更多项目交叉验证。' };
  },

  _conflicts(p) {
    const a = [];
    if (p.story >= 65 && p.stability >= 65) a.push('你同时重视个人创作和稳定路径。导演、编剧等岗位通常项目波动更大，可优先考虑平台内容开发、企业影像或组织内创意岗位作为平衡。');
    if (p.tech >= 65 && p.stability >= 65) a.push('你对新技术有兴趣，同时希望路径稳定。建议优先选择成熟平台、虚拟制作公司或大型内容企业，而不是只依赖短期生成式项目。');
    if (p.public >= 65 && p.business >= 65) a.push('你同时看重公共价值和商业结果。纪录片品牌内容、国际传播、企业社会议题内容会比纯广告或纯新闻更适合。');
    if (p.visual >= 65 && p.organize >= 65) a.push('你兼具视觉与统筹倾向，可关注导演、创意制片、视觉导演和虚拟制作负责人，而不必局限于单一技术岗位。');
    return a;
  },

  _compute() {
    const p = this._profile();
    const ranked = this._roles().map(r => ({ role: r, score: this._scoreRole(r, p), reasons: this._reasons(r, p) }))
      .sort((a, b) => b.score - a.score);

    // 先取头部 2 个，再按「岗位族」去重扩到 9 个，保证方向多元
    const top = [], counts = {};
    for (const x of ranked.slice(0, 2)) {
      if (!top.some(y => y.role.id === x.role.id)) {
        top.push(x); const f = this._family(x.role); counts[f] = (counts[f] || 0) + 1;
      }
    }
    for (const x of ranked) {
      if (top.length >= 9) break;
      if (top.some(y => y.role.id === x.role.id)) continue;
      const f = this._family(x.role);
      if ((counts[f] || 0) >= 2) continue;
      top.push(x); counts[f] = (counts[f] || 0) + 1;
    }
    for (const x of ranked) {
      if (top.length >= 9) break;
      if (!top.some(y => y.role.id === x.role.id)) top.push(x);
    }

    // 产业方向汇总：按 top 岗位所属方向加权
    const indMap = new Map();
    top.forEach((x, i) => {
      const id = x.role.industryId;
      if (!id) return;
      const w = x.score * (9 - i) / 9;
      if (!indMap.has(id)) indMap.set(id, { id, name: x.role.industry, score: 0 });
      indMap.get(id).score += w;
    });
    const industries = [...indMap.values()].sort((a, b) => b.score - a.score);

    const dims = Object.entries(p).sort((a, b) => b[1] - a[1]);
    const name = dims.slice(0, 2).map(x => AS_DIMS[x[0]]).join(' × ');
    const stageQ = this._questions().find(x => x.id === 'stage');
    const stage = (stageQ && stageQ.options[this._ans.stage]) ? stageQ.options[this._ans.stage].t : '';

    return {
      profile: p,
      name,
      top,
      industries,
      conflicts: this._conflicts(p),
      evidence: this._evidence(),
      stage,
      date: new Date().toISOString(),
    };
  },

  /* ═══ 结果渲染 ═══ */
  _figuresHtml(r) {
    const figs = (DATA.figures && DATA.figures.figures) || [];
    if (!figs.length) return '';
    const roleText = r.top.slice(0, 7).map(x => `${x.role.title} ${x.role.intro}`).join(' ').toLowerCase();
    const ranked = figs.map(f => {
      const w = f.dimensions || {};
      let total = 0, den = 0;
      Object.entries(w).forEach(([k, n]) => { total += (r.profile[k] || 0) * Number(n || 0); den += Number(n || 0); });
      let score = den ? total / den : 0;
      (f.roleKeywords || []).forEach(k => { if (roleText.includes(String(k).toLowerCase())) score += 4; });
      const strongest = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      return { f, score, strongest };
    }).sort((a, b) => b.score - a.score);

    const picked = [], sectors = new Set();
    for (const it of ranked) {
      const sector = it.f.primarySector || (it.f.sectors && it.f.sectors[0]) || '其他';
      if (picked.length < 3 && !sectors.has(sector)) { picked.push(it); sectors.add(sector); }
    }
    for (const it of ranked) { if (picked.length >= 3) break; if (!picked.includes(it)) picked.push(it); }

    return `
      <div class="as-panel">
        <div class="as-panel__label">与你的人才模型相呼应的代表人物</div>
        <div class="as-goals">
          ${picked.slice(0, 3).map(it => `
            <article class="as-goal">
              <div class="as-goal__rank">${(it.strongest || []).map(k => AS_DIMS[k]).join(' × ')}</div>
              <div class="as-goal__title">${it.f.name}</div>
              <div class="as-goal__meta">${it.f.headline || ''}<br>${it.f.matchCopy || it.f.intro || ''}</div>
            </article>`).join('')}
        </div>
      </div>`;
  },

  renderResult() {
    const r = this._result || (this._result = this._compute());
    const stage = document.getElementById('as-stage');
    if (!stage) return;
    this._progress(this._questions().length);

    const dims = Object.entries(r.profile).sort((a, b) => b[1] - a[1]);
    const core = r.top.slice(0, 3);
    const others = r.top.slice(3, 7);

    stage.innerHTML = `
      <div class="as-result">
        <div class="as-panel">
          <div class="as-panel__label">你的职业方向画像</div>
          <div class="as-persona">
            <div class="as-persona__name">${r.name || '探索型画像'}</div>
            <p class="as-persona__desc">
              ${r.stage ? `当前阶段：${r.stage}。` : ''}结果呈现的是职业倾向，不是能力鉴定；没有正式工作经历也不会被判定为能力不足。
              你身上最难得的组合，是「${AS_DIMS[dims[0][0]]}」带来的${DIM_GIFTS[dims[0][0]]}，同时又拥有「${AS_DIMS[dims[1] ? dims[1][0] : dims[0][0]]}」所代表的${DIM_GIFTS[dims[1] ? dims[1][0] : dims[0][0]]}。
            </p>
          </div>
          <div class="as-dims">
            ${dims.map(([k, v]) => `
              <div class="as-dim">
                <div class="as-dim__name">${AS_DIMS[k]}</div>
                <div class="as-dim__track"><div class="as-dim__fill" style="width:${Math.max(0, Math.min(100, v))}%"></div></div>
                <div class="as-dim__val">${Math.max(0, Math.min(100, v))}</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="as-panel">
          <div class="as-panel__label">最匹配的产业方向</div>
          <div class="as-chips">
            ${(r.industries || []).slice(0, 4).map((ind, i) => `
              <button class="as-goal${i === 0 ? ' as-goal--primary' : ''}" style="padding:10px 14px;text-align:left;cursor:pointer"
                      onclick="Router.goToIndustry('${ind.id}')">
                <div class="as-goal__rank">${i === 0 ? '主方向' : '方向 ' + (i + 1)}</div>
                <div class="as-goal__title" style="font-size:var(--text-base);margin:4px 0 0">${ind.name}</div>
              </button>`).join('')}
          </div>
          <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-3)">
            判断强度：<strong>${(r.evidence || {}).level || '待验证'}</strong> — ${(r.evidence || {}).copy || ''}
          </p>
        </div>

        <div class="as-panel">
          <div class="as-panel__label">三个职业目标建议</div>
          <div class="as-goals">
            ${core.map((x, i) => `
              <article class="as-goal${i === 0 ? ' as-goal--primary' : ''}">
                <div class="as-goal__rank">${i === 0 ? '主目标建议' : i === 1 ? '次目标建议' : '探索目标建议'}</div>
                <div class="as-goal__title">${x.role.title}</div>
                <div class="as-goal__meta">
                  ${x.role.industry} · 匹配度 <strong style="color:var(--color-accent)">${x.score}</strong><br>
                  ${x.reasons.slice(0, 2).map(s => '· ' + s).join('<br>')}
                </div>
                <div class="as-chips" style="margin-top:var(--space-3)">
                  <button class="as-btn" style="padding:6px 12px;font-size:var(--text-xs)"
                          onclick="Search.jumpTo('job','${x.role.industryId}','${x.role.title.replace(/'/g, "\\'")}')">查看岗位详情</button>
                </div>
              </article>`).join('')}
          </div>
        </div>

        <div class="as-panel">
          <div class="as-panel__label">推荐探索方向</div>
          <div class="as-goals">
            ${others.map(x => `
              <article class="as-goal">
                <div class="as-goal__rank">推荐探索 · ${x.score}</div>
                <div class="as-goal__title" style="font-size:var(--text-base)">${x.role.title}</div>
                <div class="as-goal__meta">${x.role.industry}</div>
              </article>`).join('')}
          </div>
        </div>

        ${this._figuresHtml(r)}

        ${r.conflicts && r.conflicts.length ? `
          <div class="as-panel">
            <div class="as-panel__label">需要正视的职业取舍</div>
            ${r.conflicts.map(c => `<p style="font-size:var(--text-sm);color:var(--color-text-secondary);line-height:1.8;margin:0 0 var(--space-3)">${c}</p>`).join('')}
          </div>` : ''}

        <div class="as-actions">
          <button class="as-btn" onclick="AssessmentPage.retake()">重新测评</button>
          <button class="as-btn as-btn--primary" onclick="AssessmentPage.toPlan()">生成我的规划</button>
        </div>
        <p style="font-size:var(--text-xs);color:var(--color-text-faint);line-height:1.7">
          本测评用于职业探索与教育规划，不属于心理测量或就业承诺。结果与答题记录仅保存在当前浏览器。
        </p>
      </div>`;
  },

  /* 把测评结论写入「我的规划」的本地种子 */
  toPlan() {
    const r = this._result;
    if (!r) return;
    const topRole = (r.top[0] || {}).role || null;
    try {
      localStorage.setItem(AS_PLAN_SEED, JSON.stringify({
        // 以主目标岗位所属方向为准，保证「方向 + 岗位」在规划页中一定可匹配
        industryId: (topRole && topRole.industryId) || (r.industries[0] || {}).id || '',
        roleTitle: topRole ? topRole.title : '',
        profile: r.profile,
        name: r.name,
        date: r.date,
      }));
    } catch (e) { /* 忽略 */ }
    if (window.PlanPage && typeof PlanPage.applySeed === 'function') PlanPage.applySeed();
    Router.go('plan');
  },
};

window.AssessmentPage = AssessmentPage;
