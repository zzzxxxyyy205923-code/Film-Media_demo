#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADAPT DATA — 把「SFK 影视传媒就业网站」业务数据迁移为 IST_demo 站点使用的数据结构。

输入：待适配项目 data/*.json（影视传媒科系数据）
输出：film-media-site/data/*.json（IST_demo schema）

设计原则：
  1. 内容 100% 来自待适配项目，不新增杜撰事实；
  2. 结构 100% 对齐 IST_demo（careers / programs / taxonomy / school_priority /
     timeline / instructors / resources / offers / offers_featured / portfolio /
     courses_* ），保证参考项目的组件与评分引擎可原样复用；
  3. 能被 IST_demo 的 ProgramScorer 直接消费（primary_tags / secondary_tags /
     industry_tags / prestige_score / country）。
"""

import json
import os
import re
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = os.path.join(SITE, 'data')

def _resolve_src():
    """定位源项目 data/ 目录（含 sfk-film-resources.json）。

    迁移后本项目可能被放在任意位置，故按以下顺序探测：
      1. 环境变量 SFK_SRC_DATA；
      2. 站点同级 / 上级目录的 data/；
      3. 上级目录下任一子项目里的 data/。
    """
    env = os.environ.get('SFK_SRC_DATA')
    if env:
        return env
    root = os.path.dirname(SITE)
    up = os.path.dirname(root)
    cands = [os.path.join(root, 'data'), os.path.join(up, 'data')]
    if os.path.isdir(up):
        for name in sorted(os.listdir(up)):
            cands.append(os.path.join(up, name, 'data'))
    for cand in cands:
        if os.path.isfile(os.path.join(cand, 'sfk-film-resources.json')):
            return cand
    return cands[0]

SRC = _resolve_src()

# 图片资源根目录：站点实际存放位置为 assets/img/（源数据里写的是
# assets/sfk-film-resources/，其中 professors/ 在站点侧已更名为 instructors/）
IMG_BASE = 'assets/img/'

def img_path(raw):
    """把源数据图片路径映射为站点实际路径。"""
    p = (raw or '').replace('assets/sfk-film-resources/', IMG_BASE)
    return p.replace(IMG_BASE + 'professors/', IMG_BASE + 'instructors/')

def load(name):
    with open(os.path.join(SRC, name + '.json'), encoding='utf-8') as f:
        return json.load(f)

def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    print('  → data/%-26s %s' % (name + '.json', len(obj) if hasattr(obj, '__len__') else ''))

def clean(text):
    """去掉源数据里的 markdown 反引号标记"""
    if not isinstance(text, str):
        return text
    return re.sub(r'`', '', text).strip()

def first_sentence(text, limit=120):
    t = clean(text or '')
    if len(t) <= limit:
        return t
    return t[:limit].rstrip('，。,.') + '…'

def strip_code_blocks(text):
    return re.sub(r'`+', '', text or '')

# ────────────────────────────────────────────────────────────────
# 1. 产业方向定义（key 与源数据 career-content.industries[].key 一一对应）
#    颜色 / 图标 / 学术分支为适配层新增的展示元数据
# ────────────────────────────────────────────────────────────────
INDUSTRIES = OrderedDict([
    ('film_tv', dict(icon='🎬', color='film',
                     acad='影视制作与项目', acad_en='Film Production & Projects',
                     scope='电影、剧集、短剧与纪录片的内容开发、制作与宣发')),
    ('digital_platform', dict(icon='📱', color='platform',
                     acad='媒体与内容平台', acad_en='Media & Content Platforms',
                     scope='长视频、短视频、直播与内容平台的运营、增长与商业化')),
    ('advertising_brand', dict(icon='📣', color='brand',
                     acad='品牌与创意传播', acad_en='Brand & Creative Communication',
                     scope='广告创意、品牌策略、整合营销与商业内容')),
    ('entertainment', dict(icon='🎭', color='culture',
                     acad='艺术与演艺', acad_en='Arts & Performing Arts',
                     scope='演艺制作、艺人经纪、音乐与舞台内容')),
    ('media_program', dict(icon='📺', color='media',
                     acad='新闻与节目制作', acad_en='Journalism & Programme Production',
                     scope='新闻传媒、电视节目、纪录片、播客与数据新闻')),
    ('corporate_pr', dict(icon='🤝', color='pr',
                     acad='企业传播与公共关系', acad_en='Corporate Communication & PR',
                     scope='企业传播、公共关系、危机沟通与品牌声誉管理')),
    ('rights_ip', dict(icon='📚', color='ip',
                     acad='出版、版权与IP开发', acad_en='Publishing, Rights & IP',
                     scope='出版编辑、版权运营、IP 孵化与跨媒介改编开发')),
    ('ai_filmtech', dict(icon='✨', color='ai',
                     acad='AI影视科技', acad_en='AI Film & Media Technology',
                     scope='AI 生成影像、虚拟制作、视效动画与数字人技术')),
])

# ────────────────────────────────────────────────────────────────
# 2. 主题词典 —— 与 assets/js/components.js 中 ProgramScorer.TOPICS 保持一致
#    （同一套关键词同时用于 JS 打分与 Python 预计算 industry_tags）
# ────────────────────────────────────────────────────────────────
TOPICS = OrderedDict([
    ('story',          ['screenwriting', 'script', 'story', 'narrative', 'dramaturgy', 'writing for', 'creative writing',
                        '编剧', '剧本', '故事', '剧作', '叙事', '写作']),
    ('directing',      ['directing', 'director', 'film production', 'filmmaking', 'film and television',
                        'motion picture', 'film &', 'film,', '导演', '影视制作', '电影制作', '短片', '影视']),
    ('producing',      ['producing', 'production management', 'producer', 'film business', '制片', '统筹', '影视管理']),
    ('cinematography', ['cinematography', 'cinematographer', 'camera', 'lighting', '摄影', '灯光', '摄制', '影像制作']),
    ('editing',        ['editing', 'editor', 'post-production', 'postproduction', '剪辑', '后期']),
    ('sound',          ['sound design', 'sound', 'audio', 'music technology', '录音', '声音', '音乐', '作曲']),
    ('documentary',    ['documentary', 'nonfiction', 'factual', '纪录片', '纪实', '非虚构']),
    ('animation',      ['animation', 'animated', 'stop motion', 'stop-motion', '动画']),
    ('vfx',            ['visual effects', 'vfx', 'compositing', 'digital effects', '特效', '视效', '合成']),
    ('xr',             ['virtual production', 'xr', 'vr ', 'vr,', ' ar ', 'immersive', 'interactive media',
                        'virtual reality', 'augmented', '虚拟制作', '沉浸', '交互媒体', '虚拟现实', '增强现实']),
    ('game',           ['game', 'esports', '游戏', '电竞']),
    ('ai',             ['artificial intelligence', 'generative', 'machine learning', 'computational', ' ai', 'ai ',
                        'ai-', 'gpt', '智能', '人工智能', '生成式', '算法']),
    ('platform',       ['media management', 'content strategy', 'platform', 'streaming', 'digital media',
                        'content creation', 'broadcast', '短视频', '直播', '内容运营', '平台', '数字媒体', '广播电视',
                        '媒体管理', '电视频道']),
    ('journalism',     ['journalism', 'journalistic', 'news', 'communication studies', 'media studies', 'reporter',
                        '新闻', '传播', '记者', '媒体研究', '国际传播']),
    ('brand',          ['advertising', 'brand', 'marketing', 'creative strategy', 'communication design',
                        'creative industries', '广告', '品牌', '营销', '创意产业', '商业创意', '创意管理']),
    ('pr',             ['public relations', 'strategic communication', 'corporate communication', 'crisis',
                        'reputation', '公关', '公共关系', '企业传播', '舆情', '危机']),
    ('publishing',     ['publishing', 'editorial', '出版', '编辑出版', '数字出版', '出版学']),
    ('rights_ip',      ['copyright', 'intellectual property', 'rights', 'licensing', ' ip', 'ip ', '版权',
                        '知识产权', '授权', 'ip运营', 'ip开发', 'ip 开发']),
    ('arts',           ['fine art', 'performing arts', 'theatre', 'theater', 'drama', 'curation', 'curatorial',
                        'art history', 'dance', '艺术', '表演', '戏剧', '剧场', '策展', '舞蹈', '演艺', '表演艺术']),
    ('management',     ['management', 'administration', 'arts management', 'cultural management', 'curating',
                        '管理', '文化管理', '艺术管理', '文化产业']),
    ('photography',    ['photography', 'photographic', '写真', '图片摄影', '影像艺术']),
    ('visual_comm',    ['visual communication', 'graphic design', 'illustration', 'visual design',
                        '视觉传达', '平面设计', '视觉设计', '插画']),
    ('screen_studies', ['film studies', 'cinema studies', 'screen studies', 'film and media', 'media and communication',
                        '影视研究', '电影研究', '文化研究', '电影学']),
    ('tech',           ['technology', 'engineering', 'technical', 'software', 'digital arts', 'media technology',
                        '数字媒体技术', '影视技术', '技术', '工程', '数字艺术']),
])

TOPIC_ZH = {
    'story': '编剧与叙事', 'directing': '导演与制作', 'producing': '制片与统筹', 'cinematography': '摄影与灯光',
    'editing': '剪辑与后期', 'sound': '声音与音乐', 'documentary': '纪录片与非虚构', 'animation': '动画',
    'vfx': '视效与合成', 'xr': '虚拟制作与沉浸媒体', 'game': '游戏与互动娱乐', 'ai': 'AI 与智能创作',
    'platform': '平台与内容运营', 'journalism': '新闻与传播', 'brand': '广告与品牌', 'pr': '公共关系与企业传播',
    'publishing': '出版与编辑', 'rights_ip': '版权与 IP', 'arts': '艺术与演艺', 'management': '管理与策划',
    'photography': '摄影与写真', 'visual_comm': '视觉传达', 'screen_studies': '影视与媒体研究', 'tech': '影视技术与工程',
}

# 主题 → 产业方向（一个主题可归属多个产业）
TOPIC_INDS = {
    'story': ['film_tv'], 'directing': ['film_tv'], 'producing': ['film_tv'], 'cinematography': ['film_tv'],
    'editing': ['film_tv', 'digital_platform', 'media_program'], 'sound': ['film_tv', 'entertainment'],
    'documentary': ['film_tv', 'media_program'], 'animation': ['ai_filmtech', 'digital_platform'],
    'vfx': ['ai_filmtech', 'film_tv'], 'xr': ['ai_filmtech'], 'game': ['ai_filmtech', 'digital_platform'],
    'ai': ['ai_filmtech', 'digital_platform', 'advertising_brand'],
    'platform': ['digital_platform', 'media_program'],
    'journalism': ['media_program', 'corporate_pr'],
    'brand': ['advertising_brand', 'corporate_pr'],
    'pr': ['corporate_pr'],
    'publishing': ['rights_ip'], 'rights_ip': ['rights_ip'],
    'arts': ['entertainment'], 'management': ['entertainment', 'rights_ip'],
    'photography': ['advertising_brand', 'entertainment'],
    'visual_comm': ['advertising_brand'],
    'screen_studies': ['rights_ip', 'media_program'],
    'tech': ['ai_filmtech'],
}

# ProgramScorer.IND_TOPICS 的 Python 镜像
IND_TOPICS = {
    'film_tv':          ['story', 'directing', 'producing', 'cinematography', 'editing', 'documentary', 'vfx'],
    'digital_platform': ['platform', 'editing', 'animation', 'ai', 'game'],
    'advertising_brand': ['brand', 'visual_comm', 'photography', 'ai', 'management'],
    'entertainment':    ['arts', 'management', 'sound', 'photography'],
    'media_program':    ['journalism', 'documentary', 'editing', 'platform', 'sound', 'screen_studies'],
    'corporate_pr':     ['pr', 'journalism', 'brand', 'management'],
    'rights_ip':        ['rights_ip', 'publishing', 'management', 'screen_studies'],
    'ai_filmtech':      ['ai', 'xr', 'vfx', 'animation', 'game', 'tech'],
}

def extract_topics(text):
    t = (text or '').lower()
    found = []
    for topic, kws in TOPICS.items():
        if any(kw in t for kw in kws):
            found.append(topic)
    return found


def rank_topics(primary_text, secondary_text, limit=3):
    """加权主题排序：专业名（权重 2）优先于院校类型/标签（权重 1），
    避免「院校整体偏影视」把每一条专业都判定成同一产业方向。"""
    scores = {}
    for t in extract_topics(primary_text):
        scores[t] = scores.get(t, 0) + 2
    for t in extract_topics(secondary_text):
        scores[t] = scores.get(t, 0) + 1
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1], list(TOPICS).index(kv[0])))
    return [t for t, _ in ordered[:limit]]

# ────────────────────────────────────────────────────────────────
# 3. 国家 / 地区映射（对齐 IST_demo 的 4 个国家组）
# ────────────────────────────────────────────────────────────────
COUNTRY_CODE = {'美国': 'US', '英国': 'UK', '香港': 'HK', '澳门': 'MO', '日本': 'JP',
                '韩国': 'KR', '澳洲': 'AU', '加拿大': 'CA', '新西兰': 'NZ'}
COUNTRY_GROUPS = {'US': ['US'], 'UK': ['UK'], 'HK_SG': ['HK', 'MO'], 'OTHER': ['JP', 'KR', 'AU', 'CA', 'NZ']}
GROUP_LABELS = {'US': '🇺🇸 美国', 'UK': '🇬🇧 英国', 'HK_SG': '🇭🇰 港澳', 'OTHER': '🌏 其他'}

# ────────────────────────────────────────────────────────────────
# 4. 岗位英文名映射（源数据只有中文岗位名）
# ────────────────────────────────────────────────────────────────
ROLE_EN = {
    '编剧 / 剧本策划开发': 'Screenwriter / Script Development',
    '内容开发（平台侧）': 'Content Development (Platform Side)',
    '制片助理 -> 制片人': 'Producer',
    '导演助理 -> 导演': 'Director',
    '广告导演 / Commercial Director': 'Commercial Director',
    '短视频编导 / Short-form Video Director': 'Short-form Video Director',
    '短剧编剧 / 制片': 'Short Drama Writer / Producer',
    'AI辅助开发分析师': 'AI-assisted Development Analyst',
    '虚拟制作协调师 / VP Coordinator': 'Virtual Production Coordinator',
    'AI影视导演 / AIGC Director': 'AIGC Director',
    '数字人编导': 'Digital Human Content Director',
    '艺人经纪 / Talent Manager': 'Talent Manager',
    '艺人宣传 / Artist Publicist': 'Artist Publicist',
    '演出制作人 / Live Producer': 'Live Producer',
    '演唱会创意总监 / Concert Creative Director': 'Concert Creative Director',
    '虚拟偶像内容运营': 'Virtual Idol Content Operations',
    '娱乐IP世界观设计师': 'Entertainment IP Worldbuilding Designer',
    'MV导演 / Music Video Director': 'Music Video Director',
    '数字资产与虚拟形象经纪': 'Digital Asset & Virtual Talent Agent',
    'AI实时视觉导演': 'AI Real-time Visual Director',
    '平台内容运营 / Content Operations': 'Content Operations',
    '直播策划与导播 / Live Content Producer': 'Live Content Producer',
    '影视宣发策划': 'Film Marketing & Distribution Planner',
    '品牌策略师 / Brand Strategist': 'Brand Strategist',
    '广告创意（文案 / 美术）→ 创意总监': 'Creative Director (Copy / Art)',
    'IP运营与商业化负责人': 'IP Operations & Commercialisation Lead',
    'AI数字人主播运营': 'AI Virtual Anchor Operations',
    '动态创意优化师 / DCO': 'Dynamic Creative Optimisation Specialist',
    '节目策划 / 节目编剧': 'Programme Planner / Writer',
    '综艺执行导演': 'Variety Show Directing Producer',
    '视频记者 / 调查记者': 'Video Journalist / Investigative Reporter',
    '纪录片导演 / 制片': 'Documentary Director / Producer',
    '播客制作人': 'Podcast Producer',
    '数据新闻与可视化': 'Data Journalism & Visualisation',
    'AI事实核查与内容核验': 'AI Fact-checking & Content Verification',
    '智能剪辑与融媒体制作': 'Smart Editing & Converged Media Production',
    '品牌公关 / 企业传播经理': 'Brand PR / Corporate Communication Manager',
    '媒体关系专员': 'Media Relations Specialist',
    '危机公关顾问': 'Crisis Communication Consultant',
    '国际传播专员': 'International Communication Specialist',
    '战略传播总监 / CCO': 'Strategic Communication Director / CCO',
    '舆情监测与分析': 'Public Opinion Monitoring & Analysis',
    '生成式公关内容创作': 'Generative PR Content Creation',
    '影视化选题与IP开发': 'Screen-ready IP Development',
    '版权经理 / Rights Manager': 'Rights Manager',
    'IP改编策划': 'IP Adaptation Planner',
    '故事开发顾问': 'Story Development Consultant',
    'AI IP价值评估师': 'AI IP Valuation Analyst',
    'AI内容版权与合规顾问': 'AI Content Rights & Compliance Consultant',
    '影视发行与版权运营': 'Film Distribution & Rights Operations',
    '电影衍生品与活动开发': 'Film Merchandise & Event Development',
    '后期制片 / Post Producer': 'Post Producer',
    '剪辑师 / Film Editor': 'Film Editor',
    '创作者运营 / Creator Operations': 'Creator Operations',
    '达人 / MCN运营': 'Influencer / MCN Operations',
    '内容商业化运营 / Content Monetization': 'Content Monetization Operations',
    '客户执行 / Account Executive': 'Account Executive',
    '社交内容与整合营销策划': 'Social Content & IMC Planner',
    '商业广告制片 / Commercial Producer': 'Commercial Producer',
    '品牌活动与体验策划': 'Brand Event & Experience Planner',
    'AI广告创意 / Generative Creative': 'AI Advertising Creative / Generative Creative',
}

OS_STAGES = {
    'us': '美国', 'uk': '英国', 'au': '澳洲', 'hk': '香港', 'kr': '韩国', 'jp': '日本',
}


def main():
    print('▌读取待适配项目数据：%s' % SRC)
    content = load('career-content')
    schools = load('schools')
    programs = load('programs')
    cases = load('cases')
    film = load('sfk-film-resources')
    learning = load('learning-resources')
    internship = load('internship-resources')
    career_planning = load('career-planning')
    figures = load('industry-figures')
    assessment = load('assessment')
    role_recruit = load('role-recruitment') if os.path.exists(os.path.join(SRC, 'role-recruitment.json')) else None

    school_by_id = {s['id']: s for s in schools}
    school_by_key = {}
    for s in schools:
        for k in (s.get('cn'), s.get('cnShort'), s.get('en'), s.get('enShort')):
            if k:
                school_by_key.setdefault(k, s)

    # ── 公司层级索引（A/B/C 类） ──────────────────────────────
    tier_of_company = {}
    for t in content.get('companyTiers', []):
        for ex in t.get('examples', []):
            tier_of_company.setdefault(ex, t['level'])
    # 源数据里有若干“组合式”公司名（用「、」「，」分隔），拆开登记
    for t in content.get('companyTiers', []):
        for ex in t.get('examples', []):
            for part in re.split(r'[、,，/]', ex):
                part = part.strip()
                if part:
                    tier_of_company.setdefault(part, t['level'])

    # ── 岗位工具提示（career-planning.rolePools） ─────────────
    role_pools = career_planning.get('rolePools', [])

    def tools_for(role):
        text = role['title'] + ' ' + (role.get('workFocus') or '') + ' ' + (role.get('intro') or '')
        hits = []
        for pool in role_pools:
            try:
                if re.search(pool['match'], role['title']):
                    hits.extend(pool.get('tools', []))
            except re.error:
                continue
        return list(OrderedDict.fromkeys(hits))

    # ════════════════════════════════════════════════════════
    # industries.json
    # ════════════════════════════════════════════════════════
    print('▌生成 industries / taxonomy')
    industries_out = []
    taxonomy_out = OrderedDict()
    for ind in content['industries']:
        key = ind['key']
        meta = INDUSTRIES[key]
        name = ind['name']
        roles = [r for r in content['roles'] if r['industry'] == name]
        companies = content.get('companyLibrary', {}).get(name, [])
        subfields = [c['name'] if isinstance(c, dict) else c for c in companies][:8]

        industries_out.append(OrderedDict([
            ('id', key), ('key', key), ('name', name), ('num', name), ('icon', meta['icon']),
            ('color', meta['color']),
            ('acad', meta['acad']), ('acadEn', meta['acad_en']), ('scope', meta['scope']),
            ('roleCount', len(roles)),
            ('observation', ind.get('observation', '')),
            ('coreLogic', ind.get('coreLogic', '')),
            ('aiImpact', ind.get('aiImpact', '')),
            ('audience', ind.get('audience', '')),
            ('subfields', subfields),
        ]))

        # 核心就业方向 = 该产业下的岗位名（去掉“A -> B”的晋升写法，保留起始名）
        legacy = []
        for r in roles:
            t = re.split(r'\s*->\s*', r['title'])[0].strip()
            if t not in legacy:
                legacy.append(t)
        new_dirs = [re.split(r'\s*->\s*', r['title'])[0].strip() for r in roles if r.get('isAiTrack')]
        tools = []
        for r in roles:
            tools.extend(tools_for(r))
        tools = list(OrderedDict.fromkeys(tools))[:6]
        if not tools:
            tools = ['Premiere Pro / DaVinci Resolve：剪辑与调色',
                     'ChatGPT／Claude：内容研究与方案梳理',
                     'Midjourney／即梦：视觉参考与分镜生成']

        taxonomy_out[key] = OrderedDict([
            ('academic_branch', meta['acad']),
            ('academic_branch_en', meta['acad_en']),
            ('industry_id', key),
            ('legacy_subdirections', legacy[:8]),
            ('new_subdirections', list(OrderedDict.fromkeys(new_dirs))),
            ('industry_subfields', subfields or [r['title'] for r in roles][:6]),
            ('program_tags_hint', [TOPIC_ZH[t] for t in IND_TOPICS[key]]),
            ('tools_hint', tools),
            ('job_clusters', [{'name': r['title'], 'en': ROLE_EN.get(r['title'], ''),
                               'note': first_sentence(r.get('workFocus') or r.get('intro'), 90)} for r in roles]),
        ])

    dump('industries', industries_out)
    dump('taxonomy', taxonomy_out)

    # ════════════════════════════════════════════════════════
    # careers.json —— 岗位库（一个岗位 × 一家公司 = 一条记录，对齐 IST 结构）
    # ════════════════════════════════════════════════════════
    print('▌生成 careers（岗位库）')
    careers = []
    for r in content['roles']:
        comps = r.get('allCompanies') or r.get('goodCompanies') or []
        top = set(r.get('topCompanies') or [])
        legacy_dir = re.split(r'\s*->\s*', r['title'])[0].strip()
        title_en = ROLE_EN.get(r['title'], '')
        school_match_list = []
        for grp in (r.get('specialPrograms') or []) + (r.get('relatedPrograms') or []):
            label = OS_STAGES.get(grp.get('code'), grp.get('label', ''))
            for p in (grp.get('programs') or []):
                school_match_list.append('%s：%s' % (label, clean(p)))
        tools = tools_for(r)
        for i, comp in enumerate(comps):
            tier = tier_of_company.get(comp) or ('A类' if comp in top else 'B类')
            careers.append(OrderedDict([
                ('id', '%s-%s' % (r['id'], i + 1)),
                ('role_id', r['id']),
                ('industry', r['industry']),
                ('industry_id', next((k for k, v in INDUSTRIES.items()
                                      if v['acad'] and k in [x['id'] for x in industries_out] and
                                      [x for x in industries_out if x['id'] == k][0]['name'] == r['industry']), 'film_tv')),
                ('sub_domain', (r.get('workFocus') or '').split('、')[0].strip()),
                ('tier', tier),
                ('company', comp),
                ('department', r['industry']),
                ('job_title_zh', r['title']),
                ('job_title_en', title_en),
                ('direction_zh', legacy_dir),
                ('direction_en', title_en),
                ('responsibilities', clean(r.get('intro') or r.get('workFocus') or '')),
                ('work_focus', clean(r.get('workFocus') or '')),
                ('talent_summary', clean(r.get('jobRequirement') or '')),
                ('education', clean(r.get('degreeRequirement') or '')),
                ('background', clean(r.get('note') or '')),
                ('research_skills', clean(r.get('workFocus') or '')),
                ('tools', '；'.join(tools)),
                ('career_path', clean(r.get('path') or '')),
                ('language', ''),
                ('salary_usd', ''),
                ('school_match', ' ｜ '.join(school_match_list[:8])),
                ('is_ai_track', bool(r.get('isAiTrack'))),
            ]))

    # industry_id 修正（用 key 直接映射，避免上面的复杂推导）
    name_to_key = {i['name']: i['id'] for i in industries_out}
    for c in careers:
        c['industry_id'] = name_to_key.get(c['industry'], 'film_tv')

    dump('careers', careers)

    # ════════════════════════════════════════════════════════
    # programs.json —— 院校 × 专业，供 ProgramScorer 打分
    # ════════════════════════════════════════════════════════
    print('▌生成 programs（院校 × 专业）')
    programs_out = []
    for p in programs:
        s = school_by_id.get(p.get('schoolId')) or {}
        country = COUNTRY_CODE.get(s.get('country', ''), 'US')
        details = p.get('details') or {}
        req = s.get('requirements') or {}

        name_text = (p.get('name') or '') + ' ' + (s.get('program') or '')
        cat_text = (s.get('category') or '') + ' ' + ' '.join(s.get('tags') or [])
        pos_topics = extract_topics(name_text)
        sup_topics = [t for t in extract_topics(cat_text) if t not in pos_topics]
        all_topics = pos_topics + sup_topics

        ranked = rank_topics(name_text, cat_text, limit=3)
        inds = []
        for t in ranked:
            for k in TOPIC_INDS.get(t, []):
                if k not in inds:
                    inds.append(k)
        if not inds:
            inds = ['film_tv']
        # 产业方向补充：专业名里出现的关键词优先，其次才是院校类型
        cat = s.get('category') or ''
        if also := [k for t in pos_topics for k in TOPIC_INDS.get(t, [])]:
            for k in also:
                if k not in inds:
                    inds.append(k)
        if '传媒' in cat and 'media_program' not in inds:
            inds.append('media_program')
        if ('AI' in cat or '技术' in cat) and 'ai_filmtech' not in inds:
            inds.append('ai_filmtech')

        portfolio = details.get('portfolio') or req.get('portfolio') or ''
        if isinstance(portfolio, list):
            portfolio = ' '.join(strip_code_blocks(x) for x in portfolio)

        url = ''
        if s.get('url'):
            url = s['url'][0] if isinstance(s['url'], list) else s['url']
        elif details.get('links'):
            url = details['links'][0]

        programs_out.append(OrderedDict([
            ('id', p.get('id')),
            ('country', country),
            ('country_group', next(g for g, cl in COUNTRY_GROUPS.items() if country in cl)),
            ('school_zh', s.get('cn') or p.get('schoolCn') or ''),
            ('school_en', s.get('en') or p.get('schoolCn') or ''),
            ('school_short', s.get('cnShort') or s.get('enShort') or ''),
            ('school_college', s.get('category') or ''),
            ('school_city', s.get('city') or ''),
            ('school_region', s.get('region') or ''),
            ('program_name_en', p.get('name') or ''),
            ('program_name_zh', s.get('program') or ''),
            ('degree_type', p.get('degree') or ''),
            ('level', p.get('level') or ''),
            ('duration', s.get('duration') or ''),
            ('fee', s.get('fee') or ''),
            ('ai_level', s.get('aiLevel') or ''),
            ('scope_tier', s.get('scopeTier') or ''),
            ('gpa_requirement', clean(req.get('gpa') or '')),
            ('language_scores', clean(req.get('language') or '')),
            ('deadline', clean(details.get('deadline') or req.get('deadline') or '')),
            ('audience', clean(details.get('audience') or '')),
            ('background_note', clean(details.get('academics') or '')),
            ('portfolio_required', bool(portfolio)),
            ('portfolio_note', portfolio[:600]),
            ('caution', clean(details.get('caution') or s.get('notes') or '')),
            ('school_intro', s.get('philosophy') or ''),
            ('school_ai', s.get('aiTraining') or ''),
            ('school_advantages', s.get('advantages') or ''),
            ('school_positioning', s.get('positioning') or ''),
            ('school_ranking', s.get('ranking') or ''),
            ('school_tags', s.get('tags') or []),
            ('school_faculty', s.get('faculty') or []),
            ('school_alumni', s.get('alumni') or []),
            ('sfk_total', s.get('sfkTotal') or 0),
            ('has_sfk_data', bool(s.get('hasSfkData'))),
            ('source', p.get('source') or ''),
            ('program_url', url or ''),
            ('industry_tags', inds),
            ('primary_tags', pos_topics),
            ('secondary_tags', [t for t in sup_topics if t not in pos_topics]),
            ('keyword_tags', all_topics),
            ('prestige_score', s.get('industryScore') or 55),
            ('industry_rank', s.get('industryRank') or 0),
        ]))

    dump('programs', programs_out)

    # ════════════════════════════════════════════════════════
    # school_priority.json —— 国家分组的院校优先列表
    # ════════════════════════════════════════════════════════
    print('▌生成 school_priority（国家分组院校）')
    groups = {g: [] for g in COUNTRY_GROUPS}
    for s in sorted(schools, key=lambda x: -(x.get('industryScore') or 0)):
        code = COUNTRY_CODE.get(s.get('country', ''))
        g = next((k for k, cl in COUNTRY_GROUPS.items() if code in cl), 'OTHER')
        groups[g].append(OrderedDict([
            ('school_en', s.get('en') or ''),
            ('school_zh', s.get('cn') or ''),
            ('school_short', s.get('cnShort') or ''),
            ('country', code),
            ('industry_score', s.get('industryScore') or 0),
            ('category', s.get('category') or ''),
        ]))
    school_priority = OrderedDict([(g, groups[g]) for g in COUNTRY_GROUPS])
    school_priority['_meta'] = OrderedDict([
        ('sidebar_job_max_per_group', 3),
        ('sidebar_job_one_per_school', True),
        ('sidebar_company_total', 5),
        ('sidebar_company_one_per_school', True),
        ('country_groups', COUNTRY_GROUPS),
        ('group_labels', GROUP_LABELS),
    ])
    dump('school_priority', school_priority)

    # ════════════════════════════════════════════════════════
    # school_recs.json —— 课程产品内的「院校与专业推荐」（按 8 大产业方向）
    #    优先推荐 美/英/港澳 方向（来源数据里的主申请目的地），
    #    其余（日/韩/澳/加/新）作为「同类可选」补充
    # ════════════════════════════════════════════════════════
    print('▌生成 school_recs（院校与专业推荐）')
    MAIN_GROUPS = ('US', 'UK', 'HK_SG')
    school_recs = []
    for idx in industries_out:
        ind_id = idx['id']
        rows = [p for p in programs_out if ind_id in p['industry_tags']]
        rows.sort(key=lambda x: (-(x['prestige_score'] or 0), x['industry_rank'] or 0))
        picked, seen_s, main, other = [], set(), [], []
        for r in rows:
            if r['school_zh'] in seen_s:
                continue
            seen_s.add(r['school_zh'])
            item = OrderedDict([
                ('schoolCn', r['school_zh']), ('schoolEn', r['school_en']),
                ('program', (r['program_name_en'] or '')[:56] + ('（%s）' % r['degree_type'] if r['degree_type'] else '')),
                ('note', first_sentence(r['school_intro'] or r['school_advantages'] or
                                        (r['background_note'] or ''), 150)),
            ])
            (main if r['country_group'] in MAIN_GROUPS else other).append(item)
        featured = main[:3] or other[:3]
        more = [('%s · %s' % (x['schoolCn'], (x['program'] or '')[:52])) for x in (main[3:] + other)[:5]]
        school_recs.append(OrderedDict([
            ('key', idx['color']), ('nameCn', idx['acad']), ('nameEn', idx['acadEn']),
            ('industryId', ind_id),
            ('featured', featured),
            ('more', more),
        ]))
    dump('school_recs', school_recs)

    # ════════════════════════════════════════════════════════
    # instructors.json —— 导师团队（海外教授 / 行业导师）
    # ════════════════════════════════════════════════════════
    print('▌生成 instructors（导师团队）')
    cat_labels = film.get('categoryLabels', {})
    instructors = []
    for i, pr in enumerate(film.get('professors', []), 1):
        instructors.append(OrderedDict([
            ('id', pr.get('id') or 'prof-%s' % i),
            ('name', pr.get('name') or ''),
            ('pseudonym', (pr.get('name') or '?')[:1]),
            ('role', '海外教授'),
            ('tag', 'overseas'),
            ('tag_cls', 'tag-purple'),
            ('school', pr.get('school') or ''),
            ('title', pr.get('title') or ''),
            ('academic_branch', cat_labels.get(pr.get('category'), '') or '影视与传媒'),
            ('city', '海外'),
            ('is_research', False),
            ('photo', img_path(pr.get('image'))),
        ]))
    for i, it in enumerate(film.get('industry', []), 1):
        instructors.append(OrderedDict([
            ('id', it.get('id') or 'ind-%s' % i),
            ('name', it.get('name') or ''),
            ('pseudonym', (it.get('name') or '?')[:1]),
            ('role', '行业导师'),
            ('tag', 'industry'),
            ('tag_cls', 'tag-blue'),
            ('school', 'SFK 行业资源'),
            ('title', cat_labels.get(it.get('category'), '') or '行业资源'),
            ('academic_branch', cat_labels.get(it.get('category'), '') or '影视与传媒'),
            ('city', ''),
            ('is_research', False),
            ('photo', img_path(it.get('image'))),
        ]))
    dump('instructors', instructors)

    # ════════════════════════════════════════════════════════
    # resources.json —— 资源网络（合作企业 / 机构）
    # ════════════════════════════════════════════════════════
    print('▌生成 resources（资源网络）')
    resources = []
    seen = set()
    for ind in content['industries']:
        for c in content.get('companyLibrary', {}).get(ind['name'], []):
            nm = c['name'] if isinstance(c, dict) else c
            desc = c.get('description', '') if isinstance(c, dict) else ''
            if nm in seen:
                continue
            seen.add(nm)
            resources.append(OrderedDict([
                ('nameEn', nm), ('nameCn', desc[:40] or ind['name']),
                ('logo', ''), ('group', ind['name']), ('initial', nm[:1]),
            ]))
    for other in ('内容行业', '演艺与经纪', '互联网与平台', '传媒行业', '公关与企业传播', '出版与版权'):
        for c in content.get('companyLibrary', {}).get(other, []):
            nm = c['name'] if isinstance(c, dict) else c
            desc = c.get('description', '') if isinstance(c, dict) else ''
            if nm in seen:
                continue
            seen.add(nm)
            resources.append(OrderedDict([
                ('nameEn', nm), ('nameCn', desc[:40] or other),
                ('logo', ''), ('group', other), ('initial', nm[:1]),
            ]))
    dump('resources', resources)

    # ════════════════════════════════════════════════════════
    # offers.json / offers_featured.json —— offer 战绩（来自录取案例）
    # ════════════════════════════════════════════════════════
    print('▌生成 offers / offers_featured')
    counter = Counter()
    programs_by_school = {}
    for p in programs_out:
        programs_by_school.setdefault(p['school_zh'], []).append(p['program_name_en'])
    for cs in cases:
        for nm in cs.get('schools', []):
            s = school_by_key.get(nm)
            key = (s.get('cn') if s else nm, s.get('en') if s else nm)
            counter[key] += 1
    offers_schools = []
    for (zh, en), n in counter.most_common():
        s = school_by_key.get(zh) or school_by_key.get(en) or {}
        code = COUNTRY_CODE.get(s.get('country', ''), '')
        offers_schools.append(OrderedDict([
            ('school_zh', zh), ('school_en', en), ('country', s.get('country') or ''),
            ('country_group', next((g for g, cl in COUNTRY_GROUPS.items() if code in cl), 'OTHER')),
            ('offer_count', n),
        ]))
    dump('offers', OrderedDict([
        ('season', '%s – %s' % (min(cs.get('fall', '') for cs in cases if cs.get('fall')),
                               max(cs.get('fall', '') for cs in cases if cs.get('fall')))),
        ('total_offers', sum(counter.values())),
        ('case_count', len(cases)),
        ('schools', offers_schools),
    ]))

    featured = OrderedDict([('season', 'SFK 影视传媒录取战绩'),
                           ('group_labels', GROUP_LABELS),
                           ('groups', OrderedDict())])
    have = {g: [o for o in offers_schools if o['country_group'] == g] for g in COUNTRY_GROUPS}
    for g in COUNTRY_GROUPS:
        picks = []
        seen_s = set()
        for o in have[g]:
            if o['school_zh'] in seen_s:
                continue
            seen_s.add(o['school_zh'])
            picks.append(OrderedDict([('school_zh', o['school_zh']), ('school_en', o['school_en']),
                                      ('offer_count', o['offer_count'])]))
        # 用该国家组内的高分院校补齐到 12 所，保证 offer 墙信息密度
        for s in school_priority[g]:
            if len(picks) >= 12:
                break
            if s['school_zh'] in seen_s:
                continue
            seen_s.add(s['school_zh'])
            picks.append(OrderedDict([('school_zh', s['school_zh']), ('school_en', s['school_en']),
                                      ('offer_count', 0)]))
        featured['groups'][g] = picks
    dump('offers_featured', featured)

    # ════════════════════════════════════════════════════════
    # portfolio.json —— 案例展示（录取案例）
    # ════════════════════════════════════════════════════════
    print('▌生成 portfolio（案例展示）')
    portfolio = []
    for i, cs in enumerate(cases, 1):
        sch_names = cs.get('schools') or []
        primary = sch_names[0] if sch_names else ''
        ps = school_by_key.get(primary) or {}
        topics = extract_topics((cs.get('apply_major') or '') + ' ' + (ps.get('category') or '') + ' ' +
                               ' '.join(ps.get('tags') or []))
        inds = list(OrderedDict.fromkeys([k for t in topics for k in TOPIC_INDS.get(t, [])])) or ['film_tv']
        ind_id = inds[0]
        meta = INDUSTRIES[ind_id]
        portfolio.append(OrderedDict([
            ('id', 'case-%03d' % i),
            ('industry_label', dict((x['id'], x['name']) for x in industries_out)[ind_id]),
            ('academic_branch', meta['acad']),
            ('academic_branch_en', meta['acad_en']),
            ('industry_id', ind_id),
            ('primary_school', primary),
            ('primary_school_en', ps.get('en') or ''),
            ('primary_program', cs.get('apply_major') or ps.get('program') or ''),
            ('other_schools', sch_names[1:]),
            ('tags', [TOPIC_ZH[t] for t in topics][:4] or [meta['acad']]),
            ('image', ''),
            ('student', cs.get('displayName') or cs.get('name') or ''),
            ('bg_school', cs.get('bg_school') or ''),
            ('scores', cs.get('scores') or {}),
            ('intern', cs.get('intern') or ''),
            ('works', cs.get('works') or ''),
            ('awards', cs.get('awards') or ''),
            ('strategy', cs.get('strategy') or ''),
            ('fall', cs.get('fall') or ''),
        ]))
    dump('portfolio', portfolio)

    # ════════════════════════════════════════════════════════
    # timeline.json —— 升学 / 求职时间轴（申请季 × 国家路线）
    # ════════════════════════════════════════════════════════
    print('▌生成 timeline（升学时间轴）')
    CATS = [('关键节点', 'milestone'), ('专业成长', 'summer'), ('求职准备', 'internship')]
    bars = []
    tracks = []
    for tl in content['timelines']:
        rows = tl['rows']
        # 月份锚点：把 "2026.06-2026.07" 这类区间换算成 1..12 的相对刻度
        months = []
        for r in rows:
            m = re.findall(r'(\d{4})[.\-/](\d{1,2})', r.get('period') or '')
            if m:
                months.append(int(m[0][0]) * 12 + int(m[0][1]))
                months.append(int(m[1][0]) * 12 + int(m[1][1]) if len(m) > 1 else int(m[0][0]) * 12 + int(m[0][1]))
        anchor = min(months) if months else 0
        span = (max(months) - anchor + 1) if months else 12
        scale = 12.0 / span if span > 12 else 1.0
        for r in rows:
            m = re.findall(r'(\d{4})[.\-/](\d{1,2})', r.get('period') or '')
            if m:
                s_abs = int(m[0][0]) * 12 + int(m[0][1])
                e_abs = int(m[1][0]) * 12 + int(m[1][1]) if len(m) > 1 else s_abs
                year = str(m[0][0])
            else:
                s_abs = e_abs = anchor
                year = ''
            start = int(round((s_abs - anchor) * scale)) + 1
            end = int(round((e_abs - anchor) * scale)) + 1
            start = max(1, min(12, start))
            end = max(start, min(12, end))
            tags = r.get('tags') or []
            stage = r.get('stage') or ''
            # 分类规则（与页面图例一致）：
            #   关键节点 —— 带 apply 标签的申请/递交/出愿等硬性节点
            #   专业成长 —— 积累、深化、训练、在读、入学衔接等能力建设阶段
            #   求职准备 —— 其余以投递、面试、入职收口为主的阶段
            if 'apply' in tags:
                cat = '关键节点'
            elif any(k in stage for k in ('积累', '深化', '训练', '在读', '入学衔接',
                                          '第一学年', '第二学年', '暑期实习', '细分方向')):
                cat = '专业成长'
            else:
                cat = '求职准备'
            bars.append(OrderedDict([
                ('track', '%s|%s' % (tl['cohort'], tl['route'])),
                ('year', year),
                ('category', cat),
                ('type', dict(CATS)[cat]),
                ('label', r.get('stage') or ''),
                ('start', start), ('end', end),
                ('period', r.get('period') or ''),
                ('portfolio', r.get('portfolio') or ''),
                ('ai', r.get('ai') or ''),
                ('action', r.get('action') or ''),
                ('output', r.get('output') or ''),
                ('tags', tags),
                ('cohort', tl['cohort']), ('route', tl['route']),
            ]))
        tracks.append(OrderedDict([
            ('id', '%s|%s' % (tl['cohort'], tl['route'])),
            ('cohort', tl['cohort']), ('route', tl['route']),
            ('windowLabel', tl.get('windowLabel') or ''),
            ('firstWindow', tl.get('firstWindow') or ''),
            ('lead', tl.get('lead') or ''),
            ('note', tl.get('note') or ''),
        ]))
    dump('timeline', OrderedDict([
        ('cats', [{'name': c, 'type': t} for c, t in CATS]),
        ('cohorts', list(OrderedDict.fromkeys(t['cohort'] for t in content['timelines']))),
        ('routes', list(OrderedDict.fromkeys(t['route'] for t in content['timelines']))),
        ('views', [{'id': 'all', 'label': '全部'}, {'id': 'apply', 'label': '留学申请'},
                   {'id': 'job', 'label': '求职准备'}]),
        ('tracks', tracks),
        ('bars', bars),
    ]))

    # ════════════════════════════════════════════════════════
    # courses_academic.json / courses_industry.json —— 课程产品目录
    # ════════════════════════════════════════════════════════
    print('▌生成 courses_academic / courses_industry')
    film_courses = film.get('courses', [])
    poster_by_kw = [
        (['AI商业实践', 'AI 商业实践', 'AI影视商业'], 'assets/img/courses/course-commercial-ai-video-2026.jpg'),
        (['AI电影', 'AI 电影'], 'assets/img/courses/course-hku-together-ai-film-winter-2027.jpg'),
        (['夏校', '冬校', '拍摄'], 'assets/img/courses/course-winter-short-filmmaking-2027.jpg'),
    ]

    def poster_for(name):
        for kws, path in poster_by_kw:
            if any(k in name for k in kws):
                return path
        return ''

    academic = []
    for r in learning.get('resources', []):
        seasons = r.get('season') or []
        t = r.get('type') or ''
        if '大师课' in t:
            tab = 'masterclass'
        elif 'AI' in t and ('商业实践' in t or '实践' in t):
            tab = 'bizpractice'
        elif 'winter' in seasons:
            tab = 'summer'
        elif 'summer' in seasons:
            tab = 'summer'
        else:
            tab = 'masterclass'
        academic.append(OrderedDict([
            ('tab', tab),
            ('program_type', t),
            ('category', '海外院校课程'),
            ('role_or_course', r.get('name') or ''),
            ('suitable_for', '｜'.join(r.get('tracks') or []) or '影视传媒方向'),
            ('location', '海外院校'),
            ('level', '本科 / 研究生'),
            ('season', '／'.join(seasons)),
            ('outcomes', '、'.join(r.get('outputs') or [])),
            ('description', r.get('description') or ''),
            ('status', r.get('status') or ''),
            ('poster', poster_for(r.get('name') or '')),
            ('university', (r.get('name') or '').split('电影')[0][:12]),
            ('professor', ''),
        ]))

    industry_courses = []
    for c in film_courses:
        grp = c.get('group') or ''
        if '商业实践' in grp:
            tab = 'bizpractice'
        elif '冬校' in grp or '夏校' in grp:
            tab = 'summer'
        else:
            tab = 'masterclass'
        industry_courses.append(OrderedDict([
            ('tab', tab), ('program_type', grp), ('category', 'SFK 影视课程'),
            ('company', c.get('name') or ''), ('role_or_course', c.get('name') or ''),
            ('suitable_for', '影视传媒方向'), ('location', '线上 / 海外'), ('level', '本科 / 研究生'),
            ('poster', img_path(c.get('image'))),
            ('duration', ''), ('price_rmb', ''), ('schedule', ''),
            ('enrollment_status', '滚动招募'), ('description', ''),
        ]))
    for it in film.get('industry', []):
        industry_courses.append(OrderedDict([
            ('tab', 'industry_class'), ('program_type', '行业资源'),
            ('category', cat_labels.get(it.get('category'), '行业资源')),
            ('company', it.get('name') or ''), ('role_or_course', '行业项目资源'),
            ('suitable_for', '影视传媒方向'), ('location', ''), ('level', ''),
            ('poster', img_path(it.get('image'))),
            ('duration', ''), ('price_rmb', ''), ('schedule', ''),
            ('enrollment_status', 'SFK 资源库'), ('description', ''),
        ]))
    for k, v in (internship.get('resources') or {}).items():
        industry_courses.append(OrderedDict([
            ('tab', 'internship'), ('program_type', v.get('type') or '岗位实习'),
            ('category', '头部平台' if v.get('isTopPlatform') else '行业名企'),
            ('company', v.get('name') or ''), ('role_or_course', v.get('type') or '岗位实习'),
            ('suitable_for', '影视传媒方向'),
            ('location', '／'.join(v.get('locations') or []) or '以顾问确认为准'),
            ('level', ''), ('duration', v.get('duration') or ''),
            ('work_mode', v.get('workMode') or ''),
            ('availability', v.get('availability') or ''),
            ('is_top_platform', bool(v.get('isTopPlatform'))), ('is_ai', bool(v.get('isAi'))),
            ('poster', ''), ('price_rmb', ''), ('schedule', ''),
            ('enrollment_status', '名额以顾问确认为准'), ('description', v.get('internalNote') or ''),
        ]))
    dump('courses_academic', academic)
    dump('courses_industry', industry_courses)

    # ════════════════════════════════════════════════════════
    # 直接透传的业务数据（测评 / 代表人物 / 职业规划 / 实习资源 / 案例）
    # ════════════════════════════════════════════════════════
    print('▌透传测评 / 代表人物 / 规划 / 案例数据')
    dump('assessment', assessment)
    dump('figures', figures)
    dump('career_planning', career_planning)
    dump('internship_resources', internship)
    dump('cases', [
        OrderedDict([('id', 'case-%03d' % (i + 1))] + list(cs.items()))
        for i, cs in enumerate(cases)
    ])
    dump('role_recruitment', role_recruit or {})
    dump('film_resources', OrderedDict([
        ('categoryLabels', cat_labels),
        ('professorCount', len(film.get('professors', []))),
        ('industryCount', len(film.get('industry', []))),
        ('courseCount', len(film_courses)),
    ]))
    dump('meta', OrderedDict([
        ('brand', 'SFK 影视传媒科系'),
        ('brand_en', 'SFK Film, Media & Communication'),
        ('built_from', 'SFK影视传媒就业网站_第三十七阶段_移除AI精简版'),
        ('framework', 'IST_demo'),
        ('counts', OrderedDict([
            ('industries', len(industries_out)),
            ('roles', len(content['roles'])),
            ('careers', len(careers)),
            ('schools', len(schools)),
            ('programs', len(programs_out)),
            ('cases', len(cases)),
            ('instructors', len(instructors)),
            ('resources', len(resources)),
            ('timelineBars', len(bars)),
            ('coursesAcademic', len(academic)),
            ('coursesIndustry', len(industry_courses)),
        ])),
    ]))
    print('\n✅ 数据适配完成')


if __name__ == '__main__':
    main()
