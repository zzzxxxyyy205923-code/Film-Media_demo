/* ═══════════════════════════════════════════
   ROUTER — page switching + scroll helpers
═══════════════════════════════════════════ */

// Disable browser's native scroll restoration so we control it fully
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const Router = {
  current: 'home',

  go(pageId, opts = {}) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('is-active'));
    document.querySelectorAll('.navbar__btn').forEach(b => b.classList.remove('is-active'));

    const page = document.getElementById('page-' + pageId);
    if (!page) return;
    page.classList.add('is-active');
    this.current = pageId;

    // Persist page in URL hash; push new history entry so browser back button works
    const pagesToHash = ['portfolio','planning','timeline','course-products','assessment','plan'];
    const newHash = pagesToHash.includes(pageId) ? '#' + pageId : location.pathname + location.search;
    if (!this._fromPopstate && location.hash !== '#' + pageId) {
      history.pushState(null, '', newHash);
    }

    // Sync navbar active state
    const navMap = { home: 0, portfolio: 4, timeline: 5, 'course-products': 6 };
    if (navMap[pageId] !== undefined)
      document.querySelectorAll('.navbar__btn')[navMap[pageId]]?.classList.add('is-active');

    if (opts.scrollTo) {
      setTimeout(() => this.scrollTo(opts.scrollTo), 100);
    } else {
      window.scrollTo(0, 0);
    }
  },

  scrollTo(selector, extraOffset = 0) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    const navbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-h'), 10) || 56;
    const indNav = document.querySelector('.industry-nav');
    const navH = navbarH + (indNav ? indNav.offsetHeight : 0);
    const top = el.getBoundingClientRect().top + window.scrollY - navH - extraOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  },

  goToPortfolioFilter(branch) {
    this.go('portfolio');
    setTimeout(() => {
      const btn = [...document.querySelectorAll('#portfolio-cats .filter-btn')]
        .find(b => b.textContent.trim() === branch);
      if (btn) PortfolioPage.filter(branch, btn);
    }, 100);
  },

  goToCoursesTab(tabId) {
    const PRODUCT_MAP = { internship: 'internship', summer: 'summerwinter', bizpractice: 'bizpractice', masterclass: 'masterclass' };
    const productId = PRODUCT_MAP[tabId];
    if (productId && window.CourseOverlay) CourseOverlay.open(productId);
  },

  goToIndustry(indId) {
    if (this.current !== 'planning') {
      this.go('planning');
      setTimeout(() => this._scrollToIndustry(indId), 250);
    } else {
      this._scrollToIndustry(indId);
    }
  },

  _scrollToIndustry(indId) {
    const el = document.getElementById('sec-' + indId);
    if (el) this.scrollTo(el);
    document.querySelectorAll('.industry-nav__btn').forEach(b => b.classList.remove('is-active'));
    document.getElementById('nav-' + indId)?.classList.add('is-active');
  },
};

const Tabs = {
  switchCountrySidebar(group, btn) {
    const sid = document.getElementById('sidebar');
    sid.querySelectorAll('.country-tab').forEach(b => b.classList.remove('is-active'));
    sid.querySelectorAll('.country-tab-panel').forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    sid.querySelector('.country-tab-panel[data-group="' + group + '"]')?.classList.add('is-active');
  },
};

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const PAGES = ['portfolio','planning','timeline','course-products','assessment','plan'];
  const hashPage = location.hash.replace('#', '');
  Router._fromPopstate = true;
  Router.go(PAGES.includes(hashPage) ? hashPage : 'home');
  Router._fromPopstate = false;
});

/* Keep the navbar selection box on whichever item the user actually clicked.
   The in-page scroll links all route to 'home', so positional sync alone
   can't tell them apart — this lets the clicked button win. */
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelector('.navbar__links');
  if (!links) return;
  links.addEventListener('click', (e) => {
    const btn = e.target.closest('.navbar__btn');
    if (!btn || !links.contains(btn)) return;
    links.querySelectorAll('.navbar__btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});
