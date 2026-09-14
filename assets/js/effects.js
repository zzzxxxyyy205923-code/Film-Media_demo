/* ═══════════════════════════════════════════
   VISUAL EFFECTS (presentation only — no app logic)
   - Scroll-reveal for sections (gated so no-JS shows all)
   - Generic scroll-reveal (planning / portfolio / cards)

   NOTE: the hero "comet" mouse-follow cursor was removed on purpose.
   The page must always show the browser's native cursor; do not
   reintroduce any custom / canvas-drawn cursor overlay here.
═══════════════════════════════════════════ */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Scroll-reveal (gated by body.fx-ready) ---- */
  function initReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    document.body.classList.add('fx-ready');
    var targets = document.querySelectorAll('.home-section');
    function reveal(el) { el.classList.add('in-view'); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io.observe(t); });
    // Fail-safe: never let a section stay hidden if IO doesn't fire as expected.
    setTimeout(function () { targets.forEach(reveal); }, 2600);
  }

  /* ---- 2. Generic scroll-reveal (planning / portfolio / cards) ---- */
  function initGenericReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    document.body.classList.add('fx-ready');
    var SEL = '.industry-section, .portfolio-grid > *, .school-grid-card, .person-card, .offer-card, .course-card';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    function stagger(el) {
      var i = 0, p = el;
      while ((p = p.previousElementSibling) && i < 9) i++;
      el.style.transitionDelay = (Math.min(i, 9) * 0.05) + 's';
    }
    function scan() {
      document.querySelectorAll(SEL).forEach(function (el) {
        if (el.__fxr) return;
        el.__fxr = true;
        el.classList.add('fx-reveal');
        stagger(el);
        io.observe(el);
      });
    }
    scan();
    var mo = new MutationObserver(function () { scan(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function boot() { initReveal(); initGenericReveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
