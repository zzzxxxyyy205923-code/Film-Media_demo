/* 色彩审计：① 关键容器实际配色快照 ② 逐页 WCAG 对比度检查（AA）
   用法: node contrast.mjs <url> [port] [--dump|--audit|--all]                       */
import { spawn } from 'node:child_process';
const URL = process.argv[2];
const PORT = Number(process.argv[3] || 9371);
const MODE = process.argv[4] || '--all';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SANITY = String.raw`(function(){
  function lin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function lum(r,g,b){return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);}
  function parse(s){
    if(!s) return null;
    var m=s.match(/rgba?\(([^)]+)\)/); if(!m) return null;
    var p=m[1].split(',').map(function(x){return parseFloat(x);});
    return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};
  }
  function over(fg,bg){ // fg over bg (both {r,g,b,a})
    var a=fg.a!==undefined?fg.a:1;
    return {r:fg.r*a+bg.r*(1-a), g:fg.g*a+bg.g*(1-a), b:fg.b*a+bg.b*(1-a), a:1};
  }
  function effBg(el){
    var chain=[], n=el;
    while(n && n.nodeType===1){
      var c=parse(getComputedStyle(n).backgroundColor);
      if(c && c.a>0) chain.push(c);
      n=n.parentElement;
    }
    var base={r:255,g:255,b:255,a:1};
    for(var i=chain.length-1;i>=0;i--) base=over(chain[i],base);
    return base;
  }
  function ratio(a,b){
    var l1=lum(a.r,a.g,a.b), l2=lum(b.r,b.g,b.b);
    var hi=Math.max(l1,l2), lo=Math.min(l1,l2);
    return (hi+0.05)/(lo+0.05);
  }
  window.__ratio=ratio; window.__effBg=effBg; window.__parse=parse; window.__over=over;
})();`;

const DUMP = String.raw`(function(){
  var sels=['body','.hero','.home-section','.card','.navbar','.navbar__inner','.nav-menu-overlay','.sidebar','.course-overlay','.offers-grid','.offer-card','.filter-btn.is-active','.btn','.btn--primary','.match-card','.tl-gantt','.as-card','.pl-main','.portfolio-grid','.school-grid-card','footer'];
  var out=[];
  sels.forEach(function(s){
    var el=document.querySelector(s); if(!el) return;
    var cs=getComputedStyle(el);
    out.push(s.padEnd(22)+' bg='+cs.backgroundColor.padEnd(24)+' color='+cs.color.padEnd(22)+' border='+cs.borderTopColor);
  });
  var root=getComputedStyle(document.documentElement);
  var toks=['--color-primary','--color-accent','--color-primary-bright','--color-primary-deep','--color-bg','--color-surface','--color-surface-2','--color-border','--color-border-2','--color-text','--color-text-secondary','--color-text-muted','--color-text-faint','--color-void'];
  var t=toks.map(function(k){return k+'='+root.getPropertyValue(k).trim();}).join('\n');
  return out.join('\n')+'\n\n── :root 令牌 ──\n'+t;
})()`;

const AUDIT = String.raw`(async function(){
  var slp=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
  var pages=['home','portfolio','planning','timeline','course-products','assessment','plan'];
  var lines=[], fails=[], total=0;
  function auditPage(name){
    var els=document.querySelectorAll('body *'), n=0, bad=0;
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.children.length && !Array.prototype.some.call(el.childNodes,function(c){return c.nodeType===3&&c.textContent.trim();})) continue;
      var txt=(el.textContent||'').trim(); if(!txt) continue;
      var cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.35) continue;
      var r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
      if(r.bottom<0||r.top>innerHeight*1.02) continue;   // 仅审当前视口附近，逐页滚动由外层负责
      var fg=window.__parse(cs.color); if(!fg) continue;
      var bg=window.__effBg(el);
      fg=window.__over(fg,bg);
      var ratio=window.__ratio(fg,bg);
      var size=parseFloat(cs.fontSize), w=parseInt(cs.fontWeight,10)||400;
      var large=size>=24 || (size>=18.66 && w>=700);
      var need=large?3:4.5;
      n++; if(ratio<need){ bad++; fails.push({page:name,sel:el.tagName+'.'+String(el.className).slice(0,44),txt:txt.slice(0,26),size:size,ratio:Math.round(ratio*100)/100,need:need,fg:cs.color,bg:'rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')'}); }
    }
    total+=n; lines.push(name+': 检查 '+n+' 处文本，不达标 '+bad);
  }
  for(var p=0;p<pages.length;p++){
    if(pages[p]!=='home'){ Router.go(pages[p]); await slp(700); }
    var max=document.body.scrollHeight;
    for(var y=0;y<Math.min(max,2600);y+=Math.round(innerHeight*0.85)){
      scrollTo(0,y); await slp(260); auditPage(pages[p]);
    }
    scrollTo(0,0); await slp(200);
  }
  fails.sort(function(a,b){return a.ratio-b.ratio;});
  var uniq={}; fails.forEach(function(f){ uniq[f.sel+'|'+f.fg+'|'+f.bg]=f; });
  var arr=Object.keys(uniq).map(function(k){return uniq[k];});
  var out='── 对比度检查（WCAG AA）──\n'+lines.join('\n')+'\n合计 '+total+' 处，不达标 '+fails.length+' 处（去重 '+arr.length+' 种）\n';
  if(arr.length){
    out+='\n最差 25 处：\n';
    arr.slice(0,25).forEach(function(f){
      out+='  '+String(f.ratio).padEnd(6)+'(需'+f.need+') ['+f.page+'] '+f.sel+'\n        文本"'+f.txt+'" '+f.fg+' on '+f.bg+'\n';
    });
  }
  return out;
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
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/sfk-chrome-contrast', '--no-first-run', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });   // 避免读到旧 CSS
await send('Page.addScriptToEvaluateOnNewDocument', { source: SANITY });
const loaded = new Promise((res) => { const h = (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } }; ws.addEventListener('message', h); });
await send('Page.navigate', { url: URL });
await Promise.race([loaded, sleep(20000)]);
await sleep(3800);
if (MODE === '--dump' || MODE === '--all') {
  const d = await send('Runtime.evaluate', { expression: DUMP, returnByValue: true });
  console.log('── 关键容器配色快照 ──\n' + (d.result?.result?.value ?? ''));
}
if (MODE === '--audit' || MODE === '--all') {
  const a = await send('Runtime.evaluate', { expression: AUDIT, awaitPromise: true, returnByValue: true });
  console.log('\n' + (a.result?.result?.value ?? JSON.stringify(a.result)));
}
if (errors.length) console.log('\n运行时异常: ' + errors.slice(0, 3).join(' | '));
ws.close(); chrome.kill('SIGKILL');
