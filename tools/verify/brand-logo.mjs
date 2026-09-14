/* 品牌 logo 合规验证 —— 官方 VI「影视传媒」科系图标是否按规范落地。
   用法：node tools/verify/brand-logo.mjs http://127.0.0.1:8788/index.html [cdpPort]
   检查项：资源加载 / 显示尺寸与 1:1 比例 / 25% 安全留白 / 深色底用反白稿 /
           标准字与网页元素取色是否为官方专色 / favicon / 主体实地色。 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] || 'http://127.0.0.1:8788/index.html';
const PORT = process.argv[3] || 9334;
const OUT = 'reports/brand-logo';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const CHECKS = String.raw`(function(){
  var out=[];
  function ok(n,c,d){ out.push((c?'PASS':'FAIL')+' | '+n+' | '+String(d==null?'':d).slice(0,180)); }
  function lum(rgb){ var m=/(\d+),\s*(\d+),\s*(\d+)/.exec(rgb)||[0,0,0,0];
    return (0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3])/255; }
  /* 把 <img> 画进 canvas，取所有不透明像素的平均 RGB = 图形实地色 */
  function meanColor(img){
    try{
      var c=document.createElement('canvas'); c.width=c.height=96;
      var x=c.getContext('2d'); x.drawImage(img,0,0,96,96);
      var d=x.getImageData(0,0,96,96).data, r=0,g=0,b=0,n=0;
      for(var i=0;i<d.length;i+=4){ if(d[i+3]<250) continue; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
      return n? [Math.round(r/n),Math.round(g/n),Math.round(b/n)] : null;
    }catch(e){ return null; }
  }
  var nav=document.querySelector('.navbar__logo-mark');
  var navSrc=nav?nav.getAttribute('src'):'';
  /* 标准字度量：字号 / 行高 / canvas 实测墨迹高度，用来定量图标该多大 */
  var txt=nav?nav.parentElement.querySelector('.navbar__logo-text'):null;
  var cs=txt?getComputedStyle(txt):null;
  var fs=cs?parseFloat(cs.fontSize):0;
  var lh=cs?(parseFloat(cs.lineHeight)||fs*1.5):0;
  var ink=null;
  try{
    var c2=document.createElement('canvas').getContext('2d');
    c2.font=(cs.fontWeight||'700')+' '+cs.fontSize+' '+(cs.fontFamily||'sans-serif');
    var m2=c2.measureText(txt.textContent);
    ink=m2.actualBoundingBoxAscent+m2.actualBoundingBoxDescent;
  }catch(e){}
  ok('L0 排版度量（供人工判断比例）', true,
     '字号='+fs+'px 行高='+(Math.round(lh*10)/10)+'px 墨迹高='+(ink?Math.round(ink*10)/10:'n/a')+'px');
  ok('L1 导航栏 logo 资源加载成功', !!nav && nav.complete && nav.naturalWidth>0,
     nav? 'natural='+nav.naturalWidth+'x'+nav.naturalHeight+' '+navSrc : '未找到 .navbar__logo-mark');
  var nb=nav?nav.getBoundingClientRect():{width:0,height:0};
  ok('L2 保持 1:1、且高度与行高协调（≤行高、≥行高×0.55）',
     Math.abs(nb.width-nb.height)<0.5 && nb.height<=lh+0.5 && nb.height>=lh*0.55-0.5,
     Math.round(nb.width)+'×'+Math.round(nb.height)+' 图标/行高='+(lh?(Math.round(nb.height/lh*100)/100):'n/a')
     +' 图标/墨迹='+(ink?(Math.round(nb.height/ink*100)/100):'n/a'));
  var gap=nav?parseFloat(getComputedStyle(nav.parentElement).columnGap||getComputedStyle(nav.parentElement).gap):null;
  ok('L3 与标准字间距 = 图标 ×25%（官方安全留白）', gap!==null && Math.abs(gap-nb.width*0.25)<0.6,
     'gap='+gap+'px 期望'+(Math.round(nb.width*0.25*10)/10)+'px');
  var nbBg=getComputedStyle(document.querySelector('.navbar')).backgroundColor;
  ok('L4 深色底使用反白稿（彩色稿仅用于浅底）',
     lum(nbBg)<0.25 && /reverse/.test(navSrc), 'navbarBg='+nbBg+' lum='+lum(nbBg).toFixed(3)+' src='+navSrc);
  var en=document.querySelector('.navbar__logo-text .u-en');
  var enColor=en?getComputedStyle(en).color:'';
  ok('L5 标准字取色 = 官方科系专色 #E984DB (C0 M43 Y6 K9)', /233,\s*132,\s*219/.test(enColor), 'color='+enColor);
  var ft=document.querySelector('.site-footer__logo-mark');
  var fb=ft?ft.getBoundingClientRect():{width:0,height:0};
  ok('L6 页脚 logo 同为反白稿、正方形、且与导航栏同尺寸',
     !!ft && ft.complete && Math.abs(fb.width-fb.height)<0.5 && Math.abs(fb.width-nb.width)<0.5,
     ft? Math.round(fb.width)+'×'+Math.round(fb.height)+' '+ft.getAttribute('src') : '未找到');
  var ico=document.querySelector('link[rel=icon]');
  ok('L7 favicon 指向官方专色稿', !!ico && /sfk-dept-film-media\.png$/.test(ico.getAttribute('href')||''),
     ico? ico.getAttribute('href') : '未设置');
  var mc=nav?meanColor(nav):null;
  ok('L8 图形实地色 = #FFFFFF（反白稿）/ 或 #E984DB（专色稿）',
     !!mc && ((Math.abs(mc[0]-255)<6&&Math.abs(mc[1]-255)<6&&Math.abs(mc[2]-255)<6)
              || (Math.abs(mc[0]-233)<8&&Math.abs(mc[1]-132)<8&&Math.abs(mc[2]-219)<8)),
     mc? 'rgb('+mc.join(',')+')' : 'canvas 取样失败');
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

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/sfk-chrome-brand', '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

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
await sleep(2500);

console.log(`── 品牌 logo 合规验证 ${URL_} ──\n`);
console.log(await evalIn(CHECKS));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (shot.result?.data) writeFileSync(`${OUT}/navbar-logo.png`, Buffer.from(shot.result.data, 'base64'));
/* 4× 放大的 lockup 局部图，供人工判断「图标 vs 标准字」的实际视觉比例 */
const box = JSON.parse(await evalIn(String.raw`(function(){var n=document.querySelector('.navbar__logo');var r=n.getBoundingClientRect();
  return JSON.stringify({x:Math.max(0,r.x-8),y:Math.max(0,r.y-8),w:r.width+16,h:r.height+16});})()`));
const zoom = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: false,
  clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 4 },
});
if (zoom.result?.data) writeFileSync(`${OUT}/navbar-logo-zoom-4x.png`, Buffer.from(zoom.result.data, 'base64'));
console.log('\n── 控制台错误 / 警告 ──');
console.log(logs.length ? [...new Set(logs)].slice(0, 10).map((m) => '  ' + m).join('\n') : '  （无）');

ws.close(); chrome.kill('SIGKILL');
