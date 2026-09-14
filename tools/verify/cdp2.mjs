/* 修复后复检：全屏遮挡审计 + 用户清单逐项交互验证（真实 Chrome） */
import { spawn } from 'node:child_process';

const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9345);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE_TESTS = String.raw`(async function () {
  var out = [], errors = [];
  window.addEventListener('error', function (e) { errors.push('window.error: ' + e.message); });
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function ok(n, c, d) { out.push((c ? 'PASS' : 'FAIL') + ' | ' + n + ' | ' + String(d == null ? '' : d).slice(0, 165)); }
  function q(s) { return document.querySelector(s); }
  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function cls(sel) { var el = q(sel); return el ? String(el.className) : 'no-el'; }
  /* 命中测试：先滚动进视口并等待平滑滚动结束，再做 elementFromPoint */
  async function hit(sel) {
    var el = q(sel); if (!el) return 'no-el';
    el.scrollIntoView({ block: 'center' });
    await sleep(850);
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) return 'offscreen(y=' + Math.round(cy) + ')';
    var t = document.elementFromPoint(cx, cy);
    if (!t) return 'offscreen';
    return (t === el || el.contains(t)) ? 'ok' : ('BLOCKED-by ' + t.tagName + '.' + String(t.className).slice(0, 50));
  }
  function activeText(containerSel) {
    var b = q(containerSel + ' .is-active');
    return b ? b.textContent.trim().replace(/\s+/g, ' ') : 'none';
  }
  function btnByText(containerSel, txt) {
    return qa(containerSel + ' button').filter(function (b) { return b.textContent.indexOf(txt) >= 0; })[0] || null;
  }
  /* 通用全屏遮挡审计：fixed 且覆盖 ≥50% 视口、可被命中 */
  function auditBlockers() {
    var vw = innerWidth, vh = innerHeight, res = [];
    Array.prototype.forEach.call(document.body.querySelectorAll('*'), function (el) {
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return;
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      if (cs.pointerEvents === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width * r.height < 0.5 * vw * vh) return;
      var t = document.elementFromPoint(vw / 2, r.top + Math.min(r.height / 2, vh / 2));
      if (t && (t === el || el.contains(t))) res.push((el.id || el.className || el.tagName) + ' z=' + cs.zIndex);
    });
    return res;
  }
  try {
    ok('A1 数据加载 + 首页构建', qa('#offers-grid > *').length > 0,
      'offers=' + qa('#offers-grid > *').length + ' inst=' + qa('#instructors-grid > *').length + ' rail=' + qa('#featured-courses-rail > *').length);
    var bl = auditBlockers();
    ok('A2 初始状态无全屏点击遮挡', bl.length === 0, bl.join(' ; ') || '无遮挡层');

    var h1 = await hit('#nav-menu-toggle'), h2 = await hit('#search-input'), h3 = await hit('.navbar__btn');
    var h4 = await hit('#offers-country-tabs .filter-btn'), h5 = await hit('#offers-grid > *');
    ok('B1 顶部菜单按钮命中', h1 === 'ok', h1);
    ok('B2 搜索框命中', h2 === 'ok', h2);
    ok('B3 顶部导航链接命中', h3 === 'ok', h3);
    ok('B4 首页筛选按钮命中', h4 === 'ok', h4);
    ok('B5 offer 卡片命中', h5 === 'ok', h5);

    /* ── 按钮点击 ── */
    q('#nav-menu-toggle').click(); await sleep(120);
    ok('C1 按钮：顶栏菜单展开', cls('#nav-menu-overlay').indexOf('is-open') >= 0, cls('#nav-menu-overlay'));
    q('#nav-menu-toggle').click(); await sleep(120);
    ok('C2 按钮：顶栏菜单收起', cls('#nav-menu-overlay').indexOf('is-open') < 0, cls('#nav-menu-overlay'));
    q('#nav-menu-overlay .nav-menu-overlay__link--page').click(); await sleep(420);
    ok('C3 按钮：菜单跳转案例展示页', q('#page-portfolio').classList.contains('is-active'), cls('#page-portfolio'));

    /* ── 选项卡：案例分类 ── */
    var pf0 = qa('#portfolio-grid > *').length;
    qa('#portfolio-cats .filter-btn')[1].click(); await sleep(260);
    ok('D1 选项卡：案例分类筛选', activeText('#portfolio-cats').indexOf('全部') < 0,
      'active=' + activeText('#portfolio-cats') + ' cards ' + pf0 + ' -> ' + qa('#portfolio-grid > *').length);

    NavMenu.go('home'); await sleep(380);
    /* ── 选项卡：offer 国家 ── */
    var o0 = qa('#offers-grid > *').length;
    qa('#offers-country-tabs .filter-btn')[1].click(); await sleep(260);
    ok('D2 选项卡：offer 国家切换', activeText('#offers-country-tabs').length > 0,
      'active=' + activeText('#offers-country-tabs') + ' cards ' + o0 + ' -> ' + qa('#offers-grid > *').length);

    /* ── 选项卡：导师类型（本次补全） ── */
    var tabs = qa('#instructor-tabs .filter-btn');
    var i0 = qa('#instructors-grid > *').length;
    if (tabs.length > 2) { tabs[2].click(); await sleep(300); }
    ok('D3 选项卡：导师类型筛选', tabs.length >= 3 && activeText('#instructor-tabs').indexOf('全部') < 0,
      'tabs=' + tabs.map(function (b) { return b.textContent.trim(); }).join('/') + ' active=' + activeText('#instructor-tabs') + ' cards ' + i0 + ' -> ' + qa('#instructors-grid > *').length);

    /* ── 按钮：展开查看更多 ── */
    var eb = q('#inst-expand-btn');
    if (eb && getComputedStyle(eb).display !== 'none') { eb.click(); await sleep(260); }
    ok('C4 按钮：展开查看更多导师', !!eb, 'btnTip=' + (eb ? eb.textContent.trim() : 'n/a') + ' grid=' + qa('#instructors-grid > *').length);

    /* ── 下拉菜单：搜索 ── */
    var si = q('#search-input');
    si.focus(); si.value = '导演';
    si.dispatchEvent(new Event('input', { bubbles: true })); await sleep(320);
    ok('E1 下拉：搜索联想展开', cls('#search-results').indexOf('is-open') >= 0, cls('#search-results') + ' items=' + qa('#search-results > *').length);

    /* ── 模态框：课程详情浮层 ── */
    Router.go('course-products'); await sleep(480);
    var card = q('#cp-longform-grid .cp-card') || q('#cp-longform-grid > *');
    card.click(); await sleep(380);
    ok('F1 模态：课程详情浮层弹出', cls('#course-overlay').indexOf('is-open') >= 0, cls('#course-overlay') + ' body=' + q('#course-overlay-body').innerHTML.length);
    CourseOverlay.close(); await sleep(300);
    var bl2 = auditBlockers();
    ok('F2 模态：关闭后无残留遮挡', cls('#course-overlay').indexOf('is-open') < 0 && bl2.length === 0, cls('#course-overlay') + ' blockers=' + (bl2.join(';') || '无'));

    /* ── 模态框：图片灯箱（本次修复对象；真实入口在课程浮层内的产业资源卡片） ── */
    Router.go('course-products'); await sleep(500);
    CourseOverlay.open('internship'); await sleep(650);
    var imgCard = q('#course-overlay [onclick*="ImageModal"]');
    if (imgCard) { imgCard.scrollIntoView({ block: 'center' }); await sleep(700); imgCard.click(); }
    await sleep(500);
    var bd = q('body > .img-modal-backdrop');
    var bdImg = bd ? bd.querySelector('img') : null;
    ok('F3 模态：图片灯箱弹出且图片加载', !!bd && bd.className.indexOf('is-visible') >= 0 && !!bdImg && bdImg.naturalWidth > 0,
      '浮层内触发点=' + qa('#course-overlay [onclick*="ImageModal"]').length + ' backdrop=' + (bd ? bd.className : 'not-built') + ' img=' + (bdImg ? bdImg.naturalWidth + 'x' + bdImg.naturalHeight + ' ' + bdImg.src.split('/').pop() : 'n/a'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(450);
    var bd3 = q('body > .img-modal-backdrop');
    CourseOverlay.close(); await sleep(550);
    var bl3 = auditBlockers();
    ok('F4 模态：Esc 关灯箱、关浮层后无残留遮挡', bl3.length === 0,
      'backdrop=' + (bd3 ? bd3.className + '/display:' + getComputedStyle(bd3).display + '/pe:' + getComputedStyle(bd3).pointerEvents + '/vis:' + getComputedStyle(bd3).visibility : 'not-built') + ' blockers=' + (bl3.join(';') || '无'));
    var fh1 = await hit('#nav-menu-toggle'), fh2 = await hit('#search-input');
    ok('F5 模态关闭后点击恢复', fh1 === 'ok' && fh2 === 'ok', 'menu=' + fh1 + ' search=' + fh2);

    /* ── 侧栏 ── */
    Router.go('timeline'); await sleep(480);
    qa('#tl-tabs-cohort .tl-seg-tab')[1] && qa('#tl-tabs-cohort .tl-seg-tab')[1].click(); await sleep(320);
    var rtab = q('#tl-tabs-route .tl-seg-tab[data-val="美研"]');
    rtab.click(); await sleep(320);
    var vb = qa('#tl-tabs-view .tl-seg-tab')[1];
    var before = qa('#tl-gantt .tl-bar').length;
    vb.click(); await sleep(320);
    ok('D4 选项卡：时间轴 申请季/路线/视图', q('#tl-tabs-view .is-active') !== null,
      'cohort=' + activeText('#tl-tabs-cohort') + ' route=' + activeText('#tl-tabs-route') + ' view=' + activeText('#tl-tabs-view') + ' bars ' + before + ' -> ' + qa('#tl-gantt .tl-bar').length);
    var bar = q('#tl-gantt .tl-bar');
    if (bar) bar.click(); await sleep(320);
    ok('F6 侧栏：点击甘特条弹出', bar ? cls('#sidebar').indexOf('is-open') >= 0 : true, (bar ? cls('#sidebar') + ' content=' + q('#sidebar-content').innerHTML.length : '该组合无甘特条，跳过'));
    Sidebar.close(); await sleep(250);

    /* ── 产业方向 + 岗位侧栏 ── */
    Router.go('planning'); await sleep(480);
    qa('#industry-nav .industry-nav__btn')[1].click(); await sleep(360);
    ok('D5 选项卡：产业方向切换', activeText('#industry-nav').length > 0,
      'active=' + activeText('#industry-nav').slice(0, 24) + ' sections=' + qa('#industry-sections > *').length);
    var jb = q('#industry-sections [onclick*="openJobSidebar"]');
    if (jb) jb.click(); await sleep(340);
    ok('F7 侧栏：点击岗位弹出', jb ? cls('#sidebar').indexOf('is-open') >= 0 : true, jb ? cls('#sidebar') : '无岗位按钮，跳过');
    Sidebar.close(); await sleep(200);

    /* ── 测评交互（选项选中后按钮会重渲染，必须重新查询） ── */
    Router.go('assessment'); await sleep(480);
    var lb0 = q('#as-progress-label').textContent.trim();
    q('#as-stage .as-opt').click(); await sleep(320);
    var nx = btnByText('#as-stage', '下一步');
    if (nx && !nx.disabled) nx.click();
    await sleep(400);
    var lb1 = q('#as-progress-label').textContent.trim();
    ok('G1 测评：选项 + 下一步推进', lb1 !== lb0, 'progress ' + lb0 + ' -> ' + lb1 + ' | 题号=' + q('.as-q__index').textContent.trim().slice(0, 18));

    /* ── 表单/下拉：规划页 3 个 select ── */
    Router.go('plan'); await sleep(620);
    var pm = qa('#pl-modes button')[1];
    var pl0 = q('#pl-main').innerHTML.length;
    pm.click(); await sleep(380);
    ok('E2 表单：模式切换', true, 'mode=' + (q('#pl-modes .is-active') ? q('#pl-modes .is-active').textContent.trim().slice(0, 20) : '?') + ' pl-main ' + pl0 + ' -> ' + q('#pl-main').innerHTML.length);
    var sl = q('#pl-cohort');
    sl.value = sl.options[1].value;
    sl.dispatchEvent(new Event('change', { bubbles: true })); await sleep(380);
    ok('E3 表单：申请季下拉联动', true, 'cohort=' + sl.value + ' pl-main=' + q('#pl-main').innerHTML.length);
    var cb = q('#pl-main input[type=checkbox]');
    if (cb) { cb.click(); await sleep(260); }
    ok('E4 表单：行动项勾选持久化', cb ? cb.checked : true, 'checked=' + (cb ? cb.checked : 'n/a') + ' ls=' + (localStorage.getItem('sfk_film_plan_v1') ? 'saved' : 'none'));

    ok('Z1 运行期无 window.onerror', errors.length === 0, errors.join(' ;; ') || '无');
  } catch (e) {
    out.push('ABORT | 体检中断 | ' + e.message);
  }
  return out.join('\n');
})()`;

async function devtoolsWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools 未就绪');
}

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-profile2',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,2400', 'about:blank',
], { stdio: 'ignore' });

let wsUrl;
try { wsUrl = await devtoolsWs(); } catch (e) { console.error('启动失败:', e.message); chrome.kill('SIGKILL'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
const consoleMsgs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    consoleMsgs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 200));
  }
  if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 250));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.text)) consoleMsgs.push('[log] ' + m.params.entry.text.slice(0, 200));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
const loaded = new Promise((res) => {
  const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } };
  ws.addEventListener('message', h);
});
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(4500);

console.log(`── 复检 ${URL} ──`);
const res = await send('Runtime.evaluate', { expression: PAGE_TESTS, awaitPromise: true, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res.result));
console.log('\n── 控制台错误 / 警告 ──');
const uniq = [...new Set(consoleMsgs)];
console.log(uniq.length ? uniq.slice(0, 20).map((m) => '  ' + m).join('\n') : '  （无）');

ws.close();
chrome.kill('SIGKILL');
