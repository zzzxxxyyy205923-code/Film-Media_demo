/* 图片灯箱（ImageModal）真实用户路径验证 + 全站触发点分布统计 */
import { spawn } from 'node:child_process';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9367);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPR = String.raw`(async function () {
  var out = [];
  var slp = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function push(s) { out.push(s); }
  function auditBlockers() {
    var vw = innerWidth, vh = innerHeight, res = [];
    Array.prototype.forEach.call(document.body.querySelectorAll('*'), function (el) {
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || cs.pointerEvents === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width * r.height < 0.5 * vw * vh) return;
      var t = document.elementFromPoint(vw / 2, r.top + Math.min(r.height / 2, vh / 2));
      if (t && (t === el || el.contains(t))) res.push((el.id || el.className) + ' z=' + cs.zIndex);
    });
    return res;
  }

  /* 1. 全站 ImageModal 触发点分布 */
  var pages = ['portfolio', 'planning', 'timeline', 'course-products', 'assessment', 'plan'];
  var dist = ['首页 ' + qa('#page-home [onclick*="ImageModal"]').length];
  for (var i = 0; i < pages.length; i++) {
    Router.go(pages[i]); await slp(430);
    dist.push(pages[i] + ' ' + qa('[onclick*="ImageModal"]').length);
  }
  push('INFO | 各页灯箱触发点 | ' + dist.join(' / '));
  var all = qa('[onclick*="ImageModal"]');
  push((all.length > 0 ? 'PASS' : 'FAIL') + ' | 灯箱触发点存在 | 全站可见 ' + all.length + ' 个，样例 onclick=' + (all[0] ? all[0].getAttribute('onclick').slice(0, 70) : 'n/a'));

  /* 2. 真实路径：课程浮层内的卡片 → 灯箱 → 点击空白关闭 */
  NavMenu.go('home'); await slp(400);
  CourseOverlay.open('internship'); await slp(600);
  var card = q('#course-overlay [onclick*="ImageModal"], [onclick*="ImageModal"]');
  push((card ? 'PASS' : 'FAIL') + ' | 灯箱入口位于课程浮层内 | overlay=' + String(q('#course-overlay').className) + ' 触发点 ' + qa('#course-overlay [onclick*="ImageModal"]').length + ' 个');
  if (card) {
    card.scrollIntoView({ block: 'center' }); await slp(700);
    var r = card.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var t = document.elementFromPoint(cx, cy);
    push((t && (t === card || card.contains(t)) ? 'PASS' : 'FAIL') + ' | 卡片命中（真实鼠标事件） | ' + (t ? (t === card || card.contains(t) ? 'ok' : 'BLOCKED-by ' + t.tagName + '.' + String(t.className).slice(0, 36)) : 'null'));
    (t || card).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
    await slp(500);
    var bd = q('body > .img-modal-backdrop');
    var img = bd ? bd.querySelector('img') : null;
    push((bd && bd.className.indexOf('is-visible') >= 0 && img && img.naturalWidth > 0 ? 'PASS' : 'FAIL') + ' | 灯箱弹出且图片加载成功 | ' +
      (bd ? bd.className + ' display=' + getComputedStyle(bd).display + ' vis=' + getComputedStyle(bd).visibility + ' img=' + (img ? (img.naturalWidth + 'x' + img.naturalHeight + ' ' + img.src.split('/').pop()) : 'no-img') : 'backdrop 未创建'));
    /* 关闭按钮 */
    var closeBtn = bd ? bd.querySelector('.img-modal-close') : null;
    if (closeBtn) {
      var cb = closeBtn.getBoundingClientRect();
      var ct = document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2);
      push((ct === closeBtn ? 'PASS' : 'FAIL') + ' | 关闭按钮可命中 | ' + (ct ? ct.tagName + '.' + String(ct.className).slice(0, 36) : 'null'));
      (ct || closeBtn).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cb.left + cb.width / 2, clientY: cb.top + cb.height / 2 }));
      await slp(600);
      var bd2 = q('body > .img-modal-backdrop');
      push((bd2 && bd2.className.indexOf('is-visible') < 0 ? 'PASS' : 'FAIL') + ' | 点击关闭按钮 → 灯箱关闭 | class=' + (bd2 ? bd2.className : 'gone') + ' display=' + (bd2 ? getComputedStyle(bd2).display : '-'));
    }
    /* 再次打开 → 点击边缘空白关闭（无干扰命中） */
    (t || card).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
    await slp(500);
    var bd3 = q('body > .img-modal-backdrop');
    if (bd3) {
      var et = document.elementFromPoint(6, 6);
      push((et === bd3 ? 'PASS' : 'FAIL') + ' | 灯箱空白区可命中背景层 | 点(6,6)命中 ' + (et ? et.tagName + '.' + String(et.className).slice(0, 36) : 'null'));
      bd3.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 6, clientY: 6 }));
      await slp(600);
    }
    var bd4 = q('body > .img-modal-backdrop');
    push((!bd4 || bd4.className.indexOf('is-visible') < 0 ? 'PASS' : 'FAIL') + ' | 点击空白 → 灯箱关闭 | class=' + (bd4 ? bd4.className : 'gone'));
    /* 灯箱关闭后：课程浮层仍应保持打开且内部可点击 */
    function hitOf(sel) {
      var el = q(sel); if (!el) return 'no-el';
      var rr = el.getBoundingClientRect();
      var tt = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
      return (tt && (tt === el || el.contains(tt))) ? 'ok' : ('BLOCKED-by ' + (tt ? tt.tagName + '.' + String(tt.className).slice(0, 34) : 'null'));
    }
    push((q('#course-overlay').classList.contains('is-open') ? 'PASS' : 'FAIL') + ' | 灯箱关闭后课程浮层未受影响 | overlay=' + q('#course-overlay').className);
    push((hitOf('#course-overlay .img-modal-trigger, #course-overlay [onclick*="ImageModal"]') === 'ok' ? 'PASS' : 'FAIL') + ' | 灯箱关闭后浮层内卡片恢复可点击 | ' + hitOf('#course-overlay [onclick*="ImageModal"]'));
    /* 再关掉课程浮层，确认整页恢复 */
    CourseOverlay.close(); await slp(500);
    var bl = auditBlockers();
    push((bl.length === 0 ? 'PASS' : 'FAIL') + ' | 浮层也关闭后无全屏遮挡残留 | ' + (bl.join(';') || '无'));
    push((hitOf('#nav-menu-toggle') === 'ok' ? 'PASS' : 'FAIL') + ' | 浮层也关闭后页面恢复可点击 | 菜单按钮 ' + hitOf('#nav-menu-toggle'));
  }
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
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-probe4', '--no-first-run', '--disable-gpu', '--window-size=1440,2000', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(4200);
const r = await send('Runtime.evaluate', { expression: EXPR, awaitPromise: true, returnByValue: true });
console.log(r.result?.result?.value ?? JSON.stringify(r.result));
ws.close(); chrome.kill('SIGKILL');
