/* 交互态 + 浮层配色审计
   A) 真实鼠标悬停/激活态对比度（Input.dispatchMouseEvent，含过渡等待）
   B) 深色浮层内部文本对比度（导航浮层 / 课程浮层 / 侧栏 / 图片灯箱）
   用法: node states.mjs <url> [port]                                                        */
import { spawn } from 'node:child_process';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9373);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SANITY = String.raw`(function(){
  function lin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function lum(p){return 0.2126*lin(p.r)+0.7152*lin(p.g)+0.0722*lin(p.b);}
  function parse(s){var m=s&&s.match(/rgba?\(([^)]+)\)/);if(!m)return null;var p=m[1].split(',').map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
  function over(f,b){var a=f.a===undefined?1:f.a;return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1};}
  function effBg(el){var chain=[],n=el;while(n&&n.nodeType===1){var c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0)chain.push(c);n=n.parentElement;}var base={r:246,g:246,b:244,a:1};for(var i=chain.length-1;i>=0;i--)base=over(chain[i],base);return base;}
  function ratio(a,b){var l1=lum(a),l2=lum(b),hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);}
  function need(el){var cs=getComputedStyle(el),s=parseFloat(cs.fontSize),w=parseInt(cs.fontWeight,10)||400;return (s>=24||(s>=18.66&&w>=700))?3:4.5;}
  function snap(el){var cs=getComputedStyle(el);var bg=effBg(el);var fg=over(parse(cs.color),bg);return {color:cs.color,bg:'rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')',ratio:Math.round(ratio(fg,bg)*100)/100,need:need(el)};}
  window.__snap=snap; window.__effBg=effBg; window.__ratio=ratio; window.__over=over; window.__parse=parse;
})();`;

const PAGE_SEL = {
  home: ['.btn', '.filter-btn', '.filter-btn.is-active', '.navbar__btn', '.offer-card', '.school-list-item__name', '.course-card', '.home-section__link'],
  portfolio: ['.filter-btn', '.port-card', '.port-card__link', '.school-grid-card', '.btn'],
  planning: ['.filter-btn', '.pl-job-card', '.pl-route-card', '.btn'],
  timeline: ['.filter-btn', '.tl-tab', '.tl-track__label', '.btn'],
  'course-products': ['.cp-tab', '.cp-card', '.filter-btn', '.btn'],
  assessment: ['.as-option', '.as-btn', '.filter-btn', '.btn'],
  plan: ['.pl-card', '.filter-btn', '.btn'],
};

const OVERLAY_AUDIT = (root, label) => String.raw`(function(){
  var root=document.querySelector(${JSON.stringify(root)});
  if(!root) return {label:${JSON.stringify(label)},missing:1};
  var els=root.querySelectorAll('*'),bad=[],n=0,seen={},lines=[];
  for(var i=0;i<els.length;i++){
    var el=els[i];
    if(el.children.length && !Array.prototype.some.call(el.childNodes,function(c){return c.nodeType===3&&c.textContent.trim();})) continue;
    var txt=(el.textContent||'').trim(); if(!txt) continue;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.35) continue;
    var r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    var s=window.__snap(el); n++;
    seen[cs.color]=1;
    if(s.ratio<s.need) bad.push({sel:el.tagName+'.'+String(el.className).slice(0,46),txt:txt.slice(0,24),ratio:s.ratio,need:s.need,color:s.color,bg:s.bg});
  }
  return {label:${JSON.stringify(label)},checked:n,bad:bad,colors:Object.keys(seen)};
})()`;

async function devtoolsWs() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find((t) => t.type === 'page'); if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await sleep(250);
  }
  throw new Error('DevTools 未就绪');
}
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-states', '--no-first-run', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: SANITY });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(3600);

/* ── A. 悬停态：每页运行时挑选「可点击代表元素」 ───────── */
console.log('══ A. 交互态对比度（真实鼠标悬停） ══');
let hoverBad = 0, hoverChecked = 0;
for (const p of Object.keys(PAGE_SEL)) {
  if (p !== 'home') { await evalIn(`Router.go('${p}')`); await sleep(1000); }
  const cands = await evalIn(`(function(){
    var all=Array.prototype.slice.call(document.querySelectorAll('button, a[href], [onclick], .filter-btn, .tag'));
    var seen={}, out=[];
    for(var i=0;i<all.length;i++){
      var el=all[i], cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.5) continue;
      var r=el.getBoundingClientRect(); if(r.width<28||r.height<18) continue;
      var k=el.tagName+'.'+String(el.className).split(' ').slice(0,2).join('.').slice(0,40);
      if(seen[k]) continue; seen[k]=1;
      out.push({key:k}); if(out.length>=9) break;
    }
    return out;
  })()`);
  for (const c of (cands || [])) {
    const info = await evalIn(`(function(){
      var all=Array.prototype.slice.call(document.querySelectorAll('button, a[href], [onclick], .filter-btn, .tag'));
      for(var i=0;i<all.length;i++){
        var el=all[i], k=el.tagName+'.'+String(el.className).split(' ').slice(0,2).join('.').slice(0,40);
        if(k!==${JSON.stringify(c.key)}) continue;
        el.scrollIntoView({block:'center'});
        var r=el.getBoundingClientRect();
        return {snap:window.__snap(el), x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), rect:[Math.round(r.width),Math.round(r.height)]};
      }
      return null;
    })()`);
    if (!info) { console.log(`  ${p} ${c.key}: 元素已失效`); continue; }
    await sleep(950);   // 等 smooth scroll 结束
    const pos = await evalIn(`(function(){
      var all=Array.prototype.slice.call(document.querySelectorAll('button, a[href], [onclick], .filter-btn, .tag'));
      for(var i=0;i<all.length;i++){
        var el=all[i], k=el.tagName+'.'+String(el.className).split(' ').slice(0,2).join('.').slice(0,40);
        if(k!==${JSON.stringify(c.key)}) continue;
        var r=el.getBoundingClientRect();
        if(r.top<0||r.bottom>innerHeight) return {offscreen:1};
        return {snap:window.__snap(el), x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};
      }
      return null;
    })()`);
    if (!pos) { console.log(`  ${p} ${c.key}: 元素已失效`); continue; }
    if (pos.offscreen) { console.log(`  ${p} ${c.key}: 跳过(滚动后仍在视口外)`); continue; }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y, button: 'none', clickCount: 0 });
    await sleep(600);
    const hov = await evalIn(`(function(){
      var all=Array.prototype.slice.call(document.querySelectorAll('button, a[href], [onclick], .filter-btn, .tag'));
      for(var i=0;i<all.length;i++){
        var el=all[i], k=el.tagName+'.'+String(el.className).split(' ').slice(0,2).join('.').slice(0,40);
        if(k===${JSON.stringify(c.key)}) return window.__snap(el);
      }
      return null;
    })()`);
    if (!hov) { console.log(`  ${p} ${c.key}: 悬停后元素重渲染`); continue; }
    const changed = hov.color !== pos.snap.color || hov.bg !== pos.snap.bg;
    const ok = hov.ratio >= hov.need && pos.snap.ratio >= pos.snap.need;
    hoverChecked++; if (!ok) hoverBad++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${p} ${c.key}\n        常态 ${pos.snap.color} on ${pos.snap.bg} = ${pos.snap.ratio}(需${pos.snap.need})` +
      (changed ? `  →  悬停 ${hov.color} on ${hov.bg} = ${hov.ratio}(需${hov.need})` : '  · 悬停无颜色变化'));
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 400, button: 'none', clickCount: 0 });
}
console.log(`  小结：检查 ${hoverChecked} 项，不达标 ${hoverBad} 项`);

/* ── B. 深色浮层 ─────────────────────────── */
console.log('\n══ B. 深色浮层内部对比度 ══');
const overlays = [];
await evalIn(`NavMenu.open()`); await sleep(700);
overlays.push(await evalIn(OVERLAY_AUDIT('#nav-menu-overlay', '导航浮层')));
await evalIn(`NavMenu.close()`); await sleep(400);

await evalIn(`Router.go('course-products')`); await sleep(1200);
await evalIn(`CourseOverlay.open(Object.keys(window.PRODUCTS)[0])`); await sleep(1400);
overlays.push(await evalIn(OVERLAY_AUDIT('.course-overlay', '课程详情浮层')));
await evalIn(`CourseOverlay.close()`); await sleep(500);

await evalIn(`Search.jumpTo('school', encodeURIComponent(DATA.programs[0].school_en))`); await sleep(1400);
overlays.push(await evalIn(OVERLAY_AUDIT('.sidebar', '侧栏')));
await evalIn(`(function(){try{Sidebar.close&&Sidebar.close();}catch(e){}return 1;})()`); await sleep(400);

await evalIn(`ImageModal.open('assets/img/professor-ar-nyu.jpeg','色彩审计')`); await sleep(900);
overlays.push(await evalIn(OVERLAY_AUDIT('.img-modal-backdrop', '图片灯箱')));
await evalIn(`(function(){try{ImageModal.close&&ImageModal.close();}catch(e){}return 1;})()`); await sleep(400);

for (const o of overlays) {
  if (!o || o.missing) { console.log(`  ${o?.label}: 未找到`); continue; }
  console.log(`  ${(!o.bad || !o.bad.length) ? 'PASS' : 'FAIL'} ${o.label}: 检查 ${o.checked} 处，不达标 ${o.bad ? o.bad.length : 0}`);
  (o.bad || []).slice(0, 6).forEach((b) => console.log(`        ${b.ratio}(需${b.need}) ${b.sel} "${b.txt}" ${b.color} on ${b.bg}`));
  console.log(`        用色集合: ${(o.colors || []).join(' , ')}`);
}
if (errors.length) console.log('\n运行时异常: ' + errors.slice(0, 3).join(' | '));
ws.close(); chrome.kill('SIGKILL');
