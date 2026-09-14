/* 首页 Hero 影像验证 —— 换片后「呈现行为是否与原片完全一致」。
   用法：node tools/verify/hero-video.mjs http://127.0.0.1:8788/index.html [cdpPort]
   检查项：资源可达 / 呈现属性（autoplay·muted·loop·playsinline·preload·无 poster·无 controls）/
           实际在播且时间轴推进 / 静音 / 铺满容器且 cover 裁切 / 声音开关 / 离开首页即暂停。 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] || 'http://127.0.0.1:8788/index.html';
const PORT = process.argv[3] || 9336;
const OUT = 'reports/hero-video';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 静态属性 + 首帧状态 ───────────────────────────────── */
const CHECKS = String.raw`(function(){
  var out=[];
  function ok(n,c,d){ out.push((c?'PASS':'FAIL')+' | '+n+' | '+String(d==null?'':d).slice(0,200)); }
  var v=document.getElementById('hero-video');
  if(!v){ return 'FAIL | 未找到 #hero-video'; }
  var box=v.parentElement;                      /* .hero__logomark--video */
  var vb=v.getBoundingClientRect(), bb=box.getBoundingClientRect();
  var cs=getComputedStyle(v);
  ok('V0 资源可达且已缓冲（readyState≥2）', v.readyState>=2 && v.videoWidth>0,
     'src='+v.currentSrc.split('/').pop()+' readyState='+v.readyState+' 源尺寸='+v.videoWidth+'×'+v.videoHeight
     +' 时长='+(isFinite(v.duration)?v.duration.toFixed(1)+'s':'n/a'));
  ok('V1 呈现属性与原片一致（autoplay/muted/loop/playsinline/preload=auto）',
     v.autoplay && v.muted && v.loop && v.hasAttribute('playsinline') && v.getAttribute('preload')==='auto',
     'autoplay='+v.autoplay+' muted='+v.muted+' loop='+v.loop+' playsinline='+v.hasAttribute('playsinline')
     +' preload='+v.getAttribute('preload'));
  ok('V1b 无封面图、无原生控件、不可 tab 聚焦（沿用原设定）',
     !v.poster && !v.controls && v.getAttribute('tabindex')==='-1' && v.disablePictureInPicture,
     'poster='+v.poster+' controls='+v.controls+' tabindex='+v.getAttribute('tabindex')
     +' disablePiP='+v.disablePictureInPicture);
  ok('V2 尺寸铺满容器、object-fit:cover（只裁切不拉伸）',
     Math.abs(vb.width-bb.width)<1.5 && Math.abs(vb.height-bb.height)<1.5 && cs.objectFit==='cover',
     'video='+Math.round(vb.width)+'×'+Math.round(vb.height)+' 容器='+Math.round(bb.width)+'×'+Math.round(bb.height)
     +' object-fit='+cs.objectFit);
  /* 视觉弱化 = 视频自身 opacity<1 + 滤镜；径向遮罩与左实右透蒙层由 .hero__video-veil 承担
     （mix-blend-mode 现为 normal，是 09-12 有意为之：取消 luminosity 以保留画面本色） */
  var veil=box.querySelector('.hero__video-veil');
  ok('V2b 视觉处理保留（弱化 opacity + 滤镜 + 蒙层/遮罩）',
     parseFloat(cs.opacity)<1 && (cs.filter!=='none') && !!veil && veil.getBoundingClientRect().width>0,
     'opacity='+cs.opacity+' filter='+(cs.filter!=='none')+' mix-blend-mode='+cs.mixBlendMode
     +' mask='+(cs.maskImage!=='none'||cs.webkitMaskImage!=='none')
     +' 蒙层='+(veil? Math.round(veil.getBoundingClientRect().width)+'×'+Math.round(veil.getBoundingClientRect().height) : '缺失'));
  ok('V3 首页首屏默认播放（!paused）', !v.paused, 'paused='+v.paused+' currentTime='+v.currentTime.toFixed(2)+'s');
  ok('V4 默认静音', v.muted===true, 'muted='+v.muted+' volume='+v.volume);
  var btn=document.getElementById('hero-video-sound');
  ok('V5 声音开关可见且状态为「静音」', !!btn && !btn.hidden && btn.getAttribute('aria-pressed')==='true',
     btn? 'hidden='+btn.hidden+' aria-pressed='+btn.getAttribute('aria-pressed')+' title='+btn.title : '未找到按钮');
  ok('V6 声音开关可点击（命中测试不被遮挡）', (function(){
     if(!btn||btn.hidden) return false;
     var r=btn.getBoundingClientRect();
     var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
     return !!el && (el===btn||btn.contains(el));
  })(), (function(){
     if(!btn||btn.hidden) return 'n/a';
     var r=btn.getBoundingClientRect();
     var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
     return '命中='+(el?(el.id||el.className||el.tagName):'null');
  })());
  return out.join('\n');
})()`;

/* ── 时间轴推进 + 离开首页暂停 ──────────────────────────── */
const TIMELINE = String.raw`(function(){
  var v=document.getElementById('hero-video');
  return JSON.stringify({t:v.currentTime, paused:v.paused,
    audio:(v.webkitAudioDecodedByteCount||0)});
})()`;
/* 真点导航栏按钮离开首页：Router 是 const 顶层绑定（不在 window 上），只能走 DOM 点击 */
const LEAVE = String.raw`(function(){
  var b=document.querySelector('.navbar__btn[onclick*="portfolio"]');
  if(b) b.click();
  return JSON.stringify({clicked:!!b});
})()`;
const STATE = String.raw`(function(){
  var home=document.getElementById('page-home');
  return JSON.stringify({homeActive: home? home.classList.contains('is-active'):null});
})()`;

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
  '--user-data-dir=/tmp/sfk-chrome-hero', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--window-size=1440,900', 'about:blank'],
  { stdio: 'ignore' });

const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
    logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 160));
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL_ });
await Promise.race([loaded, sleep(20000)]);
await sleep(3500);                                  /* 等首帧解码 + 自动播放启动 */

console.log(`── 首页 Hero 影像验证 ${URL_} ──\n`);
console.log(await evalIn(CHECKS));

const t1 = JSON.parse(await evalIn(TIMELINE));
await sleep(2000);
const t2 = JSON.parse(await evalIn(TIMELINE));
const advanced = t2.t - t1.t;
console.log(`${advanced > 0.3 ? 'PASS' : 'FAIL'} | V7 画面在推进（2s 内 +${advanced.toFixed(2)}s） | `
  + `currentTime ${t1.t.toFixed(2)}s → ${t2.t.toFixed(2)}s，音频解码字节=${t2.audio}（>0 表示片源带音轨，声音开关有意义）`);

await evalIn(LEAVE);
await sleep(900);
const t3 = JSON.parse(await evalIn(TIMELINE));
const st = JSON.parse(await evalIn(STATE));
console.log(`${(st.homeActive === false && t3.paused) ? 'PASS' : 'FAIL'} | V8 离开首页立即暂停（门控行为未变） | `
  + `homeActive=${st.homeActive} paused=${t3.paused}`);

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (shot.result?.data) writeFileSync(`${OUT}/hero-video.png`, Buffer.from(shot.result.data, 'base64'));
console.log('\n── 控制台错误 / 警告 ──');
console.log(logs.length ? [...new Set(logs)].slice(0, 10).map((m) => '  ' + m).join('\n') : '  （无）');

ws.close(); chrome.kill('SIGKILL');
