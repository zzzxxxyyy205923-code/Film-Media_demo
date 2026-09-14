/* ═══════════════════════════════════════════
   HERO VIDEO — 首页浮动影像 + 声音开关
   （presentation only，无业务逻辑）

   首页 Hero 里原来那个「浮动 logo 图形」位置，现在播放「2025青年影像展混剪」处理版
   （站内副本 assets/video/kexi-intro-2025-clean-fill.mp4）：
   - 已去除左上角水印并裁掉上下黑边：有效分辨率 1920×816，画面主体宽高比不变；
   - 不裁剪画面主体、不变速、音频直接复制，原始时长 3:02.4
   - 影像铺满「科系介绍」首页的整个可见区域，容器尺寸 = 界面实时显示尺寸；
     视频自身宽高比不变（object-fit:cover 只裁切、不拉伸）；无浮动位移动效
   - 浏览器自动播放策略要求「先静音」，所以默认静音播放
   - 视口右下角的纯图标按钮可一键开关声音（静音 ⇄ 有声），状态另由 aria-label/title 表达
   - 图标只在影像真正可见时出现，且始终留在视口内、保持可点击
   - 播放门控：离开首页（点击其它导航栏）或下滑离开首屏时自动暂停 —— 默认静音播放，暂停后
     声音输出同步停止；回到首屏且影像可见时按原静音状态继续播放
═══════════════════════════════════════════ */
(function () {
  function boot() {
    var video = document.getElementById('hero-video');
    var btn = document.getElementById('hero-video-sound');
    if (!video) return;

    /* ── 影像无法播放时不显示声音开关：不给用户一个「控制不存在的东西」的按钮 ── */
    var dropped = false;
    function drop() { dropped = true; if (btn) btn.hidden = true; }
    video.addEventListener('error', drop);
    var source = video.querySelector('source');
    if (source) source.addEventListener('error', drop);
    if (video.networkState === 3 /* NETWORK_NO_SOURCE */) drop();

    /* 显式声明一次静音：个别浏览器会忽略 HTML 上的 muted 属性 */
    video.muted = true;
    video.defaultMuted = true;

    function play() {
      var p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          /* 自动播放被拦截 → 等用户第一次交互再启动 */
          var kick = function () { video.play().catch(function () {}); };
          document.addEventListener('pointerdown', kick, { once: true });
          document.addEventListener('keydown', kick, { once: true });
        });
      }
    }
    /* ── 播放门控：只在「首页（科系介绍）处于激活态」且「影像在视口内」时播放 ──
       其余情况一律暂停；视频暂停后声音输出随之停止（不需要额外静音，
       这样能保住用户已选择的有声/静音状态，回到首屏时按原状态继续）。覆盖两种情况：
       ① 点击其它导航栏图标（或菜单浮层）跳转到对应页面 —— 含浏览器前进/后退；
       ② 用户下滑，离开首页首屏、影像不再出现在视口内。 */
    var pageHome = document.getElementById('page-home');
    function onHomePage() { return !pageHome || pageHome.classList.contains('is-active'); }
    function onScreen() {
      var r = video.getBoundingClientRect();
      return r.width > 0 && r.height > 0 &&
             r.bottom > 0 && r.top < (window.innerHeight || 0);
    }
    function shouldPlay() { return onHomePage() && onScreen(); }
    function reconcile() {
      if (shouldPlay()) { if (video.paused) play(); }
      else if (!video.paused) video.pause();          /* 暂停 === 同时停止声音输出 */
    }
    var pending = 0;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; reconcile(); });
    }

    /* ① 页面切换：所有 .page 的 is-active 变化（导航栏/菜单/路由都经由这个类名） */
    if (window.MutationObserver) {
      var mo = new MutationObserver(schedule);
      document.querySelectorAll('.page').forEach(function (p) {
        mo.observe(p, { attributes: true, attributeFilter: ['class'] });
      });
    }
    /* ② 滚动进出首屏 / 窗口尺寸变化 / hash 变化 */
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', schedule);
    /* ③ 切到其它标签页或最小化：立即暂停，回来再判定 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (!video.paused) video.pause(); }
      else schedule();
    });

    reconcile();                       /* 初始：不在首页首屏就不播放 */

    if (!btn) return;

    /* ── 显隐：跟随影像的可见性 ── */
    function setShown(on) { btn.hidden = !on; }
    function inView() { return onScreen(); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        setShown(!!entries[0].isIntersecting);
        schedule();                    /* 影像进出视口 → 同步播放/暂停 */
      }, { threshold: 0.08 });
      io.observe(video);
    } else {
      setShown(true);
    }
    /* 兜底：观察器未按预期回调时，也保证影像在视口内就有开关 */
    setTimeout(function () { if (btn.hidden && !dropped && inView()) setShown(true); }, 1400);

    /* ── 状态同步（静音 ⇄ 有声）：按钮无文字，状态只由图标 + 无障碍标签表达 ── */
    function sync() {
      var muted = video.muted || video.volume === 0;
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      btn.title = muted ? '当前静音 · 点击开启声音' : '当前有声 · 点击静音';
      btn.setAttribute('aria-label', muted
        ? '科系介绍影像声音：当前静音，点击开启声音'
        : '科系介绍影像声音：当前有声，点击静音');
    }
    video.addEventListener('volumechange', sync);
    sync();

    /* ── 一键开关声音 ── */
    btn.addEventListener('click', function () {
      video.muted = !video.muted;
      /* 由静音切换到有声时确保画面在播（个别浏览器会暂停静音视频） */
      if (!video.muted && video.paused) video.play().catch(function () {});
      sync();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
