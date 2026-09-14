/* 光标审计：确认自定义光标（comet）已彻底移除，且全站元素均为系统原生光标 */
import { spawn } from 'node:child_process';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9368);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 注入到文档加载前：记录任何鼠标跟随类监听器 */
const HOOK = `(function () {
  window.__mouseListeners = [];
  var orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (/^(pointermove|mousemove|pointerrawupdate)$/i.test(type)) {
      var t = (this && this.tagName) ? this.tagName + (this.className ? '.' + String(this.className).slice(0, 44) : '') : String(this).slice(0, 44);
      window.__mouseListeners.push(type + ' -> ' + t);
    }
    return orig.apply(this, arguments);
  };
})();`;

const EXPR = String.raw`(async function () {
  var out = [];
  var slp = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var qa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function push(s) { out.push(s); }

  var pages = ['home', 'portfolio', 'planning', 'timeline', 'course-products', 'assessment', 'plan'];

  /* 1. 残留结构：自定义光标画布 */
  var cometEls = qa('.hero__comet, [class*="comet"]');
  push((cometEls.length === 0 ? 'PASS' : 'FAIL') + ' | 自定义光标画布已从 DOM 移除 | .hero__comet 数量=' + cometEls.length);

  /* 2. 运行时：无任何指针跟随监听器 */
  var ml = window.__mouseListeners || [];
  push((ml.length === 0 ? 'PASS' : 'FAIL') + ' | 无指针跟随事件监听 | ' + (ml.join(' ; ') || 'pointermove/mousemove 监听数=0'));

  /* 3~4. 逐页审计：cursor 取值是否全为系统原生值 */
  var CUSTOM = /(none|url\()/;                    // 隐藏原生 / 图片自定义光标
  var NATIVE = ['auto', 'default', 'pointer', 'text', 'move', 'grab', 'grabbing', 'not-allowed', 'help',
    'wait', 'progress', 'crosshair', 'zoom-in', 'zoom-out', 'cell', 'vertical-text', 'alias', 'copy',
    'context-menu', 'no-drop', 'all-scroll', 'col-resize', 'row-resize', 'n-resize', 'e-resize', 's-resize', 'w-resize'];
  var customHits = [], nonNative = [], dist = [], clickableAuto = [];
  for (var i = 0; i < pages.length; i++) {
    if (pages[i] !== 'home') { Router.go(pages[i]); await slp(580); }
    var els = qa('body *'), seen = {};
    for (var j = 0; j < els.length; j++) {
      var el = els[j], cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var cv = cs.cursor;
      seen[cv.split(' ')[0]] = (seen[cv.split(' ')[0]] || 0) + 1;
      if (CUSTOM.test(cv)) customHits.push('[' + pages[i] + '] ' + el.tagName + '.' + String(el.className).slice(0, 36) + '=' + cv);
      else if (NATIVE.indexOf(cv.split(' ')[0]) < 0) nonNative.push('[' + pages[i] + '] ' + cv);
      /* 可点击但不是系统 pointer 手型的元素（信息项，非缺陷） */
      if (el.hasAttribute('onclick') && !/^(pointer)$/.test(cv) && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
        clickableAuto.push(pages[i] + ':' + el.tagName + '.' + String(el.className).slice(0, 30) + '=' + cv);
      }
    }
    dist.push(pages[i] + ' {' + Object.keys(seen).sort().join(',') + '}');
  }
  push((customHits.length === 0 ? 'PASS' : 'FAIL') + ' | 全站无 cursor:none / url(...) 自定义或隐藏光标 | ' + (customHits.slice(0, 5).join(' ; ') || '7 页共 0 处'));
  push((nonNative.length === 0 ? 'PASS' : 'FAIL') + ' | 全站 cursor 取值均为系统原生值 | ' + (nonNative.slice(0, 5).join(' ; ') || '无非原生取值'));
  push('INFO | 各页 cursor 取值集合 | ' + dist.join('  '));
  push('INFO | 可点击但显示默认箭头(非手型)的非 button/a 元素 | ' + (clickableAuto.length ? clickableAuto.slice(0, 8).join(' ; ') + (clickableAuto.length > 8 ? ' …共' + clickableAuto.length + '个' : '') : '无'));

  /* 5. 非交互区域 = 系统默认箭头 */
  Router.go('home'); await slp(620);
  var body = getComputedStyle(document.body).cursor;
  var heroTitle = document.querySelector('.hero__title');
  var ht = heroTitle ? getComputedStyle(heroTitle).cursor : 'n/a';
  var section = document.querySelector('.home-section') || document.querySelector('.hero');
  var st = section ? getComputedStyle(section).cursor : 'n/a';
  push((/^(auto|default)$/.test(body) && /^(auto|default)$/.test(ht) && /^(auto|default)$/.test(st) ? 'PASS' : 'FAIL') +
    ' | 正文 / hero 标题 / 内容区为系统默认箭头 | body=' + body + ' hero__title=' + ht + ' section=' + st);

  /* 6. 关键交互区域仍为系统标准 pointer 手型 */
  var checks = [['顶部菜单按钮', '#nav-menu-toggle'], ['导航链接', '.navbar__btn'], ['搜索输入框', '#search-input'],
    ['国家筛选按钮', '#offers-country-tabs .filter-btn'], ['导师选项卡', '#instructor-tabs .filter-btn'], ['筛选按钮组', '#offers-country-tabs .filter-btn']];
  var fails = [];
  for (var k = 0; k < checks.length; k++) {
    var e2 = document.querySelector(checks[k][1]);
    var want = checks[k][0] === '搜索输入框' ? 'text' : 'pointer';
    if (!e2) { fails.push(checks[k][0] + '=缺失'); continue; }
    var v2 = getComputedStyle(e2).cursor;
    if (v2 !== want) fails.push(checks[k][0] + '=' + v2 + '(期望' + want + ')');
  }
  push((fails.length === 0 ? 'PASS' : 'FAIL') + ' | 关键交互区域使用系统标准光标 | ' + (fails.join(' ; ') || '6 项全部符合 button=pointer / input=text'));

  /* 7. hero 内移动指针不再触发任何绘制 */
  var hero = document.querySelector('.hero');
  var heroCanvas = hero ? hero.querySelectorAll('canvas').length : -1;
  var before = (window.__mouseListeners || []).length;
  if (hero) {
    var r = hero.getBoundingClientRect();
    for (var m = 0; m < 8; m++) {
      hero.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 80 + m * 50, clientY: r.top + 140 }));
      await slp(55);
    }
  }
  push((heroCanvas === 0 && (window.__mouseListeners || []).length === before ? 'PASS' : 'FAIL') +
    ' | hero 无画布、移动后无绘制且无新监听 | hero canvas=' + heroCanvas + ' 新增监听=' + ((window.__mouseListeners || []).length - before));

  /* 8. hero 其它装饰未被误删 + 交互仍正常 */
  var deco = ['.hero__scan', '.hero__hud', '.hero__posters', '.hero__logomark'].filter(function (s) { return !!document.querySelector(s); });
  push((deco.length === 4 ? 'PASS' : 'FAIL') + ' | hero 其它装饰元素保留 | ' + deco.join(' '));
  var navBtn = document.querySelector('#nav-menu-toggle');
  var rr = navBtn.getBoundingClientRect();
  var t = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
  push((t === navBtn || navBtn.contains(t) ? 'PASS' : 'FAIL') + ' | 顶栏仍可点击（光标改动未影响命中） | ' + (t === navBtn ? 'ok' : String(t && t.className)));
  return out.join('\n');
})()`;

async function devtoolsWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const pg = list.find((t) => t.type === 'page');
      if (pg?.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools 未就绪');
}
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-probe5', '--no-first-run', '--disable-gpu', '--window-size=1440,2000', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(4200);
const r = await send('Runtime.evaluate', { expression: EXPR, awaitPromise: true, returnByValue: true });
console.log(r.result?.result?.value ?? JSON.stringify(r.result));
console.log('\n── 运行时异常 ──\n' + (errors.length ? errors.slice(0, 4).join('\n') : '无'));
ws.close(); chrome.kill('SIGKILL');
