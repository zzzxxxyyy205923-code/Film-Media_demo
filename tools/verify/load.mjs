import { JSDOM, VirtualConsole } from 'jsdom';

const url = process.argv[2];
const vc = new VirtualConsole();
const seen = [];
vc.on('jsdomError', (e) => seen.push(['jsdomError', e.message]));
vc.on('error', (...a) => seen.push(['console.error', a.map(String).join(' ')]));
vc.on('warn', (...a) => seen.push(['console.warn', a.map(String).join(' ')]));

const dom = await JSDOM.fromURL(url, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
await new Promise((r) => setTimeout(r, 5000));

const d = dom.window.document;
const ids = ['offers-grid','instructors-grid','portfolio-grid','industry-sections','tl-gantt','cp-longform-grid','as-stage','pl-main','hero-posters'];
console.log('── 容器渲染长度 ──');
for (const id of ids) {
  const el = d.getElementById(id);
  console.log(`  ${id.padEnd(20)} ${el ? (el.innerHTML.length + 'B') : 'NO-EL'}`);
}
console.log('\n── 运行期错误/警告 ──');
if (!seen.length) console.log('  （无）');
for (const [k, m] of seen) console.log(`  [${k}] ${m.split('\n')[0].slice(0, 300)}`);

console.log('\n── 交互探针 ──');
const w = dom.window;
const probe = (name, fn) => { try { const r = fn(); console.log(`  ${r === false ? 'FAIL' : 'ok  '}  ${name}  ${String(r).slice(0,90)}`); } catch (e) { console.log(`  FAIL  ${name}  ${e.message.slice(0,120)}`); } };
probe('点击侧栏导航(portfolio)', () => { const a = d.querySelector('[data-nav], .side-nav a, .nav a'); if (!a) return false; a.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); return true; });
probe('TimelinePage.selectRoute', () => { w.TimelinePage.selectRoute('英研'); return d.querySelectorAll('.tl-gantt .tl-bar').length + ' bars'; });
probe('课程浮层', () => { w.CourseOverlay.open('changemakers'); return !!d.querySelector('.course-overlay, .cp-overlay, [id*=overlay]'); });
console.log('\n  hasInteracted keys:', ['HomePage','OffersPage','PlanningPage','PortfolioPage','TimelinePage','CourseProductsPage','AssessmentPage','PlanPage','Router','Search','Sidebar','CourseOverlay'].map(k => k + '=' + (typeof w[k])).join(' '));
