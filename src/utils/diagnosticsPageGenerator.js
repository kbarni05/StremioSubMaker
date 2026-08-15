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
    diagnostics: `/diagnostics${buildQuery(shared)}`,
    configure: `/configure${buildQuery({ config: configStr })}`
  };
}

function generateDiagnosticsPage(configStr, config, videoId = '', filename = '') {
  const lang = config?.uiLanguage || 'en';
  const t = getTranslator(lang);
  const links = buildLinks(configStr, videoId, filename);
  const endpoint = `/api/diagnostics${buildQuery({ config: configStr })}`;
  const devMode = config?.devMode === true;
  const localeBootstrap = buildClientBootstrap(loadLocale(lang));
  const pageData = JSON.stringify({ endpoint, version: appVersion }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${escapeHtml(lang)}" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="dark light">
  <title>${escapeHtml(t('diagnostics.documentTitle', {}, 'System Diagnostics - SubMaker'))}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon-toolbox.svg?v=${escapeHtml(appVersion)}">
  <style>
    :root { --bg:#07111f; --surface:#101d2f; --surface-2:#17263a; --text:#f3f7ff; --muted:#9fb0c7; --border:#29405d; --brand:#38bdf8; --good:#34d399; --warn:#fbbf24; --bad:#fb7185; --shadow:rgba(0,0,0,.32); --primary:#38bdf8; --secondary:#34d399; --text-primary:var(--text); --shadow-color:var(--shadow); --glow:rgba(56,189,248,.2); }
    [data-theme="light"] { --bg:#edf6ff; --surface:#fff; --surface-2:#eef6ff; --text:#112034; --muted:#53657b; --border:#c9dbed; --shadow:rgba(28,65,105,.16); }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; color:var(--text); background:radial-gradient(circle at 20% 0,rgba(56,189,248,.16),transparent 34rem),var(--bg); font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif; }
    button,select { font:inherit; }
    a { color:inherit; }
    .page { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:1.4rem 0 4rem; }
    .hero { display:grid; grid-template-columns:1fr auto; gap:1.2rem; align-items:center; padding:1.4rem; border:1px solid var(--border); border-radius:22px; background:linear-gradient(145deg,rgba(56,189,248,.13),rgba(52,211,153,.05)),var(--surface); box-shadow:0 18px 50px var(--shadow); }
    .eyebrow { margin:0 0 .25rem; color:var(--brand); font-weight:800; letter-spacing:.12em; text-transform:uppercase; font-size:.76rem; }
    h1 { margin:0; font-size:clamp(1.65rem,4vw,2.6rem); line-height:1.1; }
    .hero-copy { margin:.55rem 0 0; color:var(--muted); max-width:700px; }
    .score { --score:0; width:118px; aspect-ratio:1; display:grid; place-items:center; border-radius:50%; background:conic-gradient(var(--good) calc(var(--score) * 1%),var(--surface-2) 0); position:relative; }
    .score::after { content:""; position:absolute; inset:10px; border-radius:50%; background:var(--surface); }
    .score-inner { position:relative; z-index:1; text-align:center; }
    .score-value { display:block; font-size:2rem; font-weight:900; line-height:1; }
    .score-label { color:var(--muted); font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; }
    .toolbar { margin:1rem 0; display:flex; align-items:center; gap:.65rem; flex-wrap:wrap; }
    .status { display:inline-flex; align-items:center; gap:.45rem; color:var(--muted); margin-right:auto; }
    .dot { width:.65rem; height:.65rem; border-radius:50%; background:var(--warn); box-shadow:0 0 0 5px rgba(251,191,36,.12); }
    .status.live .dot { background:var(--good); box-shadow:0 0 0 5px rgba(52,211,153,.12); }
    .btn,.select { border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:11px; padding:.62rem .82rem; min-height:42px; }
    .btn { cursor:pointer; font-weight:750; }
    .btn:hover,.btn:focus-visible { border-color:var(--brand); transform:translateY(-1px); }
    .btn.primary { background:linear-gradient(135deg,#0284c7,#0ea5e9); border-color:transparent; color:white; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.75rem; margin:1rem 0; }
    .metric,.panel { border:1px solid var(--border); border-radius:16px; background:var(--surface); box-shadow:0 10px 30px var(--shadow); }
    .metric { padding:1rem; }
    .metric strong { display:block; font-size:1.45rem; }
    .metric span { color:var(--muted); font-size:.82rem; }
    .grid { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(290px,.8fr); gap:1rem; align-items:start; }
    .panel { padding:1.05rem; margin-bottom:1rem; }
    .panel h2 { margin:0; font-size:1.1rem; }
    .panel-subtitle { margin:.25rem 0 1rem; color:var(--muted); font-size:.86rem; }
    .check-list { display:grid; gap:.65rem; }
    .check { display:grid; grid-template-columns:auto 1fr; gap:.7rem; padding:.8rem; border:1px solid var(--border); border-radius:13px; background:var(--surface-2); }
    .check-icon { width:2rem; height:2rem; display:grid; place-items:center; border-radius:50%; font-weight:900; background:rgba(159,176,199,.12); color:var(--muted); }
    .check.pass .check-icon { color:var(--good); background:rgba(52,211,153,.13); }
    .check.warn .check-icon { color:var(--warn); background:rgba(251,191,36,.13); }
    .check.fail .check-icon { color:var(--bad); background:rgba(251,113,133,.13); }
    .check-title { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; font-weight:800; }
    .badge { padding:.12rem .42rem; border-radius:999px; border:1px solid currentColor; font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
    .check.pass .badge { color:var(--good); } .check.warn .badge { color:var(--warn); } .check.fail .badge { color:var(--bad); }
    .check-detail { margin:.25rem 0 0; color:var(--muted); font-size:.84rem; }
    .facts { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; }
    .fact { padding:.7rem; border-radius:11px; background:var(--surface-2); border:1px solid var(--border); }
    .fact span { display:block; color:var(--muted); font-size:.73rem; }
    .fact strong { display:block; margin-top:.15rem; word-break:break-word; }
    .privacy { padding:.75rem; border:1px solid rgba(52,211,153,.35); border-radius:12px; background:rgba(52,211,153,.07); color:var(--muted); font-size:.82rem; }
    .actions { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; margin-top:.75rem; }
    .actions .btn { width:100%; }
    .skeleton { opacity:.55; animation:pulse 1.25s ease-in-out infinite alternate; }
    @keyframes pulse { to { opacity:.85; } }
    ${quickNavStyles()}
    @media (max-width:820px) { .summary { grid-template-columns:1fr 1fr; } .grid { grid-template-columns:1fr; } }
    @media (max-width:560px) { .page { width:min(100% - 20px,1120px); padding-top:.8rem; } .hero { grid-template-columns:1fr; text-align:center; } .score { margin:auto; width:104px; } .summary { gap:.5rem; } .metric { padding:.78rem; } .facts { grid-template-columns:1fr; } .toolbar { align-items:stretch; } .status { width:100%; } .toolbar .btn,.toolbar .select { flex:1; } .actions { grid-template-columns:1fr; } }
    @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; animation:none!important; transition:none!important; } }
  </style>
  ${localeBootstrap}
</head>
<body>
  ${renderQuickNav(links, 'diagnostics', false, devMode, t)}
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">${escapeHtml(t('diagnostics.eyebrow', {}, 'Operations center'))}</p>
        <h1>${escapeHtml(t('diagnostics.title', {}, 'System Diagnostics'))}</h1>
        <p class="hero-copy">${escapeHtml(t('diagnostics.subtitle', {}, 'A privacy-safe health check for configuration, providers, storage and runtime reliability.'))}</p>
      </div>
      <div class="score" id="healthScore" aria-label="${escapeHtml(t('diagnostics.score.aria', {}, 'Health score'))}">
        <div class="score-inner"><span class="score-value" id="scoreValue">—</span><span class="score-label">${escapeHtml(t('diagnostics.score.label', {}, 'health'))}</span></div>
      </div>
    </section>
    <div class="toolbar">
      <div class="status" id="liveStatus"><span class="dot"></span><span id="statusText">${escapeHtml(t('diagnostics.status.loading', {}, 'Running checks…'))}</span></div>
      <select class="select" id="refreshInterval" aria-label="${escapeHtml(t('diagnostics.refresh.aria', {}, 'Automatic refresh interval'))}">
        <option value="30">${escapeHtml(t('diagnostics.refresh.seconds', { count: 30 }, 'Every 30 seconds'))}</option>
        <option value="60">${escapeHtml(t('diagnostics.refresh.seconds', { count: 60 }, 'Every 60 seconds'))}</option>
        <option value="0">${escapeHtml(t('diagnostics.refresh.off', {}, 'Manual only'))}</option>
      </select>
      <button class="btn primary" id="refreshButton" type="button">${escapeHtml(t('diagnostics.actions.refresh', {}, 'Run checks'))}</button>
    </div>
    <section class="summary" aria-label="${escapeHtml(t('diagnostics.summary.aria', {}, 'Diagnostic summary'))}">
      <div class="metric"><strong id="passCount">—</strong><span>${escapeHtml(t('diagnostics.summary.passed', {}, 'Passed'))}</span></div>
      <div class="metric"><strong id="warningCount">—</strong><span>${escapeHtml(t('diagnostics.summary.warnings', {}, 'Warnings'))}</span></div>
      <div class="metric"><strong id="failCount">—</strong><span>${escapeHtml(t('diagnostics.summary.failed', {}, 'Needs attention'))}</span></div>
      <div class="metric"><strong id="generatedAt">—</strong><span>${escapeHtml(t('diagnostics.summary.updated', {}, 'Last checked'))}</span></div>
    </section>
    <div class="grid">
      <section class="panel">
        <h2>${escapeHtml(t('diagnostics.checks.title', {}, 'Health checks'))}</h2>
        <p class="panel-subtitle">${escapeHtml(t('diagnostics.checks.subtitle', {}, 'Prioritized checks with actionable status.'))}</p>
        <div class="check-list skeleton" id="checkList" aria-live="polite"></div>
      </section>
      <aside>
        <section class="panel">
          <h2>${escapeHtml(t('diagnostics.configuration.title', {}, 'Safe configuration summary'))}</h2>
          <p class="panel-subtitle">${escapeHtml(t('diagnostics.configuration.subtitle', {}, 'Only operational metadata is shown.'))}</p>
          <div class="facts" id="configFacts"></div>
        </section>
        <section class="panel">
          <h2>${escapeHtml(t('diagnostics.runtime.title', {}, 'Runtime snapshot'))}</h2>
          <p class="panel-subtitle">${escapeHtml(t('diagnostics.runtime.subtitle', {}, 'Useful context for troubleshooting.'))}</p>
          <div class="facts" id="runtimeFacts"></div>
        </section>
        <section class="panel">
          <h2>${escapeHtml(t('diagnostics.support.title', {}, 'Support bundle'))}</h2>
          <p class="panel-subtitle">${escapeHtml(t('diagnostics.support.subtitle', {}, 'Copy or download a report for troubleshooting.'))}</p>
          <div class="privacy">${escapeHtml(t('diagnostics.support.privacy', {}, 'API keys, passwords, tokens, prompts and full configuration values are never included.'))}</div>
          <div class="actions">
            <button class="btn" id="copyReport" type="button">${escapeHtml(t('diagnostics.actions.copy', {}, 'Copy report'))}</button>
            <button class="btn" id="downloadReport" type="button">${escapeHtml(t('diagnostics.actions.download', {}, 'Download JSON'))}</button>
          </div>
        </section>
      </aside>
    </div>
  </main>
  <script>window.__DIAGNOSTICS_PAGE__=${pageData};</script>
  <script>
  (() => {
    'use strict';
    const page = window.__DIAGNOSTICS_PAGE__ || {};
    const t = (key, vars, fallback) => window.t ? window.t(key, vars || {}, fallback || key) : (fallback || key);
    const statusIcons = { pass:'✓', warn:'!', fail:'×', info:'i' };
    const checkIds = ['storage','configuration','subtitle-providers','ai-provider','languages','translation-health','rate-limits','event-loop','memory','cache-capacity','mobile-mode'];
    let lastReport = null;
    let timer = null;
    let inFlight = false;
    const byId = id => document.getElementById(id);
    const text = (id, value) => { const node = byId(id); if (node) node.textContent = value; };
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const formatBytes = value => { const bytes=Number(value)||0; if(!bytes)return '0 MB'; return (bytes/1048576).toFixed(bytes>=1073741824?0:1)+' MB'; };
    const formatDuration = seconds => { const s=Math.max(0,Number(seconds)||0); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); return [d?d+'d':'',h?h+'h':'',m?m+'m':''].filter(Boolean).join(' ')||'<1m'; };
    const statusLabel = status => t('diagnostics.status.'+status, {}, ({pass:'Passed',warn:'Warning',fail:'Failed',info:'Info'})[status]||status);
    const checkTitle = id => t('diagnostics.checks.'+id+'.title', {}, id);
    const checkDetail = item => {
      if(item.id==='ai-provider'&&item.value==='not-required')return t('diagnostics.checks.ai-provider.notRequired',{},'Not required in fetch-only mode.');
      if(item.id==='translation-health'&&item.value==null)return t('diagnostics.checks.translation-health.noData',{},'No completed translations to evaluate yet.');
      if(item.id==='mobile-mode'&&item.value==null)return t('diagnostics.checks.mobile-mode.off',{},'Mobile Mode is optional and currently off.');
      return t('diagnostics.checks.'+item.id+'.detail', { value:item.value == null ? '—' : item.value }, String(item.value == null ? '' : item.value));
    };

    function renderFacts(containerId, facts) {
      const container=byId(containerId); if(!container)return;
      container.innerHTML=facts.map(item=>'<div class="fact"><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong></div>').join('');
    }
    function render(report) {
      lastReport=report;
      const score=Math.max(0,Math.min(100,Number(report.score)||0));
      byId('healthScore').style.setProperty('--score',score);
      text('scoreValue',score);
      text('passCount',report.summary?.passed ?? 0); text('warningCount',report.summary?.warnings ?? 0); text('failCount',report.summary?.failed ?? 0);
      text('generatedAt',new Date(report.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      const list=byId('checkList'); list.classList.remove('skeleton');
      const checks=Array.isArray(report.checks)?report.checks:[];
      list.innerHTML=checks.map(item=>'<article class="check '+esc(item.status)+'"><div class="check-icon" aria-hidden="true">'+esc(statusIcons[item.status]||'?')+'</div><div><div class="check-title">'+esc(checkTitle(item.id))+'<span class="badge">'+esc(statusLabel(item.status))+'</span></div><p class="check-detail">'+esc(checkDetail(item))+'</p></div></article>').join('');
      const cfg=report.configuration||{};
      renderFacts('configFacts',[
        [t('diagnostics.configuration.modeLabel',{},'Mode'),t('diagnostics.configuration.mode.'+cfg.mode,{},cfg.mode||'—')],
        [t('diagnostics.configuration.aiProviders',{},'AI providers'),String(cfg.configuredAiProviderCount??0)],
        [t('diagnostics.configuration.subtitleProviders',{},'Subtitle sources'),String(cfg.enabledSubtitleProviderCount??0)],
        [t('diagnostics.configuration.languages',{},'Source / target'),String(cfg.sourceLanguageCount??0)+' / '+String(cfg.targetLanguageCount??0)],
        [t('diagnostics.configuration.fallback',{},'Provider fallback'),cfg.fallbackEnabled?t('diagnostics.value.on',{},'On'):t('diagnostics.value.off',{},'Off')],
        [t('diagnostics.configuration.mobile',{},'Mobile mode'),cfg.mobileMode?t('diagnostics.value.on',{},'On'):t('diagnostics.value.off',{},'Off')]
      ]);
      const run=report.runtime||{};
      renderFacts('runtimeFacts',[
        [t('diagnostics.runtime.platform',{},'Platform'),(run.platform||'—')+' / '+(run.architecture||'—')],
        [t('diagnostics.runtime.node',{},'Node.js'),run.nodeVersion||'—'],
        [t('diagnostics.runtime.cpu',{},'CPU / cores'),String(run.processCpuPercent??0)+'% / '+String(run.cpuCores??0)],
        [t('diagnostics.runtime.memory',{},'Process memory'),formatBytes(run.processMemoryBytes)],
        [t('diagnostics.runtime.eventLoop',{},'Event loop p95'),String(run.eventLoopP95Ms??0)+' ms'],
        [t('diagnostics.runtime.uptime',{},'Uptime'),formatDuration(run.uptimeSeconds)]
      ]);
    }
    async function refresh() {
      if(inFlight||document.hidden)return; inFlight=true;
      const status=byId('liveStatus'); status.classList.remove('live'); text('statusText',t('diagnostics.status.loading',{},'Running checks…'));
      try {
        const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),15000);
        const response=await fetch(page.endpoint,{cache:'no-store',signal:controller.signal}); clearTimeout(timeout);
        if(!response.ok)throw new Error('HTTP '+response.status);
        const report=await response.json(); render(report); status.classList.add('live'); text('statusText',t('diagnostics.status.live',{},'Checks are current'));
      } catch(error) { text('statusText',t('diagnostics.status.failed',{},'Checks could not be refreshed')); }
      finally { inFlight=false; }
    }
    function schedule() { if(timer)clearInterval(timer); const seconds=Number(byId('refreshInterval').value)||0; if(seconds>0)timer=setInterval(refresh,seconds*1000); }
    async function copyReport() {
      if(!lastReport)return; const value=JSON.stringify(lastReport,null,2);
      try { await navigator.clipboard.writeText(value); text('copyReport',t('diagnostics.actions.copied',{},'Copied')); }
      catch(_) { const area=document.createElement('textarea'); area.value=value; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); text('copyReport',t('diagnostics.actions.copied',{},'Copied')); }
      setTimeout(()=>text('copyReport',t('diagnostics.actions.copy',{},'Copy report')),1400);
    }
    function downloadReport() { if(!lastReport)return; const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='submaker-diagnostics-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    byId('refreshButton').addEventListener('click',refresh); byId('refreshInterval').addEventListener('change',schedule); byId('copyReport').addEventListener('click',copyReport); byId('downloadReport').addEventListener('click',downloadReport);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden)refresh(); });
    schedule(); refresh();
  })();
  </script>
  <script>${quickNavScript()}</script>
</body>
</html>`;
}

module.exports = { generateDiagnosticsPage, buildLinks };
