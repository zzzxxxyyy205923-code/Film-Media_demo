/* 首页 Hero 影像几何检查 —— 看不同视口下影像容器 / 视频 / 视口是否真正对齐。
   用法：node tools/verify/hero-geometry.mjs http://127.0.0.1:8788/index.html [cdpPort] */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] || 'http://127.0.0.1:8788/index.html';
const PORT = process.argv[3] || 9337;
const OUT = 'reports/hero-video';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

async function devtoolsWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const pg = list.find((t) => t.type === 'page');
      if (pg?.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools 未就绪');
}

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/sfk-chrome-geometry', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--window-size=1920,1080', 'about:blank'],
  { stdio: 'ignore' });

const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;

await send('Runtime.enable'); await send('Page.enable');

const SIZES = [[1440,900],[1512,982],[1280,800],[1920,1080],[390,844]];
const GEO = String.raw`(function(){
  function r(el){ var b=el.getBoundingClientRect(); return [b.left,b.top,b.width,b.height]; }
  var v=document.getElementById('hero-video'); var c=v.parentElement;
  var h=document.querySelector('.hero');
  var nav=document.querySelector('.navbar');
  return JSON.stringify({
    viewport:[window.innerWidth,window.innerHeight],
    hero:r(h),
    nav:r(nav),
    container:r(c),
    video:r(v),
    intrinsic:[v.videoWidth,v.videoHeight],
    fit:getComputedStyle(v).objectFit,
    coverScale:Math.max(r(c)[2]/(v.videoWidth||1),r(c)[3]/(v.videoHeight||1))
  });
})()`;

console.log('── 不同视口下的 Hero 影像几何（单位 px）──\n');
console.log(['视口W×H','Hero位置/尺寸','导航栏高','容器位置/尺寸','video位置/尺寸','videoWidth×videoHeight','objectFit','coverScale'].join(' | '));

for (const [w,h] of SIZES) {
  const loaded = new Promise((res) => { const hfn = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', hfn); res(); } }; ws.addEventListener('message', hfn); });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(2500);
  const g = JSON.parse(await evalIn(GEO));
  const fmt = (a) => (a || []).map((n) => Math.round(n)).join(',');
  console.log(`${w}×${h} | ${fmt(g.hero)} | ${Math.round(g.nav[3])} | ${fmt(g.container)} | ${fmt(g.video)} | ${g.intrinsic[0]}×${g.intrinsic[1]} | ${g.fit} | ${g.coverScale.toFixed(3)}`);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (shot.result?.data) writeFileSync(`${OUT}/hero-geometry-${w}x${h}.png`, Buffer.from(shot.result?.data, 'base64'));
}
ws.close(); chrome.kill('SIGKILL');
