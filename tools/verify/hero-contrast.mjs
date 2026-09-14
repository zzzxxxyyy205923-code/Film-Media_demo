/* 首页浮动影像覆盖下的正文对比度实测 —— 真实 Chrome 像素取样
   用法: node hero-contrast.mjs <url> [port]
   产出: reports/hero-video/contrast-<vp>-*.png、reports/hero-video/contrast.json、控制台判定表

   原理:
     · 把正文文字设为 color:transparent（保留按钮底色/描边/阴影），截取到的画面即
       「正文真正压在什么上面」——文字被去掉后，剩余像素全部是背景。
     · 影像层的呼吸动效先冻结在最亮档（峰值 opacity 由 @keyframes 现读，不硬编码），
       再按时间取样若干真实帧，取最差。
     · 另做一帧「结构性最不利」：在影像容器内放一层纯白，复制影像层自身的
       mix-blend-mode / opacity / filter / mask，等价于「源片某一帧全白」——
       这是任何真实帧都不可能超过的对比度下界。
     · 逐个分辨率独立测量（同一 Chrome 会话内切换 deviceMetrics）。
     · 取样区用 CDP clip 只截正文外接矩形，再把 PNG 以 data: URL 送回页面画进
       canvas 读像素（data: URL 不污染 canvas，无需任何 npm/Python 依赖）。
       ⚠️ Page.captureScreenshot 返回的是**裸 base64**，必须自行拼 data URL 前缀。   */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9381);
const OUT = 'reports/hero-video';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const SEL = ['.hero__eyebrow', '.hero__title', '.hero__sub', '.hero__stat-num',
  '.hero__stat-label', '.hero__cta', '.hero__cta-sub', '.hero__ghost',
  '.hero__readout-id', '.hero__readout-geo', '.hero__readout-live'];

const VIEWPORTS = [
  { w: 1680, h: 1050, tag: '1680' },
  { w: 1440, h: 900, tag: '1440' },
  { w: 1180, h: 820, tag: '1180' },
  { w: 1024, h: 768, tag: '1024' },
  { w: 768, h: 1024, tag: '768' },
  { w: 390, h: 844, tag: '390' },
  { w: 320, h: 568, tag: '320' },
];

/* 峰值不透明度取自 @keyframes（避免与 CSS 漂移） */
const PEAK_SNIPPET = String.raw`
  function peakOpacity(v){
    var peak=0;
    for(var i=0;i<document.styleSheets.length;i++){
      var rs; try{ rs=document.styleSheets[i].cssRules; }catch(e){ continue; }
      for(var j=0;j<rs.length;j++){
        if(rs[j].type!==7 || !/heroVideoBreathe/.test(rs[j].name||'')) continue;
        var kf=rs[j].cssRules;
        for(var k=0;k<kf.length;k++){
          var m=/opacity\s*:\s*([\d.]+)/.exec(kf[k].style.cssText||'');
          if(m) peak=Math.max(peak, parseFloat(m[1]));
        }
      }
    }
    return peak || parseFloat(getComputedStyle(v).opacity) || 1;
  }`;

/* ① 采集文本框（含字号字重 → AA 门槛）+ clip 外接矩形 */
const COLLECT = String.raw`(function(){
  ${PEAK_SNIPPET}
  var v=document.getElementById('hero-video');
  var clipPad=12, out=[], x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  ${JSON.stringify(SEL)}.forEach(function(s){
    var el=document.querySelector(s); if(!el) return;
    var r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return;
    if(r.bottom<0||r.top>innerHeight) return;
    if(r.bottom>innerHeight||r.left<0) return;
    var cs=getComputedStyle(el), fs=parseFloat(cs.fontSize), fw=parseInt(cs.fontWeight,10)||400;
    out.push({sel:s, color:cs.color, box:[r.left,r.top,r.width,r.height], fs:fs,
      need:(fs>=24||(fs>=18.66&&fw>=700))?3:4.5});
    x0=Math.min(x0,r.left); y0=Math.min(y0,r.top); x1=Math.max(x1,r.right); y1=Math.max(y1,r.bottom);
  });
  scrollTo(0,0);
  var vr=v?getComputedStyle(v):null, ob=document.querySelector('.hero__logomark--video');
  var or_=ob?ob.getBoundingClientRect():null;
  return JSON.stringify({
    items:out,
    clip:{x:Math.max(0,Math.floor(x0-clipPad)), y:Math.max(0,Math.floor(y0-clipPad)),
      width:Math.min(innerWidth,Math.ceil(x1-x0+clipPad*2)), height:Math.min(innerHeight,Math.ceil(y1-y0+clipPad*2))},
    video:{ opacity: vr?vr.opacity:null, blend: vr?vr.mixBlendMode:null, peak: v?peakOpacity(v):null },
    box: or_? [Math.round(or_.left),Math.round(or_.top),Math.round(or_.width),Math.round(or_.height)] : null
  });
})()`;

/* ② 冻结呼吸动效在峰值 + 文字转透明（保留按钮底色） / 还原 */
const FREEZE = String.raw`(function(){
  ${PEAK_SNIPPET}
  var v=document.getElementById('hero-video');
  if(v){ v.style.animation='none'; v.style.opacity=String(peakOpacity(v)); }
  var st=document.createElement('style'); st.id='hero-contrast-hide';
  st.textContent='.hero__inner,.hero__inner *,.hero__readout,.hero__readout *{color:transparent !important;text-shadow:none !important;}';
  document.head.appendChild(st);
  return 'frozen';
})()`;
const RESTORE = String.raw`(function(){ var s=document.getElementById('hero-contrast-hide'); if(s) s.remove(); return 'restored'; })()`;

/* ③ 合成最不利帧：纯白层复刻影像层的混合/不透明度/滤镜/遮罩 */
const WORST = String.raw`(function(){
  var v=document.getElementById('hero-video'), host=v.parentElement, cs=getComputedStyle(v);
  var f=document.createElement('div'); f.id='hero-video-worst';
  f.style.cssText='position:absolute;inset:0;background:#fff;pointer-events:none;';
  f.style.mixBlendMode=cs.mixBlendMode; f.style.opacity=cs.opacity; f.style.filter=cs.filter;
  f.style.maskImage=cs.maskImage; f.style.webkitMaskImage=cs.webkitMaskImage||cs.maskImage;
  f.style.maskSize=cs.maskSize; f.style.webkitMaskSize=cs.maskSize;
  f.style.maskRepeat=cs.maskRepeat; f.style.webkitMaskRepeat=cs.maskRepeat;
  v.style.visibility='hidden'; host.appendChild(f);
  return 'worst-on';
})()`;
const WORST_OFF = String.raw`(function(){
  var f=document.getElementById('hero-video-worst'), v=document.getElementById('hero-video');
  if(f) f.remove(); if(v) v.style.visibility='';
  return 'worst-off';
})()`;

/* ④ 把截图像素送回页面：逐文本框统计背景亮度并算对比度 */
const ANALYZE = String.raw`(function(dataUrl, items, clip){
  return new Promise(function(res){
    var img=new Image();
    img.onerror=function(){ res(JSON.stringify({err:'IMG_ERR'})); };
    img.onload=function(){
      var c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
      var ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0);
      var sc=img.naturalWidth/clip.width;
      function lin(x){ x/=255; return x<=0.04045? x/12.92 : Math.pow((x+0.055)/1.055,2.4); }
      function lum(r,g,b){ return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b); }
      function ratio(a,b){ var hi=Math.max(a,b), lo=Math.min(a,b); return (hi+0.05)/(lo+0.05); }
      function parse(s){ var m=String(s).match(/rgba?\(([^)]+)\)/); var p=m[1].split(',').map(parseFloat);
        return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
      var out=[];
      items.forEach(function(it){
        var b=it.box;
        var x=Math.max(0,Math.round((b[0]-clip.x)*sc)), y=Math.max(0,Math.round((b[1]-clip.y)*sc));
        var w=Math.max(1,Math.round(b[2]*sc)), h=Math.max(1,Math.round(b[3]*sc));
        if(x+w>c.width) w=c.width-x; if(y+h>c.height) h=c.height-y;
        if(w<1||h<1){ out.push({sel:it.sel,err:'out-of-clip'}); return; }
        var d=ctx.getImageData(x,y,w,h).data, L=[];
        for(var i=0;i<d.length;i+=4) L.push(lum(d[i],d[i+1],d[i+2]));
        L.sort(function(a,b){return a-b;});
        var mx=L[L.length-1], p95=L[Math.min(L.length-1,Math.floor(L.length*0.95))], md=L[Math.floor(L.length/2)];
        var fg=parse(it.color), fl=lum(fg.r,fg.g,fg.b);
        out.push({sel:it.sel, need:it.need, fg:it.color, fs:it.fs,
          fgLum:+fl.toFixed(4), bgMax:+mx.toFixed(4), bgP95:+p95.toFixed(4), bgMed:+md.toFixed(4),
          ratioMax:+ratio(fl,mx).toFixed(2), ratioP95:+ratio(fl,p95).toFixed(2), ratioMed:+ratio(fl,md).toFixed(2)});
      });
      res(JSON.stringify({rows:out}));
    };
    img.src=dataUrl;
  });
})`;

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
  '--user-data-dir=/tmp/sfk-chrome-hero-contrast', '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (expr, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
  if (r.result?.exceptionDetails) return 'JS_ERR:' + (r.result.exceptionDetails.exception?.description || '').slice(0, 160);
  return r.result?.result?.value;
};
const shot = async (name, clip) => {
  const params = { format: 'png', captureBeyondViewport: false };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
  const r = await send('Page.captureScreenshot', params);
  if (!r.result?.data) { console.log('  !! captureScreenshot 失败: ' + JSON.stringify(r).slice(0, 240)); return null; }
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  return r.result.data;
};

await send('Runtime.enable'); await send('Page.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(25000)]);
await sleep(6000);                      // 等源片缓冲到可解码

console.log(`── 首页浮动影像覆盖下正文对比度实测 ${URL} ──\n`);

const agg = new Map();        // sel → 全局最差行（含视口）
const summary = [];
for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 500 });
  await sleep(900);
  const meta = JSON.parse(await evalIn(COLLECT));
  if (!meta?.items?.length) { console.log(`[${vp.tag}] 未取到文本框，跳过`); continue; }
  console.log(`[${vp.tag}] box=${meta.box ? meta.box.join(',') : '-'} 视频 opacity=${meta.video.opacity} peak=${meta.video.peak} blend=${meta.video.blend} 文本 ${meta.items.length} 处`);

  await evalIn(FREEZE);
  const rows = [];
  /* 真实帧 2 张 */
  for (let i = 1; i <= 2; i++) {
    await sleep(1500);
    const dataUrl = await shot(`contrast-${vp.tag}-real-${i}`, meta.clip);
    if (!dataUrl) continue;
    const raw = await evalIn(`(${ANALYZE})(${JSON.stringify('data:image/png;base64,' + dataUrl)}, ${JSON.stringify(meta.items)}, ${JSON.stringify(meta.clip)})`, true);
    try { const p = JSON.parse(raw); if (p.rows) rows.push({ tag: `real-${i}`, rows: p.rows }); }
    catch (e) { console.log('  !! 分析失败 ' + String(raw).slice(0, 160)); }
  }
  /* 结构性最不利：纯白帧 */
  await evalIn(WORST); await sleep(500);
  const wUrl = await shot(`contrast-${vp.tag}-worst-white`, meta.clip);
  if (wUrl) {
    const raw = await evalIn(`(${ANALYZE})(${JSON.stringify('data:image/png;base64,' + wUrl)}, ${JSON.stringify(meta.items)}, ${JSON.stringify(meta.clip)})`, true);
    try { const p = JSON.parse(raw); if (p.rows) rows.push({ tag: 'worst-white', rows: p.rows }); }
    catch (e) { console.log('  !! 最不利帧分析失败 ' + String(raw).slice(0, 160)); }
  }
  await evalIn(WORST_OFF); await evalIn(RESTORE);

  for (const frame of rows) for (const r of frame.rows) {
    if (r.err) continue;
    const cur = agg.get(r.sel);
    if (!cur || r.ratioMax < cur.ratioMax) agg.set(r.sel, { ...r, vp: vp.tag, frame: frame.tag });
  }
  const worstHere = [...agg.values()].filter((r) => r.vp === vp.tag);
  console.log(`  ${rows.length} 帧已测；本视口最差 ` + (worstHere.length
    ? worstHere.map((r) => `${r.sel.replace('.hero__', '')}=${r.ratioMax}`).join(' ')
    : '-'));
  summary.push({ vp: vp.tag, box: meta.box, video: meta.video, frames: rows.length });
}

console.log('\n── 判定（各视口 × 各帧的全局最差点；ratioMax ≥ 门槛即达标）──');
let fails = 0;
for (const s of SEL) {
  const r = agg.get(s); if (!r) continue;
  const ok = r.ratioMax >= r.need;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${s.padEnd(21)} | 门槛 ${r.need}:1 | 全局最差 ratioMax=${r.ratioMax} (median=${r.ratioMed}) | ${r.fs}px ${r.fg} | 出现在 ${r.vp}px 视口 / ${r.frame} 帧`);
}
console.log(`\n汇总：${summary.length} 个视口 · 不达标 ${fails} 处`);
writeFileSync(`${OUT}/contrast.json`, JSON.stringify({ summary, worst: [...agg.values()], fails }, null, 2));
console.log(`明细已存 ${OUT}/contrast.json`);
console.log('\n（说明：worst-white 帧 = 把影像层换成纯白并复刻其 blend/opacity/filter/mask，' +
  '等价于「源片某一帧全白」，是真实帧不可能超过的对比度下界。）');

ws.close(); chrome.kill('SIGKILL');
