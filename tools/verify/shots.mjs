/* 视觉截图：把 7 个页面与 2 个浮层的关键画面存到 reports/vi-screens/
   用法: node shots.mjs <url> [port]                                                       */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9374);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../reports/vi-screens');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtoolsWs() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find((t) => t.type === 'page'); if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await sleep(250);
  }
  throw new Error('DevTools 未就绪');
}
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-shots', '--no-first-run', '--disable-gpu', '--force-device-scale-factor=1', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(3800);

const shots = [
  ['01-首页-Hero（深色舞台）', `(function(){window.scrollTo(0,0);return 1;})()`],
  ['02-首页-产业方向与offer网格', `(function(){var e=document.querySelector('.offers-grid')||document.querySelector('.industry-section'); e.scrollIntoView({block:'start'}); return 1;})()`],
  ['03-案例展示', `(function(){Router.go('portfolio'); return 1;})()`],
  ['04-留学规划', `(function(){Router.go('planning'); return 1;})()`],
  ['05-时间轴', `(function(){Router.go('timeline'); return 1;})()`],
  ['06-课程产品', `(function(){Router.go('course-products'); return 1;})()`],
  ['07-能力测评', `(function(){Router.go('assessment'); return 1;})()`],
  ['08-我的规划', `(function(){Router.go('plan'); return 1;})()`],
  ['09-课程详情浮层（深色舞台）', `(function(){CourseOverlay.open(Object.keys(window.PRODUCTS)[0]);return 1;})()`, 1500],
  ['10-导航浮层（深色舞台）', `(function(){CourseOverlay.close();NavMenu.open();return 1;})()`, 1200],
];
for (const [name, expr, extra] of shots) {
  await evalIn(expr);
  await sleep((extra || 900) + 1500);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); console.log('已保存 ' + name + '.png'); }
  else console.log('失败 ' + name);
}
ws.close(); chrome.kill('SIGKILL');
