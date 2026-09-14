/* ═══════════════════════════════════════════
   DATA LOADER — SFK 影视传媒科系
   沿用 IST_demo 的单一 DATA 入口：
     1) 一次性并发拉取 data/*.json
     2) 通过 Proxy 暴露 DATA.<name>（无需解构）
     3) load() 后把少数跨模块共享的派生数据挂到 window
   Usage: await DATA.load(); 然后 DATA.careers / DATA.programs …
═══════════════════════════════════════════ */
const DATA = (() => {
  const cache = {};
  const BASE = './data/';

  const FILES = [
    'meta',
    'industries',        /* 8 大影视传媒产业方向 */
    'taxonomy',          /* 产业方向 → 学术分支 / 方向 / 企业子领域 / 工具 */
    'careers',           /* 岗位库（岗位 × 公司，含招聘门槛与能力要求） */
    'programs',          /* 院校 × 专业（含 industry_tags，供 ProgramScorer 打分） */
    'school_priority',   /* 国家分组的院校优先列表 */
    'school_recs',       /* 课程产品内的院校与专业推荐 */
    'instructors',       /* 导师团队（海外教授 / 行业导师） */
    'resources',         /* 资源网络（合作企业与机构） */
    'offers',            /* offer 战绩汇总 */
    'offers_featured',   /* offer 展示按国家分组的 offer 墙 */
    'portfolio',         /* 案例展示（录取案例） */
    'timeline',          /* 升学 / 求职时间轴（申请季 × 国家路线） */
    'courses_academic',  /* 海外院校课程 */
    'courses_industry',  /* 行业课程 / 实习 / 行业资源 */
    'assessment',        /* 职业测评题库（来源项目原样迁移） */
    'figures',           /* 代表人物与维度标签 */
    'career_planning',   /* 职业规划岗位池与原则 */
    'internship_resources', /* 实习资源库 */
    'cases',             /* 录取案例原始明细 */
    'role_recruitment',  /* 岗位招聘画像 */
    'film_resources'     /* 影视资源索引统计 */
  ];

  async function load() {
    const results = await Promise.all(FILES.map(async name => {
      const res = await fetch(BASE + name + '.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('[DATA] 加载失败：data/' + name + '.json (' + res.status + ')');
      return [name, await res.json()];
    }));
    results.forEach(([name, json]) => { cache[name] = json; });

    /* ── 跨模块共享：国家分组标签 / 院校推荐 ── */
    window.SFK_GROUP_LABELS = (cache.school_priority && cache.school_priority._meta
      && cache.school_priority._meta.group_labels) || {};
    window.SCHOOL_RECS = cache.school_recs || [];
    /* 8 大产业方向 → 中文学术分支名，供 ProgramScorer / 案例筛选复用 */
    window.IND_ACAD = {};
    (cache.industries || []).forEach(i => { window.IND_ACAD[i.id] = i.acad; });
    console.info('[DATA] 已加载 %d 个数据文件', FILES.length);
    return cache;
  }

  /* Proxy：DATA.careers → cache.careers */
  return new Proxy({ load }, {
    get(target, prop) {
      if (prop === 'load') return target.load;
      if (prop === 'files') return FILES.slice();
      return cache[prop];
    }
  });
})();
