import { spawn } from 'node:child_process';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9361);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPR = String.raw`(async function () {
  var out = [];
  var slp = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  async function hitTest(sel) {
    var el = q(sel);
    if (!el) return 'FAIL | no-el';
    el.scrollIntoView({ block: 'center' });
    await slp(900);
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (r.width === 0 || r.height === 0) return 'FAIL | zero-size';
    var t = document.elementFromPoint(cx, cy);
    if (!t) return 'FAIL | offscreen(y=' + Math.round(cy) + ')';
    return (t === el || el.contains(t)) ? 'PASS | ok' : 'FAIL | BLOCKED-by ' + t.tagName + '.' + String(t.className).slice(0, 40);
  }
  async function check(name, sel) { var r = await hitTest(sel); out.push(r.split(' | ')[0] + ' | ' + name + ' | ' + r.split(' | ')[1]); }

  await check('首页 offer 国家选项卡', '#offers-country-tabs .filter-btn');
  await check('首页 offer 卡片', '#offers-grid > *');
  await check('首页 导师选项卡', '#instructor-tabs .filter-btn');
  await check('首页 导师卡片', '#instructors-grid > *');

  /* 用真实鼠标事件点击（而非 .click()），验证事件链完整 */
  var tab = q('#offers-country-tabs .filter-btn:nth-child(2)');
  tab.scrollIntoView({ block: 'center' }); await slp(800);
  var r = tab.getBoundingClientRect();
  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  var target = document.elementFromPoint(cx, cy);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
  await slp(400);
  out.push((q('#offers-country-tabs .is-active') && q('#offers-country-tabs .is-active').textContent.trim() === tab.textContent.trim() ? 'PASS' : 'FAIL') + ' | 首页 offer 选项卡（真实鼠标事件命中后触发） | active=' + (q('#offers-country-tabs .is-active') || {}).textContent + ' cards=' + qa('#offers-grid > *').length);

  /* 测评全流程：6 题逐题作答并推进 */
  Router.go('assessment'); await slp(600);
  var steps = [];
  for (var i = 0; i < 7; i++) {
    var idx = q('.as-q__index');
    if (!idx) break;
    var opt = q('#as-stage .as-opt');
    if (opt) { opt.click(); await slp(260); }
    var nx = qa('#as-stage button').filter(function (b) { return b.textContent.trim() === '下一步'; })[0];
    steps.push('Q' + (i + 1) + ' label=' + q('#as-progress-label').textContent.trim() + ' next=' + (nx ? (nx.disabled ? 'disabled' : 'enabled') : 'none'));
    if (!nx || nx.disabled) break;
    nx.click(); await slp(420);
  }
  out.push((steps.length >= 3 ? 'PASS' : 'FAIL') + ' | 测评页 逐题推进 | ' + steps.join(' ; '));
  out.push(((q('#as-stage').textContent.indexOf('测评结果') >= 0 || q('#as-stage').textContent.indexOf('结果') >= 0) ? 'PASS' : 'FAIL') + ' | 测评页 完成出结果 | stageLen=' + q('#as-stage').innerHTML.length + ' head=' + q('#as-stage').textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
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
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-probe3', '--no-first-run', '--disable-gpu', '--window-size=1440,2000', 'about:blank'], { stdio: 'ignore' });
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
