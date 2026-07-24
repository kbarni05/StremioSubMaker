'use strict';

const { version: appVersion } = require('./version');
const { quickNavStyles, quickNavScript, renderQuickNav } = require('./quickNav');
const { buildClientBootstrap, loadLocale, getTranslator } = require('./i18n');

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function buildLinks(configStr, videoId, filename) {
  const shared = { config: configStr, videoId: videoId || '', filename: filename || '' };
  return {
    subToolbox: `/sub-toolbox${buildQuery(shared)}`,
    translateFiles: `/file-upload${buildQuery(shared)}`,
    embeddedSubs: `/embedded-subtitles${buildQuery(shared)}`,
    syncSubtitles: `/subtitle-sync${buildQuery(shared)}`,
    automaticSubs: `/auto-subtitles${buildQuery(shared)}`,
    smdb: `/smdb${buildQuery(shared)}`,
    history: `/sub-history${buildQuery(shared)}`,
    statistics: `/statistics${buildQuery(shared)}`,
    configure: `/configure${buildQuery({ config: configStr })}`
  };
}

function themeToggleMarkup(label) {
  return `<button class="theme-toggle" id="themeToggle" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
    <span class="theme-light" aria-hidden="true">☀</span>
    <span class="theme-dark" aria-hidden="true">☾</span>
    <span class="theme-void" aria-hidden="true">◉</span>
  </button>`;
}

function generateStatisticsPage(configStr, config, videoId = '', filename = '') {
  const lang = config?.uiLanguage || 'en';
  const t = getTranslator(lang);
  const links = buildLinks(configStr, videoId, filename);
  const devMode = config?.devMode === true;
  const endpoint = `/api/statistics${buildQuery({ config: configStr })}`;
  const copy = {
    loading: t('statistics.status.loading', {}, 'Updating metrics…'),
    live: t('statistics.status.live', {}, 'Live'),
    stale: t('statistics.status.stale', {}, 'Showing the last successful snapshot'),
    failed: t('statistics.status.failed', {}, 'Metrics could not be updated'),
    never: t('statistics.value.never', {}, 'Never'),
    noData: t('statistics.value.noData', {}, 'No data yet'),
    noActivity: t('statistics.value.noActivity', {}, 'No recent activity'),
    completed: t('statistics.status.completed', {}, 'Completed'),
    failedCount: t('statistics.status.failedCount', {}, 'Failed'),
    processing: t('statistics.status.processing', {}, 'Processing'),
    cacheHealthy: t('statistics.storage.healthy', {}, 'Connected'),
    cacheUnhealthy: t('statistics.storage.unhealthy', {}, 'Unavailable'),
    insightHealthy: t('statistics.insights.healthy', {}, 'Everything looks healthy. No immediate action is needed.'),
    insightStorage: t('statistics.insights.storageUnhealthy', {}, 'Storage is unavailable. Cached subtitles, sessions, and history may be affected.'),
    insightLoop: t('statistics.insights.eventLoopLag', { value: '{value}' }, 'Event loop delay is elevated ({value} ms p95).'),
    insightMemory: t('statistics.insights.memoryPressure', { value: '{value}' }, 'System memory pressure is high ({value}% used).'),
    insightFailures: t('statistics.insights.translationFailures', { value: '{value}' }, 'Recent translation success is only {value}%. Check provider errors in History.'),
    insightRateLimits: t('statistics.insights.rateLimits', { value: '{value}' }, '{value} recent rate-limit errors were recorded.'),
    insightBusy: t('statistics.insights.busy', { value: '{value}' }, '{value} translations are currently active.'),
    cacheHits: t('statistics.overview.cacheHits', { count: '{count}' }, '{count} hits'),
    trackedStates: t('statistics.overview.trackedStates', { count: '{count}' }, '{count} tracked states'),
    cores: t('statistics.hardware.cores', { count: '{count}' }, '{count} cores'),
    cacheNames: {
      translation: t('statistics.cache.translation', {}, 'Translations'),
      bypass: t('statistics.cache.bypass', {}, 'Bypass'),
      partial: t('statistics.cache.partial', {}, 'Partial jobs'),
      sync: t('statistics.cache.sync', {}, 'Synced subtitles'),
      session: t('statistics.cache.session', {}, 'Sessions'),
      history: t('statistics.cache.history', {}, 'History'),
      embedded: t('statistics.cache.embedded', {}, 'Embedded'),
      autosub: t('statistics.cache.autoSub', {}, 'Auto subtitles'),
      provider_meta: t('statistics.cache.providerMetadata', {}, 'Provider metadata'),
      smdb: t('statistics.cache.smdb', {}, 'SMDB')
    }
  };

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}" data-third-theme="true-dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('statistics.documentTitle', {}, 'Statistics & Performance - SubMaker'))}</title>
  ${buildClientBootstrap(loadLocale(lang))}
  <link rel="icon" type="image/svg+xml" href="/favicon-toolbox.svg?_cb=${escapeHtml(appVersion || 'dev')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <script>
    (function () {
      var saved = null;
      try { saved = localStorage.getItem('theme'); } catch (_) {}
      var theme = saved === 'light' || saved === 'dark' || saved === 'true-dark' ? saved : 'dark';
      if (theme === 'blackhole') theme = 'true-dark';
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
  <style>
    * { box-sizing: border-box; }
    :root {
      color-scheme: light;
      --bg: #f3f7fb; --surface: #fff; --surface-2: #edf4f8; --text: #102134;
      --muted: #637386; --border: #d8e3eb; --primary: #0798c7; --primary-2: #6b5cff;
      --success: #15966f; --warning: #d38411; --danger: #dc4c64; --shadow: 0 18px 45px rgba(28, 55, 78, .1);
      --text-primary: var(--text); --text-secondary: var(--muted); --secondary: var(--primary-2);
      --shadow-color: rgba(28, 55, 78, .1); --glow: rgba(8, 164, 213, .22);
    }
    [data-theme="dark"] {
      color-scheme: dark;
      --bg: #101526; --surface: #181f34; --surface-2: #222b43; --text: #f1f5fb;
      --muted: #aab6c8; --border: #303a55; --primary: #33b9e1; --primary-2: #887cff;
      --success: #36d39b; --warning: #ffc15a; --danger: #ff6f85; --shadow: 0 18px 50px rgba(0, 0, 0, .28);
    }
    [data-theme="true-dark"] {
      color-scheme: dark;
      --bg: #05070d; --surface: #0d111c; --surface-2: #141a29; --text: #f6f7fb;
      --muted: #9ca8ba; --border: #252e43; --primary: #58c7e9; --primary-2: #988cff;
      --success: #42dda6; --warning: #ffc15a; --danger: #ff7089; --shadow: 0 18px 55px rgba(0, 0, 0, .55);
    }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: Inter, sans-serif; }
    body::before {
      content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .7;
      background: radial-gradient(circle at 8% 4%, rgba(8,164,213,.13), transparent 34%),
                  radial-gradient(circle at 88% 16%, rgba(107,92,255,.12), transparent 32%);
    }
    ${quickNavStyles()}
    .theme-toggle {
      position: fixed; top: 1rem; right: 1rem; z-index: 12050; width: 44px; height: 44px;
      border: 1px solid var(--border); border-radius: 13px; background: var(--surface);
      color: var(--text); box-shadow: var(--shadow); cursor: pointer; font-size: 1.25rem;
    }
    .theme-dark, .theme-void { display: none; }
    [data-theme="dark"] .theme-light { display: none; }
    [data-theme="dark"] .theme-dark { display: inline; }
    [data-theme="true-dark"] .theme-light { display: none; }
    [data-theme="true-dark"] .theme-void { display: inline; }
    .page { position: relative; width: min(1420px, calc(100% - 4rem)); margin: 0 auto; padding: 2rem 0 4rem; }
    .masthead {
      display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem;
      margin-bottom: 1.25rem; padding-right: 4rem;
    }
    .eyebrow { margin: 0 0 .45rem; color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: .13em; font-size: .74rem; }
    h1, h2 { font-family: "Space Grotesk", sans-serif; }
    h1 { margin: 0; font-size: clamp(2rem, 4vw, 3.7rem); letter-spacing: -.045em; }
    .lede { margin: .5rem 0 0; color: var(--muted); max-width: 720px; line-height: 1.55; }
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: .55rem; }
    .control, .action {
      min-height: 42px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
      color: var(--text); padding: .68rem .85rem; font: inherit;
    }
    .action { cursor: pointer; font-weight: 700; }
    .action.primary { background: var(--primary); border-color: var(--primary); color: #03151b; }
    .status-row {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .78rem 1rem;
      border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--surface) 88%, transparent);
      margin-bottom: 1rem; color: var(--muted); font-size: .88rem;
    }
    .status-copy { display: flex; align-items: center; gap: .55rem; }
    .live-dot { width: 9px; height: 9px; border-radius: 999px; background: var(--warning); box-shadow: 0 0 0 5px color-mix(in srgb, var(--warning) 18%, transparent); }
    .live-dot.ok { background: var(--success); box-shadow: 0 0 0 5px color-mix(in srgb, var(--success) 18%, transparent); }
    .live-dot.error { background: var(--danger); box-shadow: 0 0 0 5px color-mix(in srgb, var(--danger) 18%, transparent); }
    .overview { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .metric, .panel {
      border: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 94%, transparent);
      border-radius: 18px; box-shadow: var(--shadow);
    }
    .metric { padding: 1.1rem; min-width: 0; }
    .metric-label { color: var(--muted); font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .metric-value { margin-top: .45rem; font-family: "Space Grotesk"; font-size: clamp(1.45rem, 3vw, 2.25rem); overflow-wrap: anywhere; }
    .metric-meta { margin-top: .3rem; color: var(--muted); font-size: .78rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.38fr) minmax(320px, .82fr); gap: 1rem; align-items: start; }
    .column { display: grid; gap: 1rem; }
    .panel { padding: 1.15rem; overflow: hidden; }
    .panel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin-bottom: 1rem; }
    .panel h2 { font-size: 1.05rem; margin: 0; }
    .panel-sub { color: var(--muted); font-size: .78rem; }
    .status-grid, .hardware-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .65rem; }
    .mini { padding: .8rem; border: 1px solid var(--border); border-radius: 13px; background: var(--surface-2); }
    .mini span { display: block; color: var(--muted); font-size: .73rem; }
    .mini strong { display: block; margin-top: .3rem; font-size: 1.05rem; overflow-wrap: anywhere; }
    .chart { display: flex; align-items: flex-end; gap: .55rem; min-height: 150px; padding-top: 1rem; }
    .day { flex: 1; min-width: 0; text-align: center; }
    .day-stack { height: 112px; display: flex; flex-direction: column-reverse; justify-content: flex-start; border-radius: 8px; overflow: hidden; background: var(--surface-2); }
    .day-ok { background: var(--success); min-height: 0; }
    .day-bad { background: var(--danger); min-height: 0; }
    .day-label { margin-top: .4rem; font-size: .68rem; color: var(--muted); }
    .rankings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .ranking-title { margin: 0 0 .65rem; color: var(--muted); font-size: .76rem; font-weight: 700; text-transform: uppercase; }
    .rank { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .35rem .7rem; margin: .65rem 0; font-size: .82rem; }
    .rank-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rank-bar { grid-column: 1 / -1; height: 6px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
    .rank-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-2)); border-radius: inherit; }
    .insight { display: flex; gap: .7rem; padding: .8rem; border-radius: 12px; border: 1px solid var(--border); margin-top: .65rem; font-size: .82rem; line-height: 1.45; }
    .insight.success { border-color: color-mix(in srgb, var(--success) 45%, var(--border)); }
    .insight.warning { border-color: color-mix(in srgb, var(--warning) 55%, var(--border)); }
    .insight.critical { border-color: color-mix(in srgb, var(--danger) 55%, var(--border)); }
    .cache-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem .8rem; margin: .8rem 0; font-size: .8rem; }
    .cache-bar { grid-column: 1 / -1; height: 7px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
    .cache-bar span { display: block; height: 100%; background: var(--primary); border-radius: inherit; }
    .muted { color: var(--muted); }
    .skeleton { position: relative; overflow: hidden; color: transparent !important; border-radius: 7px; background: var(--surface-2); }
    .skeleton::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent); animation: shimmer 1.3s infinite; }
    @keyframes shimmer { to { transform: translateX(100%); } }
    @media (max-width: 1050px) {
      .overview { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 700px) {
      .page { width: min(100% - 1rem, 1420px); padding-top: 4.5rem; }
      .masthead { display: block; padding-right: 0; }
      .toolbar { margin-top: 1rem; }
      .overview { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; }
      .metric, .panel { border-radius: 15px; }
      .metric { padding: .85rem; }
      .status-grid, .hardware-grid { grid-template-columns: repeat(2, 1fr); }
      .rankings { grid-template-columns: 1fr; }
      .status-row { align-items: flex-start; flex-direction: column; }
    }
    @media (max-width: 390px) {
      .overview, .status-grid, .hardware-grid { grid-template-columns: 1fr; }
      .toolbar .control { max-width: none; flex: 1 1 170px; }
    }
  </style>
  <script src="/js/theme-toggle.js?_cb=${escapeHtml(appVersion || 'dev')}" defer></script>
</head>
<body>
  ${themeToggleMarkup(t('fileUpload.themeToggle', {}, 'Toggle theme'))}
  ${renderQuickNav(links, 'statistics', false, devMode, t)}
  <main class="page">
    <header class="masthead">
      <div>
        <p class="eyebrow">${escapeHtml(t('statistics.eyebrow', {}, 'Operations dashboard'))}</p>
        <h1>${escapeHtml(t('statistics.title', {}, 'Statistics & Performance'))}</h1>
        <p class="lede">${escapeHtml(t('statistics.subtitle', {}, 'Translation quality, addon health, cache usage, and runtime performance in one place.'))}</p>
      </div>
      <div class="toolbar">
        <select class="control" id="refreshInterval" aria-label="${escapeHtml(t('statistics.refresh.interval', {}, 'Automatic refresh interval'))}">
          <option value="15">${escapeHtml(t('statistics.refresh.seconds', { count: 15 }, 'Every 15 seconds'))}</option>
          <option value="30" selected>${escapeHtml(t('statistics.refresh.seconds', { count: 30 }, 'Every 30 seconds'))}</option>
          <option value="60">${escapeHtml(t('statistics.refresh.seconds', { count: 60 }, 'Every 60 seconds'))}</option>
          <option value="0">${escapeHtml(t('statistics.refresh.off', {}, 'Auto refresh off'))}</option>
        </select>
        <button class="action primary" id="refreshNow" type="button">${escapeHtml(t('statistics.refresh.now', {}, 'Refresh now'))}</button>
        <a class="action" href="${escapeHtml(links.history)}">${escapeHtml(t('statistics.actions.history', {}, 'Translation history'))}</a>
      </div>
    </header>

    <div class="status-row" role="status" aria-live="polite">
      <div class="status-copy"><span class="live-dot" id="liveDot"></span><strong id="liveStatus">${escapeHtml(copy.loading)}</strong></div>
      <span id="lastUpdated">${escapeHtml(t('statistics.status.waiting', {}, 'Waiting for the first snapshot'))}</span>
    </div>

    <section class="overview" aria-label="${escapeHtml(t('statistics.overview.title', {}, 'Overview'))}">
      <article class="metric"><div class="metric-label">${escapeHtml(t('statistics.overview.successRate', {}, 'Success rate'))}</div><div class="metric-value skeleton" data-value="successRate">--</div><div class="metric-meta" data-meta="successRate"></div></article>
      <article class="metric"><div class="metric-label">${escapeHtml(t('statistics.overview.averageTime', {}, 'Average translation'))}</div><div class="metric-value skeleton" data-value="averageTime">--</div><div class="metric-meta" data-meta="averageTime"></div></article>
      <article class="metric"><div class="metric-label">${escapeHtml(t('statistics.overview.translatedEntries', {}, 'Subtitle entries'))}</div><div class="metric-value skeleton" data-value="entries">--</div><div class="metric-meta">${escapeHtml(t('statistics.overview.recentWindow', {}, 'Recent history window'))}</div></article>
      <article class="metric"><div class="metric-label">${escapeHtml(t('statistics.overview.cacheHitRate', {}, 'Cache hit rate'))}</div><div class="metric-value skeleton" data-value="cacheRate">--</div><div class="metric-meta" data-meta="cacheRate"></div></article>
      <article class="metric"><div class="metric-label">${escapeHtml(t('statistics.overview.activeJobs', {}, 'Active translations'))}</div><div class="metric-value skeleton" data-value="activeJobs">--</div><div class="metric-meta" data-meta="activeJobs"></div></article>
    </section>

    <div class="layout">
      <div class="column">
        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.translation.title', {}, 'Translation activity'))}</h2><span class="panel-sub">${escapeHtml(t('statistics.translation.recent', {}, 'Newest 20 requests'))}</span></div>
          <div class="status-grid">
            <div class="mini"><span>${escapeHtml(copy.completed)}</span><strong data-value="completed">--</strong></div>
            <div class="mini"><span>${escapeHtml(copy.failedCount)}</span><strong data-value="failed">--</strong></div>
            <div class="mini"><span>${escapeHtml(copy.processing)}</span><strong data-value="processing">--</strong></div>
          </div>
          <div class="chart" id="dailyChart" aria-label="${escapeHtml(t('statistics.translation.dailyChart', {}, 'Seven-day translation activity'))}"></div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.breakdown.title', {}, 'Usage breakdown'))}</h2><span class="panel-sub">${escapeHtml(t('statistics.breakdown.subtitle', {}, 'What handles your translations'))}</span></div>
          <div class="rankings">
            <div><h3 class="ranking-title">${escapeHtml(t('statistics.breakdown.providers', {}, 'Providers'))}</h3><div id="providerRanking"></div></div>
            <div><h3 class="ranking-title">${escapeHtml(t('statistics.breakdown.targets', {}, 'Target languages'))}</h3><div id="targetRanking"></div></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.hardware.title', {}, 'Runtime & hardware'))}</h2><span class="panel-sub" id="runtimeIdentity">--</span></div>
          <div class="hardware-grid">
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.cpu', {}, 'Process CPU'))}</span><strong data-value="cpu">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.memory', {}, 'Process memory'))}</span><strong data-value="rss">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.systemMemory', {}, 'System memory'))}</span><strong data-value="systemMemory">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.eventLoop', {}, 'Event loop p95'))}</span><strong data-value="eventLoop">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.uptime', {}, 'Uptime'))}</span><strong data-value="uptime">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.hardware.connections', {}, 'Open HTTP sockets'))}</span><strong data-value="sockets">--</strong></div>
          </div>
        </section>
      </div>

      <aside class="column">
        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.insights.title', {}, 'Health insights'))}</h2><span class="panel-sub">${escapeHtml(t('statistics.insights.subtitle', {}, 'Actionable checks'))}</span></div>
          <div id="insights"></div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.storage.title', {}, 'Storage & caches'))}</h2><span class="panel-sub" id="storageStatus">--</span></div>
          <div id="cacheList"></div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${escapeHtml(t('statistics.addon.title', {}, 'Addon workload'))}</h2><span class="panel-sub">v${escapeHtml(appVersion || 'n/a')}</span></div>
          <div class="hardware-grid">
            <div class="mini"><span>${escapeHtml(t('statistics.addon.sessions', {}, 'Stored sessions'))}</span><strong data-value="sessions">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.addon.pendingHttp', {}, 'Pending HTTP'))}</span><strong data-value="pendingHttp">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.addon.rateLimits', {}, 'Recent 429 errors'))}</span><strong data-value="rateLimits">--</strong></div>
            <div class="mini"><span>${escapeHtml(t('statistics.addon.fallbacks', {}, 'Provider fallbacks'))}</span><strong data-value="fallbacks">--</strong></div>
          </div>
        </section>
      </aside>
    </div>
  </main>

  <script src="/js/sw-register.js?_cb=${escapeHtml(appVersion || 'dev')}"></script>
  <script>
    (function () {
      'use strict';
      const ENDPOINT = ${JSON.stringify(endpoint)};
      const COPY = ${JSON.stringify(copy)};
      const state = { timer: null, controller: null, hasData: false };
      const byValue = name => document.querySelector('[data-value="' + name + '"]');
      const byMeta = name => document.querySelector('[data-meta="' + name + '"]');
      const number = value => new Intl.NumberFormat(document.documentElement.lang || 'en').format(Number(value) || 0);
      const percent = value => value === null || value === undefined ? '—' : (Number(value).toFixed(Number(value) % 1 ? 1 : 0) + '%');
      const escape = value => String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      const bytes = value => {
        let current = Math.max(0, Number(value) || 0);
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unit = 0;
        while (current >= 1024 && unit < units.length - 1) { current /= 1024; unit += 1; }
        return (current >= 100 || unit === 0 ? current.toFixed(0) : current.toFixed(1)) + ' ' + units[unit];
      };
      const duration = value => {
        const ms = Math.max(0, Number(value) || 0);
        if (!ms) return '—';
        if (ms < 1000) return Math.round(ms) + ' ms';
        const seconds = Math.round(ms / 1000);
        if (seconds < 60) return seconds + ' s';
        return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
      };
      const uptime = value => {
        let seconds = Math.max(0, Math.floor(Number(value) || 0));
        const days = Math.floor(seconds / 86400); seconds %= 86400;
        const hours = Math.floor(seconds / 3600); seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        return [days ? days + 'd' : '', hours ? hours + 'h' : '', minutes ? minutes + 'm' : '', (!days && !hours && !minutes) ? seconds + 's' : ''].filter(Boolean).join(' ');
      };
      function setValue(name, value) {
        const element = byValue(name);
        if (!element) return;
        element.textContent = value;
        element.classList.remove('skeleton');
      }
      function setMeta(name, value) {
        const element = byMeta(name);
        if (element) element.textContent = value || '';
      }
      function renderRanking(id, items, total) {
        const host = document.getElementById(id);
        if (!host) return;
        if (!Array.isArray(items) || !items.length) {
          host.innerHTML = '<p class="muted">' + escape(COPY.noData) + '</p>';
          return;
        }
        const maximum = Math.max(1, ...items.map(item => Number(item.count) || 0));
        host.innerHTML = items.map(item => {
          const width = Math.max(4, ((Number(item.count) || 0) / maximum) * 100);
          const share = total ? Math.round(((Number(item.count) || 0) / total) * 100) : 0;
          return '<div class="rank"><span class="rank-name" title="' + escape(item.name) + '">' + escape(item.name) +
            '</span><strong>' + number(item.count) + ' · ' + share + '%</strong><div class="rank-bar"><span style="width:' +
            width + '%"></span></div></div>';
        }).join('');
      }
      function renderDaily(items) {
        const host = document.getElementById('dailyChart');
        if (!host) return;
        if (!Array.isArray(items) || !items.length) {
          host.innerHTML = '<p class="muted">' + escape(COPY.noActivity) + '</p>';
          return;
        }
        const maximum = Math.max(1, ...items.map(item => (Number(item.completed) || 0) + (Number(item.failed) || 0) + (Number(item.processing) || 0)));
        host.innerHTML = items.map(item => {
          const ok = Number(item.completed) || 0;
          const bad = (Number(item.failed) || 0) + (Number(item.processing) || 0);
          const okHeight = (ok / maximum) * 100;
          const badHeight = (bad / maximum) * 100;
          const label = new Date(item.date + 'T12:00:00Z').toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'short' });
          return '<div class="day" title="' + escape(item.date + ': ' + (ok + bad)) + '"><div class="day-stack">' +
            '<div class="day-ok" style="height:' + okHeight + '%"></div><div class="day-bad" style="height:' + badHeight +
            '%"></div></div><div class="day-label">' + escape(label) + '</div></div>';
        }).join('');
      }
      function renderCaches(storage) {
        const host = document.getElementById('cacheList');
        const status = document.getElementById('storageStatus');
        if (status) {
          status.textContent = (storage && storage.healthy ? COPY.cacheHealthy : COPY.cacheUnhealthy) +
            (storage && storage.type ? ' · ' + storage.type : '');
        }
        const caches = storage && Array.isArray(storage.caches) ? storage.caches : [];
        if (!caches.length) {
          host.innerHTML = '<p class="muted">' + escape(COPY.noData) + '</p>';
          return;
        }
        host.innerHTML = caches.map(cache => {
          const label = COPY.cacheNames[cache.type] || cache.type;
          const utilization = Math.max(0, Math.min(100, Number(cache.utilizationPercent) || 0));
          const limit = Number(cache.limitBytes) > 0 ? ' / ' + bytes(cache.limitBytes) : '';
          return '<div class="cache-row"><span>' + escape(label) + '</span><strong>' + bytes(cache.currentBytes) + escape(limit) +
            '</strong><div class="cache-bar"><span style="width:' + utilization + '%"></span></div></div>';
        }).join('');
      }
      function insightMessage(insight) {
        const value = insight && insight.value;
        const table = {
          'healthy': COPY.insightHealthy,
          'storage-unhealthy': COPY.insightStorage,
          'event-loop-lag': COPY.insightLoop,
          'memory-pressure': COPY.insightMemory,
          'translation-failures': COPY.insightFailures,
          'rate-limits': COPY.insightRateLimits,
          'busy': COPY.insightBusy
        };
        return String(table[insight.code] || insight.code || '').replace(/\\{value\\}/g, value === null ? '' : value);
      }
      function renderInsights(items) {
        const host = document.getElementById('insights');
        const insights = Array.isArray(items) && items.length ? items : [{ level: 'success', code: 'healthy' }];
        const icons = { success: '✓', info: 'i', warning: '!', critical: '×' };
        host.innerHTML = insights.map(item => '<div class="insight ' + escape(item.level) + '"><strong>' +
          (icons[item.level] || 'i') + '</strong><span>' + escape(insightMessage(item)) + '</span></div>').join('');
      }
      function render(snapshot) {
        const history = snapshot.history || {};
        const status = history.status || {};
        const runtime = snapshot.runtime || {};
        const addon = snapshot.addon || {};
        const pool = addon.connections || {};
        const http = pool.http || {};
        const https = pool.https || {};
        const cache = addon.translationCache || {};
        const sessions = addon.sessions || {};
        const success = history.successRate;
        const historyCacheRate = history.cacheRate;
        const operationalCacheRate = cache.hitRate;
        const effectiveCacheRate = operationalCacheRate === null || operationalCacheRate === undefined ? historyCacheRate : operationalCacheRate;

        setValue('successRate', percent(success));
        setMeta('successRate', number(status.completed || 0) + ' / ' + number((status.completed || 0) + (status.failed || 0)));
        setValue('averageTime', duration(history.averageDurationMs));
        setMeta('averageTime', 'p95 ' + duration(history.p95DurationMs));
        setValue('entries', number(history.subtitleEntries));
        setValue('cacheRate', percent(effectiveCacheRate));
        setMeta('cacheRate', COPY.cacheHits.replace(/\\{count\\}/g, number(cache.hits || history.cached || 0)));
        setValue('activeJobs', number(addon.activeTranslations));
        setMeta('activeJobs', COPY.trackedStates.replace(/\\{count\\}/g, number(addon.translationStatuses)));
        setValue('completed', number(status.completed));
        setValue('failed', number(status.failed));
        setValue('processing', number(status.processing));
        setValue('cpu', percent(runtime.processCpuPercent));
        setValue('rss', bytes(runtime.processMemory && runtime.processMemory.rssBytes));
        setValue('systemMemory', percent(runtime.systemMemory && runtime.systemMemory.usedPercent));
        setValue('eventLoop', (runtime.eventLoop && runtime.eventLoop.p95Ms || 0) + ' ms');
        setValue('uptime', uptime(runtime.uptimeSeconds));
        setValue('sockets', number((http.totalSockets || 0) + (https.totalSockets || 0)));
        setValue('sessions', number(sessions.storageSessionCount));
        setValue('pendingHttp', number((http.pendingRequests || 0) + (https.pendingRequests || 0)));
        setValue('rateLimits', number(history.rateLimitErrors));
        setValue('fallbacks', number(history.fallbackUses));

        const identity = document.getElementById('runtimeIdentity');
        if (identity) identity.textContent = COPY.cores.replace(/\\{count\\}/g, number(runtime.cpuCores || 0)) + ' · ' + (runtime.architecture || '') + ' · ' + (runtime.nodeVersion || '');
        renderDaily(history.daily);
        renderRanking('providerRanking', history.providers, history.total);
        renderRanking('targetRanking', history.targets, history.total);
        renderCaches(snapshot.storage || {});
        renderInsights(snapshot.insights);
      }
      function setStatus(kind, message, timestamp) {
        const dot = document.getElementById('liveDot');
        const label = document.getElementById('liveStatus');
        const updated = document.getElementById('lastUpdated');
        if (dot) dot.className = 'live-dot' + (kind === 'ok' ? ' ok' : (kind === 'error' ? ' error' : ''));
        if (label) label.textContent = message;
        if (updated && timestamp) updated.textContent = new Date(timestamp).toLocaleString();
      }
      async function refresh() {
        if (state.controller) state.controller.abort();
        state.controller = new AbortController();
        const timeout = setTimeout(() => state.controller.abort(), 12000);
        const button = document.getElementById('refreshNow');
        if (button) button.disabled = true;
        setStatus('loading', COPY.loading);
        try {
          const response = await fetch(ENDPOINT + '&_ts=' + Date.now(), { cache: 'no-store', signal: state.controller.signal });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const data = await response.json();
          render(data);
          state.hasData = true;
          setStatus('ok', COPY.live, data.generatedAt || Date.now());
        } catch (error) {
          setStatus('error', state.hasData ? COPY.stale : COPY.failed);
        } finally {
          clearTimeout(timeout);
          if (button) button.disabled = false;
        }
      }
      function schedule() {
        if (state.timer) clearInterval(state.timer);
        const select = document.getElementById('refreshInterval');
        const seconds = Number(select && select.value) || 0;
        try { localStorage.setItem('submaker_statistics_refresh', String(seconds)); } catch (_) {}
        if (seconds > 0) state.timer = setInterval(() => {
          if (!document.hidden && navigator.onLine !== false) refresh();
        }, seconds * 1000);
      }
      const select = document.getElementById('refreshInterval');
      try {
        const saved = localStorage.getItem('submaker_statistics_refresh');
        if (saved && select && [...select.options].some(option => option.value === saved)) select.value = saved;
      } catch (_) {}
      select && select.addEventListener('change', schedule);
      document.getElementById('refreshNow')?.addEventListener('click', refresh);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.hasData) refresh();
      });
      schedule();
      refresh();
    })();
  </script>
  <script>${quickNavScript()}</script>
</body>
</html>`;
}

module.exports = { generateStatisticsPage, buildLinks };
