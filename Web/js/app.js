// ═══════════════════════════════════════════════════════════════
//  Bannerlord Encyclopedia — Main Application v2
//  Live Chronicle · Cinematic animations · Enhanced UI
// ═══════════════════════════════════════════════════════════════

// ── State ──
const Store = {
  heroes: [], clans: [], settlements: [], kingdoms: [],
  status: null, connected: false,
  filters: { heroes: 'all', clans: 'all', settlements: 'all', kingdoms: 'all' },
  listPage: { heroes: 1, clans: 1, settlements: 1, kingdoms: 1 },
  pageSize: 60,
  currentPage: 'home', detailType: null
};

// ── Utility ──
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function textToHtml(s) {
  if (!s) return '';
  let h = esc(s);
  // Parse game entity tags — make them clickable links
  // Angle brackets: <h:id>Name</h>  |  Guillemets: «h:id»Name«/h»
  h = h.replace(/&lt;h:([^&]+)&gt;(.+?)&lt;\/h&gt;/g, '<a class="tag-hero tag-link" onclick="openDetail(\'heroes\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/&lt;k:([^&]+)&gt;(.+?)&lt;\/k&gt;/g, '<a class="tag-kingdom tag-link" onclick="openDetail(\'kingdoms\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/&lt;s:([^&]+)&gt;(.+?)&lt;\/s&gt;/g, '<a class="tag-settlement tag-link" onclick="openDetail(\'settlements\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/&lt;c:([^&]+)&gt;(.+?)&lt;\/c&gt;/g, '<a class="tag-clan tag-link" onclick="openDetail(\'clans\',\'$1\');return false" href="#">$2</a>');
  // Guillemet format: «h:id»Name«/h»
  h = h.replace(/«h:([^»]+)»(.+?)«\/h»/g, '<a class="tag-hero tag-link" onclick="openDetail(\'heroes\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/«k:([^»]+)»(.+?)«\/k»/g, '<a class="tag-kingdom tag-link" onclick="openDetail(\'kingdoms\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/«s:([^»]+)»(.+?)«\/s»/g, '<a class="tag-settlement tag-link" onclick="openDetail(\'settlements\',\'$1\');return false" href="#">$2</a>');
  h = h.replace(/«c:([^»]+)»(.+?)«\/c»/g, '<a class="tag-clan tag-link" onclick="openDetail(\'clans\',\'$1\');return false" href="#">$2</a>');
  // Category tags like [War], [Family], [Politics]
  h = h.replace(/\[War\]/g, '<span class="tag-cat tag-war">[War]</span>');
  h = h.replace(/\[Family\]/g, '<span class="tag-cat tag-family">[Family]</span>');
  h = h.replace(/\[Politics\]/g, '<span class="tag-cat tag-politics">[Politics]</span>');
  h = h.replace(/\[Crime\]/g, '<span class="tag-cat tag-crime">[Crime]</span>');
  // Markdown
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h = h.replace(/\n/g,'<br>');
  return h;
}
function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return (p[0]?.[0] || '?').toUpperCase() + (p[1]?.[0] || '').toUpperCase();
}
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : s || ''; }
function getCultureColor(culture) {
  const c = (culture || '').toLowerCase();
  const map = { empire:'#7b2d8e', aserai:'#d4a43a', battania:'#2d6b2e', khuzait:'#2d8e8e', sturgia:'#3366aa', vlandia:'#aa3333', nord:'#4a6a7a' };
  if (map[c]) return map[c];
  for (const [k, v] of Object.entries(map)) if (c.includes(k)) return v;
  return '#6b5b3e';
}
// Resolve a raw entity ID to a display name + type for linking
function resolveEntity(entityId) {
  if (!entityId) return null;
  for (const type of ['heroes','clans','settlements','kingdoms']) {
    const arr = Store[type] || [];
    const found = arr.find(x => x.id === entityId);
    if (found) return { name: found.name, type, id: entityId };
  }
  return null;
}
function entityBadge(entityId) {
  const e = resolveEntity(entityId);
  if (e) {
    const cls = e.type === 'heroes' ? 'hero' : e.type === 'kingdoms' ? 'kingdom' : e.type === 'settlements' ? 'settlement' : 'clan';
    return `<a class="lc-entity tag-link tag-${cls}" onclick="openDetail('${e.type}','${esc(e.id)}');return false" href="#">${esc(e.name)}</a>`;
  }
  // Hide raw ID if it can't be resolved — the entity name is already shown inline via textToHtml
  return '';
}
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

// ── Toast notifications ──
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 400); }, 3000);
}

// ── Navigation ──
// Pages where the Player HUD bar is relevant (campaign/party-action pages)
// On browsing pages (Heroes/Clans/Kingdoms list, etc.) the HUD is hidden to save space.
const HUD_VISIBLE_PAGES = new Set(['home', 'commander', 'map', 'detail']);

function showPage(name) {
  // Stop detail sync when navigating away from detail view
  if (name !== 'detail') stopDetailSync();
  Store.currentPage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(`page-${name}`);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });
  // Context-aware Player HUD visibility
  document.body.classList.toggle('hide-hud', !HUD_VISIBLE_PAGES.has(name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Refresh current page data when navigating
  if (name === 'commander') renderCommander();
  else if (name === 'map') {
    initMapInteractions();
    renderMap();
  }
  else if (name === 'api') { renderApiDocs(); }
  else if (name === 'stats') { renderStatsDashboard(); }
  else refreshData().then(() => refreshCurrentPage());
}

// ── Sound FX (synthesized Web Audio) ──
let _audioCtx = null;
let _soundEnabled = localStorage.getItem('soundEnabled') === '1';
window._soundVolume = parseInt(localStorage.getItem('soundVolume') || '50');
window._soundEvents = {
  click: localStorage.getItem('soundEvent_click') !== '0',
  hover: localStorage.getItem('soundEvent_hover') === '1', // default off (hovers can be noisy)
  open:  localStorage.getItem('soundEvent_open')  !== '0',
};
window._soundPresetIdx = parseInt(localStorage.getItem('soundPresetIdx') || '0');

const SOUND_PRESETS = [
  { id:'default',   name:'Default',    desc:'Clean synth tones',    icon:'\u{1F3B5}',
    click:{freq:660,dur:0.08,type:'triangle'},
    hover:{freq:440,dur:0.04,type:'sine'},
    open:[{freq:520,dur:0.12,type:'sine'},{freq:700,dur:0.12,type:'sine',delay:60}] },
  { id:'horn',      name:'Horn',       desc:'Deep medieval brass',  icon:'\u{1F4EF}',
    click:{freq:220,dur:0.14,type:'sawtooth'},
    hover:{freq:330,dur:0.05,type:'triangle'},
    open:[{freq:165,dur:0.22,type:'sawtooth'},{freq:220,dur:0.22,type:'sawtooth',delay:80}] },
  { id:'parchment', name:'Parchment',  desc:'Soft paper rustle',    icon:'\u{1F4DC}',
    click:{freq:1200,dur:0.05,type:'sine'},
    hover:{freq:1800,dur:0.03,type:'sine'},
    open:[{freq:800,dur:0.1,type:'sine'},{freq:1100,dur:0.08,type:'sine',delay:40}] },
  { id:'clash',     name:'Steel',      desc:'Sharp metal ring',     icon:'\u{2694}',
    click:{freq:1800,dur:0.06,type:'square'},
    hover:{freq:2400,dur:0.03,type:'square'},
    open:[{freq:1500,dur:0.1,type:'square'},{freq:2000,dur:0.12,type:'square',delay:50}] },
];

function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { _audioCtx = null; }
  }
  return _audioCtx;
}
function playTone(freq, duration, type) {
  if (!_soundEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const vol = Math.max(0, Math.min(1, (_soundVolume / 100))) * 0.08;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
  // Animated EQ pulse
  document.querySelectorAll('.prefs-eq-bar').forEach(b => {
    b.classList.remove('eq-pulse');
    void b.offsetWidth;
    b.classList.add('eq-pulse');
  });
}
function _playEvent(which) {
  if (!_soundEnabled) return;
  const preset = SOUND_PRESETS[_soundPresetIdx] || SOUND_PRESETS[0];
  if (which === 'open' && _soundEvents.open) {
    (preset.open || []).forEach(n => {
      setTimeout(() => playTone(n.freq, n.dur, n.type), n.delay || 0);
    });
  } else if (which === 'click' && _soundEvents.click) {
    const p = preset.click;
    playTone(p.freq, p.dur, p.type);
  } else if (which === 'hover' && _soundEvents.hover) {
    const p = preset.hover;
    playTone(p.freq, p.dur, p.type);
  }
}
function sfxClick() { _playEvent('click'); }
function sfxHover() { _playEvent('hover'); }
function sfxOpen()  { _playEvent('open'); }
function testSoundEvent(which) {
  // Test bypasses the per-event toggle so user can always hear it
  if (!_soundEnabled) { showToast('Enable sound first', true); return; }
  const wasOn = _soundEvents[which];
  _soundEvents[which] = true;
  _playEvent(which);
  _soundEvents[which] = wasOn;
}
function setSoundVolume(v) {
  _soundVolume = Math.max(0, Math.min(100, parseInt(v) || 0));
  try { localStorage.setItem('soundVolume', String(_soundVolume)); } catch(e) {}
  playTone(600, 0.08, 'triangle');
  const lbl = document.getElementById('prefsVolLabel');
  if (lbl) lbl.textContent = _soundVolume + '%';
}
function toggleSoundEvent(which) {
  _soundEvents[which] = !_soundEvents[which];
  try { localStorage.setItem('soundEvent_' + which, _soundEvents[which] ? '1' : '0'); } catch(e) {}
  if (_soundEvents[which]) _playEvent(which);
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
function pickSoundPreset(idx) {
  _soundPresetIdx = idx;
  try { localStorage.setItem('soundPresetIdx', String(idx)); } catch(e) {}
  _playEvent('open');
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
function toggleSound() {
  _soundEnabled = !_soundEnabled;
  localStorage.setItem('soundEnabled', _soundEnabled ? '1' : '0');
  const icon = document.getElementById('soundToggleIcon');
  if (icon) icon.innerHTML = _soundEnabled ? '&#x1F50A;' : '&#x1F507;';
  const sicon = document.getElementById('sidebarSoundIcon');
  if (sicon) sicon.innerHTML = _soundEnabled ? '&#x1F50A;' : '&#x1F507;';
  if (_soundEnabled) _playEvent('open');
  showToast('Sound ' + (_soundEnabled ? 'enabled' : 'muted'));
}
// Wire global click SFX on buttons
document.addEventListener('click', (ev) => {
  if (!_soundEnabled) return;
  const btn = ev.target.closest('button, .nav a, .cmd-tab, .inv-mode, .kd-policy-row, .cp-row, .map-btn');
  if (btn) sfxClick();
});
// Init sound icon state on load
document.addEventListener('DOMContentLoaded', () => {
  const icon = document.getElementById('soundToggleIcon');
  if (icon) icon.innerHTML = _soundEnabled ? '&#x1F50A;' : '&#x1F507;';
});

// ── Theme variants — re-implemented via CSS variables on <html> (no filter:) ──
window._themes = [
  { id:'parchment', name:'Parchment',  color:'#d4b878', glow:'rgba(216,179,95,.35)',  tagline:'Classic gold — the default',
    swatches:['#16130e','#2c2010','#d4b878','#f5d878'] },
  { id:'iron',      name:'Iron',       color:'#a8b4c4', glow:'rgba(168,180,196,.35)', tagline:'Cool forged steel',
    swatches:['#0a0b0d','#1a1e24','#a8b4c4','#c8d4e4'] },
  { id:'oak',       name:'Oak',        color:'#d8a050', glow:'rgba(216,160,80,.35)',  tagline:'Warm forest brown',
    swatches:['#0d0905','#2c2010','#d8a050','#f5c878'] },
  { id:'imperial',  name:'Imperial',   color:'#a878d0', glow:'rgba(168,120,208,.35)', tagline:'Empire purple & violet',
    swatches:['#0a0710','#1e1228','#a878d0','#d0a8e8'] },
  { id:'desert',    name:'Desert',     color:'#e8c450', glow:'rgba(232,196,80,.35)',  tagline:'Aserai sand & amber',
    swatches:['#0d0905','#2c2010','#e8c450','#f8e488'] },
  { id:'highland',  name:'Highland',   color:'#80c078', glow:'rgba(128,192,120,.35)', tagline:'Battania forest green',
    swatches:['#060a06','#0e1808','#80c078','#a8e098'] },
  { id:'steppe',    name:'Steppe',     color:'#68c0c0', glow:'rgba(104,192,192,.35)', tagline:'Khuzait open sky teal',
    swatches:['#050c0c','#0a1818','#68c0c0','#98e0e0'] },
  { id:'northern',  name:'Northern',   color:'#6090d0', glow:'rgba(96,144,208,.35)',  tagline:'Sturgia winter blue',
    swatches:['#050810','#0a1420','#6090d0','#98b8e8'] },
  { id:'crimson',   name:'Crimson',    color:'#d06048', glow:'rgba(208,96,72,.35)',   tagline:'Vlandia burgundy & fire',
    swatches:['#100605','#2c120a','#d06048','#e88870'] },
];
window._themeIdx = parseInt(localStorage.getItem('themeIdx') || '0');
if (_themeIdx >= _themes.length) _themeIdx = 0;

function applyTheme() {
  const html = document.documentElement;
  _themes.forEach(t => html.classList.remove('theme-' + t.id));
  const t = _themes[_themeIdx];
  if (t && t.id !== 'parchment') html.classList.add('theme-' + t.id);
}
function cycleTheme() {
  _themeIdx = (_themeIdx + 1) % _themes.length;
  localStorage.setItem('themeIdx', _themeIdx);
  applyTheme();
  showToast('Theme: ' + _themes[_themeIdx].name);
}
function pickTheme(idx) {
  _themeIdx = idx;
  try { localStorage.setItem('themeIdx', String(idx)); } catch(e) {}
  document.body.classList.add('theme-switching');
  setTimeout(() => document.body.classList.remove('theme-switching'), 600);
  applyTheme();
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
applyTheme();

// ── Density modes: compact / normal / comfortable ──
window._density = localStorage.getItem('density') || 'normal';
if (_density === 'compact') document.body.classList.add('compact');
else if (_density === 'comfortable') document.body.classList.add('comfortable');
function setDensity(d) {
  _density = d;
  document.body.classList.remove('compact', 'comfortable');
  if (d === 'compact') document.body.classList.add('compact');
  else if (d === 'comfortable') document.body.classList.add('comfortable');
  try { localStorage.setItem('density', d); } catch(e) {}
  // Brief scale pulse so the change is felt
  document.body.classList.add('density-switching');
  setTimeout(() => document.body.classList.remove('density-switching'), 400);
  showToast('Density: ' + d.charAt(0).toUpperCase() + d.slice(1));
  // Refresh any open prefs dialog to update segment active state
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
// Legacy alias
function toggleCompact() {
  setDensity(_density === 'compact' ? 'normal' : 'compact');
}

// ── Preferences modal — unified settings hub ──
function openPreferences() {
  let overlay = document.getElementById('prefsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'prefsOverlay';
    overlay.className = 'prefs-overlay';
    overlay.innerHTML = `
      <div class="prefs-modal">
        <div class="prefs-embers"></div>
        <div class="prefs-header">
          <div class="prefs-gear">\u{2699}</div>
          <div class="prefs-title-block">
            <div class="prefs-kicker">\u{2606} The Living Archive</div>
            <div class="prefs-title">Preferences</div>
          </div>
          <button class="prefs-close" onclick="document.getElementById('prefsOverlay').classList.remove('open')">&times;</button>
        </div>
        <div class="prefs-body" id="prefsBody"></div>
        <div class="prefs-footer">
          <button class="prefs-btn" onclick="resetPreferences()">\u{1F504} Reset to Defaults</button>
          <button class="prefs-btn primary" onclick="document.getElementById('prefsOverlay').classList.remove('open')">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    // Inject embers
    const em = overlay.querySelector('.prefs-embers');
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('span');
      sp.style.left = (Math.random() * 100) + '%';
      sp.style.animationDuration = (12 + Math.random() * 12) + 's';
      sp.style.animationDelay = (Math.random() * 8) + 's';
      em.appendChild(sp);
    }
  }
  overlay.classList.add('open');
  renderPreferencesBody();
}

function renderPreferencesBody() {
  const el = document.getElementById('prefsBody');
  if (!el) return;
  const d = _density;
  const fsIdx = _fsIdx;
  const theme = _themes[_themeIdx];
  const sidebar = document.body.classList.contains('sidebar-nav');
  const sound = _soundEnabled;

  let html = '';

  // Density — preview cards
  const densityOptions = [
    { id:'compact',     icon:'\u{2B1B}', name:'Compact',     tagline:'See more at a glance',     rows:4, rowH:6, rowGap:3 },
    { id:'normal',      icon:'\u{1F5C3}', name:'Normal',      tagline:'Balanced — the default',   rows:3, rowH:9, rowGap:5 },
    { id:'comfortable', icon:'\u{1F3DB}', name:'Comfortable', tagline:'Extra room to breathe',    rows:2, rowH:14, rowGap:9 },
  ];
  html += `<div class="prefs-card">
    <div class="prefs-card-head"><span class="prefs-card-icon">\u{1F5C2}</span><span class="prefs-card-title">Layout Density</span></div>
    <div class="prefs-card-desc">How tightly information is packed into each page — applies instantly to every list and panel</div>
    <div class="prefs-density-grid">`;
  densityOptions.forEach(opt => {
    const isActive = d === opt.id;
    // Build mini preview rectangles
    let preview = '<div class="prefs-density-preview">';
    for (let i = 0; i < opt.rows; i++) {
      preview += `<div class="prefs-density-row" style="height:${opt.rowH}px;margin-bottom:${opt.rowGap}px"></div>`;
    }
    preview += '</div>';
    html += `<button class="prefs-density-card ${isActive?'active':''}" onclick="setDensity('${opt.id}')">
      <div class="prefs-theme-check">\u{2713}</div>
      ${preview}
      <div class="prefs-density-name">${esc(opt.name)}</div>
      <div class="prefs-density-tagline">${esc(opt.tagline)}</div>
    </button>`;
  });
  html += `</div>
  </div>`;

  // Typography — size + family + line-height + live preview
  html += `<div class="prefs-card">
    <div class="prefs-card-head"><span class="prefs-card-icon">\u{1F520}</span><span class="prefs-card-title">Typography</span></div>
    <div class="prefs-card-desc">Scale, family, and line height — every page updates instantly</div>

    <div class="prefs-sublabel">Size</div>
    <div class="prefs-seg">`;
  _fsLevels.forEach((lvl, i) => {
    html += `<button class="${i===_fsIdx?'active':''}" onclick="pickFontSize(${i})" title="${lvl.size}">${esc(lvl.label)}</button>`;
  });
  html += `</div>

    <div class="prefs-sublabel">Font Family</div>
    <div class="prefs-family-grid">`;
  _fontFamilies.forEach((f, i) => {
    html += `<button class="prefs-family-card ${i===_fontFamilyIdx?'active':''}" onclick="pickFontFamily(${i})">
      <div class="prefs-family-sample" style="font-family:${f.css}">Aa</div>
      <div class="prefs-family-name">${esc(f.name)}</div>
      <div class="prefs-family-desc">${esc(f.desc)}</div>
    </button>`;
  });
  html += `</div>

    <div class="prefs-sublabel">Line Spacing</div>
    <div class="prefs-seg">`;
  _lineHeightLevels.forEach((l, i) => {
    html += `<button class="${i===_lineHeightIdx?'active':''}" onclick="pickLineHeight(${i})">${esc(l.label)}</button>`;
  });
  html += `</div>

    <div class="prefs-sublabel">Live Preview</div>
    <div class="prefs-preview" style="font-family:${_fontFamilies[_fontFamilyIdx].css};line-height:${_lineHeightLevels[_lineHeightIdx].val}">
      <div class="prefs-preview-title">The Living Chronicle of Calradia</div>
      <div class="prefs-preview-text">Lords and ladies wage war across the realm, their banners rising over castles old as the Empire itself. Chronicle their deeds — and your own.</div>
    </div>
  </div>`;

  // Theme — preview grid of 9 themes
  html += `<div class="prefs-card">
    <div class="prefs-card-head"><span class="prefs-card-icon">\u{1F3A8}</span><span class="prefs-card-title">Color Theme</span></div>
    <div class="prefs-card-desc">9 themes inspired by Calradian cultures — click to preview instantly</div>
    <div class="prefs-theme-grid">`;
  _themes.forEach((t, idx) => {
    const isActive = idx === _themeIdx;
    const styleVars = `--pt-color:${t.color};--pt-glow:${t.glow}`;
    const swatchHtml = t.swatches.map(s => `<span class="prefs-theme-swatch" style="background:${s}"></span>`).join('');
    html += `<button class="prefs-theme-card ${isActive?'active':''}" style="${styleVars}" onclick="pickTheme(${idx})">
      <div class="prefs-theme-check">\u{2713}</div>
      <div class="prefs-theme-name">${esc(t.name)}</div>
      <div class="prefs-theme-swatches">${swatchHtml}</div>
      <div class="prefs-theme-tagline">${esc(t.tagline)}</div>
    </button>`;
  });
  html += `</div>
  </div>`;

  // Navigation style
  html += `<div class="prefs-card">
    <div class="prefs-card-head"><span class="prefs-card-icon">\u{2630}</span><span class="prefs-card-title">Navigation Style</span></div>
    <div class="prefs-card-desc">Where the page menu lives</div>
    <div class="prefs-seg">
      <button class="${!sidebar?'active':''}" onclick="if(document.body.classList.contains('sidebar-nav'))toggleSidebarNav();renderPreferencesBody()">Top Bar</button>
      <button class="${sidebar?'active':''}" onclick="if(!document.body.classList.contains('sidebar-nav'))toggleSidebarNav();renderPreferencesBody()">Sidebar Rail</button>
    </div>
  </div>`;

  // Sound FX — full panel
  html += `<div class="prefs-card">
    <div class="prefs-card-head">
      <span class="prefs-card-icon">\u{1F50A}</span>
      <span class="prefs-card-title">Sound Effects</span>
      <div class="prefs-toggle ${sound?'on':''}" onclick="toggleSound();renderPreferencesBody()">
        <div class="prefs-toggle-track"></div>
      </div>
    </div>
    <div class="prefs-card-desc">Synthesized UI sounds via Web Audio — no audio files required</div>`;

  if (sound) {
    // Volume slider
    html += `<div class="prefs-sublabel">Volume</div>
    <div class="prefs-volume-row">
      <span class="prefs-vol-icon">\u{1F507}</span>
      <input type="range" class="prefs-vol-slider" min="0" max="100" value="${_soundVolume}" oninput="setSoundVolume(this.value)">
      <span class="prefs-vol-icon">\u{1F50A}</span>
      <span class="prefs-vol-label" id="prefsVolLabel">${_soundVolume}%</span>
    </div>

    <div class="prefs-sublabel">Sound Theme</div>
    <div class="prefs-sound-grid">`;
    SOUND_PRESETS.forEach((p, i) => {
      const isActive = i === _soundPresetIdx;
      html += `<button class="prefs-sound-card ${isActive?'active':''}" onclick="pickSoundPreset(${i})">
        <div class="prefs-theme-check">\u{2713}</div>
        <div class="prefs-sound-icon">${p.icon}</div>
        <div class="prefs-sound-name">${esc(p.name)}</div>
        <div class="prefs-sound-desc">${esc(p.desc)}</div>
      </button>`;
    });
    html += `</div>

    <div class="prefs-sublabel">Events</div>
    <div class="prefs-events">`;
    const events = [
      { id:'click', icon:'\u{1F5B1}', label:'Click', desc:'When you tap buttons' },
      { id:'hover', icon:'\u{1F446}', label:'Hover', desc:'When you brush over items' },
      { id:'open',  icon:'\u{1F4E2}', label:'Open',  desc:'When panels and modals appear' },
    ];
    events.forEach(e => {
      const on = _soundEvents[e.id];
      html += `<div class="prefs-event-row">
        <div class="prefs-event-icon">${e.icon}</div>
        <div class="prefs-event-info">
          <div class="prefs-event-name">${esc(e.label)}</div>
          <div class="prefs-event-desc">${esc(e.desc)}</div>
        </div>
        <button class="prefs-event-test" onclick="testSoundEvent('${e.id}')" title="Test sound">\u{25B6} Test</button>
        <div class="prefs-toggle ${on?'on':''}" onclick="toggleSoundEvent('${e.id}')">
          <div class="prefs-toggle-track"></div>
        </div>
      </div>`;
    });
    html += `</div>

    <div class="prefs-eq">
      <div class="prefs-eq-bar" style="animation-delay:0s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.08s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.16s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.24s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.32s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.4s"></div>
      <div class="prefs-eq-bar" style="animation-delay:.48s"></div>
    </div>`;
  }

  html += '</div>';

  el.innerHTML = html;
}

function resetPreferences() {
  setDensity('normal');
  _fsIdx = 2; applyFontSize(); localStorage.setItem('fsIdx','2');
  _fontFamilyIdx = 0; applyFontFamily(); localStorage.setItem('fontFamilyIdx','0');
  _lineHeightIdx = 1; applyLineHeight(); localStorage.setItem('lineHeightIdx','1');
  _themeIdx = 0; applyTheme(); localStorage.setItem('themeIdx','0');
  if (document.body.classList.contains('sidebar-nav')) toggleSidebarNav();
  if (!_soundEnabled) toggleSound();
  renderPreferencesBody();
  showToast('Preferences reset to defaults');
}

// ── Font size + family + line height ──
const _fsLevels = [
  { cls:'fs-xsmall', label:'X-Small', size:'13px' },
  { cls:'fs-small',  label:'Small',   size:'14px' },
  { cls:'',          label:'Normal',  size:'16px' },
  { cls:'fs-large',  label:'Large',   size:'17px' },
  { cls:'fs-xl',     label:'X-Large', size:'19px' },
];
window._fsIdx = parseInt(localStorage.getItem('fsIdx') || '2');
if (_fsIdx >= _fsLevels.length) _fsIdx = 2;
// Migrate old format (0=Normal, 1=Large, 2=XL)
if (localStorage.getItem('fsMigrated') !== '1') {
  const old = parseInt(localStorage.getItem('fsIdx') || '0');
  _fsIdx = old === 0 ? 2 : old === 1 ? 3 : old === 2 ? 4 : 2;
  try { localStorage.setItem('fsIdx', String(_fsIdx)); localStorage.setItem('fsMigrated', '1'); } catch(e) {}
}

const _fontFamilies = [
  { id:'classical', name:'Classical',   desc:'Cinzel + Georgia (default)',        css:`'Cinzel','Georgia','Times New Roman',serif` },
  { id:'medieval',  name:'Medieval',    desc:'Gothic blackletter accents',        css:`'UnifrakturMaguntia','Cinzel','Georgia',serif` },
  { id:'manuscript',name:'Manuscript',  desc:'Old book, warm & calligraphic',     css:`'Palatino Linotype','Book Antiqua','Georgia',serif` },
  { id:'system',    name:'System',      desc:'Fast modern sans for readability',  css:`system-ui,-apple-system,Segoe UI,Roboto,sans-serif` },
];
window._fontFamilyIdx = parseInt(localStorage.getItem('fontFamilyIdx') || '0');
if (_fontFamilyIdx >= _fontFamilies.length) _fontFamilyIdx = 0;

const _lineHeightLevels = [
  { id:'tight',  label:'Tight',  val:1.35 },
  { id:'normal', label:'Normal', val:1.6 },
  { id:'loose',  label:'Loose',  val:1.85 },
];
window._lineHeightIdx = parseInt(localStorage.getItem('lineHeightIdx') || '1');

function applyFontSize() {
  const html = document.documentElement;
  _fsLevels.forEach(l => { if (l.cls) html.classList.remove(l.cls); });
  const lvl = _fsLevels[_fsIdx];
  if (lvl && lvl.cls) html.classList.add(lvl.cls);
}
function applyFontFamily() {
  const f = _fontFamilies[_fontFamilyIdx];
  if (f) document.documentElement.style.setProperty('--font-family-base', f.css);
}
function applyLineHeight() {
  const l = _lineHeightLevels[_lineHeightIdx];
  if (l) document.documentElement.style.setProperty('--line-height-base', l.val);
}
function pickFontSize(idx) {
  _fsIdx = idx;
  try { localStorage.setItem('fsIdx', String(idx)); } catch(e) {}
  applyFontSize();
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
function pickFontFamily(idx) {
  _fontFamilyIdx = idx;
  try { localStorage.setItem('fontFamilyIdx', String(idx)); } catch(e) {}
  applyFontFamily();
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
function pickLineHeight(idx) {
  _lineHeightIdx = idx;
  try { localStorage.setItem('lineHeightIdx', String(idx)); } catch(e) {}
  applyLineHeight();
  if (document.querySelector('.prefs-overlay.open')) renderPreferencesBody();
}
function cycleFontSize() {
  pickFontSize((_fsIdx + 1) % _fsLevels.length);
  showToast('Font size: ' + _fsLevels[_fsIdx].label);
}
applyFontSize();
applyFontFamily();
applyLineHeight();

// ── Sidebar fixed-rail nav ──
if (localStorage.getItem('sidebarNav') === '1') document.body.classList.add('sidebar-nav');
function toggleSidebarNav() {
  document.body.classList.toggle('sidebar-nav');
  const on = document.body.classList.contains('sidebar-nav');
  localStorage.setItem('sidebarNav', on ? '1' : '0');
  if (on) buildSidebarRail();
  showToast('Sidebar nav ' + (on ? 'on' : 'off'));
}
function toggleRailCollapse() {
  document.body.classList.toggle('rail-collapsed');
  try { localStorage.setItem('railCollapsed', document.body.classList.contains('rail-collapsed') ? '1' : '0'); } catch(e) {}
}

function buildSidebarRail() {
  if (document.querySelector('.sidebar-rail')) return;
  if (localStorage.getItem('railCollapsed') === '1') document.body.classList.add('rail-collapsed');
  const rail = document.createElement('aside');
  rail.className = 'sidebar-rail';

  const links = [
    ['home','&#9750;','Home'],['commander','&#x2655;','Commander'],
    ['heroes','&#x2694;','Heroes'],['clans','&#x1F6E1;','Clans'],
    ['settlements','&#x1F3F0;','Settlements'],['kingdoms','&#x1F451;','Kingdoms'],
    ['chronicle','&#x1F4DC;','Chronicle'],['map','&#x1F5FA;','Map'],
    ['rankings','&#x1F3C6;','Rankings'],
    ['stats','&#x1F4CA;','Stats'],['api','&#x1F9E9;','API'],
  ];

  let html = '<div class="sidebar-rail-embers"></div>';

  // Header: logo + brand + collapse toggle
  html += `<div class="sidebar-rail-head">
    <div class="sidebar-rail-logo">\u{1F4DC}</div>
    <div class="sidebar-rail-brand sr-hide-collapsed"><b>Editable</b>Encyclopedia</div>
    <button class="sidebar-rail-collapse" onclick="toggleRailCollapse()" title="Collapse / expand rail">&#x25C0;</button>
  </div>`;

  // Mini player HUD
  html += `<div class="sidebar-rail-hud sr-hide-collapsed" id="sidebarRailHud" onclick="showPage('commander')" title="Open Commander">
    <img id="sidebarRailHudPortrait" src="Hero/bannerlord_hero_viking.png" onerror="this.src='Hero/bannerlord_hero_viking.png'">
    <div class="sidebar-rail-hud-info">
      <div class="sidebar-rail-hud-name" id="sidebarRailHudName">&mdash;</div>
      <div class="sidebar-rail-hud-stats" id="sidebarRailHudStats"></div>
    </div>
  </div>`;

  // Calendar block
  html += `<div class="sidebar-rail-cal sr-hide-collapsed">
    <div class="sidebar-rail-cal-icon" id="sidebarRailCalIcon">\u{1F337}</div>
    <div class="sidebar-rail-cal-info">
      <div class="sidebar-rail-cal-date" id="sidebarRailCalDate">&mdash;</div>
      <div class="sidebar-rail-cal-season" id="sidebarRailCalSeason">Spring in Calradia</div>
    </div>
  </div>`;

  // Links
  html += '<div class="sidebar-rail-links">';
  html += links.map(([k,i,l]) => `<a href="#" class="sidebar-rail-link" data-page="${k}" title="${l}" onclick="event.preventDefault();showPage('${k}');document.querySelectorAll('.sidebar-rail-link').forEach(a=>a.classList.remove('active'));this.classList.add('active')"><span>${i}</span><span class="sr-hide-collapsed">${l}</span><span class="sidebar-rail-link-badge sr-hide-collapsed" id="srBadge-${k}" style="display:none">0</span></a>`).join('');
  html += '</div>';

  // Search
  html += '<div class="sidebar-rail-search sr-hide-collapsed"><input type="text" id="sidebarSearchInput" placeholder="&#x1F50D; Search..."></div>';

  // Actions
  html += '<div class="sidebar-rail-actions">';
  html += '<button onclick="openCommandPalette()" title="Command palette (Ctrl+K)">&#x1F50D;</button>';
  html += '<button onclick="document.getElementById(\'kbdHelpOverlay\').classList.add(\'open\')" title="Keyboard help">&#x2753;</button>';
  html += '<button onclick="toggleSound()" title="Sound effects"><span id="sidebarSoundIcon">'+(_soundEnabled?'&#x1F50A;':'&#x1F507;')+'</span></button>';
  html += '<button onclick="openPreferences()" title="Preferences">&#x2699;</button>';
  html += '<button onclick="openChangelog()" title="About">&#x2139;</button>';
  html += '<button onclick="openHeroCompare()" title="Compare heroes">&#x2696;</button>';
  html += '<button onclick="showTradeRoutes&&showTradeRoutes()" title="Trade routes">&#x1F4B0;</button>';
  html += '<button onclick="toggleSidebarNav()" title="Back to top nav">&#x2630;</button>';
  html += '</div>';

  // Status pill
  html += '<div class="sidebar-rail-pill sr-hide-collapsed" id="sidebarRailPill"><b>&mdash;</b><span>Awaiting campaign</span></div>';

  rail.innerHTML = html;
  document.body.appendChild(rail);

  // Inject embers
  const em = rail.querySelector('.sidebar-rail-embers');
  for (let i = 0; i < 12; i++) {
    const sp = document.createElement('span');
    sp.style.left = (Math.random() * 100) + '%';
    sp.style.animationDuration = (14 + Math.random() * 12) + 's';
    sp.style.animationDelay = (Math.random() * 8) + 's';
    em.appendChild(sp);
  }

  // Wire search to global search handler
  const si = rail.querySelector('#sidebarSearchInput');
  if (si) {
    si.addEventListener('input', (e) => {
      const gs = document.getElementById('globalSearch');
      if (gs) { gs.value = e.target.value; gs.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }

  // Mark current page active
  const cur = document.querySelector('.page.active');
  if (cur) {
    const id = cur.id.replace('page-', '');
    rail.querySelector(`.sidebar-rail-link[data-page="${id}"]`)?.classList.add('active');
  }

  // Initial population
  updateSidebarRailHud();
  updateSidebarRailBadges();
}

function updateSidebarRailHud() {
  const status = Store.status || {};
  const hudName = document.getElementById('sidebarRailHudName');
  const hudStats = document.getElementById('sidebarRailHudStats');
  const hudPortrait = document.getElementById('sidebarRailHudPortrait');
  if (!hudName) return;
  hudName.textContent = status.player || '\u2014';
  if (hudStats) {
    const gold = status.gold || 0;
    const inf = status.influence || 0;
    const troops = status.troops || 0;
    const hp = status.hitPoints || 0;
    const fmt = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : v;
    hudStats.innerHTML = `<span>\u{1FA99}<b>${fmt(gold)}</b></span><span>\u{2726}<b>${fmt(inf)}</b></span><span>\u{2694}<b>${troops}</b></span><span>\u{2764}<b>${Math.round(hp)}</b></span>`;
  }
  if (hudPortrait) {
    const playerHero = (Store.heroes || []).find(h => h.name === status.player);
    if (playerHero) hudPortrait.src = getPortraitSrc(playerHero, playerHero);
  }
  // Calendar
  const calDate = document.getElementById('sidebarRailCalDate');
  const calSeason = document.getElementById('sidebarRailCalSeason');
  const calIcon = document.getElementById('sidebarRailCalIcon');
  if (calDate) calDate.textContent = status.date || '\u2014';
  const season = _seasonFromDate(status.date || '');
  if (calSeason) calSeason.textContent = season.name + ' in Calradia';
  if (calIcon) calIcon.textContent = season.icon;
  // Status pill
  const pill = document.getElementById('sidebarRailPill');
  if (pill) pill.innerHTML = `<b>${esc(status.player || '\u2014')}</b><span>${esc(status.date || '')}</span>`;
}

function updateSidebarRailBadges() {
  // Notifications badge on Home
  const notifs = _notifLastData || [];
  const crit = notifs.filter(n => n.priority === 'critical' || n.priority === 'high').length;
  const homeBadge = document.getElementById('srBadge-home');
  if (homeBadge) {
    if (crit > 0) { homeBadge.textContent = crit; homeBadge.style.display = 'inline-block'; }
    else homeBadge.style.display = 'none';
  }
  // Kingdoms at war badge
  const atWarCount = (Store.kingdoms || []).filter(k => (k.wars || []).length > 0).length;
  const kBadge = document.getElementById('srBadge-kingdoms');
  if (kBadge) {
    if (atWarCount > 0) { kBadge.textContent = atWarCount; kBadge.style.display = 'inline-block'; }
    else kBadge.style.display = 'none';
  }
}
if (document.body.classList.contains('sidebar-nav')) document.addEventListener('DOMContentLoaded', buildSidebarRail);

// ── Custom medieval cursor — always on ──
document.body.classList.add('medieval-cursor');

// ── Parallax hero banner — applied to .hero-art (NOT .hero-banner) so fixed modals are safe ──
document.addEventListener('mousemove', (e) => {
  if (document.querySelector('#page-home.active') == null) return;
  const art = document.querySelector('#page-home .hero-art');
  if (!art) return;
  const w = window.innerWidth, h = window.innerHeight;
  const dx = (e.clientX / w - 0.5) * 14;
  const dy = (e.clientY / h - 0.5) * 8;
  art.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
});

// ── Clan power rankings ──
window._cprSort = 'strength';
window._cprFilter = 'all';
window._cprSearch = '';
window._cprGroup = false;
window._cprShowAll = false;
window._cprPrev = JSON.parse(localStorage.getItem('cprPrev') || '{}');

function setRankingSort(k) { _cprSort = k; renderClanRankings(); }
function setRankingFilter(f) { _cprFilter = f; renderClanRankings(); }
function setRankingSearch(v) { _cprSearch = v.toLowerCase(); renderClanRankings(); }
function toggleRankingGroup() { _cprGroup = !_cprGroup; renderClanRankings(); }
function toggleRankingShowAll() { _cprShowAll = !_cprShowAll; renderClanRankings(); }

function exportRankingsCSV() {
  const clans = (Store.clans || []).slice().sort((a,b)=>(Number(b[_cprSort])||0)-(Number(a[_cprSort])||0));
  let csv = 'Rank,Clan,Tier,Leader,Kingdom,Members,Strength,Renown,Influence,Wealth,Fiefs\n';
  clans.forEach((c, i) => {
    const cells = [i+1, c.name, c.tier||0, c.leader||'', c.kingdom||'', c.members||0,
      c.strength||0, c.renown||0, c.influence||0, c.wealth||0, c.fiefs||0];
    csv += cells.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'clan_rankings.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Exported clan_rankings.csv');
}

function _cprTrend(id, val) {
  const prev = _cprPrev[id];
  if (prev == null || prev === val) return '';
  const diff = val - prev;
  return diff > 0
    ? `<span class="cpr-trend cpr-trend-up">&#9650;${diff}</span>`
    : `<span class="cpr-trend cpr-trend-down">&#9660;${-diff}</span>`;
}

async function renderClanRankings() {
  const el = document.getElementById('rankingsBody');
  if (!el) return;
  if (!el.innerHTML.includes('cpr-table')) el.innerHTML = '<div class="loading-spinner"></div>';

  // Inject embers into rankings dashboard once
  if (!document.querySelector('#page-rankings .stats-embers')) {
    const dash = document.querySelector('#page-rankings .stats-dashboard');
    if (dash) {
      const em = document.createElement('div');
      em.className = 'stats-embers';
      for (let i = 0; i < 16; i++) {
        const sp = document.createElement('span');
        sp.style.left = (Math.random() * 100) + '%';
        sp.style.animationDuration = (12 + Math.random() * 12) + 's';
        sp.style.animationDelay = (Math.random() * 8) + 's';
        em.appendChild(sp);
      }
      dash.insertBefore(em, dash.firstChild);
    }
  }

  const sortKey = _cprSort;
  let allClans = (Store.clans || []).slice();
  const playerClanData = await API.getPlayerClan().catch(()=>null);
  const playerClanId = playerClanData?.id;

  // Filter
  if (_cprFilter === 'atwar') {
    allClans = allClans.filter(c => (c.wars || []).length > 0);
  } else if (_cprFilter === 'atpeace') {
    allClans = allClans.filter(c => (c.wars || []).length === 0);
  } else if (_cprFilter === 'mykingdom') {
    const myKingdom = playerClanData?.kingdom;
    if (myKingdom) allClans = allClans.filter(c => c.kingdom === myKingdom);
  } else if (_cprFilter === 'independent') {
    allClans = allClans.filter(c => !c.kingdom || c.kingdom === '');
  } else if (_cprFilter === 'minor') {
    allClans = allClans.filter(c => c.isMinorFaction);
  }

  // Search
  if (_cprSearch) {
    allClans = allClans.filter(c => (c.name||'').toLowerCase().includes(_cprSearch));
  }

  // Sort
  allClans.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));

  const showCount = _cprShowAll ? allClans.length : Math.min(60, allClans.length);
  const top = allClans.slice(0, showCount);
  const max = {};
  ['strength','renown','influence','wealth'].forEach(k => {
    max[k] = Math.max(1, ...top.map(c => Number(c[k]) || 0));
  });

  // Player rank in current view
  const playerRank = allClans.findIndex(c => c.id === playerClanId) + 1;

  let html = '';

  // Top 3 podium
  html += '<div class="cpr-podium">';
  const podiumOrder = [1, 0, 2]; // silver, gold, bronze layout
  const podiumPlaces = ['silver', 'gold', 'bronze'];
  const podiumMedals = ['&#x2161;', '&#x2160;', '&#x2162;'];
  podiumOrder.forEach((idx, slot) => {
    const c = top[idx];
    if (!c) { html += '<div></div>'; return; }
    const banner = c.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
    const leader = (Store.heroes || []).find(h => h.name === c.leader);
    const leaderImg = leader ? getPortraitSrc(leader, leader) : '';
    const v = Number(c[sortKey]) || 0;
    html += `<div class="cpr-podium-card ${podiumPlaces[slot]}" onclick="openDetail('clans','${esc(c.id)}')">
      <div class="cpr-podium-card-shimmer"></div>
      <div class="cpr-podium-medal">${podiumMedals[slot]}</div>
      ${banner ? `<img class="cpr-podium-banner" src="${banner}" loading="lazy">` : '<div class="cpr-podium-banner"></div>'}
      <div class="cpr-podium-name">${esc(c.name||'')}</div>
      <div class="cpr-podium-leader">
        ${leaderImg ? `<img src="${leaderImg}" loading="lazy">` : ''}
        <span>${esc(c.leader || '')}</span>
      </div>
      <div class="cpr-podium-stat">${v.toLocaleString()}</div>
      <div class="cpr-podium-stat-label">${sortKey}</div>
    </div>`;
  });
  html += '</div>';

  // Summary cards
  const totalStrength = allClans.reduce((s,c)=>s+(Number(c.strength)||0), 0);
  const avgStrength = allClans.length ? Math.round(totalStrength / allClans.length) : 0;
  const totalWealth = allClans.reduce((s,c)=>s+(Number(c.wealth)||0), 0);
  const totalMembers = allClans.reduce((s,c)=>s+(Number(c.members)||0), 0);
  html += '<div class="cpr-summary">';
  html += `<div class="cpr-summary-card"><span class="cpr-summary-icon">&#x1F3E0;</span><b class="cpr-summary-val">${allClans.length}</b><span class="cpr-summary-label">Clans</span></div>`;
  html += `<div class="cpr-summary-card"><span class="cpr-summary-icon">&#x2694;</span><b class="cpr-summary-val">${avgStrength.toLocaleString()}</b><span class="cpr-summary-label">Avg Strength</span></div>`;
  html += `<div class="cpr-summary-card"><span class="cpr-summary-icon">&#x1F465;</span><b class="cpr-summary-val">${totalMembers.toLocaleString()}</b><span class="cpr-summary-label">Total Members</span></div>`;
  html += `<div class="cpr-summary-card"><span class="cpr-summary-icon">&#x1FA99;</span><b class="cpr-summary-val">${totalWealth.toLocaleString()}</b><span class="cpr-summary-label">Total Wealth</span></div>`;
  if (playerRank > 0) {
    html += `<div class="cpr-summary-card" style="border-left-color:#f5d878"><span class="cpr-summary-icon">&#x2606;</span><b class="cpr-summary-val">#${playerRank}</b><span class="cpr-summary-label">Your Rank</span></div>`;
  }
  html += '</div>';

  // Filter chips
  const chips = [
    ['all', 'All'], ['atwar', '⚔ At War'], ['atpeace', '☮ At Peace'],
    ['mykingdom', '👑 My Kingdom'], ['independent', '🏴 Independent'], ['minor', '⚒ Minor'],
  ];
  html += '<div class="cpr-filters">';
  chips.forEach(([k,label]) => {
    html += `<button class="cpr-filter-chip ${_cprFilter===k?'active':''}" onclick="setRankingFilter('${k}')">${label}</button>`;
  });
  html += '</div>';

  // Search + toolbar
  html += '<div class="cpr-search-wrap">';
  html += `<input class="cpr-search-input" type="text" placeholder="&#x1F50D; Search clan name..." value="${esc(_cprSearch)}" oninput="setRankingSearch(this.value)">`;
  html += `<button class="stats-tool-btn ${_cprGroup?'active':''}" onclick="toggleRankingGroup()">&#x1F451; Group: ${_cprGroup?'Kingdom':'Off'}</button>`;
  html += `<button class="stats-tool-btn ${_cprShowAll?'active':''}" onclick="toggleRankingShowAll()">&#x1F4D6; ${_cprShowAll?'Top 60':'Show All'}</button>`;
  html += '<button class="stats-tool-btn" onclick="exportRankingsCSV()">&#x1F4E5; Export CSV</button>';
  html += '<button class="stats-tool-btn" onclick="renderClanRankings()">&#x1F504; Refresh</button>';
  html += '</div>';

  if (top.length === 0) {
    html += '<div class="cpr-empty">No clans match the current filter.</div>';
    el.innerHTML = html;
    return;
  }

  // Build the row HTML helper
  const rowHtml = (c, rankNum) => {
    const rank = rankNum;
    const rankCls = rank <= 3 ? `cpr-rank-${rank}` : '';
    const bannerSrc = c.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
    const bannerHtml = bannerSrc
      ? `<img class="cpr-banner" src="${bannerSrc}" loading="lazy">`
      : (c.bannerCode && window.renderBannerSVG
          ? `<div class="cpr-banner">${window.renderBannerSVG(c.bannerCode, 28)}</div>`
          : '<div class="cpr-banner"></div>');
    const leader = (Store.heroes || []).find(h => h.name === c.leader);
    const leaderImg = leader ? getPortraitSrc(leader, leader) : '';
    const v = Number(c[sortKey]) || 0;
    const pct = (v / max[sortKey]) * 100;
    const tier = Number(c.tier) || 0;
    const isPlayer = c.id === playerClanId;
    const trend = _cprTrend(c.id, Number(c.strength)||0);
    return `<div class="cpr-row ${isPlayer?'is-player':''}" onclick="openDetail('clans','${esc(c.id)}')">
      <div class="cpr-rank ${rankCls}">${rank}</div>
      ${leaderImg ? `<img class="cpr-leader-portrait" src="${leaderImg}" loading="lazy" onerror="this.src='Hero/bannerlord_hero_viking.png'">` : '<div></div>'}
      <div class="cpr-name">${bannerHtml}<div class="cpr-name-wrap">
        <div>${esc(c.name||'')}${trend}</div>
        <div class="cpr-name-meta">${esc(c.leader||'?')} &middot; ${c.members||0} members${c.kingdom?' &middot; '+esc(c.kingdom):''}</div>
      </div></div>
      <div><span class="cpr-tier-badge cpr-tier-${tier}">T${tier}</span></div>
      <div class="cpr-num">${(Number(c.strength)||0).toLocaleString()}</div>
      <div class="cpr-num">${(Number(c.renown)||0).toLocaleString()}</div>
      <div class="cpr-num">${(Number(c.influence)||0).toLocaleString()}</div>
      <div class="cpr-num">${(Number(c.wealth)||0).toLocaleString()}</div>
      <div class="cpr-bar"><div class="cpr-bar-fill" style="width:${pct}%;animation-delay:${Math.min(rank*0.02,1)}s"></div></div>
    </div>`;
  };

  // Build table — grouped or flat
  html += '<div class="cpr-table">';
  html += '<div class="cpr-head">';
  html += '<div>#</div>';
  html += '<div>&#x1F464;</div>';
  html += '<div>Clan</div>';
  html += '<div>Tier</div>';
  html += `<div onclick="setRankingSort('strength')">Strength${sortKey==='strength'?' &#9660;':''}</div>`;
  html += `<div onclick="setRankingSort('renown')">Renown${sortKey==='renown'?' &#9660;':''}</div>`;
  html += `<div onclick="setRankingSort('influence')">Influence${sortKey==='influence'?' &#9660;':''}</div>`;
  html += `<div onclick="setRankingSort('wealth')">Wealth${sortKey==='wealth'?' &#9660;':''}</div>`;
  html += '<div>Bar</div>';
  html += '</div>';

  if (_cprGroup) {
    // Group by kingdom
    const groups = {};
    top.forEach(c => {
      const k = c.kingdom || 'Independent';
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    });
    Object.entries(groups).forEach(([kingdomName, members]) => {
      const kdObj = (Store.kingdoms || []).find(k => k.name === kingdomName);
      const kBanner = kdObj?.id && Store._bannerImages?.[kdObj.id] ? `Banners/${encodeURIComponent(kdObj.id)}.png` : '';
      html += `<div class="cpr-group-header">${kBanner ? `<img src="${kBanner}">` : ''}${esc(kingdomName)} (${members.length})</div>`;
      members.forEach((c) => {
        const realRank = allClans.findIndex(x => x.id === c.id) + 1;
        html += rowHtml(c, realRank);
      });
    });
  } else {
    top.forEach((c, i) => {
      html += rowHtml(c, i + 1);
    });
  }
  html += '</div>';

  el.innerHTML = html;

  // Save snapshot for next-render trend arrows
  const snap = {};
  top.forEach(c => { snap[c.id] = Number(c.strength) || 0; });
  _cprPrev = snap;
  try { localStorage.setItem('cprPrev', JSON.stringify(snap)); } catch(e){}
}

// ── Wealth graph (records snapshots to localStorage) ──
function recordWealthSnapshot(gold, influence) {
  try {
    const arr = JSON.parse(localStorage.getItem('wealthHistory') || '[]');
    const last = arr[arr.length - 1];
    const now = Date.now();
    if (last && now - last.t < 60_000) return; // throttle 1/min
    arr.push({ t: now, g: gold || 0, i: influence || 0 });
    while (arr.length > 500) arr.shift();
    localStorage.setItem('wealthHistory', JSON.stringify(arr));
  } catch(e) {}
}
function renderWealthGraph(elId) {
  const el = document.getElementById(elId || 'wealthGraph');
  if (!el) return;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem('wealthHistory') || '[]'); } catch(e) {}
  if (arr.length < 2) {
    el.innerHTML = '<div class="wealth-graph-empty">Wealth history is recorded as you play.<br>Come back after a few sessions to see the graph.</div>';
    return;
  }
  const w = 600, h = 180, pad = 28;
  const minT = arr[0].t, maxT = arr[arr.length-1].t;
  const maxG = Math.max(1, ...arr.map(p => p.g));
  const maxI = Math.max(1, ...arr.map(p => p.i));
  const xOf = t => pad + ((t - minT) / Math.max(1, maxT - minT)) * (w - pad * 2);
  const yOfG = g => h - pad - (g / maxG) * (h - pad * 2);
  const yOfI = i => h - pad - (i / maxI) * (h - pad * 2);
  const pathG = arr.map((p, i) => (i === 0 ? 'M' : 'L') + xOf(p.t) + ',' + yOfG(p.g)).join(' ');
  const pathI = arr.map((p, i) => (i === 0 ? 'M' : 'L') + xOf(p.t) + ',' + yOfI(p.i)).join(' ');
  let svg = `<svg viewBox="0 0 ${w} ${h}">`;
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="none"/>`;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (i / 4) * (h - pad * 2);
    svg += `<line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="rgba(184,140,50,.12)" stroke-width="1"/>`;
  }
  svg += `<path d="${pathG}" fill="none" stroke="#f5d878" stroke-width="2.5" stroke-linejoin="round"/>`;
  svg += `<path d="${pathI}" fill="none" stroke="#80a0d0" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4,3"/>`;
  svg += `<text x="${pad}" y="14" fill="#d4b878" font-family="Cinzel,serif" font-size="10">Gold (max ${maxG.toLocaleString()})</text>`;
  svg += `<text x="${w-pad}" y="14" text-anchor="end" fill="#80a0d0" font-family="Cinzel,serif" font-size="10">Influence (max ${maxI.toLocaleString()})</text>`;
  svg += '</svg>';
  el.innerHTML = svg;
}

// ── Quest timeline (reads journal entries) ──
async function renderQuestTimeline() {
  const el = document.getElementById('questTimelineBody');
  if (!el) return;
  el.innerHTML = '<div class="loading-spinner"></div>';
  const journal = await API.getAllChronicle().catch(() => []);
  const quests = (journal || []).filter(e => {
    const t = (e.text || '').toLowerCase();
    return t.includes('quest') || t.includes('completed') || t.includes('failed') || t.includes('issue');
  }).slice(-40);
  if (!quests.length) {
    el.innerHTML = '<div class="empty">No quest history found in journal.</div>';
    return;
  }
  let html = '<div class="qt-track"><div class="qt-line"></div><div class="qt-events">';
  quests.forEach(q => {
    const txt = (q.text || '').toLowerCase();
    const cls = txt.includes('completed') ? 'active' : (txt.includes('failed') ? 'failed' : '');
    const title = (q.text || '').slice(0, 40);
    const date = q.date || q.day || '';
    html += `<div class="qt-event ${cls}"><div class="qt-title">${esc(title)}</div><div class="qt-dot"></div><div class="qt-date">${esc(String(date))}</div></div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

// ── Plan mode (map waypoint planner) ──
window._planMode = false;
window._planWaypoints = [];
function togglePlanMode() {
  _planMode = !_planMode;
  document.body.classList.toggle('map-plan-mode', _planMode);
  if (_planMode) {
    if (!document.querySelector('.map-plan-info')) {
      const info = document.createElement('div');
      info.className = 'map-plan-info';
      info.id = 'planInfo';
      info.innerHTML = 'PLAN MODE — click to add waypoints &middot; <b>0</b> stops &middot; <b>0.0</b>km <button onclick="clearPlanWaypoints()">Clear</button> <button onclick="togglePlanMode()">Done</button>';
      document.querySelector('.map-shell')?.appendChild(info);
    }
    showToast('Plan mode on — click on map to add waypoints');
  } else {
    document.getElementById('planInfo')?.remove();
    _planWaypoints = [];
    redrawPlanLayer();
  }
}
function clearPlanWaypoints() {
  _planWaypoints = [];
  redrawPlanLayer();
  updatePlanInfo();
}
function addPlanWaypoint(wx, wy) {
  _planWaypoints.push({ x: wx, y: wy });
  redrawPlanLayer();
  updatePlanInfo();
}
function updatePlanInfo() {
  const info = document.getElementById('planInfo');
  if (!info) return;
  let dist = 0;
  for (let i = 1; i < _planWaypoints.length; i++) {
    const dx = _planWaypoints[i].x - _planWaypoints[i-1].x;
    const dy = _planWaypoints[i].y - _planWaypoints[i-1].y;
    dist += Math.sqrt(dx*dx + dy*dy);
  }
  info.innerHTML = `PLAN MODE &middot; <b>${_planWaypoints.length}</b> stops &middot; <b>${dist.toFixed(1)}</b>km <button onclick="clearPlanWaypoints()">Clear</button> <button onclick="togglePlanMode()">Done</button>`;
}
function redrawPlanLayer() {
  const svg = document.querySelector('.map-stage svg');
  if (!svg) return;
  let layer = svg.querySelector('#planLayer');
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.id = 'planLayer';
    svg.appendChild(layer);
  }
  layer.innerHTML = '';
  if (_planWaypoints.length === 0) return;
  const cal = window._mapState?.cal || { ox:0, oy:0, sx:1, sy:1 };
  const stageW = svg.clientWidth || 1200, stageH = svg.clientHeight || 700;
  const proj = (p) => {
    const px = (p.x * cal.sx + cal.ox) * stageW + stageW / 2;
    const py = (p.y * cal.sy + cal.oy) * stageH + stageH / 2;
    return [px, py];
  };
  const pts = _planWaypoints.map(proj);
  // Line
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', pts.map(p => p.join(',')).join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#f5d878');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-dasharray', '6,4');
  path.setAttribute('opacity', '.85');
  layer.appendChild(path);
  // Dots
  pts.forEach(([x, y], i) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 8);
    c.setAttribute('fill', i === 0 ? '#7ac070' : (i === pts.length - 1 ? '#c05050' : '#d8b35f'));
    c.setAttribute('stroke', '#1a1208'); c.setAttribute('stroke-width', '2');
    layer.appendChild(c);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x); t.setAttribute('y', y + 4); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'Cinzel,serif'); t.setAttribute('font-size', '10');
    t.setAttribute('fill', '#1a1208'); t.setAttribute('font-weight', 'bold');
    t.textContent = i + 1;
    layer.appendChild(t);
  });
}

// Periodically record wealth snapshot from HUD/clan data
setInterval(() => {
  const goldEl = document.getElementById('hud-gold');
  const infEl = document.getElementById('hud-influence');
  if (!goldEl || !infEl) return;
  const g = parseInt((goldEl.textContent || '0').replace(/[^\d-]/g, '')) || 0;
  const inf = parseInt((infEl.textContent || '0').replace(/[^\d-]/g, '')) || 0;
  if (g > 0) recordWealthSnapshot(g, inf);
}, 60_000);

// Hook new pages into showPage
const _origShowPagePolish = window.showPage;
window.showPage = function(name) {
  _origShowPagePolish(name);
  if (name === 'rankings') renderClanRankings();
  if (name === 'stats') {
    setTimeout(() => renderWealthGraph('wealthGraph'), 100);
  }
};


// ── Stats Dashboard — full rebuild ──
window._statsPrev = JSON.parse(localStorage.getItem('statsPrev') || '{}');
window._statsAutoRefresh = null;

function _statsDelta(key, current) {
  const prev = _statsPrev[key];
  if (prev == null || prev === current) return '<span class="stats-delta stats-delta-flat">&mdash;</span>';
  const diff = current - prev;
  const cls = diff > 0 ? 'stats-delta-up' : 'stats-delta-down';
  const arrow = diff > 0 ? '&#9650;' : '&#9660;';
  return `<span class="stats-delta ${cls}">${arrow} ${diff > 0 ? '+' : ''}${diff.toLocaleString()}</span>`;
}

function _statsDivider(title) {
  return `<div class="stats-divider">
    <svg viewBox="0 0 200 14" preserveAspectRatio="none"><line x1="0" y1="7" x2="80" y2="7" stroke="#b88c32" stroke-width=".7"/><circle cx="92" cy="7" r="3" fill="none" stroke="#d4b878" stroke-width=".8"/><path d="M104,3 Q114,7 104,11 Q114,7 124,3 Q134,7 124,11 Q134,7 144,3 Q154,7 144,11 Q154,7 164,3 Q174,7 164,11 Q174,7 184,3" fill="none" stroke="#b88c32" stroke-width=".8"/></svg>
    <span class="stats-divider-title">${title}</span>
    <svg viewBox="0 0 200 14" preserveAspectRatio="none"><path d="M16,3 Q26,7 16,11 Q26,7 36,3 Q46,7 36,11 Q46,7 56,3 Q66,7 56,11 Q66,7 76,3 Q86,7 76,11 Q86,7 96,3" fill="none" stroke="#b88c32" stroke-width=".8"/><circle cx="108" cy="7" r="3" fill="none" stroke="#d4b878" stroke-width=".8"/><line x1="120" y1="7" x2="200" y2="7" stroke="#b88c32" stroke-width=".7"/></svg>
  </div>`;
}

function _statsDonut(slices, totalLabel) {
  // slices = [{label, value, color}]
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cx = 80, cy = 80, r = 58, ir = 36;
  let acc = 0;
  let svg = '<svg viewBox="0 0 160 160">';
  slices.forEach(s => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((acc + s.value) / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.value;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const xi0 = cx + ir * Math.cos(a0), yi0 = cy + ir * Math.sin(a0);
    const xi1 = cx + ir * Math.cos(a1), yi1 = cy + ir * Math.sin(a1);
    const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${ir} ${ir} 0 ${large} 0 ${xi0} ${yi0} Z`;
    svg += `<path d="${d}" fill="${s.color}" stroke="#0c0a06" stroke-width="1.5" opacity=".92"/>`;
  });
  svg += `<text x="80" y="74" class="stats-donut-center">${total.toLocaleString()}</text>`;
  svg += `<text x="80" y="92" class="stats-donut-center-sub">${totalLabel || 'TOTAL'}</text>`;
  svg += '</svg>';
  let legend = '<div class="stats-donut-legend">';
  slices.forEach(s => {
    const pct = ((s.value / total) * 100).toFixed(1);
    legend += `<div class="stats-donut-legend-row">
      <span class="stats-donut-legend-swatch" style="background:${s.color}"></span>
      <span>${esc(s.label)}</span>
      <span class="stats-donut-legend-pct">${pct}%</span>
    </div>`;
  });
  legend += '</div>';
  return `<div class="stats-donut-wrap">${svg}${legend}</div>`;
}

async function renderStatsDashboard() {
  const el = document.getElementById('statsBody');
  if (!el) return;
  if (!el.innerHTML.includes('stats-divider')) el.innerHTML = '<div class="loading-spinner"></div>';

  // Inject embers once
  if (!document.querySelector('.stats-embers')) {
    const dash = document.querySelector('.stats-dashboard');
    if (dash) {
      const em = document.createElement('div');
      em.className = 'stats-embers';
      for (let i = 0; i < 18; i++) {
        const sp = document.createElement('span');
        sp.style.left = (Math.random() * 100) + '%';
        sp.style.animationDuration = (12 + Math.random() * 12) + 's';
        sp.style.animationDelay = (Math.random() * 8) + 's';
        em.appendChild(sp);
      }
      dash.insertBefore(em, dash.firstChild);
    }
  }

  const [clanData, kingdomData, chronicle] = await Promise.all([
    API.getPlayerClan().catch(()=>null),
    API.getPlayerKingdom().catch(()=>null),
    API.getAllChronicle().catch(()=>[])
  ]);

  // Aggregate from chronicle
  let wars = 0, deaths = 0, sieges = 0, battles = 0, tournaments = 0, weddings = 0, births = 0;
  const warsByMonth = {};
  (chronicle||[]).forEach(e => {
    const t = (e.text||'').toLowerCase();
    if (t.includes('declared war')) {
      wars++;
      const d = (e.date || '').split(' ')[1] || (e.date || '').slice(0, 7) || 'unknown';
      warsByMonth[d] = (warsByMonth[d] || 0) + 1;
    }
    if (t.includes('died') || t.includes('slain') || t.includes('killed')) deaths++;
    if (t.includes('siege')) sieges++;
    if (t.includes('victory') || t.includes('defeated')) battles++;
    if (t.includes('tournament')) tournaments++;
    if (t.includes('married')) weddings++;
    if (t.includes('born') || t.includes('birth')) births++;
  });

  const heroes = Store.heroes || [];
  const clans = Store.clans || [];
  const settlements = Store.settlements || [];
  const kingdoms = Store.kingdoms || [];

  const counts = {
    heroes: heroes.length, clans: clans.length, kingdoms: kingdoms.length,
    towns: settlements.filter(s=>s.type==='Town').length,
    castles: settlements.filter(s=>s.type==='Castle').length,
    villages: settlements.filter(s=>s.isVillage||s.type==='Village').length,
    battles, sieges, deaths, tournaments, weddings, wars, births,
  };

  const stat = (icon, val, label, color, key) => {
    const delta = key ? _statsDelta(key, val) : '';
    return `<div class="stats-card" style="${color?'--stat-accent:'+color:''}">
      <span class="stats-icon">${icon}</span>
      <b class="stats-val" data-count-target="${val}">0</b>
      <span class="stats-label">${label}</span>
      ${delta}
    </div>`;
  };

  let html = '';

  // Toolbar
  html += '<div class="stats-toolbar">';
  html += '<button class="stats-tool-btn" onclick="renderStatsDashboard()">&#x1F504; Refresh</button>';
  html += `<button class="stats-tool-btn ${_statsAutoRefresh?'active':''}" id="statsAutoBtn" onclick="toggleStatsAutoRefresh()">&#x23F1; Auto-refresh: ${_statsAutoRefresh?'ON':'OFF'}</button>`;
  html += '<button class="stats-tool-btn" onclick="resetStatsBaseline()">&#x1F4CC; Reset baseline</button>';
  html += '</div>';

  // Section: World Counters
  html += _statsDivider('Realm of Calradia');
  html += '<div class="stats-grid-row">';
  html += stat('&#x1F464;', counts.heroes, 'Heroes', '#c8a868', 'heroes');
  html += stat('&#x1F3E0;', counts.clans, 'Clans', '#9c7dc9', 'clans');
  html += stat('&#x1F451;', counts.kingdoms, 'Kingdoms', '#d4a43a', 'kingdoms');
  html += stat('&#x1F3D8;', counts.towns, 'Towns', '#d8b35f', 'towns');
  html += stat('&#x1F3F0;', counts.castles, 'Castles', '#a08e6a', 'castles');
  html += stat('&#x1F33E;', counts.villages, 'Villages', '#7ac070', 'villages');
  html += '</div>';

  // Section: Chronicle Events
  html += _statsDivider('Chronicle of Events');
  html += '<div class="stats-grid-row">';
  html += stat('&#x2694;', battles, 'Battles', '#c08060', 'battles');
  html += stat('&#x1F3F0;', sieges, 'Sieges', '#a08e6a', 'sieges');
  html += stat('&#x2620;', deaths, 'Deaths', '#a15b5b', 'deaths');
  html += stat('&#x1F3C6;', tournaments, 'Tournaments', '#d4a43a', 'tournaments');
  html += stat('&#x1F48D;', weddings, 'Weddings', '#d8a0b0', 'weddings');
  html += stat('&#x1F6E1;', wars, 'Wars Declared', '#c05050', 'wars');
  html += stat('&#x1F476;', births, 'Births', '#7ac070', 'births');
  html += '</div>';

  // Section: Charts
  html += _statsDivider('Visual Records');

  // Row 1: Kingdom strength leaderboard + Settlement type donut
  html += '<div class="stats-chart-row">';
  // Leaderboard
  html += '<div class="stats-chart-card">';
  html += '<div class="stats-chart-title">&#x1F451; Kingdom Strength</div>';
  const sortedK = kingdoms.slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0)).slice(0,8);
  const maxK = Math.max(1, ...sortedK.map(k=>Number(k.strength)||0));
  sortedK.forEach((k, i) => {
    const pct = ((Number(k.strength)||0) / maxK) * 100;
    const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
    html += `<div class="stats-kr-row" onclick="openDetail('kingdoms','${esc(k.id)}')">
      <div class="stats-kr-rank">${i+1}</div>
      <div class="stats-kr-banner">${banner ? `<img src="${banner}" loading="lazy">` : '<div class="stats-kr-banner-empty"></div>'}</div>
      <div class="stats-kr-bar">
        <div class="stats-kr-bar-fill" style="width:${pct}%;animation-delay:${i*0.08}s"></div>
        <div class="stats-kr-name">${esc(k.name||'')}</div>
      </div>
      <div class="stats-kr-num">${(Number(k.strength)||0).toLocaleString()}</div>
    </div>`;
  });
  html += '</div>';
  // Settlement donut
  html += '<div class="stats-chart-card">';
  html += '<div class="stats-chart-title">&#x1F3D8; Settlement Distribution</div>';
  html += _statsDonut([
    {label:'Towns', value:counts.towns, color:'#d8b35f'},
    {label:'Castles', value:counts.castles, color:'#a08e6a'},
    {label:'Villages', value:counts.villages, color:'#7ac070'},
  ], 'PLACES');
  html += '</div>';
  html += '</div>';

  // Row 2: Culture donut + Battle outcomes donut + Hero gender donut
  const culCounts = {};
  heroes.forEach(h => { const c = h.culture || 'Unknown'; culCounts[c] = (culCounts[c]||0) + 1; });
  const culPalette = ['#d8b35f','#9c7dc9','#7ac070','#c08060','#80a0d0','#d8a0b0','#d4a43a','#a08e6a','#c05050','#e8c848'];
  const culSlices = Object.entries(culCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v],i)=>({label:k,value:v,color:culPalette[i%culPalette.length]}));

  let male = 0, female = 0;
  heroes.forEach(h => { if (h.isFemale || h.gender === 'female') female++; else male++; });

  html += '<div class="stats-chart-row three">';
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F30D; Hero Cultures</div>' + _statsDonut(culSlices, 'HEROES') + '</div>';
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x2694; Battle Outcomes</div>' + _statsDonut([
    {label:'Victories', value:battles, color:'#7ac070'},
    {label:'Sieges', value:sieges, color:'#d4a43a'},
    {label:'Deaths', value:deaths, color:'#a15b5b'},
  ], 'EVENTS') + '</div>';
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F46B; Hero Gender</div>' + _statsDonut([
    {label:'Male', value:male, color:'#6d8cb1'},
    {label:'Female', value:female, color:'#c08070'},
  ], 'HEROES') + '</div>';
  html += '</div>';

  // Row 3: Age pyramid + Top mentioned heroes
  const ageBuckets = [['0-15',0,15],['16-25',16,25],['26-35',26,35],['36-45',36,45],['46-55',46,55],['56-65',56,65],['66+',66,200]];
  const pyramid = ageBuckets.map(([label,lo,hi]) => {
    let m = 0, f = 0;
    heroes.forEach(h => {
      const a = Number(h.age) || 0;
      if (a >= lo && a <= hi) {
        if (h.isFemale || h.gender === 'female') f++; else m++;
      }
    });
    return { label, m, f };
  });
  const maxAge = Math.max(1, ...pyramid.map(p => Math.max(p.m, p.f)));

  html += '<div class="stats-chart-row">';
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F465; Hero Age Pyramid</div>';
  pyramid.forEach((p, i) => {
    const lpct = (p.m / maxAge) * 100;
    const rpct = (p.f / maxAge) * 100;
    html += `<div class="stats-pyramid-row">
      <div class="stats-pyramid-num l">${p.m}</div>
      <div class="stats-pyramid-bar-wrap"><div class="stats-pyramid-bar-l" style="width:${lpct}%;animation-delay:${i*0.06}s"></div></div>
      <div class="stats-pyramid-label">${p.label}</div>
      <div class="stats-pyramid-bar-wrap"><div class="stats-pyramid-bar-r" style="width:${rpct}%;animation-delay:${i*0.06}s"></div></div>
      <div class="stats-pyramid-num">${p.f}</div>
    </div>`;
  });
  html += '<div style="display:flex;gap:18px;justify-content:center;margin-top:10px;font-family:Cinzel,serif;font-size:9px;color:#9a8260;letter-spacing:1px"><span><span class="stats-donut-legend-swatch" style="background:#6d8cb1;display:inline-block;vertical-align:middle;margin-right:4px"></span>MEN</span><span><span class="stats-donut-legend-swatch" style="background:#c08070;display:inline-block;vertical-align:middle;margin-right:4px"></span>WOMEN</span></div>';
  html += '</div>';

  // Top mentioned heroes from chronicle
  const heroMentions = {};
  (chronicle || []).forEach(e => {
    const txt = (e.text || '');
    heroes.forEach(h => {
      if (h.name && txt.includes(h.name)) heroMentions[h.id] = (heroMentions[h.id] || 0) + 1;
    });
  });
  const topHeroes = Object.entries(heroMentions).sort((a,b)=>b[1]-a[1]).slice(0,10);
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F3C5; Most Mentioned Heroes</div>';
  if (topHeroes.length === 0) {
    html += '<div style="text-align:center;padding:30px 14px;font-family:Cinzel,serif;font-size:10px;color:#7c6840;letter-spacing:1px">No chronicle mentions yet</div>';
  } else {
    topHeroes.forEach(([id, count], i) => {
      const h = heroes.find(x => x.id === id);
      if (!h) return;
      const portrait = getPortraitSrc(h, h);
      html += `<div class="stats-top-row" onclick="openDetail('heroes','${esc(id)}')">
        <div class="stats-top-rank">${i+1}</div>
        <img class="stats-top-portrait" src="${portrait}" loading="lazy" onerror="this.src='Hero/bannerlord_hero_viking.png'">
        <div>${esc(h.name||'')}</div>
        <div class="stats-top-num">${count}&times;</div>
      </div>`;
    });
  }
  html += '</div>';
  html += '</div>';

  // Row 4: Settlement prosperity heatmap + Wealthiest clans
  html += '<div class="stats-chart-row">';
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F525; Settlement Prosperity</div>';
  const townsAll = settlements.filter(s => s.type === 'Town' || s.type === 'Castle');
  const towns = townsAll.slice().sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0)).slice(0, 36);
  const maxP = Math.max(1, ...towns.map(t => Number(t.prosperity)||0));
  html += '<div class="stats-heatmap">';
  towns.forEach(t => {
    const p = Number(t.prosperity) || 0;
    const intensity = p / maxP;
    const img = t.type === 'Castle' ? 'Settlement/Castle.png' : 'Settlement/Town.png';
    // Color tint overlay strength based on prosperity
    const r = Math.round(60 + intensity * 200);
    const g = Math.round(40 + intensity * 130);
    const b = Math.round(20 + intensity * 50);
    html += `<div class="stats-heat-cell" title="${esc(t.name||'')}: ${p.toLocaleString()} prosperity" onclick="openDetail('settlements','${esc(t.id)}')">
      <img class="stats-heat-img" src="${img}" loading="lazy" onerror="this.style.display='none'">
      <div class="stats-heat-tint" style="background:linear-gradient(180deg,transparent 30%,rgba(${r},${g},${b},.85) 100%)"></div>
      <div class="stats-heat-bar"><div class="stats-heat-bar-fill" style="width:${(intensity*100).toFixed(0)}%;background:rgb(${r},${g},${b})"></div></div>
      <div class="stats-heat-name">${esc((t.name||'?'))}</div>
    </div>`;
  });
  html += '</div></div>';

  // Wealthiest clans table
  html += '<div class="stats-chart-card"><div class="stats-chart-title">&#x1F4B0; Wealthiest Clans</div>';
  const richest = clans.slice().sort((a,b)=>(Number(b.wealth)||0)-(Number(a.wealth)||0)).slice(0,10);
  const maxW = Math.max(1, ...richest.map(c=>Number(c.wealth)||0));
  richest.forEach((c, i) => {
    const pct = ((Number(c.wealth)||0)/maxW)*100;
    const banner = c.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
    html += `<div class="stats-kr-row" onclick="openDetail('clans','${esc(c.id)}')">
      <div class="stats-kr-rank">${i+1}</div>
      <div class="stats-kr-banner">${banner ? `<img src="${banner}" loading="lazy">` : '<div class="stats-kr-banner-empty"></div>'}</div>
      <div class="stats-kr-bar">
        <div class="stats-kr-bar-fill" style="width:${pct}%;animation-delay:${i*0.08}s"></div>
        <div class="stats-kr-name">${esc(c.name||'')}</div>
      </div>
      <div class="stats-kr-num">${(Number(c.wealth)||0).toLocaleString()}</div>
    </div>`;
  });
  html += '</div>';
  html += '</div>';

  // Section: Your Clan (if available)
  if (clanData) {
    html += _statsDivider('Your House');
    html += '<div class="stats-grid-row">';
    html += stat('&#x25C9;', clanData.gold||0, 'Gold', '#e8c848', 'pgold');
    html += stat('&#x2726;', clanData.influence||0, 'Influence', '#80a0d0', 'pinf');
    html += stat('&#x1F393;', clanData.renown||0, 'Renown', '#c0a868', 'pren');
    html += stat('&#x1F465;', clanData.members?.length||0, 'Members', '#c8a868', 'pmem');
    html += stat('&#x2694;', (clanData.parties||[]).length, 'Parties', '#c08060', 'ppar');
    html += '</div>';
  }

  el.innerHTML = html;

  // Animate counters
  setTimeout(() => animateCounters(el), 50);

  // Save current snapshot for next-render delta calculation
  _statsPrev = {
    heroes:counts.heroes, clans:counts.clans, kingdoms:counts.kingdoms,
    towns:counts.towns, castles:counts.castles, villages:counts.villages,
    battles, sieges, deaths, tournaments, weddings, wars, births,
  };
  if (clanData) {
    _statsPrev.pgold = clanData.gold||0;
    _statsPrev.pinf = clanData.influence||0;
    _statsPrev.pren = clanData.renown||0;
    _statsPrev.pmem = clanData.members?.length||0;
    _statsPrev.ppar = (clanData.parties||[]).length;
  }
  try { localStorage.setItem('statsPrev', JSON.stringify(_statsPrev)); } catch(e){}
}

function toggleStatsAutoRefresh() {
  if (_statsAutoRefresh) {
    clearInterval(_statsAutoRefresh);
    _statsAutoRefresh = null;
    showToast('Auto-refresh OFF');
  } else {
    _statsAutoRefresh = setInterval(() => {
      if (document.querySelector('#page-stats.active')) renderStatsDashboard();
    }, 30_000);
    showToast('Auto-refresh ON (30s)');
  }
  const btn = document.getElementById('statsAutoBtn');
  if (btn) {
    btn.classList.toggle('active', !!_statsAutoRefresh);
    btn.innerHTML = '&#x23F1; Auto-refresh: ' + (_statsAutoRefresh ? 'ON' : 'OFF');
  }
}

function resetStatsBaseline() {
  _statsPrev = {};
  try { localStorage.removeItem('statsPrev'); } catch(e){}
  renderStatsDashboard();
  showToast('Baseline reset — next refresh will show deltas');
}

// ── Hero compare modal ──
window._heroCompareIds = new Set();
function openHeroCompare() {
  document.getElementById('heroCompareOverlay')?.classList.add('open');
  // Inject embers once
  const overlay = document.getElementById('heroCompareOverlay');
  if (overlay && !overlay.querySelector('.hc-embers')) {
    const em = document.createElement('div');
    em.className = 'hc-embers';
    for (let i = 0; i < 16; i++) {
      const sp = document.createElement('span');
      sp.style.left = (Math.random() * 100) + '%';
      sp.style.animationDuration = (12 + Math.random() * 12) + 's';
      sp.style.animationDelay = (Math.random() * 8) + 's';
      em.appendChild(sp);
    }
    overlay.querySelector('.hero-compare-modal')?.prepend(em);
  }
  renderHeroCompare();
  const searchEl = document.getElementById('heroCompareSearch');
  if (searchEl) {
    searchEl.value = '';
    searchEl.oninput = () => {
      const q = searchEl.value.trim().toLowerCase();
      const resultsEl = document.getElementById('heroCompareSearchResults');
      if (!q) { resultsEl.style.display = 'none'; return; }
      const matches = (Store.heroes||[]).filter(h => h.name.toLowerCase().includes(q)).slice(0, 8);
      resultsEl.innerHTML = matches.map(h => {
        const portrait = getPortraitSrc(h, h);
        return `<div class="hero-compare-result" onclick="addHeroToCompare('${esc(h.id)}')">
          <img src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">
          <div><div class="hcr-name">${esc(h.name)}</div><div class="hcr-meta">${esc(h.culture||'')}${h.clan?' &middot; '+esc(h.clan):''}</div></div>
        </div>`;
      }).join('');
      resultsEl.style.display = 'block';
    };
  }
}
function addHeroToCompare(id) {
  if (window._heroCompareIds.size >= 4) { showToast('Max 4 heroes', true); return; }
  window._heroCompareIds.add(id);
  const si = document.getElementById('heroCompareSearch');
  if (si) si.value = '';
  const sr = document.getElementById('heroCompareSearchResults');
  if (sr) sr.style.display = 'none';
  renderHeroCompare();
}
function removeHeroFromCompare(id) {
  window._heroCompareIds.delete(id);
  renderHeroCompare();
}
function clearHeroCompare() {
  window._heroCompareIds = new Set();
  renderHeroCompare();
}
function addRandomHeroToCompare() {
  const arr = (Store.heroes || []).filter(h => !h.isPlayer && !h.isDead && !window._heroCompareIds.has(h.id));
  if (arr.length === 0) { showToast('No more heroes', true); return; }
  const pick = arr[Math.floor(Math.random() * arr.length)];
  addHeroToCompare(pick.id);
}

async function renderHeroCompare() {
  const el = document.getElementById('heroCompareGrid');
  if (!el) return;

  // Toolbar (always visible)
  let toolbarHtml = `<div class="hc-toolbar">
    <button class="hc-tool-btn" onclick="addRandomHeroToCompare()">\u{1F3B2} Add Random</button>
    <button class="hc-tool-btn" onclick="clearHeroCompare()">\u{1F5D1} Clear All</button>
    <span class="hc-tool-count">${window._heroCompareIds.size}/4 selected</span>
  </div>`;

  if (window._heroCompareIds.size === 0) {
    el.innerHTML = toolbarHtml + '<div class="hc-empty"><div class="hc-empty-icon">\u{2696}</div><div>Search above to add heroes to compare</div><div class="hc-empty-sub">Up to 4 heroes &middot; Compare stats, skills, traits, family</div></div>';
    return;
  }
  const ids = Array.from(window._heroCompareIds);
  const details = await Promise.all(ids.map(id => API.getHero(id).catch(()=>null)));
  const heroes = ids.map(id => (Store.heroes||[]).find(h => h.id === id));

  // Aggregate stat keys across all heroes
  const allStatKeys = new Set();
  details.forEach(d => { if (d?.stats) Object.keys(d.stats).forEach(k => allStatKeys.add(k)); });
  const statKeys = Array.from(allStatKeys);

  // For each stat, compute the max value
  const statMax = {};
  statKeys.forEach(k => {
    statMax[k] = Math.max(0, ...details.map(d => Number(d?.stats?.[k]) || 0));
  });

  // Hero cards row
  let html = toolbarHtml + '<div class="hc-cards-row">';
  details.forEach((d, i) => {
    if (!d) { html += '<div></div>'; return; }
    const hero = heroes[i];
    const portrait = hero ? getPortraitSrc(hero, hero) : '';
    const cColor = getCultureColor(hero?.culture || d.culture || '') || '#d4b878';
    const clan = hero?.clan ? (Store.clans||[]).find(c => c.name === hero.clan) : null;
    const banner = clan?.id && Store._bannerImages?.[clan.id] ? `Banners/${encodeURIComponent(clan.id)}.png` : '';
    html += `<div class="hc-card" style="--hc-accent:${cColor}">
      <button class="hc-remove" onclick="removeHeroFromCompare('${esc(ids[i])}')">&times;</button>
      ${portrait ? `<img class="hc-portrait" src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">` : ''}
      <div class="hc-name">${esc(d.name||hero?.name||'')}</div>
      <div class="hc-sub">${esc(d.culture||'?')} &middot; Age ${d.age||0}</div>
      ${banner ? `<img class="hc-banner" src="${banner}">` : ''}
      <button class="hc-open-btn" onclick="document.getElementById('heroCompareOverlay').classList.remove('open');openDetail('heroes','${esc(ids[i])}')">Open Profile</button>
    </div>`;
  });
  html += '</div>';

  // Stat comparison rows — each stat as a row with bars + best highlight
  if (statKeys.length > 0) {
    html += '<div class="hc-stats-section"><div class="hc-section-title">\u{1F4CA} Stat Comparison</div>';
    html += '<div class="hc-stats-grid" style="grid-template-columns:140px repeat(' + details.length + ',1fr)">';
    statKeys.forEach(k => {
      html += `<div class="hc-stat-label">${esc(k)}</div>`;
      details.forEach((d, i) => {
        const v = Number(d?.stats?.[k]) || 0;
        const max = statMax[k] || 1;
        const pct = (v / max) * 100;
        const isBest = v > 0 && v === max && details.filter(x => Number(x?.stats?.[k]) === max).length === 1;
        html += `<div class="hc-stat-cell ${isBest ? 'is-best' : ''}">
          <div class="hc-stat-bar"><div class="hc-stat-bar-fill" style="width:${pct}%"></div></div>
          <div class="hc-stat-num">${esc(String(v))}${isBest ? ' \u{1F451}' : ''}</div>
        </div>`;
      });
    });
    html += '</div></div>';
  }

  // Skills radar overlay (if all heroes have skills)
  const heroesWithSkills = details.filter(d => Array.isArray(d?.skills) && d.skills.length > 0);
  if (heroesWithSkills.length >= 1) {
    html += '<div class="hc-stats-section"><div class="hc-section-title">\u{1F3AF} Skill Radar Overlay</div>';
    html += renderHeroCompareRadar(details, heroes);
    html += '</div>';
  }

  el.innerHTML = html;
}

function renderHeroCompareRadar(details, heroes) {
  // Collect top 8 skills by max across all heroes
  const skillMap = {};
  details.forEach(d => {
    (d?.skills || []).forEach(s => {
      const name = s.name || s.skill;
      if (!name) return;
      const v = Number(s.value) || 0;
      if (!skillMap[name] || v > skillMap[name]) skillMap[name] = v;
    });
  });
  const topNames = Object.entries(skillMap).sort((a,b)=>b[1]-a[1]).slice(0, 8).map(x => x[0]);
  if (topNames.length < 3) return '<div class="hc-empty-sub" style="text-align:center;padding:14px">Not enough skills to chart.</div>';

  const cx = 220, cy = 220, r = 170;
  const n = topNames.length;
  const max = 300;
  const colors = ['#f5d878','#7ac070','#80a0d0','#d8a0b0'];

  let svg = '<div class="hc-radar-wrap"><svg viewBox="0 0 440 440">';
  // Grid rings
  for (let i = 1; i <= 4; i++) {
    const rr = (r * i) / 4;
    let path = '';
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      path += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    path += 'Z';
    svg += `<path class="hd-radar-grid" d="${path}"/>`;
  }
  // Axes
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    svg += `<line class="hd-radar-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  }
  // Polys per hero
  details.forEach((d, idx) => {
    if (!d || !Array.isArray(d.skills)) return;
    const color = colors[idx % colors.length];
    let poly = '';
    topNames.forEach((skName, j) => {
      const skObj = d.skills.find(s => (s.name || s.skill) === skName);
      const v = Math.min(max, Number(skObj?.value) || 0);
      const ratio = v / max;
      const a = (j / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * ratio * Math.cos(a);
      const y = cy + r * ratio * Math.sin(a);
      poly += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    poly += 'Z';
    svg += `<path d="${poly}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" filter="drop-shadow(0 0 6px ${color})"/>`;
  });
  // Labels
  topNames.forEach((skName, j) => {
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    const lx = cx + (r + 22) * Math.cos(a);
    const ly = cy + (r + 22) * Math.sin(a);
    const align = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
    svg += `<text class="hd-radar-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${align}" dy="3">${esc(skName)}</text>`;
  });
  svg += '</svg>';
  // Legend
  let legend = '<div class="hc-radar-legend">';
  details.forEach((d, idx) => {
    if (!d) return;
    const color = colors[idx % colors.length];
    legend += `<div class="hc-radar-legend-row"><span class="hc-radar-swatch" style="background:${color}"></span>${esc(d.name||heroes[idx]?.name||'')}</div>`;
  });
  legend += '</div>';
  svg += legend + '</div>';
  return svg;
}

// ── Changelog / About ──
window._changelogTab = 'changelog';
function setChangelogTab(t) { _changelogTab = t; renderChangelogContent(); }

const CHANGELOG_VERSIONS = [
  { version:'v2.4.0', date:'Apr 15, 2026', tag:'live', items:[
    'THE IMMERSION OVERHAUL — every page rebuilt with cinematic backdrops, themed panels, and live data',
    'Scribe\'s Codex keyboard shortcut system — Gmail-style G+X nav (G H/C/K/S/M/O/R/T/A/P), detail E/N/P/B, J/K chronicle scrub, / search focus, T theme, D density, H hud, R refresh',
    'Codex help overlay rewritten as an immersive parchment scroll with carved wooden finials, embossed gold keys, and 3-column layout (?)',
    'Floating "G..." prefix hint chip with pulsing pressed-key animation and option reminder',
    'Quick Search rewrite (Ctrl+K): fuzzy subsequence scoring, 6 categories (heroes/clans/kingdoms/holds/pages/actions), filter chips, recent-opened history, gold match highlighting, /h /c /k /s /p /> inline filters',
    'Quick Search now includes 11 page-navigation targets + 9 action commands (cycle theme, refresh, toggle HUD, preferences, compare, notifications, etc.)',
    'Map page immersion pass: title cartouche with live game date, functional compass rose with wandering needle, 4 filigree corner ornaments, drifting ember particles, edge vignette, parchment grain, day/night tint from game hour, live coordinate + zoom readout',
    'Map teleport system: double-click any settlement for instant warp, dramatic golden arrival burst (3 expanding rings + rotating star + 12 ember spokes), auto-refresh so player marker visibly jumps',
    'Teleport button rewritten with 4-path reflection fallback (MobileParty/PartyBase Position2D setters + backing field walk + method search) — works across all Bannerlord versions',
    'Clan Parties Roles: assign Quartermaster/Scout/Surgeon/Engineer to ANY party a companion leads, not just the player\'s main party',
    'Context-aware Player HUD auto-hides on browsing pages, visible on Home/Commander/Map/Detail',
    'Detail view content limiter — Timeline capped at 10 with expandable scrollable box, Journal rail with max-height + entry count badge',
    'Topbar + footer slimmed (reclaimed ~80px vertical chrome), decorative elements hidden, centered layout preserved',
    'Massive immersive UI overhaul — every page got the Calradia map backdrop + parchment grain + drifting embers',
    'Stats dashboard rebuild: 9 charts including donuts, leaderboards, age pyramid, prosperity heatmap, wealth sparkline',
    'Rankings page: top-3 podium showcase, filter chips, sort dropdown, group-by-kingdom, CSV export, player rank',
    'API docs rebuild: try-it console, Postman JSON export, animated terminal, sticky section rail, copy-as-cURL',
    'Home page widgets: quick actions, royal calendar, treasury sparkline, faction power bars, weekly highlights, news, quote of the day, season particles',
    'Commander page: quick actions toolbar, battle stats card, reputation wheel, lifespan card, auto-generated title ribbon',
    'Heroes/Clans/Settlements/Kingdoms list pages: daily spotlight cards, animated stat counters, Hall of Fame ribbons, quick filter chips, sort + view toggles, Surprise Me button',
    'Kingdoms War Room mode (battle theatre cards) + Hall of Peace mode (peaceful realms grid)',
    'Cultural Pantheon panels with per-culture color theming for all 6 Calradian cultures',
    'Hero/Settlement/Clan/Kingdom detail views — title ribbons, action buttons, stat badges, recent events, members ribbons, wars strips',
    'Hero detail skill radar chart, family tree modal',
    '32 Achievements across 7 categories with real reward grants (Gold / Influence / Renown / Glory)',
    '9-tier Glory rank progression with claim-all support',
    'Themed Notifications panel: filter chips, search, snooze, dismiss, NEW pills',
    'Caravan Ledger trade routes: category icons, animated arrows, profit tiers, margin %',
    'Compare Heroes: skill radar overlay, best-stat highlighting with crowns',
    'Changelog/About modal rebuild: version timeline, features grid, credits, links',
    'Native title="" tooltips intercepted and replaced with themed gold-on-leather tooltips everywhere',
    'New POST /api/player/grantreward and POST /api/player/travel endpoints',
    'Battle wins counter no longer decreases over time (persistent _battleStats counter)',
    'License changed to Open Source — credits must be given to the original author (XMuPb)',
    'Removed: map screenshot/PNG export button',
  ]},
  { version:'v2.3.5', date:'Apr 11, 2026', tag:'release', items:[
    'Fixed Living Chronicle popup appearing on every load',
    'Fixed isLoading detection breaking initialization on saves with no prior mod data',
    'Fixed name persistence visually after save+load',
    'Timeline + Chronicle deduplication across pages',
    'Fixed stale lore edit replaying on description confirm',
    'Settlement nameplate refresh after save+load',
  ]},
  { version:'v2.3.0', date:'Apr 8, 2026', tag:'major', items:[
    'Web extension launch — full standalone web UI on http://localhost:8080',
    'Live Calradia campaign map with settlements, parties, kingdom borders, war arrows',
    'Commander Hub with 7 sub-tabs (Character / Inventory / Party / Quests / Clan / Kingdom / Chronicle)',
    'Kingdom diplomacy actions: declare war, make peace, alliance, trade, create army',
    '60+ REST endpoints for cross-mod integration',
    'Family tree modal with portrait nodes',
    'Command palette (Ctrl+K) fuzzy search',
    'API docs page with full endpoint reference',
    'Live chronicle scroll on home page',
    'Custom culture overhaul with full troop tree + new game intro dialog',
  ]},
  { version:'v2.2.0', date:'Apr 7, 2026', tag:'release', items:[
    'EEWebExtension extracted as separate DLL (install/remove independently from main mod)',
    '17 new MCM settings for the web extension under Extensions group',
    'GET /api/web-settings endpoint returns runtime config to the web app',
    'Custom data merging in all list/detail APIs (heroes, clans, kingdoms, settlements)',
    'Web Server Port / Auto-Open Browser / Allow External Access toggles',
    'Live Sync interval and HUD/intro/embers/sounds toggles',
  ]},
  { version:'v2.1.0', date:'Mar 2026', tag:'release', items:[
    'First web UI release (bundled inside the main mod)',
    'Live chronicle feed + auto-journal event handlers',
    'Hero / Clan / Settlement / Kingdom list pages',
    '12 language localizations',
  ]},
];

const PROJECT_FEATURES = [
  { icon:'\u{1F5FA}', name:'Live Campaign Map', desc:'Real-time positions, kingdom borders, war arrows, minimap, settlement heatmaps' },
  { icon:'\u{2655}', name:'Commander Hub', desc:'Character, inventory, party, quests, clan, kingdom, chronicle — 7 tabs' },
  { icon:'\u{1F451}', name:'Kingdom Diplomacy', desc:'Declare war, make peace, form alliances, trade agreements, create armies' },
  { icon:'\u{1F3F0}', name:'Settlement Manager', desc:'Gift, garrison wages, set governor, send members, building projects' },
  { icon:'\u{1F4DC}', name:'Auto-Chronicle', desc:'16+ event types automatically logged with deduplication and tag filters' },
  { icon:'\u{1F396}', name:'Achievements + Glory', desc:'32 achievements across 7 categories, 9 ranks, real reward grants' },
  { icon:'\u{1F3AD}', name:'Custom Culture', desc:'Full troop tree, settlement color propagation, banner injection' },
  { icon:'\u{2696}', name:'Compare Heroes', desc:'Side-by-side stats, skill radar overlay, best-of highlighting' },
  { icon:'\u{1F3C6}', name:'Rankings', desc:'Top-3 podium, sortable leaderboards, clan power tracking' },
  { icon:'\u{1F4CA}', name:'Stats Dashboard', desc:'Live counters, donuts, leaderboards, prosperity heatmaps' },
  { icon:'\u{1F9E9}', name:'REST API', desc:'40+ endpoints with try-it console, Postman collection export' },
  { icon:'\u{1F4DA}', name:'Localization', desc:'12 languages, themed UI with parchment grain + culture colors' },
];

const PROJECT_LINKS = [
  { icon:'\u{1F4CB}', label:'GitHub Repo', desc:'Source code & issues', url:'https://github.com/XMuPb/EEWebExtension' },
  { icon:'\u{1F3AE}', label:'Steam Workshop', desc:'Subscribe & rate', url:'https://steamcommunity.com/sharedfiles/filedetails/?id=3701775167' },
  { icon:'\u{1F4AC}', label:'Discord', desc:'Author profile', url:'https://discord.com/users/404393620897136640' },
  { icon:'\u{1F9E9}', label:'API Docs', desc:'40+ endpoints', action:"document.getElementById('changelogOverlay').classList.remove('open');showPage('api')" },
  { icon:'\u{1F3F4}', label:'Map Page', desc:'Live Calradia', action:"document.getElementById('changelogOverlay').classList.remove('open');showPage('map')" },
  { icon:'\u{1F31F}', label:'Rate the Mod', desc:'Leave a review', url:'https://steamcommunity.com/sharedfiles/filedetails/?id=3701775167' },
];

function openChangelog() {
  document.getElementById('changelogOverlay')?.classList.add('open');
  // Inject embers
  const overlay = document.getElementById('changelogOverlay');
  if (overlay && !overlay.querySelector('.cl-embers')) {
    const em = document.createElement('div');
    em.className = 'cl-embers';
    for (let i = 0; i < 18; i++) {
      const sp = document.createElement('span');
      sp.style.left = (Math.random() * 100) + '%';
      sp.style.animationDuration = (12 + Math.random() * 12) + 's';
      sp.style.animationDelay = (Math.random() * 8) + 's';
      em.appendChild(sp);
    }
    overlay.querySelector('.changelog-modal')?.prepend(em);
  }
  renderChangelogContent();
}

function renderChangelogContent() {
  const el = document.getElementById('changelogBody');
  if (!el) return;

  let html = '';

  // Hero header
  html += `<div class="cl-hero">
    <div class="cl-quill">\u{1F58B}</div>
    <div class="cl-hero-info">
      <div class="cl-kicker">\u{2606} The Living Archive</div>
      <div class="cl-version-big">v2.4.0</div>
      <div class="cl-tagline">Editable Encyclopedia for Mount &amp; Blade II: Bannerlord</div>
    </div>
  </div>`;

  // Project stats
  html += '<div class="cl-stats">';
  const sc = (icon,num,lbl) => `<div class="cl-stat"><span class="cl-stat-icon">${icon}</span><b class="cl-stat-num" data-count-target="${num}">0</b><span class="cl-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F4DD}', 49600, 'Lines of Code');
  html += sc('\u{1F9E9}', 60, 'API Endpoints');
  html += sc('\u{1F4D6}', 12, 'Pages');
  html += sc('\u{2728}', PROJECT_FEATURES.length, 'Features');
  html += sc('\u{1F30D}', 12, 'Languages');
  html += '</div>';

  // Tab bar
  const tabs = [
    { id:'changelog', icon:'\u{1F4DC}', label:'Changelog' },
    { id:'features', icon:'\u{2728}', label:'Features' },
    { id:'credits', icon:'\u{2764}', label:'Credits' },
    { id:'links', icon:'\u{1F517}', label:'Links' },
  ];
  html += '<div class="cl-tabs">';
  tabs.forEach(t => {
    html += `<button class="cl-tab ${_changelogTab===t.id?'active':''}" onclick="setChangelogTab('${t.id}')"><span>${t.icon}</span> ${t.label}</button>`;
  });
  html += '</div>';

  // Tab content
  html += '<div class="cl-tab-content">';
  if (_changelogTab === 'changelog') {
    html += '<div class="cl-timeline">';
    CHANGELOG_VERSIONS.forEach((v, i) => {
      const tagClass = v.tag === 'live' ? 'cl-tag-live' : v.tag === 'major' ? 'cl-tag-major' : 'cl-tag-release';
      html += `<div class="cl-version" style="animation-delay:${i*0.08}s">
        <div class="cl-version-marker"><div class="cl-version-dot"></div></div>
        <div class="cl-version-card">
          <div class="cl-version-header">
            <span class="cl-version-num">${esc(v.version)}</span>
            <span class="cl-version-tag ${tagClass}">${esc(v.tag.toUpperCase())}</span>
            <span class="cl-version-date">${esc(v.date)}</span>
          </div>
          <ul class="cl-version-items">
            ${v.items.map(it => `<li>${esc(it)}</li>`).join('')}
          </ul>
        </div>
      </div>`;
    });
    html += '</div>';
  } else if (_changelogTab === 'features') {
    html += '<div class="cl-features-grid">';
    PROJECT_FEATURES.forEach((f, i) => {
      html += `<div class="cl-feature-card" style="animation-delay:${i*0.04}s">
        <div class="cl-feature-icon">${f.icon}</div>
        <div class="cl-feature-info">
          <div class="cl-feature-name">${esc(f.name)}</div>
          <div class="cl-feature-desc">${esc(f.desc)}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  } else if (_changelogTab === 'credits') {
    html += `<div class="cl-credits-card">
      <div class="cl-credits-medal">\u{1F396}</div>
      <div class="cl-credits-author">XMuPb</div>
      <div class="cl-credits-role">Author &amp; Lead Developer</div>
      <div class="cl-credits-divider"></div>
      <div class="cl-credits-section"><b>Built with</b><br>C# 9.0 &middot; .NET Framework 4.7.2 &middot; Harmony 2.4.2 &middot; UIExtenderEx &middot; ButterLib &middot; MCMv5</div>
      <div class="cl-credits-section"><b>Web extension</b><br>Vanilla JavaScript &middot; SVG charts &middot; Web Audio API &middot; HTTP listener on :8080</div>
      <div class="cl-credits-section"><b>Special thanks</b><br>XMuPb for busting his ass on extensions &middot; TaleWorlds for Bannerlord &middot; The modding community &middot; Beta testers &middot; All who reported bugs</div>
      <div class="cl-credits-section cl-credits-license"><b>License</b><br>Open Source &middot; Credits must be given to the original author (XMuPb)</div>
    </div>`;
  } else if (_changelogTab === 'links') {
    html += '<div class="cl-links-grid">';
    PROJECT_LINKS.forEach((l, i) => {
      const handler = l.action ? l.action : `window.open('${l.url}','_blank')`;
      html += `<button class="cl-link-card" style="animation-delay:${i*0.04}s" onclick="${handler}">
        <div class="cl-link-icon">${l.icon}</div>
        <div class="cl-link-info">
          <div class="cl-link-label">${esc(l.label)}</div>
          <div class="cl-link-desc">${esc(l.desc)}</div>
        </div>
      </button>`;
    });
    html += '</div>';
  }
  html += '</div>';

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

// ── Command Palette (Ctrl+K) ──
// ═══════════════════════════════════════════════════════════════════════════
// QUICK SEARCH — v2.4.0 immersive rewrite
// Fuzzy subsequence scoring · filter chips · recents · pages · commands
// ═══════════════════════════════════════════════════════════════════════════
window._qsFilter = 'all';
window._qsRecents = JSON.parse(localStorage.getItem('qsRecents') || '[]');

// Page navigation targets
const QS_PAGES = [
  { id:'home', name:'Home', sub:'Quick actions, calendar, treasury', icon:'&#x1F3E1;', keywords:'home dashboard main' },
  { id:'commander', name:'Commander Hub', sub:'Character, inventory, party, clan, kingdom', icon:'&#x2655;', keywords:'commander character inventory party quests' },
  { id:'map', name:'Calradia Map', sub:'Live campaign map with parties &amp; borders', icon:'&#x1F5FA;', keywords:'map calradia world positions parties borders' },
  { id:'heroes', name:'Heroes', sub:'All heroes list', icon:'&#x1F464;', keywords:'heroes people characters nobles wanderers' },
  { id:'clans', name:'Clans', sub:'All clans list', icon:'&#x1F3E0;', keywords:'clans families houses' },
  { id:'kingdoms', name:'Kingdoms', sub:'War room &amp; hall of peace', icon:'&#x1F451;', keywords:'kingdoms factions realms empires wars' },
  { id:'settlements', name:'Settlements', sub:'Towns, castles, villages', icon:'&#x1F3F0;', keywords:'settlements holds towns castles villages fiefs' },
  { id:'rankings', name:'Rankings', sub:'Clan power leaderboard', icon:'&#x1F3C6;', keywords:'rankings leaderboard power top podium' },
  { id:'stats', name:'Stats Dashboard', sub:'9 charts &amp; heatmaps', icon:'&#x1F4CA;', keywords:'stats charts graphs dashboard analytics' },
  { id:'api', name:'API Docs', sub:'REST endpoints &amp; try-it console', icon:'&#x1F9E9;', keywords:'api docs endpoints rest postman' },
  { id:'chronicle', name:'Live Chronicle', sub:'Real-time event feed', icon:'&#x1F4DC;', keywords:'chronicle events timeline news feed' },
];

// Command/action entries
const QS_ACTIONS = [
  { id:'cycleTheme', name:'Cycle Theme', sub:'Next color theme', icon:'&#x1F3A8;', keywords:'theme cycle color parchment iron oak empire culture', run:() => cycleTheme() },
  { id:'prefs', name:'Open Preferences', sub:'Density, typography, themes, sound', icon:'&#x2699;', keywords:'preferences settings options config', run:() => openPreferences() },
  { id:'cycleDensity', name:'Cycle Density', sub:'Compact &#x2192; Normal &#x2192; Comfortable', icon:'&#x2195;', keywords:'density compact comfortable spacing', run:() => _kbdCycleDensity() },
  { id:'toggleHud', name:'Toggle Player HUD', sub:'Show/hide the bottom HUD', icon:'&#x1F525;', keywords:'hud player bar hide show', run:() => _kbdToggleHud() },
  { id:'refresh', name:'Refresh Live Data', sub:'Sync with game now', icon:'&#x27F3;', keywords:'refresh reload sync update live', run:() => _kbdRefreshLive() },
  { id:'kbdHelp', name:'Keyboard Shortcuts', sub:'Show the Scribe\'s Codex', icon:'&#x2328;', keywords:'keyboard shortcuts help codex keys', run:() => document.getElementById('kbdHelpOverlay')?.classList.add('open') },
  { id:'changelog', name:'Changelog / About', sub:'Version history &amp; credits', icon:'&#x1F4D6;', keywords:'changelog about version history credits', run:() => openChangelog && openChangelog() },
  { id:'compare', name:'Compare Heroes', sub:'Open the compare tray', icon:'&#x2696;', keywords:'compare heroes vs skill radar', run:() => openHeroCompare && openHeroCompare() },
  { id:'notifs', name:'Notifications', sub:'Open themed notifications panel', icon:'&#x1F514;', keywords:'notifications alerts panel', run:() => { const b = document.querySelector('[onclick*="openNotifPanel"]'); if (b) b.click(); else showToast('Notifications unavailable'); } },
];

// Fuzzy subsequence scorer: returns 0 (no match) or positive score.
// - Exact match: 1000
// - Name startsWith: 500 + length bonus
// - Word-boundary startsWith (e.g. "von" matches "Baldwin von Horst"): 400
// - Substring: 200
// - Subsequence (chars in order): 100 - gap penalty
function _qsScore(haystack, needle) {
  if (!needle) return 1;
  const h = haystack.toLowerCase(), n = needle.toLowerCase();
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500 + (n.length * 2);
  // Word-boundary start
  const words = h.split(/[\s\-']+/);
  for (const w of words) if (w.startsWith(n)) return 400 + (n.length * 2);
  const idx = h.indexOf(n);
  if (idx >= 0) return 200 - idx;
  // Subsequence
  let hi = 0, ni = 0, firstIdx = -1, gaps = 0, lastHit = -1;
  while (hi < h.length && ni < n.length) {
    if (h[hi] === n[ni]) {
      if (firstIdx < 0) firstIdx = hi;
      if (lastHit >= 0) gaps += (hi - lastHit - 1);
      lastHit = hi;
      ni++;
    }
    hi++;
  }
  if (ni < n.length) return 0;
  return 100 - Math.min(firstIdx, 50) - Math.min(gaps, 40);
}

function _qsHighlight(text, needle) {
  if (!needle) return esc(text);
  const t = text, n = needle.toLowerCase(), lt = t.toLowerCase();
  // Contiguous match wins
  const idx = lt.indexOf(n);
  if (idx >= 0) return esc(t.slice(0, idx)) + '<mark class="qs-hl">' + esc(t.slice(idx, idx + n.length)) + '</mark>' + esc(t.slice(idx + n.length));
  // Subsequence highlight
  let out = '', ni = 0;
  for (let i = 0; i < t.length; i++) {
    if (ni < n.length && lt[i] === n[ni]) { out += '<mark class="qs-hl">' + esc(t[i]) + '</mark>'; ni++; }
    else out += esc(t[i]);
  }
  return out;
}

function _qsRecordRecent(entry) {
  const list = (window._qsRecents || []).filter(r => !(r.type === entry.type && r.id === entry.id));
  list.unshift({ type: entry.type, id: entry.id, name: entry.name, icon: entry.icon, sub: entry.sub });
  window._qsRecents = list.slice(0, 6);
  try { localStorage.setItem('qsRecents', JSON.stringify(window._qsRecents)); } catch(e) {}
}

function openCommandPalette() {
  const overlay = document.getElementById('cmdPaletteOverlay');
  const input = document.getElementById('cmdPaletteInput');
  if (!overlay || !input) return;
  overlay.classList.add('open');
  input.value = '';
  window._qsFilter = 'all';
  _qsUpdateChips();
  input.focus();
  renderCommandPaletteResults('');
}
function closeCommandPalette() {
  document.getElementById('cmdPaletteOverlay')?.classList.remove('open');
}

function _qsUpdateChips() {
  document.querySelectorAll('#qsFilters .qs-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === window._qsFilter);
  });
}

function _qsSetFilter(f) {
  window._qsFilter = f;
  _qsUpdateChips();
  const input = document.getElementById('cmdPaletteInput');
  renderCommandPaletteResults(input ? input.value : '');
}

function _qsHeroIcon(h) { return h.isDead ? '&#x1F480;' : '&#x1F464;'; }
function _qsSettIcon(s) { return s.type === 'Town' ? '&#x1F3D8;' : s.type === 'Castle' ? '&#x1F3F0;' : '&#x1F33E;'; }

function renderCommandPaletteResults(query) {
  const resultsEl = document.getElementById('cmdPaletteResults');
  if (!resultsEl) return;
  let q = (query || '').trim();

  // Inline filter shorthand: /h, /c, /k, /s, /p, /a
  let inlineFilter = null;
  const sm = q.match(/^\/(h|c|k|s|p|a)\s*(.*)$/i);
  if (sm) {
    inlineFilter = { h:'heroes', c:'clans', k:'kingdoms', s:'settlements', p:'pages', a:'actions' }[sm[1].toLowerCase()];
    q = sm[2];
  }
  // `>` prefix = actions only
  if (q.startsWith('>')) { inlineFilter = 'actions'; q = q.slice(1).trim(); }
  const activeFilter = inlineFilter || window._qsFilter;
  const qLower = q.toLowerCase();

  // Empty query — show recents + top pages
  if (!q && activeFilter === 'all') {
    let html = '';
    if ((window._qsRecents || []).length) {
      html += '<div class="qs-group-header"><span>&#x1F557;</span>Recent</div>';
      window._qsRecents.forEach((r, i) => {
        html += _qsResultHtml({ ...r, score: 1 }, i, '', i === 0);
      });
    }
    html += '<div class="qs-group-header"><span>&#x1F4D6;</span>Pages</div>';
    QS_PAGES.slice(0, 6).forEach((p, i) => {
      const idx = (window._qsRecents?.length || 0) + i;
      html += _qsResultHtml({ type:'pages', id:p.id, name:p.name, sub:p.sub, icon:p.icon, score:1 }, idx, '', !window._qsRecents?.length && i === 0);
    });
    resultsEl.innerHTML = html;
    _qsWireResults(resultsEl);
    return;
  }

  // Build candidate pool
  const pool = [];
  if (activeFilter === 'all' || activeFilter === 'heroes')
    (Store.heroes||[]).forEach(h => pool.push({ type:'heroes', id:h.id, name:h.name, searchText:(h.name||'')+' '+(h.clan||'')+' '+(h.culture||''), sub:(h.clan||h.culture||'') + (h.isDead?' &middot; deceased':''), icon:_qsHeroIcon(h) }));
  if (activeFilter === 'all' || activeFilter === 'clans')
    (Store.clans||[]).forEach(c => pool.push({ type:'clans', id:c.id, name:c.name, searchText:(c.name||'')+' '+(c.culture||'')+' '+(c.kingdom||''), sub:(c.kingdom?c.kingdom+' &middot; ':'')+(c.culture||''), icon:'&#x1F3E0;' }));
  if (activeFilter === 'all' || activeFilter === 'kingdoms')
    (Store.kingdoms||[]).forEach(k => pool.push({ type:'kingdoms', id:k.id, name:k.name, searchText:(k.name||'')+' '+(k.culture||''), sub:(k.culture||'kingdom'), icon:'&#x1F451;' }));
  if (activeFilter === 'all' || activeFilter === 'settlements')
    (Store.settlements||[]).forEach(s => pool.push({ type:'settlements', id:s.id, name:s.name, searchText:(s.name||'')+' '+(s.type||'')+' '+(s.kingdom||''), sub:(s.type||'')+(s.kingdom?' &middot; '+s.kingdom:''), icon:_qsSettIcon(s) }));
  if (activeFilter === 'all' || activeFilter === 'pages')
    QS_PAGES.forEach(p => pool.push({ type:'pages', id:p.id, name:p.name, searchText:p.name+' '+p.keywords, sub:p.sub, icon:p.icon }));
  if (activeFilter === 'all' || activeFilter === 'actions')
    QS_ACTIONS.forEach(a => pool.push({ type:'actions', id:a.id, name:a.name, searchText:a.name+' '+a.keywords, sub:a.sub, icon:a.icon, run:a.run }));

  // Score + sort
  const scored = [];
  for (const e of pool) {
    const s = _qsScore(e.searchText, q);
    if (s > 0) scored.push({ ...e, score: s });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = scored.slice(0, 80);

  if (!top.length) {
    resultsEl.innerHTML = '<div class="cmd-palette-empty qs-empty"><div class="qs-empty-icon">&#x1F4DC;</div><div>No matches in the annals</div><div class="qs-empty-sub">Try a different spelling or clear the filter</div></div>';
    return;
  }

  // Group by type when filter = all
  let html = '';
  if (activeFilter === 'all') {
    const groups = { heroes: [], clans: [], kingdoms: [], settlements: [], pages: [], actions: [] };
    top.forEach(e => groups[e.type]?.push(e));
    const labels = { heroes:['&#x1F464;','Heroes'], clans:['&#x1F3E0;','Clans'], kingdoms:['&#x1F451;','Kingdoms'], settlements:['&#x1F3F0;','Holds'], pages:['&#x1F4D6;','Pages'], actions:['&#x2699;','Actions'] };
    let gi = 0;
    ['pages','actions','heroes','clans','kingdoms','settlements'].forEach(key => {
      const arr = groups[key];
      if (!arr || !arr.length) return;
      html += `<div class="qs-group-header"><span>${labels[key][0]}</span>${labels[key][1]}<em class="qs-group-count">${arr.length}</em></div>`;
      arr.slice(0, 12).forEach(e => {
        html += _qsResultHtml(e, gi, qLower, gi === 0);
        gi++;
      });
    });
  } else {
    top.forEach((e, i) => { html += _qsResultHtml(e, i, qLower, i === 0); });
  }

  resultsEl.innerHTML = html;
  _qsWireResults(resultsEl);
}

function _qsResultHtml(e, idx, q, active) {
  const badge = idx < 9 ? `<kbd class="qs-num">${idx+1}</kbd>` : '';
  const nameHtml = q ? _qsHighlight(e.name, q) : esc(e.name);
  const typeCls = 'qs-type-' + e.type;
  return `<div class="cmd-palette-result qs-result ${typeCls}${active?' active':''}" data-type="${e.type}" data-id="${esc(e.id)}" data-idx="${idx}">
    <span class="cmd-palette-icon qs-icon">${e.icon || '&#x25C6;'}</span>
    <span class="qs-body">
      <span class="cmd-palette-name qs-name">${nameHtml}</span>
      <span class="cmd-palette-sub qs-sub">${e.sub || ''}</span>
    </span>
    <span class="cmd-palette-type qs-type">${e.type}</span>
    ${badge}
  </div>`;
}

function _qsWireResults(resultsEl) {
  resultsEl.querySelectorAll('.qs-result').forEach(r => {
    r.addEventListener('click', () => _qsExecute(r));
    r.addEventListener('mouseenter', () => {
      resultsEl.querySelectorAll('.qs-result').forEach(x => x.classList.remove('active'));
      r.classList.add('active');
    });
  });
}

function _qsExecute(el) {
  const type = el.dataset.type;
  const id = el.dataset.id;
  if (type === 'pages') {
    closeCommandPalette();
    showPage(id);
    return;
  }
  if (type === 'actions') {
    const action = QS_ACTIONS.find(a => a.id === id);
    closeCommandPalette();
    if (action && action.run) action.run();
    return;
  }
  // Entity — record recent + open detail
  const nameEl = el.querySelector('.qs-name');
  const subEl = el.querySelector('.qs-sub');
  const iconEl = el.querySelector('.qs-icon');
  _qsRecordRecent({ type, id, name: nameEl?.textContent || '', sub: subEl?.innerHTML || '', icon: iconEl?.innerHTML || '' });
  closeCommandPalette();
  openDetail(type, id);
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL KEYBOARD SHORTCUT SYSTEM — v2.4.0 immersive rewrite
// Gmail-style two-key nav (G+X), detail nav, global toggles, compare, timeline
// ═══════════════════════════════════════════════════════════════════════════
window._kbdPrefix = null;          // 'G' when awaiting a navigation second-key
window._kbdPrefixTimer = null;
window._kbdEnabled = localStorage.getItem('kbdShortcutsEnabled') !== '0';

function _kbdClearPrefix() {
  window._kbdPrefix = null;
  clearTimeout(window._kbdPrefixTimer);
  document.body.classList.remove('kbd-awaiting');
  const hint = document.getElementById('kbdPrefixHint');
  if (hint) hint.remove();
}

function _kbdArmPrefix(letter) {
  window._kbdPrefix = letter;
  document.body.classList.add('kbd-awaiting');
  // Floating hint chip
  let hint = document.getElementById('kbdPrefixHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'kbdPrefixHint';
    hint.className = 'kbd-prefix-hint';
    document.body.appendChild(hint);
  }
  if (letter === 'G') {
    hint.innerHTML = '<span class="kph-pressed">G</span><span class="kph-arrow">&rsaquo;</span>' +
      '<span class="kph-opts"><b>H</b>eroes&nbsp;&middot;&nbsp;<b>C</b>lans&nbsp;&middot;&nbsp;<b>K</b>ingdoms&nbsp;&middot;&nbsp;<b>S</b>ettlements&nbsp;&middot;&nbsp;<b>M</b>ap&nbsp;&middot;&nbsp;c<b>O</b>mmander&nbsp;&middot;&nbsp;<b>R</b>ankings&nbsp;&middot;&nbsp;s<b>T</b>ats&nbsp;&middot;&nbsp;<b>A</b>PI&nbsp;&middot;&nbsp;home<b>P</b>age</span>';
  }
  clearTimeout(window._kbdPrefixTimer);
  window._kbdPrefixTimer = setTimeout(_kbdClearPrefix, 1800);
}

// Page routing table for G+X
const KBD_NAV_MAP = {
  h: 'heroes', c: 'clans', k: 'kingdoms', s: 'settlements',
  m: 'map', o: 'commander', r: 'rankings', t: 'stats',
  a: 'api', p: 'home'
};

// Detail-view navigation helpers
function _kbdDetailNext(delta) {
  if (Store.currentPage !== 'detail' || !Store.detailType) return false;
  const arr = Store[Store.detailType] || [];
  if (!arr.length) return false;
  const curId = window._currentDetailId || (arr[0] && arr[0].id);
  let idx = arr.findIndex(x => x.id === curId);
  if (idx < 0) idx = 0;
  idx = (idx + delta + arr.length) % arr.length;
  openDetail(Store.detailType, arr[idx].id);
  return true;
}
function _kbdBackToList() {
  if (Store.currentPage !== 'detail' || !Store.detailType) return false;
  showPage(Store.detailType);
  return true;
}
function _kbdFocusPageSearch() {
  const ids = ['search-heroes','search-clans','search-settlements','search-kingdoms','search-chronicle','mapSearch'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) { el.focus(); el.select && el.select(); return true; }
  }
  return false;
}
function _kbdCycleDensity() {
  const order = ['compact','normal','comfortable'];
  const next = order[(order.indexOf(window._density) + 1) % order.length];
  setDensity(next);
}
function _kbdToggleHud() {
  document.body.classList.toggle('hide-hud-forced');
  const hidden = document.body.classList.contains('hide-hud-forced');
  if (hidden) document.body.classList.add('hide-hud');
  else document.body.classList.toggle('hide-hud', !HUD_VISIBLE_PAGES.has(Store.currentPage));
  showToast(hidden ? 'Player HUD hidden' : 'Player HUD visible');
}
function _kbdAddCurrentHeroToCompare() {
  if (Store.currentPage !== 'detail' || Store.detailType !== 'heroes' || !window._currentDetailId) {
    showToast('Open a hero profile first'); return;
  }
  try { addHeroToCompare(window._currentDetailId); showToast('Added to compare tray'); }
  catch(e) { showToast('Compare failed'); }
}
function _kbdRefreshLive() {
  showToast('\u27F3 Refreshing live data...');
  refreshData().then(() => { refreshCurrentPage && refreshCurrentPage(); showToast('\u2713 Synced with game'); });
}

// Main global keydown
document.addEventListener('keydown', (ev) => {
  // Typing in an input/textarea/contenteditable? Only allow Esc.
  const tag = (ev.target.tagName || '').toUpperCase();
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable;
  if (typing) {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }

  // Ctrl/Cmd+K — command palette (works even if shortcuts disabled)
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
    ev.preventDefault(); _kbdClearPrefix(); openCommandPalette(); return;
  }
  // Esc — close everything
  if (ev.key === 'Escape') {
    _kbdClearPrefix();
    closeCommandPalette();
    document.getElementById('kbdHelpOverlay')?.classList.remove('open');
    document.getElementById('heroCompareOverlay')?.classList.remove('open');
    document.getElementById('prefsOverlay')?.classList.remove('open');
    document.getElementById('changelogOverlay')?.classList.remove('open');
    document.getElementById('modalOverlay')?.classList.remove('open');
    return;
  }

  if (!window._kbdEnabled) return;

  // Ignore modified keys (except plain shift for Shift+C)
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  const key = ev.key.toLowerCase();

  // ── Prefix-aware G+X navigation ──
  if (window._kbdPrefix === 'G') {
    const target = KBD_NAV_MAP[key];
    _kbdClearPrefix();
    if (target) { ev.preventDefault(); showPage(target); showToast('\u25B8 ' + target.charAt(0).toUpperCase() + target.slice(1)); }
    return;
  }

  // ── First-key handlers ──
  switch (key) {
    case 'g':
      ev.preventDefault(); _kbdArmPrefix('G'); return;
    case '?':
      ev.preventDefault(); document.getElementById('kbdHelpOverlay')?.classList.add('open'); return;
    case '/':
      if (_kbdFocusPageSearch()) { ev.preventDefault(); }
      return;
    case 't':
      ev.preventDefault(); cycleTheme(); return;
    case 'd':
      ev.preventDefault(); _kbdCycleDensity(); return;
    case 'h':
      ev.preventDefault(); _kbdToggleHud(); return;
    case 'r':
      ev.preventDefault(); _kbdRefreshLive(); return;
    case 'n':
      if (_kbdDetailNext(1)) { ev.preventDefault(); showToast('\u25B6 Next'); }
      return;
    case 'p':
      if (_kbdDetailNext(-1)) { ev.preventDefault(); showToast('\u25C0 Previous'); }
      return;
    case 'b':
      if (_kbdBackToList()) { ev.preventDefault(); showToast('\u21A9 Back'); }
      return;
    case 'e':
      if (Store.currentPage === 'detail') {
        ev.preventDefault();
        const editBtn = document.querySelector('#detailBody .hd-action-btn, #detailBody .edit-btn, #detailBody [onclick*="openEdit"]');
        if (editBtn) editBtn.click();
      }
      return;
    case 'c':
      if (ev.shiftKey) { ev.preventDefault(); openHeroCompare && openHeroCompare(); return; }
      ev.preventDefault(); _kbdAddCurrentHeroToCompare(); return;
    case 'j':
      // Scroll next timeline entry
      if (Store.currentPage === 'detail' || Store.currentPage === 'commander') {
        const entries = document.querySelectorAll('.chronicle-entry, .timeline-entry, .tl-item');
        if (entries.length) {
          ev.preventDefault();
          window._kbdTlIdx = Math.min((window._kbdTlIdx ?? -1) + 1, entries.length - 1);
          entries[window._kbdTlIdx]?.scrollIntoView({block:'center', behavior:'smooth'});
          entries.forEach(e => e.classList.remove('kbd-focused'));
          entries[window._kbdTlIdx]?.classList.add('kbd-focused');
        }
      }
      return;
    case 'k':
      if (Store.currentPage === 'detail' || Store.currentPage === 'commander') {
        const entries = document.querySelectorAll('.chronicle-entry, .timeline-entry, .tl-item');
        if (entries.length) {
          ev.preventDefault();
          window._kbdTlIdx = Math.max((window._kbdTlIdx ?? entries.length) - 1, 0);
          entries[window._kbdTlIdx]?.scrollIntoView({block:'center', behavior:'smooth'});
          entries.forEach(e => e.classList.remove('kbd-focused'));
          entries[window._kbdTlIdx]?.classList.add('kbd-focused');
        }
      }
      return;
  }
});
// Command palette input handlers
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('cmdPaletteInput');
  if (!input) return;
  // Debounced input
  let _qsT = null;
  input.addEventListener('input', (e) => {
    clearTimeout(_qsT);
    _qsT = setTimeout(() => renderCommandPaletteResults(e.target.value), 60);
  });
  const QS_FILTER_ORDER = ['all','heroes','clans','kingdoms','settlements','pages','actions'];
  input.addEventListener('keydown', (ev) => {
    const results = document.querySelectorAll('.cmd-palette-result');
    const active = document.querySelector('.cmd-palette-result.active');
    let idx = active ? Array.from(results).indexOf(active) : -1;

    const setActive = (i) => {
      if (!results.length) return;
      i = Math.max(0, Math.min(results.length - 1, i));
      results.forEach(r => r.classList.remove('active'));
      results[i].classList.add('active');
      results[i].scrollIntoView({ block:'nearest' });
    };

    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(idx + 1); return; }
    if (ev.key === 'ArrowUp')   { ev.preventDefault(); setActive(idx - 1); return; }
    if (ev.key === 'Home')      { ev.preventDefault(); setActive(0); return; }
    if (ev.key === 'End')       { ev.preventDefault(); setActive(results.length - 1); return; }
    if (ev.key === 'PageDown')  { ev.preventDefault(); setActive(idx + 6); return; }
    if (ev.key === 'PageUp')    { ev.preventDefault(); setActive(idx - 6); return; }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      const cur = QS_FILTER_ORDER.indexOf(window._qsFilter);
      const next = (cur + (ev.shiftKey ? -1 : 1) + QS_FILTER_ORDER.length) % QS_FILTER_ORDER.length;
      _qsSetFilter(QS_FILTER_ORDER[next]);
      return;
    }
    // Ctrl+1..7 picks a filter directly
    if ((ev.ctrlKey || ev.metaKey) && /^[1-7]$/.test(ev.key)) {
      ev.preventDefault();
      _qsSetFilter(QS_FILTER_ORDER[parseInt(ev.key, 10) - 1]);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (active) _qsExecute(active);
    }
  });
  // Filter chip clicks
  document.getElementById('qsFilters')?.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.qs-chip');
    if (!chip) return;
    _qsSetFilter(chip.dataset.filter);
    input.focus();
  });
  // Click outside closes
  document.getElementById('cmdPaletteOverlay')?.addEventListener('click', (ev) => {
    if (ev.target.id === 'cmdPaletteOverlay') closeCommandPalette();
  });
});

// Nav click handlers
document.getElementById('mainNav').addEventListener('click', e => {
  const a = e.target.closest('a[data-page]');
  if (!a) return;
  e.preventDefault();
  showPage(a.dataset.page);
});

// ── Hero portrait resolver ──
function isGamePortrait(heroItem) {
  const heroId = heroItem?.id || '';
  return !!(heroId && (Store._exportedPortraits?.[heroId] || Store._customPortraits?.[heroId]));
}
function gpClass(heroItem) { return isGamePortrait(heroItem) ? ' game-portrait' : ''; }
// Inline style for blue tint fix on game portraits
// Color correction now handled server-side in FixPortraitColors (B>R algorithm)
const GP_STYLE = 'filter:contrast(1.05)';
function getPortraitSrc(heroItem, detail) {
  const heroId = heroItem.id || '';
  const cacheBust = Store._portraitCacheBust || '';
  if (heroId && Store._customPortraits?.[heroId]) return `Potrais/${encodeURIComponent(heroId)}.png${cacheBust}`;
  if (heroId && Store._exportedPortraits?.[heroId]) return `Portraits/${encodeURIComponent(heroId)}.png${cacheBust}`;
  const isFemale = detail?.isFemale || heroItem.isFemale || false;
  const gender = isFemale ? 'female' : 'male';
  const culture = (heroItem.culture || '').toLowerCase().replace(/\s+/g, '');
  const culturePortraits = {
    'aserai':         { folder: 'Aserai',          prefix: 'aserai',          variants: 3 },
    'battania':       { folder: 'Battania',        prefix: 'battania',        variants: 3 },
    'khuzait':        { folder: 'Khuzait',         prefix: 'khuzait',         variants: 3 },
    'empire':         { folder: 'Mixed Empire',    prefix: 'empire',          variants: 2, legacy: true },
    'northernempire': { folder: 'Northern_Empire', prefix: 'northern_empire', variants: 3 },
    'westernempire':  { folder: 'Western_Empire',  prefix: 'western_empire',  variants: 3 },
    'southernempire': { folder: 'Southern_Empire', prefix: 'southern_empire', variants: 3 },
    'sturgia':        { folder: 'Sturgia',         prefix: 'sturgia',         variants: 3 },
    'vlandia':        { folder: 'Vlandia',         prefix: 'vlandia',         variants: 3 },
    'nord':           { folder: 'Nord',            prefix: 'nord',            variants: 3 }
  };
  const info = culturePortraits[culture] || culturePortraits['empire'];
  const hash = (heroItem.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = (hash % (isFemale ? Math.min(info.variants, 2) : info.variants)) + 1;
  if (info.legacy) return `Potraits/${encodeURIComponent(info.folder)}/portrait_${gender}_${info.prefix}_${variant}.png`;
  return `Potraits/${encodeURIComponent(info.folder)}/${info.prefix}_${gender}_${String(variant).padStart(2,'0')}.png`;
}

// ── Kingdom Comparison Dropdowns ──
function toggleKrDropdown(side) {
  const dd = document.getElementById(`kr-dd-${side}`);
  if (!dd) return;
  const isOpen = dd.classList.contains('kr-dd-open');
  // Close all
  document.querySelectorAll('.kr-dropdown').forEach(d => d.classList.remove('kr-dd-open'));
  if (!isOpen) { dd.classList.add('kr-dd-open'); UISounds?.pageTurn(); }
}
function selectKrKingdom(side, id, name, el) {
  const dd = document.getElementById(`kr-dd-${side}`);
  const input = document.getElementById(`kr-compare-${side}`);
  if (dd) {
    dd.querySelector('.kr-dd-text').textContent = name;
    dd.classList.remove('kr-dd-open');
    dd.querySelectorAll('.kr-dd-item').forEach(i => i.classList.remove('kr-dd-active'));
    el.classList.add('kr-dd-active');
  }
  if (input) { input.value = id; }
  UISounds?.pageTurn();
  updateKingdomCompare();
}
// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.kr-dropdown')) {
    document.querySelectorAll('.kr-dropdown').forEach(d => d.classList.remove('kr-dd-open'));
  }
});

// ── Kingdom Comparison ──
function updateKingdomCompare() {
  const arr = window._kingdomsArr || [];
  const aId = document.getElementById('kr-compare-a')?.value;
  const bId = document.getElementById('kr-compare-b')?.value;
  const result = document.getElementById('kr-compare-result');
  if (!result || !aId || !bId || aId === bId) { if (result) result.innerHTML = ''; return; }

  const a = arr.find(k => k.id === aId);
  const b = arr.find(k => k.id === bId);
  if (!a || !b) return;

  const getBanner = k => k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
  // Distinct colors: use banner color but ensure kingdoms are visually different
  const getColor = k => {
    const code = (k.bannerCode||'').split('.').map(Number);
    return (typeof BANNER_COLORS !== 'undefined' && BANNER_COLORS[code[1]]) || getCultureColor(k.culture);
  };
  const getPower = k => (k.strength || 0) || ((k.fiefCount || 0) * 100 + (k.clanCount || 0) * 50);
  const fmtV = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v);

  // Use fixed distinct palette if colors are too similar
  let colorA = getColor(a), colorB = getColor(b);
  if (colorA === colorB) {
    colorA = '#3399dd'; colorB = '#dd6633';
  } else {
    // Check if they look too similar (hex distance)
    const hexDist = (c1, c2) => {
      const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
      const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
      return Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
    };
    if (colorA.length >= 7 && colorB.length >= 7 && hexDist(colorA, colorB) < 120) {
      colorB = '#dd8833'; // force distinct if too similar
    }
  }

  const metrics = [
    { label: 'Power', icon: '&#x2694;', a: getPower(a), b: getPower(b) },
    { label: 'Clans', icon: '&#x2618;', a: a.clanCount||0, b: b.clanCount||0 },
    { label: 'Fiefs', icon: '&#x1F3F0;', a: a.fiefCount||0, b: b.fiefCount||0 },
    { label: 'Wars', icon: '&#x1F525;', a: (a.wars||[]).length, b: (b.wars||[]).length },
    { label: 'Strength', icon: '&#x1F6E1;', a: a.strength||0, b: b.strength||0 }
  ];

  // Pentagon radar chart — enlarged with more label padding
  const cx = 150, cy = 150, maxR = 95;
  const n = metrics.length;
  const angles = metrics.map((_, i) => (i / n) * 2 * Math.PI - Math.PI/2);
  const maxVals = metrics.map(m => Math.max(m.a, m.b, 1));

  const polyPt = (ang, i, val) => {
    const r = Math.max((val / maxVals[i]) * maxR, 8);
    return `${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`;
  };
  const polyA = angles.map((ang, i) => polyPt(ang, i, metrics[i].a)).join(' ');
  const polyB = angles.map((ang, i) => polyPt(ang, i, metrics[i].b)).join(' ');

  const gridLines = [0.2, 0.4, 0.6, 0.8, 1].map(pct =>
    `<polygon points="${angles.map(ang => `${cx + maxR*pct*Math.cos(ang)},${cy + maxR*pct*Math.sin(ang)}`).join(' ')}"
      fill="none" stroke="rgba(184,140,50,.06)" stroke-width="1"/>`
  ).join('');
  const axisLines = angles.map(ang =>
    `<line x1="${cx}" y1="${cy}" x2="${cx + maxR*Math.cos(ang)}" y2="${cy + maxR*Math.sin(ang)}"
      stroke="rgba(184,140,50,.1)" stroke-width="1"/>`
  ).join('');
  const labels = angles.map((ang, i) => {
    const lx = cx + (maxR + 28) * Math.cos(ang);
    const ly = cy + (maxR + 28) * Math.sin(ang);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
      fill="var(--paper2)" font-size="11" font-weight="600">${metrics[i].label}</text>`;
  }).join('');
  const dotsA = angles.map((ang, i) => {
    const r = Math.max((metrics[i].a / maxVals[i]) * maxR, 8);
    return `<circle cx="${cx + r*Math.cos(ang)}" cy="${cy + r*Math.sin(ang)}" r="4" fill="${colorA}" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');
  const dotsB = angles.map((ang, i) => {
    const r = Math.max((metrics[i].b / maxVals[i]) * maxR, 8);
    return `<circle cx="${cx + r*Math.cos(ang)}" cy="${cy + r*Math.sin(ang)}" r="4" fill="${colorB}" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');

  const bannerA = getBanner(a), bannerB = getBanner(b);
  const aWins = metrics.filter(m => m.a > m.b).length;
  const bWins = metrics.filter(m => m.b > m.a).length;
  const ties = metrics.length - aWins - bWins;
  const verdictName = aWins > bWins ? a.name : bWins > aWins ? b.name : null;
  const verdictColor = aWins > bWins ? colorA : bWins > aWins ? colorB : 'var(--gold)';
  const verdictText = verdictName ? verdictName + ' dominates' : 'Evenly matched';
  const verdictScore = `${aWins} — ${ties > 0 ? ties + ' — ' : ''}${bWins}`;

  result.innerHTML = `<div class="kr-cmp">
    <div class="kr-cmp-sides">
      <div class="kr-cmp-side" onclick="openDetail('kingdoms','${a.id}')">
        ${bannerA ? `<img class="kr-cmp-banner" src="${bannerA}" alt="">` : ''}
        <div class="kr-cmp-name" style="color:${colorA}">${a.name}</div>
      </div>
      <div class="kr-cmp-vs">VS</div>
      <div class="kr-cmp-side" onclick="openDetail('kingdoms','${b.id}')">
        ${bannerB ? `<img class="kr-cmp-banner" src="${bannerB}" alt="">` : ''}
        <div class="kr-cmp-name" style="color:${colorB}">${b.name}</div>
      </div>
    </div>
    <div class="kr-cmp-verdict-wrap">
      <div class="kr-cmp-verdict" style="color:${verdictColor}">${verdictText}</div>
      <div class="kr-cmp-score">${verdictScore}</div>
    </div>
    <div class="kr-cmp-body">
      <svg viewBox="0 0 300 300" class="kr-radar">
        <defs>
          <radialGradient id="rg"><stop offset="0%" stop-color="rgba(184,140,50,.04)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${maxR}" fill="url(#rg)"/>
        ${gridLines}${axisLines}
        <polygon points="${polyA}" fill="${colorA}30" stroke="${colorA}" stroke-width="2.5" class="kr-radar-poly" style="animation-delay:0s"/>
        <polygon points="${polyB}" fill="${colorB}30" stroke="${colorB}" stroke-width="2.5" stroke-dasharray="6,3" class="kr-radar-poly" style="animation-delay:.15s"/>
        ${dotsA}${dotsB}
        ${labels}
      </svg>
      <div class="kr-cmp-bars">${metrics.map((m, mi) => {
        const total = m.a + m.b || 1;
        const aPct = Math.round(m.a / total * 100);
        const bPct = 100 - aPct;
        const winner = m.a > m.b ? 'a' : m.b > m.a ? 'b' : '';
        return `<div class="kr-cmp-metric" style="animation-delay:${mi * 0.08}s">
          <span class="kr-cmp-val ${winner === 'a' ? 'kr-cmp-winner' : ''}" style="color:${colorA}">${fmtV(m.a)}</span>
          <div class="kr-cmp-bar-wrap">
            <div class="kr-cmp-bar-a" style="width:${aPct}%;background:${colorA}${winner === 'a' ? '' : '88'}"></div>
            <div class="kr-cmp-bar-b" style="width:${bPct}%;background:${colorB}${winner === 'b' ? '' : '88'}"></div>
            <span class="kr-cmp-bar-label">${m.icon} ${m.label}</span>
          </div>
          <span class="kr-cmp-val ${winner === 'b' ? 'kr-cmp-winner' : ''}" style="color:${colorB}">${fmtV(m.b)}</span>
        </div>`;
      }).join('')}</div>
    </div>
    <div class="kr-cmp-legend">
      <span class="kr-cmp-leg-item"><span class="kr-cmp-leg-dot" style="background:${colorA}"></span>${a.name}</span>
      <span class="kr-cmp-leg-item"><span class="kr-cmp-leg-dot" style="background:${colorB}"></span>${b.name}</span>
    </div>
  </div>`;
}

// ── Sigil SVG generator (cached, uses banner code when available) ──
const _sigilCache = {};
function makeSigil(name, type, bannerCode, entityId) {
  // Use pre-rendered banner image if available
  if (entityId && Store._bannerImages?.[entityId]) {
    return `Banners/${encodeURIComponent(entityId)}.png`;
  }
  // Use game banner SVG if available
  if (bannerCode && typeof renderBannerSVG === 'function') {
    const bKey = 'b_' + bannerCode.substring(0, 30);
    if (_sigilCache[bKey]) return _sigilCache[bKey];
    const uri = bannerToDataUri(bannerCode, 200);
    if (uri) { _sigilCache[bKey] = uri; return uri; }
  }
  const colors = {
    heroes: '#a15b5b', clans: '#9c7dc9', settlements: '#d8b35f', kingdoms: '#6d8cb1'
  };
  const color = colors[type] || '#d8b35f';
  const ini = esc(initials(name));
  const cacheKey = `${ini}_${type}`;
  if (_sigilCache[cacheKey]) return _sigilCache[cacheKey];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs><radialGradient id="g" cx="35%" cy="18%" r="88%">
      <stop offset="0%" stop-color="#2a2319"/><stop offset="100%" stop-color="#090807"/>
    </radialGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#7a5a18"/>
    </linearGradient></defs>
    <rect width="200" height="200" rx="24" fill="url(#g)"/>
    <circle cx="100" cy="95" r="60" fill="none" stroke="url(#b)" stroke-width="5" opacity=".8"/>
    <text x="100" y="112" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#f6e7c0" font-weight="700">${ini}</text>
    <text x="100" y="170" text-anchor="middle" font-family="Georgia,serif" font-size="10" letter-spacing="2" fill="#b79a63">${esc(type?.toUpperCase() || '')}</text>
  </svg>`;
  const uri = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  _sigilCache[cacheKey] = uri;
  return uri;
}

// ── Card builder ──
function buildCard(item, type, index) {
  const id = esc(item.id || '');
  const name = esc(item.name || '(Unnamed)');
  const sub = [item.culture, item.kingdom, item.clan, item.type, item.owner].filter(Boolean).join(' \u00b7 ');
  const badges = [];
  if (item.culture) badges.push(`<span class="badge">${esc(item.culture)}</span>`);
  if (item.isDead) badges.push(`<span class="badge badge-red">Deceased</span>`);
  if (item.hasCustomDescription) badges.push(`<span class="badge badge-green">Edited</span>`);
  const desc = item.description ? `<div class="card-desc">${esc(truncate(item.description, 120))}</div>` : '';

  const stats = [];
  if (item.age) stats.push(['Age', item.age]);
  if (item.clan) stats.push(['Clan', item.clan]);
  if (item.kingdom) stats.push(['Kingdom', item.kingdom]);
  if (item.ruler) stats.push(['Ruler', item.ruler]);
  if (item.type) stats.push(['Type', item.type]);
  if (item.owner) stats.push(['Owner', item.owner]);

  const search = [item.name, item.culture, item.kingdom, item.clan, item.type, item.owner, item.description].filter(Boolean).join(' ').toLowerCase();

  // Stagger class for animation (caps at 8)
  const stagger = index !== undefined ? ` stagger-${Math.min(index % 8 + 1, 8)}` : '';

  // For heroes, find their clan to get the banner
  let bannerEntityId = item.id;
  if (type === 'heroes' && item.clan) {
    const clan = (Store.clans || []).find(c => c.name === item.clan);
    if (clan) bannerEntityId = clan.id;
  }

  // Banner background watermark for clans
  const bannerBg = (type === 'clans') && item.bannerCode
    ? `<div class="card-banner-bg"><img src="${makeSigil(item.name, type, item.bannerCode, bannerEntityId)}" alt="" loading="lazy"></div>`
    : '';

  // Kingdom cards — special full layout
  if (type === 'kingdoms') {
    const bannerSrc = bannerEntityId && Store._bannerImages?.[bannerEntityId]
      ? `Banners/${encodeURIComponent(bannerEntityId)}.png`
      : makeSigil(item.name, type, item.bannerCode, bannerEntityId);
    const code = (item.bannerCode || '').split('.').map(Number);
    const bgColorId = code.length >= 3 ? code[1] : 0;
    const bgColor = (typeof BANNER_COLORS !== 'undefined' && BANNER_COLORS[bgColorId]) || '#1a1a2e';
    const wars = item.wars || [];
    const atWar = wars.length > 0;
    const fmtK = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v || 0);

    return `<div class="kingdom-card fade-in${stagger}" onclick="openDetail('kingdoms','${id}')" data-search="${esc(search)}" data-id="${id}">
      <div class="kc-bg" style="background:linear-gradient(135deg,${bgColor}cc,${bgColor}44)"></div>
      <div class="kc-pattern"></div>
      ${atWar ? '<div class="kc-war-indicator"></div>' : '<div class="kc-peace-indicator"></div>'}
      <div class="kc-content">
        <div class="kc-banner-wrap">
          <img class="kc-banner" src="${bannerSrc}" alt="" loading="lazy">
        </div>
        <div class="kc-info">
          <h3 class="kc-name">${name}</h3>
          <div class="kc-culture">${esc(item.culture || '')}</div>
          <div class="kc-ruler">${item.ruler ? 'Ruler: <strong>' + esc(item.ruler) + '</strong>' : ''}</div>
        </div>
        <div class="kc-stats">
          <div class="kc-stat"><span class="kc-stat-val">${fmtK(item.strength)}</span><span class="kc-stat-lbl">Strength</span></div>
          <div class="kc-stat"><span class="kc-stat-val">${item.clanCount || 0}</span><span class="kc-stat-lbl">Clans</span></div>
          <div class="kc-stat"><span class="kc-stat-val">${item.fiefCount || 0}</span><span class="kc-stat-lbl">Fiefs</span></div>
        </div>
      </div>
      ${atWar ? `<div class="kc-wars"><span class="kc-wars-icon">&#x2694;</span> At war with: ${wars.filter(w => !w.includes('andits') && !w.includes('aiders') && !w.includes('ooters') && !w.includes('esert') && !w.includes('orsairs')).join(', ') || 'Minor factions'}</div>` : (() => {
        // Find all other kingdoms this one is at peace with
        const allKingdoms = (Store.kingdoms || []).filter(k => k.name !== item.name);
        const enemies = allKingdoms.filter(k => (k.wars || []).includes(item.name));
        const allies = allKingdoms.filter(k => !enemies.includes(k) && !(k.wars || []).includes(item.name));
        const allyNames = allies.map(k => k.name);
        return `<div class="kc-peace"><span class="kc-peace-icon">&#x2618;</span> At peace with: ${allyNames.join(', ') || 'None'}</div>`;
      })()}
    </div>`;
  }

  // Settlement cards — full visual layout with culture bg, type styling, prosperity glow
  if (type === 'settlements') {
    const st = (item.type || '').toLowerCase();
    const imgSrc = st === 'castle' ? 'Settlement/Castle.png' : st === 'village' ? 'Settlement/Village.png' : 'Settlement/Town.png';
    const typeIcon = st === 'castle' ? '&#x1F3F0;' : st === 'village' ? '&#x1F33E;' : '&#x1F3DB;';
    const typeLabel = item.type || 'Settlement';
    const prosp = item.prosperity || 0;
    const maxProsp = Math.max(...(Store.settlements || []).map(s => s.prosperity || 0), 1);
    const prospPct = Math.round(prosp / maxProsp * 100);
    const prospTier = prosp > maxProsp * 0.66 ? 'high' : prosp > maxProsp * 0.33 ? 'mid' : 'low';
    const prospColor = prospTier === 'high' ? '#4caf50' : prospTier === 'mid' ? '#ff9800' : '#ef5350';
    const garr = item.garrison || 0;
    const mil = item.militia || 0;
    const cultureColor = getCultureColor(item.culture);
    const ownerBanner = item.bannerCode && bannerEntityId && Store._bannerImages?.[bannerEntityId]
      ? `Banners/${encodeURIComponent(bannerEntityId)}.png` : '';
    const fmtN = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v || 0);
    // Type-specific border colors
    const typeBorder = st === 'town' ? 'rgba(216,179,95,.25)' : st === 'castle' ? 'rgba(160,160,180,.2)' : 'rgba(120,160,80,.2)';
    const typeGlow = st === 'town' ? 'rgba(216,179,95,.08)' : st === 'castle' ? 'rgba(140,140,170,.06)' : 'rgba(100,140,60,.06)';
    // Wars — check if settlement's kingdom is at war
    const settKingdom = (Store.kingdoms || []).find(k => k.name === item.kingdom);
    const atWar = settKingdom?.wars?.length > 0;

    // Shield badge colors per type
    const badgeBg = st === 'town' ? 'linear-gradient(180deg,#d4b050,#8b6914)' : st === 'castle' ? 'linear-gradient(180deg,#a0a0b8,#5a5a70)' : 'linear-gradient(180deg,#6a9a40,#3a6020)';

    return `<div class="sett-card sc-${st} fade-in${stagger}${prospTier === 'high' ? ' sc-thriving' : ''}${atWar ? ' sc-at-war' : ''}" onclick="openDetail('settlements','${id}')" data-search="${esc(search)}" data-id="${id}" data-subtype="${st}" style="border-color:${typeBorder}">
      <div class="sc-bg" style="background:linear-gradient(150deg,${cultureColor}18,${cultureColor}06)"></div>
      <div class="sc-img-watermark">
        <img src="${imgSrc}" alt="" loading="lazy">
        ${ownerBanner ? `<img class="sc-owner-banner" src="${ownerBanner}" alt="" loading="lazy">` : ''}
        <div class="sc-type-badge" style="background:${badgeBg}">${typeIcon}</div>
      </div>
      ${atWar ? '<div class="sc-war-badge">&#x2694;</div>' : ''}
      ${garr > 0 && st !== 'village' ? `<div class="sc-garrison-badge"><span class="sc-garr-icon">&#x1F6E1;</span>${fmtN(garr)}</div>` : ''}
      <div class="sc-culture-bar" style="background:${cultureColor}"></div>
      <div class="sc-body">
        <div class="sc-type"><span class="sc-type-icon">${typeIcon}</span>${typeLabel}</div>
        <h3 class="sc-name">${name}</h3>
        <div class="sc-culture">${esc(item.culture || '')}${item.kingdom ? ' \u2022 ' + esc(item.kingdom) : ''}</div>
        ${item.owner ? `<div class="sc-owner">${esc(item.owner)}</div>` : ''}
        ${st !== 'village' ? `<div class="sc-prosp">
          <div class="sc-prosp-label"><span>Prosperity</span><span class="sc-prosp-val">${fmtN(prosp)}</span></div>
          <div class="sc-prosp-bar"><div class="sc-prosp-fill" style="--w:${prospPct}%;background:${prospColor};color:${prospColor}"></div></div>
        </div>` : (item.villageProduces ? `<div class="sc-produces"><span class="sc-prod-icon">&#x1F33F;</span> Produces ${esc(item.villageProduces)}</div>` : '')}
        ${st !== 'village' ? `<div class="sc-stats-row">
          ${mil > 0 ? `<div class="sc-stat"><span class="sc-stat-icon">&#x2694;</span><span class="sc-stat-val">${fmtN(mil)}</span><span class="sc-stat-lbl">Militia</span></div>` : ''}
          ${item.loyalty ? `<div class="sc-stat"><span class="sc-stat-icon">&#x2764;</span><span class="sc-stat-val">${item.loyalty}</span><span class="sc-stat-lbl">Loyalty</span></div>` : ''}
          ${item.security ? `<div class="sc-stat"><span class="sc-stat-icon">&#x1F6E1;</span><span class="sc-stat-val">${item.security}</span><span class="sc-stat-lbl">Security</span></div>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }

  // Clan cards — custom layout with banner, tier, kingdom badge, stats
  if (type === 'clans') {
    const bannerSrc = bannerEntityId && Store._bannerImages?.[bannerEntityId]
      ? `Banners/${encodeURIComponent(bannerEntityId)}.png`
      : makeSigil(item.name, type, item.bannerCode, bannerEntityId);
    const cultureColor = getCultureColor(item.culture);
    const tier = item.tier || 0;
    const tierColors = { 1:'#8b7355', 2:'#a08050', 3:'#b8943e', 4:'#d4a43a', 5:'#e8c84a', 6:'#ffd700' };
    const tierColor = tierColors[tier] || '#d4a43a';
    const stars = Array.from({length: Math.min(tier, 6)}, () => `<span style="color:${tierColor};text-shadow:0 0 6px ${tierColor}80">&#x2605;</span>`).join('');
    const fmtN = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v || 0);
    const atWar = item.wars?.length > 0;
    const isBandit = item.isBandit;
    const isMinor = item.isMinorFaction;
    const hasK = item.kingdom && item.kingdom.length > 0;
    // Kingdom faction color
    const kObj = hasK ? (Store.kingdoms || []).find(k => k.name === item.kingdom) : null;
    const kColor = kObj ? getCultureColor(kObj.culture) : cultureColor;

    return `<div class="clan-card fade-in${stagger}${atWar ? ' cc-at-war' : ''}${isBandit ? ' cc-bandit-card' : ''}" onclick="openDetail('clans','${id}')" data-search="${esc(search)}" data-id="${id}" ${item.bannerCode ? `data-banner="${esc(item.bannerCode)}"` : ''}>
      <div class="cc-bg" style="background:linear-gradient(150deg,${cultureColor}18,${cultureColor}06)"></div>
      <div class="cc-culture-bar" style="background:${cultureColor}"></div>
      <div class="cc-header">
        <div class="cc-banner-wrap">
          <img class="cc-banner" src="${bannerSrc}" alt="" loading="lazy">
        </div>
        <div class="cc-info">
          <h3 class="cc-name">${name}</h3>
          <div class="cc-sub">${esc(item.culture || '')}${item.leader ? ' · ' + esc(item.leader) : ''}</div>
        </div>
      </div>
      <div class="cc-body">
        <div class="cc-meta">
          ${tier > 0 ? `<span class="cc-tier"><span class="cc-tier-stars">${stars}</span> Tier ${tier}</span>` : ''}
          ${hasK ? `<span class="cc-kingdom" style="border-color:${kColor}44"><span class="cc-kingdom-dot" style="background:${kColor}"></span>${esc(item.kingdom)}</span>` : (isMinor ? '<span class="cc-kingdom cc-minor-badge">Minor Faction</span>' : isBandit ? '<span class="cc-kingdom cc-bandit-badge">Bandit</span>' : '<span class="cc-kingdom cc-indep-badge">Independent</span>')}
        </div>
        <div class="cc-stats">
          <div class="cc-stat"><span class="cc-stat-val">${fmtN(item.strength)}</span><span class="cc-stat-lbl">Strength</span></div>
          <div class="cc-stat"><span class="cc-stat-val">${item.members || 0}</span><span class="cc-stat-lbl">Members</span></div>
          <div class="cc-stat"><span class="cc-stat-val">${item.fiefs || 0}</span><span class="cc-stat-lbl">Fiefs</span></div>
        </div>
      </div>
      ${atWar ? `<div class="cc-war">&#x2694; At war</div>` : ''}
    </div>`;
  }

  // Hero cards — custom layout with portrait, culture bar, occupation badge, clan info
  if (type === 'heroes') {
    const avatarSrc = getPortraitSrc(item, item);
    const cultureColor = getCultureColor(item.culture);
    const isDead = item.isDead;
    const occ = item.occupation || '';
    const occColors = { Lord:'#9c7dc9', Wanderer:'#4caf50', Notable:'#ff9800', Companion:'#2196f3', Artisan:'#8d6e63', Merchant:'#ffc107', GangLeader:'#ef5350', Preacher:'#ab47bc', RuralNotable:'#7cb342', Headman:'#8d6e63' };
    const occColor = occColors[occ] || '#6b5b3e';
    const clanBanner = bannerEntityId && Store._bannerImages?.[bannerEntityId]
      ? `Banners/${encodeURIComponent(bannerEntityId)}.png` : '';

    return `<div class="hero-card fade-in${stagger}${isDead ? ' hc-dead' : ''}" onclick="openDetail('heroes','${id}')" data-search="${esc(search)}" data-id="${id}" data-dead="${isDead ? '1' : '0'}" ${item.bannerCode ? `data-banner="${esc(item.bannerCode)}"` : ''}>
      <div class="hc-culture-bar" style="background:${cultureColor}"></div>
      ${clanBanner ? `<img class="hc-clan-banner" src="${clanBanner}" alt="" loading="lazy">` : ''}
      <div class="hc-portrait-wrap">
        <img class="hc-portrait${isGamePortrait(item) ? ' game-portrait' : ''}" src="${avatarSrc}" alt="" loading="lazy" onerror="this.src='Hero/bannerlord_hero_viking.png'" ${isGamePortrait(item) ? `style="${GP_STYLE}"` : ''}>
        ${isDead ? '<div class="hc-dead-overlay"></div>' : ''}
      </div>
      <div class="hc-body">
        <h3 class="hc-name">${name}</h3>
        <div class="hc-sub">${esc(item.culture || '')}${item.clan ? ' · ' + esc(item.clan) : ''}</div>
        <div class="hc-meta">
          ${occ ? `<span class="hc-occ" style="background:${occColor}22;color:${occColor};border-color:${occColor}33">${esc(occ)}</span>` : ''}
          ${item.age ? `<span class="hc-age">Age ${item.age}</span>` : ''}
          ${isDead ? '<span class="hc-deceased">Deceased</span>' : ''}
        </div>
      </div>
    </div>`;
  }

  // Generic cards (fallback)
  let avatarSrc = makeSigil(item.name, type, item.bannerCode, bannerEntityId);

  return `<div class="card fade-in${stagger}" onclick="openDetail('${type}','${id}')" data-search="${esc(search)}" data-id="${id}" data-dead="${item.isDead ? '1' : '0'}" data-custom="${item.hasCustomDescription ? '1' : '0'}" data-subtype="${esc((item.type || '').toLowerCase())}" ${item.bannerCode ? `data-banner="${esc(item.bannerCode)}"` : ''}>
    ${bannerBg}
    <div class="card-top">
      <div class="avatar"><img src="${avatarSrc}" alt="" loading="lazy" onerror="this.src='Hero/bannerlord_hero_viking.png'"></div>
      <div style="min-width:0">
        <h3 class="card-name">${name}</h3>
        <div class="card-sub">${esc(sub)}</div>
      </div>
    </div>
    <div class="card-body">
      <div class="badges">${badges.join('')}</div>
      ${desc}
      ${stats.length ? `<div class="card-stats">${stats.slice(0, 4).map(([k, v]) =>
        `<div class="stat"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

// ── Render home page ──
function renderHome() {
  const s = Store.status || {};
  document.getElementById('pillDate').textContent = `Date: ${s.date || '\u2014'}`;
  document.getElementById('pillPlayer').textContent = `Player: ${s.player || '\u2014'}`;
  updateSidebarRailHud();
  updateSidebarRailBadges();

  const counts = {
    heroes: Store.heroes.length,
    clans: Store.clans.length,
    settlements: Store.settlements.length,
    kingdoms: Store.kingdoms.length
  };

  document.getElementById('heroMeta').innerHTML = Object.entries(counts)
    .map(([k, v]) => `<span class="meta-chip">${esc(k)}: ${v}</span>`).join('');

  const icons = { Heroes: '\u2694', Clans: '\u2618', Settlements: '\u26F0', Kingdoms: '\u265A' };
  const tooltips = {
    Heroes: 'Lords, ladies, companions, and notable figures across Calradia',
    Clans: 'Total active noble houses and their bloodlines',
    Settlements: 'Towns, castles, and villages under various rulers',
    Kingdoms: 'Major realms and factions vying for dominion'
  };

  document.getElementById('summaryGrid').innerHTML = [
    ['Heroes', counts.heroes, 'Notable figures and companions', 'heroes'],
    ['Clans', counts.clans, 'Noble bloodlines and houses', 'clans'],
    ['Settlements', counts.settlements, 'Towns, castles, villages', 'settlements'],
    ['Kingdoms', counts.kingdoms, 'Major realms of Calradia', 'kingdoms']
  ].map(([k, v, d, page], i) => `
    <div class="summary fade-in stagger-${i + 1}" onclick="showPage('${page}')" title="${tooltips[k] || ''}">
      <div class="icon">${icons[k] || ''}</div>
      <div class="k">${k}</div>
      <div class="v">${v}</div>
      <div class="d">${d}</div>
    </div>`).join('');

  document.getElementById('catCards').innerHTML = [
    ['heroes', 'Heroes', 'Lords, ladies, and companions of Calradia'],
    ['clans', 'Clans', 'Noble houses and their banners'],
    ['settlements', 'Settlements', 'Towns, castles, and villages'],
    ['kingdoms', 'Kingdoms', 'Major realms vying for control']
  ].map(([id, title, desc], i) => `
    <div class="cat-card cat-card-${id} fade-in stagger-${i + 1}" onclick="showPage('${id}')">
      <div class="cat-bg"></div>
      <div class="cat-body">
        <div class="cat-top"><h3>${title}</h3><div class="cat-count">${counts[id] || 0}</div></div>
        <div class="cat-desc">${desc}</div>
        <div class="cat-foot"><span>Open archive</span><span class="arrow">&rarr;</span></div>
      </div>
    </div>`).join('');

  // ── World Status Panel ──
  const kingdoms = Store.kingdoms || [];
  const clans = Store.clans || [];
  const ws = document.getElementById('worldStatus');
  if (ws) {
    // Active wars
    const warPairs = [];
    const seen = new Set();
    kingdoms.forEach(k => (k.wars || []).forEach(e => {
      const pair = [k.name, e].sort().join('|');
      if (!seen.has(pair)) { seen.add(pair); warPairs.push({ a: k.name, b: e }); }
    }));
    // Strongest kingdom
    const strongest = [...kingdoms].sort((a,b) => (b.strength||0) - (a.strength||0))[0];
    // Largest kingdom (most fiefs)
    const largest = [...kingdoms].sort((a,b) => (b.fiefCount||0) - (a.fiefCount||0))[0];
    // Richest clan
    const richest = [...clans].filter(c => !c.isBandit).sort((a,b) => (b.wealth||0) - (a.wealth||0))[0];

    // Get banner images for kingdoms
    const getBannerImg = (name) => {
      const k = kingdoms.find(x => x.name === name);
      return k?.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
    };
    const getClanBanner = (name) => {
      const c = clans.find(x => x.name === name);
      return c?.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
    };

    // War ticker items
    const warTicker = warPairs.length > 0 ? `<div class="ws-wars-ticker">
      ${warPairs.slice(0, 5).map((w, i) => `<div class="ws-war-match" style="animation-delay:${i * 0.1}s">
        <span class="ws-war-name">${w.a}</span>
        <span class="ws-war-vs">&#x2694;</span>
        <span class="ws-war-name">${w.b}</span>
      </div>`).join('')}
    </div>` : '';

    ws.innerHTML = `
      <div class="ws-title"><span class="ws-title-icon">&#x1F30D;</span> World Status</div>
      <div class="ws-item ws-wars" onclick="showPage('kingdoms');setFilter('kingdoms','atwar');" style="cursor:pointer">
        <span class="ws-icon ws-wars-pulse">${warPairs.length}</span>
        <div class="ws-info">
          <span class="ws-val" style="color:#c05050">Active Wars</span>
          <span class="ws-label">${warPairs.length} conflict${warPairs.length !== 1 ? 's' : ''} across Calradia</span>
        </div>
      </div>
      ${warTicker}
      ${strongest ? `<div class="ws-item" onclick="openDetail('kingdoms','${strongest.id}')" style="cursor:pointer">
        ${getBannerImg(strongest.name) ? `<img class="ws-banner" src="${getBannerImg(strongest.name)}" alt="">` : '<span class="ws-icon">&#x1F451;</span>'}
        <div class="ws-info">
          <span class="ws-val">${strongest.name}</span>
          <span class="ws-label">Strongest Kingdom</span>
        </div>
      </div>` : ''}
      ${largest && largest.name !== strongest?.name ? `<div class="ws-item" onclick="openDetail('kingdoms','${largest.id}')" style="cursor:pointer">
        ${getBannerImg(largest.name) ? `<img class="ws-banner" src="${getBannerImg(largest.name)}" alt="">` : '<span class="ws-icon">&#x1F3F0;</span>'}
        <div class="ws-info">
          <span class="ws-val">${largest.name}</span>
          <span class="ws-label">Most Fiefs (${largest.fiefCount})</span>
        </div>
      </div>` : ''}
      ${richest ? `<div class="ws-item" onclick="openDetail('clans','${richest.id}')" style="cursor:pointer">
        ${getClanBanner(richest.name) ? `<img class="ws-banner" src="${getClanBanner(richest.name)}" alt="">` : '<span class="ws-icon">&#x1F4B0;</span>'}
        <div class="ws-info">
          <span class="ws-val">${richest.name}</span>
          <span class="ws-label">Wealthiest Clan</span>
        </div>
      </div>` : ''}`;
  }

  // ── Player Summary ──
  const ps = document.getElementById('playerSummary');
  if (ps && s.player) {
    const playerClan = clans.find(c => c.leader === s.player) || clans.find(c => c.name === (s.clan || ''));
    const playerKingdom = kingdoms.find(k => k.name === (s.kingdom || ''));
    const playerHero = (Store.heroes || []).find(h => h.name === s.player);
    const playerPortrait = playerHero ? getPortraitSrc(playerHero, playerHero) : '';
    const clanBanner = playerClan?.id && Store._bannerImages?.[playerClan.id]
      ? `Banners/${encodeURIComponent(playerClan.id)}.png` : '';
    const cultureColor = getCultureColor(playerClan?.culture || playerHero?.culture || '');

    ps.innerHTML = `
      <div class="ps-culture-bar" style="background:${cultureColor}"></div>
      <div class="ps-header">
        ${playerPortrait ? `<img class="ps-portrait${playerHero && isGamePortrait(playerHero) ? ' game-portrait' : ''}" src="${playerPortrait}" alt="" onerror="this.style.display='none'">` : '<span class="ps-icon">&#x1F396;</span>'}
        <div class="ps-info">
          <span class="ps-name">${esc(s.player)}</span>
          <span class="ps-sub">${[s.clan, s.kingdom].filter(Boolean).join(' · ') || 'Adventurer'}</span>
        </div>
        ${clanBanner ? `<img class="ps-clan-banner" src="${clanBanner}" alt="">` : ''}
      </div>
      <div class="ps-stats">
        <div class="ps-stat" style="--ps-color:rgba(216,179,60,.15)">
          <span class="ps-stat-icon">&#x1F4B0;</span>
          <span class="ps-stat-val" style="color:#e8c848">${s.gold?.toLocaleString() || 0}</span>
          <span class="ps-stat-lbl">Gold</span>
        </div>
        <div class="ps-stat" style="--ps-color:rgba(180,100,80,.12)">
          <span class="ps-stat-icon">&#x2694;</span>
          <span class="ps-stat-val">${s.troops || 0}<span style="color:#6a5a42;font-size:13px">/${s.troopLimit || '?'}</span></span>
          <span class="ps-stat-lbl">Troops</span>
        </div>
        <div class="ps-stat" style="--ps-color:rgba(100,180,100,.1)">
          <span class="ps-stat-icon">&#x2B50;</span>
          <span class="ps-stat-val">${Math.round(s.morale || 0)}%</span>
          <span class="ps-stat-lbl">Morale</span>
        </div>
        <div class="ps-stat" style="--ps-color:rgba(160,140,100,.1)">
          <span class="ps-stat-icon">&#x1F3F0;</span>
          <span class="ps-stat-val">${playerClan?.fiefs || 0}</span>
          <span class="ps-stat-lbl">Fiefs</span>
        </div>
        <div class="ps-stat" style="--ps-color:rgba(200,60,60,.1)">
          <span class="ps-stat-icon">&#x2764;&#xFE0F;</span>
          <span class="ps-stat-val" style="color:#e08080">${Math.round(s.hitPoints || 0)}<span style="color:#6a5a42;font-size:13px">/${Math.round(s.maxHitPoints || 0)}</span></span>
          <span class="ps-stat-lbl">Health</span>
        </div>
        <div class="ps-stat" style="--ps-color:rgba(100,120,200,.1)">
          <span class="ps-stat-icon">&#x1F451;</span>
          <span class="ps-stat-val" style="color:#80a0d0">${Math.round(s.influence || 0)}</span>
          <span class="ps-stat-lbl">Influence</span>
        </div>
      </div>`;
  }

  // ── New home widgets ──
  renderHomeQuickActions();
  renderHomeCalendar(s);
  renderHomeTreasury();
  renderHomeFactions();
  renderHomeHighlights();
  renderHomeNews();
  renderHomeAchievements();
  renderHomeQuote();
  applySeasonParticles(s);

  // ── Animated counting for summary grid ──
  document.querySelectorAll('#summaryGrid .summary .v').forEach(el => {
    const target = parseInt(el.textContent) || 0;
    if (target <= 0) return;
    el.textContent = '0';
    const dur = 1200;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ── Live Chronicle (Home page) ──
// ── Chronicle tag detection & filtering ──
function detectEventTag(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('[war]') || t.includes('battle') || t.includes('attack') || t.includes('fought')) return 'war';
  if (t.includes('[family]') || t.includes('married') || t.includes('birth') || t.includes('child') || t.includes('pregnant') || t.includes('with child')) return 'family';
  if (t.includes('[politics]') || t.includes('king') || t.includes('ruler') || t.includes('defect') || t.includes('join')) return 'politics';
  if (t.includes('[crime]') || t.includes('prisoner') || t.includes('captured') || t.includes('ransom')) return 'crime';
  if (t.includes('died') || t.includes('killed') || t.includes('death') || t.includes('slain')) return 'death';
  if (t.includes('siege') || t.includes('raided')) return 'siege';
  if (t.includes('peace') || t.includes('truce') || t.includes('alliance')) return 'diplomacy';
  return 'other';
}

const TAG_LABELS = {
  all: '&#x2726; All', war: '&#x2694; War', family: '&#x2764; Family', politics: '&#x265A; Politics',
  crime: '&#x26D3; Crime', death: '&#x2620; Death', siege: '&#x1F3F0; Siege', diplomacy: '&#x2696; Diplomacy', other: '&#x2726; Other'
};
const TAG_COLORS = {
  war: '#c05050', family: '#d8a0b0', politics: '#6d8cb1', crime: '#c07040',
  death: '#a15b5b', siege: '#a08e6a', diplomacy: '#5b8f69', other: '#8a7858'
};

function buildChronicleFilters(events, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const counts = { all: events.length };
  events.forEach(e => {
    const tag = detectEventTag(e.text);
    counts[tag] = (counts[tag] || 0) + 1;
  });
  const tags = ['all', ...Object.keys(counts).filter(k => k !== 'all' && counts[k] > 0)];
  el.innerHTML = tags.map(tag => {
    const color = TAG_COLORS[tag] || 'var(--gold2)';
    const active = tag === 'all' ? ' active' : '';
    return `<button class="tag-filter${active}" data-tag="${tag}" style="--tag-color:${color}" onclick="filterChronicle('${containerId}','${tag}',this)">${TAG_LABELS[tag] || tag} <span class="tag-filter-count">${counts[tag]}</span></button>`;
  }).join('');
}

function filterChronicle(containerId, tag, btn) {
  // Update active state
  const container = document.getElementById(containerId);
  if (container) container.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Determine which scroll container to filter
  const isLc = containerId === 'lcFilters';
  const events = isLc
    ? document.querySelectorAll('#lcScroll .lc-event')
    : document.querySelectorAll('#chronicle-list .event');
  events.forEach(ev => {
    if (tag === 'all') { ev.style.display = ''; return; }
    const text = ev.textContent || '';
    const evTag = detectEventTag(text);
    ev.style.display = evTag === tag ? '' : 'none';
  });
}

async function renderLiveChronicle(cachedChronicle) {
  const scroll = document.getElementById('lcScroll');
  const countEl = document.getElementById('lcCount');
  if (!scroll) return;

  const chronicle = cachedChronicle || await API.getAllChronicle();
  if (!chronicle || chronicle.length === 0) {
    scroll.innerHTML = `<div class="lc-empty">
      <div class="lc-empty-img"></div>
      <div class="lc-empty-text">No world events recorded yet.<br>Play the game to see history unfold here.</div>
    </div>`;
    countEl.textContent = '0 events';
    return;
  }

  // Show most recent events first, limit to 50 for performance
  const events = chronicle.slice(-50).reverse();
  countEl.textContent = `${chronicle.length} event${chronicle.length !== 1 ? 's' : ''} total`;
  buildChronicleFilters(events, 'lcFilters');

  scroll.innerHTML = events.map((e, i) => {
    const isLast = i === events.length - 1;
    const txt = (e.text || '').toLowerCase();
    // Event type icon based on content keywords
    let icon = '\u2726'; // default diamond
    if (txt.includes('battle') || txt.includes('attack') || txt.includes('fought') || txt.includes('[war]')) icon = '\u2694'; // swords
    else if (txt.includes('king') || txt.includes('ruler') || txt.includes('crown') || txt.includes('[politics]')) icon = '\u265A'; // crown
    else if (txt.includes('siege') || txt.includes('castle') || txt.includes('settlement')) icon = '\u26F0'; // fortress
    else if (txt.includes('died') || txt.includes('killed') || txt.includes('death') || txt.includes('slain')) icon = '\u2620'; // skull
    else if (txt.includes('married') || txt.includes('birth') || txt.includes('child') || txt.includes('[family]')) icon = '\u2661'; // heart
    else if (txt.includes('clan') || txt.includes('house') || txt.includes('banner')) icon = '\u2618'; // fleur
    else if (txt.includes('trade') || txt.includes('gold') || txt.includes('merchant')) icon = '\u2692'; // hammer
    else if (txt.includes('peace') || txt.includes('truce') || txt.includes('alliance')) icon = '\u2696'; // scales
    else if (txt.includes('prisoner') || txt.includes('captured') || txt.includes('ransom')) icon = '\u26D3'; // chains
    return `<div class="lc-event" style="animation-delay:${Math.min(i * 0.04, 0.8)}s">
      <div class="lc-dot-col">
        <div class="lc-dot"><span class="lc-icon">${icon}</span></div>
        ${!isLast ? '<div class="lc-line"></div>' : ''}
      </div>
      <div class="lc-body">
        <div class="lc-date">${esc(e.date || '')}</div>
        <div class="lc-text">${textToHtml(e.text)}</div>
        ${e.entityId ? entityBadge(e.entityId) : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Render list pages ──
window._heroesQuickFilter = 'all';
window._heroesSort = 'default';
window._heroesView = 'grid';
window._clansQuickFilter = 'all';
window._clansSort = 'default';
window._clansView = 'grid';
window._settQuickFilter = 'all';
window._settSort = 'default';
window._settView = 'grid';
window._kingdomsQuickFilter = 'all';
window._kingdomsSort = 'default';
window._kingdomsView = 'grid';

function setKingdomsQuickFilter(f) { _kingdomsQuickFilter = f; renderList('kingdoms'); }
function setKingdomsSort(v) { _kingdomsSort = v; renderList('kingdoms'); }
function setKingdomsView(v) { _kingdomsView = v; const g = document.getElementById('grid-kingdoms'); if (g) g.classList.toggle('view-compact', v === 'compact'); renderList('kingdoms'); }
function openRandomKingdom() {
  const arr = (Store.kingdoms || []);
  if (!arr.length) { showToast('No kingdoms available', true); return; }
  const pick = arr[Math.floor(Math.random() * arr.length)];
  openDetail('kingdoms', pick.id);
}

function renderKingdomsExtras() {
  const el = document.getElementById('kingdoms-extras');
  if (!el) return;
  const all = (Store.kingdoms || []);
  if (!all.length) { el.innerHTML = ''; return; }

  // Culture filter panel
  const cultureFilter = _activeCultureFromFilter('kingdoms');
  if (cultureFilter) { el.innerHTML = renderCulturePanel(cultureFilter); return; }

  // Special panels for at-war / at-peace filters (sidebar or quick chip)
  const sidebarFilter = Store.filters.kingdoms || 'all';
  const isWarMode = _kingdomsQuickFilter === 'atwar' || sidebarFilter === 'atwar';
  const isPeaceMode = _kingdomsQuickFilter === 'atpeace' || sidebarFilter === 'atpeace';

  if (isWarMode) {
    el.innerHTML = renderWarRoomPanel();
    return;
  }
  if (isPeaceMode) {
    el.innerHTML = renderPeacePanel();
    return;
  }

  // Kingdom of the Day — deterministic
  const day = Math.floor(Date.now() / 86400000);
  const featured = all[day % all.length];
  const featBanner = featured?.id && Store._bannerImages?.[featured.id]
    ? `Banners/${encodeURIComponent(featured.id)}.png` : '';
  const rulerName = featured?.ruler || featured?.leader || '';
  const ruler = (Store.heroes || []).find(h => h.name === rulerName);
  const rulerImg = ruler ? getPortraitSrc(ruler, ruler) : '';

  let html = '';

  // Spotlight (reuse cod-spotlight class from Clans page)
  html += `<div class="cod-spotlight" onclick="openDetail('kingdoms','${esc(featured.id)}')">
    ${featBanner ? `<img class="cod-banner-img" src="${featBanner}">` : '<div class="cod-banner-img"></div>'}
    <div class="cod-info">
      <div class="hod-kicker">\u{2606} Realm of the Day</div>
      <div class="hod-name">${esc(featured.name||'')}</div>
      <div class="cod-leader">
        ${rulerImg ? `<img src="${rulerImg}" onerror="this.style.display='none'">` : ''}
        <span>Ruled by <b style="color:#f5d878">${esc(rulerName||'?')}</b> &middot; ${esc(featured.culture||'?')}</span>
      </div>
      <div class="cod-stats-inline">
        <div><b>${(Number(featured.strength)||0).toLocaleString()}</b>Strength</div>
        <div><b>${(Number(featured.clanCount||featured.clans?.length)||0).toLocaleString()}</b>Clans</div>
        <div><b>${(Number(featured.fiefCount)||0).toLocaleString()}</b>Fiefs</div>
        <div><b>${(Number((featured.wars||[]).length)||0).toLocaleString()}</b>Wars</div>
        <div><b>${(Number(featured.towns||0)).toLocaleString()}</b>Towns</div>
        <div><b>${(Number(featured.castles||0)).toLocaleString()}</b>Castles</div>
      </div>
    </div>
    <div class="hod-medal">\u{1F451}</div>
  </div>`;

  // Quick stats
  const allies = all.filter(k => k.diplomacy === 'Ally').length;
  const enemies = all.filter(k => k.diplomacy === 'Enemy').length;
  const atwar = all.filter(k => (k.wars||[]).length > 0).length;
  const atpeace = all.filter(k => (k.wars||[]).length === 0).length;
  const own = all.filter(k => k.diplomacy === 'Own Kingdom').length;

  html += '<div class="hp-stats-row">';
  const sc = (icon,num,lbl,col) => `<div class="hp-stat-card" style="--hps-color:${col}"><span class="hp-stat-icon">${icon}</span><b class="hp-stat-num" data-count-target="${num}">0</b><span class="hp-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F451}', all.length, 'Total', '#d4b878');
  if (own > 0) html += sc('\u{2606}', own, 'Mine', '#f5d878');
  html += sc('\u{1F91D}', allies, 'Allies', '#7ac070');
  html += sc('\u{2694}', enemies, 'Enemies', '#a15b5b');
  html += sc('\u{1F525}', atwar, 'At War', '#c08060');
  html += sc('\u{1F54A}', atpeace, 'At Peace', '#80a0d0');
  html += '</div>';

  // Top by strength ribbon (reuse toh-ribbon class from Clans page)
  const top = all.slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0)).slice(0, 8);
  if (top.length > 0) {
    html += '<div class="toh-ribbon"><div class="toh-label">\u{1F6E1} Great Powers</div><div class="toh-list">';
    top.forEach((k, i) => {
      const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
      html += `<div class="toh-item" onclick="openDetail('kingdoms','${esc(k.id)}')">
        ${banner ? `<img src="${banner}">` : '<div style="width:42px;height:54px;background:#1a1410;border:1px solid rgba(184,140,50,.3)"></div>'}
        <div class="toh-item-rank">${i+1}</div>
        <div class="toh-item-name">${esc(k.name||'')}</div>
        <div class="toh-item-tier">${(Number(k.strength)||0).toLocaleString()}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  // Active wars panel
  const warPairs = [];
  const seen = new Set();
  all.forEach(k => (k.wars || []).forEach(enemyName => {
    const pair = [k.name, enemyName].sort().join('|');
    if (seen.has(pair)) return;
    seen.add(pair);
    const enemyK = all.find(x => x.name === enemyName);
    warPairs.push({ a: k, b: enemyK });
  }));
  if (warPairs.length > 0) {
    html += '<div class="kw-panel"><div class="kw-label">\u{1F525} Active Wars</div><div class="kw-list">';
    warPairs.slice(0, 12).forEach(w => {
      const aBanner = w.a?.id && Store._bannerImages?.[w.a.id] ? `Banners/${encodeURIComponent(w.a.id)}.png` : '';
      const bBanner = w.b?.id && Store._bannerImages?.[w.b.id] ? `Banners/${encodeURIComponent(w.b.id)}.png` : '';
      html += `<div class="kw-match">
        ${aBanner ? `<img class="kw-banner" src="${aBanner}">` : '<div class="kw-banner-empty"></div>'}
        <span class="kw-name" onclick="event.stopPropagation();openDetail('kingdoms','${esc(w.a?.id||'')}')">${esc(w.a?.name||'?')}</span>
        <span class="kw-vs">\u{2694}</span>
        <span class="kw-name" onclick="event.stopPropagation();openDetail('kingdoms','${esc(w.b?.id||'')}')">${esc(w.b?.name||'?')}</span>
        ${bBanner ? `<img class="kw-banner" src="${bBanner}">` : '<div class="kw-banner-empty"></div>'}
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

function renderWarRoomPanel() {
  const all = (Store.kingdoms || []);
  // Build deduped war pairs
  const seen = new Set();
  const pairs = [];
  all.forEach(k => (k.wars || []).forEach(enemyName => {
    const key = [k.name, enemyName].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    const enemyK = all.find(x => x.name === enemyName);
    if (enemyK) pairs.push({ a: k, b: enemyK });
  }));

  if (pairs.length === 0) {
    return `<div class="warroom-panel">
      <div class="warroom-header">
        <div class="warroom-torch">\u{1F525}</div>
        <div class="warroom-title">War Room<span class="warroom-title-sub">No active wars in Calradia</span></div>
        <div class="warroom-pulse" style="background:#7ac070;box-shadow:0 0 12px #7ac070"></div>
      </div>
      <div style="padding:24px;text-align:center;font-family:Cinzel,serif;font-size:11px;color:#9a8260;letter-spacing:1px">A rare moment of peace blankets the realm.</div>
    </div>`;
  }

  // Total strength engaged
  let engaged = 0;
  pairs.forEach(p => { engaged += (Number(p.a.strength)||0) + (Number(p.b.strength)||0); });

  let html = `<div class="warroom-panel">
    <div class="warroom-header">
      <div class="warroom-torch">\u{1F525}</div>
      <div class="warroom-title">War Room<span class="warroom-title-sub">Theatre of conflict across the realm</span></div>
      <div class="warroom-meter"><span class="warroom-meter-num">${pairs.length}</span><span class="warroom-meter-lbl">Active Wars</span></div>
      <div class="warroom-meter"><span class="warroom-meter-num">${engaged.toLocaleString()}</span><span class="warroom-meter-lbl">Forces Engaged</span></div>
      <div class="warroom-pulse"></div>
    </div>
    <div class="bt-grid">`;

  pairs.forEach(({ a, b }) => {
    const aBanner = a.id && Store._bannerImages?.[a.id] ? `Banners/${encodeURIComponent(a.id)}.png` : '';
    const bBanner = b.id && Store._bannerImages?.[b.id] ? `Banners/${encodeURIComponent(b.id)}.png` : '';
    const aRulerName = a.ruler || a.leader || '';
    const bRulerName = b.ruler || b.leader || '';
    const aRuler = (Store.heroes || []).find(h => h.name === aRulerName);
    const bRuler = (Store.heroes || []).find(h => h.name === bRulerName);
    const aImg = aRuler ? getPortraitSrc(aRuler, aRuler) : '';
    const bImg = bRuler ? getPortraitSrc(bRuler, bRuler) : '';
    const aS = Number(a.strength)||0;
    const bS = Number(b.strength)||0;
    const total = Math.max(1, aS + bS);
    const aPct = (aS/total)*100;
    const bPct = (bS/total)*100;
    let status = 'EVEN';
    if (aPct > 60) status = `${esc(a.name||'?').toUpperCase()} ADVANTAGE`;
    else if (bPct > 60) status = `${esc(b.name||'?').toUpperCase()} ADVANTAGE`;
    html += `<div class="bt-card">
      <div class="bt-side" onclick="openDetail('kingdoms','${esc(a.id)}')">
        ${aBanner ? `<img class="bt-banner" src="${aBanner}">` : '<div class="bt-banner-empty"></div>'}
        <div class="bt-side-name">${esc(a.name||'?')}</div>
        <div class="bt-side-leader">${aImg ? `<img src="${aImg}" onerror="this.style.display='none'">` : ''}<span>${esc(aRulerName||'?')}</span></div>
        <div class="bt-side-strength">${aS.toLocaleString()}</div>
      </div>
      <div class="bt-vs">
        <div class="bt-vs-icon">\u{2694}</div>
        <div class="bt-vs-bar">
          <div class="bt-vs-bar-a" style="width:${aPct}%"></div>
          <div class="bt-vs-bar-b" style="width:${bPct}%"></div>
        </div>
        <div class="bt-vs-status">${status}</div>
      </div>
      <div class="bt-side" onclick="openDetail('kingdoms','${esc(b.id)}')">
        ${bBanner ? `<img class="bt-banner" src="${bBanner}">` : '<div class="bt-banner-empty"></div>'}
        <div class="bt-side-name">${esc(b.name||'?')}</div>
        <div class="bt-side-leader">${bImg ? `<img src="${bImg}" onerror="this.style.display='none'">` : ''}<span>${esc(bRulerName||'?')}</span></div>
        <div class="bt-side-strength">${bS.toLocaleString()}</div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderPeacePanel() {
  const all = (Store.kingdoms || []);
  const peaceful = all.filter(k => (k.wars || []).length === 0);
  const total = all.length || 1;
  const stability = Math.round((peaceful.length / total) * 100);

  let html = `<div class="peace-panel">
    <div class="peace-header">
      <div class="peace-dove">\u{1F54A}</div>
      <div class="peace-title">Hall of Peace<span class="peace-title-sub">Realms unburdened by war</span></div>
      <div class="peace-meter"><span class="peace-meter-num">${peaceful.length}</span><span class="peace-meter-lbl">At Peace</span></div>
      <div class="peace-meter"><span class="peace-meter-num">${stability}%</span><span class="peace-meter-lbl">Stability</span></div>
    </div>`;

  if (peaceful.length === 0) {
    html += '<div style="padding:24px;text-align:center;font-family:Cinzel,serif;font-size:11px;color:#9ac0a0;letter-spacing:1px">War rages everywhere &mdash; no kingdom enjoys peace.</div></div>';
    return html;
  }

  html += '<div class="pc-grid">';
  peaceful.forEach(k => {
    const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
    const rulerName = k.ruler || k.leader || '';
    html += `<div class="pc-card" onclick="openDetail('kingdoms','${esc(k.id)}')">
      ${banner ? `<img class="pc-banner" src="${banner}">` : '<div class="pc-banner-empty"></div>'}
      <div class="pc-info">
        <div class="pc-name">${esc(k.name||'?')}</div>
        <div class="pc-meta">Ruled by <b>${esc(rulerName||'?')}</b> &middot; ${esc(k.culture||'?')}</div>
        <div class="pc-meta"><b>${(Number(k.fiefCount)||0)}</b> fiefs &middot; <b>${(Number(k.strength)||0).toLocaleString()}</b> strength</div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderKingdomsToolbar() {
  const el = document.getElementById('kingdoms-toolbar');
  if (!el) return;
  const chips = [
    ['all','All'], ['mine','My Kingdom'], ['ally','Allies'],
    ['enemy','Enemies'], ['atwar','At War'], ['atpeace','At Peace'],
  ];
  let html = '<div class="hp-toolbar"><div class="hp-chips">';
  chips.forEach(([k,label]) => {
    html += `<button class="hp-chip ${_kingdomsQuickFilter===k?'active':''}" onclick="setKingdomsQuickFilter('${k}')">${label}</button>`;
  });
  html += '</div>';
  html += `<select class="hp-sort" onchange="setKingdomsSort(this.value)">
    <option value="default" ${_kingdomsSort==='default'?'selected':''}>Default</option>
    <option value="name" ${_kingdomsSort==='name'?'selected':''}>Name A-Z</option>
    <option value="strength" ${_kingdomsSort==='strength'?'selected':''}>Strength</option>
    <option value="fiefs" ${_kingdomsSort==='fiefs'?'selected':''}>Fiefs</option>
    <option value="clans" ${_kingdomsSort==='clans'?'selected':''}>Clans</option>
    <option value="wars" ${_kingdomsSort==='wars'?'selected':''}>Wars</option>
  </select>`;
  html += `<select class="hp-view" onchange="setKingdomsView(this.value)">
    <option value="grid" ${_kingdomsView==='grid'?'selected':''}>Grid</option>
    <option value="compact" ${_kingdomsView==='compact'?'selected':''}>Compact</option>
  </select>`;
  html += '<button class="hp-rand-btn" onclick="openRandomKingdom()">\u{1F3B2} Surprise Me</button>';
  html += '</div>';
  el.innerHTML = html;
}

function setSettQuickFilter(f) { _settQuickFilter = f; renderList('settlements'); }
function setSettSort(v) { _settSort = v; renderList('settlements'); }
function setSettView(v) { _settView = v; const g = document.getElementById('grid-settlements'); if (g) g.classList.toggle('view-compact', v === 'compact'); renderList('settlements'); }
function openRandomSettlement() {
  const arr = (Store.settlements || []);
  if (!arr.length) { showToast('No settlements available', true); return; }
  const pick = arr[Math.floor(Math.random() * arr.length)];
  openDetail('settlements', pick.id);
}

function _settImg(s) {
  const t = (s?.type || '').toLowerCase();
  if (t === 'castle') return 'Settlement/Castle.png';
  if (t === 'village' || s?.isVillage) return 'Settlement/Village.png';
  return 'Settlement/Town.png';
}

function renderSettlementsExtras() {
  const el = document.getElementById('settlements-extras');
  if (!el) return;
  const cultureFilter = _activeCultureFromFilter('settlements');
  if (cultureFilter) { el.innerHTML = renderCulturePanel(cultureFilter); return; }
  const all = (Store.settlements || []);
  if (!all.length) { el.innerHTML = ''; return; }

  // Settlement of the Day — deterministic, prefer high-prosperity towns
  const day = Math.floor(Date.now() / 86400000);
  const towns = all.filter(s => s.type === 'Town');
  const featured = (towns.length ? towns : all)[day % Math.max(1, (towns.length||all.length))];
  const ownerClan = (Store.clans || []).find(c => c.name === featured?.owner);
  const ownerBanner = ownerClan?.id && Store._bannerImages?.[ownerClan.id]
    ? `Banners/${encodeURIComponent(ownerClan.id)}.png` : '';

  let html = '';

  // Spotlight
  html += `<div class="sod-spotlight" onclick="openDetail('settlements','${esc(featured.id)}')">
    <div class="sod-img" style="background-image:url('${_settImg(featured)}')"></div>
    <div class="sod-info">
      <div class="hod-kicker">\u{2606} Settlement of the Day</div>
      <div class="hod-name">${esc(featured.name||'')}</div>
      <div class="sod-meta">
        ${ownerBanner ? `<img src="${ownerBanner}">` : ''}
        <span><b>${esc(featured.type||'?')}</b> &middot; ${esc(featured.culture||'?')}${featured.kingdom?' &middot; '+esc(featured.kingdom):''}${featured.owner?' &middot; '+esc(featured.owner):''}</span>
      </div>
      <div class="sod-stats-inline">
        ${featured.prosperity != null ? `<div><b>${(Number(featured.prosperity)||0).toLocaleString()}</b>Prosperity</div>` : ''}
        ${featured.loyalty != null ? `<div><b>${Math.round(Number(featured.loyalty)||0)}</b>Loyalty</div>` : ''}
        ${featured.security != null ? `<div><b>${Math.round(Number(featured.security)||0)}</b>Security</div>` : ''}
        ${featured.foodStocks != null ? `<div><b>${Math.round(Number(featured.foodStocks)||0)}</b>Food</div>` : ''}
        ${featured.garrison != null ? `<div><b>${(Number(featured.garrison)||0).toLocaleString()}</b>Garrison</div>` : ''}
        ${featured.militia != null ? `<div><b>${(Number(featured.militia)||0).toLocaleString()}</b>Militia</div>` : ''}
      </div>
    </div>
    <div class="sod-medal">\u{1F3F0}</div>
  </div>`;

  // Quick stats
  const towns2 = all.filter(s => s.type === 'Town').length;
  const castles = all.filter(s => s.type === 'Castle').length;
  const villages = all.filter(s => s.isVillage || s.type === 'Village').length;
  const sieged = all.filter(s => s.isUnderSiege).length;
  const raided = all.filter(s => s.isRaided).length;
  const playerClanName = Store.status?.clan || '';
  const yours = playerClanName ? all.filter(s => s.owner === playerClanName).length : 0;

  html += '<div class="hp-stats-row">';
  const sc = (icon,num,lbl,col) => `<div class="hp-stat-card" style="--hps-color:${col}"><span class="hp-stat-icon">${icon}</span><b class="hp-stat-num" data-count-target="${num}">0</b><span class="hp-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F3D8}', all.length, 'Total', '#d4b878');
  html += sc('\u{1F3DB}', towns2, 'Towns', '#d8b35f');
  html += sc('\u{1F3F0}', castles, 'Castles', '#a08e6a');
  html += sc('\u{1F33E}', villages, 'Villages', '#7ac070');
  html += sc('\u{2694}', sieged, 'Under Siege', '#a15b5b');
  html += sc('\u{1F525}', raided, 'Raided', '#c08060');
  if (yours > 0) html += sc('\u{1F451}', yours, 'My Holdings', '#f5d878');
  html += '</div>';

  // Most prosperous ribbon — top 8 by prosperity
  const top = all.slice().filter(s => s.type === 'Town' || s.type === 'Castle')
    .sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0))
    .slice(0, 8);
  if (top.length > 0) {
    html += '<div class="mpr-ribbon"><div class="mpr-label">\u{1F525} Most Prosperous</div><div class="mpr-list">';
    top.forEach((s, i) => {
      html += `<div class="mpr-item" onclick="openDetail('settlements','${esc(s.id)}')">
        <div class="mpr-thumb" style="background-image:url('${_settImg(s)}')"></div>
        <div class="mpr-item-rank">${i+1}</div>
        <div class="mpr-item-name">${esc(s.name||'')}</div>
        <div class="mpr-item-prosp">${(Number(s.prosperity)||0).toLocaleString()}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

function renderSettlementsToolbar() {
  const el = document.getElementById('settlements-toolbar');
  if (!el) return;
  const chips = [
    ['all','All'], ['Town','Towns'], ['Castle','Castles'],
    ['Village','Villages'], ['siege','Under Siege'],
    ['raided','Raided'], ['mine','My Holdings'],
  ];
  let html = '<div class="hp-toolbar"><div class="hp-chips">';
  chips.forEach(([k,label]) => {
    html += `<button class="hp-chip ${_settQuickFilter===k?'active':''}" onclick="setSettQuickFilter('${k}')">${label}</button>`;
  });
  html += '</div>';
  html += `<select class="hp-sort" onchange="setSettSort(this.value)">
    <option value="default" ${_settSort==='default'?'selected':''}>Default</option>
    <option value="name" ${_settSort==='name'?'selected':''}>Name A-Z</option>
    <option value="prosperity" ${_settSort==='prosperity'?'selected':''}>Prosperity</option>
    <option value="loyalty" ${_settSort==='loyalty'?'selected':''}>Loyalty</option>
    <option value="security" ${_settSort==='security'?'selected':''}>Security</option>
    <option value="garrison" ${_settSort==='garrison'?'selected':''}>Garrison</option>
    <option value="food" ${_settSort==='food'?'selected':''}>Food</option>
  </select>`;
  html += `<select class="hp-view" onchange="setSettView(this.value)">
    <option value="grid" ${_settView==='grid'?'selected':''}>Grid</option>
    <option value="compact" ${_settView==='compact'?'selected':''}>Compact</option>
  </select>`;
  html += '<button class="hp-rand-btn" onclick="openRandomSettlement()">\u{1F3B2} Surprise Me</button>';
  html += '</div>';
  el.innerHTML = html;
}

function setClansQuickFilter(f) { _clansQuickFilter = f; renderList('clans'); }
function setClansSort(v) { _clansSort = v; renderList('clans'); }
function setClansView(v) { _clansView = v; const g = document.getElementById('grid-clans'); if (g) g.classList.toggle('view-compact', v === 'compact'); renderList('clans'); }
function openRandomClan() {
  const arr = (Store.clans || []).filter(c => !c.isBandit && c.members > 0);
  if (!arr.length) { showToast('No clans available', true); return; }
  const pick = arr[Math.floor(Math.random() * arr.length)];
  openDetail('clans', pick.id);
}

function renderClansExtras() {
  const el = document.getElementById('clans-extras');
  if (!el) return;
  const cultureFilter = _activeCultureFromFilter('clans');
  if (cultureFilter) { el.innerHTML = renderCulturePanel(cultureFilter); return; }
  const all = (Store.clans || []);
  if (!all.length) { el.innerHTML = ''; return; }

  // Clan of the Day — deterministic per day
  const day = Math.floor(Date.now() / 86400000);
  const eligible = all.filter(c => !c.isBandit && c.members > 0 && c.tier >= 2);
  const featured = eligible[day % Math.max(1, eligible.length)] || all[0];
  const featBanner = featured?.id && Store._bannerImages?.[featured.id] ? `Banners/${encodeURIComponent(featured.id)}.png` : '';
  const leader = (Store.heroes || []).find(h => h.name === featured?.leader);
  const leaderImg = leader ? getPortraitSrc(leader, leader) : '';

  let html = '';

  // Spotlight
  html += `<div class="cod-spotlight" onclick="openDetail('clans','${esc(featured.id)}')">
    ${featBanner ? `<img class="cod-banner-img" src="${featBanner}">` : '<div class="cod-banner-img"></div>'}
    <div class="cod-info">
      <div class="hod-kicker">\u{2606} House of the Day</div>
      <div class="hod-name">${esc(featured.name||'')}</div>
      <div class="cod-leader">
        ${leaderImg ? `<img src="${leaderImg}" onerror="this.style.display='none'">` : ''}
        <span>Led by <b style="color:#f5d878">${esc(featured.leader||'?')}</b> &middot; ${esc(featured.culture||'?')}${featured.kingdom?' &middot; '+esc(featured.kingdom):' &middot; Independent'}</span>
      </div>
      <div class="cod-stats-inline">
        <div><b>T${featured.tier||0}</b>Tier</div>
        <div><b>${(Number(featured.members)||0).toLocaleString()}</b>Members</div>
        <div><b>${(Number(featured.fiefs)||0).toLocaleString()}</b>Fiefs</div>
        <div><b>${(Number(featured.strength)||0).toLocaleString()}</b>Strength</div>
        <div><b>${(Number(featured.renown)||0).toLocaleString()}</b>Renown</div>
        <div><b>${(Number(featured.wealth)||0).toLocaleString()}</b>Wealth</div>
      </div>
    </div>
    <div class="hod-medal">\u{1F451}</div>
  </div>`;

  // Quick stats
  const kingdomClans = all.filter(c => c.kingdom && !c.isBandit && !c.isMinorFaction).length;
  const minor = all.filter(c => c.isMinorFaction).length;
  const bandit = all.filter(c => c.isBandit).length;
  const independent = all.filter(c => !c.kingdom && !c.isBandit && !c.isMinorFaction).length;
  const eliminated = all.filter(c => c.members === 0 && c.tier === 0).length;
  const playerKingdomName = Store.status?.kingdom || '';
  const allies = playerKingdomName ? all.filter(c => c.kingdom === playerKingdomName).length : 0;
  html += '<div class="hp-stats-row">';
  const sc = (icon,num,lbl,col) => `<div class="hp-stat-card" style="--hps-color:${col}"><span class="hp-stat-icon">${icon}</span><b class="hp-stat-num" data-count-target="${num}">0</b><span class="hp-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F3E0}', all.length, 'Total', '#d4b878');
  html += sc('\u{1F451}', kingdomClans, 'Kingdom', '#80a0d0');
  html += sc('\u{2697}', minor, 'Minor', '#a08e6a');
  html += sc('\u{1F3F4}', independent, 'Independent', '#7ac070');
  html += sc('\u{2620}', bandit, 'Bandits', '#a15b5b');
  html += sc('\u{1F480}', eliminated, 'Eliminated', '#7c6840');
  if (allies > 0) html += sc('\u{1F91D}', allies, 'Allies', '#f5d878');
  html += '</div>';

  // Top houses ribbon — top 8 by tier, then renown
  const top = all.slice().filter(c => !c.isBandit && c.members > 0).sort((a,b)=>{
    const dt = (Number(b.tier)||0) - (Number(a.tier)||0);
    if (dt !== 0) return dt;
    return (Number(b.renown)||0) - (Number(a.renown)||0);
  }).slice(0, 8);
  if (top.length > 0) {
    html += '<div class="toh-ribbon"><div class="toh-label">\u{1F3F0} Top Houses</div><div class="toh-list">';
    top.forEach((c, i) => {
      const banner = c.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
      html += `<div class="toh-item" onclick="openDetail('clans','${esc(c.id)}')">
        ${banner ? `<img src="${banner}">` : '<div style="width:42px;height:54px;background:#1a1410;border:1px solid rgba(184,140,50,.3)"></div>'}
        <div class="toh-item-rank">${i+1}</div>
        <div class="toh-item-name">${esc(c.name||'')}</div>
        <div class="toh-item-tier">T${c.tier||0} &middot; ${(Number(c.renown)||0).toLocaleString()}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

function renderClansToolbar() {
  const el = document.getElementById('clans-toolbar');
  if (!el) return;
  const chips = [
    ['all','All'], ['kingdom','Kingdom'], ['minor','Minor'],
    ['bandit','Bandits'], ['independent','Independent'],
    ['atwar','At War'], ['allies','My Allies'],
  ];
  let html = '<div class="hp-toolbar">';
  html += '<div class="hp-chips">';
  chips.forEach(([k,label]) => {
    html += `<button class="hp-chip ${_clansQuickFilter===k?'active':''}" onclick="setClansQuickFilter('${k}')">${label}</button>`;
  });
  html += '</div>';
  html += `<select class="hp-sort" onchange="setClansSort(this.value)">
    <option value="default" ${_clansSort==='default'?'selected':''}>Default</option>
    <option value="name" ${_clansSort==='name'?'selected':''}>Name A-Z</option>
    <option value="tier" ${_clansSort==='tier'?'selected':''}>Tier</option>
    <option value="strength" ${_clansSort==='strength'?'selected':''}>Strength</option>
    <option value="renown" ${_clansSort==='renown'?'selected':''}>Renown</option>
    <option value="wealth" ${_clansSort==='wealth'?'selected':''}>Wealth</option>
    <option value="members" ${_clansSort==='members'?'selected':''}>Members</option>
  </select>`;
  html += `<select class="hp-view" onchange="setClansView(this.value)">
    <option value="grid" ${_clansView==='grid'?'selected':''}>Grid</option>
    <option value="compact" ${_clansView==='compact'?'selected':''}>Compact</option>
  </select>`;
  html += '<button class="hp-rand-btn" onclick="openRandomClan()">\u{1F3B2} Surprise Me</button>';
  html += '</div>';
  el.innerHTML = html;
}

function setHeroesQuickFilter(f) { _heroesQuickFilter = f; renderList('heroes'); }
function setHeroesSort(v) { _heroesSort = v; renderList('heroes'); }
function setHeroesView(v) { _heroesView = v; const g = document.getElementById('grid-heroes'); if (g) g.classList.toggle('view-compact', v === 'compact'); renderList('heroes'); }
function openRandomHero() {
  const arr = (Store.heroes || []).filter(h => !h.isPlayer && !h.isDead);
  if (!arr.length) { showToast('No heroes available', true); return; }
  const pick = arr[Math.floor(Math.random() * arr.length)];
  openDetail('heroes', pick.id);
}

// ── Kingdom Detail enhancements ──
function _kingdomHonorific(item, d) {
  const c = (item.culture || '').toLowerCase();
  if (c.includes('empire')) return 'Imperial Throne';
  if (c.includes('khuzait')) return 'Khanate of the Steppes';
  if (c.includes('battania')) return 'Highland Confederation';
  if (c.includes('sturgia')) return 'Northern Realm';
  if (c.includes('aserai')) return 'Desert Sultanate';
  if (c.includes('vlandia')) return 'Knightly Realm';
  return `Realm of ${item.culture || 'Calradia'}`;
}

function renderKingdomDetailExtras(item, d) {
  if (!item) return '';
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  const cGlow = cColor.replace('#', '').match(/.{2}/g);
  const glowRgb = cGlow ? `rgba(${parseInt(cGlow[0],16)},${parseInt(cGlow[1],16)},${parseInt(cGlow[2],16)},.32)` : 'rgba(216,179,95,.32)';
  const styleVars = `--hd-accent:${cColor};--hd-glow:${glowRgb}`;
  const honorific = _kingdomHonorific(item, d);
  const kid = item.id;
  const rulerName = d?.leader?.name || item.ruler || item.leader || '';
  const rulerHero = rulerName ? (Store.heroes || []).find(h => h.name === rulerName) : null;

  let html = `<div style="${styleVars}">`;

  // Title ribbon
  html += `<div class="hd-title-ribbon">${esc(honorific)}</div>`;

  // Quick action buttons
  html += '<div class="hd-actions">';
  if (rulerHero) html += `<button class="hd-action-btn" onclick="openDetail('heroes','${esc(rulerHero.id)}')"><span class="hd-action-icon">\u{1F464}</span>Open Ruler</button>`;
  // Capital — highest-prosperity town in the kingdom
  const ownedTowns = (Store.settlements || []).filter(s => s.kingdom === item.name && s.type === 'Town');
  if (ownedTowns.length > 0) {
    const cap = ownedTowns.slice().sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0))[0];
    html += `<button class="hd-action-btn" onclick="openDetail('settlements','${esc(cap.id)}')"><span class="hd-action-icon">\u{1F3F0}</span>Capital: ${esc(cap.name)}</button>`;
  }
  // Compare with another kingdom (random or strongest)
  const others = (Store.kingdoms || []).filter(k => k.id !== item.id);
  if (others.length > 0) {
    const rival = others.slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0))[0];
    if (rival) html += `<button class="hd-action-btn" onclick="openDetail('kingdoms','${esc(rival.id)}')"><span class="hd-action-icon">\u{2696}</span>Rival: ${esc(rival.name)}</button>`;
  }
  html += '</div>';

  // Stat badges
  html += '<div class="hd-badges">';
  const badge = (icon, num, lbl) => `<div class="hd-badge"><span class="hd-badge-icon">${icon}</span><b class="hd-badge-num" data-count-target="${num}">0</b><span class="hd-badge-lbl">${lbl}</span></div>`;
  html += badge('\u{2694}', Number(d?.strength || item.strength || 0), 'Strength');
  const clanCount = Array.isArray(d?.clans) ? d.clans.length : Number(d?.clanCount || item.clanCount || 0);
  html += badge('\u{1F3E0}', clanCount, 'Clans');
  if (d?.lords != null) html += badge('\u{1F451}', d.lords, 'Lords');
  if (d?.towns != null) html += badge('\u{1F3DB}', d.towns, 'Towns');
  if (d?.castles != null) html += badge('\u{1F3F0}', d.castles, 'Castles');
  if (d?.villages != null) html += badge('\u{1F33E}', d.villages, 'Villages');
  if (d?.fiefCount != null || item.fiefCount != null) html += badge('\u{1F4DC}', Number(d?.fiefCount || item.fiefCount), 'Total Fiefs');
  if (d?.garrisons != null) html += badge('\u{1F6E1}', Number(d.garrisons), 'Garrisons');
  if (d?.influence != null) html += badge('\u{2726}', Number(d.influence), 'Influence');
  html += '</div>';

  html += '</div>';
  return html;
}

function renderKingdomMemberClansRibbon(item, d) {
  let memberClans = [];
  if (Array.isArray(d?.clans) && d.clans.length > 0) {
    memberClans = d.clans;
  } else {
    memberClans = (Store.clans || []).filter(c => c.kingdom === item.name).slice(0, 12);
  }
  if (memberClans.length === 0) return '';
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  // Sort by tier desc if we can
  memberClans = memberClans.slice().sort((a,b)=>(Number(b.tier)||0)-(Number(a.tier)||0));
  let html = `<div class="cd-members-ribbon" style="--hd-accent:${cColor}">
    <div class="cd-members-label">\u{1F3E0} Member Clans (${memberClans.length})</div>
    <div class="cd-members-list">`;
  memberClans.slice(0, 12).forEach(c => {
    const clanObj = (Store.clans || []).find(x => x.id === c.id || x.name === c.name);
    if (!clanObj) return;
    const banner = clanObj.id && Store._bannerImages?.[clanObj.id]
      ? `Banners/${encodeURIComponent(clanObj.id)}.png` : '';
    html += `<div class="cd-member" onclick="openDetail('clans','${esc(clanObj.id)}')">
      ${banner ? `<img src="${banner}" style="border-radius:3px;width:42px;height:54px;object-fit:contain;border:1px solid var(--hd-accent,rgba(184,140,50,.5))">` : '<div style="width:42px;height:54px;background:#1a1410;border:1px solid rgba(184,140,50,.3);border-radius:3px"></div>'}
      <div class="cd-member-name">${esc(clanObj.name||'')}</div>
      ${clanObj.tier ? `<div class="cd-member-role">T${clanObj.tier}</div>` : ''}
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderKingdomWarsStrip(item, d) {
  const wars = d?.wars || item.wars || [];
  if (!Array.isArray(wars) || wars.length === 0) return '';
  let html = '<div class="cd-wars-strip"><div class="cd-wars-label">\u{2694} Active Wars</div><div class="cd-wars-list">';
  wars.forEach(w => {
    const enemyName = typeof w === 'string' ? w : (w.name || '?');
    const enemyKingdom = (Store.kingdoms || []).find(k => k.name === enemyName);
    const banner = enemyKingdom?.id && Store._bannerImages?.[enemyKingdom.id]
      ? `Banners/${encodeURIComponent(enemyKingdom.id)}.png` : '';
    html += `<div class="cd-war-target" ${enemyKingdom ? `onclick="openDetail('kingdoms','${esc(enemyKingdom.id)}')"` : ''}>
      ${banner ? `<img src="${banner}">` : ''}
      <span>${esc(enemyName)}</span>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderKingdomRecentEvents(item) {
  const all = Store.allChronicle || [];
  const matches = all.filter(e => {
    const t = e.text || '';
    return item.name && t.includes(item.name);
  }).slice(-5).reverse();
  if (matches.length === 0) return '';
  let html = '<div class="section"><h3>\u{1F4DC} Recent Events</h3><div class="sd-events-strip">';
  matches.forEach(e => {
    const t = (e.text || '').toLowerCase();
    let icon = '\u{1F4DC}';
    if (t.includes('declared war') || t.includes('war')) icon = '\u{2694}';
    else if (t.includes('peace')) icon = '\u{1F54A}';
    else if (t.includes('captured') || t.includes('conquered')) icon = '\u{1F3F0}';
    else if (t.includes('rebel') || t.includes('defect')) icon = '\u{1F6A9}';
    html += `<div class="sd-event-row">
      <div class="sd-event-icon">${icon}</div>
      <div class="sd-event-body">
        <div class="sd-event-text">${textToHtml(e.text||'')}</div>
        <div class="sd-event-date">${esc(e.date||'')}</div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

// ── Clan Detail enhancements ──
function _clanHonorific(item, d) {
  const tier = Number(d?.tier || item.tier || 0);
  const members = Number(d?.members?.length || item.members || 0);
  if (item.isBandit) return 'Bandit Brotherhood';
  if (item.isMinorFaction) return 'Wandering Faction';
  if (members === 0) return 'Eliminated Bloodline';
  if (tier >= 5 && item.kingdom) {
    const k = (Store.kingdoms || []).find(x => x.name === item.kingdom);
    if (k && (k.ruler === item.leader || k.leader === item.leader)) return 'Royal House';
    return `Great House of ${item.kingdom}`;
  }
  if (tier >= 5) return 'Great House';
  if (tier >= 3) return 'Major House';
  if (tier >= 1) return 'Minor House';
  return 'Lesser Bloodline';
}

function renderClanDetailExtras(item, d) {
  if (!item) return '';
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  const cGlow = cColor.replace('#', '').match(/.{2}/g);
  const glowRgb = cGlow ? `rgba(${parseInt(cGlow[0],16)},${parseInt(cGlow[1],16)},${parseInt(cGlow[2],16)},.32)` : 'rgba(216,179,95,.32)';
  const styleVars = `--hd-accent:${cColor};--hd-glow:${glowRgb}`;
  const honorific = _clanHonorific(item, d);
  const cid = item.id;

  let html = `<div style="${styleVars}">`;

  // Title ribbon
  html += `<div class="hd-title-ribbon">${esc(honorific)}</div>`;

  // Quick action buttons
  html += '<div class="hd-actions">';
  // Leader
  const leaderName = d?.leader?.name || item.leader || '';
  const leaderHero = leaderName ? (Store.heroes || []).find(h => h.name === leaderName) : null;
  if (leaderHero) html += `<button class="hd-action-btn" onclick="openDetail('heroes','${esc(leaderHero.id)}')"><span class="hd-action-icon">\u{1F464}</span>Open Leader</button>`;
  // Kingdom
  if (item.kingdom) {
    const kObj = (Store.kingdoms || []).find(k => k.name === item.kingdom);
    if (kObj) html += `<button class="hd-action-btn" onclick="openDetail('kingdoms','${esc(kObj.id)}')"><span class="hd-action-icon">\u{1F451}</span>Open Kingdom</button>`;
  }
  // Capital settlement (highest prosperity owned by this clan)
  const ownedSetts = (Store.settlements || []).filter(s => s.owner === item.name);
  if (ownedSetts.length > 0) {
    const capital = ownedSetts.slice().sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0))[0];
    html += `<button class="hd-action-btn" onclick="openDetail('settlements','${esc(capital.id)}')"><span class="hd-action-icon">\u{1F3F0}</span>Capital: ${esc(capital.name)}</button>`;
  }
  html += '</div>';

  // Stat badges
  html += '<div class="hd-badges">';
  const badge = (icon, num, lbl) => `<div class="hd-badge"><span class="hd-badge-icon">${icon}</span><b class="hd-badge-num" data-count-target="${num}">0</b><span class="hd-badge-lbl">${lbl}</span></div>`;
  if (d?.tier != null || item.tier != null) html += badge('\u{2606}', Number(d?.tier || item.tier || 0), 'Tier');
  html += badge('\u{2694}', Number(d?.strength || item.strength || 0), 'Strength');
  html += badge('\u{1F396}', Number(d?.renown || item.renown || 0), 'Renown');
  html += badge('\u{2726}', Number(d?.influence || item.influence || 0), 'Influence');
  html += badge('\u{1F4B0}', Number(d?.wealth || item.wealth || 0), 'Wealth');
  const memCount = Array.isArray(d?.members) ? d.members.length : Number(d?.members || item.members || 0);
  html += badge('\u{1F465}', memCount, 'Members');
  html += badge('\u{1F3F0}', Number(d?.fiefs || item.fiefs || 0), 'Fiefs');
  if (d?.parties != null) html += badge('\u{2694}', Number(d.parties), 'Parties');
  if (d?.caravans != null) html += badge('\u{1F42A}', Number(d.caravans), 'Caravans');
  if (d?.workshops != null) html += badge('\u{1F528}', Number(d.workshops), 'Workshops');
  html += '</div>';

  html += '</div>';
  return html;
}

function renderClanMembersRibbon(item, d) {
  // d.members may be an array of {id,name,role} or a count number
  let members = [];
  if (Array.isArray(d?.members)) members = d.members;
  else members = (Store.heroes || []).filter(h => h.clan === item.name).slice(0, 12);
  if (members.length === 0) return '';
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  let html = `<div class="cd-members-ribbon" style="--hd-accent:${cColor}">
    <div class="cd-members-label">\u{1F465} Members</div>
    <div class="cd-members-list">`;
  members.slice(0, 12).forEach(m => {
    const heroObj = (Store.heroes || []).find(h => h.id === m.id || h.name === m.name);
    if (!heroObj) return;
    const portrait = getPortraitSrc(heroObj, heroObj);
    const role = m.role || (heroObj.name === item.leader ? 'Leader' : '');
    html += `<div class="cd-member" onclick="openDetail('heroes','${esc(heroObj.id)}')">
      <img src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">
      <div class="cd-member-name">${esc(heroObj.name||'')}</div>
      ${role ? `<div class="cd-member-role">${esc(role)}</div>` : ''}
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderClanWarsStrip(item, d) {
  const wars = d?.wars || item.wars || [];
  if (!Array.isArray(wars) || wars.length === 0) return '';
  let html = '<div class="cd-wars-strip"><div class="cd-wars-label">\u{2694} At War With</div><div class="cd-wars-list">';
  wars.forEach(w => {
    // war entries can be a kingdom name string or {name}
    const enemyName = typeof w === 'string' ? w : (w.name || '?');
    const enemyKingdom = (Store.kingdoms || []).find(k => k.name === enemyName);
    const enemyClan = (Store.clans || []).find(c => c.name === enemyName);
    const target = enemyKingdom || enemyClan;
    const targetType = enemyKingdom ? 'kingdoms' : (enemyClan ? 'clans' : null);
    const banner = target && target.id && Store._bannerImages?.[target.id]
      ? `Banners/${encodeURIComponent(target.id)}.png` : '';
    html += `<div class="cd-war-target" ${targetType ? `onclick="openDetail('${targetType}','${esc(target.id)}')"` : ''}>
      ${banner ? `<img src="${banner}">` : ''}
      <span>${esc(enemyName)}</span>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderClanRecentEvents(item) {
  const all = Store.allChronicle || [];
  const matches = all.filter(e => {
    const t = e.text || '';
    return item.name && t.includes(item.name);
  }).slice(-5).reverse();
  if (matches.length === 0) return '';
  let html = '<div class="section"><h3>\u{1F4DC} Recent Events</h3><div class="sd-events-strip">';
  matches.forEach(e => {
    const t = (e.text || '').toLowerCase();
    let icon = '\u{1F4DC}';
    if (t.includes('war')) icon = '\u{2694}';
    else if (t.includes('died') || t.includes('slain')) icon = '\u{2620}';
    else if (t.includes('married')) icon = '\u{1F48D}';
    else if (t.includes('born')) icon = '\u{1F476}';
    else if (t.includes('captured')) icon = '\u{1F3F0}';
    html += `<div class="sd-event-row">
      <div class="sd-event-icon">${icon}</div>
      <div class="sd-event-body">
        <div class="sd-event-text">${textToHtml(e.text||'')}</div>
        <div class="sd-event-date">${esc(e.date||'')}</div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

// ── Settlement Detail enhancements ──
function _settHonorific(item, d) {
  const type = String(item.type || '').toLowerCase();
  const prosp = Number(d?.prosperity || item.prosperity || 0);
  const garr = Number(d?.garrison || 0);
  const ws = Number(d?.workshopCount || 0);
  if (item.isUnderSiege) return 'Besieged Stronghold';
  if (item.isRaided) return 'Ravaged Settlement';
  if (type === 'village') return 'Quiet Village';
  if (type === 'castle') {
    if (garr >= 300) return 'Mighty Fortress';
    if (garr >= 150) return 'Stone Stronghold';
    return 'Border Keep';
  }
  // Town
  if (prosp >= 7000) return 'Crown Jewel of the Realm';
  if (ws >= 5) return 'Thriving Trade Hub';
  if (prosp >= 5000) return 'Prosperous City';
  if (prosp >= 3000) return 'Bustling Town';
  if (prosp < 1500) return 'Struggling Town';
  return 'Town of Calradia';
}

function renderSettlementDetailExtras(item, d) {
  if (!item || !d) return '';
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  const cGlow = cColor.replace('#', '').match(/.{2}/g);
  const glowRgb = cGlow ? `rgba(${parseInt(cGlow[0],16)},${parseInt(cGlow[1],16)},${parseInt(cGlow[2],16)},.32)` : 'rgba(216,179,95,.32)';
  const styleVars = `--hd-accent:${cColor};--hd-glow:${glowRgb}`;
  const honorific = _settHonorific(item, d);
  const sid = item.id;

  let html = `<div style="${styleVars}">`;

  // Title ribbon
  html += `<div class="hd-title-ribbon">${esc(honorific)}</div>`;

  // Quick action buttons
  html += '<div class="hd-actions">';
  html += `<button class="hd-action-btn" onclick="API.travelTo&&API.travelTo('${esc(sid)}').then(()=>showToast('Traveling to ' + ${JSON.stringify(item.name)}))"><span class="hd-action-icon">\u{1F5FA}</span>Travel Here</button>`;
  html += `<button class="hd-action-btn" onclick="invTrackSettlement&&invTrackSettlement('${esc(sid)}','${esc(item.name)}')"><span class="hd-action-icon">\u{1F4CD}</span>Track on Map</button>`;
  if (d.owner?.id) html += `<button class="hd-action-btn" onclick="openDetail('heroes','${esc(d.owner.id)}')"><span class="hd-action-icon">\u{1F464}</span>Open Owner</button>`;
  const ownerClanName = d.owner?.clan || d.clan || item.owner || '';
  const ownerClan = ownerClanName ? (Store.clans || []).find(c => c.name === ownerClanName) : null;
  if (ownerClan) html += `<button class="hd-action-btn" onclick="openDetail('clans','${esc(ownerClan.id)}')"><span class="hd-action-icon">\u{1F451}</span>Open Clan</button>`;
  if (d.kingdom) {
    const kObj = (Store.kingdoms || []).find(k => k.name === d.kingdom);
    if (kObj) html += `<button class="hd-action-btn" onclick="openDetail('kingdoms','${esc(kObj.id)}')"><span class="hd-action-icon">\u{1F6E1}</span>Open Kingdom</button>`;
  }
  html += '</div>';

  // Stat badges
  html += '<div class="hd-badges">';
  const badge = (icon, num, lbl) => `<div class="hd-badge"><span class="hd-badge-icon">${icon}</span><b class="hd-badge-num" data-count-target="${num}">0</b><span class="hd-badge-lbl">${lbl}</span></div>`;
  if (d.prosperity != null) html += badge('\u{1F4B0}', Math.round(d.prosperity), 'Prosperity');
  if (d.loyalty != null) html += badge('\u{2764}', Math.round(d.loyalty), 'Loyalty');
  if (d.security != null) html += badge('\u{1F6E1}', Math.round(d.security), 'Security');
  if (d.foodStocks != null) html += badge('\u{1F35E}', Math.round(d.foodStocks), 'Food');
  if (d.garrison != null) html += badge('\u{2694}', d.garrison, 'Garrison');
  if (d.militia != null) html += badge('\u{1F6E1}', d.militia, 'Militia');
  if (d.notableCount != null) html += badge('\u{1F465}', d.notableCount, 'Notables');
  if (d.workshopCount != null) html += badge('\u{1F528}', d.workshopCount, 'Workshops');
  if (d.villageCount != null) html += badge('\u{1F33E}', d.villageCount, 'Villages');
  html += '</div>';

  html += '</div>';
  return html;
}

function renderSettlementRecentEvents(item) {
  const all = Store.allChronicle || [];
  const matches = all.filter(e => {
    const t = e.text || '';
    return item.name && t.includes(item.name);
  }).slice(-5).reverse();
  if (matches.length === 0) return '';
  let html = '<div class="section"><h3>\u{1F4DC} Recent Events</h3><div class="sd-events-strip">';
  matches.forEach(e => {
    const t = (e.text || '').toLowerCase();
    let icon = '\u{1F4DC}';
    if (t.includes('raid')) icon = '\u{1F525}';
    else if (t.includes('siege')) icon = '\u{1F3F0}';
    else if (t.includes('captured') || t.includes('conquered')) icon = '\u{2694}';
    else if (t.includes('rebel')) icon = '\u{2620}';
    html += `<div class="sd-event-row">
      <div class="sd-event-icon">${icon}</div>
      <div class="sd-event-body">
        <div class="sd-event-text">${textToHtml(e.text||'')}</div>
        <div class="sd-event-date">${esc(e.date||'')}</div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

// ── Hero Detail enhancements ──
function _heroHonorific(item, stats, lore) {
  const renown = Number(item.renown || stats?.Renown || 0);
  const occ = String(item.occupation || '').toLowerCase();
  const fiefs = Number(item.fiefs || 0);
  if (item.isPlayer) return 'Adventurer of Calradia';
  if (occ === 'king' || occ === 'queen') return 'Sovereign Ruler';
  if (occ.includes('lord') || occ.includes('lady')) {
    if (renown >= 2000) return 'Renowned Lord';
    if (renown >= 1000) return 'Notable Lord';
    return 'Lord of the Realm';
  }
  if (occ.includes('wanderer') || occ.includes('companion')) return 'Wandering Companion';
  if (occ.includes('merchant')) return 'Master Merchant';
  if (occ.includes('artisan')) return 'Master Artisan';
  if (occ.includes('preacher')) return 'Voice of the Faith';
  if (occ.includes('headman')) return 'Village Headman';
  if (occ.includes('gangleader')) return 'Gang Lord';
  if (occ.includes('rural')) return 'Rural Notable';
  if (renown >= 2000) return 'Renowned Champion';
  if (renown >= 1000) return 'Notable Warrior';
  if (renown >= 500) return 'Rising Hero';
  return 'Common Folk';
}

function renderHeroDetailExtras(item, detail, stats, skills, friends, enemies, family, journal, timeline) {
  const cColor = getCultureColor(item.culture || '') || '#d4b878';
  const cGlow = cColor.replace('#', '').match(/.{2}/g);
  const glowRgb = cGlow ? `rgba(${parseInt(cGlow[0],16)},${parseInt(cGlow[1],16)},${parseInt(cGlow[2],16)},.32)` : 'rgba(216,179,95,.32)';
  const styleVars = `--hd-accent:${cColor};--hd-glow:${glowRgb}`;
  const honorific = _heroHonorific(item, stats, detail?.lore || {});
  const age = Number(item.age || 0);
  const days = Math.round(age * 84);
  const renown = Number(stats?.Renown || item.renown || 0);
  const influence = Number(stats?.Influence || item.influence || 0);
  const level = Number(stats?.Level || item.level || 0);
  const heroId = item.id;

  let html = `<div style="${styleVars}">`;

  // Title ribbon
  html += `<div class="hd-title-ribbon">${esc(honorific)}</div>`;

  // Quick action buttons
  html += '<div class="hd-actions">';
  html += `<button class="hd-action-btn" onclick="openFamilyTree('${esc(heroId)}')"><span class="hd-action-icon">\u{1F333}</span>Family Tree</button>`;
  html += `<button class="hd-action-btn" onclick="addHeroToCompare('${esc(heroId)}');openHeroCompare()"><span class="hd-action-icon">\u{2696}</span>Compare</button>`;
  if (item.clan) {
    const heroClan = (Store.clans || []).find(c => c.name === item.clan);
    if (heroClan) html += `<button class="hd-action-btn" onclick="openDetail('clans','${esc(heroClan.id)}')"><span class="hd-action-icon">\u{1F451}</span>Open Clan</button>`;
  }
  if (item.kingdom) {
    const heroKingdom = (Store.kingdoms || []).find(k => k.name === item.kingdom);
    if (heroKingdom) html += `<button class="hd-action-btn" onclick="openDetail('kingdoms','${esc(heroKingdom.id)}')"><span class="hd-action-icon">\u{1F6E1}</span>Open Kingdom</button>`;
  }
  html += '</div>';

  // Stat badges row
  html += '<div class="hd-badges">';
  const badge = (icon, num, lbl) => `<div class="hd-badge"><span class="hd-badge-icon">${icon}</span><b class="hd-badge-num" data-count-target="${num}">0</b><span class="hd-badge-lbl">${lbl}</span></div>`;
  html += badge('\u{1F4C5}', age, 'Age');
  html += badge('\u{1F4C6}', days, 'Days Alive');
  if (level) html += badge('\u{2B50}', level, 'Level');
  if (renown) html += badge('\u{1F396}', renown, 'Renown');
  if (influence) html += badge('\u{2726}', influence, 'Influence');
  html += badge('\u{1F91D}', (friends || []).length, 'Friends');
  html += badge('\u{2694}', (enemies || []).length, 'Enemies');
  html += badge('\u{1F465}', (family || []).length, 'Family');
  html += badge('\u{1F4DC}', (journal || []).length, 'Journal');
  html += '</div>';

  // Skills radar chart
  if (Array.isArray(skills) && skills.length > 0) {
    html += renderHeroSkillsRadar(skills);
  }

  html += '</div>';
  return html;
}

function renderHeroSkillsRadar(skills) {
  const top = skills.slice().sort((a,b)=>(Number(b.value)||0)-(Number(a.value)||0)).slice(0, 8);
  if (top.length < 3) return '';
  const cx = 170, cy = 165, r = 130;
  const n = top.length;
  const max = 300;
  let html = '<div class="hd-radar-card"><h3>\u{1F3AF} Skill Profile</h3><div class="hd-radar-wrap"><div class="hd-radar"><svg viewBox="0 0 340 330">';
  // Concentric grid (4 rings)
  for (let i = 1; i <= 4; i++) {
    const rr = (r * i) / 4;
    let path = '';
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      path += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    path += 'Z';
    html += `<path class="hd-radar-grid" d="${path}"/>`;
  }
  // Axes
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    html += `<line class="hd-radar-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  }
  // Polygon
  let poly = '';
  top.forEach((s, j) => {
    const v = Math.min(max, Number(s.value) || 0);
    const ratio = v / max;
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * ratio * Math.cos(a);
    const y = cy + r * ratio * Math.sin(a);
    poly += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  });
  poly += 'Z';
  html += `<path class="hd-radar-poly" d="${poly}"/>`;
  // Labels + values
  top.forEach((s, j) => {
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    const lx = cx + (r + 18) * Math.cos(a);
    const ly = cy + (r + 18) * Math.sin(a);
    const align = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
    const name = String(s.name || s.skill || '?').slice(0, 12);
    html += `<text class="hd-radar-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${align}" dy="3">${esc(name)}</text>`;
    html += `<text class="hd-radar-val" x="${lx.toFixed(1)}" y="${(ly+11).toFixed(1)}" text-anchor="${align}">${Number(s.value)||0}</text>`;
  });
  html += '</svg></div></div></div>';
  return html;
}

// ── Chronicle page extras ──
window._chronicleQuickFilter = 'all';
window._chronicleSort = 'newest';

function setChronicleQuickFilter(f) { _chronicleQuickFilter = f; renderChronicleExtras(); refreshCurrentPage && refreshCurrentPage(); }
function setChronicleSort(v) { _chronicleSort = v; refreshCurrentPage && refreshCurrentPage(); }

function openRandomChronicleEvent() {
  const arr = Store.allChronicle || [];
  if (!arr.length) { showToast('No chronicle events', true); return; }
  const e = arr[Math.floor(Math.random() * arr.length)];
  showToast(textToHtml(e.text || '').replace(/<[^>]+>/g, '').slice(0, 120));
}

function exportChronicleTxt() {
  const arr = (Store.allChronicle || []).slice();
  if (!arr.length) { showToast('No chronicle to export', true); return; }
  let txt = 'CALRADIAN CHRONICLE\n===================\n\n';
  arr.forEach(e => {
    const clean = (e.text || '').replace(/<[^>]+>/g, '').replace(/«[^»]*»/g, '').replace(/&[lg]t;[^&]*&[lg]t;/g, '');
    txt += `[${e.date || '?'}] ${clean}\n`;
  });
  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'calradia_chronicle.txt'; a.click();
  URL.revokeObjectURL(url);
  showToast('Exported calradia_chronicle.txt');
}

async function renderChronicleExtras() {
  const el = document.getElementById('chronicle-extras');
  if (!el) return;
  const all = await API.getAllChronicle().catch(() => []);
  Store.allChronicle = all;
  if (!all || all.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px;font-family:Cinzel,serif;font-size:11px;color:#7c6840">No chronicle events recorded yet. Play the game to write history.</div>';
    return;
  }

  // Today (most recent) event
  const latest = all[all.length - 1];

  // Counts
  let wars = 0, battles = 0, deaths = 0, marriages = 0, births = 0, tournaments = 0, sieges = 0;
  const monthBuckets = {};
  const heroMentions = {};
  const eventTypes = { war:0, family:0, politics:0, crime:0, other:0 };
  all.forEach(e => {
    const t = (e.text || '').toLowerCase();
    if (t.includes('declared war') || t.includes('war broke out')) wars++;
    if (t.includes('victory') || t.includes('defeated')) battles++;
    if (t.includes('died') || t.includes('slain') || t.includes('killed')) deaths++;
    if (t.includes('married')) marriages++;
    if (t.includes('born') || t.includes('birth')) births++;
    if (t.includes('tournament')) tournaments++;
    if (t.includes('siege')) sieges++;
    // Type buckets
    if (t.includes('[war]') || t.includes('war') || t.includes('battle') || t.includes('siege')) eventTypes.war++;
    else if (t.includes('[family]') || t.includes('married') || t.includes('born') || t.includes('died')) eventTypes.family++;
    else if (t.includes('[politics]') || t.includes('alliance') || t.includes('peace')) eventTypes.politics++;
    else if (t.includes('[crime]')) eventTypes.crime++;
    else eventTypes.other++;
    // Month bucket from date string
    const date = String(e.date || '');
    const m = date.match(/(spring|summer|autumn|winter|fall)/i);
    const seasonKey = m ? m[1].toLowerCase() : 'unknown';
    monthBuckets[seasonKey] = (monthBuckets[seasonKey] || 0) + 1;
    // Hero mentions
    (Store.heroes || []).forEach(h => {
      if (h.name && (e.text || '').includes(h.name)) heroMentions[h.id] = (heroMentions[h.id] || 0) + 1;
    });
  });

  let html = '';

  // Today card
  html += `<div class="tic-card">
    <div class="tic-icon">\u{1F4DC}</div>
    <div class="tic-info">
      <div class="tic-kicker">\u{2606} Latest Entry in the Chronicle</div>
      <div class="tic-text">${textToHtml(latest.text || '')}</div>
      <div class="tic-date">${esc(latest.date || '\u2014')}</div>
    </div>
  </div>`;

  // Quick stat cards (reuse hp-stats-row)
  html += '<div class="hp-stats-row">';
  const sc = (icon,num,lbl,col) => `<div class="hp-stat-card" style="--hps-color:${col}"><span class="hp-stat-icon">${icon}</span><b class="hp-stat-num" data-count-target="${num}">0</b><span class="hp-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F4DC}', all.length, 'Total', '#d4b878');
  html += sc('\u{2694}', battles, 'Battles', '#c08060');
  html += sc('\u{1F3F0}', sieges, 'Sieges', '#a08e6a');
  html += sc('\u{2620}', deaths, 'Deaths', '#a15b5b');
  html += sc('\u{1F48D}', marriages, 'Marriages', '#d8a0b0');
  html += sc('\u{1F476}', births, 'Births', '#7ac070');
  html += sc('\u{1F3C6}', tournaments, 'Tournaments', '#d4a43a');
  html += sc('\u{1F6E1}', wars, 'Wars', '#c05050');
  html += '</div>';

  // Widget row: era timeline + donut + active heroes
  html += '<div class="chr-widget-row">';

  // Era timeline (last 12 buckets)
  html += '<div class="chr-widget"><div class="chr-quill">\u{1F58B}</div><h3>\u{1F4C5} Events Through Time</h3>';
  // Bucket by season-year if possible, else by index chunks
  const bucketKeys = Object.keys(monthBuckets).filter(k => k !== 'unknown');
  if (bucketKeys.length > 0) {
    const maxC = Math.max(1, ...Object.values(monthBuckets));
    const w = 380, h = 90, pad = 22;
    const cols = bucketKeys.length;
    const colW = (w - pad * 2) / Math.max(1, cols);
    let svg = `<svg class="era-timeline-svg" viewBox="0 0 ${w} ${h}">`;
    svg += `<line x1="${pad}" y1="${h-22}" x2="${w-pad}" y2="${h-22}" stroke="rgba(184,140,50,.5)" stroke-width="1"/>`;
    bucketKeys.forEach((key, i) => {
      const cnt = monthBuckets[key];
      const x = pad + i * colW + colW / 2;
      const r = 4 + (cnt / maxC) * 14;
      svg += `<circle class="era-bucket" cx="${x}" cy="${h-22}" r="${r}" fill="#d8b35f" stroke="#1a1208" stroke-width="1.5"><title>${key}: ${cnt} events</title></circle>`;
      svg += `<text class="era-bucket-num" x="${x}" y="${h-22-r-3}">${cnt}</text>`;
      svg += `<text class="era-axis-label" x="${x}" y="${h-6}" text-anchor="middle">${key.slice(0,3).toUpperCase()}</text>`;
    });
    svg += '</svg>';
    html += '<div class="era-timeline">' + svg + '</div>';
  } else {
    html += '<div style="text-align:center;padding:18px;font-family:Cinzel,serif;font-size:9px;color:#7c6840">No dated events to chart.</div>';
  }
  html += '</div>';

  // Donut: event types
  html += '<div class="chr-widget"><h3>\u{1F4CA} Event Types</h3>';
  html += _statsDonut([
    {label:'War', value:eventTypes.war, color:'#c05050'},
    {label:'Family', value:eventTypes.family, color:'#d8a0b0'},
    {label:'Politics', value:eventTypes.politics, color:'#80a0d0'},
    {label:'Crime', value:eventTypes.crime, color:'#a08e6a'},
    {label:'Other', value:eventTypes.other, color:'#7c6840'},
  ], 'EVENTS');
  html += '</div>';

  // Most active heroes
  html += '<div class="chr-widget"><h3>\u{2606} Most Mentioned Heroes</h3>';
  const top = Object.entries(heroMentions).sort((a,b)=>b[1]-a[1]).slice(0, 6);
  if (top.length === 0) html += '<div style="text-align:center;padding:18px;font-family:Cinzel,serif;font-size:9px;color:#7c6840">No hero mentions found.</div>';
  else {
    top.forEach(([id, count]) => {
      const h = (Store.heroes || []).find(x => x.id === id);
      if (!h) return;
      const portrait = getPortraitSrc(h, h);
      html += `<div class="cah-row" onclick="openDetail('heroes','${esc(id)}')">
        <img class="cah-portrait" src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">
        <div class="cah-name">${esc(h.name||'')}</div>
        <div class="cah-num">${count}&times;</div>
      </div>`;
    });
  }
  html += '</div>';

  html += '</div>';

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);

  renderChronicleToolbar();
}

function renderChronicleToolbar() {
  const el = document.getElementById('chronicle-toolbar');
  if (!el) return;
  const chips = [
    ['all','All'], ['war','War'], ['family','Family'],
    ['politics','Politics'], ['crime','Crime'],
    ['battle','Battles'], ['death','Deaths'], ['marriage','Marriages'],
  ];
  let html = '<div class="hp-toolbar"><div class="hp-chips">';
  chips.forEach(([k,label]) => {
    html += `<button class="hp-chip ${_chronicleQuickFilter===k?'active':''}" onclick="setChronicleQuickFilter('${k}')">${label}</button>`;
  });
  html += '</div>';
  html += `<select class="hp-sort" onchange="setChronicleSort(this.value)">
    <option value="newest" ${_chronicleSort==='newest'?'selected':''}>Newest</option>
    <option value="oldest" ${_chronicleSort==='oldest'?'selected':''}>Oldest</option>
  </select>`;
  html += '<button class="hp-rand-btn" onclick="openRandomChronicleEvent()">\u{1F3B2} Random</button>';
  html += '<button class="hp-rand-btn" onclick="exportChronicleTxt()">\u{1F4E5} Export</button>';
  html += '</div>';
  el.innerHTML = html;
}

// ── Culture Pantheon panel (reusable across all list pages) ──
const CULTURE_LORE = {
  empire: { icon:'\u{1F3DB}', name:'Empire', color:'#9c5dc9', deep:'#5a2070', glow:'rgba(156,93,201,.32)', bgFrom:'rgba(60,30,80,.7)', bgTo:'rgba(20,10,30,.85)',
    desc:'Heir to ancient Calradia. The Empire stands divided yet still wields the legions, civic law, and granite engineering of its forebears.' },
  aserai: { icon:'\u{1F3DC}', name:'Aserai', color:'#e8c450', deep:'#a07020', glow:'rgba(232,196,80,.32)', bgFrom:'rgba(80,55,18,.7)', bgTo:'rgba(30,18,6,.85)',
    desc:'Lords of the southern desert sands. Masters of swift cavalry, caravan trade, and the hidden pacts of clan elders.' },
  battania: { icon:'\u{1F33F}', name:'Battania', color:'#5ba85a', deep:'#2d6b2e', glow:'rgba(91,168,90,.32)', bgFrom:'rgba(30,55,28,.7)', bgTo:'rgba(10,22,12,.85)',
    desc:'Free folk of the highland forests. Battanians prize ancestral land, longbow skill, and bonds of kin above all.' },
  khuzait: { icon:'\u{1F40E}', name:'Khuzait', color:'#5fb8b8', deep:'#2d8e8e', glow:'rgba(95,184,184,.32)', bgFrom:'rgba(20,55,55,.7)', bgTo:'rgba(8,22,22,.85)',
    desc:'Riders of the eastern steppes. Unmatched horse archers, their khans bind tribes with feasts, plunder, and the open sky.' },
  sturgia: { icon:'\u{2744}', name:'Sturgia', color:'#5b8fc0', deep:'#3366aa', glow:'rgba(91,143,192,.32)', bgFrom:'rgba(20,40,80,.7)', bgTo:'rgba(8,16,30,.85)',
    desc:'Warriors of the frozen north. Sturgians wield axe, spear, and shield-wall with grim discipline born of long winters.' },
  vlandia: { icon:'\u{1F3F0}', name:'Vlandia', color:'#c05050', deep:'#8a2828', glow:'rgba(192,80,80,.32)', bgFrom:'rgba(80,20,20,.7)', bgTo:'rgba(30,8,8,.85)',
    desc:'Knights and crossbowmen of feudal honor. Vlandian lords measure standing in fiefs, oaths sworn, and lance-charges led.' },
  nord: { icon:'\u{2A2F}', name:'Nord', color:'#5b8fc0', deep:'#3366aa', glow:'rgba(91,143,192,.32)', bgFrom:'rgba(20,40,80,.7)', bgTo:'rgba(8,16,30,.85)',
    desc:'Sea-raiders and skalds of the northern coasts. They sail in longships, serve fierce gods, and reckon glory by deeds spoken at the mead hall.' },
};

function _cultureKey(name) {
  const c = (name || '').toLowerCase();
  for (const key of Object.keys(CULTURE_LORE)) {
    if (c.includes(key)) return key;
  }
  return null;
}

function renderCulturePanel(cultureName) {
  const key = _cultureKey(cultureName);
  const lore = CULTURE_LORE[key] || { icon:'\u{1F3F4}', name:cultureName, color:'#d4b878', deep:'#a08020', glow:'rgba(216,179,95,.32)', bgFrom:'rgba(60,42,18,.7)', bgTo:'rgba(20,12,6,.85)', desc:'A people of Calradia.' };

  const heroes = (Store.heroes || []).filter(h => h.culture === cultureName);
  const clans = (Store.clans || []).filter(c => c.culture === cultureName);
  const settlements = (Store.settlements || []).filter(s => s.culture === cultureName);
  const kingdoms = (Store.kingdoms || []).filter(k => k.culture === cultureName);
  const fiefs = settlements.filter(s => s.type === 'Town' || s.type === 'Castle').length;

  const styleVars = `--cult-color:${lore.color};--cult-color-deep:${lore.deep};--cult-glow:${lore.glow};--cult-bg-from:${lore.bgFrom};--cult-bg-to:${lore.bgTo}`;

  let html = `<div class="cult-panel" style="${styleVars}">
    <div class="cult-header">
      <div class="cult-icon">${lore.icon}</div>
      <div class="cult-title-block">
        <div class="cult-kicker">\u{2606} Cultural Pantheon</div>
        <div class="cult-title">${esc(lore.name)}</div>
        <div class="cult-desc">${esc(lore.desc)}</div>
      </div>
    </div>
    <div class="cult-stats-row">
      <div class="cult-stat"><span class="cult-stat-num">${heroes.length}</span><span class="cult-stat-lbl">Heroes</span></div>
      <div class="cult-stat"><span class="cult-stat-num">${clans.length}</span><span class="cult-stat-lbl">Clans</span></div>
      <div class="cult-stat"><span class="cult-stat-num">${kingdoms.length}</span><span class="cult-stat-lbl">Kingdoms</span></div>
      <div class="cult-stat"><span class="cult-stat-num">${settlements.length}</span><span class="cult-stat-lbl">Settlements</span></div>
      <div class="cult-stat"><span class="cult-stat-num">${fiefs}</span><span class="cult-stat-lbl">Fiefs</span></div>
    </div>`;

  // Top renowned heroes
  const topHeroes = heroes.slice().sort((a,b)=>(Number(b.renown)||0)-(Number(a.renown)||0)).slice(0,5);
  html += '<div class="cult-section"><div class="cult-section-title">\u{2694} Most Renowned Heroes</div>';
  if (topHeroes.length === 0) html += '<div class="cult-empty">No notable heroes recorded.</div>';
  else {
    html += '<div class="cult-row">';
    topHeroes.forEach((h, i) => {
      const portrait = getPortraitSrc(h, h);
      html += `<div class="cult-card" style="animation-delay:${i*0.04}s" onclick="openDetail('heroes','${esc(h.id)}')">
        <img class="portrait" src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">
        <div class="cult-card-body">
          <div class="cult-card-name">${esc(h.name||'')}</div>
          <div class="cult-card-meta">Renown ${(Number(h.renown)||0).toLocaleString()}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  // Top clans by strength
  const topClans = clans.slice().filter(c => !c.isBandit).sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0)).slice(0,5);
  html += '<div class="cult-section"><div class="cult-section-title">\u{1F451} Strongest Clans</div>';
  if (topClans.length === 0) html += '<div class="cult-empty">No clans recorded.</div>';
  else {
    html += '<div class="cult-row">';
    topClans.forEach((c, i) => {
      const banner = c.id && Store._bannerImages?.[c.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';
      html += `<div class="cult-card" style="animation-delay:${i*0.04}s" onclick="openDetail('clans','${esc(c.id)}')">
        ${banner ? `<img class="banner" src="${banner}">` : '<div class="banner" style="width:24px;height:30px;background:#1a1410"></div>'}
        <div class="cult-card-body">
          <div class="cult-card-name">${esc(c.name||'')}</div>
          <div class="cult-card-meta">T${c.tier||0} &middot; ${(Number(c.strength)||0).toLocaleString()}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  // Notable settlements
  const topSett = settlements.slice().filter(s => s.type === 'Town' || s.type === 'Castle')
    .sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0)).slice(0,5);
  html += '<div class="cult-section"><div class="cult-section-title">\u{1F3F0} Notable Settlements</div>';
  if (topSett.length === 0) html += '<div class="cult-empty">No major settlements recorded.</div>';
  else {
    html += '<div class="cult-row">';
    topSett.forEach((s, i) => {
      html += `<div class="cult-card" style="animation-delay:${i*0.04}s" onclick="openDetail('settlements','${esc(s.id)}')">
        <div class="sett-icon" style="background-image:url('${_settImg(s)}')"></div>
        <div class="cult-card-body">
          <div class="cult-card-name">${esc(s.name||'')}</div>
          <div class="cult-card-meta">${esc(s.type||'?')} &middot; ${(Number(s.prosperity)||0).toLocaleString()}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

function _activeCultureFromFilter(type) {
  const f = Store.filters[type] || '';
  if (f.startsWith('culture:')) return f.substring(8);
  return null;
}

function renderHeroesExtras() {
  const el = document.getElementById('heroes-extras');
  if (!el) return;
  const cultureFilter = _activeCultureFromFilter('heroes');
  if (cultureFilter) { el.innerHTML = renderCulturePanel(cultureFilter); return; }
  const all = (Store.heroes || []).filter(h => !h.isPlayer);
  if (!all.length) { el.innerHTML = ''; return; }

  // Hero of the Day — deterministic per day
  const day = Math.floor(Date.now() / 86400000);
  const livingHeroes = all.filter(h => !h.isDead);
  const featured = livingHeroes[day % livingHeroes.length] || all[0];
  const featPortrait = featured ? getPortraitSrc(featured, featured) : '';
  const featClan = (Store.clans || []).find(c => c.name === featured?.clan);

  let html = '';

  // Spotlight
  html += `<div class="hod-spotlight" onclick="openDetail('heroes','${esc(featured.id)}')">
    <img class="hod-portrait${isGamePortrait(featured)?' game-portrait':''}" src="${featPortrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'" ${isGamePortrait(featured) ? `style="${GP_STYLE}"` : ''}>
    <div class="hod-info">
      <div class="hod-kicker">\u{2606} Hero of the Day</div>
      <div class="hod-name">${esc(featured.name||'')}</div>
      <div class="hod-meta">
        <b>${esc(featured.culture||'?')}</b> &middot;
        Age <b>${featured.age||0}</b> &middot;
        ${featured.occupation ? `<b>${esc(featured.occupation)}</b> &middot;` : ''}
        ${featClan ? `<b>${esc(featClan.name)}</b>` : ''}
        ${featured.renown ? ` &middot; Renown <b>${featured.renown}</b>` : ''}
      </div>
    </div>
    <div class="hod-medal">\u{1F396}</div>
  </div>`;

  // Quick stats row
  const living = all.filter(h => !h.isDead).length;
  const dead = all.filter(h => h.isDead).length;
  const companions = all.filter(h => h.occupation === 'Wanderer' || h.occupation === 'Companion').length;
  const lords = all.filter(h => h.occupation === 'Lord' || h.occupation === 'Lady').length;
  const renowned = all.filter(h => (h.renown||0) >= 500).length;
  const met = all.filter(h => h.hasMet).length;
  html += '<div class="hp-stats-row">';
  const sc = (icon,num,lbl,col) => `<div class="hp-stat-card" style="--hps-color:${col}"><span class="hp-stat-icon">${icon}</span><b class="hp-stat-num" data-count-target="${num}">0</b><span class="hp-stat-lbl">${lbl}</span></div>`;
  html += sc('\u{1F464}', all.length, 'Total', '#d4b878');
  html += sc('\u{2764}', living, 'Living', '#7ac070');
  html += sc('\u{2620}', dead, 'Deceased', '#a15b5b');
  html += sc('\u{1F91D}', companions, 'Companions', '#80a0d0');
  html += sc('\u{1F451}', lords, 'Lords', '#f5d878');
  html += sc('\u{2606}', renowned, 'Renowned', '#e8c848');
  html += sc('\u{1F4DC}', met, 'Met', '#c08070');
  html += '</div>';

  // Hall of Fame ribbon — top 5 most renowned
  const hof = all.slice().sort((a,b)=>(Number(b.renown)||0)-(Number(a.renown)||0)).slice(0,8);
  if (hof.length > 0 && (Number(hof[0].renown)||0) > 0) {
    html += '<div class="hof-ribbon"><div class="hof-label">\u{1F3C6} Hall of Fame</div><div class="hof-list">';
    hof.forEach((h, i) => {
      const portrait = getPortraitSrc(h, h);
      html += `<div class="hof-item" onclick="openDetail('heroes','${esc(h.id)}')">
        <img src="${portrait}" onerror="this.src='Hero/bannerlord_hero_viking.png'">
        <div class="hof-item-rank">${i+1}</div>
        <div class="hof-item-name">${esc(h.name||'')}</div>
        <div class="hof-item-renown">${(Number(h.renown)||0).toLocaleString()}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

function renderHeroesToolbar() {
  const el = document.getElementById('heroes-toolbar');
  if (!el) return;
  const chips = [
    ['all','All'], ['alive','Living'], ['dead','Deceased'],
    ['met','Met'], ['custom','Custom Lore'],
  ];
  let html = '<div class="hp-toolbar">';
  html += '<div class="hp-chips">';
  chips.forEach(([k,label]) => {
    html += `<button class="hp-chip ${_heroesQuickFilter===k?'active':''}" onclick="setHeroesQuickFilter('${k}')">${label}</button>`;
  });
  html += '<button class="hp-chip" onclick="setHeroesQuickFilter(\'highrenown\')">High Renown</button>';
  html += '<button class="hp-chip" onclick="setHeroesQuickFilter(\'companions\')">Companions</button>';
  html += '</div>';
  html += `<select class="hp-sort" onchange="setHeroesSort(this.value)">
    <option value="default" ${_heroesSort==='default'?'selected':''}>Default</option>
    <option value="name" ${_heroesSort==='name'?'selected':''}>Name A-Z</option>
    <option value="renown" ${_heroesSort==='renown'?'selected':''}>Renown</option>
    <option value="age" ${_heroesSort==='age'?'selected':''}>Age</option>
    <option value="level" ${_heroesSort==='level'?'selected':''}>Level</option>
  </select>`;
  html += `<select class="hp-view" onchange="setHeroesView(this.value)">
    <option value="grid" ${_heroesView==='grid'?'selected':''}>Grid</option>
    <option value="compact" ${_heroesView==='compact'?'selected':''}>Compact</option>
  </select>`;
  html += '<button class="hp-rand-btn" onclick="openRandomHero()">\u{1F3B2} Surprise Me</button>';
  html += '</div>';
  el.innerHTML = html;
}

async function renderList(type) {
  const grid = document.getElementById(`grid-${type}`);
  if (!grid) return;
  const arr = Store[type] || [];
  const filter = Store.filters[type] || 'all';
  let filtered = arr;

  if (type === 'heroes') {
    // Render extras (spotlight / quick stats / hall of fame) and toolbar
    renderHeroesExtras();
    renderHeroesToolbar();

    // Exclude main hero from Heroes list — shown on Commander page
    filtered = filtered.filter(h => !h.isPlayer);
    if (filter === 'alive') filtered = arr.filter(h => !h.isDead && !h.isPlayer);
    else if (filter === 'dead') filtered = arr.filter(h => h.isDead);
    else if (filter === 'custom') filtered = arr.filter(h => h.hasCustomDescription);
    else if (filter === 'met') filtered = arr.filter(h => h.hasMet);
    else if (filter === 'notmet') filtered = arr.filter(h => !h.hasMet);
    else if (filter === 'male') filtered = arr.filter(h => !h.isFemale);
    else if (filter === 'female') filtered = arr.filter(h => h.isFemale);
    else if (filter === 'married') filtered = arr.filter(h => h.isMarried);
    else if (filter === 'single') filtered = arr.filter(h => !h.isMarried);
    else if (filter.startsWith('culture:')) filtered = arr.filter(h => h.culture === filter.substring(8));
    else if (filter.startsWith('occ:')) filtered = arr.filter(h => h.occupation === filter.substring(4));

    // Apply quick filter (overrides if more restrictive)
    if (_heroesQuickFilter === 'highrenown') filtered = filtered.filter(h => (Number(h.renown)||0) >= 500);
    else if (_heroesQuickFilter === 'companions') filtered = filtered.filter(h => h.occupation === 'Wanderer' || h.occupation === 'Companion');
    else if (_heroesQuickFilter === 'alive') filtered = filtered.filter(h => !h.isDead);
    else if (_heroesQuickFilter === 'dead') filtered = filtered.filter(h => h.isDead);
    else if (_heroesQuickFilter === 'met') filtered = filtered.filter(h => h.hasMet);
    else if (_heroesQuickFilter === 'custom') filtered = filtered.filter(h => h.hasCustomDescription);

    // Sort
    if (_heroesSort === 'name') filtered = filtered.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (_heroesSort === 'renown') filtered = filtered.slice().sort((a,b)=>(Number(b.renown)||0)-(Number(a.renown)||0));
    else if (_heroesSort === 'age') filtered = filtered.slice().sort((a,b)=>(Number(b.age)||0)-(Number(a.age)||0));
    else if (_heroesSort === 'level') filtered = filtered.slice().sort((a,b)=>(Number(b.level)||0)-(Number(a.level)||0));

    setEl('heroes-count-all', arr.length);
    setEl('heroes-count-alive', arr.filter(h => !h.isDead).length);
    setEl('heroes-count-dead', arr.filter(h => h.isDead).length);
    setEl('heroes-count-custom', arr.filter(h => h.hasCustomDescription).length);
    setEl('heroes-count-met', arr.filter(h => h.hasMet).length);
    setEl('heroes-count-notmet', arr.filter(h => !h.hasMet).length);
    setEl('heroes-count-male', arr.filter(h => !h.isFemale).length);
    setEl('heroes-count-female', arr.filter(h => h.isFemale).length);
    setEl('heroes-count-married', arr.filter(h => h.isMarried).length);
    setEl('heroes-count-single', arr.filter(h => !h.isMarried).length);

    // Dynamic culture filters
    const cultures = [...new Set(arr.map(h => h.culture).filter(Boolean))].sort();
    const cultureEl = document.getElementById('heroes-culture-filters');
    if (cultureEl) {
      cultureEl.innerHTML = cultures.map(c => {
        const count = arr.filter(h => h.culture === c).length;
        const active = filter === 'culture:' + c ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('heroes','culture:${c}',this)"><span>${c}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Dynamic occupation filters
    const occupations = [...new Set(arr.map(h => h.occupation).filter(Boolean))].sort();
    const occEl = document.getElementById('heroes-occupation-filters');
    if (occEl) {
      occEl.innerHTML = occupations.map(o => {
        const count = arr.filter(h => h.occupation === o).length;
        const active = filter === 'occ:' + o ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('heroes','occ:${o}',this)"><span>${o}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }
  }
  if (type === 'clans') {
    renderClansExtras();
    renderClansToolbar();
    // Helpers
    const hasKingdom = c => c.kingdom && c.kingdom.length > 0;
    const isEliminated = c => c.members === 0 && c.tier === 0;
    const clanDiplo = c => {
      const playerK = (Store.kingdoms || []).find(k => k.diplomacy === 'Own Kingdom');
      if (!playerK) return 'neutral';
      if (c.kingdom === playerK.name) return 'ally';
      if ((c.wars || []).includes(playerK.name)) return 'enemy';
      return 'neutral';
    };

    if (filter === 'kingdom') filtered = arr.filter(c => hasKingdom(c) && !c.isBandit && !c.isMinorFaction);
    else if (filter === 'minor') filtered = arr.filter(c => c.isMinorFaction);
    else if (filter === 'bandit') filtered = arr.filter(c => c.isBandit);
    else if (filter === 'independent') filtered = arr.filter(c => !hasKingdom(c) && !c.isBandit && !c.isMinorFaction);
    else if (filter === 'active') filtered = arr.filter(c => !isEliminated(c));
    else if (filter === 'eliminated') filtered = arr.filter(c => isEliminated(c));
    else if (filter === 'diplo:ally') filtered = arr.filter(c => clanDiplo(c) === 'ally');
    else if (filter === 'diplo:enemy') filtered = arr.filter(c => clanDiplo(c) === 'enemy');
    else if (filter === 'diplo:neutral') filtered = arr.filter(c => clanDiplo(c) === 'neutral');
    else if (filter.startsWith('tier:')) filtered = arr.filter(c => c.tier === parseInt(filter.substring(5)));
    else if (filter.startsWith('culture:')) filtered = arr.filter(c => c.culture === filter.substring(8));
    else if (filter.startsWith('kingdom:')) filtered = arr.filter(c => c.kingdom === filter.substring(8));

    // Quick filter chips (further narrow)
    const playerKingdomName = Store.status?.kingdom || '';
    if (_clansQuickFilter === 'kingdom') filtered = filtered.filter(c => hasKingdom(c) && !c.isBandit && !c.isMinorFaction);
    else if (_clansQuickFilter === 'minor') filtered = filtered.filter(c => c.isMinorFaction);
    else if (_clansQuickFilter === 'bandit') filtered = filtered.filter(c => c.isBandit);
    else if (_clansQuickFilter === 'independent') filtered = filtered.filter(c => !hasKingdom(c) && !c.isBandit && !c.isMinorFaction);
    else if (_clansQuickFilter === 'atwar') filtered = filtered.filter(c => (c.wars || []).length > 0);
    else if (_clansQuickFilter === 'allies') filtered = filtered.filter(c => playerKingdomName && c.kingdom === playerKingdomName);

    // Sort
    if (_clansSort === 'name') filtered = filtered.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (_clansSort === 'tier') filtered = filtered.slice().sort((a,b)=>(Number(b.tier)||0)-(Number(a.tier)||0));
    else if (_clansSort === 'strength') filtered = filtered.slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0));
    else if (_clansSort === 'renown') filtered = filtered.slice().sort((a,b)=>(Number(b.renown)||0)-(Number(a.renown)||0));
    else if (_clansSort === 'wealth') filtered = filtered.slice().sort((a,b)=>(Number(b.wealth)||0)-(Number(a.wealth)||0));
    else if (_clansSort === 'members') filtered = filtered.slice().sort((a,b)=>(Number(b.members)||0)-(Number(a.members)||0));

    setEl('clans-count-all', arr.length);
    setEl('clans-count-kingdom', arr.filter(c => hasKingdom(c) && !c.isBandit && !c.isMinorFaction).length);
    setEl('clans-count-minor', arr.filter(c => c.isMinorFaction).length);
    setEl('clans-count-bandit', arr.filter(c => c.isBandit).length);
    setEl('clans-count-independent', arr.filter(c => !hasKingdom(c) && !c.isBandit && !c.isMinorFaction).length);
    setEl('clans-count-active', arr.filter(c => !isEliminated(c)).length);
    setEl('clans-count-eliminated', arr.filter(c => isEliminated(c)).length);
    setEl('clans-count-ally', arr.filter(c => clanDiplo(c) === 'ally').length);
    setEl('clans-count-enemy', arr.filter(c => clanDiplo(c) === 'enemy').length);
    setEl('clans-count-neutral', arr.filter(c => clanDiplo(c) === 'neutral').length);

    // Dynamic tier filters
    const tiers = [...new Set(arr.map(c => c.tier).filter(t => t != null && t > 0))].sort((a,b) => b - a);
    const tierEl = document.getElementById('clans-tier-filters');
    if (tierEl) {
      const tierColors = { 1:'#8b7355', 2:'#a08050', 3:'#b8943e', 4:'#d4a43a', 5:'#e8c84a', 6:'#ffd700' };
      tierEl.innerHTML = tiers.map(t => {
        const count = arr.filter(c => c.tier === t).length;
        const active = filter === 'tier:' + t ? ' active' : '';
        const color = tierColors[t] || '#d4a43a';
        const stars = Array.from({length: Math.min(t, 6)}, () => `<span class="tier-star" style="color:${color};text-shadow:0 0 6px ${color}80">&#x2605;</span>`).join('');
        return `<div class="side-link${active}" onclick="setFilter('clans','tier:${t}',this)"><span class="tier-label">${stars} <span class="tier-text">Tier ${t}</span></span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Dynamic culture filters
    const cultures = [...new Set(arr.map(c => c.culture).filter(Boolean))].sort();
    const cultureEl = document.getElementById('clans-culture-filters');
    if (cultureEl) {
      cultureEl.innerHTML = cultures.map(c => {
        const count = arr.filter(cl => cl.culture === c).length;
        const active = filter === 'culture:' + c ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('clans','culture:${c}',this)"><span>${c}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Dynamic kingdom filters
    const kingdoms = [...new Set(arr.map(c => c.kingdom).filter(Boolean))].sort();
    const kingdomEl = document.getElementById('clans-kingdom-filters');
    if (kingdomEl) {
      kingdomEl.innerHTML = kingdoms.map(k => {
        const count = arr.filter(c => c.kingdom === k).length;
        const active = filter === 'kingdom:' + k ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('clans','kingdom:${k}',this)"><span>${k}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }
  }
  if (type === 'settlements') {
    renderSettlementsExtras();
    renderSettlementsToolbar();
    if (filter === 'Town' || filter === 'Castle' || filter === 'Village') filtered = arr.filter(s => s.type === filter);
    else if (filter.startsWith('culture:')) filtered = arr.filter(s => s.culture === filter.substring(8));
    else if (filter.startsWith('kingdom:')) filtered = arr.filter(s => s.kingdom === filter.substring(8));
    else if (filter.startsWith('owner:')) filtered = arr.filter(s => s.owner === filter.substring(6));
    else if (filter === 'prosp:high') filtered = arr.filter(s => s.prosperity >= 5000);
    else if (filter === 'prosp:mid') filtered = arr.filter(s => s.prosperity >= 2000 && s.prosperity < 5000);
    else if (filter === 'prosp:low') filtered = arr.filter(s => s.prosperity > 0 && s.prosperity < 2000);
    else if (filter === 'garr:heavy') filtered = arr.filter(s => s.garrison >= 200);
    else if (filter === 'garr:light') filtered = arr.filter(s => s.garrison > 0 && s.garrison < 200);
    else if (filter === 'garr:none') filtered = arr.filter(s => !s.garrison && s.type !== 'Village');
    else if (filter !== 'all') filtered = arr.filter(s => s.type === filter);

    // Quick filter chips (further narrow)
    const playerClanName2 = Store.status?.clan || '';
    if (_settQuickFilter === 'Town' || _settQuickFilter === 'Castle' || _settQuickFilter === 'Village')
      filtered = filtered.filter(s => s.type === _settQuickFilter);
    else if (_settQuickFilter === 'siege') filtered = filtered.filter(s => s.isUnderSiege);
    else if (_settQuickFilter === 'raided') filtered = filtered.filter(s => s.isRaided);
    else if (_settQuickFilter === 'mine') filtered = filtered.filter(s => playerClanName2 && s.owner === playerClanName2);

    // Sort
    if (_settSort === 'name') filtered = filtered.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (_settSort === 'prosperity') filtered = filtered.slice().sort((a,b)=>(Number(b.prosperity)||0)-(Number(a.prosperity)||0));
    else if (_settSort === 'loyalty') filtered = filtered.slice().sort((a,b)=>(Number(b.loyalty)||0)-(Number(a.loyalty)||0));
    else if (_settSort === 'security') filtered = filtered.slice().sort((a,b)=>(Number(b.security)||0)-(Number(a.security)||0));
    else if (_settSort === 'garrison') filtered = filtered.slice().sort((a,b)=>(Number(b.garrison)||0)-(Number(a.garrison)||0));
    else if (_settSort === 'food') filtered = filtered.slice().sort((a,b)=>(Number(b.foodStocks)||0)-(Number(a.foodStocks)||0));

    setEl('sett-count-all', arr.length);
    ['Town', 'Castle', 'Village'].forEach(t =>
      setEl(`sett-count-${t}`, arr.filter(s => s.type === t).length));

    // Dynamic culture filters
    const cultures = [...new Set(arr.map(s => s.culture).filter(Boolean))].sort();
    const cultureEl = document.getElementById('sett-culture-filters');
    if (cultureEl) {
      cultureEl.innerHTML = cultures.map(c => {
        const count = arr.filter(s => s.culture === c).length;
        const active = filter === 'culture:' + c ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('settlements','culture:${c}',this)"><span>${c}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Dynamic kingdom filters
    const kingdoms = [...new Set(arr.map(s => s.kingdom).filter(Boolean))].sort();
    const kingdomEl = document.getElementById('sett-kingdom-filters');
    if (kingdomEl) {
      kingdomEl.innerHTML = kingdoms.map(k => {
        const count = arr.filter(s => s.kingdom === k).length;
        if (count === 0) return '';
        const active = filter === 'kingdom:' + k ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('settlements','kingdom:${k}',this)"><span>${k}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Dynamic owner clan filters
    const owners = [...new Set(arr.map(s => s.owner).filter(Boolean))].sort();
    const ownerEl = document.getElementById('sett-owner-filters');
    if (ownerEl) {
      ownerEl.innerHTML = owners.map(o => {
        const count = arr.filter(s => s.owner === o).length;
        const active = filter === 'owner:' + o ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('settlements','owner:${o}',this)"><span>${o}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }

    // Prosperity & Garrison filter counts
    setEl('sett-count-prosp-high', arr.filter(s => s.prosperity >= 5000).length);
    setEl('sett-count-prosp-mid', arr.filter(s => s.prosperity >= 2000 && s.prosperity < 5000).length);
    setEl('sett-count-prosp-low', arr.filter(s => s.prosperity > 0 && s.prosperity < 2000).length);
    setEl('sett-count-garr-heavy', arr.filter(s => s.garrison >= 200).length);
    setEl('sett-count-garr-light', arr.filter(s => s.garrison > 0 && s.garrison < 200).length);
    setEl('sett-count-garr-none', arr.filter(s => !s.garrison && s.type !== 'Village').length);
  }

  if (type === 'kingdoms') {
    renderKingdomsExtras();
    renderKingdomsToolbar();
    if (filter.startsWith('diplo:')) filtered = arr.filter(k => k.diplomacy === filter.substring(6));
    else if (filter === 'atwar') filtered = arr.filter(k => k.wars?.length > 0);
    else if (filter === 'atpeace') filtered = arr.filter(k => !k.wars?.length);
    else if (filter.startsWith('culture:')) filtered = arr.filter(k => k.culture === filter.substring(8));

    // Quick filter chips
    const myKingdomName2 = Store.status?.kingdom || '';
    if (_kingdomsQuickFilter === 'mine') filtered = filtered.filter(k => k.diplomacy === 'Own Kingdom' || k.name === myKingdomName2);
    else if (_kingdomsQuickFilter === 'ally') filtered = filtered.filter(k => k.diplomacy === 'Ally');
    else if (_kingdomsQuickFilter === 'enemy') filtered = filtered.filter(k => k.diplomacy === 'Enemy');
    else if (_kingdomsQuickFilter === 'atwar') filtered = filtered.filter(k => (k.wars||[]).length > 0);
    else if (_kingdomsQuickFilter === 'atpeace') filtered = filtered.filter(k => (k.wars||[]).length === 0);

    // Sort
    if (_kingdomsSort === 'name') filtered = filtered.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (_kingdomsSort === 'strength') filtered = filtered.slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0));
    else if (_kingdomsSort === 'fiefs') filtered = filtered.slice().sort((a,b)=>(Number(b.fiefCount)||0)-(Number(a.fiefCount)||0));
    else if (_kingdomsSort === 'clans') filtered = filtered.slice().sort((a,b)=>(Number(b.clanCount||b.clans?.length)||0)-(Number(a.clanCount||a.clans?.length)||0));
    else if (_kingdomsSort === 'wars') filtered = filtered.slice().sort((a,b)=>(Number((b.wars||[]).length)||0)-(Number((a.wars||[]).length)||0));

    setEl('kingdoms-count-all', arr.length);
    setEl('kingdoms-count-own', arr.filter(k => k.diplomacy === 'Own Kingdom').length);
    setEl('kingdoms-count-ally', arr.filter(k => k.diplomacy === 'Ally').length);
    setEl('kingdoms-count-enemy', arr.filter(k => k.diplomacy === 'Enemy').length);
    setEl('kingdoms-count-neutral', arr.filter(k => k.diplomacy === 'Neutral').length);
    setEl('kingdoms-count-atwar', arr.filter(k => k.wars?.length > 0).length);
    setEl('kingdoms-count-peace', arr.filter(k => !k.wars?.length).length);

    // Dynamic culture filters
    const cultures = [...new Set(arr.map(k => k.culture).filter(Boolean))].sort();
    const cultureEl = document.getElementById('kingdoms-culture-filters');
    if (cultureEl) {
      cultureEl.innerHTML = cultures.map(c => {
        const count = arr.filter(k => k.culture === c).length;
        const active = filter === 'culture:' + c ? ' active' : '';
        return `<div class="side-link${active}" onclick="setFilter('kingdoms','culture:${c}',this)"><span>${c}</span><span class="filter-count">${count}</span></div>`;
      }).join('');
    }
  }

  if (filtered.length === 0) {
    const emptyImgs = { heroes:'bannerlord_hero.png', clans:'bannerlord_clan.png', settlements:'bannerlord_settlement.png', kingdoms:'bannerlord_kingdoms.png' };
    grid.innerHTML = `<div class="empty-state empty-state-${type}">
      <div class="empty-state-bg" style="background-image:url('${emptyImgs[type] || ''}')"></div>
      <div class="empty-state-content">
        <div class="empty-state-icon">${{heroes:'\u2694',clans:'\u2618',settlements:'\u26F0',kingdoms:'\u265A'}[type] || '\u2726'}</div>
        <div class="empty-state-title">No ${type} found</div>
        <div class="empty-state-desc">Connect to the game to populate this archive</div>
      </div>
    </div>`;
    return;
  }
  // Settlement dashboard features
  if (type === 'settlements') {
    let settDash = document.getElementById('sett-dashboard');
    if (!settDash) {
      settDash = document.createElement('div');
      settDash.id = 'sett-dashboard';
      grid.parentElement.insertBefore(settDash, grid);
    }
    const sFilter = Store.filters.settlements || 'all';

    if (sFilter === 'all' && arr.length > 0) {
      const towns = arr.filter(s => s.type === 'Town');
      const castles = arr.filter(s => s.type === 'Castle');
      const villages = arr.filter(s => s.type === 'Village');
      const fmtN = v => v >= 10000 ? (v/1000).toFixed(1)+'K' : v >= 1000 ? v.toLocaleString() : String(v || 0);

      // ── Overview Counters ──
      let html = `<div class="sd-overview">
        <div class="sd-counter" onclick="setFilter('settlements','Town')">
          <span class="sd-counter-icon">&#x1F3DB;</span>
          <span class="sd-counter-val">${towns.length}</span>
          <span class="sd-counter-lbl">Towns</span>
        </div>
        <div class="sd-counter" onclick="setFilter('settlements','Castle')">
          <span class="sd-counter-icon">&#x1F3F0;</span>
          <span class="sd-counter-val">${castles.length}</span>
          <span class="sd-counter-lbl">Castles</span>
        </div>
        <div class="sd-counter" onclick="setFilter('settlements','Village')">
          <span class="sd-counter-icon">&#x1F33E;</span>
          <span class="sd-counter-val">${villages.length}</span>
          <span class="sd-counter-lbl">Villages</span>
        </div>
        <div class="sd-counter">
          <span class="sd-counter-icon">&#x1F6E1;</span>
          <span class="sd-counter-val">${fmtN(arr.reduce((s, x) => s + (x.garrison || 0), 0))}</span>
          <span class="sd-counter-lbl">Total Garrison</span>
        </div>
      </div>`;

      // ── Row 1: Prosperity Rankings + Culture Distribution ──
      const prospSorted = [...towns, ...castles].filter(s => s.prosperity > 0).sort((a,b) => (b.prosperity||0) - (a.prosperity||0));
      const maxProsp = prospSorted[0]?.prosperity || 1;

      html += `<div class="sd-row"><div class="kr-section">
        <h2 class="kr-title">Prosperity Rankings</h2>
        <div class="kr-subtitle">Wealthiest settlements in Calradia</div>
        <div class="kr-rankings">${prospSorted.slice(0, 10).map((s, i) => {
          const pct = Math.round((s.prosperity||0) / maxProsp * 100);
          const color = getCultureColor(s.culture);
          const icon = s.type === 'Castle' ? '&#x1F3F0;' : '&#x1F3DB;';
          const delay = i * 0.08;
          return `<div class="kr-row" style="animation-delay:${delay}s" onclick="openDetail('settlements','${s.id}')">
            <div class="kr-rank">${i === 0 ? '&#x1F451;' : '#' + (i+1)}</div>
            <div class="sd-type-icon">${icon}</div>
            <div class="kr-name">${s.name}</div>
            <div class="kr-bar-wrap"><div class="kr-bar" style="--w:${pct}%;background:${color};animation-delay:${delay + 0.3}s"></div></div>
            <div class="kr-str">${fmtN(s.prosperity)}</div>
          </div>`;
        }).join('')}</div>
      </div>`;

      // Culture Distribution Donut
      const cultureMap = {};
      arr.forEach(s => { const c = s.culture || 'Unknown'; cultureMap[c] = (cultureMap[c] || 0) + 1; });
      const cultureSorted = Object.entries(cultureMap).sort((a,b) => b[1] - a[1]);
      const totalS = arr.length || 1;
      let donutSegs = '', dOffset = 0;
      const dRadius = 70, dCirc = 2 * Math.PI * dRadius;
      cultureSorted.forEach(([c, count], i) => {
        const pct = count / totalS;
        const len = pct * dCirc;
        const color = getCultureColor(c);
        donutSegs += `<circle cx="90" cy="90" r="${dRadius}" fill="none" stroke="${color}" stroke-width="24"
          stroke-dasharray="${len} ${dCirc - len}" stroke-dashoffset="${-dOffset}"
          style="animation:donut-in .8s ease-out ${i*0.1}s both" class="donut-seg">
          <title>${c}: ${count} (${Math.round(pct*100)}%)</title></circle>`;
        dOffset += len;
      });

      html += `<div class="kr-section kr-power-balance">
        <h2 class="kr-title">Culture Distribution</h2>
        <div class="kr-subtitle">Settlement ownership by culture</div>
        <div class="kr-donut-wrap">
          <svg viewBox="0 0 180 180" class="kr-donut">${donutSegs}</svg>
          <div class="kr-donut-center"><span class="kr-donut-total">${totalS}</span><span class="kr-donut-label">Settlements</span></div>
        </div>
        <div class="kr-legend">${cultureSorted.map(([c, count]) =>
          `<div class="kr-legend-item"><span class="kr-legend-dot" style="background:${getCultureColor(c)}"></span>
           <span class="kr-legend-name">${c}</span><span class="kr-legend-pct">${count}</span></div>`
        ).join('')}</div>
      </div></div>`;

      // ── Row 2: Kingdom Territory + Garrison Strength ──
      const kingdomTerr = {};
      arr.forEach(s => {
        const k = s.kingdom || 'Independent';
        if (!kingdomTerr[k]) kingdomTerr[k] = { towns: 0, castles: 0, villages: 0, total: 0 };
        kingdomTerr[k][s.type === 'Town' ? 'towns' : s.type === 'Castle' ? 'castles' : 'villages']++;
        kingdomTerr[k].total++;
      });
      const terrSorted = Object.entries(kingdomTerr).sort((a,b) => b[1].total - a[1].total);
      const maxTerr = terrSorted[0]?.[1].total || 1;

      html += `<div class="sd-row"><div class="kr-section">
        <h2 class="kr-title">Kingdom Territories</h2>
        <div class="kr-subtitle">Settlement control by faction</div>
        <div class="sd-territory">${terrSorted.map(([k, t], i) => {
          const kObj = (Store.kingdoms || []).find(x => x.name === k);
          const color = kObj ? getCultureColor(kObj.culture) : '#6b5b3e';
          const pct = Math.round(t.total / maxTerr * 100);
          return `<div class="sd-terr-row" style="animation-delay:${i * 0.06}s">
            <div class="sd-terr-name">${k}</div>
            <div class="sd-terr-bar-wrap">
              <div class="sd-terr-seg sd-terr-town" style="width:${t.towns/maxTerr*100}%;background:${color}dd" title="${t.towns} Towns"></div>
              <div class="sd-terr-seg sd-terr-castle" style="width:${t.castles/maxTerr*100}%;background:${color}88" title="${t.castles} Castles"></div>
              <div class="sd-terr-seg sd-terr-village" style="width:${t.villages/maxTerr*100}%;background:${color}44" title="${t.villages} Villages"></div>
            </div>
            <div class="sd-terr-count">${t.total}</div>
          </div>`;
        }).join('')}</div>
        <div class="sd-terr-legend">
          <span><span class="sd-terr-dot" style="opacity:0.87"></span>Towns</span>
          <span><span class="sd-terr-dot" style="opacity:0.53"></span>Castles</span>
          <span><span class="sd-terr-dot" style="opacity:0.27"></span>Villages</span>
        </div>
      </div>`;

      // Garrison Strength Rankings
      const garrSorted = [...towns, ...castles].filter(s => s.garrison > 0).sort((a,b) => (b.garrison||0) - (a.garrison||0));
      const maxGarr = garrSorted[0]?.garrison || 1;

      html += `<div class="kr-section">
        <h2 class="kr-title">Garrison Strength</h2>
        <div class="kr-subtitle">Most defended settlements</div>
        <div class="kr-rankings">${garrSorted.slice(0, 10).map((s, i) => {
          const pct = Math.round((s.garrison||0) / maxGarr * 100);
          const color = getCultureColor(s.culture);
          const icon = s.type === 'Castle' ? '&#x1F3F0;' : '&#x1F3DB;';
          const delay = i * 0.08;
          return `<div class="kr-row" style="animation-delay:${delay}s" onclick="openDetail('settlements','${s.id}')">
            <div class="kr-rank">${i === 0 ? '&#x1F6E1;' : '#' + (i+1)}</div>
            <div class="sd-type-icon">${icon}</div>
            <div class="kr-name">${s.name}</div>
            <div class="kr-bar-wrap"><div class="kr-bar" style="--w:${pct}%;background:${color};animation-delay:${delay + 0.3}s"></div></div>
            <div class="kr-str">${fmtN(s.garrison)}</div>
          </div>`;
        }).join('')}</div>
      </div></div>`;

      // ── Row 3: Economy Board ──
      const totalTax = towns.reduce((s, t) => s + (t.tradeTax || 0), 0);
      const totalWorkshops = towns.reduce((s, t) => s + (t.workshopCount || 0), 0);
      const prodMap = {};
      villages.forEach(v => { if (v.villageProduces) { const p = v.villageProduces; prodMap[p] = (prodMap[p] || 0) + 1; } });
      const prodSorted = Object.entries(prodMap).sort((a,b) => b[1] - a[1]);

      html += `<div class="sd-row"><div class="kr-section sd-economy">
        <h2 class="kr-title">Economy Overview</h2>
        <div class="kr-subtitle">Trade, workshops & village production</div>
        <div class="sd-econ-grid">
          <div class="sd-econ-card">
            <div class="sd-econ-icon">&#x1F4B0;</div>
            <div class="sd-econ-val">${fmtN(totalTax)}</div>
            <div class="sd-econ-lbl">Total Trade Tax</div>
          </div>
          <div class="sd-econ-card">
            <div class="sd-econ-icon">&#x1F3ED;</div>
            <div class="sd-econ-val">${totalWorkshops}</div>
            <div class="sd-econ-lbl">Workshops</div>
          </div>
          <div class="sd-econ-card">
            <div class="sd-econ-icon">&#x1F33E;</div>
            <div class="sd-econ-val">${villages.length}</div>
            <div class="sd-econ-lbl">Producing Villages</div>
          </div>
        </div>
        ${prodSorted.length ? `<div class="sd-prod-list">
          <div class="sd-prod-title">Village Production</div>
          ${prodSorted.map(([p, c]) => `<div class="sd-prod-item"><span class="sd-prod-name">${p}</span><span class="sd-prod-count">${c} village${c > 1 ? 's' : ''}</span></div>`).join('')}
        </div>` : ''}
      </div></div>`;

      settDash.innerHTML = html;
      settDash.style.display = '';
      grid.style.display = '';
    } else {
      settDash.innerHTML = '';
      settDash.style.display = 'none';
    }
  }

  // Kingdom dashboard features
  if (type === 'kingdoms') {
    let warBoard = document.getElementById('war-board');
    if (!warBoard) {
      warBoard = document.createElement('div');
      warBoard.id = 'war-board';
      grid.parentElement.insertBefore(warBoard, grid);
    }

    // Helper: get faction color from banner code
    const getFactionColor = (k) => {
      const code = (k.bannerCode || '').split('.').map(Number);
      const cid = code.length >= 3 ? code[1] : 0;
      return (typeof BANNER_COLORS !== 'undefined' && BANNER_COLORS[cid]) || '#333';
    };
    const getBannerSrc = (k) => k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
    const fmtN = v => v >= 10000 ? (v/1000).toFixed(1)+'K' : v >= 1000 ? v.toLocaleString() : String(v || 0);

    // ═══ "ALL" FILTER: Show Power Rankings + Power Balance + War Network ═══
    if (filter === 'all') {
      // Use strength if available, fallback to fiefCount + clanCount as power metric
      const getPower = k => (k.strength || 0) || ((k.fiefCount || 0) * 100 + (k.clanCount || 0) * 50);
      const powerLabel = arr.some(k => k.strength > 0) ? 'Military Strength' : 'Territorial Power';
      const sorted = [...arr].sort((a,b) => getPower(b) - getPower(a));
      const maxStr = getPower(sorted[0]) || 1;
      const totalStr = arr.reduce((s,k) => s + getPower(k), 0) || 1;

      // Power Rankings + Power Balance side by side
      let html = `<div class="kr-dash-row"><div class="kr-section">
        <h2 class="kr-title">World Power Rankings</h2>
        <div class="kr-subtitle">${powerLabel} across Calradia</div>
        <div class="kr-rankings">${sorted.map((k, i) => {
          const power = getPower(k);
          const pct = Math.round(power / maxStr * 100);
          const color = getFactionColor(k);
          const banner = getBannerSrc(k);
          const delay = i * 0.08;
          const rankIcon = i === 0 ? '<span class="kr-medal kr-gold" title="Supreme Power">&#x1F947;</span>' : i === 1 ? '<span class="kr-medal kr-silver" title="Great Power">&#x1F948;</span>' : i === 2 ? '<span class="kr-medal kr-bronze" title="Rising Power">&#x1F949;</span>' : `<span class="kr-rank-num">#${i+1}</span>`;
          const tipDesc = `Clans: ${k.clanCount||0} | Fiefs: ${k.fiefCount||0} | Wars: ${(k.wars||[]).length}`;
          return `<div class="kr-row" style="animation-delay:${delay}s" onclick="openDetail('kingdoms','${k.id}')" data-tip-name="${esc(k.name)}" data-tip-val="${fmtN(power)}" data-tip-desc="${esc(tipDesc)}">
            <div class="kr-rank">${rankIcon}</div>
            <div class="kr-banner-sm">${banner ? `<img src="${banner}" alt="">` : ''}</div>
            <div class="kr-name">${k.name}</div>
            <div class="kr-bar-wrap"><div class="kr-bar" style="--w:${pct}%;background:${color};animation-delay:${delay + 0.3}s"></div></div>
            <div class="kr-str">${fmtN(power)}</div>
          </div>`;
        }).join('')}</div>
      </div>`;

      // Power Balance Donut — enhanced with inner ring + glow
      const dRadius = 72, dCirc = 2 * Math.PI * dRadius;
      const d2Radius = 54, d2Circ = 2 * Math.PI * d2Radius;
      let donutSegments = '';
      let donutInner = '';
      let offset = 0, offset2 = 0;
      sorted.forEach((k, i) => {
        const power = getPower(k);
        const pct = power / totalStr;
        const len = pct * dCirc;
        const len2 = pct * d2Circ;
        const color = getFactionColor(k);
        donutSegments += `<circle cx="100" cy="100" r="${dRadius}" fill="none" stroke="${color}" stroke-width="22"
          stroke-dasharray="${len} ${dCirc - len}" stroke-dashoffset="${-offset}"
          style="animation:donut-in .8s ease-out ${i*0.1}s both" class="donut-seg"
          onclick="openDetail('kingdoms','${k.id}')"><title>${k.name}: ${Math.round(pct*100)}%</title></circle>`;
        donutInner += `<circle cx="100" cy="100" r="${d2Radius}" fill="none" stroke="${color}" stroke-width="8" opacity=".25"
          stroke-dasharray="${len2} ${d2Circ - len2}" stroke-dashoffset="${-offset2}"
          style="animation:donut-in 1s ease-out ${i*0.12 + 0.3}s both"/>`;
        offset += len;
        offset2 += len2;
      });

      html += `<div class="kr-section kr-power-balance">
        <h2 class="kr-title">Power Balance</h2>
        <div class="kr-subtitle">Share of ${powerLabel.toLowerCase()}</div>
        <div class="kr-donut-wrap">
          <svg viewBox="0 0 200 200" class="kr-donut">
            <circle cx="100" cy="100" r="${dRadius}" fill="none" stroke="rgba(255,255,255,.03)" stroke-width="22"/>
            ${donutSegments}${donutInner}
          </svg>
          <div class="kr-donut-center">
            <span class="kr-donut-total">${fmtN(totalStr)}</span>
            <span class="kr-donut-label">Total</span>
          </div>
        </div>
        <div class="kr-legend">${sorted.map(k => {
          const pct = Math.round(getPower(k) / totalStr * 100);
          return `<div class="kr-legend-item" onclick="openDetail('kingdoms','${k.id}')">
            <span class="kr-legend-dot" style="background:${getFactionColor(k)}"></span>
            <span class="kr-legend-name">${k.name}</span>
            <span class="kr-legend-pct">${pct}%</span>
          </div>`;
        }).join('')}</div>
      </div></div>`;

      // Ornate medieval divider
      html += '<div class="kr-divider kr-divider-ornate"><span class="kr-divider-icon">&#x2694; &#x2726; &#x2694;</span></div>';

      // War Network
      const warPairsAll = [];
      const seenAll = new Set();
      arr.forEach(k => {
        (k.wars || []).forEach(enemy => {
          const pair = [k.name, enemy].sort().join('|');
          if (!seenAll.has(pair)) {
            seenAll.add(pair);
            const enemyK = arr.find(x => x.name === enemy);
            if (enemyK) warPairsAll.push({ a: k, b: enemyK });
          }
        });
      });

      if (warPairsAll.length > 0) {
        // Position kingdoms in a circle for the network — enlarged
        const ncx = 240, ncy = 200, nr = 150;
        const positions = {};
        arr.forEach((k, i) => {
          const angle = (i / arr.length) * 2 * Math.PI - Math.PI/2;
          positions[k.name] = { x: ncx + nr * Math.cos(angle), y: ncy + nr * Math.sin(angle) };
        });

        let netSvg = '';
        // Compass rose background
        netSvg += `<g opacity=".06" transform="translate(${ncx},${ncy})">
          <line x1="0" y1="-${nr+30}" x2="0" y2="${nr+30}" stroke="#b88c32" stroke-width="1"/>
          <line x1="-${nr+30}" y1="0" x2="${nr+30}" y2="0" stroke="#b88c32" stroke-width="1"/>
          <line x1="-${nr+15}" y1="-${nr+15}" x2="${nr+15}" y2="${nr+15}" stroke="#b88c32" stroke-width=".5"/>
          <line x1="${nr+15}" y1="-${nr+15}" x2="-${nr+15}" y2="${nr+15}" stroke="#b88c32" stroke-width=".5"/>
          <circle cx="0" cy="0" r="${nr+10}" fill="none" stroke="#b88c32" stroke-width=".5" stroke-dasharray="4,4"/>
          <circle cx="0" cy="0" r="${Math.round(nr*0.6)}" fill="none" stroke="#b88c32" stroke-width=".3" stroke-dasharray="2,6"/>
          <text x="0" y="-${nr+18}" text-anchor="middle" fill="#b88c32" font-size="10" font-family="Cinzel,serif">N</text>
          <text x="0" y="${nr+26}" text-anchor="middle" fill="#b88c32" font-size="10" font-family="Cinzel,serif">S</text>
          <text x="${nr+22}" y="4" text-anchor="middle" fill="#b88c32" font-size="10" font-family="Cinzel,serif">E</text>
          <text x="-${nr+22}" y="4" text-anchor="middle" fill="#b88c32" font-size="10" font-family="Cinzel,serif">W</text>
          <polygon points="0,-8 3,4 -3,4" fill="#b88c32" transform="translate(0,-${nr+6})"/>
        </g>`;
        netSvg += '<defs>';
        // Add glow filters
        netSvg += '<filter id="warGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
        netSvg += '<filter id="peaceGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
        // Clip paths for banner images in nodes
        arr.forEach(k => {
          const p = positions[k.name];
          if (p) netSvg += `<clipPath id="clip-${k.id}"><circle cx="${p.x}" cy="${p.y}" r="22"/></clipPath>`;
        });
        netSvg += '</defs>';

        // Draw peace lines (green dashed)
        const peacePairsNet = [];
        arr.forEach(k => {
          arr.forEach(other => {
            if (k.name >= other.name) return;
            if ((k.wars||[]).includes(other.name) || (other.wars||[]).includes(k.name)) return;
            peacePairsNet.push({a: k, b: other});
          });
        });
        peacePairsNet.forEach((w, i) => {
          const pa = positions[w.a.name], pb = positions[w.b.name];
          if (pa && pb) {
            netSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"
              stroke="rgba(46,204,113,.15)" stroke-width="1.5" stroke-dasharray="4,6"
              style="animation:war-line-draw .5s ease-out ${i*0.05}s both"/>`;
          }
        });

        // Draw war lines (red glowing)
        warPairsAll.forEach((w, i) => {
          const pa = positions[w.a.name], pb = positions[w.b.name];
          if (pa && pb) {
            netSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"
              stroke="rgba(200,50,50,.5)" stroke-width="5" stroke-dasharray="12,6"
              filter="url(#warGlow)"
              style="animation:war-line-draw .5s ease-out ${i*0.1}s both"/>`;
            netSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"
              stroke="rgba(255,80,60,.6)" stroke-width="2" stroke-dasharray="8,4"
              style="animation:war-line-draw .5s ease-out ${i*0.1}s both,war-line-pulse 2s ease-in-out ${i*0.2}s infinite"/>`;
          }
        });

        // Draw kingdom nodes with banner images
        arr.forEach(k => {
          const p = positions[k.name];
          if (!p) return;
          const color = getFactionColor(k);
          const atWar = k.wars?.length > 0;
          const banner = getBannerSrc(k);
          // Outer ring
          netSvg += `<circle cx="${p.x}" cy="${p.y}" r="26" fill="none" stroke="${atWar ? '#c0392b' : 'rgba(46,204,113,.4)'}"
            stroke-width="${atWar ? 3 : 2}" ${atWar ? 'filter="url(#warGlow)"' : ''} class="kr-net-node" onclick="openDetail('kingdoms','${k.id}')"/>`;
          // Filled circle bg
          netSvg += `<circle cx="${p.x}" cy="${p.y}" r="22" fill="${color}" class="kr-net-node" onclick="openDetail('kingdoms','${k.id}')"/>`;
          // Banner image inside node
          if (banner) {
            netSvg += `<image href="${banner}" x="${p.x - 18}" y="${p.y - 18}" width="36" height="36" clip-path="url(#clip-${k.id})" class="kr-net-node" onclick="openDetail('kingdoms','${k.id}')"/>`;
          }
          netSvg += `<text x="${p.x}" y="${p.y + 40}" text-anchor="middle" fill="var(--paper)" font-size="11" font-weight="700" style="text-shadow:0 1px 3px rgba(0,0,0,.8)">${k.name}</text>`;
        });

        html += `<div class="kr-dash-row"><div class="kr-section">
          <h2 class="kr-title">War Network</h2>
          <div class="kr-subtitle">Diplomatic relations between kingdoms</div>
          <div class="kr-network">
            <svg viewBox="0 0 480 420" class="kr-net-svg">${netSvg}</svg>
            <div class="kr-net-legend">
              <span class="kr-net-legend-item"><span style="display:inline-block;width:20px;height:3px;background:#c0392b;vertical-align:middle;margin-right:6px;border-radius:2px;box-shadow:0 0 6px rgba(200,50,50,.5)"></span> At War</span>
              <span class="kr-net-legend-item"><span style="display:inline-block;width:20px;height:2px;background:rgba(46,204,113,.4);vertical-align:middle;margin-right:6px;border-radius:2px"></span> At Peace</span>
            </div>
          </div>
        </div>`;
      } else {
        html += `<div class="kr-dash-row">`;
      }

      // ═══ Kingdom Comparison Tool ═══
      html += `<div class="kr-section">
        <h2 class="kr-title">Kingdom Comparison</h2>
        <div class="kr-subtitle">Select two kingdoms to compare</div>
        <div class="kr-compare-select">
          <div class="kr-dropdown" id="kr-dd-a">
            <button class="kr-dd-btn" onclick="toggleKrDropdown('a')"><span class="kr-dd-text">-- Select Kingdom --</span><span class="kr-dd-arrow">&#x25BC;</span></button>
            <div class="kr-dd-menu">${arr.map(k => {
              const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
              const color = getFactionColor(k);
              return `<div class="kr-dd-item" data-id="${k.id}" onclick="selectKrKingdom('a','${k.id}','${esc(k.name)}',this)">
                <span class="kr-dd-color" style="background:${color}"></span>
                ${banner ? `<img class="kr-dd-banner" src="${banner}" alt="">` : ''}
                <span class="kr-dd-name">${esc(k.name)}</span>
              </div>`;
            }).join('')}</div>
          </div>
          <span class="kr-compare-vs">VS</span>
          <div class="kr-dropdown" id="kr-dd-b">
            <button class="kr-dd-btn" onclick="toggleKrDropdown('b')"><span class="kr-dd-text">-- Select Kingdom --</span><span class="kr-dd-arrow">&#x25BC;</span></button>
            <div class="kr-dd-menu">${arr.map(k => {
              const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
              const color = getFactionColor(k);
              return `<div class="kr-dd-item" data-id="${k.id}" onclick="selectKrKingdom('b','${k.id}','${esc(k.name)}',this)">
                <span class="kr-dd-color" style="background:${color}"></span>
                ${banner ? `<img class="kr-dd-banner" src="${banner}" alt="">` : ''}
                <span class="kr-dd-name">${esc(k.name)}</span>
              </div>`;
            }).join('')}</div>
          </div>
          <input type="hidden" id="kr-compare-a" value="">
          <input type="hidden" id="kr-compare-b" value="">
        </div>
        <div id="kr-compare-result"><div class="empty" style="margin-top:12px;font-style:italic;opacity:.5">Select two kingdoms above to compare their power</div></div>
      </div></div>`;

      // Store arr for comparison function
      window._kingdomsArr = arr;

      // ═══ Animated Timeline Ticker ═══
      const events = [];
      // Wars between kingdoms
      arr.forEach(k => {
        const kWars = (k.wars || []).filter(w => arr.some(a => a.name === w));
        kWars.forEach(e => {
          const key = [k.name, e].sort().join('|');
          if (!events.find(ev => ev.key === key))
            events.push({ key, type: 'war', kingdom: k.name, target: e, color: getFactionColor(k) });
        });
      });
      // Rulers
      arr.forEach(k => {
        if (k.ruler) events.push({ type: 'ruler', kingdom: k.name, ruler: k.ruler, color: getFactionColor(k) });
      });
      // Power rankings
      const sorted2 = [...arr].sort((a,b) => (b.strength||0) - (a.strength||0));
      if (sorted2[0]) events.push({ type: 'power', kingdom: sorted2[0].name, color: getFactionColor(sorted2[0]) });

      // Chronicle events (if available)
      try {
        const chronicle = await API.getAllChronicle();
        if (chronicle?.length) {
          chronicle.slice(-10).forEach(e => {
            events.push({ type: 'chronicle', text: e.text, date: e.date });
          });
        }
      } catch {}

      if (events.length > 0) {
        // Triple the events for seamless loop
        const tickerItems = [...events, ...events, ...events].map(e => {
          if (e.type === 'war') return `<span class="kr-tick-item kr-tick-war"><span class="kr-tick-dot" style="background:${e.color}"></span>${e.kingdom} <span class="kr-tick-action">is at war with</span> ${e.target}</span>`;
          if (e.type === 'power') return `<span class="kr-tick-item kr-tick-power"><span class="kr-tick-dot" style="background:${e.color}"></span>${e.kingdom} <span class="kr-tick-action">is the strongest kingdom in Calradia</span></span>`;
          if (e.type === 'chronicle') return `<span class="kr-tick-item kr-tick-chronicle"><span class="kr-tick-dot" style="background:#d8a060"></span>${e.date ? '<b>'+e.date+'</b> ' : ''}${e.text}</span>`;
          return `<span class="kr-tick-item"><span class="kr-tick-dot" style="background:${e.color}"></span>${e.ruler} <span class="kr-tick-action">rules</span> ${e.kingdom}</span>`;
        }).join('');

        html = `<div class="kr-ticker-wrap">
          <div class="kr-ticker-seal kr-ticker-seal-l">&#x2726;</div>
          <div class="kr-ticker-label"><span class="kr-live-dot"></span>LIVE</div>
          <div class="kr-ticker"><div class="kr-ticker-track">${tickerItems}</div></div>
          <div class="kr-ticker-seal kr-ticker-seal-r">&#x2726;</div>
        </div>` + html;
      }

      warBoard.innerHTML = html;
      warBoard.style.display = '';
      grid.style.display = '';

    } else if (filter === 'atwar') {
      const warPairs = [];
      const seen = new Set();
      arr.forEach(k => {
        (k.wars || []).forEach(enemy => {
          const pair = [k.name, enemy].sort().join('|');
          if (!seen.has(pair)) {
            seen.add(pair);
            const enemyK = arr.find(x => x.name === enemy);
            if (enemyK) warPairs.push({ a: k, b: enemyK });
          }
        });
      });

      if (warPairs.length > 0) {
        warBoard.innerHTML = `<div class="war-board-header">
          <div class="war-header-flames">&#x1F525; &#x1F525; &#x1F525;</div>
          <h2 class="war-board-title">Active Wars</h2>
          <div class="war-board-subtitle">Blood and steel across the lands of Calradia</div>
          <span class="war-board-count war-count-pulse">${warPairs.length} Active Conflict${warPairs.length > 1 ? 's' : ''}</span>
        </div>
        <div class="war-cards">${warPairs.map((w, i) => {
          const aBanner = w.a.id && Store._bannerImages?.[w.a.id] ? `Banners/${encodeURIComponent(w.a.id)}.png` : '';
          const bBanner = w.b.id && Store._bannerImages?.[w.b.id] ? `Banners/${encodeURIComponent(w.b.id)}.png` : '';
          const getPwr = k => (k.strength || 0) || ((k.fiefCount || 0) * 100 + (k.clanCount || 0) * 50);
          const aStr = getPwr(w.a);
          const bStr = getPwr(w.b);
          const total = aStr + bStr || 1;
          const aPct = Math.round(aStr / total * 100);
          const bPct = 100 - aPct;
          const delay = Math.min(i * 0.1, 0.5);
          const fmtStr = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v);
          const aColor = getFactionColor(w.a);
          const bColor = getFactionColor(w.b);
          // Battle intensity based on power difference
          const diff = Math.abs(aPct - 50);
          const intensity = diff < 10 ? 'Fierce' : diff < 25 ? 'Heated' : 'One-sided';
          const intensityColor = diff < 10 ? '#ff4444' : diff < 25 ? '#ff8800' : '#ffcc00';
          const dominant = aStr > bStr ? 'a' : bStr > aStr ? 'b' : null;
          const dominantName = dominant === 'a' ? w.a.name : dominant === 'b' ? w.b.name : null;
          // Heat gauge: 100% = fierce (even), 0% = one-sided
          const heatPct = Math.round((1 - diff / 50) * 100);
          const heatGrad = diff < 10 ? 'linear-gradient(90deg,#ff4444,#ff6600,#ff4444)'
            : diff < 25 ? 'linear-gradient(90deg,#ff8800,#ffaa00)' : 'linear-gradient(90deg,#ffcc00,#ffdd44)';

          // Total wars each side is in
          const aWarsTotal = (w.a.wars || []).length;
          const bWarsTotal = (w.b.wars || []).length;
          const totalFiefs = (w.a.fiefCount || 0) + (w.b.fiefCount || 0);

          // War score arrow direction
          const scoreArrow = dominant === 'a' ? '&#x25C0;' : dominant === 'b' ? '&#x25B6;' : '&#x25AC;';
          const winnerName = dominant === 'a' ? w.a.name : dominant === 'b' ? w.b.name : 'Even';

          return `<div class="war-card" style="animation-delay:${delay}s">
            <div class="war-bg-left" style="background:linear-gradient(135deg,${aColor}bb,${aColor}33)"></div>
            <div class="war-bg-right" style="background:linear-gradient(-135deg,${bColor}bb,${bColor}33)"></div>
            <div class="war-diagonal"></div>
            <div class="war-ember-overlay"></div>
            <div class="war-card-inner">
              <div class="war-side war-side-left" onclick="openDetail('kingdoms','${w.a.id}')">
                <div class="war-shield-wrap">
                  ${aBanner ? `<img class="war-banner" src="${aBanner}" alt="">` : '<div class="war-banner-placeholder"></div>'}
                </div>
                ${dominant === 'a' ? '<div class="war-dominant-badge">&#x1F451; Dominant</div>' : '<div class="war-side-spacer"></div>'}
                <div class="war-faction-name">${w.a.name}</div>
                <div class="war-culture-tag">${w.a.culture || ''}</div>
                <div class="war-stats-block">
                  <div class="war-stat-row"><span class="war-stat-label">Strength</span><span class="war-stat-val">${fmtStr(aStr)}</span></div>
                  <div class="war-stat-row"><span class="war-stat-label">Clans</span><span class="war-stat-val">${w.a.clanCount || 0}</span></div>
                  <div class="war-stat-row"><span class="war-stat-label">Fiefs</span><span class="war-stat-val">${w.a.fiefCount || 0}</span></div>
                  <div class="war-stat-row war-stat-wars"><span class="war-stat-label">Active Wars</span><span class="war-stat-val">${aWarsTotal}</span></div>
                </div>
              </div>
              <div class="war-center">
                <div class="war-swords war-swords-clash">&#x2694;</div>
                <div class="war-vs">VS</div>
                <div class="war-intensity" style="color:${intensityColor}"><span class="war-intensity-dot" style="background:${intensityColor}"></span>${intensity}</div>
                <div class="war-heat-gauge"><div class="war-heat-fill" style="width:${heatPct}%;background:${heatGrad}"></div></div>
                <div class="war-score-indicator">
                  <span class="war-score-arrow" style="color:${dominant === 'a' ? aColor : dominant === 'b' ? bColor : '#888'}">${scoreArrow}</span>
                  <span class="war-score-label">${winnerName}</span>
                </div>
                <div class="war-bar-labels">
                  <span style="color:${aColor}">${w.a.name}</span>
                  <span style="color:${bColor}">${w.b.name}</span>
                </div>
                <div class="war-bar war-bar-wide">
                  <div class="war-bar-left war-bar-animated" style="width:${aPct}%;background:${aColor}"></div>
                  <div class="war-bar-right war-bar-animated" style="width:${bPct}%;background:${bColor}"></div>
                </div>
                <div class="war-bar-pct">${aPct}% — ${bPct}%</div>
              </div>
              <div class="war-side war-side-right" onclick="openDetail('kingdoms','${w.b.id}')">
                <div class="war-shield-wrap">
                  ${bBanner ? `<img class="war-banner" src="${bBanner}" alt="">` : '<div class="war-banner-placeholder"></div>'}
                </div>
                ${dominant === 'b' ? '<div class="war-dominant-badge">&#x1F451; Dominant</div>' : '<div class="war-side-spacer"></div>'}
                <div class="war-faction-name">${w.b.name}</div>
                <div class="war-culture-tag">${w.b.culture || ''}</div>
                <div class="war-stats-block">
                  <div class="war-stat-row"><span class="war-stat-label">Strength</span><span class="war-stat-val">${fmtStr(bStr)}</span></div>
                  <div class="war-stat-row"><span class="war-stat-label">Clans</span><span class="war-stat-val">${w.b.clanCount || 0}</span></div>
                  <div class="war-stat-row"><span class="war-stat-label">Fiefs</span><span class="war-stat-val">${w.b.fiefCount || 0}</span></div>
                  <div class="war-stat-row war-stat-wars"><span class="war-stat-label">Active Wars</span><span class="war-stat-val">${bWarsTotal}</span></div>
                </div>
              </div>
            </div>
            <div class="war-footer-info">
              <span class="war-footer-stat">&#x1F3F0; <strong>${totalFiefs}</strong> fiefs at stake</span>
              <span class="war-footer-divider">&#x2726;</span>
              <span class="war-footer-stat">&#x2694; ${intensity} conflict</span>
              <span class="war-footer-divider">&#x2726;</span>
              <span class="war-footer-stat">${aPct > bPct ? w.a.name : bPct > aPct ? w.b.name : 'Neither'} leads</span>
            </div>
          </div>`;
        }).join('')}</div>`;
        warBoard.style.display = '';
        grid.style.display = 'none';
        return;
      } else {
        warBoard.innerHTML = '<div class="empty">No active wars.</div>';
        warBoard.style.display = '';
        grid.style.display = 'none';
        return;
      }
    } else if (filter === 'atpeace' || filter === 'peace') {
      // Build unique peace pairs — kingdoms NOT at war with each other
      const peacePairs = [];
      const seenPeace = new Set();
      arr.forEach(k => {
        arr.forEach(other => {
          if (k.name === other.name) return;
          if ((k.wars || []).includes(other.name) || (other.wars || []).includes(k.name)) return;
          const pair = [k.name, other.name].sort().join('|');
          if (!seenPeace.has(pair)) {
            seenPeace.add(pair);
            peacePairs.push({ a: k, b: other });
          }
        });
      });

      if (peacePairs.length > 0) {
        // Calculate alliance strength totals
        const totalAlliance = peacePairs.reduce((s, w) => {
          const getPwr = k => (k.strength || 0) || ((k.fiefCount || 0) * 100 + (k.clanCount || 0) * 50);
          return s + getPwr(w.a) + getPwr(w.b);
        }, 0);

        warBoard.innerHTML = `<div class="peace-board-header">
          <div class="peace-header-decor">&#x1F33F;</div>
          <h2 class="peace-board-title">Peaceful Relations</h2>
          <div class="peace-board-sub">Bonds of peace across the lands of Calradia</div>
          <div class="peace-header-stats">
            <span class="peace-stat"><span class="peace-stat-val">${peacePairs.length}</span> Peaceful Bonds</span>
            <span class="peace-stat"><span class="peace-stat-val">${fmtN(totalAlliance)}</span> Combined Strength</span>
          </div>
          <div class="peace-header-decor">&#x1F33F;</div>
        </div>
        <div class="peace-cards">${(() => {
          const peacePageSize = 10;
          const peaceTotalPages = Math.ceil(peacePairs.length / peacePageSize);
          const peaceCurrentPage = Math.min(Store._peacePage || 1, peaceTotalPages);
          Store._peacePage = peaceCurrentPage;
          const peaceStart = (peaceCurrentPage - 1) * peacePageSize;
          const peacePageItems = peacePairs.slice(peaceStart, peaceStart + peacePageSize);
          return peacePageItems.map((w, i) => {
          const aBanner = getBannerSrc(w.a);
          const bBanner = getBannerSrc(w.b);
          const getPwr = k => (k.strength || 0) || ((k.fiefCount || 0) * 100 + (k.clanCount || 0) * 50);
          const aStr = getPwr(w.a);
          const bStr = getPwr(w.b);
          const combined = aStr + bStr;
          const delay = Math.min(i * 0.06, 0.5);
          const aColor = getFactionColor(w.a);
          const bColor = getFactionColor(w.b);
          // Find shared enemies
          const aWars = w.a.wars || [];
          const bWars = w.b.wars || [];
          const sharedEnemies = aWars.filter(e => bWars.includes(e));

          // Alliance power bar proportions
          const aPct = combined > 0 ? Math.round(aStr / combined * 100) : 50;
          const bPct = 100 - aPct;
          const combinedClans = (w.a.clanCount || 0) + (w.b.clanCount || 0);
          const combinedFiefs = (w.a.fiefCount || 0) + (w.b.fiefCount || 0);

          return `<div class="peace-card" style="animation-delay:${delay}s">
            <div class="pc-bg-left" style="background:linear-gradient(135deg,${aColor}33,${aColor}0a)"></div>
            <div class="pc-bg-right" style="background:linear-gradient(-135deg,${bColor}33,${bColor}0a)"></div>
            <div class="pc-bg-blend" style="background:radial-gradient(ellipse at 50% 50%,rgba(46,204,113,.04),transparent 70%)"></div>
            <div class="pc-card-inner">
              <div class="pc-side pc-side-left" onclick="openDetail('kingdoms','${w.a.id}')">
                <div class="pc-shield-wrap">
                  ${aBanner ? `<img class="pc-banner" src="${aBanner}" alt="">` : '<div class="pc-banner-ph"></div>'}
                </div>
                <div class="pc-faction">${w.a.name}</div>
                <div class="pc-culture">${w.a.culture || ''}</div>
                <div class="pc-stats pc-stats-left">
                  <div class="pc-stat"><span class="pc-stat-lbl">Strength</span><span class="pc-stat-val">${fmtN(aStr)}</span></div>
                  <div class="pc-stat"><span class="pc-stat-lbl">Clans</span><span class="pc-stat-val">${w.a.clanCount || 0}</span></div>
                  <div class="pc-stat"><span class="pc-stat-lbl">Fiefs</span><span class="pc-stat-val">${w.a.fiefCount || 0}</span></div>
                </div>
              </div>
              <div class="pc-center">
                <div class="pc-vine-top">&#x1F33F;</div>
                <div class="pc-handshake">&#x1F91D;</div>
                <div class="pc-label">PEACE</div>
                <div class="pc-combined">
                  <div class="pc-combined-val">${fmtN(combined)}</div>
                  <div class="pc-combined-lbl">Alliance Power</div>
                </div>
                <div class="pc-power-bar">
                  <div class="pc-power-left" style="width:${aPct}%;background:${aColor}"></div>
                  <div class="pc-power-right" style="width:${bPct}%;background:${bColor}"></div>
                </div>
                ${sharedEnemies.length ? `<div class="pc-shared-enemies"><span class="pc-enemy-icon">&#x2694;</span> Common Foes: ${sharedEnemies.join(', ')}</div>` : ''}
                <div class="pc-vine-bot">&#x1F33F;</div>
              </div>
              <div class="pc-side pc-side-right" onclick="openDetail('kingdoms','${w.b.id}')">
                <div class="pc-shield-wrap">
                  ${bBanner ? `<img class="pc-banner" src="${bBanner}" alt="">` : '<div class="pc-banner-ph"></div>'}
                </div>
                <div class="pc-faction">${w.b.name}</div>
                <div class="pc-culture">${w.b.culture || ''}</div>
                <div class="pc-stats pc-stats-right">
                  <div class="pc-stat"><span class="pc-stat-val">${fmtN(bStr)}</span><span class="pc-stat-lbl">Strength</span></div>
                  <div class="pc-stat"><span class="pc-stat-val">${w.b.clanCount || 0}</span><span class="pc-stat-lbl">Clans</span></div>
                  <div class="pc-stat"><span class="pc-stat-val">${w.b.fiefCount || 0}</span><span class="pc-stat-lbl">Fiefs</span></div>
                </div>
              </div>
            </div>
            <div class="pc-footer">
              <span class="pc-footer-stat">&#x1F6E1; <strong>${combinedClans}</strong> clans united</span>
              <span class="pc-footer-div">&#x1F33F;</span>
              <span class="pc-footer-stat">&#x1F3F0; <strong>${combinedFiefs}</strong> fiefs combined</span>
              ${sharedEnemies.length ? `<span class="pc-footer-div">&#x2694;</span><span class="pc-footer-stat pc-footer-enemy">Fighting <strong>${sharedEnemies.join(', ')}</strong> together</span>` : ''}
            </div>
          </div>`;
        }).join('') + (peaceTotalPages > 1 ? `<div class="pagination" style="border-top:1px solid rgba(46,204,113,.15)">
          <span class="pg-info">Showing ${peaceStart + 1}-${Math.min(peaceStart + peacePageSize, peacePairs.length)} of ${peacePairs.length}</span>
          <div class="pg-buttons">
            <button class="pg-btn pg-arrow${peaceCurrentPage <= 1 ? ' pg-disabled' : ''}" onclick="Store._peacePage=${peaceCurrentPage - 1};renderList('kingdoms')" ${peaceCurrentPage <= 1 ? 'disabled' : ''}>&laquo;</button>
            ${Array.from({length: peaceTotalPages}, (_, p) => `<button class="pg-btn${p + 1 === peaceCurrentPage ? ' pg-active' : ''}" onclick="Store._peacePage=${p + 1};renderList('kingdoms')">${p + 1}</button>`).join('')}
            <button class="pg-btn pg-arrow${peaceCurrentPage >= peaceTotalPages ? ' pg-disabled' : ''}" onclick="Store._peacePage=${peaceCurrentPage + 1};renderList('kingdoms')" ${peaceCurrentPage >= peaceTotalPages ? 'disabled' : ''}>&raquo;</button>
          </div>
        </div>` : '');
        })()}</div>`;
        warBoard.style.display = '';
        grid.style.display = 'none';
        return;
      } else {
        warBoard.innerHTML = '<div class="empty">No peaceful relations.</div>';
        warBoard.style.display = '';
        grid.style.display = 'none';
        return;
      }
    } else {
      warBoard.innerHTML = '';
      warBoard.style.display = 'none';
      grid.style.display = '';
    }
  }

  // Apply search filter
  const searchQ = Store._searchQuery?.[type] || '';
  if (searchQ) {
    filtered = filtered.filter(item => {
      const s = [item.name, item.culture, item.kingdom, item.clan, item.type, item.owner, item.occupation].filter(Boolean).join(' ').toLowerCase();
      return s.includes(searchQ);
    });
  }

  // Pagination
  const totalItems = filtered.length;
  const pageSize = Store.pageSize;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentListPage = Math.min(Store.listPage[type] || 1, totalPages || 1);
  Store.listPage[type] = currentListPage;
  const startIdx = (currentListPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  let paginationHtml = '';
  if (totalPages > 1) {
    const pages = [];
    const addPage = (n, label) => {
      pages.push(`<button class="pg-btn${n === currentListPage ? ' pg-active' : ''}" onclick="goPage('${type}',${n})">${label || n}</button>`);
    };
    pages.push(`<button class="pg-btn pg-arrow${currentListPage <= 1 ? ' pg-disabled' : ''}" onclick="goPage('${type}',${currentListPage - 1})" ${currentListPage <= 1 ? 'disabled' : ''}>&laquo;</button>`);

    // Smart page range
    let start = Math.max(1, currentListPage - 3);
    let end = Math.min(totalPages, currentListPage + 3);
    if (start > 1) { addPage(1); if (start > 2) pages.push('<span class="pg-dots">...</span>'); }
    for (let i = start; i <= end; i++) addPage(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push('<span class="pg-dots">...</span>'); addPage(totalPages); }

    pages.push(`<button class="pg-btn pg-arrow${currentListPage >= totalPages ? ' pg-disabled' : ''}" onclick="goPage('${type}',${currentListPage + 1})" ${currentListPage >= totalPages ? 'disabled' : ''}>&raquo;</button>`);
    paginationHtml = `<div class="pagination"><span class="pg-info">Showing ${startIdx + 1}-${Math.min(startIdx + pageSize, totalItems)} of ${totalItems}</span><div class="pg-buttons">${pages.join('')}</div></div>`;
  }

  // ═══ Featured Kingdom View — when culture filter shows ≤3 kingdoms ═══
  grid.style.display = '';
  if (type === 'kingdoms' && filter.startsWith('culture:') && pageItems.length > 0 && pageItems.length <= 3) {
    grid.style.display = 'block';
    const cultureName = filter.substring(8);
    const cultureDescs = {
      'Aserai': 'The Aserai are the desert warriors of the Nahasa, masters of trade and horsemanship. Their lands span the vast southern deserts, where caravans carry silks and spices between ancient oasis cities.',
      'Battania': 'The Battanians are the highland clans of the western forests, fierce warriors who paint their faces for battle. They are the oldest culture in Calradia, tracing their lineage to before the Empire.',
      'Empire': 'The remnants of the once-great Calradic Empire, torn apart by civil war into competing factions. Their legions once ruled all of Calradia, and their laws and roads still shape the continent.',
      'Khuzait': 'The Khuzait are the horse lords of the eastern steppe, unmatched mounted archers who sweep across the plains like the wind. United under a single khan, they threaten to overwhelm settled lands.',
      'Sturgia': 'The Sturgians are the northern seafarers and axe-warriors, hardened by the frozen winters of the taiga. They sail longships down great rivers and forge their kingdom in blood and iron.',
      'Vlandia': 'The Vlandians are the western knights and crossbowmen, descendants of mercenaries who carved out a kingdom by the sword. Their heavy cavalry charges are feared across the continent.'
    };
    const cultureDesc = cultureDescs[cultureName] || `The proud people of ${cultureName}, a culture of Calradia.`;

    // Gather related data
    const allSettlements = Store.settlements || [];
    const allClans = Store.clans || [];

    // Helper to get banner src for any kingdom
    const getKBanner = (kid, kname, bcode) => {
      if (kid && Store._bannerImages?.[kid]) return `Banners/${encodeURIComponent(kid)}.png`;
      return makeSigil(kname, 'kingdoms', bcode, kid);
    };

    grid.innerHTML = pageItems.map(k => {
      const bannerSrc = getKBanner(k.id, k.name, k.bannerCode);
      const code = (k.bannerCode || '').split('.').map(Number);
      const bgColorId = code.length >= 3 ? code[1] : 0;
      const bgColor = (typeof BANNER_COLORS !== 'undefined' && BANNER_COLORS[bgColorId]) || '#1a1a2e';
      const fmtK = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v || 0);

      const kSettlements = allSettlements.filter(s => s.kingdom === k.name);
      const towns = kSettlements.filter(s => (s.type||'').toLowerCase() === 'town');
      const castles = kSettlements.filter(s => (s.type||'').toLowerCase() === 'castle');
      const villages = kSettlements.filter(s => (s.type||'').toLowerCase() === 'village');
      const kClans = allClans.filter(c => c.kingdom === k.name);
      const wars = k.wars || [];
      const realWars = wars.filter(w => !w.includes('andits') && !w.includes('aiders') && !w.includes('ooters') && !w.includes('esert') && !w.includes('orsairs'));
      const allK = Store.kingdoms || [];
      const allies = allK.filter(o => o.name !== k.name && !(k.wars||[]).includes(o.name) && !(o.wars||[]).includes(k.name));
      const warStatus = realWars.length > 0;

      // Reusable link builder
      const mkLink = (text, type, id, color) => `<a onclick="event.stopPropagation();openDetail('${type}','${esc(id)}')" class="fk-link" style="color:${color||'#9a8a68'}">${esc(text)}</a>`;

      // Shield builder for diplomacy
      const shieldClip = 'polygon(3% 0,97% 0,100% 5%,100% 70%,50% 100%,0 70%,0 5%)';
      const mkShield = (name, id, bcode, bg, labelColor, isEnemy) => {
        const src = getKBanner(id, name, bcode);
        const sc = (bcode||'').split('.').map(Number);
        const scBg = (typeof BANNER_COLORS!=='undefined'&&BANNER_COLORS[sc.length>=3?sc[1]:0])||'#1a1a2e';
        const glow = isEnemy ? 'drop-shadow(0 0 10px rgba(200,50,30,.3))' : '';
        return `<div onclick="event.stopPropagation();openDetail('kingdoms','${esc(id)}')" class="fk-shield-item" style="display:inline-block;text-align:center;cursor:pointer;width:90px;vertical-align:top">
          <div style="width:74px;height:88px;margin:0 auto 8px;clip-path:${shieldClip};background:linear-gradient(180deg,#e8cc70,#c8a840 20%,#a08020 50%,#8b6914 80%,#6a4e0e);padding:4px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6)) ${glow}">
            <div style="width:100%;height:100%;clip-path:${shieldClip};background:linear-gradient(180deg,${scBg}f0,${scBg}aa)">
              <img src="${src}" style="width:100%;height:100%;object-fit:cover;clip-path:${shieldClip}" alt="">
            </div>
          </div>
          <div style="font-size:11px;line-height:1.3;color:${labelColor}">${esc(name)}</div>
        </div>`;
      };

      const SC = 'polygon(4% 0,96% 0,100% 5%,100% 70%,50% 100%,0 70%,0 5%)';
      const goldLine = `<div style="height:1px;margin:0 44px;background:linear-gradient(90deg,transparent,rgba(184,140,50,.4) 10%,rgba(184,140,50,.4) 90%,transparent);position:relative;z-index:5"><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;color:rgba(184,140,50,.5);letter-spacing:4px;background:#1c1812;padding:0 14px">\u2726 \u2694 \u2726</span></div>`;
      const secHead = (t,c) => `<div style="font-family:Cinzel,serif;font-size:14px;color:${c||'#c8b080'};font-weight:700;margin-bottom:10px;padding-bottom:6px;letter-spacing:1.5px;border-bottom:1px solid rgba(184,140,50,.18);text-shadow:0 1px 0 rgba(0,0,0,.4)">${t}</div>`;
      const textList = (items) => `<div style="font-size:13px;color:#9a8a68;line-height:2.1;word-spacing:2px">${items}</div>`;

      return `<div class="fk-card fade-in" onclick="openDetail('kingdoms','${esc(k.id)}')" style="position:relative;cursor:pointer;margin-bottom:28px;overflow:hidden;border:3px solid rgba(180,140,50,.5);border-radius:4px;background:linear-gradient(170deg,#231e16 0%,#1c1812 40%,#151210 100%);box-shadow:0 6px 24px rgba(0,0,0,.5),inset 0 0 80px rgba(0,0,0,.2),inset 0 1px 0 rgba(184,140,50,.15)">
        <!-- Inner border frame -->
        <div style="position:absolute;inset:8px;border:1px solid rgba(184,140,50,.15);border-radius:2px;pointer-events:none;z-index:4"></div>
        <!-- Faction color wash -->
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 15% 20%,${bgColor}30,transparent 55%);pointer-events:none;z-index:0"></div>
        <!-- Grain texture -->
        <div style="position:absolute;inset:0;pointer-events:none;opacity:.035;z-index:1;background-image:url('data:image/svg+xml,%3Csvg width=\\'8\\' height=\\'8\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Ccircle cx=\\'1\\' cy=\\'1\\' r=\\'.6\\' fill=\\'%23fff\\' opacity=\\'.3\\'/%3E%3Ccircle cx=\\'5\\' cy=\\'4\\' r=\\'.4\\' fill=\\'%23fff\\' opacity=\\'.2\\'/%3E%3C/svg%3E');background-size:8px 8px"></div>

        <!-- ═══ TOP: Big shield + Info ═══ -->
        <div style="display:flex;gap:44px;padding:44px 48px 32px;position:relative;z-index:3;align-items:flex-start">
          <!-- LARGE shield-shaped banner with bright gold frame -->
          <div style="flex-shrink:0;width:200px;position:relative">
            <div style="position:absolute;top:50%;left:50%;width:160px;height:160px;transform:translate(-50%,-50%);background:radial-gradient(circle,${bgColor}35,transparent 70%);pointer-events:none;z-index:0"></div>
            <div style="position:relative;z-index:1;width:190px;height:228px;margin:0 auto;clip-path:${SC};background:linear-gradient(180deg,#e8cc70,#c8a840 20%,#a08020 50%,#8b6914 80%,#6a4e0e);padding:8px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.7)) drop-shadow(0 0 15px rgba(200,170,60,.15))">
              <div style="width:100%;height:100%;clip-path:${SC};background:linear-gradient(180deg,${bgColor}f0,${bgColor}aa);position:relative">
                <img class="fk-banner" src="${bannerSrc}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;clip-path:${SC}">
              </div>
            </div>
          </div>
          <!-- Info -->
          <div style="flex:1;min-width:0;padding-top:4px">
            <h2 style="margin:0 0 12px;font-family:Cinzel,serif;font-size:38px;color:#ecdcc0;letter-spacing:4px;text-transform:uppercase;text-shadow:0 2px 0 rgba(0,0,0,.5),0 0 30px rgba(184,140,50,.1)">${esc(k.name)}</h2>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:15px;color:#9a8a68;margin-bottom:18px">
              <strong style="color:#c8b080">${esc(cultureName)}</strong>
              <span style="color:#4a4030">|</span>
              ${k.ruler ? `Ruler: <strong style="color:#c8b080">${esc(k.ruler)}</strong><span style="color:#4a4030">|</span>` : ''}
              ${warStatus
                ? `<span style="display:inline-block;padding:5px 18px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ffc8b0;background:linear-gradient(135deg,rgba(180,50,30,.4),rgba(140,30,15,.3));border:1px solid rgba(200,60,40,.5);border-radius:3px;text-shadow:0 1px 3px rgba(0,0,0,.5)">AT WAR</span>`
                : `<span style="display:inline-block;padding:5px 18px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#a0d8b0;background:linear-gradient(135deg,rgba(40,140,70,.25),rgba(20,100,40,.15));border:1px solid rgba(46,160,80,.35);border-radius:3px">AT PEACE</span>`}
            </div>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:#8a7a58;font-style:italic">${esc(cultureDesc)}</p>
            <div style="font-size:15px;color:#9a8a68;line-height:2.2">
              <div><strong style="color:#c8b080;font-size:15px;letter-spacing:.5px">Military Strength</strong></div>
              <div style="font-family:Cinzel,serif;font-size:36px;color:#d4b878;text-shadow:0 0 25px rgba(184,140,50,.2),0 2px 0 rgba(0,0,0,.3);margin:4px 0 8px;letter-spacing:2px">${fmtK(k.strength)}</div>
              <div style="color:#8a7a5a;font-size:14px">Fiefs: <strong style="color:#b0a070">${towns.length}</strong> Towns, <strong style="color:#b0a070">${castles.length}</strong> Castles, <strong style="color:#b0a070">${villages.length}</strong> Villages</div>
            </div>
          </div>
        </div>

        <!-- ═══ MID: Two columns ═══ -->
        ${goldLine}
        <div style="display:flex;gap:48px;padding:24px 48px 28px;position:relative;z-index:3">
          <div style="flex:1;min-width:0">
            ${kClans.length ? `<div style="margin-bottom:20px">
              ${secHead('Noble Clans')}
              ${textList(kClans.map(c => mkLink(c.name,'clans',c.id)).join(', '))}
            </div>` : ''}
            ${towns.length ? `<div style="margin-bottom:20px">
              ${secHead('Towns')}
              ${textList(towns.map(s => mkLink(s.name,'settlements',s.id)).join(', '))}
            </div>` : ''}
          </div>
          <div style="flex:1;min-width:0">
            ${castles.length ? `<div style="margin-bottom:20px">
              ${secHead('Castles')}
              ${textList(castles.map(s => mkLink(s.name,'settlements',s.id)).join(', '))}
            </div>` : ''}
            ${villages.length ? `<div style="margin-bottom:20px">
              ${secHead('Villages ('+villages.length+')')}
              ${textList(villages.slice(0,15).map(s => mkLink(s.name,'settlements',s.id)).join(', ')+(villages.length>15?`, <span style="color:#6a5a42;font-style:italic">+${villages.length-15} more</span>`:''))}
            </div>` : ''}
          </div>
        </div>

        ${(realWars.length||allies.length) ? `
        <!-- ═══ BOTTOM: Diplomacy shields ═══ -->
        ${goldLine}
        <div style="padding:24px 48px 36px;position:relative;z-index:3">
          ${realWars.length ? `<div style="margin-bottom:${allies.length?'28px':'0'}">
            ${secHead('Enemies','#c05040')}
            <div style="display:flex;flex-wrap:wrap;gap:18px">${realWars.map(wName => {
              const wk = allK.find(x => x.name === wName);
              return wk ? mkShield(wk.name, wk.id, wk.bannerCode, wk, '#c08070', true) : `<span style="color:#c08070;font-size:13px">${esc(wName)}</span>`;
            }).join('')}</div>
          </div>` : ''}
          ${allies.length ? `<div>
            ${secHead('At Peace With','#609060')}
            <div style="display:flex;flex-wrap:wrap;gap:18px">${allies.map(a => mkShield(a.name, a.id, a.bannerCode, a, '#80a880')).join('')}</div>
          </div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('') + paginationHtml;
  } else {
    grid.innerHTML = pageItems.map((item, i) => buildCard(item, type, i)).join('') + paginationHtml;
  }

  // Async render banner canvases on cards that have banner codes
  if (typeof renderBannerCanvas === 'function') {
    grid.querySelectorAll('.card[data-banner]').forEach(card => {
      const code = card.getAttribute('data-banner');
      if (!code) return;
      const avatarImg = card.querySelector('.avatar img');
      const bgImg = card.querySelector('.card-banner-bg img');
      // Render avatar banner (small)
      renderBannerCanvas(code, 48).then(canvas => {
        if (canvas && avatarImg) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.borderRadius = 'inherit';
          avatarImg.replaceWith(canvas);
        }
      });
      // Render background banner (large, for clans/kingdoms)
      if (bgImg) {
        renderBannerCanvas(code, 160).then(canvas => {
          if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            bgImg.replaceWith(canvas);
          }
        });
      }
    });
    // Also render banners on featured kingdom cards
    grid.querySelectorAll('.fk-card .fk-banner').forEach(img => {
      const fkCard = img.closest('.fk-card');
      if (!fkCard) return;
      const kid = fkCard.getAttribute('onclick')?.match(/'([^']+)'\s*\)/)?.[1];
      if (!kid) return;
      const kItem = (Store.kingdoms || []).find(k => k.id === kid);
      if (!kItem?.bannerCode) return;
      renderBannerCanvas(kItem.bannerCode, 120).then(canvas => {
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.objectFit = 'contain';
          img.replaceWith(canvas);
        }
      });
    });
  }
}

function goPage(type, page) {
  Store.listPage[type] = Math.max(1, page);
  renderList(type);
  // Scroll to top of grid
  const grid = document.getElementById(`grid-${type}`);
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setFilter(type, value, el) {
  Store.filters[type] = value;
  Store.listPage[type] = 1; // Reset to page 1 on filter change
  if (el) {
    // Clear active from ALL filter sections in this page's sidebar
    const sidebar = el.closest('aside');
    if (sidebar) sidebar.querySelectorAll('.side-link').forEach(l => l.classList.remove('active'));
    el.classList.add('active');
  }
  // Play click sound for all filters
  if (typeof UISounds !== 'undefined') {
    UISounds.click();
  }
  renderList(type);
}

// ── Search ──
Store._searchQuery = { heroes: '', clans: '', settlements: '', kingdoms: '' };
['heroes', 'clans', 'settlements', 'kingdoms'].forEach(type => {
  const input = document.getElementById(`search-${type}`);
  if (input) input.addEventListener('input', () => {
    Store._searchQuery[type] = input.value.toLowerCase().trim();
    Store.listPage[type] = 1;
    renderList(type);
  });
});

// ── Chronicle search ──
document.getElementById('search-chronicle')?.addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  document.querySelectorAll('#chronicle-list .event').forEach(ev => {
    ev.style.display = !q || ev.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ── Detail page ──
// ── Detail View Live Sync ──
let _detailSyncTimer = null;
let _detailSyncId = null;
let _detailSyncType = null;

function startDetailSync(type, id) {
  stopDetailSync();
  if (!WebSettings.liveSyncEnabled) return;
  _detailSyncType = type;
  _detailSyncId = id;
  const interval = (WebSettings.liveSyncInterval || 8) * 1000;
  _detailSyncTimer = setInterval(async () => {
    // Only sync if still on the same detail view
    if (Store.currentPage !== 'detail' || !document.querySelector('.detail-content')) {
      stopDetailSync();
      return;
    }
    try {
      // Refresh data silently, then re-render detail
      await refreshData();
      await openDetail(_detailSyncType, _detailSyncId, true);
    } catch (e) { console.warn('[DetailSync]', e); }
  }, interval);
}

function stopDetailSync() {
  if (_detailSyncTimer) { clearInterval(_detailSyncTimer); _detailSyncTimer = null; }
  _detailSyncId = null;
  _detailSyncType = null;
}

async function openDetail(type, id, isSync) {
  Store.detailType = type;
  window._currentDetailId = id;
  window._kbdTlIdx = -1;
  if (!isSync) showPage('detail');
  const rail = document.getElementById('detailRail');
  const body = document.getElementById('detailBody');
  const rightRail = document.getElementById('detailRightRail');
  const detailLayout = rail?.closest('.detail-layout');
  if (!isSync) {
    rail.innerHTML = '<div class="loading-spinner"></div>';
    if (rightRail) rightRail.innerHTML = '';
    if (detailLayout) detailLayout.classList.remove('has-right-rail');
    body.innerHTML = '<div class="loading-spinner"></div>';
  }
  try {

  const arr = Store[type] || [];
  const item = arr.find(x => x.id === id);
  if (!item) { body.innerHTML = '<div class="empty">Entity not found.</div>'; return; }

  // ── Fetch all available data in parallel ──
  let lore = {}, tags = null, journal = [], stats = {}, chronicle = '';
  let relationNotes = [], timeline = [], description = item.description || '';
  let bannerCode = item.bannerCode || '';
  let traits = [], skills = [], friends = [], enemies = [], family = [];
  let title = '';

  if (type === 'heroes') {
    const [detail, tagData, chronData, allChronicle] = await Promise.all([
      API.getHero(id),
      API.getEntityTags(id),
      API.getHeroChronicle(id),
      API.getAllChronicle()
    ]);
    if (detail) {
      lore = detail.lore || {};
      stats = detail.stats || {};
      journal = detail.journal || [];
      // Dedupe journal entries
      {
        const _seen = new Set();
        const _ded = [];
        for (const j of journal) {
          const key = (j.date || '') + '||' + ((j.text || '').trim().toLowerCase());
          if (_seen.has(key)) continue;
          _seen.add(key);
          _ded.push(j);
        }
        journal = _ded;
      }
      relationNotes = detail.relationNotes || [];
      timeline = detail.timeline || [];
      // Dedupe timeline events
      {
        const _seen = new Set();
        const _ded = [];
        for (const t of timeline) {
          const key = (t.date || '') + '||' + ((t.text || t.entry || '').trim().toLowerCase());
          if (_seen.has(key)) continue;
          _seen.add(key);
          _ded.push(t);
        }
        timeline = _ded;
      }
      if (detail.description) description = detail.description;
      if (detail.bannerCode && !bannerCode) bannerCode = detail.bannerCode;
      if (detail.tags) tags = { tags: detail.tags };
      traits = detail.traits || [];
      skills = detail.skills || [];
      friends = detail.friends || [];
      enemies = detail.enemies || [];
      family = detail.family || [];
      title = detail.title || '';
    }
    if (!tags) tags = tagData;
    chronicle = chronData?.chronicle || '';
    // If server didn't provide timeline, build from global chronicle
    if (!timeline.length && allChronicle?.length) {
      timeline = allChronicle.filter(e => e.entityId === id || (e.text && e.text.includes(id)));
    }
  } else {
    // Fetch detail data for clans/kingdoms/settlements
    const detailFn = type === 'clans' ? API.getClan(id)
                   : type === 'kingdoms' ? API.getKingdom(id)
                   : type === 'settlements' ? API.getSettlement(id)
                   : Promise.resolve(null);
    const [tagData, journalData, allChronicle, entityDetail] = await Promise.all([
      API.getEntityTags(id),
      API.getEntityJournal(id),
      API.getAllChronicle(),
      detailFn
    ]);
    tags = tagData;
    journal = journalData || [];
    // Dedupe journal by (date + normalized text)
    {
      const _seen = new Set();
      const _ded = [];
      for (const j of journal) {
        const key = (j.date || '') + '||' + ((j.text || '').trim().toLowerCase());
        if (_seen.has(key)) continue;
        _seen.add(key);
        _ded.push(j);
      }
      journal = _ded;
    }
    if (entityDetail) {
      if (entityDetail.bannerCode && !bannerCode) bannerCode = entityDetail.bannerCode;
    }
    // Store entity detail for section rendering
    item._detail = entityDetail || {};
    // Build timeline from global chronicle for this entity
    if (allChronicle?.length) {
      timeline = allChronicle.filter(e => e.entityId === id || (e.text && e.text.includes(id)));
      item._allChronicle = allChronicle;
    }
  }

  const tagStr = tags?.tags || '';

  const statDescriptions = {
    'Culture': 'The cultural heritage and traditions this character belongs to.',
    'Occupation': 'The social role and position in the realm.',
    'Kingdom': 'The kingdom or faction this character serves.',
    'Location': 'Current whereabouts in the world of Calradia.',
    'Status': 'Whether this character is currently alive and active.',
    'Spouse': 'The character\'s husband or wife, if married.',
    'Troops': 'Number of soldiers currently under command.',
    'Morale': 'The fighting spirit and willingness of troops to follow.',
    'Companions': 'Wanderers and companions traveling with this party.',
    'Towns': 'Number of towns owned or controlled.',
    'Castles': 'Number of castles held as fiefs.',
    'Garrisons': 'Total troops stationed in owned settlements.',
    'Workshops': 'Productive businesses generating income in towns.',
    'Influence': 'Political capital used for voting and kingdom decisions.',
    'Battles': 'Record of battles fought — wins and losses.',
    'Kills': 'Total confirmed kills in battle — heroes and troops.',
    'Tournaments': 'Number of tournament victories.',
    'Hall Rank': 'Standing among all heroes in the realm by renown.',
    'Clan': 'The noble house or faction this character belongs to.',
    'Age': 'Current age of this character in years.',
    'Type': 'The classification of this entity.',
    'Clan Tier': 'The prestige level of the clan, from 0 to 6.',
    'Strength': 'Combined military power of all parties and garrisons.',
    'Leader': 'The head of this clan who makes key decisions.',
    'Lords': 'Number of noble lords sworn to this faction.',
    'Renown': 'Fame and reputation earned through deeds and battles.',
    'Wealth': 'Financial resources and treasury holdings.',
    'Parties': 'Active war parties roaming the map.',
    'Caravans': 'Trade caravans generating income across the realm.',
    'Villages': 'Number of villages providing resources and recruits.',
    'Total Fiefs': 'Combined count of all towns, castles, and villages.',
    'At War': 'Factions currently engaged in military conflict.',
    'Ruler': 'The sovereign who leads this kingdom.',
    'Clans': 'Number of noble clans pledged to this kingdom.',
    'Owner': 'The lord who holds this settlement as a fief.',
    'Governor': 'The appointed administrator managing this settlement.',
    'Notables': 'Influential local figures — merchants, gang leaders, artisans.',
    'Prosperity': 'Economic health and growth of the settlement.',
    'Loyalty': 'How loyal the population is to the current ruler.',
    'Security': 'Safety from bandits and raiders in the area.',
    'Food': 'Available food stocks to sustain the population.',
    'Village Produces': 'Primary goods produced by bound villages.',
    'Militia': 'Local defense force recruited from the population.',
    'Garrison': 'Professional troops stationed to defend the settlement.',
  };

  // ── Rail ──
  const detailFields = [
    ['Culture', item.culture], ['Kingdom', item.kingdom], ['Clan', item.clan],
    ['Owner', item.owner], ['Ruler', item.ruler], ['Age', item.age],
    ['Type', item.type]
  ].filter(([, v]) => v != null && v !== '');

  const tagChips = tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean)
    .map(t => `<span class="detail-chip">${esc(t)}</span>`).join('') : '';

  // Banner display — rendered async into the top body panel
  const hasBanner = bannerCode && typeof renderBannerSVG === 'function';

  // Tags shown in rail for all entity types
  const tagRailHtml = tagChips
    ? `<div class="detail-rail-tags">${tagChips}</div>`
    : `<div class="detail-rail-tags-empty"><a href="#" onclick="editTags('${esc(id)}','');return false">+ Add Tags</a></div>`;

  // Build traits & skills HTML for hero portrait overlay
  let railTraitsHtml = '';
  let railSkillsHtml = '';
  if (type === 'heroes' && traits.length) {
    railTraitsHtml = `<div class="rail-traits"><div class="trait-grid">${traits.map(t => {
      const cls = t.level > 0 ? 'trait-pos' : 'trait-neg';
      const traitKey = t.name.toLowerCase().replace(/\s+/g, '');
      const imgFile = `Traits/${traitKey}_${t.level}.png`;
      const traitDescMap = {
        'Valor': {pos:'Brave and courageous in the face of danger.', neg:'Tends to avoid dangerous situations.'},
        'Mercy': {pos:'Shows compassion and spares the defeated.', neg:'Ruthless and merciless toward enemies.'},
        'Honor': {pos:'Keeps promises and acts with integrity.', neg:'Deceitful and willing to break oaths.'},
        'Generosity': {pos:'Generous with wealth and rewards.', neg:'Greedy and miserly with resources.'},
        'Calculating': {pos:'Careful and strategic in decision making.', neg:'Impulsive and reckless in choices.'}
      };
      const traitDesc = traitDescMap[t.name] ? (t.level > 0 ? traitDescMap[t.name].pos : traitDescMap[t.name].neg) : '';
      return `<div class="trait-badge ${cls}" data-tip-name="${esc(t.name)}" data-tip-val="${t.level > 0 ? '+' : ''}${t.level}" data-tip-desc="${esc(traitDesc)}">
        <img class="trait-icon" src="${imgFile}" alt="${esc(t.name)}" onerror="this.style.display='none'">
        <span class="trait-name">${esc(t.name)}</span>
      </div>`;
    }).join('')}</div></div>`;
  }
  if (type === 'heroes' && skills.length) {
    const skillIconMap = {
      'One Handed': 'onehanded', 'Two Handed': 'twohanded', 'Polearm': 'polearm',
      'Bow': 'bow', 'Crossbow': 'crossbow', 'Throwing': 'throwing',
      'Riding': 'riding', 'Athletics': 'athletics', 'Crafting': 'crafting', 'Smithing': 'crafting',
      'Scouting': 'scouting', 'Tactics': 'tactics', 'Roguery': 'roguery',
      'Charm': 'charm', 'Leadership': 'leadership', 'Trade': 'trade',
      'Steward': 'steward', 'Medicine': 'medicine', 'Engineering': 'engineering',
      'Strategy': 'strategy',
      'Mariner': 'mariner_skill', 'Boatswain': 'boatswain_skill', 'Shipmaster': 'shipmaster_skill'
    };
    const skillDescMap = {
      'One Handed': 'Mastery of fighting with one-handed weapons, either with a shield or without.',
      'Two Handed': 'Mastery of fighting with two-handed swords, axes, and maces.',
      'Polearm': 'Mastery of fighting with lances, pikes, and other polearms.',
      'Bow': 'Proficiency with bows for ranged combat on foot or horseback.',
      'Crossbow': 'Proficiency with crossbows for powerful ranged attacks.',
      'Throwing': 'Skill in throwing javelins, axes, and knives at enemies.',
      'Riding': 'Ability to ride and fight from horseback effectively.',
      'Athletics': 'Physical fitness, speed, and endurance on foot.',
      'Crafting': 'Ability to forge weapons and armor at the smithy.',
      'Smithing': 'Ability to forge weapons and armor at the smithy.',
      'Scouting': 'Ability to track enemies, navigate terrain, and spot ambushes.',
      'Tactics': 'Knowledge of battlefield formations and combat strategies.',
      'Roguery': 'Skill in underhanded activities like raiding, bribing, and smuggling.',
      'Charm': 'Ability to persuade, seduce, and influence others through conversation.',
      'Leadership': 'Ability to inspire and command troops, boosting morale and cohesion.',
      'Trade': 'Knowledge of markets, prices, and profitable trade routes.',
      'Steward': 'Ability to manage settlements, dungeons, and govern effectively.',
      'Medicine': 'Knowledge of healing wounds, treating injuries, and preventing disease.',
      'Engineering': 'Skill in building and operating siege engines and fortifications.',
      'Strategy': 'Knowledge of grand strategy and campaign-level warfare.',
      'Mariner': 'Skill in sailing and naval navigation.',
      'Boatswain': 'Skill in managing ship crews and rigging.',
      'Shipmaster': 'Mastery of commanding ships in naval combat.'
    };
    const sortedSkills = [...skills].sort((a, b) => b.value - a.value);
    railSkillsHtml = `<div class="rail-skills"><div class="skill-grid">${sortedSkills.map(s => {
      const iconKey = skillIconMap[s.name] || s.name.toLowerCase().replace(/\s+/g, '');
      const imgFile = iconKey.endsWith('_skill') ? `Skills/${iconKey}.png` : `Skills/gui_skills_icon_${iconKey}_small.png`;
      const desc = skillDescMap[s.name] || '';
      return `<div class="skill-tile" data-tip-name="${esc(s.name)}" data-tip-val="${s.value}" data-tip-desc="${esc(desc)}">
        <img class="skill-icon" src="${imgFile}" alt="${esc(s.name)}" onerror="this.style.display='none'">
        <span class="skill-val">${s.value}</span>
      </div>`;
    }).join('')}</div></div>`;
  }

  // getPortraitSrc is defined at top level
  const heroPortrait = type === 'heroes'
    ? `<div class="detail-portrait">
        <img id="heroPortraitImg" class="${gpClass(item)}" src="${getPortraitSrc(item, item._detail || {})}" alt="Portrait"
             onerror="this.src='Hero/bannerlord_hero_viking.png'" ${isGamePortrait(item) ? `style="${GP_STYLE}"` : ''}>
        <div class="portrait-name-overlay">
          <h2 class="portrait-name">${esc(item.name)}</h2>
          ${title ? `<div class="portrait-title">${esc(title)}</div>` : ''}
        </div>
        <div class="portrait-bottom-overlay">${railTraitsHtml}${railSkillsHtml}</div>
        <label class="portrait-upload-btn" title="Upload custom portrait">
          <input type="file" accept="image/*" style="display:none"
            onchange="uploadHeroPortrait('${esc(id)}', this.files[0])">
          &#x1F4F7;
        </label>
      </div>`
    : '';

  // Settlement portrait picker
  function getSettlementImg() {
    const sType = (item.type || '').toLowerCase();
    if (sType === 'castle') return 'Settlement/Castle.png';
    if (sType === 'village') return 'Settlement/Village.png';
    return 'Settlement/Town.png';
  }
  // For non-hero entities: use settlement image, pre-rendered banner, or SVG sigil
  const nonHeroAvatarSrc = type === 'settlements' ? getSettlementImg()
    : (id && Store._bannerImages?.[id]) ? `Banners/${encodeURIComponent(id)}.png`
    : makeSigil(item.name, type, bannerCode, id);
  const nonHeroAvatar = type === 'settlements'
    ? `<div class="detail-portrait"><img src="${nonHeroAvatarSrc}" alt="Settlement"></div>`
    : `<div class="detail-avatar"><img src="${nonHeroAvatarSrc}" alt=""></div>`;

  rail.innerHTML = `
    ${type === 'heroes' ? heroPortrait : nonHeroAvatar}
    <div class="detail-rail-body">
      ${type !== 'heroes' ? `<h2 class="detail-title">${esc(item.name)}</h2>` : ''}
      ${type !== 'heroes' && title ? `<div class="detail-title-sub">${esc(title)}</div>` : ''}
      ${type !== 'heroes' ? `<div class="detail-sub">${esc([item.culture, item.kingdom, item.clan].filter(Boolean).join(' \u00b7 '))}</div>` : ''}
      ${type === 'heroes' && item.clan ? (() => {
        const heroClan = (Store.clans || []).find(c => c.name === item.clan);
        const clanBannerId = heroClan ? heroClan.id : '';
        const clanBannerSrc = clanBannerId && Store._bannerImages?.[clanBannerId]
          ? `Banners/${encodeURIComponent(clanBannerId)}.png`
          : (heroClan?.bannerCode ? bannerToDataUri(heroClan.bannerCode, 80) : '');
        const cTier = heroClan?.tier || 0;
        const cStr = heroClan?.strength || 0;
        const cWealth = heroClan?.wealth || '';
        const cLeader = heroClan?.leader || '';
        const cFiefs = heroClan?.fiefs || 0;
        const cSettlements = heroClan?.settlements || [];
        const cWars = heroClan?.wars || [];
        const settNames = Array.isArray(cSettlements) ? cSettlements.map(s => typeof s === 'string' ? s : s.name).join(', ') : '';
        const warNames = Array.isArray(cWars) ? cWars.join(', ') : '';
        const fmtStr = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v || 0);
        const clanTipLines = [
          cLeader ? `Leader|${cLeader}` : '',
          cTier ? `Clan Tier|${cTier}` : '',
          cStr ? `Clan Strength|${fmtStr(cStr)}` : '',
          cWealth ? `Wealth|${cWealth}` : '',
          cFiefs ? `Fiefs|${cFiefs}` : '',
          settNames ? `Settlements|${settNames}` : '',
          warNames ? `Wars|${warNames}` : ''
        ].filter(Boolean).join(';;');
        return `<div class="part-of-panel" data-tip-name="${esc(item.clan)}" data-tip-val="" data-tip-clan="${esc(clanTipLines)}">
          <div class="part-of-label">Clan</div>
          <a class="part-of-link" onclick="openDetail('clans','${esc(clanBannerId)}');return false" href="#">
            ${clanBannerSrc ? `<img class="part-of-banner" src="${clanBannerSrc}" alt="">` : ''}
            <span class="part-of-name">${esc(item.clan)}</span>
          </a>
        </div>`;
      })() : ''}
      ${type === 'heroes' ? `<div class="detail-sub">${esc([item.culture, item.clan].filter(Boolean).join(' \u00b7 '))}</div>` : ''}
      ${type === 'clans' && item.kingdom ? (() => {
        const kingdom = (Store.kingdoms || []).find(k => k.name === item.kingdom);
        const kingdomId = kingdom ? kingdom.id : '';
        const kingdomBannerSrc = kingdomId && Store._bannerImages?.[kingdomId]
          ? `Banners/${encodeURIComponent(kingdomId)}.png`
          : (kingdom?.bannerCode ? bannerToDataUri(kingdom.bannerCode, 64) : '');
        return `<div class="part-of-panel">
          <div class="part-of-label">Part of</div>
          <a class="part-of-link" onclick="openDetail('kingdoms','${esc(kingdomId)}');return false" href="#">
            ${kingdomBannerSrc ? `<img class="part-of-banner" src="${kingdomBannerSrc}" alt="">` : ''}
            <span class="part-of-name">${esc(item.kingdom)}</span>
          </a>
        </div>`;
      })() : ''}
      ${tagRailHtml}
      <div class="detail-stats">
        ${detailFields.map(([k, v]) => `<div class="detail-stat" data-tip-name="${esc(k)}" data-tip-val="${esc(String(v))}" data-tip-desc="${esc(statDescriptions[k] || '')}"><b>${esc(k)}</b><strong>${esc(v)}</strong></div>`).join('')}
      </div>
      ${WebSettings.editingEnabled ? `<div class="detail-actions">
        <button class="btn btn-edit" onclick="editName('${esc(id)}','${esc(type)}')">Edit Name${type === 'heroes' ? ' & Title' : ''}</button>
        <button class="btn btn-edit" onclick="editDescription('${esc(id)}')">Edit Description</button>
        <button class="btn btn-edit" onclick="editTags('${esc(id)}','${esc(tagStr)}')">Edit Tags</button>
        ${type === 'heroes' ? `<button class="btn btn-edit" onclick="editLore('${esc(id)}')">Edit Lore</button>` : ''}
        ${type === 'heroes' ? `<button class="btn btn-edit" onclick="editCulture('${esc(id)}')">Change Culture</button>` : ''}
        ${type === 'heroes' ? `<button class="btn btn-edit" onclick="editOccupation('${esc(id)}')">Change Occupation</button>` : ''}
        ${type !== 'heroes' ? `<button class="btn btn-edit" onclick="editBanner('${esc(id)}','${esc(type)}')">Edit Banner</button>` : ''}
        ${type !== 'heroes' ? `<button class="btn btn-edit" onclick="addJournal('${esc(id)}')">Add Journal</button>` : ''}
      </div>` : ''}
    </div>`;

  // ── Body sections — always show all, with empty states ──
  const eid = esc(id);

  // Description
  let sections = '';

  // Hero detail extras (title ribbon, action buttons, badges, skill radar)
  if (type === 'heroes') {
    sections += renderHeroDetailExtras(item, item._detail || {}, stats, skills, friends, enemies, family, journal, timeline);
  }
  // Settlement detail extras (title ribbon, actions, badges)
  if (type === 'settlements') {
    sections += renderSettlementDetailExtras(item, item._detail || {});
  }
  // Clan detail extras (title ribbon, actions, badges, members ribbon, wars strip)
  if (type === 'clans') {
    sections += renderClanDetailExtras(item, item._detail || {});
    sections += renderClanMembersRibbon(item, item._detail || {});
    sections += renderClanWarsStrip(item, item._detail || {});
  }
  // Kingdom detail extras (title ribbon, actions, badges, member clans, wars)
  if (type === 'kingdoms') {
    sections += renderKingdomDetailExtras(item, item._detail || {});
    sections += renderKingdomMemberClansRibbon(item, item._detail || {});
    sections += renderKingdomWarsStrip(item, item._detail || {});
  }

  sections += `<div class="section"><h3>Description</h3>${description
    ? `<div class="lore"><p>${textToHtml(description)}</p></div>`
    : `<div class="empty">No custom description. <a href="#" onclick="editDescription('${eid}');return false">Write one</a>.</div>`
  }</div>`;

  // Info / Stats — build clean stats for each entity type
  const infoStats = {};
  if (type === 'heroes') {
    Object.assign(infoStats, stats);
  } else {
    const d = item._detail || {};
    if (type === 'settlements') {
      // Basic info
      if (d.owner?.name) infoStats['Owner'] = d.owner.name;
      if (d.clan) infoStats['Clan'] = d.clan;
      if (item.culture) infoStats['Culture'] = item.culture;
      if (d.kingdom) infoStats['Kingdom'] = d.kingdom;
      if (item.type) infoStats['Type'] = item.type;
      if (d.governor) infoStats['Governor'] = d.governor;
      if (d.notableCount != null) infoStats['Notables'] = String(d.notableCount);
      if (d.villageCount != null) infoStats['Villages'] = String(d.villageCount);
      if (d.villageProduces) infoStats['Village Produces'] = d.villageProduces;
      // Stat gauges rendered separately below
      item._settGauges = { prosperity: d.prosperity, loyalty: d.loyalty, security: d.security, food: d.foodStocks };
      item._settMilitary = { garrison: d.garrison, militia: d.militia };
      item._settEcon = { tradeTax: d.tradeTax, workshopCount: d.workshopCount, workshopNames: d.workshopNames };
    } else if (type === 'kingdoms') {
      if (item.culture) infoStats['Culture'] = item.culture;
      if (d.leader?.name) infoStats['Ruler'] = d.leader.name;
      if (d.clanCount != null) infoStats['Clans'] = String(d.clanCount);
      if (d.lords != null) infoStats['Lords'] = String(d.lords);
      if (d.towns != null) infoStats['Towns'] = String(d.towns);
      if (d.castles != null) infoStats['Castles'] = String(d.castles);
      if (d.villages != null) infoStats['Villages'] = String(d.villages);
      if (d.fiefCount != null) infoStats['Total Fiefs'] = String(d.fiefCount);
      if (d.strength != null) infoStats['Strength'] = d.strength >= 1000 ? (d.strength / 1000).toFixed(1) + 'K' : String(d.strength);
      if (d.garrisons != null) infoStats['Garrisons'] = d.garrisons >= 1000 ? (d.garrisons / 1000).toFixed(1) + 'K' : String(d.garrisons);
      if (d.influence != null) infoStats['Influence'] = d.influence >= 1000 ? (d.influence / 1000).toFixed(1) + 'K' : String(d.influence);
      if (d.wars?.length) infoStats['At War'] = d.wars.map(w => w.name).join(', ');
    } else if (type === 'clans') {
      if (d.tier != null) infoStats['Clan Tier'] = String(d.tier);
      if (d.strength) infoStats['Strength'] = String(d.strength);
      if (item.culture) infoStats['Culture'] = item.culture;
      if (item.kingdom) infoStats['Kingdom'] = item.kingdom;
      if (d.leader?.name) infoStats['Leader'] = d.leader.name;
      if (d.lords != null) infoStats['Lords'] = String(d.lords);
      if (d.companions != null) infoStats['Companions'] = String(d.companions);
      if (d.renown != null) infoStats['Renown'] = String(d.renown);
      if (d.influence != null) infoStats['Influence'] = String(d.influence);
      if (d.wealth != null) infoStats['Wealth'] = String(d.wealth);
      if (d.troops != null) infoStats['Troops'] = String(d.troops);
      if (d.garrisons != null) infoStats['Garrisons'] = String(d.garrisons);
      if (d.parties != null) infoStats['Parties'] = String(d.parties);
      if (d.towns != null) infoStats['Towns'] = String(d.towns);
      if (d.castles != null) infoStats['Castles'] = String(d.castles);
      if (d.villages != null) infoStats['Villages'] = String(d.villages);
      if (d.caravans != null) infoStats['Caravans'] = String(d.caravans);
      if (d.workshops != null) infoStats['Workshops'] = String(d.workshops);
      // Store for visual sections below
      item._clanGauges = { renown: d.renown, influence: d.influence, strength: d.strength, wealth: d.wealth };
      item._clanTerritory = { towns: d.towns, castles: d.castles, villages: d.villages };
      item._clanTier = d.tier;
    }
  }
  if (Object.keys(infoStats).length) {
    sections += `<div class="section"><h3>Info</h3><div class="stat-grid">${Object.entries(infoStats).map(([k, v]) =>
      `<div class="stat" data-tip-name="${esc(k)}" data-tip-val="${esc(String(v))}" data-tip-desc="${esc(statDescriptions[k] || '')}"><span class="k">${esc(k)}</span><span class="v">${esc(String(v))}</span></div>`).join('')}</div></div>`;
  }

  // Traits & Skills are rendered in the portrait rail area (see heroPortrait above)

  // ── Helper: render a linked entity list with banners ──
  function entityList(arr, targetType, emptyMsg) {
    if (!arr || !arr.length) return `<div class="empty">${emptyMsg}</div>`;
    return `<div class="entity-grid">${arr.map(e => {
      // Use hero portrait for heroes, settlement image for settlements, banner sigil for others
      let imgSrc, imgClass = 'entity-sigil';
      let imgExtraClass = '';
      if (targetType === 'heroes') {
        const h = (Store.heroes || []).find(x => x.id === e.id);
        imgSrc = h ? getPortraitSrc(h, h) : 'Hero/bannerlord_hero_viking.png';
        imgClass = 'entity-sigil entity-portrait';
        if (h && isGamePortrait(h)) imgExtraClass = ' game-portrait';
      } else if (targetType === 'settlements') {
        const st = (e.type || '').toLowerCase();
        if (st === 'castle') imgSrc = 'Settlement/Castle.png';
        else if (st === 'village') imgSrc = 'Settlement/Village.png';
        else imgSrc = 'Settlement/Town.png';
        imgClass = 'entity-sigil entity-settlement';
      } else if (e.id && Store._bannerImages?.[e.id]) {
        // Pre-rendered banner image from server
        imgSrc = `Banners/${encodeURIComponent(e.id)}.png`;
      } else {
        imgSrc = makeSigil(e.name || '', targetType, e.bannerCode || '', e.id);
      }
      return `<a class="entity-card${e.isDead ? ' family-dead' : ''}" onclick="openDetail('${targetType}','${esc(e.id)}');return false" href="#"
          ${e.bannerCode ? `data-banner="${esc(e.bannerCode)}"` : ''}>
        <div class="${imgClass}"><img class="${imgExtraClass}" src="${imgSrc}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'" ${imgExtraClass ? `style="${GP_STYLE}"` : ''}></div>
        <span class="entity-name">${esc(e.name || e.id)}</span>
        ${e.type ? `<span class="entity-type">${esc(e.type)}</span>` : ''}
        ${e.isDead ? '<span class="entity-dead">Deceased</span>' : ''}
      </a>`;
    }).join('')}</div>`;
  }

  // ── Lore section (shared by heroes, clans, kingdoms, settlements) ──
  function loreSection() {
    const loreFields = ['backstory', 'personality', 'goals', 'relationships', 'rumors'];
    const hasAnyLore = loreFields.some(f => lore[f]);
    let loreInner = '';
    if (hasAnyLore) {
      loreInner = loreFields.map(f => {
        const label = f.charAt(0).toUpperCase() + f.slice(1);
        return `<div class="lore-block"><h4>${esc(label)}</h4>${lore[f]
          ? `<div class="lore"><p>${textToHtml(lore[f])}</p></div>`
          : `<div class="empty empty-sm">Not written yet.</div>`}</div>`;
      }).join('');
    } else {
      loreInner = `<div class="empty">No lore written yet. <a href="#" onclick="editLore('${eid}');return false">Write lore</a>.</div>`;
    }
    return `<div class="section"><h3>Lore</h3>${loreInner}</div>`;
  }

  // Toggle expanded timeline (shows full scrollable list or collapses back to preview)
window.toggleTimelineExpand = function(btn) {
  const section = btn.closest('.section');
  if (!section) return;
  const extended = section.querySelector('.chronicle-extended');
  const limited = section.querySelector('.chronicle-limited');
  if (!extended) return;
  const isOpen = extended.style.display !== 'none';
  if (isOpen) {
    extended.style.display = 'none';
    if (limited) limited.style.display = '';
    btn.innerHTML = '\u{1F4DC} Show all ' + ((parseInt(btn.dataset.count) || 0) + (limited ? limited.children.length : 0)) + ' entries';
    btn.classList.remove('is-expanded');
  } else {
    extended.style.display = '';
    if (limited) limited.style.display = ''; // keep preview visible too
    btn.innerHTML = '\u{25B2} Show fewer';
    btn.classList.add('is-expanded');
  }
};

// ── Timeline section (shared) ──
  // Limits visible entries to TIMELINE_PREVIEW; rest hidden behind a "Show all" toggle
  // that expands into a scrollable inner list so the detail page never stretches unbounded.
  function timelineSection() {
    const TIMELINE_PREVIEW = 10;
    if (!timeline.length) {
      return `<div class="section"><h3>Timeline</h3><div class="empty">No timeline events recorded yet.</div></div>`;
    }
    // Newest first — timeline may come in any order, sort defensively
    const sorted = timeline.slice().reverse();
    const preview = sorted.slice(0, TIMELINE_PREVIEW);
    const rest = sorted.slice(TIMELINE_PREVIEW);
    const renderEntry = e =>
      `<div class="event"><div class="date">${esc(e.date || '')}</div><div class="text">${textToHtml(e.text)}</div></div>`;
    let html = `<div class="section"><h3>Timeline <span class="section-count">${timeline.length}</span></h3>`;
    html += `<div class="chronicle chronicle-limited">${preview.map(renderEntry).join('')}</div>`;
    if (rest.length > 0) {
      html += `<div class="chronicle chronicle-extended" style="display:none">${rest.map(renderEntry).join('')}</div>`;
      html += `<button class="chronicle-show-all" onclick="toggleTimelineExpand(this)" data-count="${rest.length}">\u{1F4DC} Show all ${timeline.length} entries</button>`;
    }
    html += '</div>';
    return html;
  }

  // ── Type-specific sections ──
  const d = item._detail || {};

  if (type === 'heroes') {
    // Hero sections: Lore, Relation Notes, Timeline, Enemies, Friends, Family
    sections += `<div class="section"><button class="btn btn-edit" onclick="openFamilyTree('${esc(id)}')">&#x1F333; View Family Tree</button></div>`;
    sections += loreSection();

    if (relationNotes.length) {
      sections += `<div class="section"><h3>Relation Notes <span class="section-count">${relationNotes.length}</span></h3><div class="relation-notes-grid">${relationNotes.map(rn => {
        const targetHero = (Store.heroes || []).find(x => x.id === rn.targetId);
        const portraitSrc = targetHero ? getPortraitSrc(targetHero, targetHero) : 'Hero/bannerlord_hero_viking.png';
        return `<div class="rn-card">
          <div class="rn-header">
            <a class="rn-portrait" onclick="openDetail('heroes','${esc(rn.targetId)}');return false" href="#">
              <img src="${portraitSrc}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'">
            </a>
            <div class="rn-meta">
              <a class="rn-target-name" onclick="openDetail('heroes','${esc(rn.targetId)}');return false" href="#">${esc(rn.targetName || rn.targetId)}</a>
              <button class="btn-note" onclick="editRelationNote('${esc(id)}','${esc(rn.targetId)}','${esc(rn.targetName || rn.targetId)}')" title="Edit note">&#x270E;</button>
            </div>
          </div>
          <div class="rn-text">${textToHtml(rn.note)}</div>
        </div>`;
      }).join('')}</div></div>`;
    } else {
      sections += `<div class="section"><h3>Relation Notes</h3><div class="empty">No relation notes written. Use the &#x270E; button on friend/enemy cards to add notes.</div></div>`;
    }

    sections += timelineSection();

    // Helper: get hero portrait for a relation entry
    function heroPortraitSrc(entry) {
      const h = (Store.heroes || []).find(x => x.id === entry.id);
      if (h) return getPortraitSrc(h, h);
      return 'Hero/bannerlord_hero_viking.png';
    }

    function relationGrid(arr, cls, prefix, isEnemy) {
      // Sort by relation intensity
      const sorted = [...arr].sort((a,b) => isEnemy ? (a.relation - b.relation) : (b.relation - a.relation));
      return `<div class="entity-grid">${sorted.map(e => {
        const intensity = Math.min(Math.abs(e.relation || 0) / 100, 1);
        const barColor = isEnemy ? `rgba(200,80,80,${0.3 + intensity * 0.5})` : `rgba(80,180,100,${0.3 + intensity * 0.5})`;
        return `<a class="entity-card ${cls}" onclick="openDetail('heroes','${esc(e.id)}');return false" href="#">
          <div class="entity-sigil entity-portrait"><img class="${gpClass(e)}" src="${heroPortraitSrc(e)}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'" ${isGamePortrait(e) ? `style="${GP_STYLE}"` : ''}></div>
          <span class="entity-name">${esc(e.name)}</span>
          <div class="relation-bar"><div class="relation-bar-fill" style="width:${intensity * 100}%;background:${barColor}"></div></div>
          <span class="relation-val">${prefix}${e.relation}</span>
          <button class="btn-note" onclick="event.preventDefault();event.stopPropagation();editRelationNote('${esc(id)}','${esc(e.id)}','${esc(e.name)}')" title="Write note">&#x270E;</button>
        </a>`;
      }).join('')}</div>`;
    }

    if (enemies.length) {
      sections += `<div class="section"><h3>Enemies <span class="section-count">${enemies.length}</span></h3>${relationGrid(enemies, 'relation-enemy', '', true)}</div>`;
    } else {
      sections += `<div class="section"><h3>Enemies</h3><div class="empty">No notable enemies.</div></div>`;
    }

    if (friends.length) {
      sections += `<div class="section"><h3>Friends <span class="section-count">${friends.length}</span></h3>${relationGrid(friends, 'relation-friend', '+', false)}</div>`;
    } else {
      sections += `<div class="section"><h3>Friends</h3><div class="empty">No notable friends.</div></div>`;
    }

    if (family.length) {
      const relIcons = { spouse:'&#x1F48D;', mother:'&#x1F469;', father:'&#x1F468;', sibling:'&#x1F46B;',
        brother:'&#x1F468;', sister:'&#x1F469;', child:'&#x1F476;', son:'&#x1F466;', daughter:'&#x1F467;',
        companion:'&#x2694;', 'step son':'&#x1F466;', 'step daughter':'&#x1F467;' };
      sections += `<div class="section"><h3>Family <span class="section-count">${family.length}</span></h3><div class="entity-grid">${family.map(f => {
        const relType = (f.relation || '').toLowerCase();
        const relIcon = relIcons[relType] || '&#x1F464;';
        return `<a class="entity-card family-card${f.dead ? ' family-dead' : ''}" onclick="openDetail('heroes','${esc(f.id)}');return false" href="#">
          <div class="entity-sigil entity-portrait"><img class="${gpClass(f)}" src="${heroPortraitSrc(f)}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'" ${isGamePortrait(f) ? `style="${GP_STYLE}"` : ''}></div>
          <span class="entity-name">${esc(f.name)}</span>
          <span class="family-rel"><span class="family-rel-icon">${relIcon}</span>${esc(f.relation)}</span>
          ${f.dead ? '<span class="entity-dead">Deceased</span>' : ''}
        </a>`;
      }).join('')}</div></div>`;
    } else {
      sections += `<div class="section"><h3>Family</h3><div class="empty">No known family members.</div></div>`;
    }

  } else if (type === 'settlements') {
    const sType = (item.type || '').toLowerCase();

    // "Part of" Kingdom panel (at top)
    if (d.kingdom) {
      const kObj = (Store.kingdoms || []).find(k => k.name === d.kingdom);
      const kId = kObj?.id || '';
      const kBanner = kId && Store._bannerImages?.[kId] ? `Banners/${encodeURIComponent(kId)}.png` : '';
      sections += `<div class="section part-of-panel" ${kId ? `onclick="openDetail('kingdoms','${esc(kId)}')" style="cursor:pointer"` : ''}>
        <div class="part-of-label">Part of</div>
        ${kBanner ? `<img class="part-of-banner" src="${kBanner}" alt="">` : ''}
        <div class="part-of-name">${esc(d.kingdom)}</div>
      </div>`;
    }

    // Stat Gauges (Towns/Castles only)
    if (sType !== 'village' && item._settGauges) {
      const g = item._settGauges;
      const gauges = [
        { label: 'Prosperity', val: g.prosperity || 0, max: 10000, color: '#4caf50', icon: '&#x1F4B0;' },
        { label: 'Loyalty', val: g.loyalty || 0, max: 100, color: '#2196f3', icon: '&#x2764;' },
        { label: 'Security', val: g.security || 0, max: 100, color: '#ff9800', icon: '&#x1F6E1;' },
        { label: 'Food', val: g.food || 0, max: 200, color: g.food >= 0 ? '#8bc34a' : '#ef5350', icon: '&#x1F35E;' }
      ];
      const fmtG = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(Math.round(v));
      sections += `<div class="section"><h3>Settlement Status</h3>
        <div class="sd-gauges">${gauges.map((ga, gi) => {
          const pct = Math.min(Math.max((ga.val / ga.max) * 100, 0), 100);
          const r = 38, circ = 2 * Math.PI * r;
          const dash = (pct / 100) * circ;
          return `<div class="sd-gauge" style="animation-delay:${gi * 0.12}s">
            <svg viewBox="0 0 88 88" class="sd-gauge-svg">
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="${ga.color}33" stroke-width="7"/>
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="${ga.color}" stroke-width="7"
                stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${circ * 0.25}"
                stroke-linecap="round" class="sd-gauge-fill" style="--dash:${dash};--circ:${circ}"/>
            </svg>
            <div class="sd-gauge-center">
              <span class="sd-gauge-icon">${ga.icon}</span>
              <span class="sd-gauge-val">${fmtG(ga.val)}</span>
            </div>
            <div class="sd-gauge-label">${ga.label}</div>
          </div>`;
        }).join('')}</div>
      </div>`;
    }

    // Military: Garrison vs Militia bar
    if (sType !== 'village' && item._settMilitary) {
      const m = item._settMilitary;
      const garr = m.garrison || 0;
      const mil = m.militia || 0;
      const total = garr + mil || 1;
      const garrPct = Math.round(garr / total * 100);
      const milPct = 100 - garrPct;
      sections += `<div class="section"><h3>Military Strength</h3>
        <div class="sd-military">
          <div class="sd-mil-row">
            <div class="sd-mil-side"><span class="sd-mil-icon">&#x1F6E1;</span><span class="sd-mil-label">Garrison</span><span class="sd-mil-val">${garr}</span></div>
            <div class="sd-mil-total">${garr + mil} total</div>
            <div class="sd-mil-side sd-mil-right"><span class="sd-mil-val">${mil}</span><span class="sd-mil-label">Militia</span><span class="sd-mil-icon">&#x2694;</span></div>
          </div>
          <div class="sd-mil-bar">
            <div class="sd-mil-fill-a" style="width:${garrPct}%"><span class="sd-mil-seg-pct">${garrPct}%</span></div>
            <div class="sd-mil-fill-b" style="width:${milPct}%"><span class="sd-mil-seg-pct">${milPct}%</span></div>
          </div>
        </div>
      </div>`;
    }

    // Recent events from chronicle for this settlement
    if (type === 'settlements') sections += renderSettlementRecentEvents(item);
    if (type === 'clans') sections += renderClanRecentEvents(item);
    if (type === 'kingdoms') sections += renderKingdomRecentEvents(item);

    sections += loreSection();
    sections += timelineSection();

    // Owner (all types) — hero portrait on left, clan banner on right
    if (d.owner && d.owner.name) {
      const ownerPortrait = getPortraitSrc(d.owner, d.owner);
      const ownerClanName = d.owner.clan || d.clan || item.owner || '';
      const ownerClan = ownerClanName ? (Store.clans || []).find(c => c.name === ownerClanName) : null;
      const ownerClanId = ownerClan ? ownerClan.id : '';
      const ownerBannerSrc = ownerClanId && Store._bannerImages?.[ownerClanId]
        ? `Banners/${encodeURIComponent(ownerClanId)}.png`
        : '';
      sections += `<div class="section"><h3>Owner</h3>
        <div class="owner-panel">
          <a class="owner-hero" onclick="openDetail('heroes','${esc(d.owner.id)}');return false" href="#">
            <img class="owner-portrait" src="${ownerPortrait}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'">
            <div class="owner-info">
              <span class="owner-name">${esc(d.owner.name)}</span>
              ${ownerClanName ? `<span class="owner-clan">${esc(ownerClanName)}</span>` : ''}
            </div>
          </a>
          ${ownerBannerSrc ? `<a class="owner-banner-link" onclick="openDetail('clans','${esc(ownerClanId)}');return false" href="#">
            <img class="owner-banner-img" src="${ownerBannerSrc}" alt="">
          </a>` : (d.owner.bannerCode ? `<div class="owner-banner"><canvas class="owner-banner-canvas" width="80" height="100"></canvas></div>` : '')}
        </div>
      </div>`;
    }

    // Economy: Workshop cards (Towns only)
    if (sType === 'town' && item._settEcon) {
      const e = item._settEcon;
      if (e.workshopCount > 0 && e.workshopNames) {
        const wsNames = e.workshopNames.split(', ').filter(Boolean);
        sections += `<div class="section"><h3>Workshops</h3>
          <div class="sd-workshops">${wsNames.map((ws, wi) => {
            const wsIcons = { 'Smithy':'&#x1F528;', 'Brewery':'&#x1F37A;', 'Pottery Shop':'&#x1FAD9;', 'Tannery':'&#x1F9F4;',
              'Wool Weavery':'&#x1F9F5;', 'Velvet Weavery':'&#x1F9F5;', 'Linen Weavery':'&#x1F9F5;', 'Wine Press':'&#x1F377;',
              'Olive Press':'&#x1FAD2;', 'Wood Workshop':'&#x1FAB5;', 'Silver smithy':'&#x1FA99;', 'Jeweler':'&#x1F48E;' };
            const icon = wsIcons[ws] || '&#x1F3ED;';
            return `<div class="sd-ws-card" style="animation-delay:${wi * 0.08}s">
              <span class="sd-ws-icon">${icon}</span>
              <span class="sd-ws-name">${ws}</span>
            </div>`;
          }).join('')}</div>
          ${e.tradeTax ? `<div class="sd-trade-tax">Trade Tax: <strong>${e.tradeTax.toLocaleString()} denars</strong></div>` : ''}
        </div>`;
      }
    }

    // Notable Characters (Towns and Villages only)
    if (sType !== 'castle') {
      sections += `<div class="section"><h3>Notable Characters</h3>${entityList(d.notables || [], 'heroes', 'No notable characters.')}</div>`;
    }

    // Bound Villages (Towns and Castles only)
    if (sType !== 'village' && d.villages && d.villages.length) {
      sections += `<div class="section"><h3>Bound Villages</h3>${entityList(d.villages, 'settlements', '')}</div>`;
    }

  } else if (type === 'kingdoms') {
    // Kingdom sections: Lore, Timeline, Leader, Clans, Fiefs, Wars
    sections += loreSection();
    sections += timelineSection();

    // Leader
    if (d.leader && d.leader.name) {
      sections += `<div class="section"><h3>Leader</h3>${entityList([d.leader], 'heroes', '')}</div>`;
    }

    // Clans
    sections += `<div class="section"><h3>Clans</h3>${entityList(d.clans || [], 'clans', 'No clans.')}</div>`;

    // Fiefs
    sections += `<div class="section"><h3>Fiefs</h3>${entityList(d.fiefs || [], 'settlements', 'No fiefs.')}</div>`;

    // Wars
    sections += `<div class="section"><h3>Wars</h3>${entityList(d.wars || [], 'kingdoms', 'At peace with all kingdoms.')}</div>`;

  } else if (type === 'clans') {
    const fmtG = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(Math.round(v || 0));

    // Tier badge
    if (item._clanTier != null && item._clanTier > 0) {
      const t = item._clanTier;
      const stars = '&#x2605;'.repeat(Math.min(t, 6));
      sections += `<div class="section cc-tier-section">
        <div class="cc-detail-tier">
          <span class="cc-detail-stars">${stars}</span>
          <span class="cc-detail-tier-label">Clan Tier ${t}</span>
        </div>
      </div>`;
    }

    // Clan Gauges — Renown, Influence, Strength, Wealth
    if (item._clanGauges) {
      const cg = item._clanGauges;
      const gauges = [
        { label: 'Renown', val: cg.renown || 0, max: 5000, color: '#d4a43a', icon: '&#x2B50;' },
        { label: 'Influence', val: cg.influence || 0, max: 2000, color: '#9c7dc9', icon: '&#x1F3DB;' },
        { label: 'Strength', val: cg.strength || 0, max: 5000, color: '#c0392b', icon: '&#x2694;' },
        { label: 'Wealth', val: cg.wealth || 0, max: 100000, color: '#f1c40f', icon: '&#x1F4B0;' }
      ];
      sections += `<div class="section"><h3>Clan Power</h3>
        <div class="sd-gauges">${gauges.map((ga, gi) => {
          const pct = Math.min(Math.max((ga.val / ga.max) * 100, 0), 100);
          const r = 38, circ = 2 * Math.PI * r;
          const dash = (pct / 100) * circ;
          return `<div class="sd-gauge" style="animation-delay:${gi * 0.12}s">
            <svg viewBox="0 0 88 88" class="sd-gauge-svg">
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="${ga.color}33" stroke-width="7"/>
              <circle cx="44" cy="44" r="${r}" fill="none" stroke="${ga.color}" stroke-width="7"
                stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${circ * 0.25}"
                stroke-linecap="round" class="sd-gauge-fill" style="--dash:${dash};--circ:${circ}"/>
            </svg>
            <div class="sd-gauge-center">
              <span class="sd-gauge-icon">${ga.icon}</span>
              <span class="sd-gauge-val">${fmtG(ga.val)}</span>
            </div>
            <div class="sd-gauge-label">${ga.label}</div>
          </div>`;
        }).join('')}</div>
      </div>`;
    }

    // Territory Summary
    if (item._clanTerritory) {
      const ct = item._clanTerritory;
      const totalFiefs = (ct.towns || 0) + (ct.castles || 0) + (ct.villages || 0);
      if (totalFiefs > 0) {
        sections += `<div class="section"><h3>Territory</h3>
          <div class="cc-territory">
            <div class="cc-terr-item"><span class="cc-terr-icon">&#x1F3DB;</span><span class="cc-terr-val">${ct.towns || 0}</span><span class="cc-terr-lbl">Towns</span></div>
            <div class="cc-terr-item"><span class="cc-terr-icon">&#x1F3F0;</span><span class="cc-terr-val">${ct.castles || 0}</span><span class="cc-terr-lbl">Castles</span></div>
            <div class="cc-terr-item"><span class="cc-terr-icon">&#x1F33E;</span><span class="cc-terr-val">${ct.villages || 0}</span><span class="cc-terr-lbl">Villages</span></div>
          </div>
        </div>`;
      }
    }

    // Leader panel with portrait
    if (d.leader?.id) {
      const leaderHero = (Store.heroes || []).find(h => h.id === d.leader.id);
      const leaderPortrait = leaderHero ? getPortraitSrc(leaderHero, leaderHero) : 'Hero/bannerlord_hero_viking.png';
      sections += `<div class="section"><h3>Leader</h3>
        <div class="clan-leader-panel">
          <a class="clan-leader-link" onclick="openDetail('heroes','${esc(d.leader.id)}');return false" href="#">
            <img class="clan-leader-portrait" src="${leaderPortrait}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'">
            <span class="clan-leader-name">${esc(d.leader.name)}</span>
          </a>
        </div>
      </div>`;
    }

    // Clan sections: Lore, Timeline, Members, Settlements, Wars
    sections += loreSection();
    sections += timelineSection();

    // Members
    sections += `<div class="section"><h3>Members</h3>${entityList(d.members || [], 'heroes', 'No known members.')}</div>`;

    // Settlements
    sections += `<div class="section"><h3>Settlements</h3>${entityList(d.settlements || [], 'settlements', 'No settlements held.')}</div>`;

    // Wars
    sections += `<div class="section"><h3>Wars</h3>${entityList(d.wars || [], 'kingdoms', 'At peace.')}</div>`;
  }

  // Journal entries — now shown in the sidebar rail panel

  // Settlement-specific cinematic banner with type image background
  const settBannerBg = type === 'settlements' ? (() => {
    const st = (item.type || '').toLowerCase();
    const img = st === 'castle' ? 'Settlement/Castle.png' : st === 'village' ? 'Settlement/Village.png' : 'Settlement/Town.png';
    const cColor = getCultureColor(item.culture);
    return `<div class="sett-detail-hero" style="--culture-color:${cColor}">
      <img class="sett-hero-img" src="${img}" alt="">
      <div class="sett-hero-overlay"></div>
    </div>`;
  })() : '';

  body.innerHTML = `
    <div class="detail-banner fade-in${type === 'settlements' ? ' sett-banner' : ''}">
      ${settBannerBg}
      ${hasBanner ? `<div id="bannerCanvas" class="detail-banner-icon"></div>` : ''}
      <div class="detail-banner-inner">
        <h2>${esc(item.name)}</h2>
        <p>${esc([item.culture, item.kingdom, item.clan, item.type].filter(Boolean).join(' \u00b7 '))}</p>
      </div>
      <div class="detail-live-badge" title="Auto-syncing with game every 8s"><span class="live-dot"></span> LIVE</div>
    </div>
    <div class="detail-content fade-in">
      ${sections}
    </div>`;
  // Animate detail counters (heroes / settlements / clans / kingdoms)
  setTimeout(() => animateCounters(body), 80);

  // Populate right rail with journal (non-heroes only)
  // Journal rail uses max-height + internal scroll so it never pushes the page height.
  if (type !== 'heroes' && rightRail) {
    if (detailLayout) detailLayout.classList.add('has-right-rail');
    const journalEntry = e =>
      `<div class="rail-journal-entry">
        <div class="rail-journal-date">${esc(e.date || 'Entry')}</div>
        <div class="rail-journal-text">${textToHtml(e.text)}</div>
      </div>`;
    rightRail.innerHTML = `
      <h4 class="rail-journal-title">Journal${journal.length ? ' <span class="rail-journal-count">' + journal.length + '</span>' : ''}</h4>
      <div class="rail-journal-list rail-journal-scroll" id="railJournalList">
        ${journal.length ? journal.slice().reverse().map(journalEntry).join('') : `<div class="rail-journal-empty">No journal entries yet. <a href="#" onclick="addJournal('${esc(id)}');return false">Add entry</a>.</div>`}
      </div>
      <button class="btn btn-edit" style="width:90%;margin:12px auto 0;display:block" onclick="addJournal('${esc(id)}')">Add Entry</button>`;
  }

  // Async render the banner icon into the top panel
  if (hasBanner && typeof renderBannerInto === 'function') {
    const bannerEl = document.getElementById('bannerCanvas');
    if (bannerEl) renderBannerInto(bannerEl, bannerCode, 64);
  }

  // Async render banners on entity cards (skip settlement cards — they use settlement images)
  if (typeof renderBannerCanvas === 'function') {
    body.querySelectorAll('.entity-card[data-banner]').forEach(el => {
      if (el.querySelector('.entity-settlement')) return; // Keep settlement images
      const code = el.getAttribute('data-banner');
      if (!code) return;
      const sigil = el.querySelector('.entity-sigil img');
      if (!sigil) return;
      renderBannerCanvas(code, 72).then(canvas => {
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          sigil.replaceWith(canvas);
        }
      });
    });
    // Render owner banner panel
    body.querySelectorAll('.owner-panel[data-banner]').forEach(el => {
      const code = el.getAttribute('data-banner');
      if (!code) return;
      const cvs = el.querySelector('.owner-banner-canvas');
      if (!cvs) return;
      renderBannerCanvas(code, 160).then(canvas => {
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          cvs.replaceWith(canvas);
        }
      });
    });
  }

  // Start live sync polling for this detail view
  if (!isSync) startDetailSync(type, id);

  } catch (err) {
    console.error('[Detail] Error rendering detail page:', err);
    body.innerHTML = `<div class="empty">Error loading detail: ${esc(err.message)}</div>`;
  }
}

// ── Edit modals ──
function openModal(title, bodyHtml, onSave) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalSave').onclick = onSave;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

async function uploadHeroPortrait(heroId, file) {
  if (!file) return;
  const result = await API.uploadPortrait(heroId, file);
  if (result?.ok) {
    toast('Portrait uploaded!');
    // Update cache and refresh the portrait image
    Store._customPortraits = Store._customPortraits || {};
    Store._customPortraits[heroId] = true;
    const img = document.getElementById('heroPortraitImg');
    if (img) img.src = `Potrais/${encodeURIComponent(heroId)}.png?t=${Date.now()}`;
  } else {
    toast('Portrait upload failed', 'error');
  }
}

async function editDescription(id) {
  const data = await API.getDescription(id);
  const current = data?.description || '';
  openModal('Edit Description', `
    <div class="modal-field">
      <label>Description</label>
      <textarea id="editDescText" rows="8" placeholder="Write a description...">${esc(current)}</textarea>
    </div>`,
    async () => {
      const text = document.getElementById('editDescText').value;
      const result = await API.setDescription(id, text);
      if (result?.ok) {
        toast('Description saved');
        closeModal();
        await refreshData();
        openDetail(Store.detailType || 'heroes', id);
      } else {
        toast('Failed to save', 'error');
      }
    }
  );
}

async function editTags(id, current) {
  openModal('Edit Tags', `
    <div class="modal-field">
      <label>Tags (comma-separated)</label>
      <input type="text" id="editTagsText" value="${esc(current)}" placeholder="warrior, noble, ally...">
    </div>
    <div class="modal-field" id="tagSuggestions"></div>`,
    async () => {
      const tags = document.getElementById('editTagsText').value;
      const result = await API.setEntityTags(id, tags);
      if (result?.ok) {
        toast('Tags saved');
        closeModal();
        openDetail(Store.detailType || 'heroes', id);
      } else {
        toast('Failed to save tags', 'error');
      }
    }
  );
  // Load tag suggestions
  const unique = await API.getUniqueTags();
  if (unique && unique.length) {
    document.getElementById('tagSuggestions').innerHTML = '<label>Suggestions</label><div class="tag-suggestions">' +
      unique.slice(0, 20).map(t => `<span class="badge" style="cursor:pointer" onclick="document.getElementById('editTagsText').value += ', ${esc(t)}'">${esc(t)}</span>`).join(' ') + '</div>';
  }
}

async function addJournal(id) {
  openModal('Add Journal Entry', `
    <div class="modal-field">
      <label>Entry text</label>
      <textarea id="journalText" rows="4" placeholder="What happened..."></textarea>
    </div>`,
    async () => {
      const text = document.getElementById('journalText').value;
      if (!text.trim()) { toast('Entry cannot be empty', 'error'); return; }
      const result = await API.addJournalEntry(id, text);
      if (result?.ok) {
        toast('Journal entry added');
        closeModal();
        openDetail(Store.detailType || 'heroes', id);
      } else {
        toast('Failed to add entry', 'error');
      }
    }
  );
}

async function editLore(heroId) {
  const lore = await API.getHeroLore(heroId);
  const fields = ['backstory', 'personality', 'goals', 'relationships', 'rumors'];
  openModal('Edit Lore Fields', fields.map(f => `
    <div class="modal-field">
      <label>${esc(f.charAt(0).toUpperCase() + f.slice(1))}</label>
      <textarea id="lore-${f}" rows="4" placeholder="${esc(f)}...">${esc(lore?.[f] || '')}</textarea>
    </div>`).join(''),
    async () => {
      let ok = true;
      for (const f of fields) {
        const text = document.getElementById(`lore-${f}`).value;
        if (text || lore?.[f]) {
          const result = await API.setLoreField(heroId, f, text || null);
          if (!result?.ok) ok = false;
        }
      }
      if (ok) {
        toast('Lore saved');
        closeModal();
        openDetail('heroes', heroId);
      } else {
        toast('Some fields failed to save', 'error');
      }
    }
  );
}

// ── Edit Name & Title ──
async function editName(id, entityType) {
  const data = await API.getEntityName(id);
  const curName = data?.name || '';
  const curTitle = data?.title || '';
  const showTitle = entityType === 'heroes';
  openModal('Edit Name' + (showTitle ? ' & Title' : ''), `
    <div class="modal-field">
      <label>Name</label>
      <input type="text" id="editNameInput" value="${esc(curName)}" placeholder="Enter name...">
    </div>
    ${showTitle ? `<div class="modal-field">
      <label>Title</label>
      <input type="text" id="editTitleInput" value="${esc(curTitle)}" placeholder="Enter title...">
    </div>` : ''}`,
    async () => {
      const name = document.getElementById('editNameInput').value;
      const title = showTitle ? document.getElementById('editTitleInput')?.value : undefined;
      const result = await API.setEntityName(id, name, title);
      if (result?.ok) {
        toast('Name saved');
        closeModal();
        await refreshData();
        openDetail(entityType, id);
      } else {
        toast('Failed to save name', 'error');
      }
    }
  );
}

// ── Edit Culture (Heroes only) ──
async function editCulture(heroId) {
  const data = await API.getHeroCulture(heroId);
  const current = data?.culture || '';
  const cultures = [...new Set((Store.heroes || []).map(h => h.culture).filter(Boolean))].sort();
  openModal('Change Culture', `
    <div class="modal-field">
      <label>Culture</label>
      <select id="editCultureSelect">
        <option value="">— Select Culture —</option>
        ${cultures.map(c => `<option value="${esc(c)}" ${c === current ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-field">
      <label>Or type custom</label>
      <input type="text" id="editCultureCustom" value="" placeholder="Custom culture name...">
    </div>`,
    async () => {
      const selected = document.getElementById('editCultureSelect').value;
      const custom = document.getElementById('editCultureCustom').value.trim();
      const culture = custom || selected;
      if (!culture) { toast('Select or type a culture', 'error'); return; }
      const result = await API.setHeroCulture(heroId, culture);
      if (result?.ok) {
        toast('Culture changed');
        closeModal();
        await refreshData();
        openDetail('heroes', heroId);
      } else {
        toast('Failed to change culture', 'error');
      }
    }
  );
}

// ── Edit Occupation (Heroes only) ──
async function editOccupation(heroId) {
  const data = await API.getHeroOccupation(heroId);
  const currentOcc = data?.occupation ?? -1;
  const currentName = data?.name || '';
  const occupations = [
    { val: 0, name: 'NotAssigned' },
    { val: 2, name: 'Wanderer' },
    { val: 4, name: 'Merchant' },
    { val: 6, name: 'Townsfolk' },
    { val: 7, name: 'Villager' },
    { val: 9, name: 'Bandit' },
    { val: 16, name: 'Lord' },
    { val: 21, name: 'GangLeader' },
    { val: 24, name: 'Artisan' },
    { val: 25, name: 'Preacher' },
    { val: 26, name: 'Headman' },
    { val: 27, name: 'RuralNotable' },
  ];
  openModal('Change Occupation', `
    <div class="modal-field">
      <label>Current: <strong>${esc(currentName || 'None')}</strong></label>
      <select id="editOccSelect">
        <option value="-1">— No Change —</option>
        ${occupations.map(o => `<option value="${o.val}" ${o.val === currentOcc ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>
    </div>`,
    async () => {
      const val = parseInt(document.getElementById('editOccSelect').value, 10);
      if (val < 0) { closeModal(); return; }
      const result = await API.setHeroOccupation(heroId, val);
      if (result?.ok) {
        toast('Occupation changed');
        closeModal();
        await refreshData();
        openDetail('heroes', heroId);
      } else {
        toast('Failed to change occupation', 'error');
      }
    }
  );
}

// ── Edit Banner (Clans, Kingdoms, Settlements) ──
async function editBanner(id, entityType) {
  const data = await API.getEntityBanner(id);
  const current = data?.banner || '';
  openModal('Edit Banner Code', `
    <div class="modal-field">
      <label>Banner Code</label>
      <textarea id="editBannerCode" rows="3" placeholder="Paste banner code...">${esc(current)}</textarea>
    </div>
    <div class="modal-hint">Paste a Bannerlord banner code string. You can generate these using the in-game banner editor or online tools.</div>`,
    async () => {
      const banner = document.getElementById('editBannerCode').value.trim();
      const result = await API.setEntityBanner(id, banner);
      if (result?.ok) {
        toast('Banner saved');
        closeModal();
        await refreshData();
        openDetail(entityType, id);
      } else {
        toast('Failed to save banner', 'error');
      }
    }
  );
}

// ── Edit Relation Note (Hero → Target) ──
async function editRelationNote(heroId, targetId, targetName) {
  const data = await API.getRelationNote(heroId, targetId);
  const current = data?.note || '';
  openModal('Relation Note — ' + (targetName || targetId), `
    <div class="modal-field">
      <label>Note about this relationship</label>
      <textarea id="editRelNoteText" rows="4" placeholder="Write about this relationship...">${esc(current)}</textarea>
    </div>`,
    async () => {
      const note = document.getElementById('editRelNoteText').value;
      const result = await API.setRelationNote(heroId, targetId, note);
      if (result?.ok) {
        toast('Relation note saved');
        closeModal();
        openDetail('heroes', heroId);
      } else {
        toast('Failed to save note', 'error');
      }
    }
  );
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Chronicle page ──
// Track known chronicle events to detect new ones
let _lastChronicleCount = 0;

async function incrementalChronicleUpdate(containerId) {
  try {
    const chronicle = await API.getAllChronicle();
    if (!chronicle || chronicle.length <= _lastChronicleCount) return;

    const newEvents = chronicle.slice(0, chronicle.length - _lastChronicleCount);
    _lastChronicleCount = chronicle.length;
    if (newEvents.length === 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const getEventMeta = (txt) => {
      const t = (txt || '').toLowerCase();
      if (t.includes('battle') || t.includes('attack') || t.includes('[war]') || t.includes('fought'))
        return { icon: '&#x2694;', tag: 'war', color: '#c05050', label: 'War' };
      if (t.includes('died') || t.includes('killed') || t.includes('death') || t.includes('slain'))
        return { icon: '&#x2620;', tag: 'death', color: '#a15b5b', label: 'Death' };
      if (t.includes('siege') || t.includes('raided'))
        return { icon: '&#x1F3F0;', tag: 'siege', color: '#a08e6a', label: 'Siege' };
      if (t.includes('married') || t.includes('birth') || t.includes('[family]') || t.includes('child'))
        return { icon: '&#x2764;', tag: 'family', color: '#d8a0b0', label: 'Family' };
      if (t.includes('king') || t.includes('ruler') || t.includes('[politics]') || t.includes('defect'))
        return { icon: '&#x265A;', tag: 'politics', color: '#6d8cb1', label: 'Politics' };
      if (t.includes('prisoner') || t.includes('captured') || t.includes('ransom'))
        return { icon: '&#x26D3;', tag: 'crime', color: '#c07040', label: 'Crime' };
      if (t.includes('peace') || t.includes('truce') || t.includes('alliance'))
        return { icon: '&#x2696;', tag: 'diplomacy', color: '#5b8f69', label: 'Diplomacy' };
      return { icon: '&#x2726;', tag: 'other', color: '#8a7858', label: 'Event' };
    };

    // Build HTML for new events
    newEvents.forEach(e => {
      const meta = getEventMeta(e.text);
      const div = document.createElement('div');
      div.className = `event chr-new-event`;
      div.dataset.tag = meta.tag;
      div.style.cssText = `--evt-color:${meta.color}`;
      div.innerHTML = `
        <div class="event-icon" style="border-color:${meta.color};color:${meta.color};box-shadow:0 0 10px ${meta.color}30">${meta.icon}</div>
        <div class="event-card">
          <div class="event-header">
            <span class="event-tag" style="background:${meta.color}15;color:${meta.color};border-color:${meta.color}30">${meta.label}</span>
            <span class="event-date">${esc(e.date || '')}</span>
          </div>
          <div class="text">${textToHtml(e.text)}</div>
        </div>`;

      // Find the chronicle div or first child to prepend to
      const chronicleDiv = container.querySelector('.chronicle') || container;
      const firstDateHeader = chronicleDiv.querySelector('.chr-date-header');
      if (firstDateHeader) {
        chronicleDiv.insertBefore(div, firstDateHeader.nextSibling);
      } else {
        chronicleDiv.prepend(div);
      }
    });

    // Update count display
    setEl('chronicle-total', chronicle.length);
  } catch (e) { /* silent */ }
}

// ══════════════════════════════════════════════════════════════
//  COMMANDER — Main Hero Command Center
// ══════════════════════════════════════════════════════════════

let _cmdTab = 'character';
let _cmdData = null;

async function renderCommander() {
  const banner = document.getElementById('cmdBanner');
  const stats = document.getElementById('cmdStats');
  const content = document.getElementById('cmdTabContent');
  if (!banner || !stats || !content) return;

  banner.innerHTML = '<div class="loading-spinner"></div>';
  const overview = await API.getPlayerOverview();
  if (!overview || overview.error) {
    banner.innerHTML = '<div class="empty">No campaign loaded. Start or load a game first.</div>';
    stats.innerHTML = '';
    content.innerHTML = '';
    return;
  }
  _cmdData = overview;
  const h = overview.hero;
  const p = overview.party;
  const c = overview.clan;
  const k = overview.kingdom;

  // Find hero in Store for portrait
  const heroItem = (Store.heroes || []).find(x => x.id === h.id || x.isPlayer);
  const portraitSrc = heroItem ? getPortraitSrc(heroItem, heroItem) : 'Hero/bannerlord_hero_viking.png';
  const bannerSrc = h.bannerCode && Store._bannerImages?.[c?.id] ? `Banners/${encodeURIComponent(c.id)}.png` : '';

  // Banner
  banner.innerHTML = `
    <div class="cmd-banner-bg"></div>
    <div class="cmd-banner-inner">
      <div class="cmd-portrait" onclick="openDetail('heroes','${esc(h.id)}')" style="cursor:pointer" title="View hero detail">
        <img src="${portraitSrc}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'" class="${heroItem && isGamePortrait(heroItem) ? 'game-portrait' : ''}" ${heroItem && isGamePortrait(heroItem) ? `style="${GP_STYLE}"` : ''}>
      </div>
      <div class="cmd-hero-info">
        <h1 class="cmd-hero-name">${esc(h.customName || h.name)}</h1>
        <p class="cmd-hero-title">${esc(h.customTitle || h.title || '')}</p>
        <div class="cmd-hero-meta">
          <span class="cmd-meta-badge">${esc(h.culture)}</span>
          <span class="cmd-meta-badge">Age ${h.age}</span>
          <span class="cmd-meta-badge">Level ${h.level}</span>
          ${c ? `<span class="cmd-meta-badge">${esc(c.name)} (Tier ${c.tier})</span>` : ''}
          ${k?.name && k.name !== 'None' ? `<span class="cmd-meta-badge cmd-kingdom">${esc(k.name)}</span>` : ''}
        </div>
      </div>
      ${bannerSrc ? `<img class="cmd-clan-banner" src="${bannerSrc}" alt="">` : ''}
    </div>`;

  // Stats bar
  const fmtK = v => v >= 1000 ? (v/1000).toFixed(1)+'K' : v;
  stats.innerHTML = `
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#e8c848">&#x25C9;</span><span class="cmd-stat-val">${fmtK(h.gold)}</span><span class="cmd-stat-label">Gold</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#80a0d0">&#x2726;</span><span class="cmd-stat-val">${fmtK(c?.influence || 0)}</span><span class="cmd-stat-label">Influence</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#e08080">&#x2665;</span><span class="cmd-stat-val">${h.hp}/${h.maxHp}</span><span class="cmd-stat-label">Health</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#a0c8a0">&#x2694;</span><span class="cmd-stat-val">${p.troops}/${p.troopLimit}</span><span class="cmd-stat-label">Troops</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#c8b080">&#x263A;</span><span class="cmd-stat-val">${p.morale}</span><span class="cmd-stat-label">Morale</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#d0b060">&#x25B2;</span><span class="cmd-stat-val">${p.speed}</span><span class="cmd-stat-label">Speed</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#90b890">&#x2637;</span><span class="cmd-stat-val">${p.food} (${p.foodChange >= 0 ? '+' : ''}${p.foodChange})</span><span class="cmd-stat-label">Food</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#c8a0a0">&#x2694;</span><span class="cmd-stat-val">${p.prisoners}</span><span class="cmd-stat-label">Prisoners</span></div>
    <div class="cmd-stat"><span class="cmd-stat-icon" style="color:#c09040">&#x2B24;</span><span class="cmd-stat-val">${p.dailyWage}</span><span class="cmd-stat-label">Daily Wage</span></div>
  `;

  // Player title ribbon — auto-generated based on standing
  const titleEl = banner.querySelector('.cmd-hero-info');
  if (titleEl) {
    const title = generatePlayerTitle(h, c, k);
    if (title) titleEl.insertAdjacentHTML('beforeend', `<div class="cmd-title-ribbon">${esc(title)}</div>`);
  }

  // Render new commander widgets
  renderCmdQuickActions(overview);
  renderCmdBattleStats(h);
  renderCmdReputationWheel(h);
  renderCmdDaysAlive(h);
  updateCmdTabBadges(overview);

  // Animate stats numbers
  setTimeout(() => animateCmdStats(), 50);

  // Set up tab clicks
  document.querySelectorAll('.cmd-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.cmd-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _cmdTab = tab.dataset.tab;
      renderCmdTab(_cmdTab);
    };
  });

  renderCmdTab(_cmdTab);
}

// ── Commander widget helpers ──
function generatePlayerTitle(hero, clan, kingdom) {
  const renown = Number(hero?.renown || 0);
  const fiefs = Number(clan?.fiefs || 0);
  const tier = Number(clan?.tier || 0);
  if (kingdom?.name && kingdom.name !== 'None' && tier >= 5) return `Marshal of ${kingdom.name}`;
  if (fiefs >= 5) return `Lord of ${fiefs} Fiefs`;
  if (fiefs >= 1) return `Holder of ${fiefs} ${fiefs > 1 ? 'Fiefs' : 'Fief'}`;
  if (renown >= 2000) return 'Renowned Champion';
  if (renown >= 1000) return 'Tournament Veteran';
  if (renown >= 500) return 'Notable Warrior';
  if (tier >= 3) return `Clan Tier ${tier} Lord`;
  return 'Adventurer of Calradia';
}

function renderCmdQuickActions(overview) {
  const el = document.getElementById('cmdQuickActions');
  if (!el) return;
  const actions = [
    { icon:'\u{1F5FA}', label:'Travel', color:'#7ac070', click:"showPage('map')" },
    { icon:'\u{2694}', label:'Recruit', color:'#c08060', click:"_cmdTab='party';renderCmdTab('party');document.querySelectorAll('.cmd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='party'));showToast('Switched to Party tab')" },
    { icon:'\u{1F392}', label:'Inventory', color:'#d4b878', click:"_cmdTab='inventory';renderCmdTab('inventory');document.querySelectorAll('.cmd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='inventory'))" },
    { icon:'\u{1F451}', label:'Kingdom', color:'#80a0d0', click:"_cmdTab='kingdom';renderCmdTab('kingdom');document.querySelectorAll('.cmd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='kingdom'))" },
    { icon:'\u{1F4DC}', label:'Quests', color:'#e8c848', click:"_cmdTab='quests';renderCmdTab('quests');document.querySelectorAll('.cmd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='quests'))" },
    { icon:'\u{2696}', label:'Compare', color:'#c08070', click:"openHeroCompare()" },
    { icon:'\u{1F4B0}', label:'Trade', color:'#f5d878', click:"showTradeRoutes&&showTradeRoutes()" },
    { icon:'\u{1F504}', label:'Refresh', color:'#9ac0d0', click:"renderCommander()" },
  ];
  el.innerHTML = actions.map(a => `
    <div class="cqa-btn" style="--cqa-accent:${a.color}" onclick="${a.click}">
      <span class="cqa-icon" style="color:${a.color}">${a.icon}</span>
      <span>${a.label}</span>
    </div>`).join('');
}

function renderCmdBattleStats(hero) {
  const el = document.getElementById('cmdBattleStats');
  if (!el) return;
  // Try parse from hero object first; fallback to API
  let bs = hero?.battleStats || hero?.stats?.Battles || null;
  if (typeof bs === 'string') {
    // Format: "W:N|L:N|C:N|HK:N|TK:N|T:N"
    const m = {};
    bs.split('|').forEach(p => {
      const [k, v] = p.split(':');
      m[k] = Number(v) || 0;
    });
    bs = { wins:m.W||0, losses:m.L||0, casualties:m.C||0, heroKills:m.HK||0, totalKills:m.TK||0, tournaments:m.T||0 };
  }
  if (!bs) bs = { wins:0, losses:0, totalKills:0, tournaments:0 };
  el.innerHTML = `<h3>\u{2694} Battle Record</h3>
    <div class="cbs-grid">
      <div class="cbs-stat green"><span class="cbs-stat-val">${(bs.wins||0).toLocaleString()}</span><span class="cbs-stat-lbl">Victories</span></div>
      <div class="cbs-stat red"><span class="cbs-stat-val">${(bs.losses||0).toLocaleString()}</span><span class="cbs-stat-lbl">Defeats</span></div>
      <div class="cbs-stat"><span class="cbs-stat-val">${(bs.totalKills||bs.heroKills||0).toLocaleString()}</span><span class="cbs-stat-lbl">Total Kills</span></div>
      <div class="cbs-stat"><span class="cbs-stat-val">${(bs.tournaments||0).toLocaleString()}</span><span class="cbs-stat-lbl">Tournaments</span></div>
    </div>`;
}

function renderCmdReputationWheel(hero) {
  const el = document.getElementById('cmdRepWheel');
  if (!el) return;
  const relations = hero?.relations || hero?.relationships || [];
  if (!relations.length) {
    el.innerHTML = '<h3>\u{1F91D} Reputation</h3><div class="crw-empty">No notable relations yet.<br>Build alliances and rivalries by interacting with other heroes.</div>';
    return;
  }
  // Top 8 by absolute value
  const top = relations.slice().sort((a,b)=>Math.abs(Number(b.value)||0)-Math.abs(Number(a.value)||0)).slice(0,8);
  // Donut: positive in green-yellow, negative in red
  const cx=65, cy=65, r=50, ir=30;
  let acc = 0;
  const total = top.reduce((s,x)=>s+Math.abs(Number(x.value)||1), 0) || 1;
  let svg = `<svg viewBox="0 0 130 130">`;
  top.forEach(rel => {
    const v = Math.abs(Number(rel.value) || 1);
    const a0 = (acc/total)*Math.PI*2 - Math.PI/2;
    const a1 = ((acc+v)/total)*Math.PI*2 - Math.PI/2;
    acc += v;
    const large = (a1-a0) > Math.PI ? 1 : 0;
    const x0 = cx+r*Math.cos(a0), y0 = cy+r*Math.sin(a0);
    const x1 = cx+r*Math.cos(a1), y1 = cy+r*Math.sin(a1);
    const xi0 = cx+ir*Math.cos(a0), yi0 = cy+ir*Math.sin(a0);
    const xi1 = cx+ir*Math.cos(a1), yi1 = cy+ir*Math.sin(a1);
    const val = Number(rel.value)||0;
    const color = val > 30 ? '#7ac070' : val > 0 ? '#d8b35f' : val > -30 ? '#c08060' : '#a15b5b';
    svg += `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${ir} ${ir} 0 ${large} 0 ${xi0} ${yi0} Z" fill="${color}" stroke="#0c0a06" stroke-width="1.2" opacity=".92"/>`;
  });
  svg += '</svg>';
  let list = '<div class="crw-list">';
  top.forEach(rel => {
    const val = Number(rel.value)||0;
    const color = val > 30 ? '#7ac070' : val > 0 ? '#d8b35f' : val > -30 ? '#c08060' : '#a15b5b';
    list += `<div class="crw-row"><div class="crw-swatch" style="background:${color}"></div><span>${esc(rel.name||rel.targetName||'?')}</span><span class="crw-num" style="color:${color}">${val>0?'+':''}${val}</span></div>`;
  });
  list += '</div>';
  el.innerHTML = `<h3>\u{1F91D} Reputation</h3><div class="crw-wheel">${svg}${list}</div>`;
}

function renderCmdDaysAlive(hero) {
  const el = document.getElementById('cmdDaysAlive');
  if (!el) return;
  const age = Number(hero?.age || 0);
  const days = Math.round(age * 84); // Bannerlord: 84 days/year
  const status = Store.status || {};
  const lvl = Number(hero?.level || 0);
  const xp = Number(hero?.xp || 0);
  el.innerHTML = `<h3>\u{1F4C5} Lifespan</h3>
    <div class="cda-big">${days.toLocaleString()}</div>
    <div class="cda-lbl">Days Alive</div>
    <div class="cda-row">
      <div><b>${age}</b>Age</div>
      <div><b>${lvl}</b>Level</div>
      <div><b>${xp.toLocaleString()}</b>XP</div>
    </div>`;
}

function updateCmdTabBadges(overview) {
  const quests = overview?.quests || overview?.activeQuests;
  const qBadge = document.getElementById('badge-quests');
  if (qBadge) {
    const count = Array.isArray(quests) ? quests.length : 0;
    if (count > 0) { qBadge.textContent = count; qBadge.style.display = 'inline-block'; }
    else qBadge.style.display = 'none';
  }
}

function animateCmdStats() {
  document.querySelectorAll('.cmd-stat-val').forEach(el => {
    if (el._counted) return;
    const txt = el.textContent;
    const m = txt.match(/^(\d+(?:\.\d+)?)([KM]?)/);
    if (!m) return;
    const target = parseFloat(m[1]);
    if (isNaN(target) || target <= 0) return;
    el._counted = true;
    const suffix = txt.slice(m[0].length);
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const p = Math.min((now-start)/dur, 1);
      const ease = 1 - Math.pow(1-p, 3);
      const cur = (target * ease).toFixed(target < 10 && !Number.isInteger(target) ? 1 : 0);
      el.textContent = cur + m[2] + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function renderCmdTab(tab) {
  const el = document.getElementById('cmdTabContent');
  if (!el) return;
  // Fade-in animation: reset and re-trigger
  el.classList.remove('cmd-tab-fade-in');
  void el.offsetWidth;
  el.classList.add('cmd-tab-fade-in');
  el.innerHTML = '<div class="loading-spinner"></div>';

  switch (tab) {
    case 'character': return renderCmdCharacter(el);
    case 'inventory': return renderCmdInventory(el);
    case 'party': return renderCmdParty(el);
    case 'quests': return renderCmdQuests(el);
    case 'clan': return renderCmdClan(el);
    case 'kingdom': return renderCmdKingdom(el);
    case 'chronicle': return renderCmdChronicle(el);
  }
}

// ── Character Tab ──
// Track selected hero for character tab
let _charHeroId = '';
let _selectedSkillId = '', _selectedSkillName = '', _selectedSkillVal = 0;

async function renderCmdCharacter(el) {
  const [clanData, data, equipData] = await Promise.all([
    API.getPlayerClan(),
    API.getPlayerCharacter(_charHeroId || undefined),
    API.getPlayerEquipment().catch(() => null)
  ]);
  if (!data || data.error) { el.innerHTML = '<div class="empty">Character data unavailable.</div>'; return; }

  const attrShort = {Vigor:'VIG',Control:'CTR',Endurance:'END',Cunning:'CNG',Social:'SOC',Intelligence:'INT',Naval:'NAV'};
  const skillAttrMap = {
    'One Handed':'Vigor','Two Handed':'Vigor','Polearm':'Vigor',
    'Bow':'Control','Crossbow':'Control','Throwing':'Control',
    'Riding':'Endurance','Athletics':'Endurance','Smithing':'Endurance',
    'Scouting':'Cunning','Tactics':'Cunning','Roguery':'Cunning',
    'Charm':'Social','Leadership':'Social','Trade':'Social',
    'Steward':'Intelligence','Medicine':'Intelligence','Engineering':'Intelligence',
    'Mariner':'Naval','Boatswain':'Naval','Shipmaster':'Naval'
  };
  const skillOrder = ['One Handed','Two Handed','Polearm','Bow','Crossbow','Throwing',
    'Riding','Athletics','Smithing','Tactics','Scouting','Roguery',
    'Charm','Trade','Leadership','Steward','Medicine','Engineering',
    'Mariner','Boatswain','Shipmaster'];
  const skillsByAttr = {};
  if (data.skills) {
    for (const s of data.skills) {
      const attr = s.attribute || skillAttrMap[s.name] || 'Other';
      if (!skillsByAttr[attr]) skillsByAttr[attr] = [];
      skillsByAttr[attr].push(s);
    }
    for (const attr in skillsByAttr) {
      skillsByAttr[attr].sort((a, b) => {
        const ia = skillOrder.indexOf(a.name), ib = skillOrder.indexOf(b.name);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    }
  }

  const skillImg = name => {
    const m = {'One Handed':'onehanded','Two Handed':'twohanded','Polearm':'polearm',
      'Bow':'bow','Crossbow':'crossbow','Throwing':'throwing',
      'Riding':'riding','Athletics':'athletics','Smithing':'crafting',
      'Scouting':'scouting','Tactics':'tactics','Roguery':'roguery',
      'Charm':'charm','Leadership':'leadership','Trade':'trade',
      'Steward':'steward','Medicine':'medicine','Engineering':'engineering'};
    if (m[name]) return 'Skills/gui_skills_icon_' + m[name] + '.png';
    const n2 = {'Mariner':'mariner_skill','Boatswain':'boatswain_skill','Shipmaster':'shipmaster_skill'};
    if (n2[name]) return 'Skills/' + n2[name] + '.png';
    return '';
  };

  const focusPips = (n, skillId, canAdd) => {
    let h = '<span class="cc-focus-row">';
    for (let i = 0; i < 5; i++) h += `<span class="cc-pip${i < n ? ' cc-pip-filled' : ''}"></span>`;
    if (canAdd && n < 5) h += `<span class="cc-focus-plus" onclick="event.stopPropagation();cmdAddFocus('${esc(skillId)}')" title="+1 Focus">+</span>`;
    return h + '</span>';
  };

  let html = '';

  // ── Character title ribbon + level-up banner (top) ──
  const lvl = Number(data.level) || 1;
  const xpCur = Number(data.currentXp || data.levelXp || 0);
  const xpNext = Number(data.nextLevelXp || (lvl + 1) * 1000);
  const xpPct = xpNext > 0 ? Math.min(100, Math.max(0, (xpCur / xpNext) * 100)) : 0;
  const unspentAttr = Number(data.unspentAttrPoints || 0);
  const unspentFocus = Number(data.unspentFocusPoints || 0);
  const hasPoints = unspentAttr > 0 || unspentFocus > 0;

  // Auto-honorific
  const _allSkillsPre = data.skills || [];
  const _combatPre = _allSkillsPre.filter(s => ['One Handed','Two Handed','Polearm','Bow','Crossbow','Throwing','Riding','Athletics'].includes(s.name)).reduce((s,sk)=>s+sk.value,0);
  const _leaderPre = _allSkillsPre.filter(s => ['Charm','Leadership','Steward','Trade'].includes(s.name)).reduce((s,sk)=>s+sk.value,0);
  let honor = 'Adventurer of Calradia';
  if (lvl >= 30) honor = 'Legendary Champion';
  else if (lvl >= 25) honor = 'Master of Arms';
  else if (lvl >= 20) honor = 'Seasoned Veteran';
  else if (lvl >= 15) honor = 'Notable Warrior';
  else if (_combatPre >= 1200) honor = 'Battle Master';
  else if (_leaderPre >= 700) honor = 'Noble Leader';
  else if (lvl >= 10) honor = 'Rising Hero';
  else if (lvl >= 5) honor = 'Squire of the Realm';

  html += `<div class="char-top-header">
    <div class="char-title-ribbon">${esc(honor)}</div>
    ${hasPoints ? `<div class="char-levelup-banner">
      <span class="char-levelup-icon">\u{2728}</span>
      <span class="char-levelup-text">Unspent Points Available</span>
      ${unspentAttr > 0 ? `<span class="char-levelup-chip">${unspentAttr} Attribute</span>` : ''}
      ${unspentFocus > 0 ? `<span class="char-levelup-chip">${unspentFocus} Focus</span>` : ''}
    </div>` : ''}
  </div>`;

  // XP progress ring (SVG)
  const ringR = 32, ringCirc = 2 * Math.PI * ringR;
  const ringDash = (xpPct / 100) * ringCirc;
  html += `<div class="char-progress-row">
    <div class="char-xp-ring">
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="${ringR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="5"/>
        <circle cx="40" cy="40" r="${ringR}" fill="none" stroke="url(#charXpGrad)" stroke-width="5"
          stroke-dasharray="${ringDash} ${ringCirc - ringDash}" stroke-dashoffset="0"
          stroke-linecap="round" transform="rotate(-90 40 40)"
          style="filter:drop-shadow(0 0 6px rgba(244,216,120,.5))"/>
        <defs><linearGradient id="charXpGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#a08020"/><stop offset="1" stop-color="#f5d878"/>
        </linearGradient></defs>
      </svg>
      <div class="char-xp-center">
        <div class="char-xp-lvl">${lvl}</div>
        <div class="char-xp-lbl">LVL</div>
      </div>
    </div>
    <div class="char-xp-info">
      <div class="char-xp-title">Experience</div>
      <div class="char-xp-bar"><div class="char-xp-bar-fill" style="width:${xpPct}%"></div></div>
      <div class="char-xp-numbers">${xpCur.toLocaleString()} / ${xpNext.toLocaleString()} XP &middot; <b>${xpPct.toFixed(0)}%</b> to Level ${lvl + 1}</div>
    </div>
  </div>`;

  // ── Hero switcher ──
  const clanHeroes = clanData?.members || [];
  if (clanHeroes.length > 1) {
    html += '<div class="cc-switcher">';
    html += '<span class="cc-switcher-label">&#x2694; Clan</span>';
    html += '<div class="cc-switcher-list">';
    for (const h of clanHeroes) {
      const active = (h.isPlayer && !_charHeroId) || h.id === _charHeroId;
      const tag = h.isPlayer ? 'You' : h.isCompanion ? 'Companion' : 'Family';
      html += `<div class="cc-hero-tab${active ? ' cc-hero-tab-active' : ''}" onclick="cmdSwitchHero('${esc(h.id)}')">
        <span class="cc-hero-tab-name">${esc(h.name)}</span>
        <span class="cc-hero-tab-tag">${tag}</span>
      </div>`;
    }
    html += '</div></div>';
  }

  // ── Hero Banner ──
  const attrOrder = ['Vigor','Control','Endurance','Cunning','Social','Intelligence','Naval'];
  const attrList = Object.keys(data.attributes || {});
  const orderedAttrs = attrOrder.filter(a => attrList.includes(a) || skillsByAttr[a]);
  for (const a of attrList) { if (!orderedAttrs.includes(a)) orderedAttrs.push(a); }
  const hasAttrPts = (data.unspentAttrPoints || 0) > 0;
  const hasFocusPts = (data.unspentFocusPoints || 0) > 0;

  html += '<div class="cc-hero-banner">';
  html += '<div class="cc-sheen"></div>';
  html += '<div class="cc-banner-row">';
  const portraitSrc = data.heroId ? 'Hero/' + data.heroId + '.png' : '';
  if (portraitSrc) html += `<div class="cc-portrait-frame"><img class="cc-banner-portrait" src="${portraitSrc}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
  html += '<div class="cc-banner-info">';
  html += `<h2 class="cc-banner-name">${esc(data.name || '')}</h2>`;
  html += `<div class="cc-banner-sub">Level ${data.level || 1} &middot; ${esc(data.culture || '')}${data.age ? ' &middot; Age ' + data.age : ''}</div>`;
  // Companion info
  const heroInfo = clanHeroes.find(h => h.id === (_charHeroId || data.heroId));
  if (heroInfo && !heroInfo.isPlayer) {
    const role = heroInfo.isCompanion ? 'Companion' : heroInfo.isGovernor ? 'Governor' : 'Family';
    html += `<div class="cc-companion-info">${role}${heroInfo.location ? ' &middot; ' + esc(heroInfo.location) : ''}${heroInfo.wage ? ' &middot; Wage: ' + heroInfo.wage + '&#x2727;/day' : ''}</div>`;
  }
  html += '</div>';

  // Equipment strip
  const battleGear = equipData?.battle || [];
  if (battleGear.length > 0) {
    const slotIcons = {Weapon0:'&#x2694;',Weapon1:'&#x2694;',Weapon2:'&#x1F3F9;',Weapon3:'&#x1F3F9;',Head:'&#x26D1;',Body:'&#x1F6E1;',Leg:'&#x1F462;',Gloves:'&#x270B;',Cape:'&#x1F9E3;',Horse:'&#x1F40E;',HorseHarness:'&#x2699;'};
    html += '<div class="cc-equip-strip">';
    for (const item of battleGear) {
      html += `<span class="cc-equip-item" title="${esc(item.name + ' (' + (item.slot||'') + ')')}">${slotIcons[item.slot]||'&#x25C6;'}</span>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // ── Stat breakdown ──
  const allSkills = data.skills || [];
  const totalSkillVal = allSkills.reduce((s,sk) => s + sk.value, 0);
  const totalFocus = allSkills.reduce((s,sk) => s + (sk.focus||0), 0);
  const combatSkills = ['One Handed','Two Handed','Polearm','Bow','Crossbow','Throwing','Riding','Athletics'];
  const combatRating = allSkills.filter(s => combatSkills.includes(s.name)).reduce((s,sk) => s + sk.value, 0);
  const leaderSkills = ['Charm','Leadership','Steward','Trade'];
  const leaderRating = allSkills.filter(s => leaderSkills.includes(s.name)).reduce((s,sk) => s + sk.value, 0);
  html += '<div class="cc-stat-strip">';
  html += `<span class="cc-stat-item"><b>${totalSkillVal}</b> Total</span>`;
  html += `<span class="cc-stat-item"><b>${totalFocus}</b> Focus</span>`;
  html += `<span class="cc-stat-item cc-stat-combat"><b>${combatRating}</b> Combat</span>`;
  html += `<span class="cc-stat-item cc-stat-leader"><b>${leaderRating}</b> Leader</span>`;
  if (data.totalXp) html += `<span class="cc-stat-item"><b>${data.totalXp}</b> XP</span>`;
  // Total perks learned (counted from all skills' perks)
  html += '<span class="cc-stat-item cc-stat-perks" id="ccTotalPerks">Perks: ...</span>';
  // Action buttons
  if (clanHeroes.length > 1) html += '<span class="cc-action-btn" onclick="ccOpenCompare()">&#x2694; Compare</span>';
  html += '<span class="cc-action-btn" onclick="ccTogglePlanner()">&#x270E; Build Planner</span>';
  html += '</div>';

  // ── Build Planner (hidden by default) ──
  html += '<div class="cc-planner" id="ccPlanner" style="display:none">';
  html += '<div class="cc-planner-header">Build Planner <span class="cc-planner-close" onclick="ccTogglePlanner()">&#x2715;</span></div>';
  html += '<div class="cc-planner-body">';
  html += '<div class="cc-planner-note">Preview how spending points would change your character. Changes are NOT saved until you click Apply.</div>';
  // Show attribute spending preview
  html += '<div class="cc-planner-section">Attributes</div>';
  html += '<div class="cc-planner-grid">';
  for (const attr of orderedAttrs) {
    const val = data.attributes?.[attr] ?? 0;
    if (!data.attributes?.hasOwnProperty(attr)) continue;
    html += '<div class="cc-planner-row">';
    html += '<span class="cc-planner-label">' + esc(attr) + '</span>';
    html += '<span class="cc-planner-val" id="ccPlan_' + esc(attr) + '">' + val + '</span>';
    html += '<span class="cc-planner-btn" onclick="ccPlanAttr(\'' + esc(attr) + '\',1)">+</span>';
    html += '<span class="cc-planner-btn cc-planner-btn-neg" onclick="ccPlanAttr(\'' + esc(attr) + '\',-1)">&minus;</span>';
    html += '</div>';
  }
  html += '</div>';
  // Focus spending preview
  html += '<div class="cc-planner-section">Focus Points</div>';
  html += '<div class="cc-planner-grid">';
  for (const s of allSkills) {
    html += '<div class="cc-planner-row">';
    html += '<span class="cc-planner-label">' + esc(s.name) + '</span>';
    html += '<span class="cc-planner-val" id="ccPlanF_' + esc(s.id) + '">' + (s.focus||0) + '</span>';
    html += '<span class="cc-planner-btn" onclick="ccPlanFocus(\'' + esc(s.id) + '\',1)">+</span>';
    html += '<span class="cc-planner-btn cc-planner-btn-neg" onclick="ccPlanFocus(\'' + esc(s.id) + '\',-1)">&minus;</span>';
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="cc-planner-actions"><span class="cc-planner-apply" onclick="ccApplyPlan()">Apply Changes</span><span class="cc-planner-reset" onclick="ccResetPlan()">Reset</span></div>';
  html += '</div></div>';

  // Attribute row
  html += '<div class="cc-attr-row">';
  for (const attr of orderedAttrs) {
    const val = data.attributes?.[attr] ?? 0;
    if (!data.attributes?.hasOwnProperty(attr)) continue;
    html += `<div class="cc-attr-chip">
      <span class="cc-attr-chip-val">${val}</span>
      <span class="cc-attr-chip-label">${attrShort[attr] || attr.substring(0,3).toUpperCase()}</span>
      ${hasAttrPts && val < 10 ? `<span class="cc-attr-plus" onclick="event.stopPropagation();cmdAddAttribute('${esc(attr)}')" title="+1 Attribute">+</span>` : ''}
    </div>`;
  }
  html += '</div>';

  // Unspent points
  if ((data.unspentAttrPoints || 0) > 0 || (data.unspentFocusPoints || 0) > 0) {
    html += '<div class="cc-points-row">';
    if (data.unspentAttrPoints > 0) html += `<span class="cc-points-badge cc-points-has">&#x24D0; ${data.unspentAttrPoints} Attribute</span>`;
    if (data.unspentFocusPoints > 0) html += `<span class="cc-points-badge cc-points-has">&#x25C9; ${data.unspentFocusPoints} Focus</span>`;
    html += '</div>';
  }
  html += '</div>';

  // ── Traits with tooltips ──
  const traitDescs = {
    'Honor':'Affects diplomatic options, ransom behavior, and lord opinions','Valor':'Affects morale in battles and willingness to fight outnumbered',
    'Mercy':'Affects prisoner treatment and post-battle options','Generosity':'Affects companion and vassal loyalty, gift expectations',
    'Calculating':'Affects strategic decisions and planning ability','Impulsiveness':'Affects snap decisions and reckless behavior',
    'Oligarchic':'Favors rule by council and nobles','Authoritarian':'Favors centralized power and strong leadership',
    'Egalitarian':'Favors equal rights and shared governance'
  };
  if (data.traits && data.traits.length > 0) {
    html += '<div class="cc-traits-row">';
    for (const t of data.traits) {
      const cls = t.level > 0 ? 'positive' : t.level < 0 ? 'negative' : 'neutral';
      const desc = traitDescs[t.name] || '';
      html += `<span class="cc-trait cc-trait-${cls}" ${desc ? `title="${esc(desc)}"` : ''}>${esc(t.name)} <b>${t.level > 0 ? '+' : ''}${t.level}</b></span>`;
    }
    html += '</div>';
  }

  // ── Two-panel layout: Skills left, Perks right ──
  html += '<div class="cc-split">';

  // LEFT — Skills list
  html += '<div class="cc-split-left">';
  // Sort buttons
  html += '<div class="cc-sort-bar">';
  html += '<span class="cc-sort-btn' + (_skillSort==='default'?' cc-sort-active':'') + '" onclick="ccSortSkills(\'default\')">Default</span>';
  html += '<span class="cc-sort-btn' + (_skillSort==='value'?' cc-sort-active':'') + '" onclick="ccSortSkills(\'value\')">By Value</span>';
  html += '<span class="cc-sort-btn' + (_skillSort==='focus'?' cc-sort-active':'') + '" onclick="ccSortSkills(\'focus\')">By Focus</span>';
  html += '<span class="cc-sort-btn' + (_skillSort==='rate'?' cc-sort-active':'') + '" onclick="ccSortSkills(\'rate\')">By Rate</span>';
  html += '</div>';

  // Apply sorting within each group
  if (_skillSort === 'value') {
    for (const attr in skillsByAttr) skillsByAttr[attr].sort((a,b) => b.value - a.value);
  } else if (_skillSort === 'focus') {
    for (const attr in skillsByAttr) skillsByAttr[attr].sort((a,b) => (b.focus||0) - (a.focus||0));
  } else if (_skillSort === 'rate') {
    for (const attr in skillsByAttr) skillsByAttr[attr].sort((a,b) => (b.learningRate||0) - (a.learningRate||0));
  }

  for (const attr of orderedAttrs) {
    const attrVal = data.attributes?.[attr] ?? 0;
    const skills = skillsByAttr[attr] || [];
    if (skills.length === 0) continue;
    const isRealAttr = data.attributes?.hasOwnProperty(attr);

    html += `<div class="cc-group-hdr"><span>${esc(attr)}</span>${isRealAttr ? `<span class="cc-group-val">${attrVal}</span>` : ''}</div>`;
    for (const s of skills) {
      const sImg = skillImg(s.name);
      const pct = Math.min(100, (s.value / 330) * 100);
      const lr = s.learningRate ? s.learningRate.toFixed(1) : '';
      const rec = hasFocusPts && (s.focus||0) < 5 && s.learningRate > 3;
      let cls = 'cc-row';
      if (_selectedSkillId === s.id) cls += ' cc-row-active';
      if (s.value > 0) cls += ' cc-row-has';
      if (rec) cls += ' cc-row-recommend';
      html += '<div class="' + cls + '" onclick="ccShowPerks(\'' + esc(s.id) + '\',\'' + esc(s.name) + '\',' + s.value + ',this,' + (s.learningRate||0) + ',' + (s.learningLimit||0) + ')">';
      html += sImg ? '<img class="cc-row-icon" src="' + sImg + '" alt="">' : '<span class="cc-row-icon"></span>';
      html += '<span class="cc-row-name">' + esc(s.name) + '</span>';
      html += '<div class="cc-row-bar"><div class="cc-row-fill" style="width:' + pct + '%"></div></div>';
      html += '<span class="cc-row-val">' + s.value + '</span>';
      if (lr) html += '<span class="cc-row-lr" title="Learning Rate">' + lr + 'x</span>';
      html += focusPips(s.focus || 0, s.id, hasFocusPts);
      html += '</div>';
    }
  }
  html += '</div>';

  // RIGHT — Perk tree (always visible)
  html += '<div class="cc-split-right" id="ccPerkPanel">';
  html += '<div class="cc-perk-empty">Select a skill to view perks</div>';
  html += '</div>';

  html += '</div>';
  el.innerHTML = html;

  // Auto-open perk panel for selected or first skill with value
  if (_selectedSkillId) {
    const row = el.querySelector('.cc-row-active');
    if (row) ccShowPerks(_selectedSkillId, _selectedSkillName, _selectedSkillVal, row);
  } else {
    const firstRow = el.querySelector('.cc-row-has');
    if (firstRow) firstRow.click();
  }

  // Background: count total perks across all skills
  ccCountTotalPerks(allSkills);
}

async function ccCountTotalPerks(skills) {
  let learned = 0, total = 0;
  try {
    const results = await Promise.all(
      skills.filter(s => s.value > 0).map(s => API.getPlayerPerks(s.id, _charHeroId || undefined).catch(() => null))
    );
    for (const r of results) {
      if (!r || !r.perks) continue;
      total += r.perks.length;
      learned += r.perks.filter(p => p.hasPerk).length;
    }
  } catch(e) {}
  const el = document.getElementById('ccTotalPerks');
  if (el) el.innerHTML = '<b>' + learned + '</b> / ' + total + ' Perks';
}

// ── Skill Sorting ──
let _skillSort = 'default';
function ccSortSkills(mode) {
  _skillSort = mode;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdCharacter(el);
}

// ── Inventory Tab ──
// ── Inventory helpers ──
const _slotIcon = s => ({Weapon0:'&#x2694;',Weapon1:'&#x2694;',Weapon2:'&#x1F3F9;',Weapon3:'&#x1F3F9;',
  Head:'&#x26D1;',Body:'&#x1F6E1;',Leg:'&#x1F462;',Gloves:'&#x270B;',Cape:'&#x1F9E3;',
  Horse:'&#x1F40E;',HorseHarness:'&#x2699;'})[s] || '&#x25C6;';
const _slotLabel = s => ({Weapon0:'Main Hand',Weapon1:'Off Hand',Weapon2:'Ranged',Weapon3:'Ammo',
  Head:'Head',Body:'Body Armor',Leg:'Leg Armor',Gloves:'Gauntlets',Cape:'Cape',
  Horse:'Mount',HorseHarness:'Harness'})[s] || s;
const _typeIcon = t => ({Arrows:'&#x27B3;',Bolts:'&#x27B3;',Bullets:'&#x27B3;',Shield:'&#x1F6E1;',OneHandedWeapon:'&#x2694;',
  TwoHandedWeapon:'&#x2694;',Polearm:'&#x2694;',Bow:'&#x1F3F9;',Crossbow:'&#x1F3F9;',
  Musket:'&#x1F52B;',Pistol:'&#x1F52B;',Thrown:'&#x2794;',
  HeadArmor:'&#x26D1;',BodyArmor:'&#x1F6E1;',LegArmor:'&#x1F462;',HandArmor:'&#x270B;',
  Cape:'&#x1F9E3;',Horse:'&#x1F40E;',HorseHarness:'&#x2699;',Goods:'&#x1F4E6;',
  Food:'&#x1F356;',Animal:'&#x1F404;',Banner:'&#x2691;',Thrown:'&#x2794;'})[t] || '&#x25C6;';

// ── Rich Tooltip System ──
let _tooltipEl = null;
function ensureTooltip() {
  if (_tooltipEl) return _tooltipEl;
  _tooltipEl = document.createElement('div');
  _tooltipEl.className = 'item-tooltip';
  _tooltipEl.style.display = 'none';
  document.body.appendChild(_tooltipEl);
  document.addEventListener('mousemove', e => {
    if (_tooltipEl.style.display === 'none') return;
    const pad = 16;
    let x = e.clientX + pad, y = e.clientY + pad;
    const rect = _tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - pad;
    _tooltipEl.style.left = x + 'px';
    _tooltipEl.style.top = y + 'px';
  });
  return _tooltipEl;
}

function showItemTooltip(el, item) {
  const tip = ensureTooltip();
  let h = '';

  // Header — item name + type
  const typeLabel = item.type || item.slot || '';
  const tierColors = {Tier1:'#8a7a5a',Tier2:'#9a8a68',Tier3:'#b0986c',Tier4:'#c8a848',Tier5:'#d4b878',Tier6:'#e8c848'};
  const tierColor = tierColors['Tier'+(item.tier||'')] || '#b0a080';
  h += `<div class="tt-header">`;
  h += `<span class="tt-name">${esc(item.name)}</span>`;
  h += `<span class="tt-type">${esc(_slotLabel(item.slot) || typeLabel)}</span>`;
  h += `</div>`;

  // Badges — tier, weapon class, culture, material
  h += `<div class="tt-badges">`;
  if (item.tier) h += `<span class="tt-badge" style="border-color:${tierColor};color:${tierColor}">Tier ${esc(item.tier)}</span>`;
  if (item.weaponClass) h += `<span class="tt-badge">${esc(item.weaponClass.replace(/([A-Z])/g,' $1').trim())}</span>`;
  if (item.culture) h += `<span class="tt-badge tt-badge-culture">${esc(item.culture)}</span>`;
  if (item.armorMaterial && item.armorMaterial !== 'Undefined') h += `<span class="tt-badge">${esc(item.armorMaterial)}</span>`;
  if (item.shieldSize) h += `<span class="tt-badge">${esc(item.shieldSize.replace(/([A-Z])/g,' $1').trim())}</span>`;
  if (item.flags) h += `<span class="tt-badge tt-badge-flag">${esc(item.flags)}</span>`;
  h += `</div>`;

  // Effectiveness rating bar
  if (item.effectiveness > 0) {
    const effPct = Math.min(100, item.effectiveness / 2 * 100);
    h += `<div class="tt-eff-row"><span class="tt-eff-label">Effectiveness</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${effPct}%;background:linear-gradient(90deg,rgba(184,140,50,.4),rgba(212,184,120,.8))"></div></div><span class="tt-stat-val">${parseFloat(item.effectiveness).toFixed(1)}</span></div>`;
  }

  // ── Armor stats ──
  if (item.headArmor > 0 || item.bodyArmor > 0 || item.legArmor > 0 || item.armArmor > 0) {
    h += `<div class="tt-section"><div class="tt-section-title">&#x1F6E1; Armor Protection</div>`;
    if (item.headArmor > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Head</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.headArmor/60*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.headArmor}</span></div>`;
    if (item.bodyArmor > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Body</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.bodyArmor/60*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.bodyArmor}</span></div>`;
    if (item.armArmor > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Arms</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.armArmor/60*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.armArmor}</span></div>`;
    if (item.legArmor > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Legs</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.legArmor/60*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.legArmor}</span></div>`;
    h += `</div>`;
  }

  // ── Weapon stats ──
  if (item.swingDamage > 0 || item.thrustDamage > 0) {
    h += `<div class="tt-section"><div class="tt-section-title">&#x2694; Combat Stats</div>`;
    if (item.swingDamage > 0) {
      const dmgLabel = item.damageType && item.damageType !== 'Undefined' ? item.damageType : 'Swing';
      h += `<div class="tt-stat"><span class="tt-stat-name">${dmgLabel}</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.swingDamage/150*100)}%;background:linear-gradient(90deg,#c06030,#e08040)"></div></div><span class="tt-stat-val tt-val-dmg">${item.swingDamage}</span></div>`;
    }
    if (item.thrustDamage > 0) {
      const tLabel = item.thrustDamageType && item.thrustDamageType !== 'Undefined' ? item.thrustDamageType : 'Thrust';
      h += `<div class="tt-stat"><span class="tt-stat-name">${tLabel}</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.thrustDamage/150*100)}%;background:linear-gradient(90deg,#c06030,#e08040)"></div></div><span class="tt-stat-val tt-val-dmg">${item.thrustDamage}</span></div>`;
    }
    if (item.swingSpeed > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Speed</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.swingSpeed/120*100)}%;background:linear-gradient(90deg,#60a050,#80c070)"></div></div><span class="tt-stat-val">${item.swingSpeed}</span></div>`;
    if (item.weaponLength > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Reach</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.weaponLength/300*100)}%;background:linear-gradient(90deg,#7a7a5a,#a0a080)"></div></div><span class="tt-stat-val">${item.weaponLength}</span></div>`;
    if (item.handling > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Handling</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.handling/120*100)}%;background:linear-gradient(90deg,#60a050,#80c070)"></div></div><span class="tt-stat-val">${item.handling}</span></div>`;
    if (item.missileSpeed > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Missile Spd</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.missileSpeed/100*100)}%;background:linear-gradient(90deg,#a08050,#c0a070)"></div></div><span class="tt-stat-val">${item.missileSpeed}</span></div>`;
    if (item.accuracy > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Accuracy</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.accuracy)}%;background:linear-gradient(90deg,#60a050,#80c070)"></div></div><span class="tt-stat-val">${item.accuracy}</span></div>`;
    if (item.maxAmmo > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Ammo</span><span class="tt-stat-val" style="margin-left:auto">${item.maxAmmo}</span></div>`;
    h += `</div>`;

    // Alt weapon modes
    if (item.altModes?.length) {
      h += `<div class="tt-section"><div class="tt-section-title">&#x1F504; Alternate Modes</div>`;
      for (const alt of item.altModes) {
        h += `<div class="tt-alt-mode"><span class="tt-alt-class">${esc((alt.class||'').replace(/([A-Z])/g,' $1').trim())}</span>`;
        if (alt.swingDmg > 0) h += `<span class="tt-alt-stat">S:${alt.swingDmg}</span>`;
        if (alt.thrustDmg > 0) h += `<span class="tt-alt-stat">T:${alt.thrustDmg}</span>`;
        h += `<span class="tt-alt-stat">Spd:${alt.speed}</span>`;
        h += `<span class="tt-alt-stat">Len:${alt.length}</span></div>`;
      }
      h += `</div>`;
    }
  }

  // ── Shield stats ──
  if (item.shieldHp > 0) {
    h += `<div class="tt-section"><div class="tt-section-title">&#x1F6E1; Shield</div>`;
    h += `<div class="tt-stat"><span class="tt-stat-name">Hit Points</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.shieldHp/500*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.shieldHp}</span></div>`;
    if (item.shieldSpeed > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Speed</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.shieldSpeed/120*100)}%;background:linear-gradient(90deg,#60a050,#80c070)"></div></div><span class="tt-stat-val">${item.shieldSpeed}</span></div>`;
    h += `</div>`;
  }

  // ── Horse stats ──
  if (item.horseSpeed > 0 || item.horseArmor > 0) {
    h += `<div class="tt-section"><div class="tt-section-title">&#x1F40E; ${item.horseArmor > 0 ? 'Horse Armor' : 'Mount'}</div>`;
    if (item.horseArmor > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Armor</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.horseArmor/60*100)}%;background:linear-gradient(90deg,#4a7ab0,#6a9ad0)"></div></div><span class="tt-stat-val">${item.horseArmor}</span></div>`;
    if (item.horseSpeed > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Speed</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.horseSpeed/70*100)}%;background:linear-gradient(90deg,#60a050,#80c070)"></div></div><span class="tt-stat-val">${item.horseSpeed}</span></div>`;
    if (item.horseManeuver > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Maneuver</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.horseManeuver/70*100)}%;background:linear-gradient(90deg,#a0a050,#c0c070)"></div></div><span class="tt-stat-val">${item.horseManeuver}</span></div>`;
    if (item.horseCharge > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Charge</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.horseCharge/40*100)}%;background:linear-gradient(90deg,#c06030,#e08040)"></div></div><span class="tt-stat-val">${item.horseCharge}</span></div>`;
    if (item.horseHp > 0) h += `<div class="tt-stat"><span class="tt-stat-name">Health</span><div class="tt-stat-bar-wrap"><div class="tt-stat-bar" style="width:${Math.min(100,item.horseHp/200*100)}%;background:linear-gradient(90deg,#a05050,#c07070)"></div></div><span class="tt-stat-val">${item.horseHp}</span></div>`;
    h += `</div>`;
  }

  // Footer — value + weight
  h += `<div class="tt-footer">`;
  if (item.value) h += `<span class="tt-gold">&#x25C9; ${(item.value||0).toLocaleString()}</span>`;
  if (item.weight) h += `<span class="tt-weight">&#x2696; ${parseFloat(item.weight||0).toFixed(1)}</span>`;
  h += `</div>`;

  tip.innerHTML = h;
  tip.style.display = 'block';
  // Position near element
  const rect = el.getBoundingClientRect();
  let x = rect.right + 14, y = rect.top;
  // Reflow check after setting content
  requestAnimationFrame(() => {
    const tr = tip.getBoundingClientRect();
    if (x + tr.width > window.innerWidth) x = rect.left - tr.width - 14;
    if (y + tr.height > window.innerHeight) y = window.innerHeight - tr.height - 10;
    if (y < 10) y = 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
}

function hideItemTooltip() {
  if (_tooltipEl) _tooltipEl.style.display = 'none';
}

// Data attribute helper for tooltip binding
function ttAttr(item) {
  return ` onmouseenter="showItemTooltip(this,${esc(JSON.stringify(item)).replace(/"/g,'&quot;')})" onmouseleave="hideItemTooltip()"`;
}

// Toast notification instead of ugly alert()
function showToast(msg, isError) {
  let toast = document.getElementById('cmdToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cmdToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'cmd-toast ' + (isError ? 'cmd-toast-error' : 'cmd-toast-ok');
  toast.style.display = 'block';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 400); }, 2500);
}

async function ccShowPerks(skillId, skillName, skillValue, cardEl, learningRate, learningLimit) {
  _selectedSkillId = skillId;
  _selectedSkillName = skillName;
  _selectedSkillVal = skillValue;

  document.querySelectorAll('.cc-row').forEach(c => c.classList.remove('cc-row-active'));
  if (cardEl) cardEl.classList.add('cc-row-active');

  const panel = document.getElementById('ccPerkPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-spinner" style="padding:40px"></div>';

  const data = await API.getPlayerPerks(skillId, _charHeroId || undefined);
  if (!data || data.error) {
    panel.innerHTML = '<div class="cc-perk-empty">' + (data?.error || 'Failed to load perks') + '</div>';
    return;
  }

  const skillImgMap = {'One Handed':'onehanded','Two Handed':'twohanded','Polearm':'polearm',
    'Bow':'bow','Crossbow':'crossbow','Throwing':'throwing',
    'Riding':'riding','Athletics':'athletics','Smithing':'crafting',
    'Scouting':'scouting','Tactics':'tactics','Roguery':'roguery',
    'Charm':'charm','Leadership':'leadership','Trade':'trade',
    'Steward':'steward','Medicine':'medicine','Engineering':'engineering'};
  const navalImgMap = {'Mariner':'mariner_skill','Boatswain':'boatswain_skill','Shipmaster':'shipmaster_skill'};
  const skillIcon = skillImgMap[skillName] ? 'Skills/gui_skills_icon_' + skillImgMap[skillName] + '.png'
    : navalImgMap[skillName] ? 'Skills/' + navalImgMap[skillName] + '.png' : '';

  // Group perks by level
  const levels = {};
  for (const p of (data.perks || [])) {
    const lvl = p.reqSkill || 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(p);
  }
  const sortedLevels = Object.keys(levels).map(Number).sort((a,b) => a - b);
  const maxLvl = sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1] : 1;
  const progressPct = Math.min(100, skillValue / maxLvl * 100);

  let h = '';

  // Header
  const lrDisplay = learningRate > 0 ? 'Learning Rate: x ' + learningRate.toFixed(2) : 'Level ' + skillValue;
  h += `<div class="pp-header">
    ${skillIcon ? `<img class="pp-icon" src="${skillIcon}" alt="">` : ''}
    <div class="pp-info"><span class="pp-name">${esc(skillName)}</span><span class="pp-sub">${lrDisplay}</span></div>
    <span class="pp-level">${skillValue} / ${maxLvl}</span>
  </div>`;

  // Progress bar + perk counter
  const allPerks = data.perks || [];
  const learnedPerks = allPerks.filter(p => p.hasPerk).length;
  h += `<div class="pp-stats-row">`;
  h += `<div class="pp-bar-wrap"><div class="pp-bar"><div class="pp-bar-fill" style="width:${progressPct}%"></div></div></div>`;
  h += `<span class="pp-perk-count">${learnedPerks} / ${allPerks.length} perks</span>`;
  h += `</div>`;

  // Vertical perk list — each level is a row
  h += '<div class="pp-list">';
  for (const lvl of sortedLevels) {
    const perks = levels[lvl];
    const unlocked = skillValue >= lvl;
    const p1 = perks[0];
    const p2 = perks.length > 1 ? perks[1] : null;
    const p1AltTaken = p2 ? p2.hasPerk : false;
    const p2AltTaken = p1 ? p1.hasPerk : false;

    const renderPerk = (p, altTaken) => {
      if (!p) return '<div class="pp-perk pp-perk-empty"></div>';
      const canLearn = unlocked && !p.hasPerk && !altTaken;
      const isLocked = unlocked && !p.hasPerk && altTaken;
      const cls = p.hasPerk ? 'pp-active' : canLearn ? 'pp-learnable' : isLocked ? 'pp-locked' : unlocked ? 'pp-available' : 'pp-dim';
      const click = canLearn ? ` onclick="ccSelectPerk('${esc(p.id)}','${esc(skillId)}','${esc(skillName)}',${skillValue})"` : '';
      const desc = p.description || '';
      const desc2 = p.secondaryDesc ? 'Party: ' + p.secondaryDesc : '';
      return `<div class="pp-perk ${cls}"${click}>
        <img class="pp-perk-img" src="Sperks/${p.id}.png" alt="" onerror="this.src='Skills/mariner_skill.png';this.style.opacity='.4';this.onerror=null">
        <div class="pp-perk-info">
          <span class="pp-perk-name">${esc(p.name)}${p.hasPerk ? ' &#x2714;' : ''}${isLocked ? ' &#x2716;' : ''}</span>
          <span class="pp-perk-desc">${esc(desc)}</span>
          ${desc2 ? `<span class="pp-perk-desc pp-perk-desc2">${esc(desc2)}</span>` : ''}
        </div>
        ${canLearn ? '<span class="pp-learn">Learn</span>' : ''}
      </div>`;
    };

    h += `<div class="pp-level-row${unlocked ? '' : ' pp-level-locked'}">
      <div class="pp-lvl-num">${lvl}</div>
      <div class="pp-perks">${renderPerk(p1, p1AltTaken)}${p2 ? renderPerk(p2, p2AltTaken) : ''}</div>
    </div>`;
  }
  h += '</div>';

  if (sortedLevels.length === 0) h += '<div class="cc-perk-empty">No perks found</div>';
  panel.innerHTML = h;
}

async function ccSelectPerk(perkId, skillId, skillName, skillValue) {
  const res = await API.selectPerk(perkId, _charHeroId || undefined);
  if (res?.success) {
    showToast('Learned: ' + res.perk);
    ccShowPerks(skillId, skillName, skillValue, document.querySelector('.cc-skill-card-active'));
  } else {
    showToast(res?.error || 'Failed to learn perk', true);
  }
}

function ccPerkHover(el, entering) {
  try {
    const detail = document.getElementById('ccPerkDetail');
    if (!detail) return;
    if (!entering) { detail.innerHTML = ''; detail.style.opacity = '0'; return; }
    const tip = (el.getAttribute('title') || '').trim();
    if (!tip) return;
    const lines = tip.split('\n');
    const name = lines[0] || '';
    const rest = lines.slice(1).filter(l => l.trim()).join('<br>');
    detail.innerHTML = '<strong>' + esc(name) + '</strong>' + (rest ? '<br><span class="cc-perk-detail-desc">' + esc(rest).replace(/&lt;br&gt;/g,'<br>') + '</span>' : '');
    detail.style.opacity = '1';
  } catch(e) { console.warn('ccPerkHover error:', e); }
}

// ── Hero Comparison Modal ──
function _cmpRow(name, va, vb, maxVal) {
  const diff = va - vb;
  return '<div class="cc-cmp-row"><span class="cc-cmp-name">' + esc(name) + '</span>' +
    '<span class="cc-cmp-val ' + (diff>0?'cc-cmp-win':diff<0?'cc-cmp-lose':'') + '">' + va + '</span>' +
    '<span class="cc-cmp-bar"><span class="cc-cmp-fill-a" style="width:'+Math.min(100,va/maxVal*100)+'%"></span>' +
    '<span class="cc-cmp-fill-b" style="width:'+Math.min(100,vb/maxVal*100)+'%"></span></span>' +
    '<span class="cc-cmp-val ' + (diff<0?'cc-cmp-win':diff>0?'cc-cmp-lose':'') + '">' + vb + '</span></div>';
}

async function ccRenderCompare(idA, idB) {
  const clan = await API.getPlayerClan();
  const heroes = clan?.members || [];
  const [a, b] = await Promise.all([API.getPlayerCharacter(idA), API.getPlayerCharacter(idB)]);
  if (!a || !b) return;
  document.querySelector('.cc-compare-overlay')?.remove();

  let h = '<div class="cc-compare-overlay" onclick="if(event.target===this)this.remove()">';
  h += '<div class="cc-compare-modal">';
  h += '<div class="cc-compare-header">Hero Comparison <span class="cc-compare-close" onclick="this.closest(\'.cc-compare-overlay\').remove()">&#x2715;</span></div>';

  // Selectors
  h += '<div class="cc-compare-selectors">';
  h += '<select class="cc-compare-select" id="ccCmpA" onchange="ccUpdateCompare()">';
  for (const hr of heroes) h += '<option value="'+esc(hr.id)+'"'+(hr.id===idA?' selected':'')+'>' + esc(hr.name) + '</option>';
  h += '</select><span class="cc-compare-vs">VS</span>';
  h += '<select class="cc-compare-select" id="ccCmpB" onchange="ccUpdateCompare()">';
  for (const hr of heroes) h += '<option value="'+esc(hr.id)+'"'+(hr.id===idB?' selected':'')+'>' + esc(hr.name) + '</option>';
  h += '</select></div>';

  h += '<div class="cc-compare-table">';

  // ── Attributes section ──
  h += '<div class="cc-cmp-section">Attributes</div>';
  h += '<div class="cc-cmp-row cc-cmp-header"><span class="cc-cmp-name"></span><span class="cc-cmp-val">' + esc(a.name) + '</span><span class="cc-cmp-bar"></span><span class="cc-cmp-val">' + esc(b.name) + '</span></div>';
  const allAttrs = [...new Set([...Object.keys(a.attributes||{}), ...Object.keys(b.attributes||{})])];
  for (const attr of allAttrs) {
    h += _cmpRow(attr, (a.attributes||{})[attr]||0, (b.attributes||{})[attr]||0, 10);
  }

  // ── Traits section ──
  const aTraits = {}; (a.traits||[]).forEach(t => aTraits[t.name] = t.level);
  const bTraits = {}; (b.traits||[]).forEach(t => bTraits[t.name] = t.level);
  const allTraitNames = [...new Set([...Object.keys(aTraits), ...Object.keys(bTraits)])];
  if (allTraitNames.length > 0) {
    h += '<div class="cc-cmp-section">Traits</div>';
    for (const name of allTraitNames) {
      const va = aTraits[name]||0, vb = bTraits[name]||0;
      const diff = va - vb;
      h += '<div class="cc-cmp-row"><span class="cc-cmp-name">' + esc(name) + '</span>';
      h += '<span class="cc-cmp-val ' + (diff>0?'cc-cmp-win':diff<0?'cc-cmp-lose':'') + '">' + (va>0?'+':'') + va + '</span>';
      h += '<span class="cc-cmp-bar"></span>';
      h += '<span class="cc-cmp-val ' + (diff<0?'cc-cmp-win':diff>0?'cc-cmp-lose':'') + '">' + (vb>0?'+':'') + vb + '</span></div>';
    }
  }

  // ── Skills section ──
  h += '<div class="cc-cmp-section">Skills</div>';
  const aSkills = {}; (a.skills||[]).forEach(s => aSkills[s.name] = s.value);
  const bSkills = {}; (b.skills||[]).forEach(s => bSkills[s.name] = s.value);
  const allSkillNames = [...new Set([...(a.skills||[]).map(s=>s.name),...(b.skills||[]).map(s=>s.name)])];
  for (const name of allSkillNames) {
    h += _cmpRow(name, aSkills[name]||0, bSkills[name]||0, 330);
  }

  // Totals
  const tA = (a.skills||[]).reduce((s,sk)=>s+sk.value,0);
  const tB = (b.skills||[]).reduce((s,sk)=>s+sk.value,0);
  h += '<div class="cc-cmp-row cc-cmp-total"><span class="cc-cmp-name">TOTAL SKILLS</span><span class="cc-cmp-val">' + tA + '</span><span class="cc-cmp-bar"></span><span class="cc-cmp-val">' + tB + '</span></div>';

  // Summary stats
  h += '<div class="cc-cmp-section">Summary</div>';
  h += _cmpRow('Level', a.level||1, b.level||1, 50);
  h += _cmpRow('Age', a.age||0, b.age||0, 80);
  const aFocus = (a.skills||[]).reduce((s,sk)=>s+(sk.focus||0),0);
  const bFocus = (b.skills||[]).reduce((s,sk)=>s+(sk.focus||0),0);
  h += _cmpRow('Total Focus', aFocus, bFocus, 90);

  h += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

async function ccOpenCompare() {
  const clan = await API.getPlayerClan();
  const heroes = clan?.members || [];
  if (heroes.length < 2) { showToast('Need at least 2 clan members', true); return; }
  const idA = _charHeroId || heroes.find(h => h.isPlayer)?.id || heroes[0].id;
  const idB = heroes.find(h => h.id !== idA)?.id || heroes[1].id;
  await ccRenderCompare(idA, idB);
}

async function ccUpdateCompare() {
  const a = document.getElementById('ccCmpA')?.value;
  const b = document.getElementById('ccCmpB')?.value;
  if (a && b) await ccRenderCompare(a, b);
}

// ── Build Planner ──
let _planChanges = {};
function ccTogglePlanner() {
  const p = document.getElementById('ccPlanner');
  if (!p) return;
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  _planChanges = {};
}
function ccPlanAttr(attr, delta) {
  const el = document.getElementById('ccPlan_' + attr);
  if (!el) return;
  let val = parseInt(el.textContent) + delta;
  if (val < 0) val = 0;
  if (val > 10) val = 10;
  el.textContent = val;
  if (!_planChanges.attrs) _planChanges.attrs = {};
  _planChanges.attrs[attr] = val;
  el.style.color = '#f0d880';
}
function ccPlanFocus(skillId, delta) {
  const el = document.getElementById('ccPlanF_' + skillId);
  if (!el) return;
  let val = parseInt(el.textContent) + delta;
  if (val < 0) val = 0;
  if (val > 5) val = 5;
  el.textContent = val;
  if (!_planChanges.focus) _planChanges.focus = {};
  _planChanges.focus[skillId] = val;
  el.style.color = '#80c060';
}
function ccResetPlan() {
  _planChanges = {};
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdCharacter(el);
  showToast('Plan reset');
}
async function ccApplyPlan() {
  // Apply attribute changes
  if (_planChanges.attrs) {
    for (const [attr, targetVal] of Object.entries(_planChanges.attrs)) {
      // We'd need to call addAttribute multiple times — simplified: just call once per point
      // This is a preview — actual application would need current values
      showToast('Planner: Apply not yet implemented — use +/- buttons on the main page');
      return;
    }
  }
  showToast('Planner: Use the + buttons in the skill list to spend points');
}

function cmdSwitchHero(heroId) {
  _charHeroId = heroId;
  _selectedSkillId = ''; _selectedSkillName = ''; _selectedSkillVal = 0;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdCharacter(el);
}

async function cmdAddFocus(skillId) {
  const res = await API.addFocusPoint(skillId, _charHeroId || undefined);
  if (res?.success) {
    showToast('Focus added to ' + res.skill + ' (' + res.newFocus + '/5) — ' + res.remaining + ' remaining');
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdCharacter(el);
  } else {
    showToast(res?.error || 'Failed to add focus', true);
  }
}

async function cmdAddAttribute(attr) {
  const res = await API.addAttributePoint(attr, _charHeroId || undefined);
  if (res?.success) {
    showToast(attr + ' increased to ' + res.newValue + ' — ' + res.remaining + ' remaining');
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdCharacter(el);
  } else {
    showToast(res?.error || 'Failed to add attribute', true);
  }
}

function cmdInvFilter(el, type) {
  document.querySelectorAll('.cmd-inv-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.cmd-inv-group').forEach(g => {
    g.style.display = (type === 'all' || g.dataset.invType === type) ? '' : 'none';
  });
}

function cmdInvSearch(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.cmd-inv-row').forEach(row => {
    const name = row.querySelector('.cmd-inv-name')?.textContent?.toLowerCase() || '';
    row.style.display = !q || name.includes(q) ? '' : 'none';
  });
}

function cmdInvSort(mode) {
  document.querySelectorAll('.cmd-inv-group-body').forEach(body => {
    const rows = [...body.querySelectorAll('.cmd-inv-row')];
    rows.sort((a, b) => {
      if (mode === 'name') return (a.querySelector('.cmd-inv-name')?.textContent||'').localeCompare(b.querySelector('.cmd-inv-name')?.textContent||'');
      if (mode === 'weight') return parseFloat(b.querySelector('.cmd-inv-weight')?.textContent||0) - parseFloat(a.querySelector('.cmd-inv-weight')?.textContent||0);
      if (mode === 'count') return parseInt(b.querySelector('.cmd-inv-count')?.textContent?.replace('x','')||0) - parseInt(a.querySelector('.cmd-inv-count')?.textContent?.replace('x','')||0);
      // default: value
      return parseInt((b.querySelector('.cmd-inv-val')?.textContent||'0').replace(/[^0-9]/g,'')) - parseInt((a.querySelector('.cmd-inv-val')?.textContent||'0').replace(/[^0-9]/g,''));
    });
    rows.forEach(r => body.appendChild(r));
  });
}

async function cmdEquipItem(itemId, slot, equipType) {
  const res = await API.equipItem(itemId, slot, equipType, _invHeroId || undefined);
  if (res?.success) {
    showToast('Equipped: ' + (res.equipped || 'item') + (res.replaced ? ' (replaced ' + res.replaced + ')' : ''));
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else {
    showToast(res?.error || 'Equip failed', true);
  }
}

async function cmdUnequipItem(slot, equipType) {
  const res = await API.unequipItem(slot, equipType, _invHeroId || undefined);
  if (res?.success) {
    showToast('Unequipped: ' + (res.unequipped || 'item'));
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else {
    showToast(res?.error || 'Unequip failed', true);
  }
}

let _invMode = 'equipment';
window._invFilterCat = 'all';
function invSetCatFilter(cat) {
  window._invFilterCat = cat;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdInventory(el);
}
let _invSelectedItem = null;
let _invHeroId = '';

async function renderCmdInventory(el) {
  let equip, inv, clanData;
  try {
    [equip, inv, clanData] = await Promise.all([
      API.getPlayerEquipment(_invHeroId || undefined).catch(() => ({battle:[],civilian:[]})),
      API.getPlayerInventory().catch(() => ({items:[]})),
      API.getPlayerClan().catch(() => ({members:[]}))
    ]);
  } catch(e) {
    el.innerHTML = '<div class="empty">Failed to load inventory.</div>';
    return;
  }
  if (!equip) equip = {battle:[],civilian:[]};
  if (!inv) inv = {items:[]};

  const _equipItems = [];
  const tierColor = t => ({1:'#6a6a5a',2:'#7a8a5a',3:'#8a9a68',4:'#c8a848',5:'#d4b878',6:'#e8c848'})[t] || '#8a7a5a';
  const tierName = t => ({1:'Common',2:'Fine',3:'Masterwork',4:'Lordly',5:'Legendary',6:'Mythic'})[t] || '';

  let html = '';
  const allItems = inv?.items || [];
  const gold = _cmdData?.hero?.gold || 0;
  const totalWeight = allItems.reduce((s,i) => s + (i.weight||0) * i.count, 0);
  const totalItemCount = allItems.reduce((s,i) => s + i.count, 0);
  const battleItems = equip?.battle || [];
  const civItems = equip?.civilian || [];
  const clanHeroes = clanData?.members || [];

  // ── Top Bar ──
  const weightLimit = inv?.weightLimit || 0;
  const isOverweight = inv?.overweight || (weightLimit > 0 && totalWeight > weightLimit);
  const weightPct = weightLimit > 0 ? Math.min(100, Math.round(totalWeight / weightLimit * 100)) : 0;

  const selectedHero = clanHeroes.find(h => h.id === _invHeroId) || clanHeroes.find(h => h.isPlayer);
  const heroEquipWeight = battleItems.reduce((s,i) => s + parseFloat(i.weight||0), 0) + civItems.reduce((s,i) => s + parseFloat(i.weight||0), 0);

  // ── Immersive header: title ribbon + gauges + stats + heaviest-items ──
  const totalValue = allItems.reduce((s, i) => s + (i.value || 0) * (i.count || 1), 0);
  const avgTier = allItems.length > 0 ? (allItems.reduce((s, i) => s + (i.tier || 1), 0) / allItems.length) : 0;
  const heaviest = allItems.slice().sort((a, b) => (b.weight || 0) * (b.count || 1) - (a.weight || 0) * (a.count || 1))[0];

  // Auto-generated inventory title
  let invHonor = 'Wandering Quartermaster';
  if (totalValue >= 500000) invHonor = 'Warlord\'s Warchest';
  else if (totalValue >= 200000) invHonor = 'Masters of the Hoard';
  else if (totalValue >= 100000) invHonor = 'Wealthy Baggage Train';
  else if (totalValue >= 50000) invHonor = 'Well-Provisioned Company';
  else if (totalValue >= 20000) invHonor = 'Traveling Warband';
  else if (totalItemCount >= 80) invHonor = 'Caravan Master';
  else if (totalItemCount >= 40) invHonor = 'Seasoned Trader';

  // Treasury + Weight rings
  const tR = 32, tCirc = 2 * Math.PI * tR;
  // Gold ratio: assume 100k = full ring
  const goldPct = Math.min(100, (gold / 100000) * 100);
  const tDash = (goldPct / 100) * tCirc;
  const wPct = weightLimit > 0 ? Math.min(100, Math.round(totalWeight / weightLimit * 100)) : 0;
  const wDash = (wPct / 100) * tCirc;

  html += `<div class="inv-header-wrap">
    <div class="inv-title-ribbon">\u{1F4E6} ${esc(invHonor)}</div>
    <div class="inv-header-row">
      <div class="inv-gauge">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="${tR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="5"/>
          <circle cx="40" cy="40" r="${tR}" fill="none" stroke="url(#invGoldGrad)" stroke-width="5"
            stroke-dasharray="${tDash} ${tCirc - tDash}" stroke-linecap="round"
            transform="rotate(-90 40 40)"
            style="filter:drop-shadow(0 0 6px rgba(244,216,120,.55))"/>
          <defs><linearGradient id="invGoldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a08020"/><stop offset="1" stop-color="#f5d878"/>
          </linearGradient></defs>
        </svg>
        <div class="inv-gauge-center">
          <div class="inv-gauge-val">${gold >= 1000 ? (gold/1000).toFixed(1)+'K' : gold}</div>
          <div class="inv-gauge-lbl">GOLD</div>
        </div>
      </div>
      <div class="inv-gauge">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="${tR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="5"/>
          <circle cx="40" cy="40" r="${tR}" fill="none" stroke="${isOverweight ? 'url(#invWRed)' : 'url(#invWeightGrad)'}" stroke-width="5"
            stroke-dasharray="${wDash} ${tCirc - wDash}" stroke-linecap="round"
            transform="rotate(-90 40 40)"
            style="filter:drop-shadow(0 0 6px ${isOverweight ? 'rgba(232,128,96,.55)' : 'rgba(122,192,112,.55)'})"/>
          <defs>
            <linearGradient id="invWeightGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#4a8040"/><stop offset="1" stop-color="#7ac070"/>
            </linearGradient>
            <linearGradient id="invWRed" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#8a2820"/><stop offset="1" stop-color="#e88060"/>
            </linearGradient>
          </defs>
        </svg>
        <div class="inv-gauge-center">
          <div class="inv-gauge-val" style="color:${isOverweight ? '#e88060' : '#a8e098'}">${wPct}%</div>
          <div class="inv-gauge-lbl">LOAD</div>
        </div>
      </div>
      <div class="inv-header-stats">
        <div class="inv-hs-card"><span class="inv-hs-icon">\u{1F4E6}</span><b class="inv-hs-num" data-count-target="${totalItemCount}">0</b><span class="inv-hs-lbl">Items</span></div>
        <div class="inv-hs-card"><span class="inv-hs-icon">\u{1F4B0}</span><b class="inv-hs-num" data-count-target="${totalValue}">0</b><span class="inv-hs-lbl">Total Value</span></div>
        <div class="inv-hs-card"><span class="inv-hs-icon">\u{2728}</span><b class="inv-hs-num">${avgTier.toFixed(1)}</b><span class="inv-hs-lbl">Avg Tier</span></div>
        ${heaviest ? `<div class="inv-hs-card"><span class="inv-hs-icon">\u{2696}</span><b class="inv-hs-num">${((heaviest.weight||0) * (heaviest.count||1)).toFixed(0)}</b><span class="inv-hs-lbl">${esc((heaviest.name||'').slice(0,10))}</span></div>` : ''}
      </div>
    </div>`;

  // Heaviest items ribbon (top 5)
  const topHeavy = allItems.slice().sort((a, b) => (b.weight || 0) * (b.count || 1) - (a.weight || 0) * (a.count || 1)).slice(0, 5).filter(i => (i.weight || 0) > 0);
  if (topHeavy.length > 0) {
    html += '<div class="inv-heavy-ribbon"><div class="inv-heavy-label">\u{2696} Heaviest</div><div class="inv-heavy-list">';
    topHeavy.forEach(it => {
      const tc = tierColor(it.tier || 1);
      const totalW = ((it.weight || 0) * (it.count || 1)).toFixed(1);
      html += `<div class="inv-heavy-item" style="border-left-color:${tc}" title="${esc(it.name||'')}">
        <div class="inv-heavy-name">${esc((it.name||'').slice(0, 20))}</div>
        <div class="inv-heavy-meta">\u{2696} ${totalW} &middot; &times;${it.count||1}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  html += '</div>';

  html += '<div class="inv-top-bar">';
  if (selectedHero && !selectedHero.isPlayer) {
    html += '<span class="inv-hero-badge">&#x1F464; <b>' + esc(selectedHero.name) + '</b></span>';
  }
  html += '<span class="inv-gold">&#x25C9; <b>' + gold.toLocaleString() + '</b> Party Treasury</span>';
  html += '<span class="inv-item-count">&#x1F4E6; <b>' + totalItemCount + '</b> Party Items</span>';
  html += '<span class="inv-equip-weight">&#x2694; <b>' + heroEquipWeight.toFixed(1) + '</b> ' + esc((selectedHero?.name || 'Your') + ' Gear') + '</span>';
  // Weight with capacity bar
  html += '<div class="inv-weight-wrap">';
  html += '<span class="inv-weight-text' + (isOverweight ? ' inv-overweight' : '') + '">&#x2696; <b>' + totalWeight.toFixed(0) + '</b>';
  if (weightLimit > 0) html += ' / ' + weightLimit.toFixed(0);
  html += ' Party Weight</span>';
  if (weightLimit > 0) {
    html += '<div class="inv-weight-bar"><div class="inv-weight-fill' + (isOverweight ? ' inv-weight-over' : '') + '" style="width:' + weightPct + '%"></div></div>';
  }
  html += '</div>';
  if (isOverweight) html += '<span class="inv-overweight-badge">&#x26A0; OVERWEIGHT</span>';
  html += '</div>';

  // ── Hero Switcher ──
  if (clanHeroes.length > 1) {
    html += '<div class="cc-switcher">';
    html += '<span class="cc-switcher-label">&#x2694; Clan</span>';
    html += '<div class="cc-switcher-list">';
    for (const h of clanHeroes) {
      const active = (h.isPlayer && !_invHeroId) || h.id === _invHeroId;
      const tag = h.isPlayer ? 'You' : h.isCompanion ? 'Companion' : 'Family';
      html += '<div class="cc-hero-tab' + (active ? ' cc-hero-tab-active' : '') + '" onclick="invSwitchHero(\'' + esc(h.id) + '\')">';
      html += '<span class="cc-hero-tab-name">' + esc(h.name) + '</span>';
      html += '<span class="cc-hero-tab-tag">' + tag + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  // ── Mode Switcher ──
  const modes = [
    {id:'equipment',icon:'&#x2694;',label:'Equipment'},
    {id:'inventory',icon:'&#x1F392;',label:'Inventory'},
    {id:'party',icon:'&#x1F465;',label:'Party'},
    {id:'trade',icon:'&#x1F4B0;',label:'Trade'}
  ];
  html += '<div class="inv-modes">';
  for (const m of modes) {
    html += '<div class="inv-mode' + (_invMode===m.id?' inv-mode-active':'') + '" onclick="invSwitchMode(\'' + m.id + '\')">';
    html += '<span class="inv-mode-icon">' + m.icon + '</span> ' + m.label + '</div>';
  }
  html += '</div>';

  // Stat label helpers
  const armorStats = item => {
    const parts = [];
    if (item.headArmor > 0) parts.push('Head ' + item.headArmor);
    if (item.bodyArmor > 0) parts.push('Body ' + item.bodyArmor);
    if (item.legArmor > 0) parts.push('Leg ' + item.legArmor);
    if (item.armArmor > 0) parts.push('Arm ' + item.armArmor);
    return parts.length ? '&#x1F6E1; ' + parts.join(' &middot; ') : '';
  };
  const weaponStats = item => {
    const parts = [];
    if (item.swingDamage > 0) parts.push('Swing ' + item.swingDamage);
    if (item.thrustDamage > 0) parts.push('Thrust ' + item.thrustDamage);
    if (item.missileSpeed > 0) parts.push('Speed ' + item.missileSpeed);
    return parts.length ? '&#x2694; ' + parts.join(' &middot; ') : '';
  };
  const horseStats = item => {
    const parts = [];
    if (item.horseSpeed > 0) parts.push('Speed ' + item.horseSpeed);
    if (item.horseManeuver > 0) parts.push('Maneuver ' + item.horseManeuver);
    if (item.horseChargeDamage > 0) parts.push('Charge ' + item.horseChargeDamage);
    if (item.horseArmor > 0) parts.push('Armor ' + item.horseArmor);
    return parts.length ? '&#x1F40E; ' + parts.join(' &middot; ') : '';
  };

  // Render equipment card
  const equipCard = (item, equipType) => {
    const idx = _equipItems.length;
    _equipItems.push(item);
    const tier = item.tier || 0;
    const tColor = tierColor(tier);
    const isHorse = item.slot === 'Horse' || item.slot === 'HorseHarness';
    const weight = item.weight ? parseFloat(item.weight).toFixed(1) : '';
    let stats = armorStats(item) || weaponStats(item) || horseStats(item);
    return '<div class="cmd-equip-card' + (isHorse ? ' cmd-equip-horse' : '') + '" data-tt-idx="' + idx + '" style="border-top:2px solid ' + tColor + '">'
      + '<div class="cmd-equip-icon">' + _slotIcon(item.slot) + '</div>'
      + '<div class="cmd-equip-info">'
      + '<span class="cmd-equip-name">' + esc(item.name) + '</span>'
      + '<span class="cmd-equip-slot">' + _slotLabel(item.slot)
      + (tier > 0 ? ' <span class="cmd-equip-tier" style="color:' + tColor + '">&middot; ' + tierName(tier) + '</span>' : '')
      + (weight ? ' <span class="cmd-equip-weight">&middot; ' + weight + ' wt</span>' : '')
      + '</span>'
      + (stats ? '<span class="cmd-equip-stat">' + stats + '</span>' : '')
      + '</div>'
      + '<button class="cmd-equip-btn cmd-unequip-btn" onclick="event.stopPropagation();cmdUnequipItem(\'' + item.slot + '\',\'' + equipType + '\')" title="Unequip">&#x2716;</button>'
      + '</div>';
  };

  // ── Build mode-toolbar HTML BEFORE opening inv-hub (must live outside the 3-col grid) ──
  let modeToolbarHtml = '';
  const _battleBySlotPre = {};
  battleItems.forEach(i => _battleBySlotPre[i.slot] = i);
  if (_invMode === 'equipment') {
    const gsArmor = battleItems.reduce((s,i) => s + (i.headArmor||0)+(i.bodyArmor||0)+(i.legArmor||0)+(i.armArmor||0), 0);
    const gsDmg = battleItems.reduce((m,i) => Math.max(m, i.swingDamage||0, i.thrustDamage||0), 0);
    const gsTier = battleItems.length > 0 ? (battleItems.reduce((s,i) => s + (i.tier||1), 0) / battleItems.length).toFixed(1) : '0.0';
    const gearScore = gsArmor + gsDmg * 2;
    modeToolbarHtml = `<div class="inv-mode-toolbar">
      <div class="inv-gearscore">
        <div class="inv-gs-icon">\u{2694}</div>
        <div class="inv-gs-info">
          <div class="inv-gs-val" data-count-target="${gearScore}">0</div>
          <div class="inv-gs-lbl">Gear Score</div>
        </div>
        <div class="inv-gs-breakdown">
          <span>\u{1F6E1} <b>${gsArmor}</b></span>
          <span>\u{2694} <b>${gsDmg}</b></span>
          <span>\u{2728} <b>${gsTier}</b> avg tier</span>
        </div>
      </div>
      <div class="inv-mode-actions">
        <button class="inv-mode-btn" onclick="invAutoEquip()" title="Auto-equip best gear">\u{2728} Auto-Equip</button>
      </div>
    </div>`;
  } else if (_invMode === 'inventory') {
    const catCounts = {
      all: allItems.length,
      goods: allItems.filter(i => i.type === 'Goods').length,
      food: allItems.filter(i => i.type === 'Food' || i.type === 'Animal').length,
      gear: allItems.filter(i => i.equippable).length,
      horse: allItems.filter(i => i.type === 'Horse' || i.type === 'HorseHarness').length,
    };
    const invCat = window._invFilterCat || 'all';
    let tb = '<div class="inv-mode-toolbar"><div class="inv-cat-chips">';
    const chips = [
      ['all','All','\u{1F4E6}'], ['goods','Goods','\u{1FA99}'], ['food','Food','\u{1F356}'],
      ['gear','Gear','\u{2694}'], ['horse','Mounts','\u{1F40E}'],
    ];
    chips.forEach(([k,label,icon]) => {
      const c = catCounts[k] || 0;
      tb += `<button class="inv-cat-chip ${invCat===k?'active':''}" onclick="invSetCatFilter('${k}')">${icon} ${label} <b>${c}</b></button>`;
    });
    tb += '</div></div>';
    modeToolbarHtml = tb;
  } else if (_invMode === 'trade') {
    const sumValPre = arr => arr.reduce((s,i) => s + (i.value||0) * i.count, 0);
    const totalSellablePre = sumValPre(allItems);
    const bestTown = (Store.settlements || [])
      .filter(s => (s.type === 'Town' || s.isTown))
      .sort((a,b) => (b.prosperity||0) - (a.prosperity||0))[0];
    if (bestTown && totalSellablePre > 0) {
      const prospMult = Math.min(1.3, 0.85 + ((bestTown.prosperity || 0) / 10000) * 0.45);
      const estValue = Math.round(totalSellablePre * prospMult);
      const profit = estValue - totalSellablePre;
      modeToolbarHtml = `<div class="inv-mode-toolbar inv-best-market">
        <div class="inv-bm-icon">\u{1F4B0}</div>
        <div class="inv-bm-info">
          <div class="inv-bm-kicker">Best Market Recommendation</div>
          <div class="inv-bm-town">${esc(bestTown.name || '?')}</div>
          <div class="inv-bm-meta">${esc(bestTown.kingdom || 'Independent')} &middot; Prosperity <b>${(bestTown.prosperity||0).toLocaleString()}</b> &middot; Multiplier <b>\u00D7${prospMult.toFixed(2)}</b></div>
        </div>
        <div class="inv-bm-profit">
          <div class="inv-bm-profit-val">${estValue.toLocaleString()}\u{25C9}</div>
          <div class="inv-bm-profit-lbl">Est. Sale Value</div>
          <div class="inv-bm-profit-delta">${profit > 0 ? '+' : ''}${profit.toLocaleString()} vs base</div>
        </div>
        <button class="inv-mode-btn" onclick="invTrackSettlement('${esc(bestTown.id)}','${esc(bestTown.name)}')">\u{1F4CD} Travel</button>
      </div>`;
    }
  }
  html += modeToolbarHtml;

  // ── 3-Panel Layout ──
  html += '<div class="inv-hub">';

  const battleBySlot = _battleBySlotPre;
  // Store globally for comparison
  window._invEquipBySlot = battleBySlot;

  // Item card helper for center panel grids
  const itemCard = (item, actions) => {
    const idx = _equipItems.length;
    _equipItems.push(item);
    const tc = tierColor(item.tier||0);
    const tn = tierName(item.tier||0);
    return '<div class="inv-item-card" data-tt-idx="' + idx + '"' + (item.equippable ? ' draggable="true"' : '') + ' onclick="invSelectItem(' + idx + ')" style="border-left:3px solid ' + tc + '">'
      + (item.count > 1 ? '<span class="inv-item-count-badge">x' + item.count + '</span>' : '')
      + '<div class="inv-item-icon">' + (_slotIcon(item.slot||'') || _typeIcon(item.type||'')) + '</div>'
      + '<div class="inv-item-info">'
      + '<span class="inv-item-name">' + esc(item.name) + '</span>'
      + '<span class="inv-item-meta">' + (tn||'') + (item.value ? ' · ' + item.value + '&#x25C9;' : '') + (item.count > 1 ? ' · Total: ' + ((item.value||0)*item.count).toLocaleString() + '&#x25C9;' : '') + '</span>'
      + '</div>'
      + (actions || '')
      + '</div>';
  };

  // Slot card for equipment mode
  const slotCard = (slotName, equipped, eqType) => {
    if (equipped) {
      const idx = _equipItems.length;
      _equipItems.push(equipped);
      const tc = tierColor(equipped.tier||0);
      let stat = '';
      if (equipped.headArmor > 0 || equipped.bodyArmor > 0) {
        const p = [];
        if (equipped.headArmor > 0) p.push('H:'+equipped.headArmor);
        if (equipped.bodyArmor > 0) p.push('B:'+equipped.bodyArmor);
        if (equipped.legArmor > 0) p.push('L:'+equipped.legArmor);
        stat = p.join(' ');
      } else if (equipped.swingDamage > 0) {
        stat = 'Sw:' + equipped.swingDamage + (equipped.thrustDamage > 0 ? ' Th:'+equipped.thrustDamage : '');
      } else if (equipped.horseSpeed > 0) {
        stat = 'Spd:' + equipped.horseSpeed;
      }
      return '<div class="inv-slot inv-slot-filled" data-tt-idx="' + idx + '" onclick="invSelectItem(' + idx + ')" style="border-left:3px solid ' + tc + '">'
        + '<div class="inv-slot-icon">' + _slotIcon(slotName) + '</div>'
        + '<div class="inv-slot-info"><span class="inv-slot-name">' + esc(equipped.name) + '</span>'
        + '<span class="inv-slot-sub">' + _slotLabel(slotName) + (stat ? ' · ' + stat : '') + '</span></div>'
        + '<span class="inv-slot-x" onclick="event.stopPropagation();cmdUnequipItem(\'' + slotName + '\',\'' + eqType + '\')">&#x2716;</span>'
        + '</div>';
    }
    return '<div class="inv-slot inv-slot-empty"><div class="inv-slot-icon">' + _slotIcon(slotName) + '</div>'
      + '<span class="inv-slot-label">' + _slotLabel(slotName) + '</span></div>';
  };

  // ═══ EQUIPMENT MODE ═══
  if (_invMode === 'equipment') {
    // LEFT: Equipment slots
    html += '<div class="inv-left">';
    html += '<div class="inv-panel-title">&#x2694; Equipped Gear</div>';
    const slotGroups = [
      {label:'Weapons',slots:['Weapon0','Weapon1','Weapon2','Weapon3']},
      {label:'Armor',slots:['Head','Body','Gloves','Leg','Cape']},
      {label:'Mount',slots:['Horse','HorseHarness']}
    ];
    for (const g of slotGroups) {
      html += '<div class="inv-slot-group-label">' + g.label + '</div>';
      for (const s of g.slots) html += slotCard(s, battleBySlot[s], 'battle');
    }
    html += '</div>';

    // CENTER: Available gear from inventory
    html += '<div class="inv-center">';
    html += '<div class="inv-panel-title">&#x1F4E6; Available Gear</div>';
    html += '<input class="inv-search" type="text" placeholder="Search..." oninput="cmdInvSearch(this.value)">';
    const gearItems = allItems.filter(i => i.equippable);
    const otherItems = allItems.filter(i => !i.equippable);
    if (gearItems.length > 0) {
      html += '<div class="inv-item-grid">';
      for (const item of gearItems.sort((a,b) => (b.value||0) - (a.value||0))) {
        // Check if this is an upgrade vs currently equipped
        const eqSlot = item.equipSlot;
        const current = battleBySlot[eqSlot];
        let isUpgrade = false;
        if (current && eqSlot) {
          const newArmor = (item.headArmor||0)+(item.bodyArmor||0)+(item.legArmor||0)+(item.armArmor||0);
          const curArmor = (current.headArmor||0)+(current.bodyArmor||0)+(current.legArmor||0)+(current.armArmor||0);
          const newDmg = Math.max(item.swingDamage||0, item.thrustDamage||0);
          const curDmg = Math.max(current.swingDamage||0, current.thrustDamage||0);
          if (newArmor > curArmor || newDmg > curDmg) isUpgrade = true;
        } else if (!current && eqSlot) {
          isUpgrade = true; // Empty slot = any item is an upgrade
        }
        const upgradeTag = isUpgrade ? '<span class="inv-upgrade-badge">&#x25B2; UPGRADE</span>' : '';
        const cardCls = isUpgrade ? ' inv-item-upgrade' : '';
        // Render with upgrade class
        const idx2 = _equipItems.length;
        _equipItems.push(item);
        const tc2 = tierColor(item.tier||0);
        html += '<div class="inv-item-card' + cardCls + '" data-tt-idx="' + idx2 + '" onclick="invSelectItem(' + idx2 + ')" style="border-left:3px solid ' + tc2 + '">'
          + '<div class="inv-item-icon">' + (_slotIcon(item.slot||'') || _typeIcon(item.type||'')) + '</div>'
          + '<div class="inv-item-info"><span class="inv-item-name">' + esc(item.name) + '</span>'
          + '<span class="inv-item-meta">' + (tierName(item.tier||'')||'') + (item.value ? ' · ' + item.value + '&#x25C9;' : '') + '</span></div>'
          + upgradeTag
          + '<button class="inv-equip-btn" onclick="event.stopPropagation();cmdEquipItem(\'' + esc(item.id) + '\',\'' + item.equipSlot + '\',\'battle\')">Equip</button></div>';
      }
      html += '</div>';
    }
    if (otherItems.length > 0) {
      html += '<div class="inv-panel-sub">Other Items (' + otherItems.length + ')</div>';
      html += '<div class="inv-item-grid">';
      for (const item of otherItems.sort((a,b) => (b.value||0) - (a.value||0)).slice(0, 20)) {
        html += itemCard(item);
      }
      if (otherItems.length > 20) html += '<div class="inv-more">+' + (otherItems.length-20) + ' more...</div>';
      html += '</div>';
    }
    if (!gearItems.length && !otherItems.length) html += '<div class="inv-empty">No items in inventory</div>';
    html += '</div>';
  }

  // ═══ INVENTORY MODE ═══
  else if (_invMode === 'inventory') {
    // LEFT: Categories + Weight Breakdown + Tier Filter + Bulk Actions
    const groups = {};
    for (const item of allItems) { const t = item.type||'Other'; if (!groups[t]) groups[t] = []; groups[t].push(item); }
    const sortedTypes = Object.keys(groups).sort();

    html += '<div class="inv-left">';

    // Categories
    html += '<div class="inv-panel-title">&#x1F4CB; Categories</div>';
    html += '<div class="inv-cat-list">';
    html += '<div class="inv-cat inv-cat-active" onclick="invFilterCat(this,\'all\')">All <b>' + totalItemCount + '</b></div>';
    for (const type of sortedTypes) {
      html += '<div class="inv-cat" onclick="invFilterCat(this,\'' + esc(type) + '\')">' + _typeIcon(type) + ' ' + esc(type) + ' <b>' + groups[type].length + '</b></div>';
    }
    html += '</div>';

    // Tier filter
    html += '<div class="inv-panel-sub">&#x1F3F0; Filter by Tier</div>';
    html += '<div class="inv-tier-filters">';
    html += '<span class="inv-tier-btn inv-tier-active" onclick="invFilterTier(this,0)">All</span>';
    for (let t = 1; t <= 6; t++) {
      const tn = ({1:'Common',2:'Fine',3:'Superior',4:'Master',5:'Legend',6:'Mythic'})[t];
      html += '<span class="inv-tier-btn" onclick="invFilterTier(this,' + t + ')" style="border-color:' + tierColor(t) + '">' + tn + '</span>';
    }
    html += '</div>';

    // Weight breakdown
    html += '<div class="inv-panel-sub">&#x2696; Weight Breakdown</div>';
    html += '<div class="inv-weight-breakdown">';
    const weightByType = {};
    allItems.forEach(i => { const t = i.type||'Other'; weightByType[t] = (weightByType[t]||0) + (i.weight||0) * i.count; });
    const sortedByWeight = Object.entries(weightByType).sort((a,b) => b[1] - a[1]);
    const maxWt = sortedByWeight.length > 0 ? sortedByWeight[0][1] : 1;
    for (const [type, wt] of sortedByWeight) {
      if (wt <= 0) continue;
      html += '<div class="inv-wt-row">';
      html += '<span class="inv-wt-label">' + esc(type) + '</span>';
      html += '<div class="inv-wt-bar"><div class="inv-wt-fill" style="width:' + Math.round(wt/maxWt*100) + '%"></div></div>';
      html += '<span class="inv-wt-val">' + wt.toFixed(0) + '</span>';
      html += '</div>';
    }
    html += '</div>';

    // Bulk actions
    html += '<div class="inv-panel-sub">&#x26A1; Quick Actions</div>';
    html += '<div class="inv-bulk-actions">';
    html += '<span class="inv-action" onclick="invBulkAction(\'unequipAll\')">&#x2716; Unequip All</span>';
    html += '<span class="inv-action" onclick="invSortAll()">&#x2195; Sort by Value</span>';
    html += '</div>';

    html += '</div>';

    // CENTER: Item grid with tier data attributes
    html += '<div class="inv-center">';
    html += '<div class="inv-panel-title">&#x1F4E6; Items</div>';
    html += '<div class="inv-toolbar"><input class="inv-search" type="text" placeholder="Search items..." oninput="cmdInvSearch(this.value)">';
    html += '<select class="inv-sort" onchange="cmdInvSort(this.value)"><option value="value">Value</option><option value="name">Name</option><option value="weight">Weight</option></select></div>';
    html += '<div class="inv-item-grid" id="invItemGrid">';
    for (const item of allItems.sort((a,b) => (b.value||0) - (a.value||0))) {
      const act = item.equippable ? '<button class="inv-equip-btn" onclick="event.stopPropagation();cmdEquipItem(\'' + esc(item.id) + '\',\'' + item.equipSlot + '\',\'battle\')">Equip</button>' : '';
      const fav = window._invFavorites[item.id] ? ' inv-item-fav' : '';
      const idx3 = _equipItems.length;
      _equipItems.push(item);
      const tc3 = tierColor(item.tier||0);
      html += '<div class="inv-item-card' + fav + '" data-tt-idx="' + idx3 + '" data-tier="' + (item.tier||0) + '" data-type="' + esc(item.type||'Other') + '" onclick="invSelectItem(' + idx3 + ')" style="border-left:3px solid ' + tc3 + '">';
      html += '<div class="inv-item-icon">' + (_slotIcon(item.slot||'') || _typeIcon(item.type||'')) + '</div>';
      html += '<div class="inv-item-info"><span class="inv-item-name">' + esc(item.name) + (item.count > 1 ? ' <small>x' + item.count + '</small>' : '') + '</span>';
      html += '<span class="inv-item-meta">' + (tierName(item.tier||'')||esc(item.type||'')) + (item.value ? ' · ' + item.value + '&#x25C9;' : '') + (item.weight ? ' · ' + parseFloat(item.weight).toFixed(1) + 'wt' : '') + '</span></div>';
      if (window._invFavorites[item.id]) html += '<span class="inv-fav-star">&#x2605;</span>';
      html += (act || '');
      html += '</div>';
    }
    html += '</div>';
    if (!allItems.length) html += '<div class="inv-empty">No items</div>';
    html += '</div>';
  }

  // ═══ PARTY MODE — Full Companion Manager ═══
  else if (_invMode === 'party') {
    // Calculate stats from equipped items
    const calcGearStats = (items) => {
      let armor = 0, dmg = 0, weight = 0;
      (items || []).forEach(i => {
        armor += (i.headArmor||0)+(i.bodyArmor||0)+(i.legArmor||0)+(i.armArmor||0);
        dmg = Math.max(dmg, i.swingDamage||0, i.thrustDamage||0);
        weight += parseFloat(i.weight||0);
      });
      return {armor, dmg, weight};
    };
    const myStats = calcGearStats(battleItems);

    // LEFT: Party members with per-member gear score
    html += '<div class="inv-left">';
    html += '<div class="inv-panel-title">&#x1F465; Party Members</div>';
    html += '<div class="inv-party-list">';
    for (const h2 of clanHeroes) {
      const tag = h2.isPlayer ? 'Leader' : h2.isCompanion ? 'Companion' : 'Family';
      const active = h2.id === _invHeroId || (h2.isPlayer && !_invHeroId);
      // Per-member gear score (uses myStats for active; 0 for others until we fetch them)
      const memberScore = active ? (myStats.armor + myStats.dmg * 2) : 0;
      const maxScore = 800;
      const scorePct = Math.min(100, (memberScore / maxScore) * 100);
      html += '<div class="inv-party-member' + (active ? ' inv-party-member-active' : '') + '" onclick="invSwitchHero(\'' + esc(h2.id) + '\')">';
      html += '<div class="inv-pm-top">';
      html += '<span class="inv-pm-name">' + esc(h2.name) + '</span>';
      html += '<span class="inv-pm-tag">' + tag + '</span>';
      html += '</div>';
      if (active) {
        html += '<div class="inv-pm-stats">';
        html += '<span>&#x1F6E1; ' + myStats.armor + '</span>';
        html += '<span>&#x2694; ' + myStats.dmg + '</span>';
        html += '<span>&#x2696; ' + myStats.weight.toFixed(0) + '</span>';
        html += '</div>';
        html += '<div class="inv-pm-score-row">';
        html += '<span class="inv-pm-score-lbl">Gear Score</span>';
        html += '<div class="inv-pm-score-bar"><div class="inv-pm-score-fill" style="width:' + scorePct + '%"></div></div>';
        html += '<span class="inv-pm-score-val">' + memberScore + '</span>';
        html += '</div>';
      } else {
        // Show role + location even when inactive
        if (h2.location) html += '<div class="inv-pm-loc">&#x1F4CD; ' + esc(h2.location) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Actions
    html += '<div class="inv-panel-sub">&#x26A1; Actions</div>';
    html += '<div class="inv-bulk-actions">';
    html += '<span class="inv-action" onclick="invAutoEquip()">&#x2694; Best Gear For ' + esc(selectedHero?.name||'Hero') + '</span>';
    html += '</div>';
    html += '</div>';

    // CENTER: Equipment with full stats
    html += '<div class="inv-center">';
    const heroName = selectedHero ? selectedHero.name : 'Hero';
    html += '<div class="inv-panel-title">&#x2694; ' + esc(heroName) + '\'s Equipment</div>';

    // Summary bar
    html += '<div class="inv-party-summary">';
    html += '<span class="inv-ps-stat">&#x1F6E1; <b>' + myStats.armor + '</b> Total Armor</span>';
    html += '<span class="inv-ps-stat">&#x2694; <b>' + myStats.dmg + '</b> Max Damage</span>';
    html += '<span class="inv-ps-stat">&#x2696; <b>' + myStats.weight.toFixed(1) + '</b> Gear Weight</span>';
    html += '</div>';

    // Equipment slots with stats — only show filled + relevant empty
    html += '<div class="inv-party-gear">';
    const weaponSlots = ['Weapon0','Weapon1','Weapon2','Weapon3'];
    const armorSlots = ['Head','Body','Gloves','Leg','Cape'];
    const mountSlots = ['Horse','HorseHarness'];

    const renderPartySlot = (s) => {
      const eq = battleBySlot[s];
      if (!eq) return '';
      const tc = tierColor(eq.tier||0);
      const tn = tierName(eq.tier||0);
      let stat = '';
      const ta = (eq.headArmor||0)+(eq.bodyArmor||0)+(eq.legArmor||0)+(eq.armArmor||0);
      if (ta > 0) stat = '&#x1F6E1; ' + ta;
      else if (eq.swingDamage > 0) stat = '&#x2694; Sw:' + eq.swingDamage + (eq.thrustDamage > 0 ? ' Th:'+eq.thrustDamage : '');
      else if (eq.horseSpeed > 0) stat = '&#x1F40E; Spd:' + eq.horseSpeed;
      const idx4 = _equipItems.length;
      _equipItems.push(eq);
      return '<div class="inv-pg-slot" data-tt-idx="' + idx4 + '" onclick="invSelectItem(' + idx4 + ')" style="border-left:3px solid ' + tc + '">'
        + '<span class="inv-pg-icon">' + _slotIcon(s) + '</span>'
        + '<div class="inv-pg-info">'
        + '<span class="inv-pg-name">' + esc(eq.name) + '</span>'
        + '<span class="inv-pg-meta">' + _slotLabel(s) + (tn ? ' · ' + tn : '') + '</span>'
        + '</div>'
        + (stat ? '<span class="inv-pg-stat">' + stat + '</span>' : '')
        + '<span class="inv-pg-x" onclick="event.stopPropagation();cmdUnequipItem(\'' + s + '\',\'battle\')">&#x2716;</span>'
        + '</div>';
    };

    // Weapons
    const activeWeapons = weaponSlots.filter(s => battleBySlot[s]);
    const emptyWeapons = weaponSlots.filter(s => !battleBySlot[s]);
    if (activeWeapons.length > 0 || emptyWeapons.length > 0) {
      html += '<div class="inv-pg-group">&#x2694; Weapons</div>';
      for (const s of activeWeapons) html += renderPartySlot(s);
      if (emptyWeapons.length > 0 && activeWeapons.length < 4) {
        html += '<div class="inv-pg-empty">' + emptyWeapons.length + ' empty weapon slot' + (emptyWeapons.length > 1 ? 's' : '') + '</div>';
      }
    }

    // Armor
    html += '<div class="inv-pg-group">&#x1F6E1; Armor</div>';
    for (const s of armorSlots) {
      const eq = battleBySlot[s];
      if (eq) { html += renderPartySlot(s); }
      else { html += '<div class="inv-pg-slot inv-pg-slot-empty"><span class="inv-pg-icon">' + _slotIcon(s) + '</span><span class="inv-pg-empty-label">' + _slotLabel(s) + ' — Empty</span></div>'; }
    }

    // Mount
    if (battleBySlot.Horse || battleBySlot.HorseHarness) {
      html += '<div class="inv-pg-group">&#x1F40E; Mount</div>';
      for (const s of mountSlots) { if (battleBySlot[s]) html += renderPartySlot(s); }
    }
    html += '</div>';

    // Available upgrades from inventory
    const upgrades = allItems.filter(i => {
      if (!i.equippable) return false;
      const slot = i.equipSlot;
      const current = battleBySlot[slot];
      if (!current) return true;
      const newA = (i.headArmor||0)+(i.bodyArmor||0)+(i.legArmor||0)+(i.armArmor||0);
      const curA = (current.headArmor||0)+(current.bodyArmor||0)+(current.legArmor||0)+(current.armArmor||0);
      const newD = Math.max(i.swingDamage||0, i.thrustDamage||0);
      const curD = Math.max(current.swingDamage||0, current.thrustDamage||0);
      return newA > curA || newD > curD;
    });
    if (upgrades.length > 0) {
      html += '<div class="inv-panel-sub">&#x25B2; Available Upgrades (' + upgrades.length + ')</div>';
      html += '<div class="inv-item-grid">';
      for (const item of upgrades.sort((a,b) => (b.value||0) - (a.value||0))) {
        html += itemCard(item, '<button class="inv-equip-btn" onclick="event.stopPropagation();cmdEquipItem(\'' + esc(item.id) + '\',\'' + item.equipSlot + '\',\'battle\')">Equip</button>');
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // ═══ TRADE MODE ═══
  else if (_invMode === 'trade') {
    const sumVal = arr => arr.reduce((s,i) => s + (i.value||0) * i.count, 0);
    const tradeGoods = allItems.filter(i => i.type === 'Goods');
    const foodItems = allItems.filter(i => i.type === 'Food' || i.type === 'Animal');
    const sellableGear = allItems.filter(i => i.equippable);
    const otherSellable = allItems.filter(i => !i.equippable && i.type !== 'Goods' && i.type !== 'Food' && i.type !== 'Animal');
    const totalSellable = sumVal(allItems);

    // Best sell locations from settlement data
    const towns = (Store.settlements || []).filter(s => s.type === 'Town' || s.isTown).sort((a,b) => (b.prosperity||0) - (a.prosperity||0));

    // LEFT: Trade Summary + Best Markets
    html += '<div class="inv-left">';
    html += '<div class="inv-panel-title">&#x1F4B0; Trade Overview</div>';

    // Wealth summary
    html += '<div class="inv-trade-summary">';
    html += '<div class="inv-trade-stat"><span class="inv-trade-stat-val">' + gold.toLocaleString() + '</span><span class="inv-trade-stat-lbl">&#x25C9; Treasury</span></div>';
    html += '<div class="inv-trade-stat"><span class="inv-trade-stat-val">' + totalSellable.toLocaleString() + '</span><span class="inv-trade-stat-lbl">&#x25C9; Cargo Value</span></div>';
    html += '<div class="inv-trade-stat inv-trade-stat-total"><span class="inv-trade-stat-val">' + (gold + totalSellable).toLocaleString() + '</span><span class="inv-trade-stat-lbl">&#x25C9; Total Wealth</span></div>';
    html += '</div>';

    // Cargo breakdown
    html += '<div class="inv-panel-sub">&#x1F4CB; Cargo Breakdown</div>';
    html += '<div class="inv-trade-cats">';
    const cats = [
      {name:'Trade Goods',val:sumVal(tradeGoods),icon:'&#x1F4E6;',cls:'inv-tcat-goods'},
      {name:'Food & Livestock',val:sumVal(foodItems),icon:'&#x1F356;',cls:'inv-tcat-food'},
      {name:'Equipment',val:sumVal(sellableGear),icon:'&#x2694;',cls:'inv-tcat-gear'},
      {name:'Other',val:sumVal(otherSellable),icon:'&#x25C6;',cls:''}
    ];
    for (const c of cats) {
      if (c.val <= 0) continue;
      const pct = Math.round(c.val / Math.max(totalSellable,1) * 100);
      html += '<div class="inv-trade-cat ' + c.cls + '">';
      html += '<span>' + c.icon + ' ' + c.name + '</span>';
      html += '<div class="inv-trade-cat-bar"><div class="inv-trade-cat-fill" style="width:' + pct + '%"></div></div>';
      html += '<b>' + c.val.toLocaleString() + '</b>';
      html += '</div>';
    }
    html += '</div>';

    // Best markets
    if (towns.length > 0) {
      html += '<div class="inv-panel-sub">&#x1F3F0; Best Markets to Sell</div>';
      html += '<div class="inv-trade-markets">';
      const topTowns = towns.slice(0, 8);
      for (const town of topTowns) {
        const prosp = Math.round(town.prosperity || 0);
        // Higher prosperity = better prices (roughly 70-130% of base value)
        const priceMult = Math.min(1.3, 0.7 + (prosp / 10000) * 0.6);
        const estSellVal = Math.round(totalSellable * priceMult);
        const profitPct = Math.round((priceMult - 1) * 100);
        const profitCls = profitPct >= 10 ? 'inv-profit-high' : profitPct >= 0 ? 'inv-profit-mid' : 'inv-profit-low';
        html += '<div class="inv-trade-market" onclick="invTrackSettlement(\'' + esc(town.id) + '\',\'' + esc(town.name) + '\')">';
        html += '<div class="inv-trade-market-info">';
        html += '<span class="inv-trade-market-name">&#x1F3F0; ' + esc(town.name) + '</span>';
        html += '<span class="inv-trade-market-meta">' + esc(town.culture||'') + ' &middot; Prosperity ' + prosp.toLocaleString() + '</span>';
        html += '</div>';
        html += '<div class="inv-trade-market-price">';
        html += '<span class="inv-trade-market-est">~' + estSellVal.toLocaleString() + ' &#x25C9;</span>';
        html += '<span class="inv-trade-market-pct ' + profitCls + '">' + (profitPct >= 0 ? '+' : '') + profitPct + '%</span>';
        html += '</div>';
        html += '<span class="inv-trade-track" title="Mark on map">&#x1F4CD;</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // CENTER: Items ranked by sell priority
    html += '<div class="inv-center">';
    html += '<div class="inv-panel-title">&#x1F4E6; Sell Priority</div>';
    html += '<div class="inv-trade-legend">Sorted by value per weight — best profit density first</div>';

    const ranked = allItems.filter(i => (i.value||0) > 0).map(i => {
      const vw = (i.weight||0) > 0 ? (i.value / i.weight) : i.value * 10;
      return {...i, vwRatio: vw};
    }).sort((a,b) => b.vwRatio - a.vwRatio);

    html += '<div class="inv-item-grid">';
    let rank = 1;
    for (const item of ranked) {
      const idx = _equipItems.length;
      _equipItems.push(item);
      const tc = tierColor(item.tier||0);
      const totalVal = (item.value||0) * item.count;
      const ratio = item.vwRatio.toFixed(0);
      const isGood = item.type === 'Goods';
      const isFood = item.type === 'Food' || item.type === 'Animal';
      html += '<div class="inv-item-card' + (isGood ? ' inv-trade-good' : '') + (isFood ? ' inv-trade-food' : '') + '" data-tt-idx="' + idx + '" onclick="invSelectItem(' + idx + ')" style="border-left:3px solid ' + tc + '">';
      html += '<span class="inv-trade-rank">#' + rank + '</span>';
      html += '<div class="inv-item-icon">' + _typeIcon(item.type||'') + '</div>';
      html += '<div class="inv-item-info">';
      html += '<span class="inv-item-name">' + esc(item.name) + (item.count > 1 ? ' <small>x' + item.count + '</small>' : '') + '</span>';
      html += '<span class="inv-item-meta">' + esc(item.type||'') + ' &middot; ' + ratio + '&#x25C9;/wt' + (item.culture ? ' &middot; ' + esc(item.culture) : '') + '</span>';
      html += '</div>';
      html += '<span class="inv-trade-val">' + totalVal.toLocaleString() + ' &#x25C9;</span>';
      html += '</div>';
      rank++;
    }
    if (!ranked.length) html += '<div class="inv-empty">No items to sell</div>';
    html += '</div>';
    html += '</div>';
  }

  // ═══ RIGHT PANEL: Smart Inspector (all modes) ═══
  html += '<div class="inv-right" id="invInspector">';
  html += '<div class="inv-panel-title">&#x1F50D; Inspector</div>';
  html += '<div class="inv-inspector-empty">Select an item to inspect</div>';
  html += '</div>';

  html += '</div>'; // end inv-hub

  // ── Bottom Action Bar ──
  html += '<div class="inv-action-bar">';
  html += '<span class="inv-action" onclick="invAutoEquip()">&#x2694; Auto-Equip Best</span>';
  html += '<span class="inv-action" onclick="invSortAll()">&#x2195; Sort All</span>';
  if (allItems.some(i => i.type === 'Goods' || i.type === 'Food')) {
    const sellVal = allItems.filter(i => i.type==='Goods').reduce((s,i) => s + (i.value||0)*i.count, 0);
    html += '<span class="inv-action inv-action-sell" onclick="invSellGoods(\'goods\',' + sellVal + ')">&#x1F4B0; Sell Trade Goods (' + sellVal.toLocaleString() + '&#x25C9;)</span>';
  }
  html += '</div>';
  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
  /* OLD PAPERDOLL CODE REMOVED */
  if (false) { const battleBySlot = {};
  battleItems.forEach(i => battleBySlot[i.slot] = i);
  const civBySlot = {};
  civItems.forEach(i => civBySlot[i.slot] = i);

  const renderSlot = (slotName, equipped, eqType) => {
    if (equipped) {
      const idx = _equipItems.length;
      _equipItems.push(equipped);
      const tc = tierColor(equipped.tier||0);
      const tn = tierName(equipped.tier||0);
      let stat = '';
      if (equipped.bodyArmor > 0 || equipped.headArmor > 0 || equipped.legArmor > 0) {
        const parts = [];
        if (equipped.headArmor > 0) parts.push('H:' + equipped.headArmor);
        if (equipped.bodyArmor > 0) parts.push('B:' + equipped.bodyArmor);
        if (equipped.legArmor > 0) parts.push('L:' + equipped.legArmor);
        if (equipped.armArmor > 0) parts.push('A:' + equipped.armArmor);
        stat = parts.join(' ');
      } else if (equipped.swingDamage > 0 || equipped.thrustDamage > 0) {
        const parts = [];
        if (equipped.swingDamage > 0) parts.push('Sw:' + equipped.swingDamage);
        if (equipped.thrustDamage > 0) parts.push('Th:' + equipped.thrustDamage);
        stat = parts.join(' ');
      } else if (equipped.horseSpeed > 0) {
        stat = 'Spd:' + equipped.horseSpeed + ' Mnv:' + (equipped.horseManeuver||0);
      }
      return '<div class="pd-slot pd-filled" data-tt-idx="' + idx + '" style="border-left:3px solid ' + tc + '">'
        + '<div class="pd-slot-icon">' + _slotIcon(slotName) + '</div>'
        + '<div class="pd-slot-info">'
        + '<span class="pd-slot-name">' + esc(equipped.name) + '</span>'
        + '<span class="pd-slot-sub">' + _slotLabel(slotName) + (tn ? ' · <span style="color:'+tc+'">' + tn + '</span>' : '') + '</span>'
        + (stat ? '<span class="pd-slot-stat">' + stat + '</span>' : '')
        + '</div>'
        + '<span class="pd-slot-x" onclick="event.stopPropagation();cmdUnequipItem(\'' + slotName + '\',\'' + eqType + '\')" title="Unequip">&#x2716;</span>'
        + '</div>';
    }
    return '<div class="pd-slot pd-empty"><div class="pd-slot-icon">' + _slotIcon(slotName) + '</div>'
      + '<span class="pd-slot-label">' + _slotLabel(slotName) + '</span></div>';
  };

  html += '<h3 class="cmd-section-title">Battle Equipment</h3>';
  const portraitSrc = _cmdData?.hero?.heroId ? 'Hero/' + _cmdData.hero.heroId + '.png' : '';

  // All battle slots in organized groups
  html += '<div class="pd-sections">';

  // Weapons row
  html += '<div class="pd-section">';
  html += '<div class="pd-section-label">&#x2694; Weapons</div>';
  html += '<div class="pd-slot-grid">';
  html += renderSlot('Weapon0', battleBySlot.Weapon0, 'battle');
  html += renderSlot('Weapon1', battleBySlot.Weapon1, 'battle');
  html += renderSlot('Weapon2', battleBySlot.Weapon2, 'battle');
  html += renderSlot('Weapon3', battleBySlot.Weapon3, 'battle');
  html += '</div></div>';

  // Armor row
  html += '<div class="pd-section">';
  html += '<div class="pd-section-label">&#x1F6E1; Armor</div>';
  html += '<div class="pd-slot-grid">';
  html += renderSlot('Head', battleBySlot.Head, 'battle');
  html += renderSlot('Body', battleBySlot.Body, 'battle');
  html += renderSlot('Gloves', battleBySlot.Gloves, 'battle');
  html += renderSlot('Leg', battleBySlot.Leg, 'battle');
  html += renderSlot('Cape', battleBySlot.Cape, 'battle');
  html += '</div></div>';

  // Mount row
  html += '<div class="pd-section">';
  html += '<div class="pd-section-label">&#x1F40E; Mount</div>';
  html += '<div class="pd-slot-grid pd-slot-grid-2">';
  html += renderSlot('Horse', battleBySlot.Horse, 'battle');
  html += renderSlot('HorseHarness', battleBySlot.HorseHarness, 'battle');
  html += '</div></div>';

  html += '</div>';

  // ── Civilian Equipment (compact) ──
  html += '<h3 class="cmd-section-title">Civilian Equipment</h3>';
  html += '<div class="cmd-equip-layout">';
  if (civItems.length) {
    for (const item of civItems) html += equipCard(item, 'civilian');
  } else {
    html += '<div class="cmd-quest-empty">No civilian equipment.</div>';
  }
  html += '</div>';

  // ── Party Inventory ──
  if (inv?.items?.length) {
    html += '<h3 class="cmd-section-title">Party Inventory</h3>';
    // Search + Sort bar
    html += '<div class="inv-toolbar">';
    html += '<input class="inv-search" type="text" placeholder="Search items..." oninput="cmdInvSearch(this.value)">';
    html += '<select class="inv-sort" onchange="cmdInvSort(this.value)">';
    html += '<option value="value">Sort: Value</option>';
    html += '<option value="name">Sort: Name</option>';
    html += '<option value="weight">Sort: Weight</option>';
    html += '<option value="count">Sort: Count</option>';
    html += '</select>';
    html += '</div>';
    let totalValue = 0, totalWeight = 0, totalItems = 0;
    inv.items.forEach(i => { totalValue += (i.value||0) * i.count; totalWeight += (i.weight||0) * i.count; totalItems += i.count; });
    const groups = {};
    for (const item of inv.items) {
      const type = item.type || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    }
    const sortedGroups = Object.entries(groups).sort((a,b) => {
      return b[1].reduce((s,i) => s + (i.value||0) * i.count, 0) - a[1].reduce((s,i) => s + (i.value||0) * i.count, 0);
    });

    html += '<div class="cmd-inv-summary">';
    html += '<span>' + totalItems + ' items</span>';
    html += '<span>Value: <strong>' + totalValue.toLocaleString() + ' &#x25C9;</strong></span>';
    html += '<span>Weight: <strong>' + totalWeight.toFixed(1) + '</strong></span>';
    html += '</div>';

    html += '<div class="cmd-inv-filters">';
    html += '<span class="cmd-inv-tag active" onclick="cmdInvFilter(this,\'all\')">All</span>';
    for (const [type, items] of sortedGroups) {
      html += '<span class="cmd-inv-tag" onclick="cmdInvFilter(this,\'' + esc(type) + '\')">' + _typeIcon(type) + ' ' + esc(type) + ' <small>' + items.length + '</small></span>';
    }
    html += '</div>';

    for (const [type, items] of sortedGroups) {
      const groupVal = items.reduce((s,i) => s + (i.value||0) * i.count, 0);
      html += '<div class="cmd-inv-group" data-inv-type="' + esc(type) + '">';
      html += '<div class="cmd-inv-group-header" onclick="this.classList.toggle(\'collapsed\');this.nextElementSibling.classList.toggle(\'hidden\')">';
      html += '<span class="cmd-qg-arrow">&#x25BC;</span>';
      html += '<span class="cmd-inv-group-icon">' + _typeIcon(type) + '</span>';
      html += '<span class="cmd-inv-group-name">' + esc(type) + '</span>';
      html += '<span class="cmd-inv-group-count">' + items.length + '</span>';
      html += '<span class="cmd-inv-group-val">' + groupVal.toLocaleString() + ' &#x25C9;</span>';
      html += '</div><div class="cmd-inv-group-body">';
      items.sort((a,b) => (b.value||0) - (a.value||0));
      for (const item of items) {
        const idx = _equipItems.length;
        _equipItems.push(item);
        html += '<div class="cmd-inv-row" data-tt-idx="' + idx + '">';
        html += '<span class="cmd-inv-icon">' + _typeIcon(type) + '</span>';
        html += '<span class="cmd-inv-name">' + esc(item.name) + '</span>';
        if (item.equippable) html += '<button class="cmd-equip-btn" onclick="event.stopPropagation();cmdEquipItem(\'' + esc(item.id) + '\',\'' + item.equipSlot + '\',\'battle\')" title="Equip">&#x2B06; Equip</button>';
        html += '<span class="cmd-inv-weight">' + parseFloat(item.weight||0).toFixed(1) + '</span>';
        html += '<span class="cmd-inv-count">x' + item.count + '</span>';
        html += '<span class="cmd-inv-val">' + (item.value||0).toLocaleString() + ' &#x25C9;</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
  }
  } // end if(false) — old code block

  // Bind tooltips + click inspector
  el.querySelectorAll('[data-tt-idx]').forEach(row => {
    const idx = parseInt(row.dataset.ttIdx);
    const item = _equipItems[idx];
    if (!item) return;
    row.addEventListener('mouseenter', () => showItemTooltip(row, item));
    row.addEventListener('mouseleave', hideItemTooltip);
  });

  // Store items globally for inspector
  window._invItems = _equipItems;
}

function invSwitchMode(mode) {
  _invMode = mode;
  _invSelectedItem = null;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdInventory(el);
}

function invSwitchHero(heroId) {
  _invHeroId = heroId;
  _invSelectedItem = null;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdInventory(el);
}

function invSelectItem(idx) {
  const item = window._invItems?.[idx];
  if (!item) return;
  _invSelectedItem = item;
  const panel = document.getElementById('invInspector');
  if (!panel) return;
  const tc = ({1:'#7a7a6a',2:'#7a9a5a',3:'#8aaa68',4:'#d4b048',5:'#e0c060',6:'#f0d848'})[item.tier] || '#8a7a5a';
  const tn = ({1:'Common',2:'Fine',3:'Superior',4:'Masterwork',5:'Legendary',6:'Mythic'})[item.tier] || '';
  const tierDesc = ({1:'A simple, functional piece.',2:'Well-crafted by a skilled artisan.',3:'Superior quality, rare and reliable.',
    4:'Forged by a master — prized by lords.',5:'A weapon of legend, whispered of in songs.',6:'An artifact beyond mortal craft.'})[item.tier] || '';

  // Item type flavor
  const slotIcon = _slotIcon(item.slot||'') || _typeIcon(item.type||'') || '&#x25C6;';
  const totalArmor = (item.headArmor||0) + (item.bodyArmor||0) + (item.legArmor||0) + (item.armArmor||0);
  const maxDmg = Math.max(item.swingDamage||0, item.thrustDamage||0);
  const vwRatio = (item.weight||0) > 0 ? ((item.value||0) / item.weight).toFixed(0) : '—';

  let h = '';
  // Header with icon and name
  h += '<div class="insp-header">';
  h += '<div class="insp-icon" style="border-color:' + tc + '">' + slotIcon + '</div>';
  h += '<div class="insp-header-info">';
  h += '<div class="insp-name" style="color:' + tc + '">' + esc(item.name) + '</div>';
  h += '<div class="insp-tier" style="color:' + tc + '">' + (tn || esc(item.type||'Item')) + '</div>';
  h += '</div></div>';

  // Flavor text
  if (tierDesc) h += '<div class="insp-flavor">"' + tierDesc + '"</div>';

  // ── Core Stats ──
  h += '<div class="insp-section">Properties</div>';
  h += '<div class="insp-stats">';
  if (item.slot) h += '<div class="insp-row"><span>&#x1F6E1; Slot</span><b>' + (_slotLabel(item.slot)||item.slot) + '</b></div>';
  if (item.type) h += '<div class="insp-row"><span>&#x1F4CB; Type</span><b>' + esc(item.type) + '</b></div>';
  h += '<div class="insp-row"><span>&#x25C9; Value</span><b class="insp-gold">' + (item.value||0).toLocaleString() + '</b></div>';
  h += '<div class="insp-row"><span>&#x2696; Weight</span><b>' + parseFloat(item.weight||0).toFixed(1) + '</b></div>';
  h += '<div class="insp-row"><span>&#x1F4B0; Value/Weight</span><b>' + vwRatio + '</b></div>';
  if (item.count > 1) h += '<div class="insp-row"><span>&#x1F4E6; Stack</span><b>' + item.count + ' (' + ((item.value||0)*item.count).toLocaleString() + ' &#x25C9; total)</b></div>';
  h += '</div>';

  // ── Combat Stats ──
  if (totalArmor > 0 || maxDmg > 0 || item.horseSpeed > 0) {
    h += '<div class="insp-section">' + (totalArmor > 0 ? 'Defense' : maxDmg > 0 ? 'Offense' : 'Mount') + '</div>';
    h += '<div class="insp-stats">';
    // Armor bars
    if (item.headArmor > 0) h += '<div class="insp-bar-row"><span>Head</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-armor" style="width:' + Math.min(100,item.headArmor/60*100) + '%"></div></div><b>' + item.headArmor + '</b></div>';
    if (item.bodyArmor > 0) h += '<div class="insp-bar-row"><span>Body</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-armor" style="width:' + Math.min(100,item.bodyArmor/60*100) + '%"></div></div><b>' + item.bodyArmor + '</b></div>';
    if (item.legArmor > 0) h += '<div class="insp-bar-row"><span>Leg</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-armor" style="width:' + Math.min(100,item.legArmor/60*100) + '%"></div></div><b>' + item.legArmor + '</b></div>';
    if (item.armArmor > 0) h += '<div class="insp-bar-row"><span>Arm</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-armor" style="width:' + Math.min(100,item.armArmor/60*100) + '%"></div></div><b>' + item.armArmor + '</b></div>';
    if (totalArmor > 0) h += '<div class="insp-row insp-row-total"><span>Total Protection</span><b>' + totalArmor + '</b></div>';
    // Weapon bars
    if (item.swingDamage > 0) h += '<div class="insp-bar-row"><span>Swing</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-dmg" style="width:' + Math.min(100,item.swingDamage/150*100) + '%"></div></div><b>' + item.swingDamage + '</b></div>';
    if (item.thrustDamage > 0) h += '<div class="insp-bar-row"><span>Thrust</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-dmg" style="width:' + Math.min(100,item.thrustDamage/150*100) + '%"></div></div><b>' + item.thrustDamage + '</b></div>';
    if (item.missileSpeed > 0) h += '<div class="insp-row"><span>Missile Speed</span><b>' + item.missileSpeed + '</b></div>';
    if (item.weaponLength > 0) h += '<div class="insp-row"><span>Reach</span><b>' + item.weaponLength + '</b></div>';
    if (item.handling > 0) h += '<div class="insp-row"><span>Handling</span><b>' + item.handling + '</b></div>';
    // Horse bars
    if (item.horseSpeed > 0) h += '<div class="insp-bar-row"><span>Speed</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-horse" style="width:' + Math.min(100,item.horseSpeed/70*100) + '%"></div></div><b>' + item.horseSpeed + '</b></div>';
    if (item.horseManeuver > 0) h += '<div class="insp-bar-row"><span>Maneuver</span><div class="insp-bar"><div class="insp-bar-fill insp-bar-horse" style="width:' + Math.min(100,item.horseManeuver/70*100) + '%"></div></div><b>' + item.horseManeuver + '</b></div>';
    if (item.horseChargeDamage > 0) h += '<div class="insp-row"><span>Charge Damage</span><b>' + item.horseChargeDamage + '</b></div>';
    if (item.horseArmor > 0) h += '<div class="insp-row"><span>Horse Armor</span><b>' + item.horseArmor + '</b></div>';
    h += '</div>';
  }

  // ── Origin ──
  if (item.culture || item.weaponClass || item.armorMaterial) {
    h += '<div class="insp-section">Origin</div>';
    h += '<div class="insp-stats">';
    if (item.culture) h += '<div class="insp-row"><span>&#x1F3F0; Culture</span><b>' + esc(item.culture) + '</b></div>';
    if (item.weaponClass) h += '<div class="insp-row"><span>&#x2694; Class</span><b>' + esc(item.weaponClass.replace(/([A-Z])/g,' $1').trim()) + '</b></div>';
    if (item.armorMaterial && item.armorMaterial !== 'Undefined') h += '<div class="insp-row"><span>&#x1F528; Material</span><b>' + esc(item.armorMaterial) + '</b></div>';
    h += '</div>';
  }

  // ── Trade Analysis ──
  if (item.value > 0) {
    h += '<div class="insp-section">Trade Analysis</div>';
    h += '<div class="insp-stats">';
    h += '<div class="insp-row"><span>Sell Priority</span><b>' + (parseFloat(vwRatio) > 100 ? '&#x2B50; Excellent' : parseFloat(vwRatio) > 50 ? '&#x2605; Good' : parseFloat(vwRatio) > 20 ? 'Average' : 'Low') + '</b></div>';
    // Find best town to sell
    const towns = (Store.settlements || []).filter(s => s.type === 'Town' || s.isTown);
    if (towns.length > 0) {
      const best = towns.sort((a,b) => (b.prosperity||0) - (a.prosperity||0))[0];
      const mult = Math.min(1.3, 0.7 + ((best.prosperity||0) / 10000) * 0.6);
      h += '<div class="insp-row"><span>Best Market</span><b>' + esc(best.name) + '</b></div>';
      h += '<div class="insp-row"><span>Est. Price There</span><b class="insp-gold">~' + Math.round(item.value * mult).toLocaleString() + ' &#x25C9;</b></div>';
    }
    h += '</div>';
  }

  // ── Comparison vs Equipped ──
  if (item.equippable && item.equipSlot) {
    // Find what's currently in that slot
    const equipped = (window._invEquipBySlot || {})[item.equipSlot];
    if (equipped && equipped.name !== item.name) {
      h += '<div class="insp-section">&#x2194; vs Equipped: ' + esc(equipped.name) + '</div>';
      h += '<div class="insp-stats">';
      const cmpStat = (label, newVal, oldVal) => {
        if (!newVal && !oldVal) return '';
        const diff = (newVal||0) - (oldVal||0);
        const cls = diff > 0 ? 'insp-cmp-up' : diff < 0 ? 'insp-cmp-down' : '';
        const arrow = diff > 0 ? '&#x25B2;+' + diff : diff < 0 ? '&#x25BC;' + diff : '=';
        return '<div class="insp-row"><span>' + label + '</span><b class="' + cls + '">' + (newVal||0) + ' <small>' + arrow + '</small></b></div>';
      };
      h += cmpStat('Head Armor', item.headArmor, equipped.headArmor);
      h += cmpStat('Body Armor', item.bodyArmor, equipped.bodyArmor);
      h += cmpStat('Leg Armor', item.legArmor, equipped.legArmor);
      h += cmpStat('Arm Armor', item.armArmor, equipped.armArmor);
      h += cmpStat('Swing Damage', item.swingDamage, equipped.swingDamage);
      h += cmpStat('Thrust Damage', item.thrustDamage, equipped.thrustDamage);
      h += cmpStat('Speed', item.horseSpeed, equipped.horseSpeed);
      h += cmpStat('Value', item.value, equipped.value);
      h += '</div>';
    }
  }

  // ── Actions ──
  h += '<div class="insp-actions">';
  if (item.equippable) h += '<span class="inv-action inv-action-equip" onclick="cmdEquipItem(\'' + esc(item.id) + '\',\'' + (item.equipSlot||item.slot) + '\',\'battle\')">&#x2694; Equip</span>';
  if (item.slot) h += '<span class="inv-action inv-action-unequip" onclick="cmdUnequipItem(\'' + item.slot + '\',\'battle\')">&#x2716; Unequip</span>';
  const isFav = (window._invFavorites || {})[item.id];
  h += '<span class="inv-action' + (isFav ? ' inv-action-fav-on' : '') + '" onclick="invToggleFav(\'' + esc(item.id) + '\')">' + (isFav ? '&#x2605;' : '&#x2606;') + ' Favorite</span>';
  if (item.id && !item.slot) h += '<span class="inv-action inv-action-discard" onclick="invDiscardItem(\'' + esc(item.id) + '\',\'' + esc(item.name) + '\',' + (item.count||1) + ')">&#x1F5D1; Discard</span>';
  h += '</div>';

  panel.innerHTML = h;
  document.querySelectorAll('.inv-item-card,.inv-slot,.inv-slot-filled').forEach(c => c.classList.remove('inv-selected'));
  document.querySelector('[data-tt-idx="' + idx + '"]')?.classList.add('inv-selected');
}

function invFilterCat(el, type) {
  document.querySelectorAll('.inv-cat').forEach(c => c.classList.remove('inv-cat-active'));
  el.classList.add('inv-cat-active');
  document.querySelectorAll('.inv-item-card').forEach(card => {
    if (type === 'all') { card.style.display = ''; return; }
    const meta = card.querySelector('.inv-item-meta')?.textContent || '';
    // Check item type by looking at the stored item
    const idx = parseInt(card.dataset.ttIdx);
    const item = window._invItems?.[idx];
    card.style.display = (item && (item.type||'Other') === type) ? '' : 'none';
  });
}

async function invTrackSettlement(id, name) {
  const res = await API.trackSettlement(id);
  if (res?.success) {
    if (res.action === 'tracked') showToast('&#x1F4CD; Tracking ' + (res.settlement||name) + ' — marked on map');
    else if (res.action === 'untracked') showToast('Removed marker from ' + (res.settlement||name));
    else if (res.action === 'waypoint') showToast('&#x1F3F0; Moving to ' + (res.settlement||name));
  } else {
    showToast(res?.error || 'Could not track settlement', true);
  }
}

async function invAutoEquip() {
  const res = await API.autoEquipBest(_invHeroId || undefined);
  if (res?.success) {
    showToast('Auto-equipped ' + res.equipped + ' items with best gear');
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else {
    showToast(res?.error || 'Auto-equip failed', true);
  }
}
function invSortAll() {
  const grid = document.getElementById('invItemGrid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.inv-item-card')];
  cards.sort((a,b) => {
    const ia = parseInt(a.dataset.ttIdx), ib = parseInt(b.dataset.ttIdx);
    const va = window._invItems?.[ia]?.value||0, vb = window._invItems?.[ib]?.value||0;
    return vb - va;
  });
  cards.forEach(c => grid.appendChild(c));
  showToast('Sorted by value');
}

// ── Discard Item ──
async function invDiscardItem(itemId, itemName, count) {
  // Styled quantity modal for discarding
  if (count > 1) {
    showQuantityModal({
      title: '&#x1F5D1; Discard ' + itemName,
      label: 'How many to discard? (max ' + count + ')',
      defaultValue: 1,
      max: count,
      confirmText: 'Discard',
      dangerous: true,
      onConfirm: async function(n) { await _doDiscardItem(itemId, itemName, n); }
    });
  } else {
    showConfirmModal({
      title: '&#x1F5D1; Discard ' + itemName,
      message: 'Discard 1x ' + itemName + '?\n\nThis cannot be undone.',
      confirmText: 'Discard',
      dangerous: true,
      onConfirm: async function() { await _doDiscardItem(itemId, itemName, 1); }
    });
  }
}
async function _doDiscardItem(itemId, itemName, n) {
  const res = await API.discardItem(itemId, n);
  if (res?.success) {
    showToast('&#x1F5D1; Discarded ' + res.removed + 'x ' + res.item + (res.remaining > 0 ? ' (' + res.remaining + ' left)' : ''));
    _invSelectedItem = null;
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else {
    showToast(res?.error || 'Discard failed', true);
  }
}

// ── Sell Goods ──
async function invSellGoods(type, estimatedValue) {
  const typeLabel = type === 'goods' ? 'Trade Goods' : type === 'food' ? 'Food' : 'All Goods';

  // First check — try to sell and see if we're at a town
  showToast('&#x1F4B0; Checking market...');
  const res = await API.sellGoods(type);

  // Not at a town — show styled modal
  if (res?.error === 'not_at_town') {
    const bestPct = Math.round((res.bestMult - 1) * 100);
    const fullPrice = Math.round(estimatedValue * res.bestMult);
    const deliveryPrice = Math.round(estimatedValue * 0.70);

    document.querySelector('.sell-modal-overlay')?.remove();
    let m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
    m += '<div class="sell-modal">';
    m += '<div class="sell-modal-header">&#x26A0; No Market Nearby</div>';
    m += '<div class="sell-modal-body">';
    m += '<div class="sell-modal-desc">You are not at a town. Choose how to sell your ' + typeLabel + ':</div>';

    // Option 1 — Travel
    m += '<div class="sell-option sell-option-best" onclick="invTrackSettlement(\'' + esc(res.bestTownId) + '\',\'' + esc(res.bestTown) + '\');this.closest(\'.sell-modal-overlay\').remove();showToast(\'&#x1F4CD; Marked ' + esc(res.bestTown) + ' on map\')">';
    m += '<div class="sell-option-icon">&#x1F3F0;</div>';
    m += '<div class="sell-option-info">';
    m += '<div class="sell-option-title">Travel to ' + esc(res.bestTown) + '</div>';
    m += '<div class="sell-option-desc">Best market price · +' + bestPct + '% prosperity bonus</div>';
    m += '</div>';
    m += '<div class="sell-option-price sell-price-good">~' + fullPrice.toLocaleString() + ' &#x25C9;</div>';
    m += '<div class="sell-option-tag">BEST PRICE</div>';
    m += '</div>';

    // Option 2 — Courier
    m += '<div class="sell-option sell-option-courier" onclick="invSellViaCourier(\'' + type + '\');this.closest(\'.sell-modal-overlay\').remove()">';
    m += '<div class="sell-option-icon">&#x1F4E6;</div>';
    m += '<div class="sell-option-info">';
    m += '<div class="sell-option-title">Merchant Courier</div>';
    m += '<div class="sell-option-desc">Sell now · 30% delivery fee deducted</div>';
    m += '</div>';
    m += '<div class="sell-option-price sell-price-cut">~' + deliveryPrice.toLocaleString() + ' &#x25C9;</div>';
    m += '<div class="sell-option-tag sell-tag-fee">-30% FEE</div>';
    m += '</div>';

    // Option 3 — Pick items
    m += '<div class="sell-option" onclick="this.closest(\'.sell-modal-overlay\').remove();invOpenSellPicker()">';
    m += '<div class="sell-option-icon">&#x1F6D2;</div>';
    m += '<div class="sell-option-info">';
    m += '<div class="sell-option-title">Pick Items to Sell</div>';
    m += '<div class="sell-option-desc">Choose exactly which items to sell</div>';
    m += '</div>';
    m += '</div>';

    // Cancel
    m += '<div class="sell-option sell-option-cancel" onclick="this.closest(\'.sell-modal-overlay\').remove()">';
    m += '<div class="sell-option-icon">&#x2715;</div>';
    m += '<div class="sell-option-info"><div class="sell-option-title">Cancel</div><div class="sell-option-desc">Keep your goods for now</div></div>';
    m += '</div>';

    m += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', m);
    return;
  }

  if (res?.success) {
    const pct = res.mult ? ' at ' + Math.round(res.mult * 100) + '% market rate' : '';
    let msg = '&#x1F4B0; Sold ' + res.items + ' items at ' + (res.market || 'market') + ' for ' + res.gold.toLocaleString() + ' denars' + pct + '!';
    if (res.sold && res.sold.length > 0) {
      msg += ' — ' + res.sold.slice(0, 3).join(', ');
      if (res.sold.length > 3) msg += ' +' + (res.sold.length - 3) + ' more';
    }
    showToast(msg);
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else if (res?.error && res.error !== 'not_at_town') {
    showToast(res?.error || 'Sell failed', true);
  }
}

// ── Sell Picker — choose specific items to sell ──
function invOpenSellPicker() {
  const items = window._invItems || [];
  const sellable = items.filter(i => i.id && !i.slot && (i.value||0) > 0);
  if (!sellable.length) { showToast('No items to sell', true); return; }

  document.querySelector('.sell-modal-overlay')?.remove();
  let m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:600px;max-height:80vh;display:flex;flex-direction:column">';
  m += '<div class="sell-modal-header">&#x1F6D2; Select Items to Sell</div>';
  m += '<div style="padding:10px 16px;border-bottom:1px solid rgba(184,140,50,.08);display:flex;justify-content:space-between;align-items:center">';
  m += '<span class="sell-picker-total" id="sellPickerTotal">0 items · 0 ◉</span>';
  m += '<span class="inv-action" onclick="sellPickerToggleAll()">Select All</span>';
  m += '</div>';
  m += '<div style="overflow-y:auto;flex:1;padding:8px 16px">';

  // Sort by value descending
  const sorted = [...sellable].sort((a,b) => (b.value||0)*b.count - (a.value||0)*a.count);
  for (const item of sorted) {
    const totalVal = (item.value||0) * item.count;
    m += '<label class="sell-picker-item">';
    m += '<input type="checkbox" class="sell-picker-cb" data-id="' + esc(item.id) + '" data-val="' + totalVal + '" data-count="' + item.count + '" data-name="' + esc(item.name) + '" onchange="sellPickerUpdate()">';
    m += '<span class="sell-picker-icon">' + (_typeIcon(item.type||'') || '&#x25C6;') + '</span>';
    m += '<span class="sell-picker-name">' + esc(item.name) + (item.count > 1 ? ' <small>x' + item.count + '</small>' : '') + '</span>';
    m += '<span class="sell-picker-val">' + totalVal.toLocaleString() + ' &#x25C9;</span>';
    m += '</label>';
  }
  m += '</div>';
  m += '<div style="padding:12px 16px;border-top:1px solid rgba(184,140,50,.1);display:flex;gap:8px;justify-content:flex-end">';
  m += '<span class="inv-action" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</span>';
  m += '<span class="inv-action inv-action-sell" onclick="sellPickerConfirm()">&#x1F4B0; Sell Selected</span>';
  m += '</div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
}

function sellPickerUpdate() {
  const cbs = document.querySelectorAll('.sell-picker-cb:checked');
  let total = 0, count = 0;
  cbs.forEach(cb => { total += parseInt(cb.dataset.val)||0; count++; });
  const el = document.getElementById('sellPickerTotal');
  if (el) el.textContent = count + ' items · ' + total.toLocaleString() + ' ◉';
}

function sellPickerToggleAll() {
  const cbs = document.querySelectorAll('.sell-picker-cb');
  const allChecked = [...cbs].every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
  sellPickerUpdate();
}

async function sellPickerConfirm() {
  const cbs = document.querySelectorAll('.sell-picker-cb:checked');
  if (!cbs.length) { showToast('No items selected', true); return; }
  document.querySelector('.sell-modal-overlay')?.remove();
  showToast('&#x1F4B0; Selling ' + cbs.length + ' items...');
  let totalSold = 0, totalGold = 0;
  for (const cb of cbs) {
    const res = await API.discardItem(cb.dataset.id, parseInt(cb.dataset.count)||1);
    if (res?.success) { totalSold++; totalGold += parseInt(cb.dataset.val)||0; }
  }
  // Add gold manually — discardItem removes but doesn't add gold
  // For now just show what was removed
  showToast('&#x1F4B0; Removed ' + totalSold + ' items (value: ' + totalGold.toLocaleString() + '◉) — gold added on next DLL update');
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdInventory(el);
}

// ── Courier Sell ──
async function invSellViaCourier(type) {
  showToast('&#x1F4E6; Merchant courier dispatched...');
  await new Promise(r => setTimeout(r, 2000));
  const res = await API.sellGoods(type + '_force');
  if (res?.success) {
    showToast('&#x1F4B0; Courier sold ' + res.items + ' items — received ' + res.gold.toLocaleString() + '&#x25C9; (after delivery fee)');
    const el = document.getElementById('cmdTabContent');
    if (el) renderCmdInventory(el);
  } else {
    showToast(res?.error || 'Courier sale failed', true);
  }
}

// ── Split Stack ──
async function invSplitStack(itemId, itemName, maxCount) {
  const qty = prompt('Split stack of ' + maxCount + 'x ' + itemName + '.\nHow many to separate?', Math.floor(maxCount/2));
  if (!qty || parseInt(qty) <= 0 || parseInt(qty) >= maxCount) return;
  showToast('Stack split is visual only — items stay in inventory as one stack in-game');
}

// ── Compare Two Items ──
let _invCompareA = null;
function invCompareItem(idx) {
  const item = window._invItems?.[idx];
  if (!item) return;
  if (!_invCompareA) {
    _invCompareA = item;
    showToast('Selected ' + item.name + ' for comparison — click another item to compare');
    document.querySelector('[data-tt-idx="' + idx + '"]')?.classList.add('inv-compare-a');
    return;
  }
  // Show comparison modal
  const a = _invCompareA;
  const b = item;
  _invCompareA = null;
  document.querySelectorAll('.inv-compare-a').forEach(c => c.classList.remove('inv-compare-a'));

  const cmpVal = (label, va, vb) => {
    if (!va && !vb) return '';
    const diff = (va||0) - (vb||0);
    return '<div class="inv-cmp-row"><span class="inv-cmp-label">' + label + '</span>'
      + '<span class="inv-cmp-val ' + (diff > 0 ? 'insp-cmp-up' : diff < 0 ? 'insp-cmp-down' : '') + '">' + (va||0) + '</span>'
      + '<span class="inv-cmp-vs">vs</span>'
      + '<span class="inv-cmp-val ' + (diff < 0 ? 'insp-cmp-up' : diff > 0 ? 'insp-cmp-down' : '') + '">' + (vb||0) + '</span></div>';
  };

  let h = '<div class="cc-compare-overlay" onclick="if(event.target===this)this.remove()">';
  h += '<div class="cc-compare-modal" style="max-width:500px">';
  h += '<div class="cc-compare-header">Item Comparison <span class="cc-compare-close" onclick="this.closest(\'.cc-compare-overlay\').remove()">&#x2715;</span></div>';
  h += '<div style="padding:14px">';

  // Names
  h += '<div style="display:flex;justify-content:space-between;margin-bottom:12px">';
  h += '<div style="text-align:center;flex:1"><div class="insp-name" style="font-size:14px;color:' + (({1:'#7a7a6a',2:'#7a9a5a',3:'#8aaa68',4:'#d4b048',5:'#e0c060',6:'#f0d848'})[a.tier]||'#8a7a5a') + '">' + esc(a.name) + '</div></div>';
  h += '<div style="text-align:center;flex:1"><div class="insp-name" style="font-size:14px;color:' + (({1:'#7a7a6a',2:'#7a9a5a',3:'#8aaa68',4:'#d4b048',5:'#e0c060',6:'#f0d848'})[b.tier]||'#8a7a5a') + '">' + esc(b.name) + '</div></div>';
  h += '</div>';

  // Stats comparison
  h += cmpVal('Value', a.value, b.value);
  h += cmpVal('Weight', a.weight, b.weight);
  h += cmpVal('Head Armor', a.headArmor, b.headArmor);
  h += cmpVal('Body Armor', a.bodyArmor, b.bodyArmor);
  h += cmpVal('Leg Armor', a.legArmor, b.legArmor);
  h += cmpVal('Arm Armor', a.armArmor, b.armArmor);
  h += cmpVal('Swing Damage', a.swingDamage, b.swingDamage);
  h += cmpVal('Thrust Damage', a.thrustDamage, b.thrustDamage);
  h += cmpVal('Missile Speed', a.missileSpeed, b.missileSpeed);
  h += cmpVal('Horse Speed', a.horseSpeed, b.horseSpeed);
  h += cmpVal('Maneuver', a.horseManeuver, b.horseManeuver);

  // Total scores
  const totalA = (a.headArmor||0)+(a.bodyArmor||0)+(a.legArmor||0)+(a.armArmor||0)+Math.max(a.swingDamage||0,a.thrustDamage||0);
  const totalB = (b.headArmor||0)+(b.bodyArmor||0)+(b.legArmor||0)+(b.armArmor||0)+Math.max(b.swingDamage||0,b.thrustDamage||0);
  h += cmpVal('TOTAL COMBAT', totalA, totalB);

  h += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

// ── Tier Filter ──
function invFilterTier(el, tier) {
  document.querySelectorAll('.inv-tier-btn').forEach(b => b.classList.remove('inv-tier-active'));
  el.classList.add('inv-tier-active');
  document.querySelectorAll('.inv-item-card').forEach(card => {
    if (tier === 0) { card.style.display = ''; return; }
    const t = parseInt(card.dataset.tier) || 0;
    card.style.display = t >= tier ? '' : 'none';
  });
}

// ── Bulk Actions ──
function invBulkAction(action) {
  if (action === 'unequipAll') {
    const slots = ['Weapon0','Weapon1','Weapon2','Weapon3','Head','Body','Gloves','Leg','Cape'];
    let count = 0;
    const doNext = () => {
      if (count >= slots.length) {
        showToast('Unequipped all items');
        const el = document.getElementById('cmdTabContent');
        if (el) renderCmdInventory(el);
        return;
      }
      const slot = slots[count++];
      cmdUnequipItem(slot, 'battle');
      setTimeout(doNext, 200);
    };
    doNext();
  }
}

// ── Favorites System (localStorage) ──
window._invFavorites = JSON.parse(localStorage.getItem('invFavorites') || '{}');
function invToggleFav(itemId) {
  if (window._invFavorites[itemId]) delete window._invFavorites[itemId];
  else window._invFavorites[itemId] = true;
  localStorage.setItem('invFavorites', JSON.stringify(window._invFavorites));
  // Re-render inspector
  if (_invSelectedItem) {
    const idx = (window._invItems||[]).indexOf(_invSelectedItem);
    if (idx >= 0) invSelectItem(idx);
  }
  showToast(window._invFavorites[itemId] ? '⭐ Favorited' : 'Unfavorited');
}

// ── Right-Click Context Menu ──
document.addEventListener('contextmenu', function(e) {
  const card = e.target.closest('[data-tt-idx]');
  if (!card) return;
  e.preventDefault();
  const idx = parseInt(card.dataset.ttIdx);
  const item = window._invItems?.[idx];
  if (!item) return;

  // Remove old menu
  document.querySelector('.inv-ctx-menu')?.remove();

  let h = '<div class="inv-ctx-menu" style="left:' + e.clientX + 'px;top:' + e.clientY + 'px">';
  h += '<div class="inv-ctx-title">' + esc(item.name) + '</div>';
  if (item.equippable) h += '<div class="inv-ctx-item" onclick="cmdEquipItem(\'' + esc(item.id) + '\',\'' + (item.equipSlot||item.slot) + '\',\'battle\');this.parentElement.remove()">&#x2694; Equip</div>';
  if (item.slot) h += '<div class="inv-ctx-item" onclick="cmdUnequipItem(\'' + item.slot + '\',\'battle\');this.parentElement.remove()">&#x2716; Unequip</div>';
  h += '<div class="inv-ctx-item" onclick="invToggleFav(\'' + esc(item.id) + '\');this.parentElement.remove()">' + (window._invFavorites[item.id] ? '&#x2605; Unfavorite' : '&#x2606; Favorite') + '</div>';
  h += '<div class="inv-ctx-item" onclick="invSelectItem(' + idx + ');this.parentElement.remove()">&#x1F50D; Inspect</div>';
  h += '<div class="inv-ctx-item" onclick="invCompareItem(' + idx + ');this.parentElement.remove()">&#x2194; Compare</div>';
  if (item.count > 1) h += '<div class="inv-ctx-item" onclick="invSplitStack(\'' + esc(item.id) + '\',\'' + esc(item.name) + '\',' + item.count + ');this.parentElement.remove()">&#x2702; Split Stack</div>';
  if (item.id && !item.slot) h += '<div class="inv-ctx-item inv-ctx-discard" onclick="invDiscardItem(\'' + esc(item.id) + '\',\'' + esc(item.name) + '\',' + (item.count||1) + ');this.parentElement.remove()">&#x1F5D1; Discard</div>';
  h += '</div>';
  document.body.insertAdjacentHTML('beforeend', h);

  // Close on click outside
  setTimeout(() => document.addEventListener('click', function rm() {
    document.querySelector('.inv-ctx-menu')?.remove();
    document.removeEventListener('click', rm);
  }), 10);
});

// ── Drag & Drop ──
document.addEventListener('dragstart', function(e) {
  const card = e.target.closest('[data-tt-idx]');
  if (!card) return;
  const idx = card.dataset.ttIdx;
  e.dataTransfer.setData('text/plain', idx);
  e.dataTransfer.effectAllowed = 'move';
  card.style.opacity = '.5';
  setTimeout(() => card.style.opacity = '', 300);
});
document.addEventListener('dragover', function(e) {
  const slot = e.target.closest('.inv-slot,.inv-pg-slot');
  if (slot) { e.preventDefault(); slot.classList.add('inv-drag-over'); }
});
document.addEventListener('dragleave', function(e) {
  const slot = e.target.closest('.inv-slot,.inv-pg-slot');
  if (slot) slot.classList.remove('inv-drag-over');
});
document.addEventListener('drop', function(e) {
  e.preventDefault();
  document.querySelectorAll('.inv-drag-over').forEach(s => s.classList.remove('inv-drag-over'));
  const slot = e.target.closest('.inv-slot,.inv-pg-slot');
  if (!slot) return;
  const idx = parseInt(e.dataTransfer.getData('text/plain'));
  const item = window._invItems?.[idx];
  if (!item || !item.equippable) { showToast('Cannot equip this item here', true); return; }
  cmdEquipItem(item.id, item.equipSlot || item.slot, 'battle');
});

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', function(e) {
  if (!_invSelectedItem || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const item = _invSelectedItem;
  if (e.key === 'e' || e.key === 'E') {
    if (item.equippable) cmdEquipItem(item.id, item.equipSlot||item.slot, 'battle');
  } else if (e.key === 'u' || e.key === 'U') {
    if (item.slot) cmdUnequipItem(item.slot, 'battle');
  } else if (e.key === 'f' || e.key === 'F') {
    invToggleFav(item.id);
  } else if (e.key === 'c' || e.key === 'C') {
    const idx = (window._invItems||[]).indexOf(item);
    if (idx >= 0) invCompareItem(idx);
  } else if (e.key === 'd' || e.key === 'D') {
    if (item.id && !item.slot) invDiscardItem(item.id, item.name, item.count||1);
  }
});

// ── Party Tab — Split layout like in-game party screen ──
async function renderCmdParty(el) {
  const [troops, prisoners, companions] = await Promise.all([
    API.getPlayerTroops(), API.getPlayerPrisoners(), API.getPlayerCompanions()
  ]);

  const regularTroops = (troops?.troops || []).filter(t => !t.isHero).sort((a,b) => b.tier - a.tier);
  const heroTroops = (troops?.troops || []).filter(t => t.isHero);

  // Count by type
  let infantry = 0, ranged = 0, cavalry = 0, mounted = 0, totalWounded = 0;
  regularTroops.forEach(t => {
    if (t.isMounted && t.isRanged) mounted += t.count;
    else if (t.isMounted) cavalry += t.count;
    else if (t.isRanged) ranged += t.count;
    else infantry += t.count;
    if (t.wounded) totalWounded += t.wounded;
  });
  const totalRegular = infantry + ranged + cavalry + mounted;

  // Party overview data
  const pData = _cmdData?.party || {};
  const troopLimit = pData.troopLimit || 1;
  const totalTroops = troops?.total || 0;
  const capacityPct = Math.min(100, Math.round(totalTroops / troopLimit * 100));

  // Average tier
  let tierSum = 0, tierCount = 0;
  regularTroops.forEach(t => { tierSum += t.tier * t.count; tierCount += t.count; });
  const avgTier = tierCount > 0 ? (tierSum / tierCount).toFixed(1) : '0';

  // Food days remaining
  const foodDays = pData.foodChange < 0 ? Math.floor(pData.food / Math.abs(pData.foodChange)) : '∞';

  // ── Top strip: title ribbon + power gauge + readiness ──
  const partyPower = Math.round(totalRegular * Number(avgTier || 1));
  // Auto-generated title
  let partyHonor = 'Ragtag Band';
  if (partyPower >= 1500) partyHonor = 'Legendary Host';
  else if (partyPower >= 800) partyHonor = 'Mighty Warband';
  else if (partyPower >= 400) partyHonor = 'Disciplined Company';
  else if (partyPower >= 200) partyHonor = 'Veteran Retinue';
  else if (totalRegular >= 50) partyHonor = 'Marching Column';
  // Readiness: food + morale + capacity headroom
  const foodOk = pData.food > 0 && (foodDays === '\u221E' || foodDays >= 5);
  const moraleOk = (pData.morale || 0) >= 50;
  const capOk = capacityPct < 95;
  const readyPts = (foodOk ? 1 : 0) + (moraleOk ? 1 : 0) + (capOk ? 1 : 0);
  const readyLabel = readyPts === 3 ? 'READY' : readyPts === 2 ? 'CAUTIOUS' : readyPts === 1 ? 'STRAINED' : 'CRITICAL';
  const readyColor = readyPts === 3 ? '#7ac070' : readyPts === 2 ? '#d4b878' : readyPts === 1 ? '#d49040' : '#c05050';
  // Power gauge ring
  const pR = 36, pCirc = 2 * Math.PI * pR;
  const pwrPct = Math.min(100, (partyPower / 2000) * 100);
  const pDash = (pwrPct / 100) * pCirc;
  const capDash = (capacityPct / 100) * pCirc;

  let html = `<div class="cmd-party-topstrip">
    <div class="cmd-party-ribbon">${esc(partyHonor)}</div>
    <div class="cmd-party-gauge-row">
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${pR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${pR}" fill="none" stroke="url(#pPwrGrad)" stroke-width="6"
            stroke-dasharray="${pDash} ${pCirc - pDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(244,216,120,.55))"/>
          <defs><linearGradient id="pPwrGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a06c20"/><stop offset="1" stop-color="#f5d878"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val">${partyPower}</div>
          <div class="cmd-party-gauge-lbl">POWER</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${pR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${pR}" fill="none" stroke="url(#pCapGrad)" stroke-width="6"
            stroke-dasharray="${capDash} ${pCirc - capDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(104,192,160,.5))"/>
          <defs><linearGradient id="pCapGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4a8040"/><stop offset="1" stop-color="#7ac070"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val">${capacityPct}%</div>
          <div class="cmd-party-gauge-lbl">FILLED</div>
        </div>
      </div>
      <div class="cmd-party-stat-mini">
        <div class="cmd-party-stat-big" data-count-target="${totalTroops}">0</div>
        <div class="cmd-party-stat-lbl">Troops</div>
        <div class="cmd-party-stat-sub">${totalWounded > 0 ? '<span style="color:#d49a7a">' + totalWounded + ' wounded</span>' : 'Healthy'}</div>
      </div>
      <div class="cmd-party-stat-mini">
        <div class="cmd-party-stat-big" style="color:${readyColor}">${readyLabel}</div>
        <div class="cmd-party-stat-lbl">Readiness</div>
        <div class="cmd-party-stat-sub">
          ${foodOk ? '\u{2713}' : '\u{2717}'} Food &middot;
          ${moraleOk ? '\u{2713}' : '\u{2717}'} Morale &middot;
          ${capOk ? '\u{2713}' : '\u{2717}'} Cap
        </div>
      </div>
    </div>
  </div>`;

  html += '<div class="cmd-party-layout">';

  // ── Left panel — Party Status & Composition ──
  html += '<div class="cmd-party-left">';

  // Section: Army Composition
  html += '<div class="cmd-party-header" style="border-top:none">Army Composition</div>';
  html += '<div class="cmd-left-section">';

  // Composition bars
  const compTotal = Math.max(1, infantry + ranged + cavalry + mounted);
  const infPct = Math.round(infantry / compTotal * 100);
  const rngPct = Math.round(ranged / compTotal * 100);
  const cavPct = Math.round(cavalry / compTotal * 100);
  const mtdPct = Math.round(mounted / compTotal * 100);

  html += `<div class="cmd-comp-bar-row">
    <span class="cmd-comp-bar-label">&#x2694; Infantry</span>
    <div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill cmd-comp-infantry" style="width:${infPct}%"></div></div>
    <span class="cmd-comp-bar-val">${infantry}</span>
  </div>`;
  html += `<div class="cmd-comp-bar-row">
    <span class="cmd-comp-bar-label">&#x2738; Ranged</span>
    <div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill cmd-comp-ranged" style="width:${rngPct}%"></div></div>
    <span class="cmd-comp-bar-val">${ranged}</span>
  </div>`;
  html += `<div class="cmd-comp-bar-row">
    <span class="cmd-comp-bar-label">&#x265E; Cavalry</span>
    <div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill cmd-comp-cavalry" style="width:${cavPct}%"></div></div>
    <span class="cmd-comp-bar-val">${cavalry}</span>
  </div>`;
  html += `<div class="cmd-comp-bar-row">
    <span class="cmd-comp-bar-label">&#x2658; Horse Archer</span>
    <div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill cmd-comp-mounted" style="width:${mtdPct}%"></div></div>
    <span class="cmd-comp-bar-val">${mounted}</span>
  </div>`;

  // Average tier & capacity
  html += `<div class="cmd-comp-stats">
    <div class="cmd-comp-stat-item"><span class="cmd-comp-stat-label">Avg. Tier</span><span class="cmd-comp-stat-val">${avgTier}</span></div>
    <div class="cmd-comp-stat-item"><span class="cmd-comp-stat-label">Capacity</span><span class="cmd-comp-stat-val">${totalTroops} / ${troopLimit}</span></div>
    ${totalWounded > 0 ? `<div class="cmd-comp-stat-item"><span class="cmd-comp-stat-label" style="color:#d49a7a">Wounded</span><span class="cmd-comp-stat-val" style="color:#e07060">${totalWounded}</span></div>` : ''}
  </div>`;
  html += '</div>';

  // Section: Party Economy
  html += '<div class="cmd-party-header">Economy</div>';
  html += '<div class="cmd-left-section">';
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Daily Wages</span><span class="cmd-econ-val cmd-econ-neg">-${pData.dailyWage || 0} &#x25C9;</span></div>`;
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Treasury</span><span class="cmd-econ-val">${(_cmdData?.hero?.gold || 0).toLocaleString()} &#x25C9;</span></div>`;
  const daysAfford = pData.dailyWage > 0 ? Math.floor((_cmdData?.hero?.gold || 0) / pData.dailyWage) : '∞';
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Can Afford</span><span class="cmd-econ-val">${daysAfford} days</span></div>`;
  html += '</div>';

  // Section: Supplies
  html += '<div class="cmd-party-header">Supplies</div>';
  html += '<div class="cmd-left-section">';
  const foodChangeStr = pData.foodChange >= 0 ? `+${pData.foodChange}` : `${pData.foodChange}`;
  const foodColor = foodDays !== '∞' && foodDays <= 3 ? '#e07060' : foodDays !== '∞' && foodDays <= 7 ? '#d4b060' : '#6ab870';
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Food Stock</span><span class="cmd-econ-val">${pData.food || 0} (${foodChangeStr}/day)</span></div>`;
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Days Remaining</span><span class="cmd-econ-val" style="color:${foodColor};font-weight:700">${foodDays}</span></div>`;
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Morale</span><span class="cmd-econ-val">${pData.morale || 0}</span></div>`;
  html += `<div class="cmd-econ-row"><span class="cmd-econ-label">Speed</span><span class="cmd-econ-val">${pData.speed || 0}</span></div>`;
  html += '</div>';

  // Section: Battle Readiness
  html += '<div class="cmd-party-header">Battle Readiness</div>';
  html += '<div class="cmd-left-section">';
  const healthyTroops = totalRegular - totalWounded;
  const readinessPct = totalRegular > 0 ? Math.round(healthyTroops / totalRegular * 100) : 100;
  const readinessColor = readinessPct >= 80 ? '#6ab870' : readinessPct >= 50 ? '#d4b060' : '#e07060';
  const readinessLabel = readinessPct >= 80 ? 'Ready' : readinessPct >= 50 ? 'Weakened' : 'Critical';
  // Power rating estimate — tier * count weighted
  let powerRating = 0;
  regularTroops.forEach(t => powerRating += t.tier * (t.count - (t.wounded||0)) * 10);
  html += '<div class="cmd-econ-row"><span class="cmd-econ-label">Healthy Troops</span><span class="cmd-econ-val" style="color:' + readinessColor + '">' + healthyTroops + ' / ' + totalRegular + ' (' + readinessPct + '%)</span></div>';
  html += '<div class="cmd-econ-row"><span class="cmd-econ-label">Status</span><span class="cmd-econ-val" style="color:' + readinessColor + ';font-weight:700">' + readinessLabel + '</span></div>';
  html += '<div class="cmd-econ-row"><span class="cmd-econ-label">Combat Power</span><span class="cmd-econ-val" style="font-weight:700">' + powerRating.toLocaleString() + '</span></div>';
  if (totalWounded > 0) html += '<div class="cmd-econ-row"><span class="cmd-econ-label" style="color:#d49a7a">Wounded</span><span class="cmd-econ-val" style="color:#e07060">' + totalWounded + '</span></div>';
  html += '</div>';

  // Section: Culture Breakdown
  const cultures = {};
  regularTroops.forEach(t => { const c = t.culture || 'Unknown'; cultures[c] = (cultures[c]||0) + t.count; });
  const sortedCultures = Object.entries(cultures).sort((a,b) => b[1] - a[1]);
  if (sortedCultures.length > 1) {
    html += '<div class="cmd-party-header">Troop Cultures</div>';
    html += '<div class="cmd-left-section">';
    const maxCult = sortedCultures[0][1];
    for (const [culture, count] of sortedCultures) {
      const pct = Math.round(count / totalRegular * 100);
      html += '<div class="cmd-comp-bar-row">';
      html += '<span class="cmd-comp-bar-label">' + esc(culture) + '</span>';
      html += '<div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#6a5a30,#c0a040)"></div></div>';
      html += '<span class="cmd-comp-bar-val">' + count + ' (' + pct + '%)</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Section: Morale Details
  html += '<div class="cmd-party-header">Morale Details</div>';
  html += '<div class="cmd-left-section">';
  const moraleVal = pData.morale || 0;
  const moraleColor = moraleVal >= 60 ? '#6ab870' : moraleVal >= 30 ? '#d4b060' : '#e07060';
  const moraleLabel = moraleVal >= 70 ? 'Excellent' : moraleVal >= 50 ? 'Good' : moraleVal >= 30 ? 'Low' : 'Critical';
  html += '<div class="cmd-comp-bar-row"><span class="cmd-comp-bar-label">Morale</span>';
  html += '<div class="cmd-comp-bar-track"><div class="cmd-comp-bar-fill" style="width:' + moraleVal + '%;background:' + moraleColor + '"></div></div>';
  html += '<span class="cmd-comp-bar-val" style="color:' + moraleColor + '">' + moraleVal + ' — ' + moraleLabel + '</span></div>';
  html += '<div class="cmd-econ-row"><span class="cmd-econ-label">Speed</span><span class="cmd-econ-val">' + (pData.speed || 0) + '</span></div>';
  html += '</div>';

  // Section: Prisoners summary
  html += '<div class="cmd-party-header cmd-party-header-prisoner">Prisoners (' + (prisoners?.total || 0) + ')</div>';
  html += '<div class="cmd-left-section">';
  if (prisoners?.prisoners?.length) {
    for (const p of prisoners.prisoners) {
      html += `<div class="cmd-econ-row">
        <span class="cmd-econ-label">${esc(p.name)}${p.isHero ? ' <span class="cmd-hero-badge">Lord</span>' : ''}</span>
        <span class="cmd-econ-val">${p.count}</span>
      </div>`;
    }
  } else {
    html += '<div class="cmd-quest-empty">No prisoners</div>';
  }
  html += '</div></div>';

  // ── Center — Hero portrait showcase ──
  html += '<div class="cmd-party-center">';
  const heroItem = (Store.heroes || []).find(h => h.isPlayer);
  const portraitSrc = heroItem ? getPortraitSrc(heroItem, heroItem) : 'Hero/bannerlord_hero_viking.png';
  const heroName = _cmdData?.hero?.customName || _cmdData?.hero?.name || 'Hero';
  const gpHero = heroItem && isGamePortrait(heroItem);
  html += `<div class="cmd-party-hero-portrait" onclick="openDetail('heroes','${esc(_cmdData?.hero?.id || '')}')" style="cursor:pointer" title="View hero detail">
    <img src="${portraitSrc}" alt="" onerror="this.src='Hero/bannerlord_hero_viking.png'"${gpHero ? ` class="game-portrait" style="${GP_STYLE}"` : ''}>
  </div>
  <div class="cmd-party-hero-name">${esc(heroName)}</div>
  <div class="cmd-party-hero-level">Level ${_cmdData?.hero?.level || 1}</div>`;

  // Quick party stats under portrait
  html += `<div class="cmd-party-center-stats">
    <span title="Morale">&#x263A; ${_cmdData?.party?.morale || 0}</span>
    <span title="Speed">&#x25B2; ${_cmdData?.party?.speed || 0}</span>
    <span title="Food">&#x2637; ${_cmdData?.party?.food || 0}</span>
  </div>`;
  html += '</div>';

  // ── Right panel — companions & heroes in party ──
  html += '<div class="cmd-party-right">';
  html += `<div class="cmd-party-right-title">${esc(heroName)}'s Party</div>`;

  // Party capacity
  html += `<div class="cmd-party-summary">
    <span class="cmd-ps-stat">&#x2694; ${infantry}</span>
    <span class="cmd-ps-stat">&#x2738; ${ranged}</span>
    <span class="cmd-ps-stat">&#x265E; ${cavalry + mounted}</span>
  </div>`;

  html += `<div class="cmd-party-header" onclick="this.classList.toggle('collapsed');var b=this.nextElementSibling;b&&b.classList.toggle('hidden')">
    <span class="cmd-qg-arrow">&#x25BC;</span> Troops (${troops?.total || 0} / ${_cmdData?.party?.troopLimit || '?'})
  </div>`;

  // Heroes + regular troops roster
  html += '<div class="cmd-party-roster">';
  for (const h of heroTroops) {
    const hItem = h.heroId ? (Store.heroes || []).find(x => x.id === h.heroId) : null;
    const hPortrait = hItem ? getPortraitSrc(hItem, hItem) : '';
    // Use wounded flag from troop data — more accurate than Store HP
    const isWounded = h.wounded > 0;
    const hpPct = isWounded ? 30 : (hItem?.hp && hItem?.maxHp ? Math.round(hItem.hp / hItem.maxHp * 100) : 100);
    const hpColor = hpPct > 60 ? '#6ab870' : hpPct > 30 ? '#d4b060' : '#e07060';
    const woundLabel = isWounded ? ' <span style="color:#e07060;font-size:9px">(Wounded)</span>' : '';
    html += `<div class="cmd-roster-row cmd-roster-hero" ${h.heroId ? `onclick="openDetail('heroes','${esc(h.heroId)}')"` : ''}>
      ${hPortrait ? `<img class="cmd-rr-portrait${hItem && isGamePortrait(hItem) ? ' game-portrait' : ''}" src="${hPortrait}" alt="" onerror="this.style.display='none'"${hItem && isGamePortrait(hItem) ? ` style="${GP_STYLE};width:32px;height:32px;border-radius:4px;flex-shrink:0;border:1px solid rgba(184,140,50,.3)"` : ''}>` : ''}
      <div class="cmd-rr-name">${esc(h.name)}${woundLabel}</div>
      <div class="cmd-rr-hp"><div class="cmd-rr-hp-bar"><div class="cmd-rr-hp-fill" style="width:${hpPct}%;background:linear-gradient(90deg,${hpColor},${hpColor})"></div></div></div>
    </div>`;
  }
  // Regular troops with upgrade/disband controls
  for (const t of regularTroops) {
    const typeIcon = t.isMounted && t.isRanged ? '&#x2658;' : t.isMounted ? '&#x265E;' : t.isRanged ? '&#x2738;' : '&#x2694;';
    const tc2 = ({1:'#6a6a5a',2:'#7a8a5a',3:'#8a9a68',4:'#c8a848',5:'#d4b878',6:'#e8c848'})[t.tier] || '#6a6a5a';
    const woundedBadge = t.wounded > 0 ? ' <span style="color:#e07060;font-size:10px">(' + t.wounded + 'w)</span>' : '';
    html += '<div class="cmd-roster-row party-troop-row">';
    html += '<div class="cmd-rr-tier" style="border-left-color:' + tc2 + '">T' + t.tier + '</div>';
    html += '<span style="font-size:12px;min-width:18px;text-align:center">' + typeIcon + '</span>';
    html += '<div class="cmd-rr-name">' + esc(t.name) + woundedBadge + '</div>';
    html += '<div class="cmd-rr-count">' + t.count + '</div>';
    // Action buttons (show on hover)
    html += '<div class="party-troop-actions">';
    const upCount = t.upgradeable || 0;
    if (t.upgrades?.length > 0 && upCount > 0) {
      for (let ui = 0; ui < t.upgrades.length; ui++) {
        html += '<span class="party-troop-btn party-btn-upgrade" onclick="event.stopPropagation();partyUpgradeTroop(\'' + esc(t.id) + '\',' + ui + ',\'' + esc(t.name) + '\',\'' + esc(t.upgrades[ui].name) + '\')" title="Upgrade ' + upCount + ' to ' + esc(t.upgrades[ui].name) + '">&#x25B2; ' + upCount + ' → T' + t.upgrades[ui].tier + '</span>';
      }
    } else if (t.upgrades?.length > 0) {
      html += '<span class="party-troop-btn party-btn-upgrade" style="opacity:.3;cursor:default" title="Need more XP to upgrade">&#x25B2; 0 ready</span>';
    }
    html += '<span class="party-troop-btn party-btn-disband" onclick="event.stopPropagation();partyDisbandTroop(\'' + esc(t.id) + '\',\'' + esc(t.name) + '\',' + t.count + ')" title="Disband">&#x2716;</span>';
    html += '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Companions section with portraits
  if (companions?.companions?.length) {
    html += `<div class="cmd-party-header" onclick="this.classList.toggle('collapsed');var b=this.nextElementSibling;b&&b.classList.toggle('hidden')" style="margin-top:0">
      <span class="cmd-qg-arrow">&#x25BC;</span> Companions (${companions.companions.length})
    </div>`;
    html += '<div class="cmd-party-roster">';
    for (const comp of companions.companions) {
      const hpPct = comp.maxHp > 0 ? Math.round(comp.hp / comp.maxHp * 100) : 100;
      const hpColor = hpPct > 60 ? '#6ab870' : hpPct > 30 ? '#d4b060' : '#e07060';
      const cItem = (Store.heroes || []).find(x => x.id === comp.id);
      const cPortrait = cItem ? getPortraitSrc(cItem, cItem) : '';
      html += `<div class="cmd-roster-row cmd-roster-hero" onclick="partyShowCompanion('${esc(comp.id)}','${esc(comp.name)}')">
        ${cPortrait ? `<img class="cmd-rr-portrait${cItem && isGamePortrait(cItem) ? ' game-portrait' : ''}" src="${cPortrait}" alt="" onerror="this.style.display='none'"${cItem && isGamePortrait(cItem) ? ` style="${GP_STYLE};width:32px;height:32px;border-radius:4px;flex-shrink:0;border:1px solid rgba(184,140,50,.3)"` : ''}>` : ''}
        <div class="cmd-rr-name">${esc(comp.name)}</div>
        <div class="cmd-rr-assign">${esc(comp.assignment)}</div>
        <div class="cmd-rr-hp"><div class="cmd-rr-hp-bar"><div class="cmd-rr-hp-fill" style="width:${hpPct}%;background:linear-gradient(90deg,${hpColor},${hpColor})"></div></div></div>
        <span class="cmd-rr-detail-arrow">&#x25B6;</span>
      </div>`;
    }
    html += '</div>';
  }

  // Prisoner count in right panel
  html += `<div class="cmd-party-header cmd-party-header-prisoner" onclick="this.classList.toggle('collapsed');var b=this.nextElementSibling;b&&b.classList.toggle('hidden')" style="margin-top:0">
    <span class="cmd-qg-arrow">&#x25B6;</span> Prisoners (${prisoners?.total || 0})
  </div>`;
  html += '<div class="cmd-party-roster hidden">';
  if (prisoners?.prisoners?.length) {
    let totalRansom = 0;
    // Lords first, then regular prisoners
    const lordPrisoners = prisoners.prisoners.filter(x => x.isHero);
    const regularPrisoners = prisoners.prisoners.filter(x => !x.isHero);
    for (const p of lordPrisoners) {
      const ransom = p.ransomValue || (p.tier * 500);
      totalRansom += ransom;
      html += '<div class="cmd-roster-row cmd-roster-prisoner">';
      html += '<div class="cmd-rr-tier" style="border-left-color:#c08060">T' + p.tier + '</div>';
      html += '<div class="cmd-rr-name">' + esc(p.name) + ' <span class="cmd-hero-badge">Lord</span></div>';
      html += '<span class="cmd-rr-ransom">~' + ransom.toLocaleString() + ' &#x25C9;</span>';
      html += '</div>';
    }
    for (const p of regularPrisoners) {
      html += '<div class="cmd-roster-row cmd-roster-prisoner party-troop-row">';
      html += '<div class="cmd-rr-tier" style="border-left-color:#8a6a4a">T' + p.tier + '</div>';
      html += '<div class="cmd-rr-name">' + esc(p.name) + '</div>';
      html += '<div class="cmd-rr-count">' + p.count + '</div>';
      html += '<div class="party-troop-actions">';
      if (p.id) html += '<span class="party-troop-btn party-btn-upgrade" onclick="event.stopPropagation();partyRecruitPrisoner(\'' + esc(p.id) + '\',\'' + esc(p.name) + '\',' + p.count + ')" title="Recruit into party">&#x1F464; Recruit</span>';
      html += '</div>';
      html += '</div>';
    }
    if (totalRansom > 0) {
      html += '<div class="cmd-roster-row" style="border-top:1px solid rgba(184,140,50,.1);padding-top:6px">';
      html += '<div class="cmd-rr-name" style="color:#c08060">Total Ransom Value</div>';
      html += '<span class="cmd-rr-ransom" style="color:#e0a060;font-weight:700">~' + totalRansom.toLocaleString() + ' &#x25C9;</span>';
      html += '</div>';
    }
  } else {
    html += '<div class="cmd-quest-empty">No prisoners</div>';
  }
  html += '</div></div>';

  html += '</div>';
  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

// ── Party — Upgrade Troop ──
function partyUpgradeTroop(troopId, upgradeIdx, fromName, toName) {
  showConfirmModal({
    title: '&#x25B2; Upgrade Troops',
    message: 'Upgrade available ' + fromName + ' to ' + toName + '?\n\nOnly troops with enough XP will be upgraded.',
    confirmText: 'Upgrade',
    onConfirm: async function() {
      const res = await API.upgradeTroop(troopId, upgradeIdx);
      if (res?.success) {
        showToast('&#x25B2; Upgraded ' + res.count + 'x ' + res.from + ' → ' + res.to + ' (Tier ' + res.tier + ')');
        const el = document.getElementById('cmdTabContent');
        if (el) renderCmdParty(el);
      } else {
        showToast(res?.error || 'Upgrade failed', true);
      }
    }
  });
}

// ── Party — Disband Troop ──
// ── Reusable styled quantity prompt ──
// Styled confirm modal (replacement for window.confirm)
// opts: {title, message, confirmText, cancelText, dangerous, onConfirm}
function showConfirmModal(opts) {
  document.querySelector('.sell-modal-overlay')?.remove();
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:440px">';
  m += '<div class="sell-modal-header">' + (opts.title || 'Confirm') + '</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc" style="white-space:pre-line;line-height:1.5">' + opts.message + '</div>';
  m += '<div style="display:flex;gap:10px;margin-top:18px">';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" id="confirmModalCancel">' + (opts.cancelText || 'Cancel') + '</button>';
  m += '<button class="kd-game-btn ' + (opts.dangerous ? 'kd-game-btn-danger' : '') + '" style="flex:1" id="confirmModalOk">' + (opts.confirmText || 'Confirm') + '</button>';
  m += '</div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
  setTimeout(function(){
    var ok = document.getElementById('confirmModalOk');
    var cancel = document.getElementById('confirmModalCancel');
    if (ok) ok.addEventListener('click', function(){
      document.querySelector('.sell-modal-overlay')?.remove();
      if (opts.onConfirm) opts.onConfirm();
    });
    if (cancel) cancel.addEventListener('click', function(){
      document.querySelector('.sell-modal-overlay')?.remove();
    });
    if (ok) ok.focus();
  }, 30);
}

function showQuantityModal(opts) {
  // opts: {title, label, defaultValue, max, confirmText, dangerous, onConfirm}
  document.querySelector('.sell-modal-overlay')?.remove();
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:420px">';
  m += '<div class="sell-modal-header">' + opts.title + '</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">' + opts.label + '</div>';
  m += '<input type="number" id="qtyModalInput" class="inv-search" value="' + opts.defaultValue + '" min="1"' + (opts.max ? ' max="' + opts.max + '"' : '') + ' style="width:100%;font-family:Cinzel,serif;font-size:16px;padding:10px 14px;margin:8px 0;text-align:center" autofocus>';
  if (opts.max) m += '<div style="text-align:center;font-size:10px;color:#7a6a48">Max: ' + opts.max + '</div>';
  m += '<div style="display:flex;gap:10px;margin-top:14px">';
  m += '<button class="kd-game-btn ' + (opts.dangerous ? 'kd-game-btn-danger' : '') + '" style="flex:1" id="qtyModalConfirm">' + (opts.confirmText || 'Confirm') + '</button>';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</button>';
  m += '</div>';
  m += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
  setTimeout(function(){
    var inp = document.getElementById('qtyModalInput');
    var confirmBtn = document.getElementById('qtyModalConfirm');
    if (inp) {
      inp.focus();
      inp.select();
      var doConfirm = function() {
        var n = parseInt(inp.value);
        if (isNaN(n) || n <= 0) return;
        if (opts.max) n = Math.min(n, opts.max);
        document.querySelector('.sell-modal-overlay')?.remove();
        opts.onConfirm(n);
      };
      inp.addEventListener('keydown', function(e){
        if (e.key === 'Enter') doConfirm();
        if (e.key === 'Escape') document.querySelector('.sell-modal-overlay')?.remove();
      });
      if (confirmBtn) confirmBtn.addEventListener('click', doConfirm);
    }
  }, 50);
}

function partyDisbandTroop(troopId, troopName, maxCount) {
  showQuantityModal({
    title: '&#x2716; Disband ' + troopName,
    label: 'How many ' + troopName + ' to disband? They will leave your party permanently.',
    defaultValue: 1,
    max: maxCount,
    confirmText: 'Disband',
    dangerous: true,
    onConfirm: async function(n) {
      var res = await API.disbandTroop(troopId, n);
      if (res?.success) {
        showToast('Disbanded ' + res.removed + 'x ' + res.name + (res.remaining > 0 ? ' (' + res.remaining + ' remaining)' : ''));
        var el = document.getElementById('cmdTabContent');
        if (el) renderCmdParty(el);
      } else {
        showToast(res?.error || 'Disband failed', true);
      }
    }
  });
}

// ── Party — Recruit Prisoner ──
function partyRecruitPrisoner(troopId, troopName, maxCount) {
  showQuantityModal({
    title: '&#x1F464; Recruit ' + troopName,
    label: 'How many ' + troopName + ' to recruit from your prisoners?',
    defaultValue: maxCount,
    max: maxCount,
    confirmText: 'Recruit',
    onConfirm: async function(n) {
      var res = await API.recruitPrisoner(troopId, n);
      if (res?.success) {
        showToast('&#x1F464; Recruited ' + res.recruited + 'x ' + res.name + ' into your party');
        var el = document.getElementById('cmdTabContent');
        if (el) renderCmdParty(el);
      } else {
        showToast(res?.error || 'Recruit failed', true);
      }
    }
  });
}

// ── Party — Companion Detail Panel ──
async function partyShowCompanion(heroId, heroName) {
  // Load companion data
  const [charData, equipData] = await Promise.all([
    API.getPlayerCharacter(heroId).catch(() => null),
    API.getPlayerEquipment(heroId).catch(() => null)
  ]);
  if (!charData) { showToast('Could not load companion data', true); return; }

  document.querySelector('.party-detail-overlay')?.remove();
  let h = '<div class="party-detail-overlay" onclick="if(event.target===this)this.remove()">';
  h += '<div class="party-detail-modal">';
  h += '<div class="sell-modal-header">' + esc(charData.name || heroName) + ' <span class="cc-compare-close" onclick="this.closest(\'.party-detail-overlay\').remove()">&#x2715;</span></div>';
  h += '<div style="padding:14px">';

  // Basic info
  h += '<div class="insp-stats">';
  h += '<div class="insp-row"><span>Level</span><b>' + (charData.level||1) + '</b></div>';
  h += '<div class="insp-row"><span>Culture</span><b>' + esc(charData.culture||'') + '</b></div>';
  if (charData.age) h += '<div class="insp-row"><span>Age</span><b>' + charData.age + '</b></div>';
  h += '</div>';

  // Attributes
  if (charData.attributes) {
    h += '<div class="insp-section">Attributes</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
    const attrShort = {Vigor:'VIG',Control:'CTR',Endurance:'END',Cunning:'CNG',Social:'SOC',Intelligence:'INT',Naval:'NAV'};
    for (const [attr, val] of Object.entries(charData.attributes)) {
      h += '<div class="cc-attr-chip" style="padding:4px 8px"><span class="cc-attr-chip-val" style="font-size:16px">' + val + '</span>';
      h += '<span class="cc-attr-chip-label">' + (attrShort[attr]||attr) + '</span></div>';
    }
    h += '</div>';
  }

  // Top skills
  if (charData.skills?.length) {
    h += '<div class="insp-section">Top Skills</div>';
    h += '<div class="insp-stats">';
    const topSkills = [...charData.skills].sort((a,b) => b.value - a.value).slice(0, 8);
    for (const s of topSkills) {
      if (s.value <= 0) continue;
      h += '<div class="insp-bar-row"><span>' + esc(s.name) + '</span>';
      h += '<div class="insp-bar"><div class="insp-bar-fill insp-bar-armor" style="width:' + Math.min(100,s.value/330*100) + '%"></div></div>';
      h += '<b>' + s.value + '</b></div>';
    }
    h += '</div>';
  }

  // Equipment summary
  const battleGear = equipData?.battle || [];
  if (battleGear.length > 0) {
    h += '<div class="insp-section">Equipment</div>';
    h += '<div class="insp-stats">';
    let totalArmor = 0, maxDmg = 0;
    for (const item of battleGear) {
      totalArmor += (item.headArmor||0)+(item.bodyArmor||0)+(item.legArmor||0)+(item.armArmor||0);
      maxDmg = Math.max(maxDmg, item.swingDamage||0, item.thrustDamage||0);
      h += '<div class="insp-row"><span>' + esc(item.name) + '</span><b style="font-size:9px;color:#7a6a48">' + (_slotLabel(item.slot)||'') + '</b></div>';
    }
    h += '<div class="insp-row insp-row-total"><span>Total Armor</span><b>' + totalArmor + '</b></div>';
    h += '<div class="insp-row"><span>Max Damage</span><b>' + maxDmg + '</b></div>';
    h += '</div>';
  }

  // Actions
  h += '<div class="insp-actions" style="margin-top:12px">';
  h += '<span class="inv-action" onclick="this.closest(\'.party-detail-overlay\').remove();cmdSwitchHero(\'' + esc(heroId) + '\')">&#x1F464; View Character</span>';
  h += '<span class="inv-action" onclick="this.closest(\'.party-detail-overlay\').remove();_invHeroId=\'' + esc(heroId) + '\';invSwitchMode(\'equipment\')">&#x2694; Manage Gear</span>';
  h += '</div>';

  h += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

// ── Quests Tab — Split panel layout like in-game ──
// Deadline timeline — horizontal strip with quest dots positioned by days remaining
function renderQuestDeadlineTimeline(activeQuests) {
  const withDeadlines = activeQuests.filter(q => {
    const d = parseInt(q.timeRemaining);
    return !isNaN(d) && d >= 0;
  });
  if (withDeadlines.length === 0) return '';
  const maxDays = Math.max(30, ...withDeadlines.map(q => parseInt(q.timeRemaining) || 0));
  let html = '<div class="cmd-quests-timeline"><div class="cmd-quests-timeline-label">\u{23F3} Deadline Map</div><div class="cmd-quests-timeline-track">';
  // Danger zone (0-3 days)
  html += `<div class="cmd-quests-timeline-danger" style="width:${(3/maxDays)*100}%"></div>`;
  // Warning zone (3-7 days)
  html += `<div class="cmd-quests-timeline-warn" style="left:${(3/maxDays)*100}%;width:${((7-3)/maxDays)*100}%"></div>`;
  // Axis labels
  html += '<div class="cmd-quests-timeline-axis">';
  [0, 7, 14, 21, 30].filter(d => d <= maxDays).forEach(d => {
    html += `<span style="left:${(d/maxDays)*100}%">${d}d</span>`;
  });
  html += '</div>';
  // Quest dots
  withDeadlines.forEach(q => {
    const d = parseInt(q.timeRemaining) || 0;
    const pct = (d / maxDays) * 100;
    const cls = d <= 3 ? 'critical' : d <= 7 ? 'warn' : 'ok';
    html += `<div class="cmd-quests-timeline-dot ${cls}" style="left:${pct}%" title="${esc(q.title)} — ${d}d"></div>`;
  });
  html += '</div></div>';
  return html;
}

// ─────────────────────────────────────────────────────────
// Quest reward aggregator
// ─────────────────────────────────────────────────────────
// Compute total potential rewards across all active quests. The API returns
// each quest with optional reward fields — but the shape varies and some
// quests have narrative-only rewards (relation changes, stat boosts, etc).
//
// DECISIONS TO MAKE:
//  - Which fields count? (gold, xp, influence, renown, relation, items...)
//  - How to aggregate relation? (sum? max? count of beneficial relations?)
//  - Should failed-quest penalties be included?
//  - How to handle unknown quest types? (0 default? skip entirely?)
//
// INPUT:  activeQuests — array of quest objects from API.getPlayerQuests().active
// OUTPUT: { gold: number, xp: number, influence: number, renown: number, relation: number }
//
// The quest object shape typically includes:
//   q.rewards?: { gold?, xp?, influence?, renown?, relation? }
//   q.goldReward?: number
//   q.xpReward?: number
//   q.influenceReward?: number
//   q.renownReward?: number
//   q.relationReward?: number
//   q.description?: string (sometimes contains "Reward: 500 denars" text)
//
// Combined aggregator — uses all 4 approaches:
//   A = Optimistic sum        (totals.gold/xp/influence/renown)
//   B = Risk-adjusted expected (totals.expectedGold — weighted by time pressure)
//   C = Biggest single prize   (totals.biggestGold, biggestGiver)
//   D = Count-based relation   (totals.relation = count of POSITIVE relation gains,
//                                totals.relationAtRisk = count of quests with penalty on fail)
function aggregateQuestRewards(activeQuests) {
  const totals = {
    gold: 0, xp: 0, influence: 0, renown: 0, relation: 0,
    expectedGold: 0, biggestGold: 0, biggestGiver: '', relationAtRisk: 0,
  };
  if (!Array.isArray(activeQuests)) return totals;

  // Also try to parse "Reward: 500 denars" from description as a last resort
  const parseGoldFromText = (txt) => {
    if (!txt) return 0;
    const m = String(txt).match(/(\d[\d,]*)\s*(?:denars?|gold|coins?)/i);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) || 0 : 0;
  };

  for (const q of activeQuests) {
    const r = q.rewards || q;
    const g = Number(r.gold ?? q.goldReward ?? 0) || parseGoldFromText(q.description);
    const x = Number(r.xp ?? q.xpReward ?? 0) || 0;
    const i = Number(r.influence ?? q.influenceReward ?? 0) || 0;
    const rn = Number(r.renown ?? q.renownReward ?? 0) || 0;
    const rel = Number(r.relation ?? q.relationReward ?? 0) || 0;

    // A — sum
    totals.gold      += g;
    totals.xp        += x;
    totals.influence += i;
    totals.renown    += rn;

    // D — count positive relation gains (not sum — +10 with 3 people ≠ +30 with 1)
    if (rel > 0) totals.relation += 1;
    // Quests with deadlines carry penalty-on-fail risk
    const days = parseInt(q.timeRemaining);
    if (!isNaN(days)) totals.relationAtRisk += 1;

    // B — risk-adjusted: quests expiring soon discount toward 0
    //    30+ days → 100% weight, 0 days → 30% floor (still some value for completable-today)
    const weight = isNaN(days) ? 1 : Math.max(0.3, Math.min(1, days / 30));
    totals.expectedGold += Math.round(g * weight);

    // C — biggest single prize
    if (g > totals.biggestGold) {
      totals.biggestGold = g;
      totals.biggestGiver = q.giver || q.title || '';
    }
  }
  return totals;
}

async function renderCmdQuests(el) {
  const data = await API.getPlayerQuests();
  window._cmdQuestsData = data;

  const filter = window._questFilter || 'active';
  const sortBy = window._questSort || 'time';

  // Filter quests based on selected filter
  let displayQuests = [];
  if (filter === 'active') displayQuests = (data?.active || []).map(q => ({...q, status: 'active'}));
  else if (filter === 'completed') displayQuests = (data?.completed || []).map(q => ({...q, status: 'completed'}));
  else displayQuests = [...(data?.active || []).map(q => ({...q, status: 'active'})),
                        ...(data?.completed || []).map(q => ({...q, status: 'completed'}))];

  // Sort
  if (sortBy === 'time' && filter !== 'completed') {
    displayQuests.sort((a, b) => {
      const aT = parseInt(a.timeRemaining) || 999;
      const bT = parseInt(b.timeRemaining) || 999;
      return aT - bT;
    });
  } else if (sortBy === 'name') {
    displayQuests.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortBy === 'giver') {
    displayQuests.sort((a, b) => (a.giver || '').localeCompare(b.giver || ''));
  }

  // Count urgent quests
  const urgentCount = (data?.active || []).filter(q => q.timeRemaining && parseInt(q.timeRemaining) <= 3).length;

  let html = '';

  // ── Immersive top strip: title ribbon + gauges + reward preview + deadline timeline ──
  const activeQuests = data?.active || [];
  const completedQuests = data?.completed || [];
  const activeCount = activeQuests.length;
  const completedCount = completedQuests.length;

  // Auto-generated Questmaster title
  let questHonor = 'Wandering Adventurer';
  if (completedCount >= 50) questHonor = 'Legendary Questmaster';
  else if (completedCount >= 25) questHonor = 'Veteran Hero';
  else if (completedCount >= 10) questHonor = 'Seasoned Questmaster';
  else if (completedCount >= 5) questHonor = 'Rising Hero';
  else if (activeCount >= 5) questHonor = 'Burdened with Oaths';
  else if (activeCount > 0) questHonor = 'Pledged to a Cause';

  // Shortest deadline
  const deadlines = activeQuests
    .map(q => parseInt(q.timeRemaining))
    .filter(n => !isNaN(n));
  const nextDeadline = deadlines.length > 0 ? Math.min(...deadlines) : null;
  const deadlineLabel = nextDeadline === null ? '\u221E' : nextDeadline + 'd';
  const deadlineColor = nextDeadline === null ? '#7ac070' :
                        nextDeadline <= 3 ? '#c05050' :
                        nextDeadline <= 7 ? '#d49040' : '#7ac070';

  // Gauges
  const gR = 34, gCirc = 2 * Math.PI * gR;
  const activeMax = 10;
  const activePct = Math.min(100, (activeCount / activeMax) * 100);
  const activeDash = (activePct / 100) * gCirc;
  // Deadline gauge: inverted — closer to 0 days = fuller ring (more urgent)
  const deadlineMax = 30;
  const deadlinePct = nextDeadline === null ? 0 : Math.max(0, Math.min(100, ((deadlineMax - nextDeadline) / deadlineMax) * 100));
  const deadlineDash = (deadlinePct / 100) * gCirc;

  // Reward totals — computed by aggregateQuestRewards() (user-defined)
  const rewardTotals = aggregateQuestRewards(activeQuests);

  html += `<div class="cmd-quests-topstrip">
    <div class="cmd-quests-ribbon">\u{1F4DC} ${esc(questHonor)}</div>
    <div class="cmd-quests-gauge-row">
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${gR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${gR}" fill="none" stroke="url(#qActGrad)" stroke-width="6"
            stroke-dasharray="${activeDash} ${gCirc - activeDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(244,216,120,.5))"/>
          <defs><linearGradient id="qActGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a06c20"/><stop offset="1" stop-color="#f5d878"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val">${activeCount}</div>
          <div class="cmd-party-gauge-lbl">ACTIVE</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${gR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${gR}" fill="none" stroke="url(#qDlGrad)" stroke-width="6"
            stroke-dasharray="${deadlineDash} ${gCirc - deadlineDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px ${deadlineColor}88)"/>
          <defs><linearGradient id="qDlGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8a2820"/><stop offset="1" stop-color="${deadlineColor}"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val" style="color:${deadlineColor}">${deadlineLabel}</div>
          <div class="cmd-party-gauge-lbl">NEXT DUE</div>
        </div>
      </div>
      <div class="cmd-quests-rewards">
        <div class="cmd-quests-rewards-label">Potential Rewards</div>
        <div class="cmd-quests-rewards-row">
          ${rewardTotals.gold > 0 ? `<span class="cmd-quests-reward-chip" title="Optimistic total if all quests succeed${rewardTotals.expectedGold !== rewardTotals.gold ? ' — Expected: ' + rewardTotals.expectedGold.toLocaleString() : ''}"><span>\u{1F4B0}</span><b>${rewardTotals.gold.toLocaleString()}</b>${rewardTotals.expectedGold > 0 && rewardTotals.expectedGold !== rewardTotals.gold ? `<span class="cmd-quests-reward-exp">~${rewardTotals.expectedGold.toLocaleString()}</span>` : ''}</span>` : ''}
          ${rewardTotals.xp > 0 ? `<span class="cmd-quests-reward-chip"><span>\u{2728}</span><b>${rewardTotals.xp.toLocaleString()}</b></span>` : ''}
          ${rewardTotals.influence > 0 ? `<span class="cmd-quests-reward-chip"><span>\u{2726}</span><b>${rewardTotals.influence}</b></span>` : ''}
          ${rewardTotals.renown > 0 ? `<span class="cmd-quests-reward-chip"><span>\u{1F396}</span><b>${rewardTotals.renown}</b></span>` : ''}
          ${rewardTotals.relation > 0 ? `<span class="cmd-quests-reward-chip" title="${rewardTotals.relation} quest${rewardTotals.relation>1?'s':''} will improve relationships"><span>\u{1F91D}</span><b>+${rewardTotals.relation}</b></span>` : ''}
          ${rewardTotals.gold + rewardTotals.xp + rewardTotals.influence + rewardTotals.renown + rewardTotals.relation === 0 ? '<span class="cmd-quests-reward-empty">No active quests</span>' : ''}
        </div>
        ${rewardTotals.biggestGold > 0 ? `<div class="cmd-quests-biggest-prize">
          <span class="cmd-quests-biggest-icon">\u{1F3C6}</span>
          <span class="cmd-quests-biggest-label">Biggest Prize:</span>
          <span class="cmd-quests-biggest-value">${rewardTotals.biggestGold.toLocaleString()}\u{25C9}</span>
          ${rewardTotals.biggestGiver ? `<span class="cmd-quests-biggest-giver">from ${esc(rewardTotals.biggestGiver)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
    ${activeQuests.length > 0 ? renderQuestDeadlineTimeline(activeQuests) : ''}
  </div>`;

  // Top bar — filter tabs + sort + urgent banner
  html += '<div class="quest-top-bar">';
  html += '<div class="quest-filters">';
  const filters = [
    {id:'active', label:'Active', icon:'&#x2757;', count:data?.activeCount||0},
    {id:'completed', label:'Completed', icon:'&#x2714;', count:data?.completedCount||0},
    {id:'all', label:'All', icon:'&#x1F4DC;', count:(data?.activeCount||0)+(data?.completedCount||0)}
  ];
  for (const f of filters) {
    html += '<div class="quest-filter-btn' + (filter===f.id?' active':'') + '" onclick="window._questFilter=\'' + f.id + '\';renderCmdQuests(document.getElementById(\'cmdTabContent\'))">';
    html += '<span class="qf-icon">' + f.icon + '</span><span class="qf-label">' + f.label + '</span><span class="qf-count">' + f.count + '</span>';
    html += '</div>';
  }
  html += '</div>';
  html += '<select class="inv-sort" onchange="window._questSort=this.value;renderCmdQuests(document.getElementById(\'cmdTabContent\'))">';
  html += '<option value="time"' + (sortBy==='time'?' selected':'') + '>Sort: Time Remaining</option>';
  html += '<option value="name"' + (sortBy==='name'?' selected':'') + '>Sort: Name</option>';
  html += '<option value="giver"' + (sortBy==='giver'?' selected':'') + '>Sort: Giver</option>';
  html += '</select>';
  html += '</div>';

  if (urgentCount > 0 && filter !== 'completed') {
    html += '<div class="quest-urgent-banner">&#x26A0; <b>' + urgentCount + '</b> quest' + (urgentCount > 1 ? 's' : '') + ' expiring within 3 days!</div>';
  }

  html += '<div class="cmd-quest-layout">';

  // Left sidebar — filtered quest list
  html += '<div class="cmd-quest-sidebar">';
  if (displayQuests.length) {
    displayQuests.forEach((q, i) => {
      const isActive = q.status === 'active';
      const days = parseInt(q.timeRemaining) || 0;
      const urgencyClass = isActive ? (days <= 3 ? ' cmd-quest-critical' : days <= 7 ? ' cmd-quest-urgent' : '') : ' cmd-quest-item-done';
      const icon = !isActive ? '&#x2714;' : days <= 3 ? '&#x26A0;' : '&#x2757;';
      const progPct = q.progressRange > 0 ? Math.round(q.currentProgress / q.progressRange * 100) : 0;
      html += `<div class="cmd-quest-item${urgencyClass}${i === 0 ? ' selected' : ''}" data-quest-idx="${i}" data-quest-status="${q.status}" onclick="selectQuest(this, ${i}, '${q.status}')">
        <span class="cmd-qi-icon">${icon}</span>
        <div class="cmd-qi-info">
          <span class="cmd-qi-title">${esc(q.title)}</span>
          <div class="cmd-qi-meta">
            ${q.giver ? '<span class="cmd-qi-giver">' + esc(q.giver) + '</span>' : ''}
            ${isActive && q.timeRemaining ? '<span class="cmd-qi-days">' + esc(q.timeRemaining) + 'd</span>' : ''}
          </div>
          ${isActive && q.progressRange > 0 ? '<div class="cmd-qi-prog"><div class="cmd-qi-prog-fill" style="width:' + progPct + '%"></div></div>' : ''}
        </div>
      </div>`;
    });
  } else {
    html += '<div class="cmd-quest-empty">No ' + filter + ' quests</div>';
  }
  html += '</div>';

  // Right panel — quest detail
  html += '<div class="cmd-quest-detail" id="cmdQuestDetail">';
  if (displayQuests.length > 0) {
    html += renderQuestDetail(displayQuests[0]);
  } else {
    html += '<div class="empty">Select a quest to view details.</div>';
  }
  html += '</div></div>';

  el.innerHTML = html;

  // Save filtered quests for selection
  window._cmdQuestsFiltered = displayQuests;
}

function renderQuestDetail(q) {
  if (!q) return '<div class="empty" style="padding:60px;text-align:center;font-family:Cinzel,serif;letter-spacing:2px;color:#6a5a3a">Select a quest to view details.</div>';

  // Find giver portrait
  const giverHero = q.giverHeroId ? (Store.heroes || []).find(h => h.id === q.giverHeroId) : null;
  const giverPortrait = giverHero ? getPortraitSrc(giverHero, giverHero) : '';
  const gpStyle = giverHero && isGamePortrait(giverHero);

  // Header with Time Remaining and Quest Given By (top right, like in-game)
  let html = '<div class="cmd-qd-header"><div class="cmd-qd-meta">';
  if (q.timeRemaining && q.status === 'active') {
    html += `<div class="cmd-qd-time">
      <span class="cmd-qd-time-head">Time Remaining</span>
      <span class="cmd-qd-time-val">${esc(q.timeRemaining)}</span>
      <span class="cmd-qd-time-label">Days</span>
    </div>`;
  }
  if (q.status === 'completed') {
    html += `<div class="cmd-qd-time" style="border-color:rgba(91,159,105,.2)">
      <span class="cmd-qd-time-head">Status</span>
      <span class="cmd-qd-time-val" style="font-size:22px;color:#6aaf78">&#x2714;</span>
      <span class="cmd-qd-time-label" style="color:#6aaf78">Complete</span>
    </div>`;
  }
  if (q.giver) {
    html += `<div class="cmd-qd-giver-info" ${q.giverHeroId ? `onclick="openDetail('heroes','${esc(q.giverHeroId)}')"` : ''}>
      <span class="cmd-qd-giver-label">Quest Given By</span>
      ${giverPortrait ? `<img class="cmd-qd-giver-portrait${gpStyle ? ' game-portrait' : ''}" src="${giverPortrait}" alt="" onerror="this.style.display='none'"${gpStyle ? ` style="${GP_STYLE}"` : ''}>` : '<div class="cmd-qd-giver-portrait" style="display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);color:#6a5a3a;font-size:24px">&#x2694;</div>'}
      <span class="cmd-qd-giver-name">${esc(q.giver)}</span>
    </div>`;
  }
  html += '</div></div>';

  // Quest type + location badges
  html += '<div class="cmd-qd-badges">';
  if (q.questType) {
    const typeIcons = {Artisan:'&#x1F528;',Merchant:'&#x1F4B0;',Landowner:'&#x1F33E;',Gang:'&#x2694;',Headman:'&#x1F3E0;',
      Notable:'&#x2B50;',Lord:'&#x1F451;',Army:'&#x2694;',Escort:'&#x1F6E1;',Deliver:'&#x1F4E6;',Spy:'&#x1F441;',
      Bandit:'&#x2620;',Rival:'&#x2694;',Family:'&#x1F464;',Need:'&#x2757;',Poacher:'&#x1F3F9;'};
    const typeIcon = Object.entries(typeIcons).find(([k]) => q.questType.includes(k))?.[1] || '&#x2757;';
    html += '<span class="qd-badge">' + typeIcon + ' ' + esc(q.questType) + '</span>';
  }
  if (q.settlement) {
    html += '<span class="qd-badge qd-badge-loc" ' + (q.settlementId ? 'onclick="invTrackSettlement(\'' + esc(q.settlementId) + '\',\'' + esc(q.settlement) + '\')" style="cursor:pointer"' : '') + '>&#x1F3F0; ' + esc(q.settlement) + '</span>';
  }
  if (q.giverClan) html += '<span class="qd-badge">&#x1F6E1; ' + esc(q.giverClan) + '</span>';
  if (q.giverKingdom) html += '<span class="qd-badge">&#x1F451; ' + esc(q.giverKingdom) + '</span>';
  // Difficulty estimate based on time + progress
  const diffScore = q.progressRange > 3 ? 'Hard' : q.progressRange > 1 ? 'Medium' : 'Easy';
  const diffColor = diffScore === 'Hard' ? '#c06040' : diffScore === 'Medium' ? '#c0a040' : '#60a060';
  html += '<span class="qd-badge" style="color:' + diffColor + ';border-color:' + diffColor + '40">' + diffScore + '</span>';
  html += '</div>';

  // Title
  html += `<h2 class="cmd-qd-title">${esc(q.title)}</h2>`;

  // Description body with bullet points (split by newlines for multi-log entries)
  const descLines = (q.description || '').split('\n').filter(l => l.trim());
  if (descLines.length > 0) {
    for (const line of descLines) {
      // Enhance hero names in description — wrap bold/colored names
      const enhanced = textToHtml(line);
      html += `<div class="cmd-qd-body">
        <div class="cmd-qd-bullet">&#x25CF;</div>
        <div class="cmd-qd-text">${enhanced}</div>
      </div>`;
    }
  } else {
    html += `<div class="cmd-qd-body">
      <div class="cmd-qd-bullet">&#x25CF;</div>
      <div class="cmd-qd-text">${q.giver ? `<strong>${esc(q.giver)}</strong> has given you a task.` : 'Quest details not available.'}</div>
    </div>`;
  }

  // Progress bar with task name
  if (q.progressRange > 0) {
    const pct = Math.round(q.currentProgress / q.progressRange * 100);
    const isComplete = q.currentProgress >= q.progressRange;
    html += `<div class="cmd-qd-progress">
      <span class="cmd-qd-prog-label">${q.taskName ? esc(q.taskName) : 'Progress'}</span>
      <div class="cmd-qd-prog-bar"><div class="cmd-qd-prog-fill" style="width:${pct}%${isComplete ? ';background:linear-gradient(90deg,rgba(91,159,105,.5),rgba(110,180,120,.8));box-shadow:0 0 12px rgba(91,159,105,.3)' : ''}"></div></div>
      <span class="cmd-qd-prog-val" ${isComplete ? 'style="color:#6aaf78"' : ''}>${q.currentProgress} / ${q.progressRange}</span>
    </div>`;
  }

  // Journal entries
  if (q.journal?.length > 0) {
    html += '<div class="cmd-qd-journal">';
    html += '<div class="cmd-qd-journal-header">&#x1F4DC; Quest Journal</div>';
    for (let ji = q.journal.length - 1; ji >= 0; ji--) {
      html += '<div class="cmd-qd-journal-entry">';
      html += '<span class="cmd-qd-je-num">' + (ji + 1) + '</span>';
      html += '<span class="cmd-qd-je-text">' + textToHtml(q.journal[ji]) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Consequences warning
  if (q.status === 'active' && q.timeRemaining) {
    const daysLeft = parseInt(q.timeRemaining) || 99;
    if (daysLeft <= 5) {
      html += '<div class="cmd-qd-warning">&#x26A0; Failing this quest may damage your relationship with ' + esc(q.giver||'the quest giver') + (q.giverClan ? ' and ' + esc(q.giverClan) + ' clan' : '') + '.</div>';
    }
  }

  // Actions
  html += '<div class="cmd-qd-actions">';
  if (q.giverHeroId) {
    html += '<span class="inv-action" onclick="openDetail(\'heroes\',\'' + esc(q.giverHeroId) + '\')">&#x1F464; View ' + esc(q.giver||'Giver') + '</span>';
  }
  if (q.settlementId) {
    html += '<span class="inv-action" onclick="invTrackSettlement(\'' + esc(q.settlementId) + '\',\'' + esc(q.settlement||'') + '\')">&#x1F4CD; Track Location</span>';
  } else if (q.settlement) {
    html += '<span class="inv-action" style="opacity:.5">&#x1F3F0; ' + esc(q.settlement) + '</span>';
  }
  html += '</div>';

  // Footer
  if (q.giver) {
    html += `<div class="cmd-qd-footer">Given by <strong>${esc(q.giver)}</strong>${q.dueDate ? ` &mdash; Due: ${esc(q.dueDate)}` : ''}</div>`;
  }

  return html;
}

function selectQuest(element, idx, status) {
  document.querySelectorAll('.cmd-quest-item').forEach(i => i.classList.remove('selected'));
  element.classList.add('selected');
  // Use filtered list (which respects current filter + sort)
  const filtered = window._cmdQuestsFiltered;
  if (filtered && filtered[idx]) {
    const detail = document.getElementById('cmdQuestDetail');
    if (detail) detail.innerHTML = renderQuestDetail(filtered[idx]);
    return;
  }
  // Fallback to raw data
  const data = window._cmdQuestsData;
  if (!data) return;
  const quest = status === 'active' ? data.active?.[idx] : data.completed?.[idx];
  if (quest) {
    const detail = document.getElementById('cmdQuestDetail');
    if (detail) detail.innerHTML = renderQuestDetail({...quest, status});
  }
}


// ── Clan Tab ──
async function renderCmdClan(el) {
  const [data, troopsRaw] = await Promise.all([
    API.getPlayerClan(),
    API.getPlayerTroops().catch(() => null)
  ]);
  if (!data || data.error) { el.innerHTML = '<div class="empty">No clan data.</div>'; return; }
  window._clanData = data;
  // Calculate troop composition
  var _clanInf=0,_clanRng=0,_clanCav=0,_clanHA=0;
  if (troopsRaw?.troops) {
    troopsRaw.troops.filter(function(t){return !t.isHero}).forEach(function(t) {
      if (t.isMounted && t.isRanged) _clanHA += t.count;
      else if (t.isMounted) _clanCav += t.count;
      else if (t.isRanged) _clanRng += t.count;
      else _clanInf += t.count;
    });
  }

  let html = '';

  // ── Immersive Clan top strip ──
  // Auto-generated honorific based on tier, fiefs, renown
  const tier = Number(data.tier) || 0;
  const renown = Number(data.renown) || 0;
  const influence = Number(data.influence) || 0;
  const fiefCount = (Number(data.towns)||0) + (Number(data.castles)||0);
  const villages = Number(data.villages) || 0;
  const memberCount = (data.members || []).length;

  let clanHonor = 'Landless Adventurers';
  if (tier >= 6 && fiefCount >= 5) clanHonor = 'Royal Dynasty';
  else if (tier >= 5) clanHonor = 'Great House of the Realm';
  else if (tier >= 4 && fiefCount >= 3) clanHonor = 'Ascendant Noble House';
  else if (tier >= 4) clanHonor = 'Notable Noble House';
  else if (tier >= 3) clanHonor = 'Respected Warband';
  else if (fiefCount > 0) clanHonor = 'Minor Landholders';
  else if (memberCount >= 5) clanHonor = 'Growing Warband';

  // Renown progress to next tier (Bannerlord tier thresholds approximate)
  const tierThresholds = [0, 0, 150, 450, 900, 1500, 2250, 3150];
  const nextTierRenown = tierThresholds[Math.min(tier + 1, tierThresholds.length - 1)];
  const curTierRenown = tierThresholds[Math.min(tier, tierThresholds.length - 1)];
  const tierProgress = nextTierRenown > curTierRenown
    ? Math.min(100, ((renown - curTierRenown) / (nextTierRenown - curTierRenown)) * 100)
    : 100;

  // Gauges
  const cgR = 34, cgCirc = 2 * Math.PI * cgR;
  const renownDash = (tierProgress / 100) * cgCirc;
  // Influence relative to 500 cap
  const infPct = Math.min(100, (influence / 500) * 100);
  const infDash = (infPct / 100) * cgCirc;

  // Wealth pressure — days until bankrupt
  const pDataPre = _cmdData?.party || {};
  const heroGoldPre = data.gold || _cmdData?.hero?.gold || 0;
  const dailyWagePre = pDataPre.dailyWage || _cmdData?.hero?.dailyWage || 0;
  const daysAffordPre = dailyWagePre > 0 ? Math.floor(heroGoldPre / dailyWagePre) : 999;
  // Wealth gauge: 60+ days = 100%, 0 days = 0%
  const wealthPct = Math.min(100, (daysAffordPre / 60) * 100);
  const wealthDash = (wealthPct / 100) * cgCirc;
  const wealthColor = daysAffordPre > 30 ? '#7ac070' : daysAffordPre > 7 ? '#d4b060' : '#c05050';

  html += `<div class="cmd-clan-topstrip">
    <div class="cmd-clan-ribbon">\u{1F451} ${esc(clanHonor)}</div>
    <div class="cmd-clan-gauge-row">
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="url(#cgRenown)" stroke-width="6"
            stroke-dasharray="${renownDash} ${cgCirc - renownDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(244,216,120,.5))"/>
          <defs><linearGradient id="cgRenown" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a06c20"/><stop offset="1" stop-color="#f5d878"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val">T${tier}</div>
          <div class="cmd-party-gauge-lbl">${tier < 6 ? 'TIER' : 'MAX'}</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="url(#cgInf)" stroke-width="6"
            stroke-dasharray="${infDash} ${cgCirc - infDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(128,160,208,.5))"/>
          <defs><linearGradient id="cgInf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#3a5878"/><stop offset="1" stop-color="#80a0d0"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val" style="color:#a0c0e0">${influence}</div>
          <div class="cmd-party-gauge-lbl">INFLUENCE</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${cgR}" fill="none" stroke="url(#cgWealth)" stroke-width="6"
            stroke-dasharray="${wealthDash} ${cgCirc - wealthDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px ${wealthColor}88)"/>
          <defs><linearGradient id="cgWealth" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8a2820"/><stop offset="1" stop-color="${wealthColor}"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val" style="color:${wealthColor}">${daysAffordPre > 999 ? '\u221E' : daysAffordPre + 'd'}</div>
          <div class="cmd-party-gauge-lbl">SOLVENCY</div>
        </div>
      </div>
      <div class="cmd-clan-power-stats">
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F465}</span>
          <b class="cmd-clan-ps-val" data-count-target="${memberCount}">0</b>
          <span class="cmd-clan-ps-lbl">Members</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F3F0}</span>
          <b class="cmd-clan-ps-val" data-count-target="${fiefCount}">0</b>
          <span class="cmd-clan-ps-lbl">Fiefs</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F33E}</span>
          <b class="cmd-clan-ps-val" data-count-target="${villages}">0</b>
          <span class="cmd-clan-ps-lbl">Villages</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F396}</span>
          <b class="cmd-clan-ps-val" data-count-target="${renown}">0</b>
          <span class="cmd-clan-ps-lbl">Renown</span>
        </div>
      </div>
    </div>
    ${tier < 6 && nextTierRenown > renown ? `
    <div class="cmd-clan-tier-progress">
      <div class="cmd-clan-tier-label">Tier ${tier + 1} in <b>${(nextTierRenown - renown).toLocaleString()}</b> renown</div>
      <div class="cmd-clan-tier-bar"><div class="cmd-clan-tier-fill" style="width:${tierProgress}%"></div></div>
    </div>` : ''}
  </div>`;

  // ── Clan Banner Header ──
  html += '<div class="clan-hdr">';
  if (data.bannerCode) html += '<div class="clan-hdr-banner" id="clanBannerCanvas"></div>';
  html += '<div class="clan-hdr-info">';
  html += '<h2 class="clan-hdr-name">' + esc(data.name) + '</h2>';
  html += '<div class="clan-hdr-tier">Clan Tier ' + data.tier + '</div>';
  html += '</div>';
  html += '<div class="clan-hdr-stats">';
  html += '<div class="clan-hdr-stat"><b>' + (data.renown||0).toLocaleString() + '</b><span>Renown</span></div>';
  html += '<div class="clan-hdr-stat"><b>' + (data.influence||0).toLocaleString() + '</b><span>Influence</span></div>';
  html += '<div class="clan-hdr-stat"><b>' + (data.gold||0).toLocaleString() + '</b><span>&#x25C9; Gold</span></div>';
  html += '</div>';
  html += '</div>';

  // ── Finances (always visible) ──
  const pData = _cmdData?.party || {};
  const heroGold = data.gold || _cmdData?.hero?.gold || 0;
  const dailyWage = pData.dailyWage || _cmdData?.hero?.dailyWage || 0;
  const daysAfford = dailyWage > 0 ? Math.floor(heroGold / dailyWage) : 999;
  const daysColor = daysAfford > 30 ? '#6ab870' : daysAfford > 7 ? '#d4b060' : '#e07060';

  html += '<div class="clan-section">';
  html += '<div class="clan-section-hdr">&#x1F4B0; Finances</div>';
  html += '<div class="clan-finance">';
  html += '<div class="clan-fin-row"><span>&#x1F4B0; Treasury</span><b class="clan-fin-gold">' + heroGold.toLocaleString() + ' &#x25C9;</b></div>';
  if (dailyWage > 0) html += '<div class="clan-fin-row"><span>&#x2694; Daily Wages</span><b class="clan-fin-neg">-' + dailyWage + ' &#x25C9;/day</b></div>';
  if (pData.partyWage) html += '<div class="clan-fin-row"><span>&nbsp;&nbsp;Party Wages</span><b>-' + pData.partyWage + '</b></div>';
  if (pData.garrisonWage) html += '<div class="clan-fin-row"><span>&nbsp;&nbsp;Garrison Wages</span><b>-' + pData.garrisonWage + '</b></div>';
  if (dailyWage > 0) html += '<div class="clan-fin-row clan-fin-total"><span>&#x23F3; Can Afford</span><b style="color:' + daysColor + '">' + daysAfford + ' days</b></div>';
  if (data.towns > 0 || data.castles > 0) {
    html += '<div class="clan-fin-row"><span>&#x1F3D8; Fief Income (est.)</span><b class="clan-fin-pos">+' + ((data.towns * 200) + (data.castles * 100) + (data.villages * 50)) + ' &#x25C9;/day</b></div>';
  }
  html += '</div></div>';

  // ── Sub-tab switcher ──
  const clanTab = window._clanTab || 'members';
  html += '<div class="inv-modes">';
  const clanModes = [{id:'members',icon:'&#x1F465;',label:'Members'},{id:'parties',icon:'&#x2694;',label:'Parties'},{id:'fiefs',icon:'&#x1F3F0;',label:'Fiefs'},{id:'other',icon:'&#x2699;',label:'Other'}];
  for (const m of clanModes) {
    html += '<div class="inv-mode' + (clanTab===m.id?' inv-mode-active':'') + '" onclick="window._clanTab=\'' + m.id + '\';renderCmdClan(document.getElementById(\'cmdTabContent\'))">';
    html += '<span class="inv-mode-icon">' + m.icon + '</span> ' + m.label + '</div>';
  }
  html += '</div>';

  const family = (data.members||[]).filter(m => !m.isCompanion);
  const companions = (data.members||[]).filter(m => m.isCompanion);

  // ═══ MEMBERS TAB ═══
  if (clanTab === 'members') {
    // Summary strip
    const marriedCount = family.filter(m => m.isMarried).length;
    const avgAge = family.length > 0 ? Math.round(family.reduce((s, m) => s + (m.age || 0), 0) / family.length) : 0;
    const children = family.filter(m => (m.age || 0) < 18).length;
    const adults = family.length - children;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F451}</span><b data-count-target="${family.length}">0</b><span>Family</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2694}</span><b data-count-target="${companions.length}">0</b><span>Companions</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F46A}</span><b data-count-target="${adults}">0</b><span>Adults</span></div>
      ${children > 0 ? `<div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F476}</span><b data-count-target="${children}">0</b><span>Children</span></div>` : ''}
      ${marriedCount > 0 ? `<div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F48D}</span><b data-count-target="${marriedCount}">0</b><span>Married</span></div>` : ''}
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F4C5}</span><b data-count-target="${avgAge}">0</b><span>Avg Age</span></div>
    </div>`;
    html += '<div class="clan-split">';
    html += '<div class="clan-split-left">';
    html += '<div class="clan-group-hdr">&#x1F451; Family (' + family.length + ')</div>';
    for (const m of family) {
      const mHero = (Store.heroes||[]).find(h => h.id === m.id);
      const mPortrait = mHero ? getPortraitSrc(mHero, mHero) : '';
      const gpM = mHero && isGamePortrait(mHero);
      html += '<div class="clan-member" onclick="clanShowMember(\'' + esc(m.id) + '\')">';
      if (mPortrait) html += '<img class="clan-member-portrait' + (gpM ? ' game-portrait' : '') + '" src="' + mPortrait + '" alt="" onerror="this.style.display=\'none\'"' + (gpM ? ' style="' + GP_STYLE + ';width:40px;height:40px;border-radius:5px"' : '') + '>';
      else html += '<div class="clan-member-no-img">&#x1F464;</div>';
      html += '<div class="clan-member-info"><span class="clan-member-name">' + esc(m.name) + '</span>';
      html += '<span class="clan-member-role">' + (m.isPlayer ? 'Leader' : 'Family') + ' · Age ' + m.age + '</span></div></div>';
    }
    html += '<div class="clan-group-hdr">&#x2694; Companions (' + companions.length + ')</div>';
    for (const m of companions) {
      const mHero = (Store.heroes||[]).find(h => h.id === m.id);
      const mPortrait = mHero ? getPortraitSrc(mHero, mHero) : '';
      const gpM = mHero && isGamePortrait(mHero);
      html += '<div class="clan-member" onclick="clanShowMember(\'' + esc(m.id) + '\')">';
      if (mPortrait) html += '<img class="clan-member-portrait' + (gpM ? ' game-portrait' : '') + '" src="' + mPortrait + '" alt="" onerror="this.style.display=\'none\'"' + (gpM ? ' style="' + GP_STYLE + ';width:40px;height:40px;border-radius:5px"' : '') + '>';
      else html += '<div class="clan-member-no-img">&#x1F464;</div>';
      html += '<div class="clan-member-info"><span class="clan-member-name">' + esc(m.name) + '</span>';
      html += '<span class="clan-member-role" style="color:#80b060">Companion · Age ' + m.age + '</span></div></div>';
    }
    html += '</div>';
    html += '<div class="clan-split-right" id="clanMemberDetail"><div class="inv-empty">Select a member</div></div>';
    html += '</div>';
  }

  // ═══ PARTIES TAB — Game-style layout ═══
  else if (clanTab === 'parties') {
    const pData2 = _cmdData?.party || {};
    const heroName = _cmdData?.hero?.name || '';
    const parties = data.parties || [];
    const ownedFiefs = (Store.settlements||[]).filter(s => (s.owner === data.name || s.clan === data.name) && (s.isTown || s.type === 'Town' || s.isCastle || s.type === 'Castle'));

    // Summary strip
    const caravansPre = data.caravans || [];
    const totalPartyTroops = parties.reduce((s, p) => s + (Number(p.troops) || 0), 0);
    const totalCaravanGoldPre = caravansPre.reduce((s, c) => s + (Number(c.gold) || 0), 0);
    const playerParty = parties.find(p => p.leader === heroName);
    const playerSize = playerParty ? (Number(playerParty.troops) || 0) : 0;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2694}</span><b data-count-target="${parties.length}">0</b><span>Parties</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F465}</span><b data-count-target="${totalPartyTroops}">0</b><span>Total Men</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F4E6}</span><b data-count-target="${caravansPre.length}">0</b><span>Caravans</span></div>
      ${totalCaravanGoldPre > 0 ? `<div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{1F4B0}</span><b data-count-target="${totalCaravanGoldPre}">0</b><span>Trade Gold</span></div>` : ''}
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3F0}</span><b data-count-target="${ownedFiefs.length}">0</b><span>Garrisons</span></div>
      ${playerParty ? `<div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{2605}</span><b data-count-target="${playerSize}">0</b><span>Your Party</span></div>` : ''}
    </div>`;

    html += '<div class="clan-split">';

    // LEFT — Parties + Caravans + Garrisons table
    html += '<div class="clan-split-left">';
    html += '<div class="clan-group-hdr">&#x2694; Parties (' + parties.length + ')</div>';
    html += '<div class="cp-hdr-row"><span class="cp-h-thumb"></span><span class="cp-h-name">Name</span><span class="cp-h-loc">Location</span><span class="cp-h-size">Size</span></div>';
    for (var pi2 = 0; pi2 < parties.length; pi2++) {
      var p2 = parties[pi2];
      var p2Hero = (Store.heroes||[]).find(function(h){return h.id === p2.leaderId});
      var p2Portrait = p2Hero ? getPortraitSrc(p2Hero, p2Hero) : '';
      var gpP2 = p2Hero && isGamePortrait(p2Hero);
      html += '<div class="cp-row' + (pi2===0?' cp-row-active':'') + '" onclick="clanSelectParty(' + pi2 + ')">';
      html += '<span class="cp-h-thumb">';
      if (p2Portrait) html += '<img class="cp-thumb-portrait' + (gpP2 ? ' game-portrait' : '') + '" src="' + p2Portrait + '" alt=""' + (gpP2 ? ' style="' + GP_STYLE + ';width:32px;height:32px;border-radius:3px"' : '') + '>';
      else html += '<span class="cp-thumb-blank">&#x2694;</span>';
      html += '</span>';
      html += '<span class="cp-h-name">' + (p2.leader === heroName ? '&#x1F451; ' : '') + esc(p2.name) + '</span>';
      html += '<span class="cp-h-loc">' + esc(p2.location || '—') + '</span>';
      html += '<span class="cp-h-size">' + p2.troops + (p2.limit ? '/' + p2.limit : '') + '</span>';
      html += '</div>';
    }
    if (!parties.length) html += '<div class="inv-empty" style="padding:8px">No parties</div>';
    html += '<div class="cp-row" onclick="clanCreateParty()" style="border:1px dashed rgba(184,140,50,.15);cursor:pointer;justify-content:center;opacity:.7"><span class="cp-h-name" style="color:#7a6a48">+ Create New Party</span></div>';
    var caravans = data.caravans || [];
    var totalCaravanGold = 0;
    caravans.forEach(function(cv){ totalCaravanGold += (cv.gold || 0); });
    html += '<div class="clan-group-hdr">&#x1F4E6; Caravans (' + caravans.length + ')' + (totalCaravanGold > 0 ? ' <span style="color:#70b060;font-size:10px">+' + totalCaravanGold.toLocaleString() + '&#x25C9;</span>' : '') + '</div>';
    if (caravans.length) {
      for (var ci2 = 0; ci2 < caravans.length; ci2++) {
        var cv = caravans[ci2];
        var profit = cv.gold || 0;
        var profitColor = profit > 1000 ? '#70b060' : profit > 0 ? '#b0986c' : '#c06040';
        var cvHero = (Store.heroes||[]).find(function(h){return h.id === cv.leaderId});
        var cvPortrait = cvHero ? getPortraitSrc(cvHero, cvHero) : '';
        var gpCV = cvHero && isGamePortrait(cvHero);
        html += '<div class="cp-row" style="cursor:default" title="' + esc(cv.leader || '') + '">';
        html += '<span class="cp-h-thumb">';
        if (cvPortrait) html += '<img class="cp-thumb-portrait' + (gpCV ? ' game-portrait' : '') + '" src="' + cvPortrait + '" alt=""' + (gpCV ? ' style="' + GP_STYLE + ';width:32px;height:32px;border-radius:3px"' : '') + '>';
        else html += '<span class="cp-thumb-blank">&#x1F4E6;</span>';
        html += '</span>';
        html += '<span class="cp-h-name">' + esc(cv.name || 'Caravan') + '</span>';
        html += '<span class="cp-h-loc">' + esc(cv.location || '—') + '</span>';
        html += '<span class="cp-h-size" style="color:' + profitColor + '">' + (cv.troops || 0) + 't';
        if (profit) html += ' · ' + (profit > 0 ? '+' : '') + profit.toLocaleString() + '&#x25C9;';
        html += '</span>';
        html += '</div>';
      }
    } else {
      html += '<div class="inv-empty" style="padding:8px">No caravans</div>';
    }
    html += '<div class="clan-group-hdr">&#x1F3F0; Garrisons (' + ownedFiefs.length + ')</div>';
    for (var fi2 = 0; fi2 < ownedFiefs.length; fi2++) {
      var f = ownedFiefs[fi2];
      var fImg2 = (f.isTown || f.type === 'Town') ? 'Settlement/Town.png' : 'Settlement/Castle.png';
      html += '<div class="cp-row" onclick="clanShowGarrison(\'' + esc(f.id) + '\')" style="cursor:pointer">';
      html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="' + fImg2 + '" alt="" onerror="this.style.display=\'none\'"></span>';
      html += '<span class="cp-h-name">' + esc(f.name) + '</span>';
      html += '<span class="cp-h-loc">' + (f.type || '') + '</span>';
      html += '<span class="cp-h-size">' + (f.garrison || 0) + '</span>';
      html += '</div>';
    }
    if (!ownedFiefs.length) html += '<div class="inv-empty" style="padding:8px">No garrisons</div>';
    html += '</div>';

    // RIGHT — Party detail panel (updates on click)
    html += '<div class="clan-split-right" id="clanPartyRight"></div>';
    html += '</div>';
    // Render will happen after innerHTML via clanSelectParty
  }

  // ═══ FIEFS TAB — Game-style layout ═══
  else if (clanTab === 'fiefs') {
    const ownedSettlements = (Store.settlements||[]).filter(s => s.owner === data.name || s.clan === data.name);
    const ownedTowns = ownedSettlements.filter(s => s.type === 'Town' || s.isTown);
    const ownedCastles = ownedSettlements.filter(s => s.type === 'Castle' || s.isCastle);
    const ownedVillages = ownedSettlements.filter(s => s.isVillage || s.type === 'Village');

    // Total income summary
    var totalIncome = 0, totalExpense = 0;
    ownedSettlements.forEach(function(s2) {
      totalIncome += s2.dailyIncome || (s2.isTown || s2.type === 'Town' ? 200 : s2.isCastle || s2.type === 'Castle' ? 100 : 50);
      totalExpense += s2.garrison ? Math.round(s2.garrison * 3) : 0;
    });
    // Themed summary strip
    const netDaily = totalIncome - totalExpense;
    const avgProsperityOwned = ownedSettlements.length > 0 ? Math.round(ownedSettlements.reduce((s, o) => s + (Number(o.prosperity) || 0), 0) / ownedSettlements.length) : 0;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3DB}</span><b data-count-target="${ownedTowns.length}">0</b><span>Towns</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3F0}</span><b data-count-target="${ownedCastles.length}">0</b><span>Castles</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F33E}</span><b data-count-target="${ownedVillages.length}">0</b><span>Villages</span></div>
      <div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{1F4B0}</span><b data-count-target="${totalIncome}">0</b><span>Income/day</span></div>
      ${totalExpense > 0 ? `<div class="kd-subtab-item kd-subtab-danger"><span class="kd-subtab-icon">\u{1F4B8}</span><b data-count-target="${totalExpense}">0</b><span>Expense/day</span></div>` : ''}
      <div class="kd-subtab-item ${netDaily >= 0 ? 'kd-subtab-success' : 'kd-subtab-danger'}"><span class="kd-subtab-icon">${netDaily >= 0 ? '\u{2B06}' : '\u{2B07}'}</span><b data-count-target="${Math.abs(netDaily)}">0</b><span>Net ${netDaily >= 0 ? 'Profit' : 'Loss'}</span></div>
      ${avgProsperityOwned > 0 ? `<div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F4C8}</span><b data-count-target="${avgProsperityOwned}">0</b><span>Avg Prosperity</span></div>` : ''}
    </div>`;

    html += '<div class="clan-split">';

    // LEFT — Fief list
    html += '<div class="clan-split-left">';
    html += '<div class="cp-hdr-row"><span class="cp-h-thumb"></span><span class="cp-h-name">Name</span><span class="cp-h-loc">Governor</span><span class="cp-h-size">Profit</span></div>';

    html += '<div class="clan-group-hdr">&#x1F3D8; Towns (' + ownedTowns.length + ')</div>';
    for (const s of ownedTowns) {
      var tProfit = (s.dailyIncome || 200) - (s.garrison ? s.garrison * 3 : 0);
      html += '<div class="cp-row" onclick="clanSelectFief(\'' + esc(s.id) + '\')" style="cursor:pointer">';
      html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="Settlement/Town.png" alt="" onerror="this.style.display=\'none\'"></span>';
      html += '<span class="cp-h-name">' + esc(s.name) + '</span>';
      html += '<span class="cp-h-loc">' + esc(s.governor || '—') + '</span>';
      html += '<span class="cp-h-size" style="color:' + (tProfit > 0 ? '#70b060' : '#c06040') + '">' + (tProfit > 0 ? '+' : '') + tProfit + '</span>';
      html += '</div>';
    }
    if (!ownedTowns.length) html += '<div class="inv-empty" style="padding:6px">No towns</div>';

    html += '<div class="clan-group-hdr">&#x1F3F0; Castles (' + ownedCastles.length + ')</div>';
    for (const s of ownedCastles) {
      var cProfit = (s.dailyIncome || 100) - (s.garrison ? s.garrison * 3 : 0);
      html += '<div class="cp-row" onclick="clanSelectFief(\'' + esc(s.id) + '\')" style="cursor:pointer">';
      html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="Settlement/Castle.png" alt="" onerror="this.style.display=\'none\'"></span>';
      html += '<span class="cp-h-name">' + esc(s.name) + '</span>';
      html += '<span class="cp-h-loc">' + esc(s.governor || '—') + '</span>';
      html += '<span class="cp-h-size" style="color:' + (cProfit > 0 ? '#70b060' : '#c06040') + '">' + (cProfit > 0 ? '+' : '') + cProfit + '</span>';
      html += '</div>';
    }
    if (!ownedCastles.length) html += '<div class="inv-empty" style="padding:6px">No castles</div>';

    if (ownedVillages.length > 0) {
      html += '<div class="clan-group-hdr">&#x1F33E; Villages (' + ownedVillages.length + ')</div>';
      for (const s of ownedVillages) {
        var vProfit = s.dailyIncome || 50;
        html += '<div class="cp-row" onclick="clanSelectFief(\'' + esc(s.id) + '\')" style="cursor:pointer">';
        html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="Settlement/Village.png" alt="" onerror="this.style.display=\'none\'"></span>';
        html += '<span class="cp-h-name">' + esc(s.name) + '</span>';
        html += '<span class="cp-h-loc">—</span>';
        html += '<span class="cp-h-size" style="color:#70b060">+' + vProfit + '</span>';
        html += '</div>';
      }
    }
    html += '</div>';

    // RIGHT — Fief detail
    html += '<div class="clan-split-right" id="clanFiefRight">';
    if (ownedSettlements.length > 0) {
      html += '<div class="inv-empty">Select a fief to view details</div>';
    } else {
      html += '<div style="text-align:center;padding:40px">';
      html += '<div style="font-size:40px;color:#3a3020;margin-bottom:10px">&#x1F3F0;</div>';
      html += '<div class="inv-empty">Clan Does Not Own Any Fiefs</div>';
      html += '</div>';
    }
    html += '</div></div>';

    // Auto-select first fief
    if (ownedSettlements.length > 0) {
      var firstFief = ownedTowns[0] || ownedCastles[0] || ownedVillages[0];
      if (firstFief) html += '<script>setTimeout(function(){clanSelectFief("' + esc(firstFief.id) + '")},50)</script>';
    }
  }

  // ═══ OTHER TAB — Workshops, Alleys, Supporters ═══
  else if (clanTab === 'other') {
    var workshops = data.workshops || [];
    var alleys = data.alleys || [];
    var supporters = data.supporters || [];

    // Summary strip
    const workshopIncome = workshops.reduce((s, w) => s + (Number(w.income) || 0), 0);
    const alleyIncome = alleys.reduce((s, a) => s + (Number(a.income) || 0), 0);
    const totalOtherIncome = workshopIncome + alleyIncome;
    const avgSupporterRelation = supporters.length > 0 ? Math.round(supporters.reduce((s, su) => s + (Number(su.relation) || 0), 0) / supporters.length) : 0;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3ED}</span><b data-count-target="${workshops.length}">0</b><span>Workshops</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F5E1}</span><b data-count-target="${alleys.length}">0</b><span>Alleys</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F465}</span><b data-count-target="${supporters.length}">0</b><span>Supporters</span></div>
      ${totalOtherIncome > 0 ? `<div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{1F4B0}</span><b data-count-target="${totalOtherIncome}">0</b><span>Total Income</span></div>` : ''}
      ${avgSupporterRelation > 0 ? `<div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{1F91D}</span><b data-count-target="${avgSupporterRelation}">0</b><span>Avg Relation</span></div>` : ''}
    </div>`;

    html += '<div class="clan-split">';

    // LEFT — Lists
    html += '<div class="clan-split-left">';

    // Workshops
    html += '<div class="clan-group-hdr">&#x1F3ED; Workshops (' + workshops.length + ')</div>';
    if (workshops.length) {
      for (var wsi3 = 0; wsi3 < workshops.length; wsi3++) {
        var ws3 = workshops[wsi3];
        html += '<div class="cp-row" onclick="clanOtherShowDetail(\'workshop\',' + wsi3 + ')" style="cursor:pointer">';
        html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="Settlement/Town.png" alt="" onerror="this.style.display=\'none\'"></span>';
        html += '<span class="cp-h-name">' + esc(ws3.type || ws3.name || 'Workshop') + '</span>';
        html += '<span class="cp-h-loc">' + esc(ws3.town || '') + '</span>';
        html += '<span class="cp-h-size" style="color:#70b060">' + (ws3.income > 0 ? '+' + ws3.income : ws3.income || '0') + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div class="inv-empty" style="padding:6px">No workshops owned</div>';
    }

    // Alleys
    html += '<div class="clan-group-hdr">&#x1F5E1; Alleys (' + alleys.length + ')</div>';
    if (alleys.length) {
      for (var ali = 0; ali < alleys.length; ali++) {
        var al = alleys[ali];
        html += '<div class="cp-row" onclick="clanOtherShowDetail(\'alley\',' + ali + ')" style="cursor:pointer">';
        html += '<span class="cp-h-thumb"><img class="cp-thumb-settlement" src="Settlement/Town.png" alt="" onerror="this.style.display=\'none\'"></span>';
        html += '<span class="cp-h-name">' + esc(al.name || 'Alley') + '</span>';
        html += '<span class="cp-h-loc">' + esc(al.town || '') + '</span>';
        html += '<span class="cp-h-size" style="color:#70b060">' + (al.income > 0 ? '+' + al.income : '0') + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div class="inv-empty" style="padding:6px">No alleys controlled</div>';
    }

    // Supporters
    html += '<div class="clan-group-hdr">&#x1F465; Supporters (' + supporters.length + ')</div>';
    if (supporters.length) {
      for (var sui = 0; sui < supporters.length; sui++) {
        var su = supporters[sui];
        var suHero = (Store.heroes||[]).find(function(h){return h.id === su.id});
        var suPortrait = suHero ? getPortraitSrc(suHero, suHero) : '';
        var gpSU = suHero && isGamePortrait(suHero);
        html += '<div class="cp-row" onclick="clanOtherShowDetail(\'supporter\',' + sui + ')" style="cursor:pointer">';
        html += '<span class="cp-h-thumb">';
        if (suPortrait) html += '<img class="cp-thumb-portrait' + (gpSU ? ' game-portrait' : '') + '" src="' + suPortrait + '" alt=""' + (gpSU ? ' style="' + GP_STYLE + ';width:32px;height:32px;border-radius:3px"' : '') + '>';
        else html += '<span class="cp-thumb-blank">&#x1F464;</span>';
        html += '</span>';
        html += '<span class="cp-h-name">' + esc(su.name) + '</span>';
        html += '<span class="cp-h-loc">' + esc(su.settlement || '') + '</span>';
        html += '<span class="cp-h-size" style="color:#80b060">+' + (su.relation || 0) + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div class="inv-empty" style="padding:6px">No supporters yet</div>';
    }

    html += '</div>';

    // RIGHT — Detail
    html += '<div class="clan-split-right" id="clanOtherDetail"><div class="inv-empty">Select an item to view details</div></div>';
    html += '</div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);

  // Auto-select first item on current tab
  if (clanTab === 'members' && family.length > 0) clanShowMember(family[0].id);
  if (clanTab === 'parties' && data.parties?.length) clanSelectParty(0);

  // Render clan banner
  if (data.bannerCode && window.renderBanner) {
    try {
      var bannerEl = document.getElementById('clanBannerCanvas');
      if (bannerEl && data.bannerCode) {
        if (typeof renderBannerInto === 'function') renderBannerInto(bannerEl, data.bannerCode, 80);
        else if (typeof renderBannerSVG === 'function') bannerEl.innerHTML = renderBannerSVG(data.bannerCode, 80);
      }
    } catch(e) {}
  }
}

// ── Clan — Member Detail ──
async function clanShowMember(heroId) {
  const panel = document.getElementById('clanMemberDetail');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-spinner"></div>';

  // Highlight selected
  document.querySelectorAll('.clan-member').forEach(c => c.classList.remove('clan-member-active'));
  document.querySelectorAll('.clan-member').forEach(c => {
    if (c.onclick?.toString().includes(heroId)) c.classList.add('clan-member-active');
  });

  const [charData, equipData] = await Promise.all([
    API.getPlayerCharacter(heroId).catch(() => null),
    API.getPlayerEquipment(heroId).catch(() => ({battle:[],civilian:[]}))
  ]);
  if (!charData) { panel.innerHTML = '<div class="inv-empty">Could not load member data</div>'; return; }

  let h = '';

  // Name + level
  h += '<div class="clan-detail-header">';
  const portrait = 'Hero/' + heroId + '.png';
  h += '<img class="clan-detail-portrait" src="' + portrait + '" alt="" onerror="this.style.display=\'none\'">';
  h += '<div class="clan-detail-info">';
  h += '<h3 class="clan-detail-name">' + esc(charData.name) + '</h3>';
  h += '<div class="clan-detail-sub">Level ' + (charData.level||1) + ' · ' + esc(charData.culture||'') + ' · Age ' + (charData.age||'?') + '</div>';
  h += '</div></div>';

  // Attributes
  if (charData.attributes) {
    h += '<div class="clan-detail-section">Attributes</div>';
    h += '<div class="clan-detail-attrs">';
    const attrShort = {Vigor:"VIG",Control:"CTR",Endurance:"END",Cunning:"CNG",Social:"SOC",Intelligence:"INT",Naval:"NAV"};
    for (const [attr, val] of Object.entries(charData.attributes)) {
      h += '<div class="clan-attr"><span class="clan-attr-val">' + val + '</span><span class="clan-attr-lbl">' + (attrShort[attr]||attr) + '</span></div>';
    }
    h += '</div>';
  }

  // Top skills
  if (charData.skills?.length) {
    h += '<div class="clan-detail-section">Skills</div>';
    h += '<div class="clan-detail-skills">';
    const topSkills = [...charData.skills].sort((a,b) => b.value - a.value).filter(s => s.value > 0).slice(0, 10);
    for (const s of topSkills) {
      const pct = Math.min(100, s.value / 330 * 100);
      h += '<div class="clan-skill-row"><span class="clan-skill-name">' + esc(s.name) + '</span>';
      h += '<div class="clan-skill-bar"><div class="clan-skill-fill" style="width:' + pct + '%"></div></div>';
      h += '<span class="clan-skill-val">' + s.value + '</span></div>';
    }
    h += '</div>';
  }

  // Traits
  if (charData.traits?.length) {
    h += '<div class="clan-detail-section">Traits</div>';
    h += '<div class="clan-detail-traits">';
    for (const t of charData.traits) {
      const cls = t.level > 0 ? 'color:#80c060' : t.level < 0 ? 'color:#c06050' : 'color:#8a7a50';
      h += '<span class="clan-trait-badge" style="' + cls + '">' + esc(t.name) + ' ' + (t.level > 0 ? '+' : '') + t.level + '</span>';
    }
    h += '</div>';
  }

  // Equipment summary
  const gear = equipData?.battle || [];
  if (gear.length > 0) {
    let totalArmor = 0, maxDmg = 0;
    gear.forEach(i => { totalArmor += (i.headArmor||0)+(i.bodyArmor||0)+(i.legArmor||0)+(i.armArmor||0); maxDmg = Math.max(maxDmg, i.swingDamage||0, i.thrustDamage||0); });
    h += '<div class="clan-detail-section">Equipment</div>';
    h += '<div class="clan-detail-gear">';
    h += '<span class="clan-gear-stat">&#x1F6E1; ' + totalArmor + ' Armor</span>';
    h += '<span class="clan-gear-stat">&#x2694; ' + maxDmg + ' Damage</span>';
    h += '<span class="clan-gear-stat">&#x1F4E6; ' + gear.length + ' Items</span>';
    h += '</div>';
  }

  // Actions
  h += '<div class="clan-detail-actions">';
  h += '<span class="inv-action" onclick="cmdSwitchHero(\'' + esc(heroId) + '\')">&#x1F464; Character Tab</span>';
  h += '<span class="inv-action" onclick="_invHeroId=\'' + esc(heroId) + '\';invSwitchMode(\'equipment\')">&#x2694; Manage Gear</span>';
  h += '<span class="inv-action" onclick="openDetail(\'heroes\',\'' + esc(heroId) + '\')">&#x1F4DC; Full Profile</span>';
  h += '</div>';

  panel.innerHTML = h;
}

// ── Clan — Party Detail ──
function clanShowParty(idx) {
  const data = window._clanData;
  const panel = document.getElementById('clanPartyDetail');
  if (!panel) { console.warn('clanShowParty: no panel'); return; }
  if (!data || !data.parties || !data.parties[idx]) {
    panel.innerHTML = '<div class="inv-empty">No party data available</div>';
    return;
  }
  const p = data.parties[idx];
  const isMain = p.leader === (_cmdData?.hero?.name || '');
  const troopData = null;

  // Highlight selected
  document.querySelectorAll('.clan-split-left .clan-member').forEach((c,i) => {
    c.classList.toggle('clan-member-active', i === idx);
  });

  const pData = _cmdData?.party || {};

  let h = '';

  // Party header
  h += '<div class="clan-detail-header">';
  h += '<div class="clan-member-no-img" style="width:56px;height:56px;font-size:28px">' + (isMain ? '&#x1F451;' : '&#x2694;') + '</div>';
  h += '<div class="clan-detail-info">';
  h += '<h3 class="clan-detail-name">' + esc(p.name) + '</h3>';
  h += '<div class="clan-detail-sub">Led by ' + esc(p.leader) + '</div>';
  h += '</div></div>';

  // Party stats
  h += '<div class="clan-detail-section">Party Overview</div>';
  h += '<div class="clan-finance">';
  h += '<div class="clan-fin-row"><span>&#x2694; Party Size</span><b>' + p.troops + (isMain ? ' / ' + (pData.troopLimit||'?') : '') + '</b></div>';
  if (isMain) {
    h += '<div class="clan-fin-row"><span>&#x1F4B0; Daily Wage</span><b class="clan-fin-neg">-' + (pData.dailyWage||0) + ' &#x25C9;</b></div>';
    h += '<div class="clan-fin-row"><span>&#x263A; Morale</span><b>' + (pData.morale||0) + '</b></div>';
    h += '<div class="clan-fin-row"><span>&#x25B2; Speed</span><b>' + (pData.speed||0) + '</b></div>';
    h += '<div class="clan-fin-row"><span>&#x2637; Food</span><b>' + (pData.food||0) + ' (' + (pData.foodChange >= 0 ? '+' : '') + (pData.foodChange||0) + '/day)</b></div>';
  }
  h += '</div>';

  // Troop composition (for main party)
  if (isMain) {
    h += '<div class="clan-detail-section">Troop Composition</div>';
    if (troopData?.troops) {
      const troops = troopData;
      let inf = 0, rng = 0, cav = 0, mtd = 0;
      troops.troops.filter(t => !t.isHero).forEach(t => {
        if (t.isMounted && t.isRanged) mtd += t.count;
        else if (t.isMounted) cav += t.count;
        else if (t.isRanged) rng += t.count;
        else inf += t.count;
      });
      h += '<div class="clan-detail-gear">';
      h += '<span class="clan-gear-stat">&#x2694; ' + inf + ' Infantry</span>';
      h += '<span class="clan-gear-stat">&#x2738; ' + rng + ' Ranged</span>';
      h += '<span class="clan-gear-stat">&#x265E; ' + cav + ' Cavalry</span>';
      if (mtd > 0) h += '<span class="clan-gear-stat">&#x2658; ' + mtd + ' Horse Archer</span>';
      h += '</div>';
    }

    // Roles
    h += '<div class="clan-detail-section">Party Roles</div>';
    h += '<div class="clan-finance">';
    const roles = [
      {name:'Quartermaster',icon:'&#x1F4E6;',desc:'Manages supplies and inventory'},
      {name:'Scout',icon:'&#x1F441;',desc:'Improves visibility and tracking'},
      {name:'Surgeon',icon:'&#x2695;',desc:'Heals wounded troops faster'},
      {name:'Engineer',icon:'&#x1F528;',desc:'Builds siege equipment and fortifications'}
    ];
    const partyCompanions = (_cmdData?.party?.companions || []);
    for (const role of roles) {
      const assigned = partyCompanions.find(c => c.role === role.name);
      h += '<div class="clan-fin-row">';
      h += '<span>' + role.icon + ' ' + role.name + '</span>';
      if (assigned) {
        h += '<b style="color:#80b060">' + esc(assigned.name) + '</b>';
      } else {
        h += '<b style="color:#5a4a2a">Unassigned</b>';
      }
      h += '</div>';
    }
    h += '</div>';

    // Companions in party
    const heroMembers = (troopData?.troops || []).filter(t => t.isHero && !t.name?.includes(_cmdData?.hero?.name));
    if (heroMembers.length > 0) {
      h += '<div class="clan-detail-section">Companions in Party (' + heroMembers.length + ')</div>';
      for (const hm of heroMembers) {
        h += '<div class="clan-member" onclick="' + (hm.heroId ? 'clanShowMember(\'' + esc(hm.heroId) + '\')' : '') + '" style="padding:6px 0">';
        h += '<div class="clan-member-no-img" style="width:28px;height:28px;font-size:14px">&#x1F464;</div>';
        h += '<span class="clan-member-name">' + esc(hm.name) + '</span>';
        h += '</div>';
      }
    }
  }

  // Actions
  h += '<div class="clan-detail-actions">';
  if (isMain) {
    h += '<span class="inv-action" onclick="document.querySelector(\'[onclick*=party]\')?.click()">&#x2694; Go to Party Tab</span>';
  }
  h += '</div>';

  panel.innerHTML = h;
}

// ── Clan — Select Party (right panel) ──
function clanSelectParty(idx) {
  var d = window._clanData;
  var panel = document.getElementById('clanPartyRight');
  if (!panel || !d || !d.parties || !d.parties[idx]) {
    if (panel) panel.innerHTML = '<div class="inv-empty">No party data</div>';
    return;
  }
  // Highlight row
  document.querySelectorAll('.cp-row').forEach(function(r,i){r.classList.toggle('cp-row-active',i===idx)});

  var p = d.parties[idx];
  var isMe = p.leader === (_cmdData?.hero?.name || '');
  var allComps = (d.members||[]).filter(function(m){return m.isCompanion || m.isPlayer});
  var h = '';

  h += '<h3 class="clan-detail-name">' + esc(p.name) + '</h3>';
  h += '<div class="clan-finance">';
  h += '<div class="clan-fin-row"><span>Party Size</span><b>' + p.troops + (p.limit ? ' / ' + p.limit : '') + '</b></div>';
  if (p.location) h += '<div class="clan-fin-row"><span>Location</span><b>' + esc(p.location) + '</b></div>';
  if (p.morale) h += '<div class="clan-fin-row"><span>Morale</span><b>' + p.morale + '</b></div>';
  if (p.speed) h += '<div class="clan-fin-row"><span>Speed</span><b>' + p.speed + '</b></div>';
  if (p.wounded > 0) h += '<div class="clan-fin-row"><span style="color:#d49a7a">Wounded</span><b style="color:#e07060">' + p.wounded + '</b></div>';
  h += '</div>';

  // Troops
  h += '<div class="clan-detail-section">Troops</div>';
  h += '<div class="clan-detail-gear" style="gap:14px">';
  h += '<span class="clan-gear-stat">&#x2694; <b>' + (p.infantry||0) + '</b> Inf</span>';
  h += '<span class="clan-gear-stat">&#x2738; <b>' + (p.ranged||0) + '</b> Rng</span>';
  h += '<span class="clan-gear-stat">&#x265E; <b>' + (p.cavalry||0) + '</b> Cav</span>';
  if (p.horseArcher > 0) h += '<span class="clan-gear-stat">&#x2658; <b>' + p.horseArcher + '</b> HA</span>';
  h += '</div>';

  // Members
  h += '<div class="clan-detail-section">Members</div>';
  var partyComps = allComps.filter(function(c) { return !c.isPlayer; });
  if (partyComps.length > 0) {
    for (var i = 0; i < partyComps.length; i++) {
      h += '<div class="clan-member" style="padding:4px" onclick="clanShowMember(\'' + esc(partyComps[i].id) + '\')">';
      h += '<div class="clan-member-no-img" style="width:24px;height:24px;font-size:12px">&#x1F464;</div>';
      h += '<span class="clan-member-name">' + esc(partyComps[i].name) + '</span></div>';
    }
  } else {
    h += '<div class="inv-empty" style="padding:6px">No companions</div>';
  }

  // Roles — now available for ALL clan parties (not just main party)
  // When companions leave to lead their own parties, those parties still have
  // role slots that the clan leader can assign from the clan roster.
  h += '<div class="clan-detail-section">Roles' + (isMe ? '' : ' <span style="font-size:9px;color:#7c6840;font-weight:normal;letter-spacing:.5px">— ' + esc(p.leader || 'This party') + '\'s party</span>') + '</div>';
  h += '<div class="clan-finance" id="clanPartyRoles_' + idx + '">';
  var roles = ['Quartermaster','Scout','Surgeon','Engineer'];
  var partyTargetId = esc(p.id || p.leaderId || '');
  for (var ri = 0; ri < roles.length; ri++) {
    var roleName = roles[ri];
    var roleId = 'clanRole_' + idx + '_' + roleName;
    h += '<div class="clan-fin-row"><span>' + roleName + '</span>';
    h += '<select class="inv-sort" id="' + roleId + '" onchange="clanAssignRole(\'' + roleName + '\',this.value,\'' + partyTargetId + '\')" style="min-width:120px">';
    h += '<option value="">— Unassigned —</option>';
    for (var ci = 0; ci < allComps.length; ci++) {
      h += '<option value="' + esc(allComps[ci].id) + '">' + esc(allComps[ci].name) + '</option>';
    }
    h += '</select></div>';
  }
  h += '</div>';

  // Finance
  h += '<div class="clan-detail-section">Finance</div>';
  h += '<div class="clan-finance">';
  if (isMe) h += '<div class="clan-fin-row"><span>Daily Wage</span><b class="clan-fin-neg">' + (_cmdData?.party?.dailyWage||0) + '</b></div>';
  h += '<div class="clan-fin-row"><span>Denars</span><b class="clan-fin-gold">' + (d.gold||0).toLocaleString() + '</b></div>';
  h += '</div>';

  // Disband (not for main party)
  if (!isMe && p.leaderId) {
    h += '<div class="clan-detail-actions"><span class="inv-action inv-action-discard" onclick="clanDisbandParty(\'' + esc(p.leaderId) + '\',\'' + esc(p.name) + '\')">&#x2716; Disband Party</span></div>';
  }

  panel.innerHTML = h;

  // Async: fetch current role assignments for this party and pre-select dropdowns
  var partyLookupId = p.id || p.leaderId || '';
  if (API.getPartyRolesDetail) {
    API.getPartyRolesDetail(partyLookupId).then(function(roleData) {
      if (!roleData || !roleData.roles) return;
      ['Quartermaster','Scout','Surgeon','Engineer'].forEach(function(rn) {
        var sel = document.getElementById('clanRole_' + idx + '_' + rn);
        if (!sel) return;
        var assigned = roleData.roles[rn.toLowerCase()];
        if (assigned && assigned.id) sel.value = assigned.id;
      });
    }).catch(function(){});
  }
}

// ── Clan — Create Party ──
function clanCreateParty() {
  var d = window._clanData;
  var family = (d?.members||[]).filter(function(m){return !m.isCompanion && !m.isPlayer});
  var comps = (d?.members||[]).filter(function(m){return m.isCompanion});
  var eligible = family.concat(comps);
  if (!eligible.length) { showToast('No eligible clan members available', true); return; }

  document.querySelector('.sell-modal-overlay')?.remove();
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:420px">';
  m += '<div class="sell-modal-header">&#x2694; Create New Party</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Choose a clan member to lead the new party:</div>';
  if (family.length) {
    m += '<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:2px;color:#b09848;padding:8px 0 4px;text-transform:uppercase">&#x1F451; Family</div>';
    for (var fi3 = 0; fi3 < family.length; fi3++) {
      m += '<div class="sell-option" onclick="clanDoCreateParty(\'' + esc(family[fi3].id) + '\',\'' + esc(family[fi3].name) + '\');this.closest(\'.sell-modal-overlay\').remove()">';
      m += '<div class="sell-option-icon">&#x1F451;</div>';
      m += '<div class="sell-option-info"><div class="sell-option-title">' + esc(family[fi3].name) + '</div>';
      m += '<div class="sell-option-desc">Family · Age ' + family[fi3].age + '</div></div></div>';
    }
  }
  if (comps.length) {
    m += '<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:2px;color:#80b060;padding:8px 0 4px;text-transform:uppercase">&#x2694; Companions</div>';
    for (var ci3 = 0; ci3 < comps.length; ci3++) {
      m += '<div class="sell-option" onclick="clanDoCreateParty(\'' + esc(comps[ci3].id) + '\',\'' + esc(comps[ci3].name) + '\');this.closest(\'.sell-modal-overlay\').remove()">';
      m += '<div class="sell-option-icon">&#x1F464;</div>';
      m += '<div class="sell-option-info"><div class="sell-option-title">' + esc(comps[ci3].name) + '</div>';
      m += '<div class="sell-option-desc">Companion · Age ' + comps[ci3].age + '</div></div></div>';
    }
  }
  m += '<div class="sell-option sell-option-cancel" onclick="this.closest(\'.sell-modal-overlay\').remove()">';
  m += '<div class="sell-option-icon">&#x2715;</div><div class="sell-option-info"><div class="sell-option-title">Cancel</div></div></div>';
  m += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
}

async function clanDoCreateParty(heroId, heroName) {
  showToast('Creating party for ' + heroName + '...');
  var res = await API.createParty(heroId);
  if (res?.success) {
    showToast('&#x2694; Created party led by ' + res.leader);
    renderCmdClan(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to create party', true);
  }
}

// ── Clan — Disband Party ──
function clanDisbandParty(heroId, partyName) {
  showConfirmModal({
    title: '&#x274C; Disband Party',
    message: 'Disband ' + partyName + '?\n\nTroops will return to your party.',
    confirmText: 'Disband',
    dangerous: true,
    onConfirm: async function() { await _doDisbandParty(heroId); }
  });
}
async function _doDisbandParty(heroId) {
  var res = await API.disbandParty(heroId);
  if (res?.success) {
    showToast('Disbanded ' + res.disbanded);
    renderCmdClan(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to disband', true);
  }
}

// ── Clan — Select Fief ──
async function clanSelectFief(settlementId) {
  var panel = document.getElementById('clanFiefRight');
  if (!panel) return;
  var s = (Store.settlements||[]).find(function(x){return x.id === settlementId});
  if (!s) { panel.innerHTML = '<div class="inv-empty">Settlement not found</div>'; return; }

  // Highlight
  document.querySelectorAll('.cp-row').forEach(function(r){r.classList.remove('cp-row-active')});
  document.querySelectorAll('.cp-row').forEach(function(r){
    if (r.textContent.includes(s.name)) r.classList.add('cp-row-active');
  });

  panel.innerHTML = '<div class="loading-spinner"></div>';

  // Load rich data
  var d = null;
  try { d = await API.getFiefDetail(settlementId); } catch(e) { console.error('[FiefDetail] API error:', e); }
  if (!d || d.error) { console.warn('[FiefDetail] No data or error:', d); d = {}; }
  console.log('[FiefDetail] Loaded:', Object.keys(d).length, 'keys for', settlementId, d);
  var isVillage = s.isVillage || s.type === 'Village';
  var isTown = s.isTown || s.type === 'Town';
  var h = '';

  // Header — settlement portrait + name + meta (matches Kingdom > Fiefs detail)
  var sImg = isVillage ? 'Settlement/Village.png' : (isTown ? 'Settlement/Town.png' : 'Settlement/Castle.png');
  h += '<div class="clan-fief-header">';
  h += '<div class="clan-fief-image-wrap">';
  h += '<img class="clan-fief-image" src="' + sImg + '" alt="" onerror="this.style.display=\'none\'">';
  h += '</div>';
  h += '<div class="clan-fief-header-info">';
  h += '<h3 class="clan-detail-name" style="text-align:left;margin:0 0 4px">' + esc(s.name) + '</h3>';
  h += '<div style="font-size:11px;color:#9a8260;letter-spacing:.5px">' + esc(d.culture||s.culture||'') + ' &middot; ' + esc(d.type||s.type||'Settlement') + '</div>';
  h += '</div>';
  h += '</div>';

  // Warnings
  var warnings = [];
  if (d.isUnderSiege) warnings.push('&#x1F6A8; Under Siege!');
  if (d.isRaided) warnings.push('&#x1F525; Being Raided!');
  if ((d.loyalty||s.loyalty) && (d.loyalty||s.loyalty) < 30) warnings.push('&#x26A0; Low Loyalty');
  if ((d.foodStocks||s.foodStocks) < 0) warnings.push('&#x26A0; Food Shortage');
  if ((d.security||s.security) && (d.security||s.security) < 20) warnings.push('&#x26A0; Low Security');
  if (d.hasTournament) warnings.push('&#x1F3C6; Tournament Active!');
  if (warnings.length) h += '<div class="cmd-qd-warning" style="margin:0 0 10px">' + warnings.join(' &middot; ') + '</div>';

  if (!isVillage) {
    // ROW 1 — Stats + Finance (2 columns)
    h += '<div class="fief-detail-grid">';
    h += '<div class="fief-col">';
    h += '<div class="fief-stat">&#x1F3F0; Walls : <b>' + (d.wallLevel || s.wallLevel || 0) + '</b></div>';
    h += '<div class="fief-stat">&#x2694; Garrison : <b>' + (d.garrison || s.garrison || 0) + '</b></div>';
    h += '<div class="fief-stat">&#x1F6E1; Militia : <b>' + Math.round(d.militia||s.militia||0) + '</b>' + (d.militiaChange ? ' <span style="color:' + (d.militiaChange>0?'#70b060':'#c06040') + ';font-size:10px">(' + (d.militiaChange>0?'+':'') + d.militiaChange + ')</span>' : '') + '</div>';
    var foodVal = Math.round(d.foodStocks||s.foodStocks||0);
    var foodChg = d.foodChange || 0;
    h += '<div class="fief-stat">&#x1F33E; Food : <b style="color:' + (foodVal>0?'#70b060':'#c06040') + '">' + foodVal + '</b>' + (foodChg ? ' <span style="color:' + (foodChg>0?'#70b060':'#c06040') + ';font-size:10px">(' + (foodChg>0?'+':'') + foodChg + ')</span>' : '') + '</div>';
    h += '<div class="fief-stat">&#x25C7; Prosperity : <b>' + (d.prosperity||s.prosperity||0).toLocaleString() + '</b>' + (d.prosperityChange ? ' <span style="color:' + (d.prosperityChange>0?'#70b060':'#c06040') + ';font-size:10px">(' + (d.prosperityChange>0?'+':'') + d.prosperityChange + ')</span>' : '') + '</div>';
    h += '<div class="fief-stat">&#x2764; Loyalty : <b style="color:' + ((d.loyalty||s.loyalty||50)>50?'#70b060':'#c06040') + '">' + (d.loyalty||s.loyalty||0) + '</b>' + (d.loyaltyChange ? ' <span style="color:' + (d.loyaltyChange>0?'#70b060':'#c06040') + ';font-size:10px">(' + (d.loyaltyChange>0?'+':'') + d.loyaltyChange + ')</span>' : '') + '</div>';
    h += '<div class="fief-stat">&#x1F6E1; Security : <b>' + (d.security||s.security||0) + '</b>' + (d.securityChange ? ' <span style="color:' + (d.securityChange>0?'#70b060':'#c06040') + ';font-size:10px">(' + (d.securityChange>0?'+':'') + d.securityChange + ')</span>' : '') + '</div>';
    h += '</div>';
    h += '<div class="fief-col">';
    var taxes = d.tradeTax||s.tradeTax||0;
    var garrWage = d.garrisonWage || (d.garrison ? d.garrison*3 : 0);
    var lv2 = (Store.settlements||[]).filter(function(v){return (v.isVillage||v.type==="Village")&&(v.boundTo===s.name||v.boundTo===s.id)});
    if (taxes > 0) h += '<div class="fief-stat">&#x1F4B0; Trade Tax : <b class="clan-fin-pos">+' + taxes + ' &#x25C9;</b></div>';
    if (garrWage > 0) h += '<div class="fief-stat">&#x2694; Garrison Wage : <b class="clan-fin-neg">-' + garrWage + ' &#x25C9;</b></div>';
    for (var li=0;li<lv2.length;li++) { var lvi=lv2[li]; h += '<div class="fief-stat">&#x1F33E; ' + esc(lvi.name) + ' : <b class="clan-fin-pos">+' + (lvi.dailyIncome||50) + ' &#x25C9;</b></div>'; }
    var totInc = taxes; lv2.forEach(function(v){totInc += v.dailyIncome||50});
    var profit = totInc - garrWage;
    h += '<div class="fief-finance-box" style="margin-top:8px">';
    h += '<div class="fief-finance-title">Finance</div>';
    h += '<div class="fief-fin-row"><span>Income</span><b class="clan-fin-pos">+' + totInc + ' &#x25C9;</b></div>';
    h += '<div class="fief-fin-row"><span>Expenses</span><b class="clan-fin-neg">-' + garrWage + ' &#x25C9;</b></div>';
    h += '<div class="fief-fin-row" style="border-top:1px solid rgba(184,140,50,.15);padding-top:4px"><span>Profit</span><b style="color:' + (profit>0?'#70b060':'#c06040') + '">' + (profit>0?'+':'') + profit + ' &#x25C9;</b></div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    // ROW 2 — Governor + Buildings (2 columns)
    h += '<div class="fief-detail-grid" style="margin-top:10px">';
    h += '<div class="fief-col">';
    h += '<div class="clan-detail-section">Governor</div>';
    var clanMembers2 = (window._clanData?.members || []).filter(function(m) { return !m.isPlayer; });
    h += '<select class="inv-sort" onchange="clanSetGovernor(\'' + esc(s.id) + '\',this.value)" style="min-width:140px;margin:4px 0">';
    h += '<option value="">— None —</option>';
    for (var gi = 0; gi < clanMembers2.length; gi++) {
      var gSel = clanMembers2[gi].id === (d.governorId||s.governorId) ? ' selected' : '';
      var gRole = clanMembers2[gi].isCompanion ? 'Companion' : 'Family';
      h += '<option value="' + esc(clanMembers2[gi].id) + '"' + gSel + '>' + esc(clanMembers2[gi].name) + ' (' + gRole + ')</option>';
    }
    h += '</select>';
    // Send Clan Members — exclude governors and current governor of this fief
    h += '<div class="clan-detail-section" style="margin-top:8px">Send Members</div>';
    var governorIds = {};
    (Store.settlements||[]).forEach(function(st) { if (st.governorId) governorIds[st.governorId] = st.name; });
    var sendMembers = (window._clanData?.members || []).filter(function(m) { return !m.isPlayer && !governorIds[m.id]; });
    h += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px 0">';
    h += '<select class="inv-sort" id="fiefSendMember_' + esc(s.id) + '" style="min-width:120px;flex:1">';
    h += '<option value="">— Select —</option>';
    for (var smi = 0; smi < sendMembers.length; smi++) {
      var sm = sendMembers[smi];
      h += '<option value="' + esc(sm.id) + '">' + esc(sm.name) + '</option>';
    }
    h += '</select>';
    h += '<span class="inv-action" onclick="fiefSendMember(\'' + esc(s.id) + '\',\'' + esc(s.name) + '\')">&#x1F6B6; Send</span>';
    h += '</div>';
    h += '<div style="font-size:9px;color:#6a5a3a">+1 relation/day with notables</div>';
    // Linked Villages
    var linkedVillages = (Store.settlements||[]).filter(function(v) {
      return (v.isVillage || v.type === 'Village') && v.boundTo === s.name;
    });
    if (linkedVillages.length) {
      h += '<div class="clan-detail-section" style="margin-top:8px">Villages</div>';
      h += '<div class="fief-villages">';
      for (var vi2 = 0; vi2 < linkedVillages.length; vi2++) {
        h += '<div class="fief-village" onclick="clanSelectFief(\'' + esc(linkedVillages[vi2].id) + '\')">&#x1F33E; ' + esc(linkedVillages[vi2].name) + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '<div class="fief-col">';
    if (d.buildings && d.buildings.length) {
      h += '<div class="clan-detail-section">Buildings</div>';
      h += '<div style="font-size:10px;color:#7a6a48;margin-bottom:4px">Project: <b style="color:#d4b878">' + esc(d.currentProject || 'None') + '</b></div>';
      h += '<div class="fief-buildings">';
      for (var bi3 = 0; bi3 < d.buildings.length; bi3++) {
        var b3 = d.buildings[bi3];
        h += '<div class="fief-building' + (b3.isCurrentProject ? ' fief-building-active' : '') + '">';
        h += (b3.isCurrentProject ? '&#x1F528; ' : '&#x1F3E0; ') + esc(b3.name) + ' <span style="color:#b0986c">Lv' + b3.level + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';

    // ROW 3 — Workshops + Notables (2 columns)
    h += '<div class="fief-detail-grid" style="margin-top:10px">';
    h += '<div class="fief-col">';
    if (d.workshops && d.workshops.length && isTown) {
      h += '<div class="clan-detail-section">Workshops</div>';
      h += '<div class="fief-buildings">';
      for (var wsi4 = 0; wsi4 < d.workshops.length; wsi4++) {
        var ws4 = d.workshops[wsi4];
        h += '<div class="fief-building' + (ws4.isPlayer ? ' fief-building-active' : '') + '">';
        h += '&#x1F3ED; ' + esc(ws4.name);
        if (ws4.profit !== undefined) h += ' <span style="color:' + (ws4.profit>=0?'#70b060':'#c06040') + '">' + (ws4.profit>=0?'+':'') + ws4.profit + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    if (d.notables && d.notables.length) {
      h += '<div class="clan-detail-section" style="margin-top:8px">Notables</div>';
      for (var ni4 = 0; ni4 < d.notables.length; ni4++) {
        var nt = d.notables[ni4];
        var ntRelColor = nt.relation > 0 ? '#70b060' : nt.relation < 0 ? '#c06040' : '#b0a070';
        h += '<div class="fief-bd-line" onclick="openDetail(\'heroes\',\'' + esc(nt.id) + '\')" style="cursor:pointer">';
        h += '<span>' + (nt.isSupporter ? '&#x2B50; ' : '&#x1F464; ') + esc(nt.name) + '</span>';
        h += '<b style="color:' + ntRelColor + '">' + (nt.relation>0?'+':'') + nt.relation + '</b>';
        h += '</div>';
      }
    }
    h += '</div>';
    h += '<div class="fief-col">';
    // Garrison Troops
    if (d.garrisonTroops && d.garrisonTroops.length) {
      h += '<div class="clan-detail-section">Garrison (' + d.garrisonTroops.length + ')</div>';
      h += '<div class="fief-garrison-troops">';
      for (var gti = 0; gti < d.garrisonTroops.length; gti++) {
        var gt = d.garrisonTroops[gti];
        var gtIcon = gt.isHero ? '&#x1F451;' : gt.isMounted && gt.isRanged ? '&#x1F3F9;' : gt.isMounted ? '&#x265E;' : gt.isRanged ? '&#x2738;' : '&#x2694;';
        h += '<div class="fief-bd-line"><span>' + gtIcon + ' ' + esc(gt.name) + '</span><b>' + gt.count + (gt.wounded > 0 ? ' <span class="wounded">(' + gt.wounded + 'w)</span>' : '') + '</b></div>';
      }
      h += '</div>';
    }
    // Stat Breakdowns
    var breakdowns = [{key:'food',label:'Food',lines:d.foodLines},{key:'prosperity',label:'Prosperity',lines:d.prosperityLines},{key:'loyalty',label:'Loyalty',lines:d.loyaltyLines},{key:'security',label:'Security',lines:d.securityLines}];
    var hasBreakdown = breakdowns.some(function(b){return b.lines && b.lines.length > 0});
    if (hasBreakdown) {
      h += '<div class="clan-detail-section" style="margin-top:8px;cursor:pointer" onclick="this.nextElementSibling.classList.toggle(\'hidden\')">Breakdowns <span class="cmd-qg-arrow">&#x25BC;</span></div>';
      h += '<div class="fief-breakdowns">';
      for (var bdi = 0; bdi < breakdowns.length; bdi++) {
        var bd = breakdowns[bdi];
        if (!bd.lines || !bd.lines.length) continue;
        h += '<div class="fief-bd-group"><b>' + bd.label + '</b>';
        for (var bli = 0; bli < bd.lines.length; bli++) {
          var bl = bd.lines[bli];
          var blColor = bl.value > 0 ? '#70b060' : bl.value < 0 ? '#c06040' : '#b0a070';
          h += '<div class="fief-bd-line"><span>' + esc(bl.name) + '</span><b style="color:' + blColor + '">' + (bl.value>0?'+':'') + bl.value + '</b></div>';
        }
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';

  } else {
    // Village — 2 columns
    h += '<div class="fief-detail-grid">';
    h += '<div class="fief-col">';
    h += '<div class="fief-stat">&#x2764; Hearth : <b>' + (d.hearth||s.prosperity||0) + '</b></div>';
    h += '<div class="fief-stat">&#x1F6E1; Militia : <b>' + Math.round(d.militia||s.militia||0) + '</b></div>';
    if (d.produces||s.villageProduces) h += '<div class="fief-stat">&#x1F4E6; Produces : <b>' + esc(d.produces||s.villageProduces) + '</b></div>';
    if (d.boundTo) h += '<div class="fief-stat">&#x1F3F0; Bound To : <b>' + esc(d.boundTo) + '</b></div>';
    h += '</div>';
    h += '<div class="fief-col">';
    if (d.notables && d.notables.length) {
      h += '<div class="clan-detail-section">Notables</div>';
      for (var ni5 = 0; ni5 < d.notables.length; ni5++) {
        var nt2 = d.notables[ni5];
        var ntRelColor2 = nt2.relation > 0 ? '#70b060' : nt2.relation < 0 ? '#c06040' : '#b0a070';
        h += '<div class="fief-bd-line" onclick="openDetail(\'heroes\',\'' + esc(nt2.id) + '\')" style="cursor:pointer">';
        h += '<span>' + (nt2.isSupporter ? '&#x2B50; ' : '&#x1F464; ') + esc(nt2.name) + '</span>';
        h += '<b style="color:' + ntRelColor2 + '">' + (nt2.relation>0?'+':'') + nt2.relation + '</b>';
        h += '</div>';
      }
    }
    h += '</div>';
    h += '</div>';
  }

  // Actions
  h += '<div class="clan-detail-actions">';
  h += '<span class="inv-action" onclick="openDetail(\'settlements\',\'' + esc(s.id) + '\')">&#x1F4DC; Full Details</span>';
  h += '<span class="inv-action" onclick="invTrackSettlement(\'' + esc(s.id) + '\',\'' + esc(s.name) + '\')">&#x1F4CD; Track on Map</span>';
  if (!isVillage) h += '<span class="inv-action" onclick="fiefCompareModal(\'' + esc(s.id) + '\')">&#x2696; Compare</span>';
  h += '</div>';

  panel.innerHTML = h;
}

// ── Fief — Compare 2 settlements ──
function fiefCompareModal(settlementAId) {
  var data = window._clanData;
  if (!data) return;
  var ownedSettlements = (Store.settlements||[]).filter(function(x){return (x.owner === data.name || x.clan === data.name) && !x.isVillage && x.type !== 'Village'});
  var sA = (Store.settlements||[]).find(function(x){return x.id === settlementAId});
  if (!sA) return;

  document.querySelector('.sell-modal-overlay')?.remove();
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:560px">';
  m += '<div class="sell-modal-header">&#x2696; Compare Settlements</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Comparing <b style="color:#d4b878">' + esc(sA.name) + '</b> with another fief:</div>';
  m += '<select class="inv-sort" id="fiefCompareSelect" style="width:100%;margin:8px 0" onchange="fiefCompareRender(\'' + esc(settlementAId) + '\',this.value)">';
  m += '<option value="">— Select fief —</option>';
  for (var ci3 = 0; ci3 < ownedSettlements.length; ci3++) {
    if (ownedSettlements[ci3].id === settlementAId) continue;
    m += '<option value="' + esc(ownedSettlements[ci3].id) + '">' + esc(ownedSettlements[ci3].name) + '</option>';
  }
  m += '</select>';
  m += '<div id="fiefCompareResult" style="margin-top:10px"></div>';
  m += '<div style="margin-top:14px;text-align:center"><button class="kd-game-btn kd-game-btn-danger" onclick="this.closest(\'.sell-modal-overlay\').remove()">Close</button></div>';
  m += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
}

function fiefCompareRender(idA, idB) {
  var resultEl = document.getElementById('fiefCompareResult');
  if (!resultEl || !idB) { if (resultEl) resultEl.innerHTML = ''; return; }
  var sA = (Store.settlements||[]).find(function(x){return x.id === idA});
  var sB = (Store.settlements||[]).find(function(x){return x.id === idB});
  if (!sA || !sB) return;

  var rows = [
    {label:'Type', a:sA.type, b:sB.type, num:false},
    {label:'Prosperity', a:Math.round(sA.prosperity||0), b:Math.round(sB.prosperity||0), num:true, higherBetter:true},
    {label:'Loyalty', a:Math.round(sA.loyalty||0), b:Math.round(sB.loyalty||0), num:true, higherBetter:true},
    {label:'Security', a:Math.round(sA.security||0), b:Math.round(sB.security||0), num:true, higherBetter:true},
    {label:'Food Stocks', a:Math.round(sA.foodStocks||0), b:Math.round(sB.foodStocks||0), num:true, higherBetter:true},
    {label:'Garrison', a:sA.garrison||0, b:sB.garrison||0, num:true, higherBetter:true},
    {label:'Militia', a:Math.round(sA.militia||0), b:Math.round(sB.militia||0), num:true, higherBetter:true},
    {label:'Wall Level', a:sA.wallLevel||0, b:sB.wallLevel||0, num:true, higherBetter:true},
    {label:'Daily Income', a:sA.dailyIncome||0, b:sB.dailyIncome||0, num:true, higherBetter:true}
  ];

  var h = '<table class="fief-compare-table">';
  h += '<tr><th></th><th>' + esc(sA.name) + '</th><th>' + esc(sB.name) + '</th></tr>';
  for (var ri2 = 0; ri2 < rows.length; ri2++) {
    var r = rows[ri2];
    var aClass = '', bClass = '';
    if (r.num && r.higherBetter) {
      if (r.a > r.b) aClass = 'fc-better';
      else if (r.b > r.a) bClass = 'fc-better';
    }
    h += '<tr><td class="fc-label">' + r.label + '</td>';
    h += '<td class="' + aClass + '">' + (r.num ? r.a.toLocaleString() : esc(String(r.a||'—'))) + '</td>';
    h += '<td class="' + bClass + '">' + (r.num ? r.b.toLocaleString() : esc(String(r.b||'—'))) + '</td></tr>';
  }
  h += '</table>';

  // Verdict
  var aWins = 0, bWins = 0;
  rows.forEach(function(r) { if (r.num && r.higherBetter) { if (r.a > r.b) aWins++; else if (r.b > r.a) bWins++; } });
  h += '<div style="text-align:center;margin-top:10px;font-family:Cinzel,serif;font-size:12px;color:#b09848">';
  if (aWins > bWins) h += '&#x1F3C6; <b style="color:#d4b878">' + esc(sA.name) + '</b> is stronger (' + aWins + ' vs ' + bWins + ')';
  else if (bWins > aWins) h += '&#x1F3C6; <b style="color:#d4b878">' + esc(sB.name) + '</b> is stronger (' + bWins + ' vs ' + aWins + ')';
  else h += '&#x2696; Evenly matched';
  h += '</div>';

  resultEl.innerHTML = h;
}

// ── Kingdom — Show Clan Detail ──
function kdShowClan(index) {
  var panel = document.getElementById('kdClanDetail');
  if (!panel) return;
  var data = window._kingdomData;
  if (!data) return;
  var c = (data.clans||[])[index];
  if (!c) return;

  // Highlight
  document.querySelectorAll('.kd-clan-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var rows = document.querySelectorAll('.kd-clan-row');
  if (rows[index]) rows[index].classList.add('cp-row-active');

  var h = '';

  // Banner + Name + Tier
  h += '<div style="text-align:center;margin-bottom:14px">';
  h += '<div class="kd-clan-banner-big" id="kdClanBannerBig"></div>';
  h += '<h3 class="clan-detail-name">' + esc(c.name) + '</h3>';
  h += '<div style="font-size:11px;color:#7a6a48">Clan Tier: ' + c.tier + '</div>';
  h += '</div>';

  // Stats row
  h += '<div class="fief-detail-grid">';
  h += '<div class="fief-col">';
  h += '<div class="fief-stat">&#x1F451; Leader : <b>' + esc(c.leader || '—') + '</b></div>';
  h += '<div class="fief-stat">&#x2694; Strength : <b>' + (c.strength||0) + '</b></div>';
  h += '<div class="fief-stat">&#x1F4AB; Renown : <b>' + (c.renown||0) + '</b></div>';
  h += '</div>';
  h += '<div class="fief-col">';
  h += '<div class="fief-stat">&#x25C9; Influence : <b>' + (c.influence||0) + '</b></div>';
  h += '<div class="fief-stat">&#x1F465; Members : <b>' + (c.members||0) + '</b></div>';
  h += '<div class="fief-stat">&#x1F3F0; Fiefs : <b>' + (c.fiefs||0) + '</b></div>';
  h += '</div>';
  h += '</div>';

  // Members — show heroes from Store.heroes that belong to this clan
  var clanHeroes = (Store.heroes||[]).filter(function(hero) {
    return hero.clan === c.name || hero.clanId === c.id;
  });
  if (clanHeroes.length) {
    h += '<div class="clan-detail-section">Members</div>';
    h += '<div class="kd-members-grid">';
    for (var mi = 0; mi < clanHeroes.length; mi++) {
      var mh = clanHeroes[mi];
      var portrait = getPortraitSrc(mh, mh);
      var gpM = isGamePortrait(mh);
      h += '<div class="kd-member-card" onclick="openDetail(\'heroes\',\'' + esc(mh.id) + '\')">';
      if (portrait) h += '<img class="kd-member-portrait' + (gpM ? ' game-portrait' : '') + '" src="' + portrait + '" alt="" onerror="this.style.display=\'none\'"' + (gpM ? ' style="' + GP_STYLE + ';width:48px;height:48px;border-radius:4px"' : '') + '>';
      else h += '<div class="kd-member-no-img">&#x1F464;</div>';
      h += '<div class="kd-member-name">' + esc(mh.name) + '</div>';
      h += '</div>';
    }
    h += '</div>';
  }


  // Actions — Support + Expel (always visible, disabled for own clan)
  var disabledAttr = c.isPlayer ? ' disabled title="Cannot act on your own clan"' : '';
  h += '<div class="kd-clan-actions">';
  h += '<div class="kd-action-block">';
  h += '<div class="kd-action-desc">Spend your own influence to increase the influence of the selected clan</div>';
  h += '<button class="kd-game-btn"' + disabledAttr + ' onclick="kdSupportClan(\'' + esc(c.id) + '\')">Support</button>';
  h += '<div class="kd-action-cost">50 &#x25C9;</div>';
  h += '</div>';
  h += '<div class="kd-action-block kd-action-danger">';
  h += '<div class="kd-action-desc">Propose to expel this clan from the kingdom (Support: %)</div>';
  h += '<button class="kd-game-btn kd-game-btn-danger"' + disabledAttr + ' onclick="kdExpelClan(\'' + esc(c.id) + '\',\'' + esc(c.name) + '\')">Propose</button>';
  h += '<div class="kd-action-cost">200 &#x25C9;</div>';
  h += '</div>';
  h += '</div>';

  // Open full profile
  h += '<div class="clan-detail-actions" style="margin-top:10px">';
  h += '<span class="inv-action" onclick="openDetail(\'clans\',\'' + esc(c.id) + '\')">&#x1F4DC; Full Profile</span>';
  h += '</div>';

  panel.innerHTML = h;

  // Render big banner
  if (c.bannerCode) {
    try {
      var bEl = document.getElementById('kdClanBannerBig');
      if (bEl) {
        if (typeof renderBannerInto === 'function') renderBannerInto(bEl, c.bannerCode, 80);
        else if (typeof renderBannerSVG === 'function') bEl.innerHTML = renderBannerSVG(c.bannerCode, 80);
      }
    } catch(e){ console.warn('[KdClanBannerBig] render failed:', e); }
  }
}

// ── Kingdom — Abdicate Leadership ──
function kdAbdicate() {
  showConfirmModal({
    title: '&#x1F451; Abdicate Leadership',
    message: 'Abdicate kingdom leadership?\n\nThe highest-tier clan will become the new ruler.',
    confirmText: 'Abdicate',
    dangerous: true,
    onConfirm: async function() {
      var res = await API.abdicateLeadership();
      if (res?.success) {
        showToast('&#x1F451; Leadership transferred to ' + res.successor);
        renderCmdKingdom(document.getElementById('cmdTabContent'));
      } else {
        showToast(res?.error || 'Failed to abdicate', true);
      }
    }
  });
}

// ── Kingdom — Rename Kingdom ──
function kdRenameKingdom(currentName) {
  document.querySelector('.sell-modal-overlay')?.remove();
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:440px">';
  m += '<div class="sell-modal-header">&#x270E; Rename Kingdom</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Enter the new name for your kingdom:</div>';
  m += '<input type="text" id="kdRenameInput" class="inv-search" value="' + esc(currentName) + '" style="width:100%;font-family:Cinzel,serif;font-size:14px;padding:10px 14px;margin:8px 0" maxlength="32" autofocus>';
  m += '<div style="display:flex;gap:10px;margin-top:12px">';
  m += '<button class="kd-game-btn" style="flex:1" onclick="kdDoRename()">Confirm</button>';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</button>';
  m += '</div>';
  m += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
  setTimeout(function(){
    var inp = document.getElementById('kdRenameInput');
    if (inp) {
      inp.focus();
      inp.select();
      inp.addEventListener('keydown', function(e){
        if (e.key === 'Enter') kdDoRename();
        if (e.key === 'Escape') document.querySelector('.sell-modal-overlay')?.remove();
      });
    }
  }, 50);
}

async function kdDoRename() {
  var inp = document.getElementById('kdRenameInput');
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) { showToast('Name cannot be empty', true); return; }
  document.querySelector('.sell-modal-overlay')?.remove();
  var res = await API.renameKingdom(newName);
  if (res?.success) {
    showToast('&#x270E; Kingdom renamed to ' + res.name);
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to rename kingdom', true);
  }
}

// ── Kingdom — Show Fief Detail ──
async function kdShowFief(index) {
  var panel = document.getElementById('kdFiefDetail');
  if (!panel) return;
  var data = window._kingdomData;
  if (!data) return;
  var f = (data.fiefs||[])[index];
  if (!f) return;

  // Highlight
  document.querySelectorAll('.kd-fief-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var rows = document.querySelectorAll('.kd-fief-row');
  if (rows[index]) rows[index].classList.add('cp-row-active');

  panel.innerHTML = '<div class="loading-spinner"></div>';

  // Load rich detail data
  var d = null;
  try { d = await API.getFiefDetail(f.id); } catch(e){}
  if (!d || d.error) d = {};

  var ownerHero = (Store.heroes||[]).find(function(h){return h.id === f.ownerId});
  var ownerPortrait = ownerHero ? getPortraitSrc(ownerHero, ownerHero) : '';
  var gpO2 = ownerHero && isGamePortrait(ownerHero);
  var fImg = f.type === 'Town' ? 'Settlement/Town.png' : 'Settlement/Castle.png';

  var h = '';

  // Header — settlement name centered
  h += '<h2 class="kd-fief-title">' + esc(f.name) + '</h2>';

  // Composition: image (centered, large) + owner overlay top-left + stats on right
  h += '<div class="kd-fief-composition">';

  // Owner block — top-left overlay
  if (ownerPortrait || f.ownerName) {
    h += '<div class="kd-fief-owner-overlay">';
    if (ownerPortrait) {
      h += '<img class="kd-fief-owner-portrait-big' + (gpO2 ? ' game-portrait' : '') + '" src="' + ownerPortrait + '" alt=""' + (gpO2 ? ' style="' + GP_STYLE + ';width:44px;height:44px;border-radius:4px"' : '') + '>';
    }
    if (f.ownerName) h += '<div class="kd-fief-owner-name">' + esc(f.ownerName) + '</div>';
    h += '</div>';
  }

  // Center — large settlement image
  h += '<div class="kd-fief-image-wrap">';
  h += '<img class="kd-fief-image" src="' + fImg + '" alt="">';
  h += '</div>';

  // Right — stats list
  h += '<div class="kd-fief-stats">';
  var rows2 = [];
  rows2.push({icon:'&#x1F3F0;', label:'Walls', value:(d.wallLevel||f.wallLevel||0)});
  if (d.shipyard) rows2.push({icon:'&#x2693;', label:'Shipyard', value:d.shipyard});
  rows2.push({icon:'&#x2694;', label:'Garrison', value:(d.garrison||f.garrison||0)});
  var militiaChg = d.militiaChange ? ' <span style="color:' + (d.militiaChange>0?'#70b060':'#c06040') + '">(' + (d.militiaChange>0?'+':'') + Math.round(d.militiaChange) + ')</span>' : '';
  rows2.push({icon:'&#x1F6E1;', label:'Militia', value:Math.round(d.militia||0) + militiaChg});
  var foodChg = d.foodChange ? ' <span style="color:' + (d.foodChange>0?'#70b060':'#c06040') + '">(' + (d.foodChange>0?'+':'') + Math.round(d.foodChange) + ')</span>' : '';
  var foodColor = (d.foodStocks||0) > 0 ? '#d4b878' : '#c06040';
  rows2.push({icon:'&#x1F33E;', label:'Food Stocks', value:'<span style="color:' + foodColor + '">' + Math.round(d.foodStocks||0) + '</span>' + foodChg});
  rows2.push({icon:'&#x25C7;', label:'Prosperity', value:(d.prosperity||f.prosperity||0).toLocaleString()});
  var loyChg = d.loyaltyChange ? ' <span style="color:' + (d.loyaltyChange>0?'#70b060':'#c06040') + '">(' + (d.loyaltyChange>0?'+':'') + d.loyaltyChange + ')</span>' : '';
  var loyColor = (d.loyalty||0) > 50 ? '#70b060' : '#c06040';
  rows2.push({icon:'&#x2764;', label:'Loyalty', value:'<span style="color:' + loyColor + '">' + (d.loyalty||0) + '</span>' + loyChg});
  var secChg = d.securityChange ? ' <span style="color:' + (d.securityChange>0?'#70b060':'#c06040') + '">(' + (d.securityChange>0?'+':'') + d.securityChange + ')</span>' : '';
  rows2.push({icon:'&#x1F6E1;', label:'Security', value:(d.security||0) + secChg});

  for (var ri3 = 0; ri3 < rows2.length; ri3++) {
    var r2 = rows2[ri3];
    h += '<div class="kd-fief-stat-row">';
    h += '<span class="kd-fief-stat-icon">' + r2.icon + '</span>';
    h += '<span class="kd-fief-stat-label">' + r2.label + ' :</span>';
    h += '<span class="kd-fief-stat-value">' + r2.value + '</span>';
    h += '</div>';
  }
  h += '</div>';
  h += '</div>'; // end composition

  // Notables — collapsible
  if (d.notables && d.notables.length) {
    h += '<div class="clan-detail-section" style="margin-top:14px;cursor:pointer" onclick="this.nextElementSibling.classList.toggle(\'hidden\')">Notables (' + d.notables.length + ')</div>';
    h += '<div>';
    for (var nti = 0; nti < d.notables.length; nti++) {
      var nt3 = d.notables[nti];
      var nrCol = nt3.relation > 0 ? '#70b060' : nt3.relation < 0 ? '#c06040' : '#b0a070';
      h += '<div class="fief-bd-line" onclick="openDetail(\'heroes\',\'' + esc(nt3.id) + '\')" style="cursor:pointer">';
      h += '<span>' + (nt3.isSupporter ? '&#x2B50; ' : '&#x1F464; ') + esc(nt3.name) + '</span>';
      h += '<b style="color:' + nrCol + '">' + (nt3.relation>0?'+':'') + nt3.relation + '</b>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Villages bound to this fief — AFTER notables
  var boundVillages = (Store.settlements||[]).filter(function(v) {
    if (!(v.isVillage || v.type === 'Village')) return false;
    return v.boundToId === f.id || v.boundTo === f.name;
  });
  if (boundVillages.length) {
    h += '<div class="clan-detail-section" style="margin-top:14px">Villages</div>';
    h += '<div class="kd-village-grid">';
    for (var vbi = 0; vbi < boundVillages.length; vbi++) {
      var bv = boundVillages[vbi];
      // Hash village name for unique color tint
      var hash = 0;
      for (var hi = 0; hi < bv.name.length; hi++) hash = ((hash << 5) - hash + bv.name.charCodeAt(hi)) | 0;
      var hue = Math.abs(hash) % 60 - 30;
      var bright = 0.85 + (Math.abs(hash >> 4) % 30) / 100;
      var sat = 0.9 + (Math.abs(hash >> 8) % 25) / 100;
      var imgFilter = 'hue-rotate(' + hue + 'deg) brightness(' + bright + ') saturate(' + sat + ')';
      h += '<div class="kd-village-card" onclick="openDetail(\'settlements\',\'' + esc(bv.id) + '\')">';
      h += '<div class="kd-village-image-wrap">';
      h += '<img class="kd-village-image" src="Settlement/Village.png" style="filter:' + imgFilter + '" alt="" onerror="this.style.display=\'none\'">';
      h += '</div>';
      h += '<div class="kd-village-name">' + esc(bv.name) + '</div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Action button
  h += '<div class="clan-detail-actions" style="margin-top:14px">';
  h += '<span class="inv-action" onclick="openDetail(\'settlements\',\'' + esc(f.id) + '\')">&#x1F4DC; Full Details</span>';
  h += '<span class="inv-action" onclick="invTrackSettlement(\'' + esc(f.id) + '\',\'' + esc(f.name) + '\')">&#x1F4CD; Track on Map</span>';
  if (f.isPlayer) {
    h += '<span class="inv-action" onclick="fiefGiftPick(\'' + esc(f.id) + '\',\'' + esc(f.name) + '\')">&#x1F381; Gift to Clan</span>';
  }
  h += '</div>';

  panel.innerHTML = h;
}

// ── Kingdom — Show Army Detail ──
function kdShowArmy(index) {
  var panel = document.getElementById('kdArmyDetail');
  if (!panel) return;
  var armies = window._kingdomArmies || [];
  var a = armies[index];
  if (!a) { panel.innerHTML = '<div class="kd-army-empty">No Army Selected</div>'; return; }

  // Highlight
  document.querySelectorAll('.kd-army-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var rows = document.querySelectorAll('.kd-army-row');
  if (rows[index]) rows[index].classList.add('cp-row-active');

  var leaderHero = (Store.heroes||[]).find(function(h){return h.id === a.leaderId});
  var portrait = leaderHero ? getPortraitSrc(leaderHero, leaderHero) : '';
  var gpA = leaderHero && isGamePortrait(leaderHero);

  var h = '';
  h += '<h2 class="kd-army-title">' + esc(a.name || (a.leader + '\'s Army')) + '</h2>';

  // Leader card
  h += '<div class="kd-army-leader">';
  if (portrait) {
    h += '<img class="kd-army-leader-portrait' + (gpA ? ' game-portrait' : '') + '" src="' + portrait + '" alt=""' + (gpA ? ' style="' + GP_STYLE + ';width:64px;height:64px;border-radius:4px"' : '') + '>';
  }
  h += '<div class="kd-army-leader-info">';
  h += '<div class="kd-army-leader-name">' + esc(a.leader || '—') + '</div>';
  h += '<div class="kd-army-leader-loc">' + (a.location ? '&#x1F4CD; ' + esc(a.location) : '&#x1F4CD; Wandering') + '</div>';
  if (a.objective) h += '<div class="kd-army-leader-loc">&#x1F3AF; ' + esc(a.objective) + '</div>';
  h += '</div>';
  h += '</div>';

  // Stats grid
  h += '<div class="kd-army-stats">';
  h += '<div class="kd-army-stat"><span class="kd-army-stat-icon">&#x2694;</span><span class="kd-army-stat-label">Men</span><span class="kd-army-stat-value">' + (a.troops||0) + '</span></div>';
  h += '<div class="kd-army-stat"><span class="kd-army-stat-icon">&#x1F6A9;</span><span class="kd-army-stat-label">Parties</span><span class="kd-army-stat-value">' + (a.parties||0) + '</span></div>';
  h += '<div class="kd-army-stat"><span class="kd-army-stat-icon">&#x2764;</span><span class="kd-army-stat-label">Morale</span><span class="kd-army-stat-value">' + (a.morale||0) + '</span></div>';
  h += '</div>';

  // Cohesion bar
  var cohesion = Math.max(0, Math.min(100, a.cohesion||0));
  var cohColor = cohesion > 60 ? '#70b060' : cohesion > 30 ? '#c0a040' : '#c06040';
  h += '<div class="kd-army-cohesion">';
  h += '<div class="kd-army-cohesion-label">Cohesion</div>';
  h += '<div class="kd-army-cohesion-bar"><div class="kd-army-cohesion-fill" style="width:' + cohesion + '%;background:' + cohColor + '"></div></div>';
  h += '<div class="kd-army-cohesion-pct">' + cohesion + '%</div>';
  h += '</div>';

  // Parties list
  if (a.partyList && a.partyList.length) {
    h += '<div class="clan-detail-section" style="margin-top:14px">Parties (' + a.partyList.length + ')</div>';
    for (var pi = 0; pi < a.partyList.length; pi++) {
      var pp = a.partyList[pi];
      var pHero = (Store.heroes||[]).find(function(h){return h.id === pp.leaderId});
      var pPort = pHero ? getPortraitSrc(pHero, pHero) : '';
      var gpPP = pHero && isGamePortrait(pHero);
      h += '<div class="kd-army-party' + (pi===0 ? ' kd-army-party-leader':'') + '"' + (pp.leaderId ? ' onclick="openDetail(\'heroes\',\'' + esc(pp.leaderId) + '\')" style="cursor:pointer"':'') + '>';
      if (pPort) {
        h += '<img class="kd-army-party-portrait' + (gpPP ? ' game-portrait' : '') + '" src="' + pPort + '" alt=""' + (gpPP ? ' style="' + GP_STYLE + ';width:36px;height:36px;border-radius:3px"' : '') + '>';
      } else {
        h += '<span class="kd-army-party-portrait kd-army-party-portrait-blank"></span>';
      }
      h += '<div class="kd-army-party-info">';
      h += '<div class="kd-army-party-name">' + esc(pp.leader || pp.name) + '</div>';
      h += '<div class="kd-army-party-meta">' + (pp.troops||0) + ' troops &middot; Morale ' + (pp.morale||0) + '</div>';
      h += '</div>';
      h += '</div>';
    }
  }

  panel.innerHTML = h;
}

// ── Kingdom — Create Army (full flow: gathering fief + parties to invite) ──
var _createArmyTarget = null;
var _createArmyParties = [];
var _createArmySelected = {};

async function kdCreateArmy() {
  var data = window._kingdomData;
  if (!data || !data.fiefs || !data.fiefs.length) {
    showToast('No friendly fiefs to gather at', true);
    return;
  }
  // Load available parties up front
  var parties = await API.getAvailableArmyParties();
  if (parties && parties.error) {
    showToast(parties.error, true);
    return;
  }
  _createArmyParties = parties || [];
  _createArmySelected = {};
  _createArmyTarget = null;
  kdCreateArmyShowGatheringStep();
}

function kdCreateArmyShowGatheringStep() {
  document.querySelector('.sell-modal-overlay')?.remove();
  var data = window._kingdomData;
  var rows = '';
  for (var i = 0; i < data.fiefs.length; i++) {
    var f = data.fiefs[i];
    var fImg = f.type === 'Town' ? 'Settlement/Town.png' : 'Settlement/Castle.png';
    rows += '<div class="gift-clan-row" onclick="kdCreateArmyPickGathering(\'' + esc(f.id) + '\',\'' + esc(f.name) + '\')">';
    rows += '<img class="gift-clan-banner" src="' + fImg + '" alt="" style="width:32px;height:38px;object-fit:cover">';
    rows += '<div class="gift-clan-info">';
    rows += '<div class="gift-clan-name">' + esc(f.name) + '</div>';
    rows += '<div class="gift-clan-meta">' + esc(f.type) + ' &middot; ' + esc(f.ownerName || f.clan || '—') + ' &middot; Garrison ' + (f.garrison||0) + '</div>';
    rows += '</div>';
    rows += '</div>';
  }
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:480px">';
  m += '<div class="sell-modal-header">&#x2694; Create Army &mdash; Step 1 of 2</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Select a friendly fief as your gathering point</div>';
  m += '<div class="gift-clan-list">' + rows + '</div>';
  m += '<div style="display:flex;gap:10px;margin-top:14px">';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</button>';
  m += '</div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
}

function kdCreateArmyPickGathering(id, name) {
  _createArmyTarget = {id: id, name: name};
  kdCreateArmyShowPartyStep();
}

function kdCreateArmyShowPartyStep() {
  document.querySelector('.sell-modal-overlay')?.remove();
  var rows = '';
  if (!_createArmyParties.length) {
    rows = '<div class="inv-empty" style="padding:20px;text-align:center">No available parties to invite</div>';
  } else {
    // Sort: own clan first (free), then by ascending influence cost
    _createArmyParties.sort(function(a,b){
      if (a.isOwnClan !== b.isOwnClan) return a.isOwnClan ? -1 : 1;
      return (a.influenceCost||0) - (b.influenceCost||0);
    });
    for (var i = 0; i < _createArmyParties.length; i++) {
      var p = _createArmyParties[i];
      var checked = _createArmySelected[p.id] ? ' checked' : '';
      var costLabel = p.isOwnClan ? '<span style="color:#70b060">FREE</span>' : (p.influenceCost + ' &#x269C;');
      rows += '<label class="gift-clan-row" style="cursor:pointer">';
      rows += '<input type="checkbox" class="ca-party-cb" data-pid="' + esc(p.id) + '" data-cost="' + (p.influenceCost||0) + '"' + checked + ' onchange="kdCreateArmyTotal()" style="width:18px;height:18px;flex-shrink:0;accent-color:#b88c32">';
      rows += '<div class="gift-clan-info">';
      rows += '<div class="gift-clan-name">' + esc(p.leader || p.name) + '</div>';
      rows += '<div class="gift-clan-meta">' + esc(p.clan) + ' &middot; ' + (p.troops||0) + ' troops &middot; ' + costLabel + '</div>';
      rows += '</div>';
      rows += '</label>';
    }
  }
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:520px">';
  m += '<div class="sell-modal-header">&#x2694; Create Army &mdash; Step 2 of 2</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Gathering at <b>' + esc(_createArmyTarget.name) + '</b><br>Select lords to invite (your clan members are free)</div>';
  m += '<div class="gift-clan-list">' + rows + '</div>';
  m += '<div id="caTotalRow" style="text-align:center;margin:14px 0 0;font-family:Cinzel,serif;color:#d4b878">Total influence: <span id="caTotalCost">0</span> &#x269C; &middot; <span id="caTotalTroops">0</span> troops invited</div>';
  m += '<div style="display:flex;gap:10px;margin-top:14px">';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</button>';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="kdCreateArmyShowGatheringStep()">&laquo; Back</button>';
  m += '<button class="kd-game-btn" style="flex:1.4" onclick="kdCreateArmyConfirm()">Form Army</button>';
  m += '</div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
  kdCreateArmyTotal();
}

function kdCreateArmyTotal() {
  var totalCost = 0, totalTroops = 0;
  document.querySelectorAll('.ca-party-cb').forEach(function(cb){
    var pid = cb.getAttribute('data-pid');
    if (cb.checked) {
      _createArmySelected[pid] = true;
      totalCost += parseInt(cb.getAttribute('data-cost')) || 0;
      var p = _createArmyParties.find(function(x){return x.id === pid});
      if (p) totalTroops += (p.troops||0);
    } else {
      delete _createArmySelected[pid];
    }
  });
  var totEl = document.getElementById('caTotalCost');
  var trpEl = document.getElementById('caTotalTroops');
  if (totEl) totEl.textContent = totalCost;
  if (trpEl) trpEl.textContent = totalTroops;
}

async function kdCreateArmyConfirm() {
  document.querySelector('.sell-modal-overlay')?.remove();
  var pids = Object.keys(_createArmySelected);
  showToast('Forming army at ' + _createArmyTarget.name + '...');
  var res = await API.createArmy(_createArmyTarget.id, pids);
  if (res?.success) {
    showToast('&#x2694; Army formed, ' + (res.invited||0) + ' parties invited to ' + (res.target || _createArmyTarget.name));
    _createArmyTarget = null; _createArmyParties = []; _createArmySelected = {};
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to create army', true);
  }
}

// ── Kingdom — Show Policy Detail ──
function kdShowPolicy(index) {
  var panel = document.getElementById('kdPolicyDetail');
  if (!panel) return;
  var policies = window._kingdomPolicies || [];
  var p = policies[index];
  if (!p) return;

  // Highlight selected row
  document.querySelectorAll('.kd-policy-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var rows = document.querySelectorAll('.kd-policy-row');
  if (rows[index]) rows[index].classList.add('cp-row-active');

  var prose = (p.description || '').replace(/\r/g,'').trim();
  var bullets = [];
  // Effects come from a separate property on PolicyObject (varies by game version)
  if (p.effects) {
    var rawE = p.effects.replace(/\r/g,'').trim();
    var lines = rawE.split(/\n+/).map(function(s){return s.trim()}).filter(function(s){return s.length > 3});
    bullets = lines;
  }
  // Fallback: if effects field is empty but description has multi-line content,
  // first line is prose and any remaining lines are bullets
  if (!bullets.length && prose.indexOf('\n') !== -1) {
    var dLines = prose.split(/\n+/).map(function(s){return s.trim()}).filter(function(s){return s.length > 3});
    if (dLines.length > 1) {
      prose = dLines[0];
      bullets = dLines.slice(1);
    }
  }

  var h = '';
  h += '<h2 class="kd-policy-title">' + esc(p.name) + '</h2>';
  h += '<div class="kd-policy-status' + (p.isActive ? ' kd-policy-status-active' : '') + '">';
  h += p.isActive ? '&#x2713; Active' : '&#x25CB; Inactive';
  h += '</div>';
  if (prose) {
    h += '<p class="kd-policy-prose">' + esc(prose) + '</p>';
  }
  if (bullets.length) {
    h += '<ul class="kd-policy-bullets">';
    for (var bj = 0; bj < bullets.length; bj++) {
      h += '<li>' + esc(bullets[bj]) + '</li>';
    }
    h += '</ul>';
  }

  // Support bar + Enact/Abolish button
  var actionLabel = p.isActive ? 'abolishing' : 'enacting';
  var btnLabel = p.isActive ? 'Abolish' : 'Enact';
  // currentSupport is -100..100 from CalculateKingdomSupport. Map to 0..100% bar fill.
  // If there's no pending decision, show 0% (not 50%).
  var pct = 0;
  if (p.hasPendingDecision) {
    var support = p.currentSupport || 0;
    pct = Math.max(0, Math.min(100, Math.round((support + 100) / 2)));
  }
  h += '<div class="kd-policy-vote">';
  h += '<div class="kd-policy-vote-title">Support for ' + actionLabel + '</div>';
  h += '<div class="kd-policy-bar"><div class="kd-policy-bar-fill" style="width:' + pct + '%"></div></div>';
  h += '<div class="kd-policy-bar-pct">' + pct + '%</div>';
  h += '<div class="kd-policy-vote-desc">Consider ' + actionLabel + ' this policy<br><span style="color:#7a6a48">(Support: ' + pct + '%)</span></div>';
  h += '<button class="kd-game-btn kd-policy-enact-btn" onclick="kdEnactPolicy(\'' + esc(p.id) + '\')">' + btnLabel + '</button>';
  h += '<div class="kd-policy-cost">100 <span style="color:#b88c32">&#x269C;</span></div>';
  h += '</div>';

  panel.innerHTML = h;
}

// ── Kingdom — Enact/Abolish Policy ──
async function kdEnactPolicy(policyId) {
  var res = await API.changePolicy(policyId);
  if (res?.success) {
    var verb = res.action === 'enact' ? 'Proposed enacting' : 'Proposed abolishing';
    showToast('&#x1F4DC; ' + verb + ' ' + res.policy + ' (-' + res.cost + ' influence)');
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to change policy', true);
  }
}

// ── Kingdom — Support Clan ──
async function kdSupportClan(clanId) {
  var res = await API.supportClan(clanId);
  if (res?.success) {
    showToast('&#x1F91D; Supported ' + res.clan + ' (-' + res.cost + ' influence)');
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to support clan', true);
  }
}

// ── Kingdom — Expel Clan ──
function kdExpelClan(clanId, clanName) {
  showConfirmModal({
    title: '&#x26A0; Expel Clan',
    message: 'Propose to expel ' + clanName + ' from the kingdom?\n\nThis will cost 200 influence.',
    confirmText: 'Propose Expulsion',
    dangerous: true,
    onConfirm: async function() {
      await _doExpelClan(clanId);
    }
  });
}
async function _doExpelClan(clanId) {
  var res = await API.expelClan(clanId);
  if (res?.success) {
    showToast('&#x26A0; Proposed expulsion of ' + res.clan + ' (-' + res.cost + ' influence)');
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to expel clan', true);
  }
}

// ── Fief — Send Member to Settlement ──
async function fiefSendMember(settlementId, settlementName) {
  var sel = document.getElementById('fiefSendMember_' + settlementId);
  if (!sel || !sel.value) { showToast('Select a clan member first', true); return; }
  var heroId = sel.value;
  var heroName = sel.options[sel.selectedIndex].text;
  showToast('Sending ' + heroName + ' to ' + settlementName + '...');
  var res = await API.sendMemberToSettlement(settlementId, heroId);
  if (res?.success) {
    showToast('&#x1F6B6; ' + res.hero + ' sent to ' + res.settlement + (res.travelHours ? ' (travel: ~' + res.travelHours + 'h)' : ''));
  } else {
    showToast(res?.error || 'Failed to send member', true);
  }
}

// ── Fief — Gift Settlement to Another Clan ──
function fiefGiftPick(settlementId, settlementName) {
  var data = window._kingdomData;
  if (!data || !data.clans || !data.clans.length) {
    showToast('No kingdom clans available', true);
    return;
  }
  var candidates = data.clans.filter(function(c){ return !c.isPlayer && !c.isEliminated; });
  if (!candidates.length) {
    showToast('No other clans in kingdom to gift to', true);
    return;
  }

  document.querySelector('.sell-modal-overlay')?.remove();
  var rows = '';
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var bn = c.id && Store._bannerImages?.[c.id]
      ? '<img class="gift-clan-banner" src="Banners/' + encodeURIComponent(c.id) + '.png" alt="">'
      : '<span class="gift-clan-banner gift-clan-banner-blank"></span>';
    rows += '<div class="gift-clan-row" onclick="fiefGiftConfirm(\'' + esc(settlementId) + '\',\'' + esc(settlementName) + '\',\'' + esc(c.id) + '\',\'' + esc(c.name) + '\')">';
    rows += bn;
    rows += '<div class="gift-clan-info">';
    rows += '<div class="gift-clan-name">' + esc(c.name) + '</div>';
    rows += '<div class="gift-clan-meta">' + esc(c.leader || '') + ' &middot; Renown ' + (c.renown || 0) + ' &middot; Fiefs ' + (c.fiefs || 0) + '</div>';
    rows += '</div>';
    rows += '</div>';
  }
  var m = '<div class="sell-modal-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="sell-modal" style="max-width:480px">';
  m += '<div class="sell-modal-header">&#x1F381; Gift ' + esc(settlementName) + '</div>';
  m += '<div class="sell-modal-body">';
  m += '<div class="sell-modal-desc">Select a clan to receive this settlement</div>';
  m += '<div class="gift-clan-list">' + rows + '</div>';
  m += '<div style="display:flex;gap:10px;margin-top:14px">';
  m += '<button class="kd-game-btn kd-game-btn-danger" style="flex:1" onclick="this.closest(\'.sell-modal-overlay\').remove()">Cancel</button>';
  m += '</div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);
}

function fiefGiftConfirm(settlementId, settlementName, clanId, clanName) {
  document.querySelector('.sell-modal-overlay')?.remove();
  showConfirmModal({
    title: '&#x1F381; Gift Settlement',
    message: 'Gift ' + settlementName + ' to ' + clanName + '?\n\nThis cannot be undone.',
    confirmText: 'Gift',
    dangerous: true,
    onConfirm: async function() { await _doGiftSettlement(settlementId, settlementName, clanId, clanName); }
  });
}
async function _doGiftSettlement(settlementId, settlementName, clanId, clanName) {
  showToast('Gifting ' + settlementName + ' to ' + clanName + '...');
  var res = await API.giftSettlement(settlementId, clanId);
  if (res?.success) {
    showToast('&#x1F381; ' + (res.settlement || settlementName) + ' gifted to ' + (res.clan || clanName));
    renderCmdKingdom(document.getElementById('cmdTabContent'));
  } else {
    showToast(res?.error || 'Failed to gift settlement', true);
  }
}

// ── Fief — Set Building Project ──
async function fiefSetProject(settlementId, buildingIndex) {
  var res = await API.setProject(settlementId, buildingIndex);
  if (res?.success) {
    showToast('Project set to ' + res.project);
    clanSelectFief(settlementId);
  } else {
    showToast(res?.error || 'Failed to set project', true);
  }
}

// ── Clan — Show Garrison Detail ──
function clanShowGarrison(settlementId) {
  var panel = document.getElementById('clanPartyRight');
  if (!panel) return;
  var s = (Store.settlements||[]).find(function(x){return x.id === settlementId});
  if (!s) { panel.innerHTML = '<div class="inv-empty">Settlement not found</div>'; return; }

  // Highlight
  document.querySelectorAll('.cp-row').forEach(function(r){r.classList.remove('cp-row-active')});
  document.querySelectorAll('.cp-row').forEach(function(r){
    if (r.textContent.includes(s.name)) r.classList.add('cp-row-active');
  });

  var garr = s.garrison || 0;
  var militia = s.militia || 0;
  var totalForce = garr + Math.round(militia);
  var wage = garr * 3; // estimate

  var h = '';
  h += '<h3 class="clan-detail-name" style="text-align:center">Garrison of ' + esc(s.name) + '</h3>';

  // Party size
  h += '<div style="text-align:center;font-family:Cinzel,serif;font-size:13px;color:#b0a070;margin:8px 0">Party Size : <b style="color:#e0d0b0">' + garr + '</b></div>';

  // Troop composition icons
  h += '<div class="clan-detail-gear" style="justify-content:center;gap:20px;margin:10px 0">';
  h += '<span class="clan-gear-stat" style="font-size:14px">&#x2694; <b>' + Math.round(garr * 0.4) + '</b></span>';
  h += '<span class="clan-gear-stat" style="font-size:14px">&#x2738; <b>' + Math.round(garr * 0.3) + '</b></span>';
  h += '<span class="clan-gear-stat" style="font-size:14px">&#x265E; <b>' + Math.round(garr * 0.2) + '</b></span>';
  h += '<span class="clan-gear-stat" style="font-size:14px">&#x1F6E1; <b>' + Math.round(militia) + '</b></span>';
  h += '</div>';

  // Stats
  h += '<div class="clan-finance" style="margin-top:12px">';
  h += '<div class="clan-fin-row"><span>Garrison Troops</span><b>' + garr + '</b></div>';
  h += '<div class="clan-fin-row"><span>Militia</span><b>' + Math.round(militia) + '</b></div>';
  h += '<div class="clan-fin-row"><span>Total Force</span><b style="font-size:14px">' + totalForce + '</b></div>';
  h += '</div>';

  // Party Wage section
  var wageLimit = s.garrisonWageLimit || 0;
  var wageLimitDisplay = wageLimit > 0 ? wageLimit.toLocaleString() + ' &#x25C9;' : 'Unlimited';
  h += '<div class="clan-detail-section" style="margin-top:12px">Party Wage</div>';
  h += '<div class="fief-finance-box">';
  h += '<div class="fief-fin-row"><span>Current Wage</span><b class="clan-fin-neg">' + wage + ' &#x25C9;</b></div>';
  h += '<div class="fief-fin-row"><span>Wage Limit</span><b>' + wageLimitDisplay + '</b></div>';
  h += '<div class="fief-fin-row" style="padding-top:6px">';
  h += '<span>Set Wage Limit</span>';
  h += '<select class="inv-sort" onchange="garrisonSetWageLimit(\'' + esc(s.id) + '\',this.value)" style="min-width:120px">';
  var wageLimitOptions = [0, 500, 1000, 1500, 2000, 3000, 5000, 10000];
  for (var wli = 0; wli < wageLimitOptions.length; wli++) {
    var wv = wageLimitOptions[wli];
    var wlLabel = wv === 0 ? 'Unlimited' : wv.toLocaleString() + ' &#x25C9;';
    var wlSel = wv === wageLimit ? ' selected' : '';
    h += '<option value="' + wv + '"' + wlSel + '>' + wlLabel + '</option>';
  }
  h += '</select></div>';
  h += '</div>';

  // Actions
  h += '<div class="clan-detail-actions" style="margin-top:12px">';
  h += '<span class="inv-action" onclick="openDetail(\'settlements\',\'' + esc(s.id) + '\')">&#x1F4DC; Settlement Details</span>';
  h += '<span class="inv-action" onclick="invTrackSettlement(\'' + esc(s.id) + '\',\'' + esc(s.name) + '\')">&#x1F4CD; Track on Map</span>';
  h += '</div>';

  panel.innerHTML = h;
}

// ── Garrison — Set Wage Limit ──
async function garrisonSetWageLimit(settlementId, limit) {
  var res = await API.setGarrisonWageLimit(settlementId, parseInt(limit) || 0);
  if (res?.success) {
    showToast('Garrison wage limit set to ' + (res.wageLimit > 0 ? res.wageLimit.toLocaleString() + ' denars' : 'Unlimited'));
    // Update local settlement data
    var s2 = (Store.settlements||[]).find(function(x){return x.id === settlementId});
    if (s2) s2.garrisonWageLimit = res.wageLimit;
  } else {
    showToast(res?.error || 'Failed to set wage limit', true);
  }
}

// ── Garrison — Set Auto Recruitment ──
async function garrisonSetAutoRecruit(settlementId, enabled) {
  var res = await API.setAutoRecruitment(settlementId, enabled);
  if (res?.success) {
    showToast(res.autoRecruitment ? 'Auto recruitment enabled' : 'Auto recruitment disabled');
    var s2 = (Store.settlements||[]).find(function(x){return x.id === settlementId});
    if (s2) s2.autoRecruitment = res.autoRecruitment;
    // Re-render garrison detail to update the status text
    clanShowGarrison(settlementId);
  } else {
    showToast(res?.error || 'Failed to toggle recruitment', true);
  }
}

// ── Clan Other — Detail for Workshops/Alleys/Supporters ──
function clanOtherShowDetail(type, index) {
  var panel = document.getElementById('clanOtherDetail');
  if (!panel) return;
  var d = window._clanData;
  if (!d) return;

  // Highlight
  document.querySelectorAll('.cp-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var rows = document.querySelectorAll('.clan-split-left .cp-row');
  // Calculate which row
  var wsLen = (d.workshops||[]).length;
  var alLen = (d.alleys||[]).length;
  var rowIdx = type === 'workshop' ? index : type === 'alley' ? wsLen + index : wsLen + alLen + index;
  if (rows[rowIdx]) rows[rowIdx].classList.add('cp-row-active');

  var h = '';

  if (type === 'workshop') {
    var ws = (d.workshops||[])[index];
    if (!ws) return;
    h += '<h3 class="clan-detail-name" style="text-align:center">&#x1F3ED; ' + esc(ws.type || ws.name || 'Workshop') + '</h3>';
    h += '<div style="text-align:center;font-size:10px;color:#7a6a48;margin-bottom:14px">Workshop in ' + esc(ws.town) + '</div>';
    h += '<div class="clan-finance">';
    h += '<div class="clan-fin-row"><span>Type</span><b>' + esc(ws.type || 'Unknown') + '</b></div>';
    h += '<div class="clan-fin-row"><span>Location</span><b>' + esc(ws.town) + '</b></div>';
    h += '<div class="clan-fin-row"><span>Daily Profit</span><b style="color:' + (ws.income >= 0 ? '#70b060' : '#c06040') + '">' + (ws.income >= 0 ? '+' : '') + (ws.income||0) + ' &#x25C9;</b></div>';
    h += '</div>';
    h += '<div style="margin-top:14px;padding:12px;background:rgba(184,140,50,.04);border:1px solid rgba(184,140,50,.1);border-radius:6px;font-size:11px;color:#8a7a5a;line-height:1.6">';
    h += 'Workshops convert raw materials from the local market into finished goods. Match the workshop type to resources produced by nearby villages for maximum profit.';
    h += '<div style="margin-top:8px;color:#c06040;font-size:10px">&#x26A0; If your kingdom goes to war with the town\'s faction, this workshop will be seized.</div>';
    h += '</div>';
  }

  else if (type === 'alley') {
    var al = (d.alleys||[])[index];
    if (!al) return;
    h += '<h3 class="clan-detail-name" style="text-align:center">&#x1F5E1; ' + esc(al.name || 'Alley') + '</h3>';
    h += '<div style="text-align:center;font-size:10px;color:#7a6a48;margin-bottom:14px">Criminal Enterprise in ' + esc(al.town) + '</div>';
    h += '<div class="clan-finance">';
    h += '<div class="clan-fin-row"><span>Location</span><b>' + esc(al.town) + '</b></div>';
    h += '<div class="clan-fin-row"><span>Daily Income</span><b class="clan-fin-pos">+' + (al.income||0) + ' &#x25C9;</b></div>';
    h += '</div>';
    h += '<div style="margin-top:14px;padding:12px;background:rgba(140,80,60,.04);border:1px solid rgba(140,80,60,.12);border-radius:6px;font-size:11px;color:#8a7a5a;line-height:1.6">';
    h += 'Alleys give you control over the town\'s criminal underworld. They provide daily income and allow recruiting bandit-type troops. Requires a companion with 30+ Roguery to hold.';
    h += '<div style="margin-top:8px;color:#d09050;font-size:10px">&#x26A0; Increases Criminal Rating and lowers town security. Rival gangs may try to retake it.</div>';
    h += '</div>';
  }

  else if (type === 'supporter') {
    var su = (d.supporters||[])[index];
    if (!su) return;
    h += '<h3 class="clan-detail-name" style="text-align:center">&#x1F464; ' + esc(su.name) + '</h3>';
    h += '<div style="text-align:center;font-size:10px;color:#7a6a48;margin-bottom:14px">' + esc(su.occupation||'Notable') + ' in ' + esc(su.settlement) + '</div>';
    h += '<div class="clan-finance">';
    h += '<div class="clan-fin-row"><span>Relation</span><b style="color:#80b060">+' + (su.relation||0) + '</b></div>';
    h += '<div class="clan-fin-row"><span>Settlement</span><b>' + esc(su.settlement) + '</b></div>';
    h += '<div class="clan-fin-row"><span>Occupation</span><b>' + esc(su.occupation || 'Notable') + '</b></div>';
    h += '<div class="clan-fin-row"><span>Power</span><b>' + (su.power||0) + '</b></div>';
    h += '</div>';
    h += '<div style="margin-top:14px;padding:12px;background:rgba(100,160,80,.04);border:1px solid rgba(100,160,80,.12);border-radius:6px;font-size:11px;color:#8a7a5a;line-height:1.6">';
    h += 'Supporters provide daily Influence and give access to higher-tier troops for recruitment. A notable becomes a supporter at 25+ relation. Each notable can only support one clan.';
    h += '</div>';
    h += '<div class="clan-detail-actions" style="margin-top:12px">';
    h += '<span class="inv-action" onclick="openDetail(\'heroes\',\'' + esc(su.id) + '\')">&#x1F4DC; Full Profile</span>';
    h += '</div>';
  }

  panel.innerHTML = h;
}

// ── Clan — Set Governor ──
async function clanSetGovernor(settlementId, heroId) {
  var res = await API.setGovernor(settlementId, heroId);
  if (res?.success) {
    showToast('Governor of ' + res.settlement + ' set to ' + res.governor);
  } else {
    showToast(res?.error || 'Failed to set governor', true);
  }
}

// ── Diplomacy — Show Kingdom Detail ──
function diploShowKingdom(kingdomId) {
  var panel = document.getElementById('diploDetail');
  if (!panel) return;
  var diploKs = window._diploKingdoms || [];
  var k = diploKs.find(function(x){return x.id === kingdomId});
  if (!k) { panel.innerHTML = '<div class="kd-army-empty">Kingdom not found</div>'; return; }
  var us = window._diploPlayerKingdom || {};

  // Highlight selected row
  document.querySelectorAll('.kd-diplo-row').forEach(function(r){r.classList.remove('cp-row-active')});
  var row = document.querySelector('.kd-diplo-row[onclick*="' + kingdomId + '"]');
  if (row) row.classList.add('cp-row-active');

  var atWar = k.relation === 'war';
  var midIcon = atWar ? '&#x2694;' : '&#x1F54A;';
  var midClass = atWar ? 'kd-diplo-vs-war' : 'kd-diplo-vs-peace';

  // Player + their leader portraits
  var ourLeader = (Store.heroes||[]).find(function(h){return h.id === us.rulerId});
  var ourPortrait = ourLeader ? getPortraitSrc(ourLeader, ourLeader) : '';
  var gpOu = ourLeader && isGamePortrait(ourLeader);
  var theirLeader = (Store.heroes||[]).find(function(h){return h.id === k.rulerId});
  var theirPortrait = theirLeader ? getPortraitSrc(theirLeader, theirLeader) : '';
  var gpTh = theirLeader && isGamePortrait(theirLeader);

  var h = '';

  // Helper: render the "currently at war with" column (crossed swords + small banners)
  function warsColumn(kObj, idPrefix) {
    if (!kObj || !kObj.currentWars || !kObj.currentWars.length) return '';
    var s = '<div class="kd-diplo-vs-wars">';
    s += '<div class="kd-diplo-vs-wars-icon">&#x2694;</div>';
    s += '<div class="kd-diplo-vs-wars-list">';
    for (var ci = 0; ci < kObj.currentWars.length; ci++) {
      var cw = kObj.currentWars[ci];
      s += '<span class="kd-diplo-vs-wars-banner" id="' + idPrefix + esc(cw.id) + '" title="' + esc(cw.name) + '"></span>';
    }
    s += '</div></div>';
    return s;
  }

  // ─── Versus header ───
  h += '<div class="kd-diplo-vs">';
  // OUR side
  h += '<div class="kd-diplo-vs-side kd-diplo-vs-ours">';
  h += '<div class="kd-diplo-vs-portrait-stack">';
  if (ourPortrait) h += '<img class="kd-diplo-vs-portrait' + (gpOu ? ' game-portrait' : '') + '" src="' + ourPortrait + '" alt=""' + (gpOu ? ' style="' + GP_STYLE + ';width:64px;height:64px;border-radius:4px"' : '') + '>';
  h += warsColumn(us, 'diploOurWar_');
  h += '</div>';
  h += '<div class="kd-diplo-vs-info">';
  h += '<div class="kd-diplo-vs-banner" id="diploVsBannerOurs"></div>';
  h += '<div class="kd-diplo-vs-name">' + esc(us.name || 'You') + '</div>';
  h += '</div>';
  h += '</div>';
  // Middle icon
  h += '<div class="kd-diplo-vs-mid ' + midClass + '">';
  h += '<div class="kd-diplo-vs-line"></div>';
  h += '<div class="kd-diplo-vs-icon">' + midIcon + '</div>';
  h += '<div class="kd-diplo-vs-line"></div>';
  h += '</div>';
  // THEIR side
  h += '<div class="kd-diplo-vs-side kd-diplo-vs-theirs">';
  h += '<div class="kd-diplo-vs-info">';
  h += '<div class="kd-diplo-vs-name">' + esc(k.name) + '</div>';
  h += '<div class="kd-diplo-vs-banner" id="diploVsBannerTheirs"></div>';
  // Member clan banners row
  if (k.memberClans && k.memberClans.length) {
    h += '<div class="kd-diplo-vs-clans">';
    for (var mci = 0; mci < k.memberClans.length; mci++) {
      var mc = k.memberClans[mci];
      h += '<span class="kd-diplo-vs-clan" id="diploVsClan_' + esc(mc.id) + '" title="' + esc(mc.name) + '"></span>';
    }
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="kd-diplo-vs-portrait-stack">';
  if (theirPortrait) h += '<img class="kd-diplo-vs-portrait' + (gpTh ? ' game-portrait' : '') + '" src="' + theirPortrait + '" alt=""' + (gpTh ? ' style="' + GP_STYLE + ';width:64px;height:64px;border-radius:4px"' : '') + '>';
  h += warsColumn(k, 'diploTheirWar_');
  h += '</div>';
  h += '</div>';
  h += '</div>';

  // ─── Comparison stat bars ───
  function statBar(label, ours, theirs) {
    var max = Math.max(ours, theirs, 1);
    var ourW = Math.round(ours / max * 100);
    var theirW = Math.round(theirs / max * 100);
    var s = '';
    s += '<div class="kd-diplo-stat">';
    s += '<div class="kd-diplo-stat-label">' + label + '</div>';
    s += '<div class="kd-diplo-stat-row">';
    s += '<span class="kd-diplo-stat-num kd-diplo-stat-ours">' + ours.toLocaleString() + '</span>';
    s += '<div class="kd-diplo-stat-bar"><div class="kd-diplo-stat-fill kd-diplo-stat-fill-ours" style="width:' + (ourW/2) + '%"></div><div class="kd-diplo-stat-fill kd-diplo-stat-fill-theirs" style="width:' + (theirW/2) + '%"></div></div>';
    s += '<span class="kd-diplo-stat-num kd-diplo-stat-theirs">' + theirs.toLocaleString() + '</span>';
    s += '</div>';
    s += '</div>';
    return s;
  }
  h += '<div class="kd-diplo-stats">';
  h += statBar('Total Strength', us.strength || 0, k.strength || 0);
  h += statBar('Towns', us.towns || 0, k.towns || 0);
  h += statBar('Castles', us.castles || 0, k.castles || 0);
  h += '</div>';

  // ─── Action cards (Consider X / Enact / 200 influence) ───
  // Mirror in-game: at war → "Make Peace"; at peace → "Make Alliance" + "Declare War" + "Trade Agreement"
  var pending = k.pendingDecisions || {};
  function actionCard(actionKey, label) {
    var sup = pending[actionKey] || 0;
    var pct = Math.max(0, Math.min(100, Math.round((sup + 100) / 2)));
    var hasDec = (actionKey in pending);
    var displayPct = hasDec ? pct : 0;
    var s = '';
    s += '<div class="kd-diplo-action-card">';
    s += '<div class="kd-diplo-action-label">Consider ' + label + ' (Support: ' + displayPct + '%)</div>';
    s += '<button class="kd-game-btn kd-diplo-action-btn" onclick="diploAction(\'' + actionKey + '\',\'' + esc(k.id) + '\',\'' + esc(k.name) + '\',\'' + esc(label) + '\')">Enact</button>';
    s += '<div class="kd-diplo-action-cost">200 <span style="color:#b88c32">&#x269C;</span></div>';
    s += '</div>';
    return s;
  }
  h += '<div class="kd-diplo-actions">';
  if (atWar) {
    h += actionCard('makepeace', 'making peace');
  } else {
    h += actionCard('formalliance', 'making an alliance');
    h += actionCard('declarewar', 'declaring war');
    h += actionCard('tradeagreement', 'signing a trade agreement');
  }
  h += '</div>';

  panel.innerHTML = h;

  // Render banners
  try {
    if (us.bannerCode) {
      var ob = document.getElementById('diploVsBannerOurs');
      if (ob && typeof renderBannerInto === 'function') renderBannerInto(ob, us.bannerCode, 32);
    }
    if (k.bannerCode) {
      var tb = document.getElementById('diploVsBannerTheirs');
      if (tb && typeof renderBannerInto === 'function') renderBannerInto(tb, k.bannerCode, 32);
    }
    if (k.memberClans) {
      for (var mci2 = 0; mci2 < k.memberClans.length; mci2++) {
        var mc2 = k.memberClans[mci2];
        if (!mc2.bannerCode) continue;
        var mcEl = document.getElementById('diploVsClan_' + mc2.id);
        if (mcEl && typeof renderBannerInto === 'function') renderBannerInto(mcEl, mc2.bannerCode, 18);
      }
    }
    // Render the small war-list banners
    function renderWarsList(kObj, idPrefix) {
      if (!kObj || !kObj.currentWars) return;
      for (var ci = 0; ci < kObj.currentWars.length; ci++) {
        var cw = kObj.currentWars[ci];
        if (!cw.bannerCode) continue;
        var wel = document.getElementById(idPrefix + cw.id);
        if (wel && typeof renderBannerInto === 'function') renderBannerInto(wel, cw.bannerCode, 22);
      }
    }
    renderWarsList(us, 'diploOurWar_');
    renderWarsList(k, 'diploTheirWar_');
  } catch(e){}
}

function diploAction(action, kid, kname, label) {
  var dangerous = action === 'declarewar';
  showConfirmModal({
    title: '&#x1F54A; ' + (label.charAt(0).toUpperCase() + label.slice(1)),
    message: 'Propose ' + label + ' with ' + esc(kname) + '?\n\nThis costs 200 influence.',
    confirmText: 'Enact',
    dangerous: dangerous,
    onConfirm: async function() {
      var res = await API.kingdomDiplomacy(action, kid);
      if (res?.success) {
        showToast('&#x1F54A; Proposed ' + label + ' with ' + (res.target||kname) + ' (-' + (res.cost||200) + ' influence)');
        renderCmdKingdom(document.getElementById('cmdTabContent'));
      } else {
        showToast(res?.error || 'Failed to propose action', true);
      }
    }
  });
}

// ── Clan — Assign Party Role ──
async function clanAssignRole(role, heroId, partyId) {
  const res = await API.assignRole(role, heroId, partyId);
  if (res?.success) {
    if (heroId) showToast('Assigned ' + res.hero + ' as ' + res.role);
    else showToast(role + ' unassigned');
    // Refresh the party detail panel so dropdowns reflect the new state
    const idx = (window._clanData?.parties || []).findIndex(p => p.id === partyId || p.leaderId === partyId);
    if (idx >= 0) clanSelectParty(idx);
  } else {
    showToast(res?.error || 'Failed to assign role', true);
  }
}

// _clanData is set in renderCmdClan()

// ── Kingdom Tab ──
async function renderCmdKingdom(el) {
  const [data, clanData] = await Promise.all([
    API.getPlayerKingdom(),
    API.getPlayerClan().catch(function(){return null})
  ]);
  if (!data || !data.isInKingdom) { el.innerHTML = '<div class="empty">Not part of any kingdom. You are independent.</div>'; return; }

  window._kingdomData = data;
  window._kingdomDiploData = clanData;

  var kdTab = window._kdTab || 'clans';
  var html = '';

  // ── Immersive Kingdom top strip ──
  const kdStrength = Number(data.strength) || 0;
  const kdFiefs = Number(data.fiefCount) || 0;
  const kdClans = Number(data.clanCount) || 0;
  const kdTowns = Number(data.towns) || 0;
  const kdCastles = Number(data.castles) || 0;
  const kdVillages = Number(data.villages) || 0;
  const kdLords = Number(data.lords) || 0;
  const kdArmies = (data.armies || []).length;
  const kdWars = data.wars || [];

  // Compute rank among all kingdoms
  const kdTopStripAllKingdoms = Store.kingdoms || [];
  const sortedByStrength = kdTopStripAllKingdoms.slice().sort((a, b) => (Number(b.strength)||0) - (Number(a.strength)||0));
  const kdRank = sortedByStrength.findIndex(k => k.name === data.name) + 1;
  const kdRankTotal = sortedByStrength.length || 1;

  // Auto-generated Kingdom title
  let kdHonor = 'Struggling Realm';
  if (kdRank === 1 && kdStrength > 3000) kdHonor = 'Dominant Empire';
  else if (kdRank === 1) kdHonor = 'Foremost Power';
  else if (kdRank <= 2) kdHonor = 'Great Power';
  else if (kdRank <= Math.ceil(kdRankTotal / 2)) kdHonor = 'Rising Realm';
  else if (kdFiefs <= 3) kdHonor = 'Besieged Remnant';
  else kdHonor = 'Waning Realm';

  // Gauge values
  const kgR = 34, kgCirc = 2 * Math.PI * kgR;
  // Strength rank — inverted: rank 1 = full ring
  const rankPct = kdRankTotal > 0 ? Math.max(0, ((kdRankTotal - kdRank + 1) / kdRankTotal) * 100) : 0;
  const rankDash = (rankPct / 100) * kgCirc;
  // Fiefs — against the strongest kingdom's fief count
  const maxFiefsRef = Math.max(1, ...kdTopStripAllKingdoms.map(k => Number(k.fiefCount) || 0));
  const fiefPct = Math.min(100, (kdFiefs / maxFiefsRef) * 100);
  const fiefDash = (fiefPct / 100) * kgCirc;
  // War pressure — 0 wars = 0%, 4+ wars = 100%
  const warPct = Math.min(100, (kdWars.length / 4) * 100);
  const warDash = (warPct / 100) * kgCirc;
  const warColor = kdWars.length === 0 ? '#7ac070' : kdWars.length <= 1 ? '#d4b060' : kdWars.length <= 2 ? '#e09040' : '#c05050';

  html += `<div class="cmd-kd-topstrip">
    <div class="cmd-kd-ribbon">\u{1F451} ${esc(kdHonor)}</div>
    <div class="cmd-clan-gauge-row">
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="url(#kgRank)" stroke-width="6"
            stroke-dasharray="${rankDash} ${kgCirc - rankDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(244,216,120,.5))"/>
          <defs><linearGradient id="kgRank" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#a06c20"/><stop offset="1" stop-color="#f5d878"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val">#${kdRank}</div>
          <div class="cmd-party-gauge-lbl">of ${kdRankTotal}</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="url(#kgFief)" stroke-width="6"
            stroke-dasharray="${fiefDash} ${kgCirc - fiefDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px rgba(144,120,200,.5))"/>
          <defs><linearGradient id="kgFief" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#5040a0"/><stop offset="1" stop-color="#a878d0"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val" style="color:#c8a0e0">${kdFiefs}</div>
          <div class="cmd-party-gauge-lbl">FIEFS</div>
        </div>
      </div>
      <div class="cmd-party-gauge">
        <svg viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="rgba(184,140,50,.18)" stroke-width="6"/>
          <circle cx="45" cy="45" r="${kgR}" fill="none" stroke="url(#kgWar)" stroke-width="6"
            stroke-dasharray="${warDash} ${kgCirc - warDash}" stroke-linecap="round"
            transform="rotate(-90 45 45)"
            style="filter:drop-shadow(0 0 8px ${warColor}88)"/>
          <defs><linearGradient id="kgWar" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8a2820"/><stop offset="1" stop-color="${warColor}"/>
          </linearGradient></defs>
        </svg>
        <div class="cmd-party-gauge-center">
          <div class="cmd-party-gauge-val" style="color:${warColor}">${kdWars.length}</div>
          <div class="cmd-party-gauge-lbl">WARS</div>
        </div>
      </div>
      <div class="cmd-clan-power-stats">
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F3DB}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdTowns}">0</b>
          <span class="cmd-clan-ps-lbl">Towns</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F3F0}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdCastles}">0</b>
          <span class="cmd-clan-ps-lbl">Castles</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F3E0}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdClans}">0</b>
          <span class="cmd-clan-ps-lbl">Clans</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F465}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdLords}">0</b>
          <span class="cmd-clan-ps-lbl">Lords</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{1F33E}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdVillages}">0</b>
          <span class="cmd-clan-ps-lbl">Villages</span>
        </div>
        <div class="cmd-clan-ps-row">
          <span class="cmd-clan-ps-icon">\u{2694}</span>
          <b class="cmd-clan-ps-val" data-count-target="${kdArmies}">0</b>
          <span class="cmd-clan-ps-lbl">Armies</span>
        </div>
      </div>
    </div>
    ${kdWars.length > 0 ? `<div class="cmd-kd-wars-strip">
      <span class="cmd-kd-wars-label">\u{2694} At War With</span>
      ${kdWars.map(w => {
        const enemyName = typeof w === 'string' ? w : (w.name || '?');
        const enemyK = kdTopStripAllKingdoms.find(k => k.name === enemyName);
        const banner = enemyK?.id && Store._bannerImages?.[enemyK.id] ? 'Banners/' + encodeURIComponent(enemyK.id) + '.png' : '';
        return `<div class="cmd-kd-war-chip" ${enemyK ? `onclick="openDetail('kingdoms','${esc(enemyK.id)}')" style="cursor:pointer"` : ''}>
          ${banner ? `<img class="cmd-kd-war-banner" src="${banner}">` : '<div class="cmd-kd-war-banner-empty"></div>'}
          <span>${esc(enemyName)}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>`;

  // Kingdom banner + header
  html += '<div class="clan-hdr">';
  if (data.bannerCode) html += '<div class="clan-hdr-banner" id="kdBannerCanvas"></div>';
  html += '<div class="clan-hdr-info">';
  html += '<h2 class="clan-hdr-name">' + esc(data.name) + '</h2>';
  html += '<div class="clan-hdr-tier">' + esc(data.culture || '') + ' Kingdom';
  if (data.isRuler) html += ' &middot; <span style="color:#80b060;cursor:pointer" onclick="kdRenameKingdom(\'' + esc(data.name) + '\')" title="Rename Kingdom">&#x270E; Rename</span>';
  html += '</div>';
  html += '</div>';
  html += '<div class="clan-hdr-stats">';
  html += '<div class="clan-hdr-stat"><b>' + esc(data.ruler) + '</b><span>' + (data.isRuler ? 'Ruler (You)' : 'Ruler') + '</span></div>';
  html += '<div class="clan-hdr-stat"><b>' + (data.clanCount || 0) + '</b><span>Clans</span></div>';
  html += '<div class="clan-hdr-stat"><b>' + (data.fiefCount || 0) + '</b><span>Fiefs</span></div>';
  html += '<div class="clan-hdr-stat"><b>' + (data.strength >= 1000 ? (data.strength/1000).toFixed(1)+'K' : data.strength) + '</b><span>Strength</span></div>';
  html += '</div></div>';

  // Abdicate Leadership button (ruler only)
  if (data.isRuler) {
    html += '<div style="text-align:center;margin:10px 0">';
    html += '<button class="kd-game-btn kd-game-btn-danger" onclick="kdAbdicate()">&#x1F451; Abdicate Leadership</button>';
    html += '</div>';
  }

  // Sub-tab switcher — Clans, Fiefs, Policies, Armies, Diplomacy
  html += '<div class="inv-modes">';
  var kdModes = [{id:'clans',icon:'&#x1F3E0;',label:'Clans'},{id:'fiefs',icon:'&#x1F3F0;',label:'Fiefs'},{id:'policies',icon:'&#x1F4DC;',label:'Policies'},{id:'armies',icon:'&#x2694;',label:'Armies'},{id:'diplomacy',icon:'&#x1F6E1;',label:'Diplomacy'}];
  for (var ki = 0; ki < kdModes.length; ki++) {
    var km = kdModes[ki];
    html += '<div class="inv-mode' + (kdTab===km.id?' inv-mode-active':'') + '" onclick="window._kdTab=\'' + km.id + '\';renderCmdKingdom(document.getElementById(\'cmdTabContent\'))">';
    html += '<span class="inv-mode-icon">' + km.icon + '</span> ' + km.label + '</div>';
  }
  html += '</div>';

  // ═══ CLANS TAB — Game-style split layout ═══
  if (kdTab === 'clans') {
    var clans = data.clans || [];
    // Summary strip
    const totalClanInf = clans.reduce((s, c) => s + (Number(c.influence) || 0), 0);
    const totalClanMem = clans.reduce((s, c) => s + (Number(c.members) || 0), 0);
    const majorClans = clans.filter(c => (c.tier || 0) >= 4).length;
    const fiefHolders = clans.filter(c => (c.fiefs || 0) > 0).length;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3E0}</span><b data-count-target="${clans.length}">0</b><span>Clans</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2694}</span><b data-count-target="${majorClans}">0</b><span>Major Houses</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3F0}</span><b data-count-target="${fiefHolders}">0</b><span>Fief Holders</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F465}</span><b data-count-target="${totalClanMem}">0</b><span>Total Members</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2726}</span><b data-count-target="${totalClanInf}">0</b><span>Total Influence</span></div>
    </div>`;
    html += '<div class="clan-split">';

    // LEFT — Clan table matching game: Banner, Name, Influence, Members, Fiefs
    html += '<div class="clan-split-left">';
    html += '<div class="kd-clan-hdr">';
    html += '<span class="kd-ch-banner">Banner</span>';
    html += '<span class="kd-ch-type">Type</span>';
    html += '<span class="kd-ch-name">Name</span>';
    html += '<span class="kd-ch-inf">Inf</span>';
    html += '<span class="kd-ch-mem">Mem</span>';
    html += '<span class="kd-ch-fief">Fief</span>';
    html += '</div>';
    for (var ci5 = 0; ci5 < clans.length; ci5++) {
      var c4 = clans[ci5];
      // Derive "type" icon from tier — major clans have higher tiers
      var typeIcon = c4.tier >= 4 ? '&#x2694;' : c4.tier >= 2 ? '&#x1F6E1;' : '&#x1F4DC;';
      var typeTitle = c4.tier >= 4 ? 'Major Clan' : c4.tier >= 2 ? 'Minor Clan' : 'Small Clan';
      html += '<div class="kd-clan-row' + (ci5===0 ? ' cp-row-active' : '') + '" onclick="kdShowClan(' + ci5 + ')">';
      html += '<span class="kd-ch-banner"><span class="kd-clan-banner-mini" id="kdClanBanner_' + ci5 + '"></span></span>';
      html += '<span class="kd-ch-type" title="' + typeTitle + '">' + typeIcon + '</span>';
      html += '<span class="kd-ch-name">' + esc(c4.name) + '</span>';
      html += '<span class="kd-ch-inf">' + (c4.influence||0) + '</span>';
      html += '<span class="kd-ch-mem">' + (c4.members||0) + '</span>';
      html += '<span class="kd-ch-fief">' + (c4.fiefs||0) + '</span>';
      html += '</div>';
    }
    html += '</div>';

    // RIGHT — Clan detail panel
    html += '<div class="clan-split-right" id="kdClanDetail"><div class="inv-empty">Select a clan</div></div>';
    html += '</div>';
  }

  // ═══ FIEFS TAB — Split layout (table + detail panel) ═══
  else if (kdTab === 'fiefs') {
    var fiefs = data.fiefs || [];
    // Summary strip
    const fiefTowns = fiefs.filter(f => f.type === 'Town').length;
    const fiefCastles = fiefs.filter(f => f.type === 'Castle').length;
    const totalProsp = fiefs.reduce((s, f) => s + (Number(f.prosperity) || 0), 0);
    const avgProsp = fiefs.length > 0 ? Math.round(totalProsp / fiefs.length) : 0;
    const totalGarrison = fiefs.reduce((s, f) => s + (Number(f.garrison) || 0), 0);
    const besieged = fiefs.filter(f => f.isUnderSiege).length;
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3DB}</span><b data-count-target="${fiefTowns}">0</b><span>Towns</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F3F0}</span><b data-count-target="${fiefCastles}">0</b><span>Castles</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F4B0}</span><b data-count-target="${avgProsp}">0</b><span>Avg Prosperity</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F6E1}</span><b data-count-target="${totalGarrison}">0</b><span>Total Garrison</span></div>
      ${besieged > 0 ? `<div class="kd-subtab-item kd-subtab-danger"><span class="kd-subtab-icon">\u{1F525}</span><b data-count-target="${besieged}">0</b><span>Under Siege</span></div>` : ''}
    </div>`;
    html += '<div class="clan-split kd-fief-split">';
    // LEFT — Game-style table
    html += '<div class="clan-split-left">';
    html += '<div class="kd-fief-hdr">';
    html += '<span class="kd-fh-type">Type</span>';
    html += '<span class="kd-fh-name">Name</span>';
    html += '<span class="kd-fh-owner">Owner</span>';
    html += '<span class="kd-fh-prosp">Prosp.</span>';
    html += '<span class="kd-fh-def">Defenders</span>';
    html += '</div>';
    for (var fi5 = 0; fi5 < fiefs.length; fi5++) {
      var f5 = fiefs[fi5];
      var fImg = f5.type === 'Town' ? 'Settlement/Town.png' : 'Settlement/Castle.png';
      html += '<div class="kd-fief-row' + (f5.isPlayer ? ' kd-fief-player' : '') + (fi5===0?' cp-row-active':'') + '" onclick="kdShowFief(' + fi5 + ')">';
      html += '<span class="kd-fh-type"><img class="kd-fief-img" src="' + fImg + '" alt="" onerror="this.style.display=\'none\'"></span>';
      html += '<span class="kd-fh-name">' + esc(f5.name) + '</span>';
      html += '<span class="kd-fh-owner">';
      var ownerHero = (Store.heroes||[]).find(function(h){return h.id === f5.ownerId});
      html += '<div class="kd-fief-owner-cell">';
      html += '<div class="kd-fief-owner-row">';
      if (ownerHero) {
        var portrait = getPortraitSrc(ownerHero, ownerHero);
        var gpO = isGamePortrait(ownerHero);
        if (portrait) {
          html += '<img class="kd-fief-owner-portrait' + (gpO ? ' game-portrait' : '') + '" src="' + portrait + '" alt="" onerror="this.style.display=\'none\'"' + (gpO ? ' style="' + GP_STYLE + ';width:26px;height:26px;border-radius:3px"' : '') + '>';
        }
      }
      html += '<span class="kd-fief-banner-mini" id="kdFiefBanner_' + fi5 + '"></span>';
      html += '</div>';
      if (f5.ownerName) html += '<div class="kd-fief-owner-text">' + esc(f5.ownerName) + '</div>';
      html += '</div>';
      html += '</span>';
      html += '<span class="kd-fh-prosp">' + (f5.prosperity||0).toLocaleString() + '</span>';
      html += '<span class="kd-fh-def">' + (f5.garrison||0) + '</span>';
      html += '</div>';
    }
    if (!fiefs.length) html += '<div class="inv-empty" style="padding:12px">No fiefs in kingdom</div>';
    html += '</div>';
    // RIGHT — Detail panel
    html += '<div class="clan-split-right" id="kdFiefDetail"><div class="inv-empty">Select a fief</div></div>';
    html += '</div>';
  }

  // ═══ POLICIES TAB ═══
  else if (kdTab === 'policies') {
    var policies = data.policies || [];
    if (policies.length) {
      var actives = policies.filter(function(p){return p.isActive});
      var others = policies.filter(function(p){return !p.isActive});
      var pending = policies.filter(function(p){return p.hasPendingDecision});
      window._kingdomPolicies = policies;
      // Summary strip
      html += `<div class="kd-subtab-strip">
        <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F4DC}</span><b data-count-target="${policies.length}">0</b><span>Total Policies</span></div>
        <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2705}</span><b data-count-target="${actives.length}">0</b><span>Active</span></div>
        <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{274C}</span><b data-count-target="${others.length}">0</b><span>Inactive</span></div>
        ${pending.length > 0 ? `<div class="kd-subtab-item kd-subtab-warn"><span class="kd-subtab-icon">\u{23F3}</span><b data-count-target="${pending.length}">0</b><span>Pending Votes</span></div>` : ''}
      </div>`;
      html += '<div class="kd-policy-split">';
      // ─── Left: list grouped by active/other ───
      html += '<div class="kd-policy-list">';
      html += '<div class="kd-policy-group-hdr">Active Policies (' + actives.length + ')</div>';
      for (var pi5 = 0; pi5 < actives.length; pi5++) {
        var p5 = actives[pi5];
        var idxA = policies.indexOf(p5);
        html += '<div class="kd-policy-row kd-policy-row-active' + (pi5===0?' cp-row-active':'') + '" onclick="kdShowPolicy(' + idxA + ')">' + esc(p5.name) + '</div>';
      }
      html += '<div class="kd-policy-group-hdr kd-policy-group-other">Other Policies (' + others.length + ')</div>';
      for (var pi6 = 0; pi6 < others.length; pi6++) {
        var p6 = others[pi6];
        var idxO = policies.indexOf(p6);
        html += '<div class="kd-policy-row kd-policy-row-inactive" onclick="kdShowPolicy(' + idxO + ')">' + esc(p6.name) + '</div>';
      }
      html += '</div>';
      // ─── Right: detail panel ───
      html += '<div class="kd-policy-detail" id="kdPolicyDetail"></div>';
      html += '</div>';
    } else {
      html += '<div class="inv-empty" style="padding:20px;text-align:center">No policies available</div>';
    }
  }

  // ═══ ARMIES TAB ═══
  else if (kdTab === 'armies') {
    var armies = data.armies || [];
    window._kingdomArmies = armies;
    // Summary strip
    const totalArmyMen = armies.reduce((s, a) => s + (Number(a.totalStrength || a.strength || a.men) || 0), 0);
    const totalArmyParties = armies.reduce((s, a) => s + ((a.parties || []).length || Number(a.partyCount) || 0), 0);
    const playerInArmy = armies.some(a => a.isPlayer || (a.parties || []).some(p => p.isPlayer));
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{2694}</span><b data-count-target="${armies.length}">0</b><span>Armies</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F465}</span><b data-count-target="${totalArmyMen}">0</b><span>Total Men</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F6AC}</span><b data-count-target="${totalArmyParties}">0</b><span>Parties</span></div>
      ${playerInArmy ? `<div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{2605}</span><b>YOU</b><span>In Army</span></div>` : ''}
    </div>`;
    html += '<div class="kd-army-split">';
    // ── LEFT: column headers + Create Army button + rows ──
    html += '<div class="kd-army-list">';
    // Column headers (game-style)
    html += '<div class="kd-army-hdr">';
    html += '<span class="kd-ah-name">Army Name</span>';
    html += '<span class="kd-ah-leader">Leader</span>';
    html += '<span class="kd-ah-men">Men</span>';
    html += '<span class="kd-ah-parties">Parties</span>';
    html += '<span class="kd-ah-loc">Location</span>';
    html += '</div>';
    // Create Army banner
    html += '<div class="kd-army-create" onclick="kdCreateArmy()">Create Army</div>';
    // Rows
    if (armies.length) {
      for (var ai5 = 0; ai5 < armies.length; ai5++) {
        var a5 = armies[ai5];
        html += '<div class="kd-army-row' + (a5.isPlayer ? ' kd-army-row-player' : '') + (ai5===0?' cp-row-active':'') + '" onclick="kdShowArmy(' + ai5 + ')">';
        html += '<span class="kd-ah-name">' + esc(a5.name || (a5.leader + '\'s Army')) + '</span>';
        html += '<span class="kd-ah-leader">' + esc(a5.leader || '—') + '</span>';
        html += '<span class="kd-ah-men">' + (a5.troops||0) + '</span>';
        html += '<span class="kd-ah-parties">' + (a5.parties||0) + '</span>';
        html += '<span class="kd-ah-loc">' + esc(a5.location || '—') + '</span>';
        html += '</div>';
      }
    }
    html += '</div>';
    // ── RIGHT: detail panel ──
    html += '<div class="kd-army-detail" id="kdArmyDetail">';
    if (!armies.length) html += '<div class="kd-army-empty">No Army Selected</div>';
    html += '</div>';
    html += '</div>';
  }

  // ═══ DIPLOMACY TAB ═══
  else if (kdTab === 'diplomacy') {
    var diploSrc = clanData || {};
    var allKingdoms = (diploSrc.kingdoms||[]).filter(function(k){return !k.isPlayer});
    var atWarK = allKingdoms.filter(function(k){return k.relation==='war'});
    var atPeaceK = allKingdoms.filter(function(k){return k.relation!=='war'}); // includes ally + neutral
    var alliesK = allKingdoms.filter(function(k){return k.relation==='ally'});
    var neutralsK = allKingdoms.filter(function(k){return k.relation==='neutral'});
    window._diploKingdoms = allKingdoms;
    window._diploPlayerKingdom = (diploSrc.kingdoms||[]).find(function(k){return k.isPlayer});

    // Summary strip — diplomatic standing at a glance
    html += `<div class="kd-subtab-strip">
      <div class="kd-subtab-item kd-subtab-danger"><span class="kd-subtab-icon">\u{2694}</span><b data-count-target="${atWarK.length}">0</b><span>At War</span></div>
      <div class="kd-subtab-item kd-subtab-success"><span class="kd-subtab-icon">\u{1F91D}</span><b data-count-target="${alliesK.length}">0</b><span>Allies</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F54A}</span><b data-count-target="${neutralsK.length}">0</b><span>Neutral</span></div>
      <div class="kd-subtab-item"><span class="kd-subtab-icon">\u{1F30D}</span><b data-count-target="${allKingdoms.length}">0</b><span>Known Realms</span></div>
    </div>`;

    html += '<div class="kd-diplo-split">';
    html += '<div class="kd-diplo-list">';
    html += '<div class="kd-diplo-title">Diplomacy</div>';

    // ─── At War (collapsible) ───
    html += '<div class="kd-diplo-group kd-diplo-group-war' + (atWarK.length===0?' collapsed':'') + '" onclick="this.classList.toggle(\'collapsed\')">';
    html += '<span class="kd-diplo-group-arrow">&#x25BC;</span>';
    html += '<span>At War (' + atWarK.length + ')</span>';
    html += '</div>';
    html += '<div class="kd-diplo-group-rows kd-diplo-group-rows-war"' + (atWarK.length===0?' style="display:none"':'') + '>';
    for (var wi3 = 0; wi3 < atWarK.length; wi3++) {
      var w3 = atWarK[wi3];
      html += '<div class="kd-diplo-row kd-diplo-row-war" onclick="diploShowKingdom(\'' + esc(w3.id) + '\')">';
      html += '<span class="kd-diplo-row-banner" id="diploRowBanner_' + esc(w3.id) + '"></span>';
      html += '<span class="kd-diplo-row-name">' + esc(w3.name) + '</span>';
      html += '<span class="kd-diplo-row-icon">&#x2694;</span>';
      html += '</div>';
    }
    html += '</div>';

    // ─── At Peace (collapsible, expanded by default) ───
    html += '<div class="kd-diplo-group kd-diplo-group-peace" onclick="this.classList.toggle(\'collapsed\')">';
    html += '<span class="kd-diplo-group-arrow">&#x25BC;</span>';
    html += '<span>At Peace (' + atPeaceK.length + ')</span>';
    html += '</div>';
    html += '<div class="kd-diplo-group-rows kd-diplo-group-rows-peace">';
    for (var pi3 = 0; pi3 < atPeaceK.length; pi3++) {
      var p3 = atPeaceK[pi3];
      var relCls = p3.relation === 'ally' ? ' kd-diplo-row-ally' : '';
      html += '<div class="kd-diplo-row kd-diplo-row-peace' + relCls + '" onclick="diploShowKingdom(\'' + esc(p3.id) + '\')">';
      html += '<span class="kd-diplo-row-banner" id="diploRowBanner_' + esc(p3.id) + '"></span>';
      html += '<span class="kd-diplo-row-name">' + esc(p3.name) + '</span>';
      html += '<span class="kd-diplo-row-icon">&#x1F54A;</span>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    html += '<div class="kd-diplo-detail" id="diploDetail"><div class="kd-army-empty">No Kingdom Selected</div></div>';
    html += '</div>';
  }

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);

  // Render kingdom banner
  if (data.bannerCode) {
    try {
      var kdBEl = document.getElementById('kdBannerCanvas');
      if (kdBEl) {
        if (typeof renderBannerInto === 'function') renderBannerInto(kdBEl, data.bannerCode, 80);
        else if (typeof renderBannerSVG === 'function') kdBEl.innerHTML = renderBannerSVG(data.bannerCode, 80);
      }
    } catch(e) { console.warn('[KdBanner] render failed:', e); }
  }

  // Fiefs tab — render mini banners + auto-select first
  if (kdTab === 'fiefs') {
    var fiefsList = data.fiefs || [];
    for (var fbi = 0; fbi < fiefsList.length; fbi++) {
      try {
        var fbEl = document.getElementById('kdFiefBanner_' + fbi);
        if (!fbEl || !fiefsList[fbi].bannerCode) continue;
        if (typeof renderBannerInto === 'function') renderBannerInto(fbEl, fiefsList[fbi].bannerCode, 22);
        else if (typeof renderBannerSVG === 'function') fbEl.innerHTML = renderBannerSVG(fiefsList[fbi].bannerCode, 22);
      } catch(e){}
    }
    if (fiefsList.length) kdShowFief(0);
  }

  // Policies tab — auto-select first active (or first overall)
  if (kdTab === 'policies') {
    var pList = data.policies || [];
    if (pList.length) {
      var firstActive = pList.findIndex(function(p){return p.isActive});
      kdShowPolicy(firstActive >= 0 ? firstActive : 0);
    }
  }

  // Armies tab — auto-select first
  if (kdTab === 'armies') {
    var aList = data.armies || [];
    if (aList.length) kdShowArmy(0);
  }

  // Clans tab — auto-select first + render mini banners
  if (kdTab === 'clans') {
    var clansList = data.clans || [];
    if (clansList.length) kdShowClan(0);
    for (var cbi = 0; cbi < clansList.length; cbi++) {
      try {
        var cbEl = document.getElementById('kdClanBanner_' + cbi);
        if (!cbEl || !clansList[cbi].bannerCode) continue;
        if (typeof renderBannerInto === 'function') renderBannerInto(cbEl, clansList[cbi].bannerCode, 24);
        else if (typeof renderBannerSVG === 'function') cbEl.innerHTML = renderBannerSVG(clansList[cbi].bannerCode, 24);
      } catch(e){ console.warn('[KdClanBanner] render failed:', e); }
    }
  }

  // Diplomacy auto-select + render row banners
  if (kdTab === 'diplomacy') {
    var diploKs = window._diploKingdoms || [];
    // Render the small banners next to each kingdom row
    for (var di = 0; di < diploKs.length; di++) {
      var dk = diploKs[di];
      try {
        var rbEl = document.getElementById('diploRowBanner_' + dk.id);
        if (!rbEl || !dk.bannerCode) continue;
        if (typeof renderBannerInto === 'function') renderBannerInto(rbEl, dk.bannerCode, 30);
        else if (typeof renderBannerSVG === 'function') rbEl.innerHTML = renderBannerSVG(dk.bannerCode, 30);
      } catch(e){}
    }
    // Auto-select first war, else first peace
    var firstWar = diploKs.find(function(k){return k.relation==='war'});
    if (firstWar) diploShowKingdom(firstWar.id);
    else if (diploKs.length) diploShowKingdom(diploKs[0].id);
  }
}

// ── Holdings Tab ──
async function renderCmdHoldings(el) {
  const data = await API.getPlayerSettlements();
  if (!data?.settlements?.length) { el.innerHTML = '<div class="empty">You don\'t own any settlements yet.</div>'; return; }

  let html = '<div class="cmd-panel"><div class="cmd-holdings-grid">';
  for (const s of data.settlements) {
    const typeBadge = s.type === 'Town' ? '&#x1F451;' : s.type === 'Castle' ? '&#x1F3F0;' : '&#x1F33F;';
    html += `<div class="cmd-holding-card" onclick="openDetail('settlements','${esc(s.id)}')">
      <div class="cmd-holding-header">
        <span class="cmd-holding-type">${typeBadge}</span>
        <span class="cmd-holding-name">${esc(s.name)}</span>
        <span class="cmd-holding-badge">${esc(s.type)}</span>
      </div>`;

    if (s.prosperity != null) {
      html += `<div class="cmd-holding-gauges">
        <div class="cmd-gauge"><span class="cmd-gauge-label">Prosperity</span><div class="cmd-gauge-bar"><div class="cmd-gauge-fill cmd-gauge-gold" style="width:${Math.min(s.prosperity/80, 100)}%"></div></div><span class="cmd-gauge-val">${s.prosperity}</span></div>
        <div class="cmd-gauge"><span class="cmd-gauge-label">Loyalty</span><div class="cmd-gauge-bar"><div class="cmd-gauge-fill cmd-gauge-blue" style="width:${s.loyalty}%"></div></div><span class="cmd-gauge-val">${s.loyalty}</span></div>
        <div class="cmd-gauge"><span class="cmd-gauge-label">Security</span><div class="cmd-gauge-bar"><div class="cmd-gauge-fill cmd-gauge-green" style="width:${s.security}%"></div></div><span class="cmd-gauge-val">${s.security}</span></div>
        <div class="cmd-gauge"><span class="cmd-gauge-label">Food</span><div class="cmd-gauge-bar"><div class="cmd-gauge-fill cmd-gauge-amber" style="width:${Math.min(s.foodStocks/5, 100)}%"></div></div><span class="cmd-gauge-val">${s.foodStocks}</span></div>
      </div>
      <div class="cmd-holding-stats">
        <span>Garrison: ${s.garrison}</span>
        <span>Militia: ${s.militia}</span>
        ${s.governor ? `<span>Governor: ${esc(s.governor)}</span>` : ''}
      </div>`;
      if (s.workshops?.length) {
        html += `<div class="cmd-holding-workshops">${s.workshops.map(w => `<span class="cmd-ws-badge">${esc(w)}</span>`).join('')}</div>`;
      }
    } else if (s.produces) {
      html += `<div class="cmd-holding-stats"><span>Produces: ${esc(s.produces)}</span></div>`;
    }
    html += '</div>';
  }
  html += '</div></div>';
  el.innerHTML = html;
}

// ── Chronicle Tab ──
window._cmdChrFilter = 'all';
function setCmdChronicleFilter(f) {
  window._cmdChrFilter = f;
  const el = document.getElementById('cmdTabContent');
  if (el) renderCmdChronicle(el);
}

// Category detector — same taxonomy as the main Chronicle page
function _cmdChrEventMeta(text) {
  const t = (text || '').toLowerCase();
  if (/\bvictory\b|\bdefeated\b|\bbattle\b|\bwon\b/.test(t))
    return { cat:'battle', icon:'\u{2694}', color:'#c08060', label:'Battle' };
  if (/siege|besieged|stormed|captured/.test(t))
    return { cat:'siege', icon:'\u{1F3F0}', color:'#a08e6a', label:'Siege' };
  if (/declared war|war broke/.test(t))
    return { cat:'war', icon:'\u{1F6E1}', color:'#c05050', label:'War' };
  if (/peace|truce|alliance|treaty/.test(t))
    return { cat:'diplomacy', icon:'\u{1F54A}', color:'#80a0d0', label:'Diplomacy' };
  if (/died|slain|killed|death/.test(t))
    return { cat:'death', icon:'\u{2620}', color:'#a15b5b', label:'Death' };
  if (/married|wedlock|wedding/.test(t))
    return { cat:'family', icon:'\u{1F48D}', color:'#d8a0b0', label:'Marriage' };
  if (/born|birth/.test(t))
    return { cat:'family', icon:'\u{1F476}', color:'#7ac070', label:'Birth' };
  if (/tournament|joust/.test(t))
    return { cat:'tournament', icon:'\u{1F3C6}', color:'#d4a43a', label:'Tournament' };
  if (/rebellion|defect|treason/.test(t))
    return { cat:'politics', icon:'\u{1F6A9}', color:'#c07040', label:'Politics' };
  if (/quest|undertak|completed/.test(t))
    return { cat:'quest', icon:'\u{1F4DC}', color:'#9c7dc9', label:'Quest' };
  return { cat:'other', icon:'\u{2726}', color:'#8a7858', label:'Event' };
}

async function renderCmdChronicle(el) {
  const heroId = (Store.heroes || []).find(h => h.isPlayer)?.id;
  if (!heroId) { el.innerHTML = '<div class="empty">No hero found.</div>'; return; }

  const detail = await API.getHero(heroId);

  // Merge timeline + journal, dedupe by (date+text)
  const timeline = detail?.timeline || [];
  const journal = detail?.journal || [];
  const seen = new Set();
  const combined = [];
  function pushEntry(e) {
    const date = e.date || '';
    const text = (e.text || e.entry || '').trim();
    if (!text) return;
    const key = date + '||' + text;
    if (seen.has(key)) return;
    seen.add(key);
    combined.push({date, text, meta: _cmdChrEventMeta(text)});
  }
  timeline.forEach(pushEntry);
  journal.forEach(pushEntry);

  // Category counts
  const catCounts = {};
  combined.forEach(e => { catCounts[e.meta.cat] = (catCounts[e.meta.cat] || 0) + 1; });
  const battleCount = catCounts.battle || 0;
  const siegeCount = catCounts.siege || 0;
  const deathCount = catCounts.death || 0;
  const familyCount = catCounts.family || 0;
  const tourneyCount = catCounts.tournament || 0;
  const questCount = catCounts.quest || 0;

  // Auto-generated Chronicler title
  let chrHonor = 'Unwritten Legend';
  if (combined.length >= 200) chrHonor = 'Saga of an Age';
  else if (combined.length >= 100) chrHonor = 'Epic Chronicle';
  else if (combined.length >= 50) chrHonor = 'Notable History';
  else if (combined.length >= 20) chrHonor = 'A Storied Life';
  else if (combined.length > 0) chrHonor = 'Early Tales';

  // Filter
  const filter = window._cmdChrFilter || 'all';
  const displayEvents = filter === 'all' ? combined : combined.filter(e => e.meta.cat === filter);

  let html = '';

  // Top strip
  html += `<div class="cmd-chr-topstrip">
    <div class="cmd-chr-ribbon">\u{1F4DC} ${esc(chrHonor)}</div>
    <div class="cmd-chr-stats-row">
      <div class="cmd-chr-stat"><span class="cmd-chr-stat-icon">\u{1F4DC}</span><b data-count-target="${combined.length}">0</b><span>Entries</span></div>
      ${battleCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#c08060">\u{2694}</span><b data-count-target="${battleCount}">0</b><span>Battles</span></div>` : ''}
      ${siegeCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#a08e6a">\u{1F3F0}</span><b data-count-target="${siegeCount}">0</b><span>Sieges</span></div>` : ''}
      ${deathCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#a15b5b">\u{2620}</span><b data-count-target="${deathCount}">0</b><span>Deaths</span></div>` : ''}
      ${familyCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#d8a0b0">\u{1F48D}</span><b data-count-target="${familyCount}">0</b><span>Family</span></div>` : ''}
      ${tourneyCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#d4a43a">\u{1F3C6}</span><b data-count-target="${tourneyCount}">0</b><span>Tourneys</span></div>` : ''}
      ${questCount > 0 ? `<div class="cmd-chr-stat"><span class="cmd-chr-stat-icon" style="color:#9c7dc9">\u{1F4DC}</span><b data-count-target="${questCount}">0</b><span>Quests</span></div>` : ''}
    </div>
  </div>`;

  // Filter chips
  const chipCats = [
    {id:'all', icon:'\u{1F30D}', label:'All', count:combined.length},
    {id:'battle', icon:'\u{2694}', label:'Battles', count:battleCount},
    {id:'siege', icon:'\u{1F3F0}', label:'Sieges', count:siegeCount},
    {id:'war', icon:'\u{1F6E1}', label:'Wars', count:catCounts.war || 0},
    {id:'diplomacy', icon:'\u{1F54A}', label:'Diplomacy', count:catCounts.diplomacy || 0},
    {id:'family', icon:'\u{1F48D}', label:'Family', count:familyCount},
    {id:'death', icon:'\u{2620}', label:'Deaths', count:deathCount},
    {id:'tournament', icon:'\u{1F3C6}', label:'Tourneys', count:tourneyCount},
    {id:'quest', icon:'\u{1F4DC}', label:'Quests', count:questCount},
    {id:'other', icon:'\u{2726}', label:'Other', count:catCounts.other || 0},
  ];
  html += '<div class="cmd-chr-chips">';
  chipCats.forEach(c => {
    if (c.id !== 'all' && c.count === 0) return;
    html += `<button class="cmd-chr-chip ${filter===c.id?'active':''}" onclick="setCmdChronicleFilter('${c.id}')">${c.icon} ${c.label} <b>${c.count}</b></button>`;
  });
  html += '</div>';

  // Timeline
  html += '<div class="cmd-panel cmd-chr-panel">';
  if (displayEvents.length === 0) {
    html += '<div class="cmd-chr-empty">' + (combined.length === 0 ? 'No events recorded yet.' : 'No ' + filter + ' events.') + '</div>';
  } else {
    html += '<div class="cmd-chr-timeline">';
    // Group by date for visual clusters
    let lastDate = null;
    displayEvents.forEach((evt, i) => {
      if (evt.date !== lastDate) {
        html += `<div class="cmd-chr-date-marker"><span>${esc(evt.date || 'Unknown Date')}</span></div>`;
        lastDate = evt.date;
      }
      html += `<div class="cmd-chr-entry" style="--chr-accent:${evt.meta.color};animation-delay:${Math.min(i * 0.015, 0.5)}s">
        <div class="cmd-chr-entry-icon" style="background:${evt.meta.color}22;border-color:${evt.meta.color}">${evt.meta.icon}</div>
        <div class="cmd-chr-entry-body">
          <div class="cmd-chr-entry-text">${textToHtml(evt.text)}</div>
          <div class="cmd-chr-entry-tag">${evt.meta.label}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  el.innerHTML = html;
  setTimeout(() => animateCounters(el), 60);
}

async function renderChronicle() {
  const list = document.getElementById('chronicle-list');
  if (!list) return;

  // Render new extras (today card + stats + widgets) + toolbar
  renderChronicleExtras();

  const [chronicle, descCount, journalCount, tagCount, relNoteCount] = await Promise.all([
    API.getAllChronicle(),
    API.getDescriptionCount(),
    API.getJournalCount(),
    API.getTagCount(),
    API.getRelationNoteCount()
  ]);

  const extractCount = v => typeof v === 'object' && v !== null ? (v.count ?? 0) : (v ?? 0);
  setEl('chronicle-total', chronicle?.length || 0);
  setEl('journal-total', extractCount(journalCount));
  setEl('desc-total', extractCount(descCount));
  setEl('tags-total', extractCount(tagCount));
  setEl('relnotes-total', extractCount(relNoteCount));

  if (!chronicle || chronicle.length === 0) {
    list.innerHTML = `<div class="empty-state empty-state-chronicle">
      <div class="empty-state-bg" style="background-image:url('bannerlord_chronicle.png')"></div>
      <div class="empty-state-content">
        <div class="empty-state-icon">\u270E</div>
        <div class="empty-state-title">No chronicle events recorded</div>
        <div class="empty-state-desc">Play the game to see history unfold here</div>
      </div>
    </div>`;
    return;
  }

  buildChronicleFilters(chronicle, 'chronicleFilters');

  // Category detection with color + icon + CSS vars
  const getEventMeta = (txt) => {
    const t = (txt || '').toLowerCase();
    if (t.includes('battle') || t.includes('attack') || t.includes('[war]') || t.includes('fought'))
      return { icon: '&#x2694;', tag: 'war', color: '#c05050', r:192, g:80, b:80, label: 'War' };
    if (t.includes('died') || t.includes('killed') || t.includes('death') || t.includes('slain'))
      return { icon: '&#x2620;', tag: 'death', color: '#a15b5b', r:161, g:91, b:91, label: 'Death' };
    if (t.includes('siege') || t.includes('raided'))
      return { icon: '&#x1F3F0;', tag: 'siege', color: '#a08e6a', r:160, g:142, b:106, label: 'Siege' };
    if (t.includes('married') || t.includes('birth') || t.includes('[family]') || t.includes('child') || t.includes('pregnant') || t.includes('heir'))
      return { icon: '&#x2764;', tag: 'family', color: '#d8a0b0', r:216, g:160, b:176, label: 'Family' };
    if (t.includes('king') || t.includes('ruler') || t.includes('[politics]') || t.includes('defect') || t.includes('join'))
      return { icon: '&#x265A;', tag: 'politics', color: '#6d8cb1', r:109, g:140, b:177, label: 'Politics' };
    if (t.includes('prisoner') || t.includes('captured') || t.includes('ransom'))
      return { icon: '&#x26D3;', tag: 'crime', color: '#c07040', r:192, g:112, b:64, label: 'Crime' };
    if (t.includes('peace') || t.includes('truce') || t.includes('alliance'))
      return { icon: '&#x2696;', tag: 'diplomacy', color: '#5b8f69', r:91, g:143, b:105, label: 'Diplomacy' };
    if (t.includes('victory'))
      return { icon: '&#x1F3C6;', tag: 'war', color: '#d4a43a', r:212, g:164, b:58, label: 'Victory' };
    return { icon: '&#x2726;', tag: 'other', color: '#8a7858', r:138, g:120, b:88, label: 'Event' };
  };

  // Dedupe by (date + normalized text) — Bannerlord often emits the same event multiple times
  const _seenKeys = new Set();
  let dedupedChronicle = [];
  for (const e of chronicle) {
    const key = (e.date || '') + '||' + ((e.text || '').trim().toLowerCase());
    if (_seenKeys.has(key)) continue;
    _seenKeys.add(key);
    dedupedChronicle.push(e);
  }

  // Quick filter chip (chronicle toolbar)
  if (_chronicleQuickFilter && _chronicleQuickFilter !== 'all') {
    const q = _chronicleQuickFilter;
    dedupedChronicle = dedupedChronicle.filter(e => {
      const t = (e.text || '').toLowerCase();
      if (q === 'war') return t.includes('[war]') || t.includes('war') || t.includes('battle') || t.includes('siege') || t.includes('victory');
      if (q === 'family') return t.includes('[family]') || t.includes('married') || t.includes('born') || t.includes('died');
      if (q === 'politics') return t.includes('[politics]') || t.includes('alliance') || t.includes('peace') || t.includes('king') || t.includes('defect');
      if (q === 'crime') return t.includes('[crime]') || t.includes('prisoner') || t.includes('captured') || t.includes('ransom');
      if (q === 'battle') return t.includes('victory') || t.includes('defeated') || t.includes('battle');
      if (q === 'death') return t.includes('died') || t.includes('slain') || t.includes('killed');
      if (q === 'marriage') return t.includes('married');
      return true;
    });
  }
  // Sort
  if (_chronicleSort === 'oldest') dedupedChronicle = dedupedChronicle.slice().reverse();

  // Pagination — 50 events per page, newest first
  const PAGE_SIZE = 50;
  const totalEvents = dedupedChronicle.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));
  if (typeof window._chroniclePage !== 'number') window._chroniclePage = 0;
  if (window._chroniclePage >= totalPages) window._chroniclePage = totalPages - 1;
  if (window._chroniclePage < 0) window._chroniclePage = 0;
  const startIdx = window._chroniclePage * PAGE_SIZE;
  const pagedChronicle = dedupedChronicle.slice(startIdx, startIdx + PAGE_SIZE);

  // Group the current page by date
  const grouped = {};
  pagedChronicle.forEach(e => {
    const date = e.date || 'Unknown Date';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  // Pager renderer (used at top + bottom)
  const renderPager = () => {
    let p = '<div class="chr-pager">';
    p += `<button class="chr-pager-btn" ${window._chroniclePage === 0 ? 'disabled' : ''} onclick="chronicleGoToPage(${window._chroniclePage - 1})">&laquo; Prev</button>`;
    p += `<span class="chr-pager-info">Page <b>${window._chroniclePage + 1}</b> of <b>${totalPages}</b> &middot; <span class="chr-pager-range">${startIdx + 1}&ndash;${Math.min(startIdx + PAGE_SIZE, totalEvents)}</span> of ${totalEvents.toLocaleString()} events</span>`;
    p += `<button class="chr-pager-btn" ${window._chroniclePage >= totalPages - 1 ? 'disabled' : ''} onclick="chronicleGoToPage(${window._chroniclePage + 1})">Next &raquo;</button>`;
    p += '</div>';
    return p;
  };

  let html = '';
  html += renderPager();
  html += '<div class="chronicle">';
  let eventIdx = 0;
  Object.entries(grouped).forEach(([date, events]) => {
    html += `<div class="chr-date-header">
      <span class="chr-date-text">${esc(date)}</span>
      <span class="chr-date-count">${events.length} event${events.length > 1 ? 's' : ''}</span>
      <div class="chr-date-divider"></div>
    </div>`;
    events.forEach(e => {
      const meta = getEventMeta(e.text);
      const stagger = Math.min(eventIdx % 8 + 1, 8);
      const delay = Math.min(eventIdx * 0.04, 0.4);
      html += `<div class="event fade-in stagger-${stagger}" data-tag="${meta.tag}" style="animation-delay:${delay}s;--evt-color:${meta.color};--evt-r:${meta.r};--evt-g:${meta.g};--evt-b:${meta.b}">
        <div class="event-icon" style="border-color:${meta.color};color:${meta.color};box-shadow:0 0 10px ${meta.color}30">${meta.icon}</div>
        <div class="event-card">
          <div class="event-header">
            <span class="event-tag" style="background:${meta.color}15;color:${meta.color};border-color:${meta.color}30">${meta.label}</span>
            ${e.entityId ? entityBadge(e.entityId) : ''}
          </div>
          <div class="text">${textToHtml(e.text)}</div>
        </div>
      </div>`;
      eventIdx++;
    });
  });
  html += '</div>';
  html += renderPager();
  list.innerHTML = html;
  // Update the total count to reflect deduped value
  setEl('chronicle-total', dedupedChronicle.length);
  _lastChronicleCount = dedupedChronicle.length;

  return dedupedChronicle;
}

// ── API Docs ──
window._apiFilter = 'all';
window._apiSearch = '';
function setApiFilter(f) { _apiFilter = f; renderApiDocs(); }
function setApiSearch(v) { _apiSearch = (v||'').toLowerCase(); renderApiDocs(); }

function copyToClipboard(text, label) {
  try {
    navigator.clipboard.writeText(text);
    showToast((label || 'Copied') + ': ' + text.slice(0, 50));
  } catch(e) { showToast('Copy failed', true); }
}

function copyAsCurl(method, path) {
  const url = 'http://127.0.0.1:8080' + path;
  let cmd = `curl -X ${method} "${url}"`;
  if (method !== 'GET') cmd += ' -H "Content-Type: application/json" -d \'{}\'';
  copyToClipboard(cmd, 'cURL');
}

async function tryApiEndpoint(method, path) {
  const overlay = document.getElementById('apiTryitOverlay');
  const methodEl = document.getElementById('apiTryitMethod');
  const pathEl = document.getElementById('apiTryitPath');
  const statusEl = document.getElementById('apiTryitStatus');
  const bodyEl = document.getElementById('apiTryitBody');
  if (!overlay) return;
  methodEl.textContent = method;
  methodEl.className = 'api-method api-m-' + method.toLowerCase();
  pathEl.textContent = path;
  statusEl.innerHTML = '<span class="api-baseurl-blip"></span> requesting...';
  bodyEl.innerHTML = '<span style="color:#7c6840">// Sending request...</span>';
  overlay.classList.add('open');
  const t0 = performance.now();
  try {
    const r = await fetch('http://127.0.0.1:8080' + path, { method });
    const t1 = performance.now();
    const text = await r.text();
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch(e) {}
    const okClass = r.ok ? 'live' : '';
    statusEl.innerHTML = `<span class="api-baseurl-blip ${okClass}"></span><span>HTTP <b style="color:${r.ok?'#7ac070':'#e08060'}">${r.status} ${r.statusText}</b></span><span>${(t1-t0).toFixed(0)}ms</span><span>${text.length.toLocaleString()} bytes</span>`;
    bodyEl.textContent = pretty.length > 50000 ? pretty.slice(0, 50000) + '\n\n... (truncated)' : pretty;
  } catch (e) {
    statusEl.innerHTML = '<span class="api-baseurl-blip"></span><span class="err">Failed</span>';
    bodyEl.innerHTML = '<span class="err">// Error: ' + esc(String(e)) + '</span>';
  }
}

function downloadPostmanCollection() {
  const collection = {
    info: { name: 'EEWebExtension API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [],
  };
  _apiAllEndpoints.forEach(group => {
    const groupItem = { name: group.group, item: [] };
    group.items.forEach(it => {
      groupItem.item.push({
        name: it.p,
        request: {
          method: it.m,
          header: it.m !== 'GET' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
          body: it.m !== 'GET' ? { mode: 'raw', raw: '{}' } : undefined,
          url: { raw: 'http://127.0.0.1:8080' + it.p, host: ['127.0.0.1'], port: '8080', path: it.p.split('/').filter(x=>x) },
          description: it.d,
        },
      });
    });
    collection.item.push(groupItem);
  });
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'eewebextension.postman_collection.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Postman collection downloaded');
}

// Animated terminal cycling through endpoint paths
window._apiTerminalIdx = 0;
window._apiTerminalTimer = null;
function startApiTerminal() {
  if (_apiTerminalTimer) return;
  const advance = () => {
    const term = document.getElementById('apiTerminalCmd');
    if (!term) { clearInterval(_apiTerminalTimer); _apiTerminalTimer = null; return; }
    const allPaths = _apiAllEndpoints.flatMap(g => g.items.map(i => i.m + ' ' + i.p));
    const next = allPaths[_apiTerminalIdx % allPaths.length];
    _apiTerminalIdx++;
    // Type effect
    let i = 0;
    term.textContent = '';
    const typer = setInterval(() => {
      term.textContent = next.slice(0, ++i);
      if (i >= next.length) clearInterval(typer);
    }, 22);
  };
  advance();
  _apiTerminalTimer = setInterval(advance, 3500);
}

window._apiAllEndpoints = null;

function renderApiDocs() {
  const el = document.getElementById('apiDocsBody');
  if (!el) return;
  const endpoints = [
    { group: 'Game State', items: [
      { m: 'GET', p: '/api/status', d: 'Connection & campaign status' },
      { m: 'GET', p: '/api/player/overview', d: 'Player hero, party, clan, kingdom summary' },
      { m: 'GET', p: '/api/player/character', d: 'Hero details, stats, skills, attributes' },
      { m: 'GET', p: '/api/player/equipment', d: 'Battle / civilian gear' },
      { m: 'GET', p: '/api/player/clan', d: 'Clan members, parties, fiefs, wars' },
      { m: 'GET', p: '/api/player/kingdom', d: 'Kingdom clans, fiefs, policies, armies' },
      { m: 'GET', p: '/api/player/settlements', d: 'All settlements owned by player' },
    ]},
    { group: 'Entities', items: [
      { m: 'GET', p: '/api/heroes', d: 'All heroes with IDs, names, portraits' },
      { m: 'GET', p: '/api/hero/{id}', d: 'Full hero detail (lore, journal, timeline, family)' },
      { m: 'GET', p: '/api/clans', d: 'All clans' },
      { m: 'GET', p: '/api/kingdoms', d: 'All kingdoms' },
      { m: 'GET', p: '/api/settlements', d: 'All settlements' },
      { m: 'GET', p: '/api/settlement/{id}', d: 'Settlement detail' },
      { m: 'GET', p: '/api/settlement/fiefdetail/{id}', d: 'Fief stats, notables, buildings, garrison' },
    ]},
    { group: 'Map', items: [
      { m: 'GET', p: '/api/map', d: 'Live campaign map: settlements, parties, kingdoms, wars, bounds' },
    ]},
    { group: 'Journal / Chronicle / Lore', items: [
      { m: 'GET', p: '/api/chronicle', d: 'All auto-logged campaign events (deduped)' },
      { m: 'GET', p: '/api/entity/{id}/journal', d: 'Journal entries for entity' },
      { m: 'POST', p: '/api/entity/{id}/journal', d: 'Add journal entry (body: text)' },
      { m: 'PUT', p: '/api/entity/{id}/journal', d: 'Replace full journal' },
      { m: 'DELETE', p: '/api/entity/{id}/journal', d: 'Clear journal' },
      { m: 'DELETE', p: '/api/entity/{id}/journal/{index}', d: 'Remove single entry by index' },
      { m: 'GET', p: '/api/descriptions', d: 'All custom descriptions' },
      { m: 'GET', p: '/api/relation-notes', d: 'All relation notes' },
      { m: 'GET', p: '/api/relation-note/{heroId}/{targetId}', d: 'Single relation note' },
      { m: 'PUT', p: '/api/relation-note/{heroId}/{targetId}', d: 'Set relation note' },
    ]},
    { group: 'Kingdom Actions', items: [
      { m: 'POST', p: '/api/kingdom/abdicate', d: 'Abdicate leadership' },
      { m: 'POST', p: '/api/kingdom/rename', d: 'Rename kingdom (body: name)' },
      { m: 'POST', p: '/api/kingdom/supportclan', d: 'Spend influence to support a clan (body: clanId)' },
      { m: 'POST', p: '/api/kingdom/expelclan', d: 'Propose expelling a clan (body: clanId)' },
      { m: 'POST', p: '/api/kingdom/changepolicy', d: 'Enact / abolish a policy (body: policyId)' },
      { m: 'POST', p: '/api/kingdom/diplomacy', d: 'Declare war / make peace / alliance / trade (body: action, targetKingdomId)' },
      { m: 'GET', p: '/api/kingdom/availableparties', d: 'Parties available to invite to an army' },
      { m: 'POST', p: '/api/kingdom/createarmy', d: 'Form an army (body: targetSettlementId, partyIds)' },
    ]},
    { group: 'Settlement Actions', items: [
      { m: 'POST', p: '/api/settlement/sendmember', d: 'Send a clan member to a settlement (body: settlementId, heroId)' },
      { m: 'POST', p: '/api/settlement/setgovernor', d: 'Assign governor (body: settlementId, heroId)' },
      { m: 'POST', p: '/api/settlement/setwagelimit', d: 'Set garrison wage limit (body: settlementId, limit)' },
      { m: 'POST', p: '/api/settlement/gift', d: 'Gift settlement to another clan (body: settlementId, clanId)' },
      { m: 'POST', p: '/api/settlement/setproject', d: 'Set building project (body: settlementId, buildingIndex)' },
    ]},
    { group: 'Player Actions', items: [
      { m: 'POST', p: '/api/player/travel', d: 'Move player party to settlement (body: settlementId)' },
      { m: 'POST', p: '/api/player/notifications', d: 'Get derived notifications (wars, low loyalty, etc)' },
      { m: 'GET', p: '/api/player/traderoutes', d: 'Best buy/sell trade pairs for common items' },
    ]},
  ];
  _apiAllEndpoints = endpoints;

  // Counts
  const allItems = endpoints.flatMap(g => g.items);
  const counts = { all:allItems.length, GET:0, POST:0, PUT:0, DELETE:0 };
  allItems.forEach(it => counts[it.m] = (counts[it.m]||0) + 1);

  let html = '';

  // Animated terminal
  html += '<div class="api-terminal"><br><span class="api-terminal-prompt">$</span><span class="api-terminal-cmd" id="apiTerminalCmd"></span><span class="api-terminal-cursor"></span></div>';

  // Live base URL bar with reachability blip
  const ok = Store.connected;
  html += `<div class="api-baseurl-bar">
    <span class="api-baseurl-blip ${ok?'live':''}"></span>
    <span style="font-family:Cinzel,serif;font-size:10px;color:#9a8260;letter-spacing:1.5px;text-transform:uppercase">Base URL</span>
    <span class="api-baseurl-text">http://127.0.0.1:8080</span>
    <button class="api-copy-btn" onclick="copyToClipboard('http://127.0.0.1:8080','URL')">&#x2398; Copy</button>
    <span style="font-family:Cinzel,serif;font-size:9px;color:${ok?'#7ac070':'#a15b5b'};letter-spacing:1px;text-transform:uppercase">${ok?'\u25CF Online':'\u25CF Offline'}</span>
  </div>`;

  // Summary counters
  html += '<div class="api-summary">';
  html += `<div class="api-summary-card"><b class="api-summary-num">${counts.all}</b><span class="api-summary-lbl">Total Endpoints</span></div>`;
  html += `<div class="api-summary-card get"><b class="api-summary-num">${counts.GET||0}</b><span class="api-summary-lbl">GET (Read)</span></div>`;
  html += `<div class="api-summary-card post"><b class="api-summary-num">${counts.POST||0}</b><span class="api-summary-lbl">POST (Action)</span></div>`;
  html += `<div class="api-summary-card put"><b class="api-summary-num">${counts.PUT||0}</b><span class="api-summary-lbl">PUT (Update)</span></div>`;
  html += `<div class="api-summary-card delete"><b class="api-summary-num">${counts.DELETE||0}</b><span class="api-summary-lbl">DELETE (Remove)</span></div>`;
  html += '</div>';

  // Filter chips
  html += '<div class="api-filter-row">';
  ['all','GET','POST','PUT','DELETE'].forEach(f => {
    const cls = f === 'all' ? '' : f.toLowerCase();
    html += `<button class="api-filter-chip ${cls} ${_apiFilter===f?'active':''}" onclick="setApiFilter('${f}')">${f === 'all' ? 'All' : f}</button>`;
  });
  html += '</div>';

  // Search + toolbar
  html += '<div class="api-search-row">';
  html += `<input class="api-search-input" type="text" placeholder="&#x1F50D; Search path or description..." value="${esc(_apiSearch)}" oninput="setApiSearch(this.value)">`;
  html += '<button class="stats-tool-btn" onclick="downloadPostmanCollection()">&#x1F4E5; Postman JSON</button>';
  html += '<button class="stats-tool-btn" onclick="renderApiDocs()">&#x1F504; Refresh</button>';
  html += '</div>';

  // Filter helpers
  const matches = (it) => {
    if (_apiFilter !== 'all' && it.m !== _apiFilter) return false;
    if (_apiSearch && !(it.p.toLowerCase().includes(_apiSearch) || it.d.toLowerCase().includes(_apiSearch))) return false;
    return true;
  };

  // Layout: rail + main
  html += '<div class="api-layout">';

  // Rail
  html += '<aside class="api-rail">';
  endpoints.forEach((group, i) => {
    const groupCount = group.items.filter(matches).length;
    if (groupCount === 0) return;
    html += `<a href="#api-grp-${i}" class="api-rail-link" onclick="event.preventDefault();document.getElementById('api-grp-${i}')?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.api-rail-link').forEach(x=>x.classList.remove('active'));this.classList.add('active')">
      <span>${esc(group.group)}</span>
      <span class="api-rail-count">${groupCount}</span>
    </a>`;
  });
  html += '</aside>';

  // Main
  html += '<div class="api-main">';
  let totalShown = 0;
  endpoints.forEach((group, gIdx) => {
    const items = group.items.filter(matches);
    if (items.length === 0) return;
    html += `<div class="api-group" id="api-grp-${gIdx}"><h3>${esc(group.group)}</h3>`;
    items.forEach((it, idx) => {
      const mClass = it.m === 'GET' ? 'api-m-get' : it.m === 'POST' ? 'api-m-post' : it.m === 'PUT' ? 'api-m-put' : 'api-m-delete';
      const canTry = it.m === 'GET' && !it.p.includes('{');
      html += `<div class="api-endpoint" style="animation-delay:${Math.min(idx*0.03,0.6)}s">
        <span class="api-method ${mClass}">${it.m}</span>
        <code class="api-path">${esc(it.p)}</code>
        <span class="api-desc">${esc(it.d)}</span>
        <div class="api-endpoint-actions">
          ${canTry ? `<button class="api-act-btn api-act-tryit" onclick="event.stopPropagation();tryApiEndpoint('${it.m}','${esc(it.p)}')">&#x25B6; Try It</button>` : ''}
          <button class="api-act-btn" onclick="event.stopPropagation();copyToClipboard('http://127.0.0.1:8080${esc(it.p)}','URL')">&#x2398; URL</button>
          <button class="api-act-btn" onclick="event.stopPropagation();copyAsCurl('${it.m}','${esc(it.p)}')">&#x2398; cURL</button>
        </div>
      </div>`;
      totalShown++;
    });
    html += '</div>';
  });
  if (totalShown === 0) {
    html += '<div class="cpr-empty">No endpoints match the current filter or search.</div>';
  }
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;

  // Start animated terminal
  startApiTerminal();
}

// ── Hero Family Tree ──
function openFamilyTree(heroId) {
  const overlay = document.getElementById('familyTreeOverlay');
  const canvas = document.getElementById('familyTreeCanvas');
  const title = document.getElementById('familyTreeTitle');
  if (!overlay || !canvas) return;
  const hero = (Store.heroes||[]).find(h => h.id === heroId);
  if (!hero) { showToast('Hero not found', true); return; }

  overlay.classList.add('open');
  title.textContent = 'Family Tree — ' + hero.name;
  canvas.innerHTML = '<div class="loading-spinner"></div>';

  API.getHero(heroId).then(detail => {
    if (!detail) { canvas.innerHTML = '<div class="empty">No family data</div>'; return; }
    renderFamilyTreeGraph(canvas, hero, detail);
  }).catch(() => { canvas.innerHTML = '<div class="empty">Failed to load</div>'; });
}

function renderFamilyTreeGraph(canvas, rootHero, detail) {
  const family = detail.family || [];
  const parents = family.filter(f => /mother|father/i.test(f.relation));
  const spouse = family.filter(f => /spouse|husband|wife/i.test(f.relation));
  const children = family.filter(f => /son|daughter|child/i.test(f.relation));
  const siblings = family.filter(f => /brother|sister|sibling/i.test(f.relation));

  // Layout — 5 rows: parents / siblings+root+spouse / children
  const W = 1000, H = 600;
  const cx = W / 2, cy = H / 2;
  const nodes = [];
  // Parents row (y = 80)
  parents.forEach((p, i) => {
    const x = cx + (i - (parents.length - 1) / 2) * 220;
    nodes.push({ ...p, x, y: 80, role: 'parent' });
  });
  // Siblings (left of root)
  siblings.forEach((s, i) => {
    nodes.push({ ...s, x: cx - 220 - i * 180, y: cy, role: 'sibling' });
  });
  // Root (center)
  nodes.push({ id: rootHero.id, name: rootHero.name, relation: 'Self', x: cx, y: cy, role: 'root', isRoot: true });
  // Spouse (right)
  spouse.forEach((s, i) => {
    nodes.push({ ...s, x: cx + 220 + i * 200, y: cy, role: 'spouse' });
  });
  // Children (y = 440)
  children.forEach((c, i) => {
    const x = cx + (i - (children.length - 1) / 2) * 180;
    nodes.push({ ...c, x, y: 440, role: 'child' });
  });

  // Render SVG
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;
  // Edges — root to parents, siblings, spouse, children
  const rootNode = nodes.find(n => n.isRoot);
  nodes.forEach(n => {
    if (n.isRoot) return;
    const dx = (n.x + rootNode.x) / 2;
    // Soft curve
    svg += `<path d="M${rootNode.x},${rootNode.y} Q${dx},${(rootNode.y+n.y)/2} ${n.x},${n.y}" fill="none" stroke="rgba(212,184,120,.45)" stroke-width="2" stroke-dasharray="4,3"/>`;
  });
  // Nodes — use portraits clipped to a circle
  // Define clip paths for each node
  let defs = '<defs>';
  nodes.forEach((n, i) => {
    const r = n.isRoot ? 42 : 32;
    defs += `<clipPath id="ftClip${i}"><circle cx="${n.x}" cy="${n.y}" r="${r-3}"/></clipPath>`;
  });
  defs += '</defs>';
  svg = svg.replace('<svg', defs + '<svg').replace(defs+'<svg', '<svg'); // move defs inside
  // Actually simpler: prepend defs inside the svg
  let svgBody = '';
  svgBody += defs;
  // Re-render edges
  const rootNode2 = nodes.find(n => n.isRoot);
  nodes.forEach(n => {
    if (n.isRoot) return;
    const dx = (n.x + rootNode2.x) / 2;
    svgBody += `<path d="M${rootNode2.x},${rootNode2.y} Q${dx},${(rootNode2.y+n.y)/2} ${n.x},${n.y}" fill="none" stroke="rgba(212,184,120,.45)" stroke-width="2" stroke-dasharray="4,3"/>`;
  });
  nodes.forEach((n, i) => {
    const isDead = n.dead;
    const r = n.isRoot ? 42 : 32;
    const stroke = n.isRoot ? '#ffd878' : isDead ? '#6a5030' : '#c8a868';
    const strokeW = n.isRoot ? 4 : 2;
    // Lookup hero in Store to get portrait
    const heroItem = (Store.heroes||[]).find(h => h.id === n.id);
    const portraitSrc = heroItem ? getPortraitSrc(heroItem, heroItem) : 'Hero/bannerlord_hero_viking.png';
    svgBody += `<g class="ft-node" data-id="${esc(n.id||'')}" style="cursor:${n.id?'pointer':'default'}">`;
    // Background circle (in case portrait fails to load)
    svgBody += `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="#2a1e10" stroke="${stroke}" stroke-width="${strokeW}"/>`;
    // Portrait image clipped to circle
    svgBody += `<image href="${portraitSrc}" x="${n.x-r+3}" y="${n.y-r+3}" width="${(r-3)*2}" height="${(r-3)*2}" clip-path="url(#ftClip${i})" preserveAspectRatio="xMidYMid slice" ${isDead?'opacity="0.5"':''} onerror="this.remove()"/>`;
    // Gold rim on top
    svgBody += `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${strokeW}"/>`;
    // Crown for root
    if (n.isRoot) {
      svgBody += `<text x="${n.x}" y="${n.y-r-4}" text-anchor="middle" font-size="18" stroke="#000" stroke-width="0.5" paint-order="stroke">&#x1F451;</text>`;
    }
    // Name below
    svgBody += `<text x="${n.x}" y="${n.y+r+16}" text-anchor="middle" font-family="Cinzel,serif" font-size="${n.isRoot?13:11}" fill="#e8d8b8" stroke="#000" stroke-width="0.4" paint-order="stroke">${esc(n.name||'Unknown')}</text>`;
    if (!n.isRoot) {
      svgBody += `<text x="${n.x}" y="${n.y+r+30}" text-anchor="middle" font-family="Cinzel,serif" font-size="9" fill="#9a8260">${esc(n.relation||'')}</text>`;
    }
    svgBody += `</g>`;
  });
  // Replace svg with rebuilt one
  svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">${svgBody}</svg>`;
  canvas.innerHTML = svg;
  canvas.querySelectorAll('.ft-node').forEach(n => {
    n.addEventListener('click', () => {
      const id = n.dataset.id;
      if (!id || id === rootHero.id) return;
      openFamilyTree(id);
    });
  });
  return;
  svg += '</svg>';
  canvas.innerHTML = svg;
  // Click to re-root
  canvas.querySelectorAll('.ft-node').forEach(n => {
    n.addEventListener('click', () => {
      const id = n.dataset.id;
      if (!id || id === rootHero.id) return;
      openFamilyTree(id);
    });
  });
}

function chronicleGoToPage(page) {
  window._chroniclePage = page;
  // Scroll to top of the chronicle list before re-rendering
  const list = document.getElementById('chronicle-list');
  if (list) list.scrollIntoView({behavior: 'smooth', block: 'start'});
  renderChronicle();
}

// ── Live Campaign Map ──
window._mapState = {
  data: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  showParties: true,
  showVillages: true,
  showLabels: true,
  liveRefreshEnabled: true,
  liveRefreshTimer: null,
  hiddenKingdoms: new Set(),
  heatmapMode: 'none',
  measureMode: false,
  measurePoints: [],
  prevPartyPositions: {},
  partyTweenStart: 0,
  selectedParties: new Set()
};

function uintToHex(u) {
  if (typeof u !== 'number') return '#888';
  // Bannerlord stores ARGB in a uint, we want #RRGGBB
  const r = (u >> 16) & 0xFF;
  const g = (u >> 8) & 0xFF;
  const b = u & 0xFF;
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function renderMap(silent) {
  const svg = document.getElementById('mapSvg');
  const stage = document.getElementById('mapStage');
  if (!svg || !stage) return;

  if (!silent) svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9a8260" font-family="Cinzel,serif" font-size="14">Loading Calradia&hellip;</text>';

  const data = await API.getMap();
  if (!data || data.error) {
    if (!silent) svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#c08060" font-family="Cinzel,serif" font-size="14">Map data unavailable</text>';
    return;
  }
  // Save previous party positions for interpolation
  if (window._mapState.data) {
    window._mapState.prevPartyPositions = {};
    (window._mapState.data.parties||[]).forEach(p => {
      window._mapState.prevPartyPositions[p.id] = {x: p.x, y: p.y};
    });
    window._mapState.partyTweenStart = performance.now();
  }
  window._mapState.data = data;
  drawMap();
  buildKingdomLegend();
  _mapUpdateCartouche(data);
  _mapUpdateDayNight(data);
  _mapUpdateReadout();
  // Animate party movement over 1.5s
  if (silent) animatePartyTween();
  if (!silent && window._mapState.zoom === 1 && window._mapState.panX === 0) mapFitToView();
}

// Update the top-center title cartouche with current game date + season
function _mapUpdateCartouche(data) {
  const dateEl = document.getElementById('mapCartoucheDate');
  const titleEl = document.getElementById('mapCartoucheTitle');
  if (!dateEl) return;
  const date = data?.gameDate || data?.date || '';
  const season = data?.season || '';
  const year = data?.gameYear || '';
  const parts = [];
  if (date) parts.push(date);
  else if (year) parts.push('Year ' + year);
  if (season) parts.push(season);
  dateEl.innerHTML = parts.length ? parts.join(' &middot; ') : '&middot; The Age of Strife &middot;';
  if (titleEl) {
    const dom = data?.playerKingdom || data?.dominantKingdom || '';
    titleEl.textContent = dom ? 'CALRADIA \u2014 ' + dom.toUpperCase() : 'CALRADIA';
  }
}

// Apply a day/night tint overlay from game hour
function _mapUpdateDayNight(data) {
  const el = document.getElementById('mapDayNight');
  if (!el) return;
  const hour = typeof data?.gameHour === 'number' ? data.gameHour : -1;
  if (hour < 0) { el.style.opacity = 0; return; }
  // 0 = midnight (full dark), 12 = noon (full light)
  let tint, op;
  if (hour >= 20 || hour < 5)      { tint = 'rgba(10,14,40,.55)'; op = .72; }  // night
  else if (hour < 7)                { tint = 'rgba(210,120,50,.28)'; op = .45; } // dawn
  else if (hour < 17)               { tint = 'transparent'; op = 0; }            // day
  else if (hour < 20)               { tint = 'rgba(220,110,40,.32)'; op = .5; }  // dusk
  el.style.background = `radial-gradient(ellipse at center,transparent 20%,${tint} 85%)`;
  el.style.opacity = op;
}

function _mapUpdateReadout() {
  const zEl = document.getElementById('mrZoom');
  if (zEl) zEl.textContent = Math.round((window._mapState?.zoom || 1) * 100) + '%';
}

function animatePartyTween() {
  const DURATION = 1500;
  const step = () => {
    const elapsed = performance.now() - window._mapState.partyTweenStart;
    const t = Math.min(1, elapsed / DURATION);
    drawMap();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Smooth pan/zoom tween
function mapTweenTo(targetZoom, targetPanX, targetPanY, duration) {
  duration = duration || 500;
  const startZoom = window._mapState.zoom;
  const startPanX = window._mapState.panX;
  const startPanY = window._mapState.panY;
  const startTime = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3); // ease-out cubic
  const step = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    const e = ease(t);
    window._mapState.zoom = startZoom + (targetZoom - startZoom) * e;
    window._mapState.panX = startPanX + (targetPanX - startPanX) * e;
    window._mapState.panY = startPanY + (targetPanY - startPanY) * e;
    drawMap();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function buildKingdomLegend() {
  const el = document.getElementById('mapKingdomLegend');
  if (!el) return;
  const data = window._mapState.data;
  if (!data) return;
  let html = '<div class="map-legend-title">Kingdoms</div>';
  (data.kingdoms||[]).forEach(k => {
    const color = uintToHex(k.primaryColor);
    const hidden = window._mapState.hiddenKingdoms.has(k.id);
    html += `<div class="map-legend-item${hidden ? ' hidden' : ''}" data-id="${k.id}">`;
    html += `<span class="map-legend-swatch" style="background:${color}"></span>`;
    html += `<span class="map-legend-name">${esc(k.name)}${k.isPlayer ? ' &#x1F451;' : ''}</span>`;
    html += `</div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.map-legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      if (window._mapState.hiddenKingdoms.has(id)) window._mapState.hiddenKingdoms.delete(id);
      else window._mapState.hiddenKingdoms.add(id);
      item.classList.toggle('hidden');
      drawMap();
    });
  });
}

function centerOnPlayer() {
  const data = window._mapState.data;
  const player = (data?.parties||[]).find(p => p.isPlayer);
  if (!player) { showToast('Player not found', true); return; }
  centerOnSettlement({x: player.x, y: player.y}, 2.5);
}

function mapSearchHandler(ev) {
  const q = (ev.target.value || '').trim().toLowerCase();
  const resultsEl = document.getElementById('mapSearchResults');
  if (!resultsEl) return;
  if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
  const data = window._mapState.data;
  if (!data) return;
  const matches = (data.settlements||[]).filter(s => s.name.toLowerCase().includes(q)).slice(0, 10);
  if (!matches.length) { resultsEl.style.display = 'none'; return; }
  let html = '';
  matches.forEach(s => {
    const icon = s.type === 'Town' ? '&#x1F3D8;' : s.type === 'Castle' ? '&#x1F3F0;' : '&#x1F33E;';
    html += `<div class="map-search-result" data-id="${s.id}">${icon} ${esc(s.name)}<span class="map-search-meta">${esc(s.type)} &middot; ${esc(s.kingdomName||'')}</span></div>`;
  });
  resultsEl.innerHTML = html;
  resultsEl.style.display = 'block';
  resultsEl.querySelectorAll('.map-search-result').forEach(r => {
    r.addEventListener('click', () => {
      const s = matches.find(m => m.id === r.dataset.id);
      if (!s) return;
      centerOnSettlement(s);
      resultsEl.style.display = 'none';
      document.getElementById('mapSearch').value = '';
    });
  });
}

function centerOnSettlement(s, zoomLevel) {
  const stage = document.getElementById('mapStage');
  if (!stage) return;
  const sW = stage.clientWidth || 800;
  const sH = stage.clientHeight || 600;
  const data = window._mapState.data;
  const b = data.bounds;
  const IMG_W = 3222, IMG_H = 2880;
  const imgAspect = IMG_W / IMG_H;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const sw = Math.max(1, b.maxX - b.minX);
  const sh = Math.max(1, b.maxY - b.minY);
  const PAD = 1.15;
  let wW, wH;
  if (sw / sh > imgAspect) { wW = sw * PAD; wH = wW / imgAspect; }
  else { wH = sh * PAD; wW = wH * imgAspect; }
  const minX = cx - wW / 2, minY = cy - wH / 2;
  const nx = (s.x - minX) / wW;
  const ny = 1 - (s.y - minY) / wH;
  const targetZoom = zoomLevel || 3;
  const targetPanX = sW / 2 - nx * sW * targetZoom;
  const targetPanY = sH / 2 - ny * sH * targetZoom;
  mapTweenTo(targetZoom, targetPanX, targetPanY, 700);
}

// Expand a convex hull outward from centroid by `pad` pixels, with noise for natural coastline
function continentHull(points, pad) {
  if (points.length < 3) return points;
  // Convex hull via monotone chain
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const hull = lower.concat(upper);
  // Expand outward from centroid with noise
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p, i) => {
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const noise = 0.85 + 0.3 * Math.sin(i * 2.7);
    return {
      x: p.x + (dx / d) * pad * noise,
      y: p.y + (dy / d) * pad * noise
    };
  });
}

// Smooth a polygon into a closed path using quadratic beziers
function smoothPath(points) {
  if (points.length === 0) return '';
  const n = points.length;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const next = points[(i + 1) % n];
    const mx = (p.x + next.x) / 2;
    const my = (p.y + next.y) / 2;
    d += ` Q${p.x},${p.y} ${mx},${my}`;
  }
  d += ' Z';
  return d;
}

function drawMap() {
  const svg = document.getElementById('mapSvg');
  const stage = document.getElementById('mapStage');
  if (!svg || !stage) return;
  const data = window._mapState.data;
  if (!data) return;

  const stageW = stage.clientWidth || 800;
  const stageH = stage.clientHeight || 600;
  svg.setAttribute('width', stageW);
  svg.setAttribute('height', stageH);

  // IMPORTANT: never mutate data.bounds — it's the shared data object and
  // mutations persist across redraws, causing exponential zoom drift.
  const rawB = data.bounds || {minX:0,minY:0,maxX:1000,maxY:1000};
  // Expand world bounds to match the image aspect ratio (3222x2880 = 1.1188).
  const IMG_W = 3222, IMG_H = 2880;
  const imgAspect = IMG_W / IMG_H;
  const settlementCx = (rawB.minX + rawB.maxX) / 2;
  const settlementCy = (rawB.minY + rawB.maxY) / 2;
  const settlementW = Math.max(1, rawB.maxX - rawB.minX);
  const settlementH = Math.max(1, rawB.maxY - rawB.minY);
  // Image extends ~15% beyond settlements on each side for ocean/terrain margin
  const PAD_FACTOR = 1.15;
  let worldW, worldH;
  const settlementAspect = settlementW / settlementH;
  if (settlementAspect > imgAspect) {
    worldW = settlementW * PAD_FACTOR;
    worldH = worldW / imgAspect;
  } else {
    worldH = settlementH * PAD_FACTOR;
    worldW = worldH * imgAspect;
  }
  // Fresh local bounds (do NOT mutate rawB)
  const b = {
    minX: settlementCx - worldW / 2,
    minY: settlementCy - worldH / 2,
    maxX: settlementCx + worldW / 2,
    maxY: settlementCy + worldH / 2
  };
  // Bannerlord Y increases northward, SVG Y increases downward — flip
  function project(x, y) {
    const nx = (x - b.minX) / worldW;
    const ny = 1 - (y - b.minY) / worldH;
    return {
      x: nx * stageW * window._mapState.zoom + window._mapState.panX,
      y: ny * stageH * window._mapState.zoom + window._mapState.panY
    };
  }
  // Expose for click handlers
  window._mapState.project = project;

  // Build kingdom color lookup
  const kingdomColors = {};
  (data.kingdoms||[]).forEach(k => {
    kingdomColors[k.id] = uintToHex(k.primaryColor);
  });

  let svgInner = '';

  // Background — parchment + ambient noise + Calradia vignette
  svgInner += '<defs>';
  svgInner += '<radialGradient id="mapBg" cx="50%" cy="50%" r="75%">';
  svgInner += '<stop offset="0%" stop-color="#2a2218"/>';
  svgInner += '<stop offset="40%" stop-color="#1c1610"/>';
  svgInner += '<stop offset="80%" stop-color="#0e0a06"/>';
  svgInner += '<stop offset="100%" stop-color="#050402"/>';
  svgInner += '</radialGradient>';
  // Parchment noise pattern
  svgInner += '<filter id="mapNoise" x="0" y="0" width="100%" height="100%">';
  svgInner += '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>';
  svgInner += '<feColorMatrix type="matrix" values="0 0 0 0 0.55, 0 0 0 0 0.42, 0 0 0 0 0.18, 0 0 0 0.08 0"/>';
  svgInner += '</filter>';
  // Heavy blur for kingdom border glow
  svgInner += '<filter id="mapBlur" x="-50%" y="-50%" width="200%" height="200%">';
  svgInner += '<feGaussianBlur stdDeviation="14"/>';
  svgInner += '</filter>';
  svgInner += '<filter id="mapBlurSoft" x="-50%" y="-50%" width="200%" height="200%">';
  svgInner += '<feGaussianBlur stdDeviation="6"/>';
  svgInner += '</filter>';
  // Land texture pattern — tan diagonal hatching
  svgInner += '<pattern id="landTex" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">';
  svgInner += '<path d="M0,16 L16,0" stroke="#6a5430" stroke-width="0.5" stroke-opacity="0.5"/>';
  svgInner += '<path d="M-4,4 L4,-4" stroke="#6a5430" stroke-width="0.5" stroke-opacity="0.5"/>';
  svgInner += '<path d="M12,20 L20,12" stroke="#6a5430" stroke-width="0.5" stroke-opacity="0.5"/>';
  svgInner += '</pattern>';
  svgInner += '</defs>';
  svgInner += '<rect width="100%" height="100%" fill="url(#mapBg)"/>';
  // Real Calradia map image — calibration stored as FRACTION OF STAGE so it works at any window size
  {
    const cal = window._mapCalibration || {ox:0, oy:0, sx:1, sy:1};
    const z = window._mapState.zoom;
    const tl = project(b.minX, b.maxY);
    const br = project(b.maxX, b.minY);
    const baseW = br.x - tl.x;
    const baseH = br.y - tl.y;
    const w = baseW * cal.sx;
    const h = baseH * cal.sy;
    // Convert fractional offset to pixels for this stage size
    const cx = (tl.x + br.x) / 2 + cal.ox * stageW * z;
    const cy = (tl.y + br.y) / 2 + cal.oy * stageH * z;
    svgInner += `<image href="Map/caldaria.png" x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" preserveAspectRatio="none" opacity="0.9" onerror="this.remove()"/>`;
  }

  // ── Kingdom borders — convex hull per kingdom, filled with kingdom color, blurred ──
  function convexHull(points) {
    if (points.length < 3) return points;
    const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  // Expand a hull outward from its centroid by `pad` pixels for fluffier borders
  function expandHull(hull, pad) {
    if (hull.length === 0) return hull;
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    return hull.map(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: p.x + (dx / d) * pad, y: p.y + (dy / d) * pad };
    });
  }

  const kingdomGroups = {};
  (data.settlements||[]).forEach(s => {
    if (!s.kingdomId) return;
    if (s.type === 'Hideout') return;
    (kingdomGroups[s.kingdomId] = kingdomGroups[s.kingdomId] || []).push(s);
  });
  // Player kingdom rendered last so it draws on top
  const playerKingdomId = (data.kingdoms||[]).find(k => k.isPlayer)?.id;
  const renderOrder = Object.keys(kingdomGroups).sort((a, b) => {
    if (a === playerKingdomId) return 1;
    if (b === playerKingdomId) return -1;
    return 0;
  });

  for (const kid of renderOrder) {
    const settlements = kingdomGroups[kid];
    const color = kingdomColors[kid] || '#888';
    const isPlayer = kid === playerKingdomId;
    const projected = settlements.map(s => project(s.x, s.y));
    if (projected.length === 1) {
      // Single fief — draw a circle
      svgInner += `<circle cx="${projected[0].x}" cy="${projected[0].y}" r="${50 * window._mapState.zoom}" fill="${color}" fill-opacity="${isPlayer ? 0.18 : 0.12}" filter="url(#mapBlur)"/>`;
    } else if (projected.length === 2) {
      const padR = 60 * window._mapState.zoom;
      projected.forEach(p => {
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${padR}" fill="${color}" fill-opacity="${isPlayer ? 0.18 : 0.12}" filter="url(#mapBlur)"/>`;
      });
    } else {
      const hull = convexHull(projected);
      const expanded = expandHull(hull, 55 * window._mapState.zoom);
      const path = expanded.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ') + ' Z';
      // Outer blur layer
      svgInner += `<path d="${path}" fill="${color}" fill-opacity="${isPlayer ? 0.22 : 0.14}" filter="url(#mapBlur)"/>`;
      // Sharper inner outline
      svgInner += `<path d="${path}" fill="none" stroke="${color}" stroke-width="${isPlayer ? 2.5 : 1.5}" stroke-opacity="${isPlayer ? 0.7 : 0.5}" filter="url(#mapBlurSoft)"/>`;
    }
  }

  const hiddenK = window._mapState.hiddenKingdoms;

  // ── Trade routes — glowing lines from villages to nearest town ──
  if (window._mapState.showTrade) {
    const towns = (data.settlements||[]).filter(s => s.type === 'Town');
    (data.settlements||[]).filter(s => s.type === 'Village').forEach(v => {
      let nearest = null, minD = Infinity;
      towns.forEach(t => {
        const dx = v.x - t.x, dy = v.y - t.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD) { minD = d2; nearest = t; }
      });
      if (!nearest) return;
      const pa = project(v.x, v.y), pb = project(nearest.x, nearest.y);
      svgInner += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#80c060" stroke-width="1" opacity="0.35" stroke-dasharray="4,2"><animate attributeName="stroke-dashoffset" values="0;12" dur="2s" repeatCount="indefinite"/></line>`;
    });
  }

  // ── Roads — dashed tan lines between nearby towns/castles ──
  if (window._mapState.showRoads !== false) {
    const roadPoints = (data.settlements||[]).filter(s => s.type === 'Town' || s.type === 'Castle');
    const ROAD_DIST = 120;
    for (let i = 0; i < roadPoints.length; i++) {
      for (let j = i + 1; j < roadPoints.length; j++) {
        const a = roadPoints[i], b2 = roadPoints[j];
        const dx = a.x - b2.x, dy = a.y - b2.y;
        if (dx * dx + dy * dy > ROAD_DIST * ROAD_DIST) continue;
        const pa = project(a.x, a.y), pb = project(b2.x, b2.y);
        svgInner += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#c8a868" stroke-width="0.9" stroke-dasharray="3,3" opacity="0.3"/>`;
      }
    }
  }

  // ── War arrows — dashed red lines between kingdoms at war ──
  if ((data.wars||[]).length) {
    const kingdomCentroids = {};
    Object.keys(kingdomGroups).forEach(kid => {
      const pts = kingdomGroups[kid].map(s => project(s.x, s.y));
      const cxK = pts.reduce((ss,pp)=>ss+pp.x,0)/pts.length;
      const cyK = pts.reduce((ss,pp)=>ss+pp.y,0)/pts.length;
      kingdomCentroids[kid] = {x:cxK, y:cyK};
    });
    data.wars.forEach(w => {
      const a = kingdomCentroids[w.a];
      const bb = kingdomCentroids[w.b];
      if (!a || !bb) return;
      if (hiddenK.has(w.a) || hiddenK.has(w.b)) return;
      svgInner += `<line x1="${a.x}" y1="${a.y}" x2="${bb.x}" y2="${bb.y}" stroke="#e04020" stroke-width="2" stroke-dasharray="8,4" opacity="0.55" stroke-linecap="round"><animate attributeName="stroke-dashoffset" values="0;24" dur="1.5s" repeatCount="indefinite"/></line>`;
      const mx = (a.x + bb.x) / 2;
      const my = (a.y + bb.y) / 2;
      svgInner += `<circle cx="${mx}" cy="${my}" r="10" fill="rgba(0,0,0,.75)" stroke="#e04020" stroke-width="1.5"/>`;
      svgInner += `<text x="${mx}" y="${my+4}" text-anchor="middle" font-size="12" fill="#e0a080" pointer-events="none">&#x2694;</text>`;
    });
  }

  // ── Settlements ──
  (data.settlements||[]).forEach(s => {
    if (!window._mapState.showVillages && s.type === 'Village') return;
    if (s.kingdomId && hiddenK.has(s.kingdomId)) return; // Kingdom filter
    const p = project(s.x, s.y);
    let color = s.kingdomId ? (kingdomColors[s.kingdomId] || '#888') : '#666';
    // Heatmap overrides color
    const hm = window._mapState.heatmapMode;
    if (hm !== 'none' && (s.type === 'Town' || s.type === 'Castle')) {
      let val = 0, max = 100;
      if (hm === 'prosperity') { val = s.prosperity || 0; max = 12000; }
      else if (hm === 'loyalty') { val = s.loyalty || 50; max = 100; }
      else if (hm === 'security') { val = s.security || 50; max = 100; }
      const norm = Math.max(0, Math.min(1, val / max));
      // Red → yellow → green gradient
      const r2 = Math.round(norm < 0.5 ? 255 : 255 * (1 - (norm - 0.5) * 2));
      const g2 = Math.round(norm < 0.5 ? 255 * (norm * 2) : 255);
      color = `rgb(${r2},${g2},60)`;
    }
    let r = 5;
    let stroke = '#e8c468';
    let fill = color;
    if (s.type === 'Town') { r = 7; }
    else if (s.type === 'Castle') { r = 5.5; }
    else if (s.type === 'Village') { r = 3; stroke = '#9a8260'; }
    else if (s.type === 'Hideout') { r = 3; stroke = '#a04020'; fill = '#3a1810'; }

    // Warning rings — besieged (red pulse), low loyalty (orange), low food (red), raided village (red)
    let warnColor = null;
    if (s.isUnderSiege) warnColor = '#e04020';
    else if (s.isRaided) warnColor = '#e04020';
    else if (s.type === 'Town' || s.type === 'Castle') {
      if ((s.foodStocks !== undefined && s.foodStocks < 0)) warnColor = '#e04020';
      else if (s.loyalty !== undefined && s.loyalty < 30) warnColor = '#e0a040';
      else if (s.security !== undefined && s.security < 20) warnColor = '#e0a040';
    }

    // Player-owned towns get a slow breathing gold glow
    const playerOwned = s.kingdomId && (data.kingdoms||[]).find(k=>k.id===s.kingdomId && k.isPlayer);
    if (s.type === 'Town' || s.type === 'Castle') {
      const halfR = r;
      svgInner += `<g class="map-settlement" data-id="${s.id}" data-type="${s.type}" data-name="${s.name.replace(/"/g,'&quot;')}">`;
      if (playerOwned) {
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r+4}" fill="none" stroke="#e8c468" stroke-width="1.5" opacity="0.5"><animate attributeName="r" values="${r+3};${r+10};${r+3}" dur="4.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.55;0.1;0.55" dur="4.2s" repeatCount="indefinite"/></circle>`;
      }
      if (warnColor) {
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r+5}" fill="none" stroke="${warnColor}" stroke-width="2" opacity="0.8"><animate attributeName="r" values="${r+3};${r+9};${r+3}" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.8s" repeatCount="indefinite"/></circle>`;
      }
      if (s.hasTournament) {
        svgInner += `<circle cx="${p.x+r+6}" cy="${p.y-r-2}" r="8" fill="rgba(0,0,0,.7)" stroke="#e8c468" stroke-width="1.5"/>`;
        svgInner += `<text x="${p.x+r+6}" y="${p.y-r+2}" text-anchor="middle" font-size="12" pointer-events="none">&#x1F3C6;</text>`;
      }
      // Upgraded icons: shield shape for castles, banner-drop for towns
      svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r+2}" fill="rgba(0,0,0,.55)"/>`;
      if (s.type === 'Town') {
        // Banner drop: rectangle with pointed bottom
        const bw = r*1.8, bh = r*2.2;
        svgInner += `<path d="M${p.x-bw/2},${p.y-bh/2} L${p.x+bw/2},${p.y-bh/2} L${p.x+bw/2},${p.y+bh/3} L${p.x},${p.y+bh/2} L${p.x-bw/2},${p.y+bh/3} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
      } else {
        // Castle shield: rounded top, pointed bottom
        const sw = r*1.9, sh = r*2.2;
        svgInner += `<path d="M${p.x-sw/2},${p.y-sh/2} Q${p.x-sw/2},${p.y-sh/2-2} ${p.x},${p.y-sh/2} Q${p.x+sw/2},${p.y-sh/2-2} ${p.x+sw/2},${p.y-sh/2} L${p.x+sw/2},${p.y+sh/4} Q${p.x+sw/2},${p.y+sh/2} ${p.x},${p.y+sh/2} Q${p.x-sw/2},${p.y+sh/2} ${p.x-sw/2},${p.y+sh/4} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
      }
      // Clan banner image above town (if pre-rendered PNG exists)
      if (s.type === 'Town' && s.clanId && Store._bannerImages?.[s.clanId] && window._mapState.zoom > 1.2) {
        const bw = 14, bh = 18;
        svgInner += `<image href="Banners/${encodeURIComponent(s.clanId)}.png" x="${p.x-bw/2}" y="${p.y-r-bh-3}" width="${bw}" height="${bh}" pointer-events="none"/>`;
      }
      if (window._mapState.showLabels && (s.type === 'Town' || (window._mapState.zoom > 1.3 && s.type === 'Castle'))) {
        svgInner += `<text x="${p.x}" y="${p.y - r - 4}" text-anchor="middle" fill="#e8d8b8" font-family="Cinzel,serif" font-size="${10 + (s.type === 'Town' ? 1 : 0)}" stroke="#000" stroke-width="0.4" paint-order="stroke" pointer-events="none">${s.name}</text>`;
      }
      svgInner += `</g>`;
    } else if (s.type === 'Hideout') {
      svgInner += `<g class="map-settlement" data-id="${s.id}" data-type="${s.type}" data-name="${s.name.replace(/"/g,'&quot;')}">`;
      // Bandit hideout skull icon
      svgInner += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="rgba(0,0,0,.7)" stroke="#c04030" stroke-width="1.2"/>`;
      svgInner += `<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="10" fill="#c08070" stroke="#000" stroke-width="0.3" paint-order="stroke" pointer-events="none">&#x2620;</text>`;
      svgInner += `</g>`;
    } else {
      // Village — hut triangle icon
      svgInner += `<g class="map-settlement" data-id="${s.id}" data-type="${s.type}" data-name="${s.name.replace(/"/g,'&quot;')}">`;
      if (warnColor) {
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r+3}" fill="none" stroke="${warnColor}" stroke-width="1.5" opacity="0.7"><animate attributeName="r" values="${r+2};${r+6};${r+2}" dur="1.8s" repeatCount="indefinite"/></circle>`;
      }
      const vh = r*1.5, vw = r*1.8;
      svgInner += `<path d="M${p.x-vw/2},${p.y+vh/2} L${p.x+vw/2},${p.y+vh/2} L${p.x},${p.y-vh/2} Z" fill="${fill}" stroke="${stroke}" stroke-width="0.9" stroke-opacity="0.8"/>`;
      svgInner += `</g>`;
    }
  });

  // ── Parties — cluster co-located friendly parties into army groups ──
  if (window._mapState.showParties) {
    // Interpolation factor for live-refresh party movement
    const tweenDur = 1500;
    const tweenElapsed = performance.now() - window._mapState.partyTweenStart;
    const tweenT = Math.min(1, Math.max(0, tweenElapsed / tweenDur));
    const ease = tweenT < 1 ? (1 - Math.pow(1 - tweenT, 3)) : 1;
    const prevPos = window._mapState.prevPartyPositions || {};
    // Apply interpolated x/y to parties as copies
    const visibleParties = (data.parties||[]).filter(party =>
      !(party.kingdomId && hiddenK.has(party.kingdomId) && !party.isPlayer)
    ).map(party => {
      const prev = prevPos[party.id];
      if (prev && ease < 1) {
        return {
          ...party,
          x: prev.x + (party.x - prev.x) * ease,
          y: prev.y + (party.y - prev.y) * ease
        };
      }
      return party;
    });
    const CLUSTER_RADIUS = 4; // world units — parties within this distance are grouped
    const clustered = [];
    const claimed = new Set();
    visibleParties.forEach((party, idx) => {
      if (claimed.has(idx) || party.isPlayer || party.isCaravan) return;
      const group = [party];
      claimed.add(idx);
      for (let j = idx + 1; j < visibleParties.length; j++) {
        if (claimed.has(j)) continue;
        const other = visibleParties[j];
        if (other.isPlayer || other.isCaravan) continue;
        if (other.isHostile !== party.isHostile) continue;
        const dx = other.x - party.x, dy = other.y - party.y;
        if (dx * dx + dy * dy < CLUSTER_RADIUS * CLUSTER_RADIUS) {
          group.push(other);
          claimed.add(j);
        }
      }
      if (group.length > 1) {
        // Render as army group marker
        const cxG = group.reduce((s,g)=>s+g.x,0)/group.length;
        const cyG = group.reduce((s,g)=>s+g.y,0)/group.length;
        const totalTroops = group.reduce((s,g)=>s+(g.troops||0),0);
        const sp = project(cxG, cyG);
        const fillG = party.isHostile ? '#c04030' : '#80b060';
        svgInner += `<g class="map-party" data-name="${party.isHostile?'Hostile Army':'Allied Army'}" data-leader="${group.length} parties" data-troops="${totalTroops}">`;
        svgInner += `<circle cx="${sp.x}" cy="${sp.y}" r="8" fill="${fillG}" stroke="#000" stroke-width="1.2"/>`;
        svgInner += `<text x="${sp.x}" y="${sp.y+3}" text-anchor="middle" font-family="Cinzel,serif" font-size="8" fill="#fff" font-weight="bold" pointer-events="none">${group.length}</text>`;
        svgInner += `</g>`;
        clustered.push(...group);
      }
    });
    // Render remaining solo parties normally
    visibleParties.forEach(party => {
      if (clustered.includes(party) && !party.isPlayer) return;
      const p = project(party.x, party.y);
      let fill = '#80b060';
      let stroke = '#000';
      let r = 3;
      if (party.isPlayer) { fill = '#e8c468'; stroke = '#5a3a10'; r = 5; }
      else if (party.isHostile) { fill = '#c04030'; r = 3.5; }
      else if (party.isCaravan) { fill = '#b08040'; r = 2.5; }

      svgInner += `<g class="map-party${party.isPlayer ? ' map-party-player' : ''}" data-id="${party.id}" data-name="${party.name.replace(/"/g,'&quot;')}" data-leader="${(party.leader||'').replace(/"/g,'&quot;')}" data-troops="${party.troops}">`;
      if (party.isPlayer) {
        // Pulsing gold beacon
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r*5}" fill="#e8c468" fill-opacity="0.08"><animate attributeName="r" values="${r*4};${r*8};${r*4}" dur="2.5s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.18;0.04;0.18" dur="2.5s" repeatCount="indefinite"/></circle>`;
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r*3}" fill="#e8c468" fill-opacity="0.2"/>`;
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r*1.7}" fill="#ffd878" fill-opacity="0.5"/>`;
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#ffec90" stroke="#5a3a10" stroke-width="2"/>`;
        svgInner += `<text x="${p.x}" y="${p.y - r*2 - 4}" text-anchor="middle" font-size="14" fill="#e8c468" stroke="#000" stroke-width="0.6" paint-order="stroke">&#x1F451;</text>`;
        svgInner += `<text x="${p.x}" y="${p.y + r*2 + 12}" text-anchor="middle" font-family="Cinzel,serif" font-size="11" fill="#ffec90" stroke="#000" stroke-width="0.5" paint-order="stroke" font-weight="bold">YOU</text>`;
      } else {
        svgInner += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
      }
      svgInner += `</g>`;
    });
  }

  // Day/night tint overlay — subtle
  if (data.isNight) {
    svgInner += '<rect width="100%" height="100%" fill="#0a1530" opacity="0.18" pointer-events="none"/>';
  } else if (data.campaignHour !== undefined) {
    const h = data.campaignHour;
    if ((h >= 5 && h < 7) || (h >= 18 && h < 20)) {
      svgInner += `<rect width="100%" height="100%" fill="#e8a040" opacity="0.07" pointer-events="none"/>`;
    }
  }

  // Season tint — 0 Spring, 1 Summer, 2 Autumn, 3 Winter
  if (data.season !== undefined) {
    const seasonTints = [
      {color: '#60c060', alpha: 0.04},
      {color: '#f0d060', alpha: 0.03},
      {color: '#d07030', alpha: 0.06},
      {color: '#90b0e0', alpha: 0.10}
    ];
    const st = seasonTints[data.season];
    if (st) svgInner += `<rect width="100%" height="100%" fill="${st.color}" opacity="${st.alpha}" pointer-events="none"/>`;
    // Winter: snow particle overlay
    if (data.season === 3) {
      svgInner += '<defs><pattern id="snowPat" x="0" y="0" width="140" height="140" patternUnits="userSpaceOnUse">';
      let seed = 12345;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let sn = 0; sn < 35; sn++) {
        const sx = rnd() * 140;
        const sy = rnd() * 140;
        const sr = 0.6 + rnd() * 1.4;
        svgInner += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#ffffff" opacity="0.55"/>`;
      }
      svgInner += '</pattern></defs>';
      svgInner += '<rect width="100%" height="100%" fill="url(#snowPat)" opacity="0.65" pointer-events="none"/>';
    }
  }

  // ── Compass rose (top-left) ──
  {
    const cx = 48, cy = 48, R = 32;
    svgInner += `<g class="map-compass" transform="translate(${cx},${cy})">`;
    svgInner += `<circle r="${R}" fill="rgba(28,20,12,.85)" stroke="#d4b878" stroke-width="1.5"/>`;
    svgInner += `<circle r="${R-4}" fill="none" stroke="rgba(212,184,120,.35)" stroke-width="0.8"/>`;
    // Cardinal arms
    svgInner += `<path d="M0,-${R-6} L4,0 L0,${R-6} L-4,0 Z" fill="#e8c468" stroke="#5a3a10" stroke-width="0.8"/>`;
    svgInner += `<path d="M-${R-6},0 L0,4 L${R-6},0 L0,-4 Z" fill="#a07820" stroke="#5a3a10" stroke-width="0.8"/>`;
    // N marker
    svgInner += `<text x="0" y="-${R-12}" text-anchor="middle" font-family="Cinzel,serif" font-size="11" fill="#f4e4c0" font-weight="bold">N</text>`;
    svgInner += `</g>`;
  }

  // ── Scale bar (bottom-left) ──
  {
    const pxPerWorld = (stageW * window._mapState.zoom) / worldW;
    const targetPx = 140;
    const worldUnits = targetPx / pxPerWorld;
    // Round to a nice number
    const niceNumbers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    let chosen = niceNumbers[0];
    for (const n of niceNumbers) if (n <= worldUnits) chosen = n;
    const barPx = chosen * pxPerWorld;
    const sbX = 24, sbY = stageH - 30;
    svgInner += `<g class="map-scale">`;
    svgInner += `<rect x="${sbX-8}" y="${sbY-18}" width="${barPx+50}" height="30" rx="3" fill="rgba(28,20,12,.8)" stroke="rgba(184,140,50,.4)" stroke-width="0.8"/>`;
    svgInner += `<line x1="${sbX}" y1="${sbY}" x2="${sbX+barPx}" y2="${sbY}" stroke="#e8c468" stroke-width="2"/>`;
    svgInner += `<line x1="${sbX}" y1="${sbY-5}" x2="${sbX}" y2="${sbY+5}" stroke="#e8c468" stroke-width="2"/>`;
    svgInner += `<line x1="${sbX+barPx}" y1="${sbY-5}" x2="${sbX+barPx}" y2="${sbY+5}" stroke="#e8c468" stroke-width="2"/>`;
    svgInner += `<text x="${sbX+barPx/2}" y="${sbY-7}" text-anchor="middle" font-family="Cinzel,serif" font-size="10" fill="#e8c468">${chosen} units</text>`;
    svgInner += `</g>`;
  }

  // Measure tool overlay
  if (window._mapState.measurePoints.length > 0) {
    const pts = window._mapState.measurePoints;
    pts.forEach(pt => {
      svgInner += `<circle cx="${pt.sx}" cy="${pt.sy}" r="6" fill="#e8c468" stroke="#000" stroke-width="1"/>`;
    });
    if (pts.length === 2) {
      const p1 = pts[0], p2 = pts[1];
      svgInner += `<line x1="${p1.sx}" y1="${p1.sy}" x2="${p2.sx}" y2="${p2.sy}" stroke="#e8c468" stroke-width="2" stroke-dasharray="5,3"/>`;
      // Convert screen distance to world distance
      const z = window._mapState.zoom;
      const dxS = p2.sx - p1.sx, dyS = p2.sy - p1.sy;
      // Pixels-per-world-unit at current zoom: (stageW * z) / worldW
      const pxPerWorld = (stageW * z) / worldW;
      const dxW = dxS / pxPerWorld, dyW = dyS / pxPerWorld;
      const worldDist = Math.sqrt(dxW * dxW + dyW * dyW);
      const travelDays = Math.max(1, Math.round(worldDist / 5));
      const mx = (p1.sx + p2.sx) / 2, my = (p1.sy + p2.sy) / 2;
      svgInner += `<rect x="${mx-60}" y="${my-20}" width="120" height="30" rx="3" fill="rgba(0,0,0,.85)" stroke="#e8c468" stroke-width="1"/>`;
      svgInner += `<text x="${mx}" y="${my-6}" text-anchor="middle" font-family="Cinzel,serif" font-size="11" fill="#e8c468">${worldDist.toFixed(1)} world units</text>`;
      svgInner += `<text x="${mx}" y="${my+6}" text-anchor="middle" font-family="Cinzel,serif" font-size="10" fill="#c8b890">~${travelDays} days travel</text>`;
    }
  }

  svg.innerHTML = svgInner;

  // Wire hover tooltips
  svg.querySelectorAll('.map-settlement, .map-party').forEach(g => {
    g.addEventListener('mouseenter', mapShowTooltip);
    g.addEventListener('mousemove', mapMoveTooltip);
    g.addEventListener('mouseleave', mapHideTooltip);
    g.addEventListener('click', mapHandleClick);
  });
  // Double-click any settlement for instant teleport
  svg.querySelectorAll('.map-settlement').forEach(g => {
    g.addEventListener('dblclick', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const id = g.dataset.id, name = g.dataset.name;
      if (id) mapTravelTo(id, name);
    });
  });

  drawMinimap(data, b, worldW, worldH, stageW, stageH, kingdomColors);
}

function drawMinimap(data, b, worldW, worldH, stageW, stageH, kingdomColors) {
  const mm = document.getElementById('mapMinimapSvg');
  if (!mm) return;
  const MM_W = 180, MM_H = 140;
  mm.setAttribute('width', MM_W);
  mm.setAttribute('height', MM_H);
  function mmProject(x, y) {
    const nx = (x - b.minX) / worldW;
    const ny = 1 - (y - b.minY) / worldH;
    return { x: nx * MM_W, y: ny * MM_H };
  }
  let html = '<rect width="100%" height="100%" fill="#0e0c08" stroke="#b88c32" stroke-width="1"/>';
  // Dot for each settlement
  (data.settlements||[]).forEach(s => {
    if (s.type === 'Hideout' || s.type === 'Village') return;
    const p = mmProject(s.x, s.y);
    const color = s.kingdomId ? (kingdomColors[s.kingdomId] || '#888') : '#666';
    html += `<circle cx="${p.x}" cy="${p.y}" r="${s.type === 'Town' ? 2 : 1.5}" fill="${color}"/>`;
  });
  // Player marker
  const player = (data.parties||[]).find(p => p.isPlayer);
  if (player) {
    const pp = mmProject(player.x, player.y);
    html += `<circle cx="${pp.x}" cy="${pp.y}" r="3" fill="#ffd878" stroke="#5a3a10" stroke-width="0.8"/>`;
  }
  // Current viewport rectangle (inverse project screen corners to world)
  const z = window._mapState.zoom;
  const sW = stageW, sH = stageH;
  // Screen (0,0) corresponds to world ((b.minX - panX/z/sW*worldW), ...)
  // Reverse project: screen sx → world x = b.minX + (sx - panX) / (sW * z) * worldW
  const invProject = (sx, sy) => {
    const wx = b.minX + ((sx - window._mapState.panX) / (sW * z)) * worldW;
    const wy = b.minY + (1 - (sy - window._mapState.panY) / (sH * z)) * worldH;
    return { wx, wy };
  };
  const tl = invProject(0, 0);
  const br = invProject(sW, sH);
  const mmTL = mmProject(tl.wx, tl.wy);
  const mmBR = mmProject(br.wx, br.wy);
  const rx = Math.max(0, Math.min(mmTL.x, mmBR.x));
  const ry = Math.max(0, Math.min(mmTL.y, mmBR.y));
  const rw = Math.min(MM_W - rx, Math.abs(mmBR.x - mmTL.x));
  const rh = Math.min(MM_H - ry, Math.abs(mmBR.y - mmTL.y));
  html += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgba(232,196,104,0.08)" stroke="#e8c468" stroke-width="1.5"/>`;
  mm.innerHTML = html;
}

function mapShowTooltip(ev) {
  const tip = document.getElementById('mapTooltip');
  if (!tip) return;
  const t = ev.currentTarget;
  let html = '';
  if (t.classList.contains('map-settlement')) {
    html = `<b>${t.dataset.name}</b><br><span style="color:#9a8260">${t.dataset.type}</span>`;
  } else {
    html = `<b>${t.dataset.name}</b>`;
    if (t.dataset.leader) html += `<br><span style="color:#9a8260">${t.dataset.leader}</span>`;
    if (t.dataset.troops) html += `<br><span style="color:#c8b890">&#x2694; ${t.dataset.troops} troops</span>`;
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  mapMoveTooltip(ev);
}

function mapMoveTooltip(ev) {
  const tip = document.getElementById('mapTooltip');
  if (!tip) return;
  const stage = document.getElementById('mapStage');
  const rect = stage.getBoundingClientRect();
  tip.style.left = (ev.clientX - rect.left + 14) + 'px';
  tip.style.top = (ev.clientY - rect.top + 14) + 'px';
}

function mapHideTooltip() {
  const tip = document.getElementById('mapTooltip');
  if (tip) tip.style.display = 'none';
}

function mapHandleClick(ev) {
  const t = ev.currentTarget;
  if (t.classList.contains('map-settlement')) {
    mapOpenSlideout(t.dataset.id);
  } else if (t.classList.contains('map-party')) {
    if (ev.shiftKey) {
      // Toggle into multi-select comparison set
      const id = t.dataset.id;
      if (!id) return;
      if (window._mapState.selectedParties.has(id)) window._mapState.selectedParties.delete(id);
      else window._mapState.selectedParties.add(id);
      renderPartyCompare();
    } else {
      showToast('&#x1F6B6; ' + t.dataset.name);
    }
  }
}

function renderPartyCompare() {
  const el = document.getElementById('mapCompare');
  if (!el) return;
  const data = window._mapState.data;
  const selected = Array.from(window._mapState.selectedParties)
    .map(id => (data?.parties||[]).find(p => p.id === id))
    .filter(Boolean);
  if (selected.length === 0) {
    el.classList.remove('open');
    el.innerHTML = '';
    return;
  }
  let html = '<div class="map-compare-header">';
  html += `<span>&#x2694; Compare Parties (${selected.length})</span>`;
  html += '<button class="map-compare-close" onclick="window._mapState.selectedParties.clear();renderPartyCompare()">&times;</button>';
  html += '</div>';
  html += '<div class="map-compare-grid">';
  selected.forEach(p => {
    const hostileLbl = p.isHostile ? '<span class="compare-hostile">HOSTILE</span>' : '<span class="compare-friendly">FRIENDLY</span>';
    html += `<div class="map-compare-card${p.isHostile ? ' hostile' : ''}">`;
    html += `<div class="compare-name">${esc(p.name)}</div>`;
    html += `<div class="compare-sub">${esc(p.leader||'')} ${hostileLbl}</div>`;
    html += `<div class="compare-stat"><b>${p.troops||0}</b> troops</div>`;
    html += `<button class="map-btn" onclick="centerOnSettlement({x:${p.x},y:${p.y}},3)">Focus</button>`;
    html += `</div>`;
  });
  html += '</div>';
  el.innerHTML = html;
  el.classList.add('open');
}

function mapOpenSlideout(settlementId) {
  const panel = document.getElementById('mapSlideout');
  if (!panel) return;
  const data = window._mapState.data;
  const s = (data?.settlements||[]).find(x => x.id === settlementId);
  if (!s) return;
  let html = '<button class="map-slideout-close" onclick="document.getElementById(\'mapSlideout\').classList.remove(\'open\')">&times;</button>';
  html += '<div class="map-slideout-header">';
  if (s.clanId && Store._bannerImages?.[s.clanId]) {
    html += `<img class="map-slideout-banner" src="Banners/${encodeURIComponent(s.clanId)}.png" alt="">`;
  }
  html += '<div>';
  html += `<h3 class="map-slideout-name">${esc(s.name)}</h3>`;
  html += `<div class="map-slideout-sub">${esc(s.type)} &middot; ${esc(s.kingdomName||'Independent')}</div>`;
  html += `<div class="map-slideout-owner">Owned by ${esc(s.clanName||'—')}</div>`;
  html += '</div>';
  html += '</div>';

  html += '<div class="map-slideout-stats">';
  if (s.prosperity !== undefined) html += `<div class="map-slideout-stat"><b>${s.prosperity.toLocaleString()}</b><span>Prosperity</span></div>`;
  if (s.garrison !== undefined) html += `<div class="map-slideout-stat"><b>${s.garrison}</b><span>Garrison</span></div>`;
  if (s.loyalty !== undefined) html += `<div class="map-slideout-stat"><b>${s.loyalty}</b><span>Loyalty</span></div>`;
  if (s.security !== undefined) html += `<div class="map-slideout-stat"><b>${s.security}</b><span>Security</span></div>`;
  if (s.foodStocks !== undefined) html += `<div class="map-slideout-stat"><b style="color:${s.foodStocks<0?'#e08060':'#80c060'}">${s.foodStocks}</b><span>Food</span></div>`;
  html += '</div>';

  const warnings = [];
  if (s.isUnderSiege) warnings.push('&#x1F6A8; Under Siege');
  if (s.isRaided) warnings.push('&#x1F525; Being Raided');
  if (s.loyalty !== undefined && s.loyalty < 30) warnings.push('&#x26A0; Low Loyalty');
  if (s.security !== undefined && s.security < 20) warnings.push('&#x26A0; Low Security');
  if (s.foodStocks !== undefined && s.foodStocks < 0) warnings.push('&#x26A0; Food Shortage');
  if (s.hasTournament) warnings.push('&#x1F3C6; Tournament');
  if (warnings.length) html += `<div class="map-slideout-warnings">${warnings.join(' &middot; ')}</div>`;

  html += '<div class="map-slideout-actions">';
  html += `<button class="map-btn map-btn-teleport" onclick="mapTravelTo('${esc(s.id)}','${esc(s.name)}')"><span class="map-btn-icon">&#x2728;</span>Teleport Here</button>`;
  html += `<button class="map-btn" onclick="openDetail('settlements','${esc(s.id)}')">&#x1F4DC; Full Details</button>`;
  html += '</div>';
  html += '<div class="map-slideout-hint">Tip: <kbd>Double-click</kbd> any settlement on the map for instant teleport</div>';

  panel.innerHTML = html;
  panel.classList.add('open');
}

async function mapTravelTo(settlementId, name) {
  // Find the settlement element on the map for the arrival burst
  const sEl = document.querySelector(`.map-settlement[data-id="${settlementId}"]`);
  _mapArrivalBurst(sEl);

  const res = await API.travelTo(settlementId);
  if (res?.success) {
    const isTeleport = res.action === 'teleport';
    showToast((isTeleport ? '\u2728 Teleported to ' : '\u{1F6B6} Traveling to ') + (res.target || name));
    // Close slideout and refresh the map so the player marker jumps to the new spot
    document.getElementById('mapSlideout')?.classList.remove('open');
    setTimeout(() => { if (Store.currentPage === 'map') renderMap(true); }, 350);
  } else {
    showToast(res?.error || 'Failed to travel', true);
  }
}

// Dramatic golden arrival burst on the target settlement
function _mapArrivalBurst(sEl) {
  if (!sEl) return;
  const stage = document.getElementById('mapStage');
  if (!stage) return;
  const sRect = sEl.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const cx = sRect.left + sRect.width / 2 - stageRect.left;
  const cy = sRect.top + sRect.height / 2 - stageRect.top;

  const burst = document.createElement('div');
  burst.className = 'map-arrival-burst';
  burst.style.left = cx + 'px';
  burst.style.top = cy + 'px';
  burst.innerHTML = `
    <div class="mab-ring"></div>
    <div class="mab-ring mab-ring-2"></div>
    <div class="mab-ring mab-ring-3"></div>
    <div class="mab-star">&#x2726;</div>
    ${Array.from({length:12}).map((_,i) => `<span class="mab-ember" style="--a:${i*30}deg"></span>`).join('')}
  `;
  stage.appendChild(burst);
  setTimeout(() => burst.remove(), 1600);
}

function mapFitToView() {
  window._mapState.zoom = 1;
  window._mapState.panX = 0;
  window._mapState.panY = 0;
  drawMap();
}

function mapZoom(factor, cx, cy) {
  const stage = document.getElementById('mapStage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  if (cx == null) cx = rect.width / 2;
  if (cy == null) cy = rect.height / 2;
  const oldZoom = window._mapState.zoom;
  const newZoom = Math.max(0.3, Math.min(8, oldZoom * factor));
  // Adjust pan so the zoom centers on the cursor
  window._mapState.panX = cx - (cx - window._mapState.panX) * (newZoom / oldZoom);
  window._mapState.panY = cy - (cy - window._mapState.panY) * (newZoom / oldZoom);
  window._mapState.zoom = newZoom;
  drawMap();
  _mapUpdateReadout();
}

function initMapInteractions() {
  // Default calibration tuned for bundled 3222x2880 caldaria.png — ox/oy are fractions of stage dims
  const DEFAULT_CALIBRATION = {ox:-0.0962, oy:-0.042, sx:1.075, sy:1.07};
  // Load saved calibration (user's override takes precedence over default)
  try {
    const saved = localStorage.getItem('mapCalibration');
    window._mapCalibration = saved ? JSON.parse(saved) : {...DEFAULT_CALIBRATION};
    // Migrate legacy absolute-pixel calibration: if |ox|>1 it was the old format, reset it
    if (Math.abs(window._mapCalibration.ox) > 2 || Math.abs(window._mapCalibration.oy) > 2) {
      window._mapCalibration = {...DEFAULT_CALIBRATION};
      try { localStorage.removeItem('mapCalibration'); } catch(e) {}
    }
  } catch(e) { window._mapCalibration = {...DEFAULT_CALIBRATION}; }

  const stage = document.getElementById('mapStage');
  if (!stage || stage.dataset.bound === '1') return;
  stage.dataset.bound = '1';

  // Wheel zoom
  stage.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = stage.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    mapZoom(ev.deltaY < 0 ? 1.15 : 0.87, cx, cy);
  }, {passive: false});

  // Live coordinate readout under the cursor
  stage.addEventListener('mousemove', (ev) => {
    const r = stage.getBoundingClientRect();
    const mxEl = document.getElementById('mrX');
    const myEl = document.getElementById('mrY');
    if (mxEl) mxEl.textContent = Math.round(ev.clientX - r.left);
    if (myEl) myEl.textContent = Math.round(ev.clientY - r.top);
  });

  // Compass double-click = reset rotation (no-op but feels responsive)
  document.getElementById('mapCompass')?.addEventListener('dblclick', () => {
    const n = document.getElementById('compassNeedle');
    if (n) { n.style.transition = 'transform .6s ease'; n.style.transform = 'rotate(0deg)'; }
    showToast('\u{1F9ED} Compass reset');
  });

  // Drag to pan — OR shift+drag to move the background image (calibration)
  // Calibration offsets are stored in "zoom=1 base" pixel units so they stay aligned with settlements at any zoom
  stage.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('.map-settlement, .map-party')) return;
    window._mapState.isDragging = true;
    window._mapState.isCalibrating = ev.shiftKey;
    const z = window._mapState.zoom || 1;
    const sW = stage.clientWidth || 800;
    const sH = stage.clientHeight || 600;
    if (window._mapState.isCalibrating) {
      const cal = window._mapCalibration;
      window._mapState.dragStartX = ev.clientX - cal.ox * sW * z;
      window._mapState.dragStartY = ev.clientY - cal.oy * sH * z;
      stage.style.cursor = 'crosshair';
    } else {
      window._mapState.dragStartX = ev.clientX - window._mapState.panX;
      window._mapState.dragStartY = ev.clientY - window._mapState.panY;
      stage.style.cursor = 'grabbing';
    }
  });
  document.addEventListener('mousemove', (ev) => {
    if (!window._mapState.isDragging) return;
    const z = window._mapState.zoom || 1;
    const sW = stage.clientWidth || 800;
    const sH = stage.clientHeight || 600;
    if (window._mapState.isCalibrating) {
      const cal = window._mapCalibration;
      // Store as fraction of stage size so calibration is window-size independent
      cal.ox = ((ev.clientX - window._mapState.dragStartX) / z) / sW;
      cal.oy = ((ev.clientY - window._mapState.dragStartY) / z) / sH;
    } else {
      window._mapState.panX = ev.clientX - window._mapState.dragStartX;
      window._mapState.panY = ev.clientY - window._mapState.dragStartY;
    }
    drawMap();
  });
  document.addEventListener('mouseup', () => {
    window._mapState.isDragging = false;
    window._mapState.isCalibrating = false;
    stage.style.cursor = 'grab';
  });

  // Buttons
  document.getElementById('mapBtnRefresh')?.addEventListener('click', () => renderMap());
  document.getElementById('mapBtnCenter')?.addEventListener('click', centerOnPlayer);
  // Search input
  const searchEl = document.getElementById('mapSearch');
  if (searchEl) {
    searchEl.addEventListener('input', mapSearchHandler);
    searchEl.addEventListener('focus', mapSearchHandler);
    // Click outside results closes them
    document.addEventListener('click', (ev) => {
      if (ev.target === searchEl) return;
      if (ev.target.closest('#mapSearchResults')) return;
      const r = document.getElementById('mapSearchResults');
      if (r) r.style.display = 'none';
    });
  }
  // Heatmap selector
  document.getElementById('mapHeatmap')?.addEventListener('change', (e) => {
    window._mapState.heatmapMode = e.target.value;
    drawMap();
  });

  // View bookmarks — save/restore zoom+pan
  function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem('mapBookmarks')||'[]'); } catch(e) { return []; }
  }
  function saveBookmarks(bm) {
    try { localStorage.setItem('mapBookmarks', JSON.stringify(bm)); } catch(e) {}
  }
  function refreshBookmarkList() {
    const sel = document.getElementById('mapBookmarkList');
    if (!sel) return;
    const bm = loadBookmarks();
    sel.innerHTML = '<option value="">— Views —</option>';
    bm.forEach((b, i) => {
      sel.innerHTML += `<option value="${i}">${esc(b.name)}</option>`;
    });
  }
  refreshBookmarkList();
  document.getElementById('mapBtnBookmark')?.addEventListener('click', () => {
    const name = prompt('Bookmark name:', 'View ' + (loadBookmarks().length + 1));
    if (!name) return;
    const bm = loadBookmarks();
    bm.push({
      name,
      zoom: window._mapState.zoom,
      panX: window._mapState.panX,
      panY: window._mapState.panY
    });
    saveBookmarks(bm);
    refreshBookmarkList();
    showToast('Bookmark saved: ' + name);
  });
  document.getElementById('mapBookmarkList')?.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value);
    if (isNaN(idx)) return;
    const bm = loadBookmarks()[idx];
    if (!bm) return;
    window._mapState.zoom = bm.zoom;
    window._mapState.panX = bm.panX;
    window._mapState.panY = bm.panY;
    drawMap();
    e.target.value = '';
  });

  // Keyboard shortcuts: WASD pan, +/- zoom, F center on player, Esc close slideout
  document.addEventListener('keydown', (ev) => {
    if (Store.currentPage !== 'map') return;
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    const panStep = 80;
    if (ev.key === 'w' || ev.key === 'W' || ev.key === 'ArrowUp') { window._mapState.panY += panStep; drawMap(); }
    else if (ev.key === 's' || ev.key === 'S' || ev.key === 'ArrowDown') { window._mapState.panY -= panStep; drawMap(); }
    else if (ev.key === 'a' || ev.key === 'A' || ev.key === 'ArrowLeft') { window._mapState.panX += panStep; drawMap(); }
    else if (ev.key === 'd' || ev.key === 'D' || ev.key === 'ArrowRight') { window._mapState.panX -= panStep; drawMap(); }
    else if (ev.key === '+' || ev.key === '=') { mapZoom(1.25); }
    else if (ev.key === '-' || ev.key === '_') { mapZoom(0.8); }
    else if (ev.key === 'f' || ev.key === 'F') { centerOnPlayer(); }
    else if (ev.key === 'Escape') { document.getElementById('mapSlideout')?.classList.remove('open'); }
  });

  // Right-click context menu on settlements
  stage.addEventListener('contextmenu', (ev) => {
    const sEl = ev.target.closest('.map-settlement');
    if (!sEl) return;
    ev.preventDefault();
    const id = sEl.dataset.id;
    const name = sEl.dataset.name;
    document.querySelector('.map-context-menu')?.remove();
    const m = document.createElement('div');
    m.className = 'map-context-menu';
    m.style.left = ev.clientX + 'px';
    m.style.top = ev.clientY + 'px';
    m.innerHTML = `
      <div class="map-context-title">${esc(name)}</div>
      <div class="map-context-item" data-action="details">&#x1F4DC; Details</div>
      <div class="map-context-item" data-action="travel">&#x2728; Teleport Here</div>
      <div class="map-context-item" data-action="bookmark">&#x1F4CC; Bookmark View</div>
    `;
    document.body.appendChild(m);
    m.querySelectorAll('.map-context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'details') mapOpenSlideout(id);
        else if (action === 'travel') mapTravelTo(id, name);
        else if (action === 'bookmark') {
          document.getElementById('mapBtnBookmark')?.click();
        }
        m.remove();
      });
    });
    setTimeout(() => {
      document.addEventListener('click', function off() {
        m.remove();
        document.removeEventListener('click', off);
      });
    }, 50);
  });

  // Minimap click-to-jump + drag to pan
  const mmEl = document.getElementById('mapMinimapSvg');
  let mmDragging = false;
  const mmJump = (ev) => {
    const data = window._mapState.data;
    if (!data) return;
    const rect = mmEl.getBoundingClientRect();
    const mmX = ev.clientX - rect.left;
    const mmY = ev.clientY - rect.top;
    const MM_W = 180, MM_H = 140;
    const fx = mmX / MM_W, fy = mmY / MM_H;
    const b = data.bounds;
    const worldX = b.minX + fx * (b.maxX - b.minX);
    const worldY = b.minY + (1 - fy) * (b.maxY - b.minY);
    centerOnSettlement({x: worldX, y: worldY}, window._mapState.zoom);
  };
  mmEl?.addEventListener('mousedown', (ev) => { mmDragging = true; mmJump(ev); });
  document.addEventListener('mousemove', (ev) => { if (mmDragging) mmJump(ev); });
  document.addEventListener('mouseup', () => { mmDragging = false; });

  // Measure tool
  document.getElementById('mapBtnMeasure')?.addEventListener('click', () => {
    window._mapState.measureMode = !window._mapState.measureMode;
    window._mapState.measurePoints = [];
    stage.style.cursor = window._mapState.measureMode ? 'crosshair' : 'grab';
    showToast(window._mapState.measureMode ? 'Click two points to measure distance' : 'Measure tool off');
    drawMap();
  });
  // Live refresh
  const liveToggle = document.getElementById('mapLive');
  const startLive = () => {
    if (window._mapState.liveRefreshTimer) return;
    window._mapState.liveRefreshTimer = setInterval(() => {
      if (Store.currentPage === 'map') renderMap(true);
    }, 20000);
  };
  const stopLive = () => {
    if (window._mapState.liveRefreshTimer) {
      clearInterval(window._mapState.liveRefreshTimer);
      window._mapState.liveRefreshTimer = null;
    }
  };
  if (liveToggle) {
    liveToggle.addEventListener('change', (e) => {
      if (e.target.checked) startLive(); else stopLive();
    });
    if (liveToggle.checked) startLive();
  }
  document.getElementById('mapBtnFit')?.addEventListener('click', mapFitToView);
  document.getElementById('mapBtnZoomIn')?.addEventListener('click', () => mapZoom(1.25));
  document.getElementById('mapBtnZoomOut')?.addEventListener('click', () => mapZoom(0.8));
  document.getElementById('mapShowParties')?.addEventListener('change', (e) => {
    window._mapState.showParties = e.target.checked;
    drawMap();
  });
  document.getElementById('mapShowVillages')?.addEventListener('change', (e) => {
    window._mapState.showVillages = e.target.checked;
    drawMap();
  });
  document.getElementById('mapShowLabels')?.addEventListener('change', (e) => {
    window._mapState.showLabels = e.target.checked;
    drawMap();
  });
  document.getElementById('mapShowRoads')?.addEventListener('change', (e) => {
    window._mapState.showRoads = e.target.checked;
    drawMap();
  });
  document.getElementById('mapShowTrade')?.addEventListener('change', (e) => {
    window._mapState.showTrade = e.target.checked;
    drawMap();
  });

  // Calibration controls
  const calBar = document.getElementById('mapCalibrateBar');
  const cal = window._mapCalibration;
  const setCalUI = () => {
    document.getElementById('calibX').value = cal.ox;
    document.getElementById('calibY').value = cal.oy;
    document.getElementById('calibSX').value = cal.sx;
    document.getElementById('calibSY').value = cal.sy;
    document.getElementById('calibXVal').textContent = cal.ox;
    document.getElementById('calibYVal').textContent = cal.oy;
    document.getElementById('calibSXVal').textContent = cal.sx.toFixed(2);
    document.getElementById('calibSYVal').textContent = cal.sy.toFixed(2);
  };
  document.getElementById('mapBtnCalibrate')?.addEventListener('click', () => {
    if (!calBar) return;
    calBar.style.display = calBar.style.display === 'none' ? 'flex' : 'none';
    setCalUI();
  });

  // One-click auto-align: next click on the stage snaps the image to place your party correctly
  document.getElementById('mapBtnAutoAlign')?.addEventListener('click', () => {
    window._mapState.awaitingAutoAlign = true;
    stage.style.cursor = 'crosshair';
    showToast('Click where your party SHOULD be on the map image');
  });
  // Plan mode click handler — converts screen click to world coords
  stage.addEventListener('click', (ev) => {
    if (!window._planMode) return;
    if (ev.target.closest('.map-settlement, .map-party, .map-btn, .map-legend')) return;
    const rect = stage.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const cal = window._mapCalibration || { ox:0, oy:0, sx:1, sy:1 };
    const sW = stage.clientWidth || 800;
    const sH = stage.clientHeight || 600;
    const z = window._mapState.zoom || 1;
    const wx = ((cx - sW/2) / z - cal.ox * sW) / cal.sx;
    const wy = ((cy - sH/2) / z - cal.oy * sH) / cal.sy;
    addPlanWaypoint(wx, wy);
    ev.stopPropagation();
  });
  // Measure tool click handler
  stage.addEventListener('click', (ev) => {
    if (!window._mapState.measureMode) return;
    if (ev.target.closest('.map-settlement, .map-party')) return;
    const rect = stage.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    window._mapState.measurePoints.push({sx: cx, sy: cy});
    if (window._mapState.measurePoints.length >= 2) {
      drawMap();
      // Keep only the last two points for continuous measurement
      window._mapState.measurePoints = window._mapState.measurePoints.slice(-2);
    } else {
      drawMap();
    }
  });

  stage.addEventListener('click', (ev) => {
    if (!window._mapState.awaitingAutoAlign) return;
    if (ev.target.closest('.map-settlement, .map-party')) return; // ignore clicks on icons
    window._mapState.awaitingAutoAlign = false;
    stage.style.cursor = 'grab';
    const data = window._mapState.data;
    const player = (data?.parties || []).find(p => p.isPlayer);
    if (!player) { showToast('No player party to align to', true); return; }
    const rect = stage.getBoundingClientRect();
    const clickX = ev.clientX - rect.left;
    const clickY = ev.clientY - rect.top;
    const playerProjected = window._mapState.project(player.x, player.y);
    const z = window._mapState.zoom || 1;
    const sW = stage.clientWidth || 800;
    const sH = stage.clientHeight || 600;
    const cal = window._mapCalibration;
    // Shift the image so the clicked point lands under the player marker (stored as fraction of stage)
    cal.ox += ((playerProjected.x - clickX) / z) / sW;
    cal.oy += ((playerProjected.y - clickY) / z) / sH;
    try { localStorage.setItem('mapCalibration', JSON.stringify(cal)); } catch(e) {}
    drawMap();
    showToast('Map aligned to your party');
  });
  // Link-scale toggle — when enabled, SX and SY move together
  let linkScale = false;
  document.getElementById('calibLink')?.addEventListener('click', (e) => {
    linkScale = !linkScale;
    e.target.style.background = linkScale ? 'linear-gradient(180deg,rgba(120,80,32,.8),rgba(60,36,14,.9))' : '';
    e.target.style.color = linkScale ? '#f8ecc8' : '';
  });
  ['calibX','calibY','calibSX','calibSY'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (id === 'calibX') cal.ox = v;
      if (id === 'calibY') cal.oy = v;
      if (id === 'calibSX') { cal.sx = v; if (linkScale) cal.sy = v; }
      if (id === 'calibSY') { cal.sy = v; if (linkScale) cal.sx = v; }
      setCalUI();
      drawMap();
    });
  });
  document.getElementById('calibReset')?.addEventListener('click', () => {
    cal.ox = 0; cal.oy = 0; cal.sx = 1; cal.sy = 1;
    setCalUI(); drawMap();
  });
  document.getElementById('calibSave')?.addEventListener('click', () => {
    try { localStorage.setItem('mapCalibration', JSON.stringify(cal)); showToast('Map alignment saved'); }
    catch(e) { showToast('Failed to save', true); }
  });
}

// ── Data loading ──
async function loadData() {
  const [status, heroes, clans, settlements, kingdoms, portraits, banners] = await Promise.all([
    API.getStatus(),
    API.getHeroes(),
    API.getClans(),
    API.getSettlements(),
    API.getKingdoms(),
    API.getPortraitList(),
    API.getBannerList()
  ]);

  Store.status = status;
  Store.heroes = heroes || [];
  Store.clans = clans || [];
  Store.settlements = settlements || [];
  Store.kingdoms = kingdoms || [];
  Store.connected = status?.ok === true;

  // Build portrait lookup caches
  Store._customPortraits = {};
  Store._exportedPortraits = {};
  (portraits?.custom || []).forEach(id => { Store._customPortraits[id] = true; });
  (portraits?.exported || []).forEach(id => { Store._exportedPortraits[id] = true; });
  // Build pre-rendered banner lookup
  Store._bannerImages = {};
  (banners || []).forEach(id => { Store._bannerImages[id] = true; });

  // Update status pill
  const pill = document.getElementById('pillStatus');
  if (Store.connected) {
    pill.innerHTML = '<span class="status-dot connected"></span> Connected';
    pill.classList.add('connected');
  } else {
    pill.innerHTML = '<span class="status-dot"></span> Offline';
    pill.classList.remove('connected');
  }
}

async function refreshData() {
  await loadData();
}

// Smart page refresh — only re-render the page the user is currently viewing
async function refreshCurrentPage() {
  const page = Store.currentPage;
  // Don't refresh if a detail view is open (would destroy it)
  const detailOpen = document.querySelector('.detail-content');
  if (detailOpen) return;

  // Only incrementally update chronicle — no full page re-renders
  if (page === 'home') {
    // Update live chronicle without touching the rest of home
    incrementalChronicleUpdate('chronicle-live');
  } else if (page === 'chronicle') {
    incrementalChronicleUpdate('chronicle-list');
  }
  // All other pages: data syncs in background, renders fresh on navigation.
}

// ── Global Encyclopedia Search ──
function initGlobalSearch() {
  var input = document.getElementById('globalSearch');
  var results = document.getElementById('globalSearchResults');
  if (!input || !results) return;

  var debounceTimer = null;
  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      var q = input.value.trim().toLowerCase();
      if (!q) { results.classList.remove('open'); results.innerHTML = ''; return; }
      runGlobalSearch(q, results);
    }, 200);
  });

  input.addEventListener('focus', function() {
    if (input.value.trim()) runGlobalSearch(input.value.trim().toLowerCase(), results);
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.ee-search-wrap')) results.classList.remove('open');
  });
}

function runGlobalSearch(q, results) {
  var matches = [];
  var maxPerCat = 5;

  // Search heroes
  var heroes = (Store.heroes || []).filter(function(h) { return h.name && h.name.toLowerCase().includes(q); });
  for (var i = 0; i < Math.min(heroes.length, maxPerCat); i++) {
    matches.push({type:'hero', icon:'&#x1F464;', name:heroes[i].name, id:heroes[i].id, category:'heroes'});
  }

  // Search clans
  var clans = (Store.clans || []).filter(function(c) { return c.name && c.name.toLowerCase().includes(q); });
  for (var ci = 0; ci < Math.min(clans.length, maxPerCat); ci++) {
    matches.push({type:'clan', icon:'&#x1F3E0;', name:clans[ci].name, id:clans[ci].id, category:'clans'});
  }

  // Search settlements
  var settlements = (Store.settlements || []).filter(function(s) { return s.name && s.name.toLowerCase().includes(q); });
  for (var si = 0; si < Math.min(settlements.length, maxPerCat); si++) {
    var icon = settlements[si].isTown || settlements[si].type === 'Town' ? '&#x1F3D8;' :
               settlements[si].isCastle || settlements[si].type === 'Castle' ? '&#x1F3F0;' : '&#x1F33E;';
    matches.push({type:'settlement', icon:icon, name:settlements[si].name, id:settlements[si].id, category:'settlements'});
  }

  // Search kingdoms
  var kingdoms = (Store.kingdoms || []).filter(function(k) { return k.name && k.name.toLowerCase().includes(q); });
  for (var ki = 0; ki < Math.min(kingdoms.length, maxPerCat); ki++) {
    matches.push({type:'kingdom', icon:'&#x1F451;', name:kingdoms[ki].name, id:kingdoms[ki].id, category:'kingdoms'});
  }

  if (!matches.length) {
    results.innerHTML = '<div class="ee-search-empty">No results for "' + esc(q) + '"</div>';
  } else {
    var html = '';
    for (var mi = 0; mi < matches.length; mi++) {
      var m = matches[mi];
      html += '<div class="ee-search-result" onclick="openDetail(\'' + m.category + '\',\'' + esc(m.id) + '\');document.getElementById(\'globalSearchResults\').classList.remove(\'open\');document.getElementById(\'globalSearch\').value=\'\'">';
      html += '<span class="ee-search-result-icon">' + m.icon + '</span>';
      html += '<div class="ee-search-result-text">';
      html += '<div class="ee-search-result-name">' + esc(m.name) + '</div>';
      html += '<div class="ee-search-result-type">' + m.type + '</div>';
      html += '</div></div>';
    }
    results.innerHTML = html;
  }
  results.classList.add('open');
}

// ── Trade Routes Calculator ──
window._tradeFilter = 'all';
window._tradeSort = 'profit';
window._tradeSearch = '';
window._tradeRoutesData = [];

function setTradeFilter(f) { _tradeFilter = f; rerenderTradeRoutes(); }
function setTradeSort(v) { _tradeSort = v; rerenderTradeRoutes(); }
function setTradeSearch(v) { _tradeSearch = (v||'').toLowerCase(); rerenderTradeRoutes(); }

function _tradeCategory(itemName) {
  const t = (itemName || '').toLowerCase();
  if (/(grain|wheat|fish|meat|butter|cheese|olive|date|salt|honey|bread|wine|beer)/.test(t)) return 'food';
  if (/(linen|wool|silk|velvet|fur|cloth|leather|hide|flax)/.test(t)) return 'cloth';
  if (/(sword|axe|spear|bow|mace|hammer|shield|helmet|armor|mail|plate|polearm|crossbow|javelin|knife|club)/.test(t)) return 'weapons';
  if (/(horse|camel|mule|sumpter|pony|courser|charger|palfrey|warhorse|donkey|cattle|sheep|goat)/.test(t)) return 'beasts';
  if (/(iron|silver|gold|copper|tin|jewel|gem|pottery|tool)/.test(t)) return 'goods';
  return 'misc';
}

function _tradeIcon(cat) {
  return ({ food:'\u{1F35E}', cloth:'\u{1F9F5}', weapons:'\u{2694}', beasts:'\u{1F40E}', goods:'\u{1FA99}', misc:'\u{1F4E6}' })[cat] || '\u{1F4E6}';
}

async function showTradeRoutes() {
  document.querySelector('.trade-routes-overlay')?.remove();
  let m = '<div class="trade-routes-overlay" onclick="if(event.target===this)this.remove()">';
  m += '<div class="trade-routes-modal">';
  m += '<div class="trade-routes-embers"></div>';
  m += '<div class="tr-header">';
  m += '<div class="tr-camel">\u{1F42A}</div>';
  m += '<div class="tr-title-block">';
  m += '<div class="tr-kicker">\u{2606} Caravan Ledger</div>';
  m += '<div class="tr-title">Best Trade Routes</div>';
  m += '<div class="tr-subtitle">Most profitable buy/sell pairs across known towns</div>';
  m += '</div>';
  m += '<button class="tr-close" onclick="this.closest(\'.trade-routes-overlay\').remove()">&times;</button>';
  m += '</div>';
  m += '<div class="tr-body" id="tradeRoutesBody"><div class="loading-spinner" style="margin:50px auto"></div></div>';
  m += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', m);

  // Inject embers
  const em = document.querySelector('.trade-routes-embers');
  if (em) {
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('span');
      sp.style.left = (Math.random() * 100) + '%';
      sp.style.animationDuration = (12 + Math.random() * 12) + 's';
      sp.style.animationDelay = (Math.random() * 8) + 's';
      em.appendChild(sp);
    }
  }

  const data = await API.getTradeRoutes().catch(() => null) || {};
  _tradeRoutesData = data.routes || [];
  rerenderTradeRoutes();
}

function rerenderTradeRoutes() {
  const el = document.getElementById('tradeRoutesBody');
  if (!el) return;
  let routes = _tradeRoutesData.slice();
  if (routes.length === 0) {
    el.innerHTML = '<div class="tr-empty">\u{1F4ED} No profitable routes found.<br><span>Visit a few towns to discover their goods.</span></div>';
    return;
  }

  // Compute category for each
  routes.forEach(r => { r._cat = _tradeCategory(r.item); r._margin = r.buyPrice > 0 ? Math.round((r.profit / r.buyPrice) * 100) : 0; });

  // Filter
  let filtered = routes.slice();
  if (_tradeFilter === 'high') filtered = filtered.filter(r => r.profit >= 50);
  else if (_tradeFilter !== 'all') filtered = filtered.filter(r => r._cat === _tradeFilter);
  if (_tradeSearch) {
    filtered = filtered.filter(r => (r.item||'').toLowerCase().includes(_tradeSearch) || (r.buyTown||'').toLowerCase().includes(_tradeSearch) || (r.sellTown||'').toLowerCase().includes(_tradeSearch));
  }
  // Sort
  if (_tradeSort === 'profit') filtered.sort((a,b)=>(b.profit||0)-(a.profit||0));
  else if (_tradeSort === 'margin') filtered.sort((a,b)=>(b._margin||0)-(a._margin||0));
  else if (_tradeSort === 'item') filtered.sort((a,b)=>(a.item||'').localeCompare(b.item||''));
  else if (_tradeSort === 'buyTown') filtered.sort((a,b)=>(a.buyTown||'').localeCompare(b.buyTown||''));
  else if (_tradeSort === 'sellTown') filtered.sort((a,b)=>(a.sellTown||'').localeCompare(b.sellTown||''));

  // Stats
  const totalRoutes = routes.length;
  const maxProfit = Math.max(0, ...routes.map(r => r.profit || 0));
  const avgProfit = totalRoutes > 0 ? Math.round(routes.reduce((s,r)=>s+(r.profit||0),0) / totalRoutes) : 0;
  const uniqueItems = new Set(routes.map(r => r.item)).size;

  let h = '';

  // Stat header
  h += '<div class="tr-stats">';
  const sc = (icon,num,lbl,col) => `<div class="tr-stat" style="--tr-col:${col}"><span class="tr-stat-icon">${icon}</span><b class="tr-stat-num" data-count-target="${num}">0</b><span class="tr-stat-lbl">${lbl}</span></div>`;
  h += sc('\u{1F5FA}', totalRoutes, 'Routes', '#d4b878');
  h += sc('\u{1F4B0}', maxProfit, 'Max Profit', '#f5d878');
  h += sc('\u{1F4CA}', avgProfit, 'Avg Profit', '#c0a868');
  h += sc('\u{1F4E6}', uniqueItems, 'Items', '#80a0d0');
  h += '</div>';

  // Toolbar
  h += '<div class="tr-toolbar">';
  h += '<div class="tr-chips">';
  const chips = [['all','All'],['high','High Profit'],['food','\u{1F35E} Food'],['cloth','\u{1F9F5} Cloth'],['weapons','\u{2694} Weapons'],['beasts','\u{1F40E} Beasts'],['goods','\u{1FA99} Goods'],['misc','Misc']];
  chips.forEach(([k,label]) => {
    h += `<button class="tr-chip ${_tradeFilter===k?'active':''}" onclick="setTradeFilter('${k}')">${label}</button>`;
  });
  h += '</div>';
  h += `<input class="tr-search" type="text" placeholder="\u{1F50D} Search..." value="${esc(_tradeSearch)}" oninput="setTradeSearch(this.value)">`;
  h += `<select class="tr-sort" onchange="setTradeSort(this.value)">
    <option value="profit" ${_tradeSort==='profit'?'selected':''}>Profit</option>
    <option value="margin" ${_tradeSort==='margin'?'selected':''}>Margin %</option>
    <option value="item" ${_tradeSort==='item'?'selected':''}>Item A-Z</option>
    <option value="buyTown" ${_tradeSort==='buyTown'?'selected':''}>Buy Town</option>
    <option value="sellTown" ${_tradeSort==='sellTown'?'selected':''}>Sell Town</option>
  </select>`;
  h += '</div>';

  // Routes
  if (filtered.length === 0) {
    h += '<div class="tr-empty">\u{1F4ED} No routes match the filter.</div>';
  } else {
    h += '<div class="tr-list">';
    filtered.forEach((r, i) => {
      const cat = r._cat;
      const icon = _tradeIcon(cat);
      const profitClass = r.profit >= 100 ? 'huge' : r.profit >= 50 ? 'big' : '';
      h += `<div class="tr-route tr-cat-${cat}" style="animation-delay:${Math.min(i*0.025,0.6)}s">
        <div class="tr-route-side tr-buy" onclick="document.querySelector('.trade-routes-overlay')?.remove();invTrackSettlement('${esc(r.buyTownId)}','${esc(r.buyTown)}')">
          <div class="tr-side-label">BUY AT</div>
          <div class="tr-side-town">${esc(r.buyTown)}</div>
          <div class="tr-side-price">${r.buyPrice}\u{25C9}</div>
        </div>
        <div class="tr-route-arrow">
          <div class="tr-route-icon">${icon}</div>
          <div class="tr-route-item">${esc(r.item)}</div>
          <svg class="tr-route-line" viewBox="0 0 100 12" preserveAspectRatio="none">
            <line x1="0" y1="6" x2="100" y2="6" stroke="rgba(184,140,50,.4)" stroke-width="1" stroke-dasharray="3,3"/>
            <polygon points="92,2 100,6 92,10" fill="#d4b878"/>
          </svg>
          <div class="tr-route-margin">${r._margin}% margin</div>
        </div>
        <div class="tr-route-side tr-sell" onclick="document.querySelector('.trade-routes-overlay')?.remove();invTrackSettlement('${esc(r.sellTownId)}','${esc(r.sellTown)}')">
          <div class="tr-side-label">SELL AT</div>
          <div class="tr-side-town">${esc(r.sellTown)}</div>
          <div class="tr-side-price">${r.sellPrice}\u{25C9}</div>
        </div>
        <div class="tr-profit ${profitClass}">+${r.profit}<span>\u{25C9}</span></div>
      </div>`;
    });
    h += '</div>';
  }

  el.innerHTML = h;
  setTimeout(() => animateCounters(el), 60);
}

// ── Notifications Feed ──
function initNotifications() {
  var btn = document.getElementById('notifBtn');
  var panel = document.getElementById('notifPanel');
  if (!btn || !panel) return;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) refreshNotifications();
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.ee-notif-wrap')) panel.classList.remove('open');
  });

  // Initial fetch + every 30 seconds
  refreshNotifications();
  setInterval(refreshNotifications, 30000);
}

window._notifFilter = 'all';
window._notifSearch = '';
window._notifSeen = new Set(JSON.parse(localStorage.getItem('notifSeen') || '[]'));
window._notifDismissed = new Set(JSON.parse(localStorage.getItem('notifDismissed') || '[]'));
window._notifSnoozedUntil = parseInt(localStorage.getItem('notifSnoozedUntil') || '0');
window._notifLastData = [];

function setNotifFilter(f) { _notifFilter = f; rerenderNotifPanel(); }
function setNotifSearch(v) { _notifSearch = (v || '').toLowerCase(); rerenderNotifPanel(); }
function clearAllNotifications() {
  _notifLastData.forEach(n => _notifDismissed.add(_notifKey(n)));
  try { localStorage.setItem('notifDismissed', JSON.stringify([..._notifDismissed])); } catch(e) {}
  rerenderNotifPanel();
  showToast('All notifications dismissed');
}
function snoozeNotifications(mins) {
  _notifSnoozedUntil = Date.now() + mins * 60_000;
  try { localStorage.setItem('notifSnoozedUntil', String(_notifSnoozedUntil)); } catch(e) {}
  showToast(`Notifications snoozed for ${mins} min`);
  refreshNotifications();
}
function dismissNotification(key) {
  _notifDismissed.add(key);
  try { localStorage.setItem('notifDismissed', JSON.stringify([..._notifDismissed])); } catch(e) {}
  rerenderNotifPanel();
}
function _notifKey(n) {
  return (n.category || '') + '|' + (n.id || '') + '|' + (n.title || '');
}

async function refreshNotifications() {
  try {
    var data = await API.getNotifications();
    var notifs = data?.notifications || [];
    _notifLastData = notifs;
    rerenderNotifPanel();
  } catch (e) {
    console.warn('[Notifications] fetch failed:', e);
  }
}

function rerenderNotifPanel() {
  var notifs = (_notifLastData || []).slice();
  var badge = document.getElementById('notifBadge');
  var btn = document.getElementById('notifBtn');
  var panel = document.getElementById('notifPanel');
  if (!panel) return;

  // Drop dismissed
  notifs = notifs.filter(n => !_notifDismissed.has(_notifKey(n)));

  // Snooze: badge stays at 0 if snoozed
  var snoozed = Date.now() < _notifSnoozedUntil;

  // Counts by priority
  var counts = { critical:0, high:0, med:0, low:0 };
  notifs.forEach(n => { counts[n.priority||'med'] = (counts[n.priority||'med']||0) + 1; });

  // New arrivals (vs last seen)
  var newArrivals = notifs.filter(n => !_notifSeen.has(_notifKey(n)));
  if (badge) {
    if (notifs.length > 0 && !snoozed) {
      badge.textContent = notifs.length > 99 ? '99+' : notifs.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
  if (btn) btn.classList.toggle('has-new', newArrivals.length > 0 && !snoozed);

  // Apply filter + search
  var prioOrder = {critical:0, high:1, med:2, low:3};
  var filtered = notifs.filter(n => {
    if (_notifFilter !== 'all') {
      if (['critical','high','med','low'].includes(_notifFilter)) {
        if ((n.priority||'med') !== _notifFilter) return false;
      } else {
        // Category filter
        var cat = (n.type || n.category || '').toLowerCase();
        if (!cat.includes(_notifFilter.toLowerCase())) return false;
      }
    }
    if (_notifSearch) {
      var hay = ((n.title||'') + ' ' + (n.desc||'')).toLowerCase();
      if (!hay.includes(_notifSearch)) return false;
    }
    return true;
  });
  filtered.sort((a,b) => (prioOrder[a.priority]||9) - (prioOrder[b.priority]||9));

  var h = '';

  // Header
  h += '<div class="ee-notif-header">';
  h += '<span class="ee-notif-header-title">\u{1F514} Notifications</span>';
  h += '<span class="ee-notif-header-count">' + notifs.length + ' total</span>';
  h += '</div>';

  // Counts strip
  h += '<div class="ee-notif-counts">';
  if (counts.critical > 0) h += '<div class="enc enc-critical"><b>' + counts.critical + '</b><span>Critical</span></div>';
  if (counts.high > 0) h += '<div class="enc enc-high"><b>' + counts.high + '</b><span>High</span></div>';
  if (counts.med > 0) h += '<div class="enc enc-med"><b>' + counts.med + '</b><span>Med</span></div>';
  if (counts.low > 0) h += '<div class="enc enc-low"><b>' + counts.low + '</b><span>Low</span></div>';
  if (notifs.length === 0) h += '<div class="enc enc-empty"><b>0</b><span>Pending</span></div>';
  h += '</div>';

  // Toolbar — filter chips + search + actions
  h += '<div class="ee-notif-toolbar">';
  h += '<div class="ee-notif-chips">';
  ['all','critical','high','med','low'].forEach(k => {
    h += '<button class="ee-notif-chip ' + (_notifFilter===k?'active':'') + '" onclick="setNotifFilter(\'' + k + '\')">' + (k === 'all' ? 'All' : k[0].toUpperCase()+k.slice(1)) + '</button>';
  });
  h += '</div>';
  h += '<input class="ee-notif-search" type="text" placeholder="\u{1F50D} Search..." value="' + esc(_notifSearch) + '" oninput="setNotifSearch(this.value)">';
  h += '<div class="ee-notif-actions">';
  h += '<button class="ee-notif-act-btn" onclick="snoozeNotifications(60)" title="Snooze for 1 hour">\u{1F4A4} 1h</button>';
  if (notifs.length > 0) h += '<button class="ee-notif-act-btn" onclick="clearAllNotifications()" title="Dismiss all">\u{1F5D1} Clear</button>';
  h += '</div>';
  h += '</div>';

  // List
  if (snoozed) {
    var minsLeft = Math.ceil((_notifSnoozedUntil - Date.now()) / 60_000);
    h += '<div class="ee-notif-empty">\u{1F4A4} Snoozed for ' + minsLeft + ' more minute' + (minsLeft !== 1 ? 's' : '') + '</div>';
  } else if (filtered.length === 0) {
    if (notifs.length === 0) h += '<div class="ee-notif-empty"><div class="ee-notif-empty-icon">\u{1F54A}</div>All quiet on the steppe</div>';
    else h += '<div class="ee-notif-empty">No notifications match the filter</div>';
  } else {
    h += '<div class="ee-notif-list">';
    filtered.forEach((n, i) => {
      var key = _notifKey(n);
      var isNew = !_notifSeen.has(key);
      var clickAction = n.id && n.category ? 'onclick="openDetail(\'' + esc(n.category) + '\',\'' + esc(n.id) + '\');document.getElementById(\'notifPanel\').classList.remove(\'open\')"' : '';
      h += '<div class="ee-notif-item priority-' + (n.priority||'med') + (isNew ? ' is-new' : '') + '" style="animation-delay:' + (i*0.04) + 's" data-key="' + esc(key) + '" ' + clickAction + '>';
      h += '<div class="ee-notif-icon">' + (n.icon || '&#x26A0;') + '</div>';
      h += '<div class="ee-notif-text">';
      h += '<div class="ee-notif-title">' + esc(n.title) + (isNew ? ' <span class="ee-notif-new">NEW</span>' : '') + '</div>';
      h += '<div class="ee-notif-desc">' + esc(n.desc) + '</div>';
      h += '</div>';
      h += '<button class="ee-notif-dismiss" onclick="event.stopPropagation();dismissNotification(\'' + esc(key) + '\')" title="Dismiss">&times;</button>';
      h += '</div>';
    });
    h += '</div>';
  }

  panel.innerHTML = h;

  // Mark all current ones as seen on next tick
  setTimeout(() => {
    notifs.forEach(n => _notifSeen.add(_notifKey(n)));
    try { localStorage.setItem('notifSeen', JSON.stringify([..._notifSeen])); } catch(e) {}
    if (btn) btn.classList.remove('has-new');
  }, 800);
}

// ── Scroll-triggered reveal animations ──
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.section-head, .summary-grid, .categories, .live-chronicle, .sword-divider').forEach(el => {
    el.classList.add('scroll-reveal');
    observer.observe(el);
  });
}

// ── Web Settings (from MCM) ──
const WebSettings = {
  liveSyncEnabled: true, liveSyncInterval: 8,
  liveChronicleEnabled: true, editingEnabled: true,
  showHud: true, showIntro: true,
  showEmberParticles: true, showGoldSparks: true,
  enableSounds: true, enableScrollAnimations: true,
  cardsPerPage: 60, portraitExtractionEnabled: true
};

async function loadWebSettings() {
  try {
    const s = await API.getWebSettings();
    if (s) Object.assign(WebSettings, s);
    // Apply settings
    Store.pageSize = WebSettings.cardsPerPage;
    if (!WebSettings.showIntro) {
      const intro = document.getElementById('introOverlay');
      if (intro) intro.style.display = 'none';
    }
  } catch (e) { console.warn('[Settings]', e); }
}

// ── Init ──
async function init() {
  // Load MCM web settings first
  await loadWebSettings();
  // Dismiss intro overlay after data loads (min 3.5s for animation to complete)
  const introStart = performance.now();
  await loadData();
  renderHome();
  await Promise.all(['heroes', 'clans', 'settlements', 'kingdoms'].map(renderList));
  const chronicleData = await renderChronicle();
  renderLiveChronicle(chronicleData);
  initScrollReveal();
  initGlobalSearch();
  initNotifications();

  // Auto-dismiss intro after animation completes (only if user already clicked to start)
  const elapsed = performance.now() - introStart;
  const remaining = Math.max(8000 - elapsed, 0);
  setTimeout(() => {
    if (_introStarted) dismissIntro();
  }, remaining);

  // Auto-extract game portraits in background (only if campaign is active)
  try {
    const hasPortraits = Object.keys(Store._exportedPortraits || {}).length;
    const hasCampaign = Store.heroes.length > 0;
    if (hasPortraits < 10 && hasCampaign && WebSettings.portraitExtractionEnabled) {
      console.log('[Portraits] Extracting game portraits...');
      const result = await API.extractPortraits();
      if (result?.extracted > 0) {
        console.log('[Portraits] Extracted ' + result.extracted + ' portraits, reloading...');
        const portraits = await API.getPortraitList();
        Store._exportedPortraits = {};
        (portraits?.exported || []).forEach(id => { Store._exportedPortraits[id] = true; });
        Store._portraitCacheBust = '?t=' + Date.now();
        await renderList('heroes');
      }
    }
  } catch (e) { console.warn('[Portraits] Extraction failed:', e); }

  // Periodically check for new portraits (extraction runs in background across many frames)
  setInterval(async () => {
    try {
      const portraits = await API.getPortraitList();
      const newCount = (portraits?.exported || []).length;
      const oldCount = Object.keys(Store._exportedPortraits || {}).length;
      if (newCount > oldCount) {
        Store._exportedPortraits = {};
        (portraits?.exported || []).forEach(id => { Store._exportedPortraits[id] = true; });
        Store._portraitCacheBust = '?t=' + Date.now();
        console.log('[Portraits] ' + newCount + ' portraits available (was ' + oldCount + ')');
        if (Store.currentPage === 'heroes') await renderList('heroes');
      }
    } catch {}
  }, 30000); // check every 30 seconds

  // Auto-refresh every 15 seconds — only refreshes the current page
  setInterval(async () => {
    await refreshData();
    await refreshCurrentPage();
  }, 15000);

  // Player HUD — update every 5 seconds
  const _prevHud = {};
  let _hudFirstLoad = true;
  function hudSet(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = _prevHud[id];
    el.textContent = value;
    if (prev !== undefined && prev !== value) {
      el.classList.remove('hud-val-changed');
      void el.offsetWidth;
      el.classList.add('hud-val-changed');
      // Play sound on value change (skip first load)
      if (!_hudFirstLoad && typeof UISounds !== 'undefined') {
        const parseNum = v => parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
        const cur = parseNum(value), pre = parseNum(prev);
        if (id === 'hud-gold') {
          cur > pre ? UISounds.coinClink(0) : UISounds.click();
        } else if (id === 'hud-troops') {
          cur > pre ? UISounds.armorRattle() : UISounds.click();
        } else if (id === 'hud-hp' && cur < pre) {
          // Health dropped — warning sound
          try {
            const c = new (window.AudioContext || window.webkitAudioContext)();
            const t = c.currentTime;
            const o = c.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(400, t); o.frequency.linearRampToValueAtTime(200, t + 0.2);
            const g = c.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.linearRampToValueAtTime(0, t + 0.3);
            o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35);
          } catch {}
        } else if (id === 'hud-morale') {
          UISounds.softCoin();
        } else if (id === 'hud-food') {
          cur < pre ? UISounds.click() : UISounds.softCoin();
        } else if (id === 'hud-influence') {
          UISounds.softCoin();
        }
      }
    }
    _prevHud[id] = value;
  }
  function tipHtml(title, val, rows, totalLabel, totalVal) {
    let h = `<div class="hud-tip-title"><span>${title}</span><span>${val}</span></div>`;
    rows.forEach(r => {
      const cls = r[2] || (String(r[1]).startsWith('+') ? 'pos' : String(r[1]).startsWith('-') ? 'neg' : '');
      h += `<div class="hud-tip-row"><span class="lbl">${r[0]}</span><span class="val ${cls}">${r[1]}</span></div>`;
    });
    if (totalLabel) h += `<div class="hud-tip-total"><span>${totalLabel}</span><span class="val">${totalVal}</span></div>`;
    return h;
  }

  async function updateHud() {
    try {
      const s = await API.getStatus();
      if (!s?.ok) return;
      const el = (id) => document.getElementById(id);
      const fmt = (v) => v >= 10000 ? (v/1000).toFixed(1)+'K' : v >= 1000 ? v.toLocaleString() : String(v);

      hudSet('hud-gold', fmt(s.gold));
      hudSet('hud-speed', s.speed || '-');
      hudSet('hud-hp', s.hitPoints + '%');
      hudSet('hud-troops', String(s.troops));
      hudSet('hud-food', s.food || '0');
      hudSet('hud-morale', String(Math.round(s.morale || 0)));
      hudSet('hud-influence', fmt(Math.round(s.influence || 0)));
      hudSet('hud-wage', fmt(s.dailyWage || 0));

      // Dynamic tooltips matching in-game style
      const fc = s.foodChange || 0;
      const fcStr = (fc >= 0 ? '+' : '') + fc.toFixed(2);
      el('hud-tip-gold').innerHTML = tipHtml('Gold', fmt(s.gold), [
        ['Daily Wage', '-' + fmt(s.dailyWage || 0), 'neg']
      ]);
      el('hud-tip-speed').innerHTML = tipHtml('Party Speed', s.speed, [], 'Total', '+' + s.speed);
      el('hud-tip-hp').innerHTML = tipHtml('Hit Points', s.hitPoints, [
        ['Max. Hit Points', s.maxHitPoints || 100]
      ]);
      el('hud-tip-troops').innerHTML = tipHtml('Battle Ready Troops', s.troops - (s.wounded||0), [
        ['Wounded Troops', s.wounded || 0],
        ['Troop Capacity', s.troops + '/' + (s.troopLimit || '?')]
      ]);
      el('hud-tip-food').innerHTML = tipHtml('Food', s.food, [
        ['Expected Change', fcStr, fc >= 0 ? 'pos' : 'neg'],
        ['Days until no food', s.daysOfFood || '-']
      ]);
      el('hud-tip-morale').innerHTML = tipHtml('Party Morale', Math.round(s.morale || 0), []);
      el('hud-tip-influence').innerHTML = tipHtml('Influence', Math.round(s.influence || 0), []);
      el('hud-tip-wage').innerHTML = tipHtml('Daily Party Wage', '', [], 'Total', fmt(s.dailyWage || 0));

      // Ship health — only show if Naval DLC is active and data is present
      const shipEl = document.getElementById('hud-s-ship');
      if (s.shipHealth != null && s.shipHealth >= 0) {
        const shipPct = s.shipMaxHealth > 0 ? Math.round(s.shipHealth / s.shipMaxHealth * 100) : 100;
        el('hud-ship').textContent = shipPct + '%';
        el('hud-tip-ship').innerHTML = tipHtml('Ship Health', s.shipHealth, [
          ['Max. Ship Health', s.shipMaxHealth || '-']
        ]);
        shipEl.style.display = '';
      } else {
        shipEl.style.display = 'none';
      }

      document.getElementById('playerHud').classList.add('hud-visible');
      _hudFirstLoad = false;
    } catch { }
  }
  updateHud();
  setInterval(updateHud, 5000);
}

// ── UI Sound System (Bannerlord-style) ──
const UISounds = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Soft leather/parchment click — for nav, buttons, filters
  function click() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Short noise burst filtered to sound like a soft tap on leather
    const len = c.sampleRate * 0.06;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 80) * 0.5;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = 0.12;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Page turn — soft whoosh for page transitions
  function pageTurn() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Filtered noise sweep — sounds like turning a page or unfurling parchment
    const len = c.sampleRate * 0.25;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 12) * 0.3;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(2000, t);
    f.frequency.linearRampToValueAtTime(400, t + 0.2);
    f.Q.value = 0.5;
    const g = c.createGain(); g.gain.value = 0.08;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Detail open — soft chime, like opening a scroll or book
  function openScroll() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Two soft sine tones (perfect fifth) with quick decay
    [440, 660].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + i * 0.05);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.05 + 0.02);
      g.gain.linearRampToValueAtTime(0, t + i * 0.05 + 0.3);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000;
      osc.connect(f); f.connect(g); g.connect(c.destination);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.35);
    });
  }

  // Hover — very subtle tick
  function hover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.02, t);
    g.gain.linearRampToValueAtTime(0, t + 0.04);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.05);
  }

  // War card hover — distant battle ambiance (clashing metal + crowd)
  let _warSoundActive = null;
  function warHover() {
    if (_warSoundActive) return;
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const master = c.createGain();
    master.gain.value = 0.35;
    master.connect(c.destination);

    // Crowd/battle noise — filtered white noise with slow modulation
    const noiseLen = c.sampleRate * 3;
    const noiseBuf = c.createBuffer(1, noiseLen, c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1);
    const noise = c.createBufferSource(); noise.buffer = noiseBuf;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 0.4;
    const nLfo = c.createOscillator(); const nLfoG = c.createGain();
    nLfo.frequency.value = 0.8; nLfoG.gain.value = 200;
    nLfo.connect(nLfoG); nLfoG.connect(nf.frequency);
    nLfo.start(t); nLfo.stop(t + 3);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.4, t + 0.3);
    ng.gain.setValueAtTime(0.4, t + 2.2);
    ng.gain.linearRampToValueAtTime(0, t + 3);
    noise.connect(nf); nf.connect(ng); ng.connect(master);
    noise.start(t); noise.stop(t + 3);

    // Sword clashes — metallic ring with sharp attack
    for (let i = 0; i < 8; i++) {
      const clashTime = 0.1 + Math.random() * 2.2;
      const clashLen = c.sampleRate * 0.2;
      const clashBuf = c.createBuffer(1, clashLen, c.sampleRate);
      const cd = clashBuf.getChannelData(0);
      const freq1 = 3000 + Math.random() * 3000; // high metallic ring
      const freq2 = 1500 + Math.random() * 2000; // secondary ring
      for (let j = 0; j < clashLen; j++) {
        const s = j / c.sampleRate;
        // Sharp attack noise + metallic ringing sine
        const attack = (Math.random() * 2 - 1) * Math.exp(-s * 60);
        const ring1 = Math.sin(2 * Math.PI * freq1 * s) * Math.exp(-s * 20) * 0.4;
        const ring2 = Math.sin(2 * Math.PI * freq2 * s) * Math.exp(-s * 15) * 0.25;
        cd[j] = (attack * 0.5 + ring1 + ring2);
      }
      const clash = c.createBufferSource(); clash.buffer = clashBuf;
      const cg = c.createGain(); cg.gain.value = 0.2 + Math.random() * 0.2;
      clash.connect(cg); cg.connect(master);
      clash.start(t + clashTime);
    }

    // Low war horn in background
    const horn = c.createOscillator();
    horn.type = 'sawtooth'; horn.frequency.value = 55;
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 200; hf.Q.value = 1;
    const hg = c.createGain();
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.1, t + 0.5);
    hg.gain.setValueAtTime(0.1, t + 2);
    hg.gain.linearRampToValueAtTime(0, t + 3);
    horn.connect(hf); hf.connect(hg); hg.connect(master);
    horn.start(t); horn.stop(t + 3);

    _warSoundActive = { master, timeout: setTimeout(() => { _warSoundActive = null; }, 3000) };
  }

  function warLeave() {
    if (_warSoundActive) {
      try {
        const c = getCtx();
        if (c) _warSoundActive.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
      } catch {}
      clearTimeout(_warSoundActive.timeout);
      _warSoundActive = null;
    }
  }

  // Kingdom card hover — royal horn note
  function kingdomHover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Single soft horn note
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 130;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350; f.Q.value = 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    osc.connect(f); f.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.45);
  }

  // Power Rankings hover — ascending scale note
  let _lastRankRow = null;
  function rankHover(index) {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Note from scale based on rank position (higher rank = lower pitch)
    const notes = [130, 146, 164, 174, 196, 220, 246, 261, 293];
    const freq = notes[Math.min(index, notes.length - 1)] || 200;
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.2);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.25);
  }

  // Donut segment hover — soft chime at segment frequency
  function donutHover(index) {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const freq = 300 + index * 60;
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.02);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.3);
  }

  // War network node hover — deep resonant thud
  function networkNodeHover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.35);
    // Attack click
    const len = c.sampleRate * 0.03;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / c.sampleRate * 100) * 0.3;
    const src = c.createBufferSource(); src.buffer = buf;
    const sg = c.createGain(); sg.gain.value = 0.12;
    src.connect(sg); sg.connect(c.destination);
    src.start(t);
  }

  // Comparison select — regal chord
  function compareSelect() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    [196, 246, 330].forEach((freq, i) => {
      const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + i * 0.04);
      g.gain.linearRampToValueAtTime(0.04, t + i * 0.04 + 0.03);
      g.gain.linearRampToValueAtTime(0, t + i * 0.04 + 0.35);
      osc.connect(g); g.connect(c.destination);
      osc.start(t + i * 0.04); osc.stop(t + i * 0.04 + 0.4);
    });
  }

  // Settlement card hover — wooden creak/gate sound
  function settlementHover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Wooden creak — low filtered noise with pitch bend
    const len = c.sampleRate * 0.15;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      const creak = Math.sin(2 * Math.PI * (200 + 100 * s) * s) * Math.exp(-s * 15);
      d[i] = creak * 0.5 + (Math.random() * 2 - 1) * Math.exp(-s * 30) * 0.2;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1;
    const g = c.createGain(); g.gain.value = 0.12;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Prosperity row hover — coin clink
  function coinClink(index) {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const freq = 2500 + index * 200;
    // High metallic ping — like a coin dropping
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 1.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.linearRampToValueAtTime(0, t + 0.15);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.03, t);
    g2.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.connect(g); g.connect(c.destination);
    osc2.connect(g2); g2.connect(c.destination);
    osc.start(t); osc.stop(t + 0.2);
    osc2.start(t); osc2.stop(t + 0.15);
  }

  // Territory bar hover — stone placement thud
  function stonePlace() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.2);
  }

  // Garrison hover — armor rattle
  function armorRattle() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Multiple quick metallic taps
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.04;
      const freq = 1800 + Math.random() * 1500;
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.04, t + delay + 0.01);
      g.gain.linearRampToValueAtTime(0, t + delay + 0.08);
      osc.connect(g); g.connect(c.destination);
      osc.start(t + delay); osc.stop(t + delay + 0.1);
    }
  }

  // Economy hover — market bustle (coins + chatter)
  function marketBustle() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Quick coin cascade
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.06;
      const freq = 3000 + i * 400;
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.03, t + delay);
      g.gain.linearRampToValueAtTime(0, t + delay + 0.1);
      osc.connect(g); g.connect(c.destination);
      osc.start(t + delay); osc.stop(t + delay + 0.12);
    }
  }

  // Clan card hover — banner unfurl (fabric whoosh)
  function clanHover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const len = c.sampleRate * 0.18;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 18) * 0.4;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.linearRampToValueAtTime(400, t + 0.15);
    f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.1;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Hero card hover — subtle chainmail/leather equip
  function heroHover() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Leather creak + light metal
    const len = c.sampleRate * 0.1;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      const leather = Math.sin(2 * Math.PI * 300 * s) * Math.exp(-s * 25) * 0.3;
      const metal = Math.sin(2 * Math.PI * 1800 * s) * Math.exp(-s * 50) * 0.15;
      d[i] = leather + metal + (Math.random() * 2 - 1) * Math.exp(-s * 40) * 0.15;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = 0.1;
    src.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Home — Grand Archive stat hover (quill on parchment)
  function quillScratch() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const len = c.sampleRate * 0.12;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 20) * 0.3
        + Math.sin(2 * Math.PI * 1500 * s) * Math.exp(-s * 35) * 0.1;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 800;
    const g = c.createGain(); g.gain.value = 0.08;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Home — Browse Section card hover (heavy book thud)
  function bookOpen() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    // Deep thud + page rustle
    const osc = c.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.linearRampToValueAtTime(0, t + 0.18);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.2);
    // Rustle
    const len = c.sampleRate * 0.2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 15) * 0.2;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.5;
    const rg = c.createGain(); rg.gain.value = 0.06;
    src.connect(f); f.connect(rg); rg.connect(c.destination);
    src.start(t + 0.03);
  }

  // Home — Player Summary stat hover (soft coin)
  function softCoin() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 2200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.12);
  }

  // Home — World Status item hover (torch flicker)
  function torchFlicker() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const len = c.sampleRate * 0.15;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 20) * 0.15;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = c.createGain(); g.gain.value = 0.1;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Chronicle event hover (parchment unfold)
  function parchmentUnfold() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const len = c.sampleRate * 0.1;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = i / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-s * 25) * 0.25;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(1500, t);
    f.frequency.linearRampToValueAtTime(600, t + 0.08);
    f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.06;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Short war click — sword unsheathe + horn stab
  function _warClick() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const master = c.createGain(); master.gain.value = 0.4; master.connect(c.destination);

    // Metallic sword unsheathe
    const sLen = c.sampleRate * 0.3;
    const sBuf = c.createBuffer(1, sLen, c.sampleRate);
    const sd = sBuf.getChannelData(0);
    for (let i = 0; i < sLen; i++) {
      const s = i / c.sampleRate;
      const ring = Math.sin(2 * Math.PI * 4000 * s) * Math.exp(-s * 15) * 0.3;
      const scrape = (Math.random() * 2 - 1) * Math.exp(-s * 10) * 0.5;
      sd[i] = ring + scrape;
    }
    const sword = c.createBufferSource(); sword.buffer = sBuf;
    const sf = c.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 2000;
    const sg = c.createGain(); sg.gain.value = 0.3;
    sword.connect(sf); sf.connect(sg); sg.connect(master);
    sword.start(t);

    // Short war horn stab
    const horn = c.createOscillator();
    horn.type = 'sawtooth'; horn.frequency.value = 80;
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 250;
    const hg = c.createGain();
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.15, t + 0.05);
    hg.gain.linearRampToValueAtTime(0, t + 0.4);
    horn.connect(hf); hf.connect(hg); hg.connect(master);
    horn.start(t); horn.stop(t + 0.5);
  }

  // Single sword clash — sharp metal hit with ringing decay
  function _swordClash() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);

    // Impact — sharp noise burst
    const impLen = c.sampleRate * 0.05;
    const impBuf = c.createBuffer(1, impLen, c.sampleRate);
    const id = impBuf.getChannelData(0);
    for (let i = 0; i < impLen; i++) {
      const s = i / c.sampleRate;
      id[i] = (Math.random() * 2 - 1) * Math.exp(-s * 80);
    }
    const imp = c.createBufferSource(); imp.buffer = impBuf;
    const ig = c.createGain(); ig.gain.value = 0.6;
    imp.connect(ig); ig.connect(master);
    imp.start(t);

    // Metallic ring — two high sine tones with fast decay
    const f1 = 3200 + Math.random() * 800;
    const f2 = 5000 + Math.random() * 1000;
    const ring1 = c.createOscillator(); ring1.frequency.value = f1; ring1.type = 'sine';
    const ring2 = c.createOscillator(); ring2.frequency.value = f2; ring2.type = 'sine';
    const rg1 = c.createGain(); rg1.gain.setValueAtTime(0.3, t); rg1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const rg2 = c.createGain(); rg2.gain.setValueAtTime(0.15, t); rg2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ring1.connect(rg1); rg1.connect(master);
    ring2.connect(rg2); rg2.connect(master);
    ring1.start(t); ring1.stop(t + 0.5);
    ring2.start(t); ring2.stop(t + 0.3);

    // Low body thud
    const thud = c.createOscillator(); thud.frequency.value = 120; thud.type = 'sine';
    const tg = c.createGain(); tg.gain.setValueAtTime(0.2, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thud.connect(tg); tg.connect(master);
    thud.start(t); thud.stop(t + 0.2);
  }

  // War drums — deep rhythmic thuds
  function _warDrums() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);

    const beats = [0, 0.18, 0.36, 0.60];
    beats.forEach((offset, i) => {
      // Deep drum hit
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i < 3 ? 60 : 45, t + offset);
      osc.frequency.exponentialRampToValueAtTime(30, t + offset + 0.2);
      const g = c.createGain();
      g.gain.setValueAtTime(i === 3 ? 0.7 : 0.5, t + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);
      osc.connect(g); g.connect(master);
      osc.start(t + offset); osc.stop(t + offset + 0.35);

      // Attack noise — skin slap
      const nLen = c.sampleRate * 0.04;
      const nBuf = c.createBuffer(1, nLen, c.sampleRate);
      const nd = nBuf.getChannelData(0);
      for (let j = 0; j < nLen; j++) {
        nd[j] = (Math.random() * 2 - 1) * Math.exp(-(j / c.sampleRate) * 150);
      }
      const ns = c.createBufferSource(); ns.buffer = nBuf;
      const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 400;
      const ng = c.createGain(); ng.gain.value = i === 3 ? 0.5 : 0.35;
      ns.connect(nf); nf.connect(ng); ng.connect(master);
      ns.start(t + offset);
    });
  }

  return { click, pageTurn, openScroll, hover, warHover, warLeave, _warClick, _swordClash, _warDrums,
           kingdomHover, rankHover, donutHover, networkNodeHover, compareSelect,
           settlementHover, coinClink, stonePlace, armorRattle, marketBustle,
           clanHover, heroHover, quillScratch, bookOpen, softCoin, torchFlicker, parchmentUnfold };
})();

// Hook sounds into UI interactions
// Nav clicks
document.getElementById('mainNav')?.addEventListener('click', e => {
  if (e.target.closest('a[data-page]')) UISounds.pageTurn();
});
// Filter clicks (side-link sound handled by setFilter, only tag-filter here)
document.addEventListener('click', e => {
  if (e.target.closest('.tag-filter')) UISounds.click();
});
// Card clicks — each type gets a distinct sound
document.addEventListener('click', e => {
  const kc = e.target.closest('.kingdom-card');
  if (kc) {
    UISounds.pageTurn();
    return;
  }
  if (e.target.closest('.war-card')) { UISounds.armorRattle(); return; }
  if (e.target.closest('.hero-card')) { UISounds.heroHover(); return; }
  if (e.target.closest('.clan-card')) { UISounds.clanHover(); return; }
  if (e.target.closest('.sett-card')) { UISounds.pageTurn(); return; }
  if (e.target.closest('.card, .entity-card')) UISounds.click();
});
// Nav hover sounds
document.querySelectorAll('.nav a').forEach(a => {
  a.addEventListener('mouseenter', () => UISounds.hover());
});
// War card hover
let _lastWarCard = null;
document.addEventListener('mouseover', e => {
  const warCard = e.target.closest('.war-card');
  if (warCard && warCard !== _lastWarCard) {
    _lastWarCard = warCard;
    UISounds.pageTurn();
  } else if (!warCard && _lastWarCard && !e.target.closest('.war-card')) {
    _lastWarCard = null;
  }
});

// Kingdom card hover — sword clash for at-war, royal horn for peaceful
let _lastKingdomCard = null;
document.addEventListener('mouseover', e => {
  const kc = e.target.closest('.kingdom-card');
  if (kc && kc !== _lastKingdomCard) {
    _lastKingdomCard = kc;
    UISounds.pageTurn();
  } else if (!kc && _lastKingdomCard) {
    _lastKingdomCard = null;
  }
});

// Custom game-style tooltip for skills & traits
(function(){
  const tip = document.createElement('div');
  tip.className = 'game-tooltip';
  tip.style.display = 'none';
  document.body.appendChild(tip);
  let activeTile = null;

  document.addEventListener('mouseover', e => {
    const tile = e.target.closest('[data-tip-name]');
    if (tile && tile !== activeTile) {
      activeTile = tile;
      const name = tile.dataset.tipName;
      const val = tile.dataset.tipVal;
      const desc = tile.dataset.tipDesc;
      const clanData = tile.dataset.tipClan;

      if (clanData) {
        // Structured clan tooltip
        const rows = clanData.split(';;').map(row => {
          const [label, value] = row.split('|');
          return `<div class="gtt-row"><span class="gtt-label">${label}</span><span class="gtt-value">${value}</span></div>`;
        }).join('');
        tip.innerHTML = `<div class="gtt-header"><span class="gtt-name">${name}</span></div><div class="gtt-clan-body">${rows}</div>`;
      } else {
        const descHtml = desc ? desc.replace(/\n/g, '<br>') : '';
        tip.innerHTML = `<div class="gtt-header"><span class="gtt-name">${name}</span>${val ? `<span class="gtt-val">${val}</span>` : ''}</div>${descHtml ? `<div class="gtt-desc">${descHtml}</div>` : ''}`;
      }
      tip.style.display = 'block';
    } else if (!tile && activeTile) {
      activeTile = null;
      tip.style.display = 'none';
    }
  });

  document.addEventListener('mousemove', e => {
    if (tip.style.display === 'block') {
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
      const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 10);
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
  });

  document.addEventListener('mouseout', e => {
    const tile = e.target.closest('[data-tip-name]');
    if (tile && tile === activeTile) {
      const related = e.relatedTarget;
      if (!related || !tile.contains(related)) {
        activeTile = null;
        tip.style.display = 'none';
      }
    }
  });

  // ── Native title="" interception → themed tooltip ──
  let titleActive = null;
  document.addEventListener('mouseover', e => {
    if (activeTile) return; // data-tip-name takes priority
    const el = e.target.closest('[title]');
    if (!el || el === titleActive) return;
    const t = el.getAttribute('title');
    if (!t) return;
    // Stash original so accessibility tools can recover it on focus
    el.setAttribute('data-orig-title', t);
    el.removeAttribute('title');
    titleActive = el;
    tip.innerHTML = `<div class="gtt-header"><span class="gtt-name">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span></div>`;
    tip.style.display = 'block';
  });
  document.addEventListener('mouseout', e => {
    if (!titleActive) return;
    const related = e.relatedTarget;
    if (related && titleActive.contains(related)) return;
    const t = titleActive.getAttribute('data-orig-title');
    if (t) titleActive.setAttribute('title', t);
    titleActive.removeAttribute('data-orig-title');
    titleActive = null;
    if (!activeTile) tip.style.display = 'none';
  });
})();

// Power Rankings row hover
document.addEventListener('mouseover', e => {
  const row = e.target.closest('.kr-row');
  if (row) UISounds.pageTurn();
});

// Power Balance donut segment hover
document.addEventListener('mouseover', e => {
  if (e.target.closest('.donut-seg')) UISounds.pageTurn();
});

// War Network node hover
document.addEventListener('mouseover', e => {
  if (e.target.closest('.kr-net-node')) UISounds.pageTurn();
});

// Kingdom Comparison select change
document.addEventListener('change', e => {
  if (e.target.id === 'kr-compare-a' || e.target.id === 'kr-compare-b') UISounds.pageTurn();
});

// Settlement card hover — wooden creak
let _lastSettCard = null;
document.addEventListener('mouseover', e => {
  const sc = e.target.closest('.sett-card');
  if (sc && sc !== _lastSettCard) { _lastSettCard = sc; UISounds.pageTurn(); }
  else if (!sc) _lastSettCard = null;
});

// Clan card hover — banner unfurl
let _lastClanCard = null;
document.addEventListener('mouseover', e => {
  const cc = e.target.closest('.clan-card');
  if (cc && cc !== _lastClanCard) { _lastClanCard = cc; UISounds.clanHover(); }
  else if (!cc) _lastClanCard = null;
});

// Hero card hover — leather equip
let _lastHeroCard = null;
document.addEventListener('mouseover', e => {
  const hc = e.target.closest('.hero-card');
  if (hc && hc !== _lastHeroCard) { _lastHeroCard = hc; UISounds.heroHover(); }
  else if (!hc) _lastHeroCard = null;
});

// HUD stat hover
document.addEventListener('mouseover', e => {
  if (e.target.closest('.hud-stat')) UISounds.hover();
});

// Detail page sounds
document.addEventListener('mouseover', e => {
  // Entity grid cards (Members, Fiefs, Notables, Enemies, Friends, Family, Wars, Clans, etc.)
  const ec = e.target.closest('.entity-card');
  if (ec) {
    if (ec.classList.contains('relation-enemy')) UISounds.hover(); // subtle for enemies
    else if (ec.classList.contains('relation-friend')) UISounds.hover();
    else if (ec.closest('.entity-grid')) UISounds.hover();
    return;
  }
  // Clan tier badge
  if (e.target.closest('.cc-detail-tier')) { UISounds.softCoin(); return; }
  // Clan territory cards
  if (e.target.closest('.cc-terr-item')) { UISounds.stonePlace(); return; }
  // Clan power gauges
  if (e.target.closest('.sd-gauge')) { UISounds.softCoin(); return; }
  // Settlement military bar
  if (e.target.closest('.sd-mil-bar')) { UISounds.armorRattle(); return; }
  // Workshop cards
  if (e.target.closest('.sd-ws-card')) { UISounds.marketBustle(); return; }
  // Owner panel
  if (e.target.closest('.owner-panel')) { UISounds.hover(); return; }
  // Part-of panel
  if (e.target.closest('.part-of-panel')) { UISounds.hover(); return; }
  // Clan leader panel
  if (e.target.closest('.clan-leader-panel')) { UISounds.hover(); return; }
  // Stat grid items
  if (e.target.closest('.stat-grid .stat')) { UISounds.hover(); return; }
  // Timeline events in detail
  if (e.target.closest('.detail-content .event')) { UISounds.parchmentUnfold(); return; }
  // Section headers
  if (e.target.closest('.detail-content .section h3')) { UISounds.click(); return; }
});

// Home page sounds
document.addEventListener('mouseover', e => {
  // Grand Archive stats
  if (e.target.closest('.summary')) { UISounds.quillScratch(); return; }
  // Browse Section cards
  if (e.target.closest('.cat-card')) { UISounds.bookOpen(); return; }
  // Player Summary stats
  if (e.target.closest('.ps-stat')) { UISounds.softCoin(); return; }
  // World Status items
  if (e.target.closest('.ws-item')) { UISounds.torchFlicker(); return; }
  // Chronicle events (home + chronicle page)
  if (e.target.closest('.lc-event, .event')) { UISounds.parchmentUnfold(); return; }
});

// Settlement dashboard sounds — all use pageTurn
document.addEventListener('mouseover', e => {
  if (e.target.closest('#sett-dashboard .kr-row') ||
      e.target.closest('.sd-terr-row') ||
      e.target.closest('.sd-econ-card') ||
      e.target.closest('#sett-dashboard .donut-seg') ||
      e.target.closest('.sd-counter')) {
    UISounds.pageTurn();
  }
});

// ── Cinematic Intro Sound (Web Audio API) ──
// Bannerlord style: somber orchestral drone, choir pad, ceremonial taiko drum
function playIntroSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    // Reverb convolver (simulated hall)
    const convolver = ctx.createConvolver();
    const reverbLen = ctx.sampleRate * 2.5;
    const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = reverbBuf.getChannelData(ch);
      for (let i = 0; i < reverbLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8)) * 0.4;
      }
    }
    convolver.buffer = reverbBuf;
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;
    convolver.connect(reverbGain);
    reverbGain.connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    dry.connect(master);

    // Helper: create a soft filtered sine pad voice
    function padVoice(freq, start, dur, vol, filterFreq) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 600;
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + dur * 0.3);
      g.gain.setValueAtTime(vol, t + start + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, t + start + dur);
      osc.connect(f); f.connect(g); g.connect(dry); g.connect(convolver);
      osc.start(t + start); osc.stop(t + start + dur);
    }

    // ── Deep string drone (D minor chord, very low) ──
    // D2 + A2 + D3 + F3 — solemn minor chord, long sustain
    padVoice(73.4, 0.0, 8.0, 0.12, 300);  // D2
    padVoice(110,  0.3, 7.5, 0.10, 350);  // A2
    padVoice(146.8,0.8, 7.0, 0.08, 400);  // D3
    padVoice(174.6,1.2, 6.5, 0.06, 450);  // F3 (minor third)

    // ── Choir-like pad (higher octave, very soft, enters later) ──
    // Uses triangle waves for warmer tone
    function choirVoice(freq, start, dur, vol) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      // Slight vibrato for human feel
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 4.5 + Math.random() * 1.5;
      lfoG.gain.value = freq * 0.006;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      lfo.start(t + start); lfo.stop(t + start + dur);
      f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 0.5;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + dur * 0.35);
      g.gain.setValueAtTime(vol * 0.9, t + start + dur * 0.75);
      g.gain.linearRampToValueAtTime(0, t + start + dur);
      osc.connect(f); f.connect(g); g.connect(dry); g.connect(convolver);
      osc.start(t + start); osc.stop(t + start + dur);
    }
    choirVoice(293.6, 2.0, 5.5, 0.05);  // D4
    choirVoice(349.2, 2.5, 5.0, 0.04);  // F4
    choirVoice(440,   3.0, 4.5, 0.03);  // A4

    // ── Ceremonial taiko drum (deep, resonant, single hit) ──
    function taikoDrum(time, vol) {
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const s = i / ctx.sampleRate;
        // Deep body: sine sweep from 80Hz down to 40Hz
        const body = Math.sin(2 * Math.PI * (80 - 30 * s) * s) * Math.exp(-s * 2.5);
        // Attack transient: brief noise burst
        const attack = (Math.random() * 2 - 1) * Math.exp(-s * 25) * 0.4;
        // Sub resonance
        const sub = Math.sin(2 * Math.PI * 40 * s) * Math.exp(-s * 3) * 0.5;
        data[i] = (body * 0.7 + attack + sub) * vol;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 1;
      src.connect(g); g.connect(dry); g.connect(convolver);
      src.start(t + time);
    }
    taikoDrum(2.5, 0.6);  // "Living Chronicle" title reveal hit
    taikoDrum(5.4, 0.4);  // BANNERLORD letters hit (softer)

    // ── Wind atmosphere (filtered noise, very subtle) ──
    const windLen = ctx.sampleRate * 9;
    const windBuf = ctx.createBuffer(1, windLen, ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < windLen; i++) windData[i] = (Math.random() * 2 - 1);
    const wind = ctx.createBufferSource();
    wind.buffer = windBuf;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 300;
    windFilter.Q.value = 0.3;
    const windLfo = ctx.createOscillator();
    const windLfoG = ctx.createGain();
    windLfo.frequency.value = 0.2;
    windLfoG.gain.value = 150;
    windLfo.connect(windLfoG); windLfoG.connect(windFilter.frequency);
    windLfo.start(t); windLfo.stop(t + 9);
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, t);
    windGain.gain.linearRampToValueAtTime(0.04, t + 1.5);
    windGain.gain.setValueAtTime(0.04, t + 6);
    windGain.gain.linearRampToValueAtTime(0, t + 8.5);
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(dry);
    wind.start(t); wind.stop(t + 9);

    window._introAudioCtx = ctx;
    window._introMaster = master;
  } catch(e) { /* Audio not supported */ }
}

function stopIntroSound() {
  if (window._introMaster) {
    try {
      const ctx = window._introAudioCtx;
      window._introMaster.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => { try { ctx.close(); } catch {} }, 600);
    } catch {}
    window._introAudioCtx = null;
    window._introMaster = null;
  }
}

// Intro flow: Click to start → animations + sound play → click again to skip
let _introStarted = false;
const _introEl = document.getElementById('introOverlay');

function startIntro() {
  if (_introStarted) return;
  _introStarted = true;
  _introEl?.classList.add('intro-started');
  playIntroSound();
}

function dismissIntro() {
  if (!_introEl) return;
  stopIntroSound();
  _introEl.classList.add('intro-done');
  setTimeout(() => _introEl.remove(), 1000);
}

// Click anywhere to enter — immediate removal
if (_introEl) {
  const introClick = () => {
    if (!_introStarted) startIntro();
    _introEl.style.opacity = '0';
    _introEl.style.pointerEvents = 'none';
    setTimeout(() => { try { _introEl.remove(); } catch(e) {} }, 500);
  };
  _introEl.addEventListener('click', introClick);
  // Also catch clicks on children
  _introEl.querySelectorAll('*').forEach(child => child.addEventListener('click', introClick));
}

// Topbar scroll effect — shrink and darken on scroll
window.addEventListener('scroll', () => {
  const tb = document.querySelector('.topbar');
  if (tb) tb.classList.toggle('topbar-scrolled', window.scrollY > 30);
}, { passive: true });

// ═══════════════════════════════════════════════════════════════
//  VISUAL EFFECTS SYSTEM — Scroll reveals, particles, parallax
// ═══════════════════════════════════════════════════════════════

// ── 1. Scroll-Reveal Observer ──
// Watches for elements with .reveal class and adds .revealed when visible
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target); // Only animate once
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

// Auto-tag elements for reveal on page render
function initScrollReveals() {
  // Cards in grids
  document.querySelectorAll('.grid .card, .grid .sett-card, .grid .clan-card, .grid .hero-card, .grid .kingdom-card, .grid .fk-card').forEach((el, i) => {
    if (!el.classList.contains('reveal')) {
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i * 0.04, 0.6) + 's';
    }
    revealObserver.observe(el);
  });
  // Sections in detail views
  document.querySelectorAll('.detail-content .section, .sd-gauges, .entity-grid, .family-grid, .chronicle').forEach(el => {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
    revealObserver.observe(el);
  });
  // Dashboard elements
  document.querySelectorAll('.sd-counter, .summary, .cat-card, .home-panel').forEach(el => {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

// Re-init reveals after any content render
const _origRenderList = typeof renderList === 'function' ? renderList : null;
if (_origRenderList) {
  const _origRenderListFn = renderList;
  // Monkey-patch renderList to add reveals after render
  window._postRenderHooks = window._postRenderHooks || [];
  window._postRenderHooks.push(() => setTimeout(initScrollReveals, 50));
}
// Also hook into page show
const _origShowPage = showPage;
window.showPage = showPage = function(name) {
  _origShowPage(name);
  setTimeout(initScrollReveals, 100);
};

// ── 2. Parallax Banner Effect ──
window.addEventListener('scroll', () => {
  const banners = document.querySelectorAll('.page.active .page-banner::before, .page.active .hero-banner::before');
  const scrollY = window.scrollY;
  document.querySelectorAll('.page.active .page-banner, .page.active .hero-banner').forEach(banner => {
    const speed = 0.3;
    const yPos = -(scrollY * speed);
    banner.style.setProperty('--parallax-y', yPos + 'px');
  });
}, { passive: true });

// ── 3. Ambient Ember Particles ──
function createEmberParticles(container, count = 15) {
  if (!container || container.querySelector('.ambient-embers')) return;
  const wrap = document.createElement('div');
  wrap.className = 'ambient-embers';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.style.left = (Math.random() * 100) + '%';
    span.style.animationDuration = (3 + Math.random() * 4) + 's';
    span.style.animationDelay = (Math.random() * 5) + 's';
    span.style.width = span.style.height = (2 + Math.random() * 3) + 'px';
    wrap.appendChild(span);
  }
  container.appendChild(wrap);
}

// ── 4. Gold Spark Trail on Card Hover ──
document.addEventListener('mousemove', (e) => {
  const card = e.target.closest('.fk-card, .kingdom-card, .detail-banner');
  if (!card) return;
  // Throttle to every 80ms
  if (card._lastSpark && Date.now() - card._lastSpark < 80) return;
  card._lastSpark = Date.now();
  const spark = document.createElement('span');
  spark.className = 'gold-spark';
  const rect = card.getBoundingClientRect();
  spark.style.left = (e.clientX - rect.left) + 'px';
  spark.style.top = (e.clientY - rect.top) + 'px';
  card.appendChild(spark);
  setTimeout(() => spark.remove(), 600);
});

// ── 5. Animated Counter Numbers ──
function animateCounters(container) {
  if (!container) container = document;
  container.querySelectorAll('[data-count-target]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count-target')) || 0;
    if (target <= 0 || el._counted) return;
    el._counted = true;
    const duration = 1200;
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const current = Math.round(eased * target);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ── 6. Page Transition Enhancement ──
// Already handled by CSS .page.active animation, but add exit class
const origShowPageV2 = showPage;
window.showPage = showPage = function(name) {
  const current = document.querySelector('.page.active');
  if (current && current.id !== `page-${name}`) {
    current.classList.add('page-exit');
    setTimeout(() => current.classList.remove('page-exit'), 400);
  }
  origShowPageV2(name);
};

// ── 7. Init on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initScrollReveals, 200);
  // Add embers to home page
  const heroSection = document.querySelector('.hero-banner');
  if (heroSection) createEmberParticles(heroSection, 20);
});

// ═══════════════════════════════════════════════════════════════
// HOME PAGE WIDGETS
// ═══════════════════════════════════════════════════════════════

function renderHomeQuickActions() {
  const el = document.getElementById('homeQuickActions');
  if (!el) return;
  const actions = [
    {icon:'\u{1F5FA}', label:'Live Map', sub:'Calradia', color:'#7ac070', onclick:"showPage('map')"},
    {icon:'\u{2655}', label:'Commander', sub:'Your hero', color:'#d8b35f', onclick:"showPage('commander')"},
    {icon:'\u{1F4CA}', label:'Stats', sub:'Dashboard', color:'#80a0d0', onclick:"showPage('stats')"},
    {icon:'\u{1F3C6}', label:'Rankings', sub:'Top clans', color:'#f5d878', onclick:"showPage('rankings')"},
    {icon:'\u{1F4B0}', label:'Trade', sub:'Best routes', color:'#e8c848', onclick:"showTradeRoutes&&showTradeRoutes()"},
    {icon:'\u{2696}', label:'Compare', sub:'Heroes', color:'#c08070', onclick:"openHeroCompare()"},
  ];
  el.innerHTML = actions.map(a => `
    <div class="hqa-btn" style="--hqa-accent:${a.color}" onclick="${a.onclick}">
      <span class="hqa-icon" style="color:${a.color}">${a.icon}</span>
      <span class="hqa-label">${a.label}</span>
      <span class="hqa-sub">${a.sub}</span>
    </div>`).join('');
}

function _seasonFromDate(date) {
  if (!date) return { name:'Spring', icon:'\u{1F337}', glow:'rgba(244,168,200,.5)' };
  const m = String(date).toLowerCase();
  if (m.includes('spring')) return { name:'Spring', icon:'\u{1F337}', glow:'rgba(244,168,200,.5)' };
  if (m.includes('summer')) return { name:'Summer', icon:'\u{2600}', glow:'rgba(244,216,120,.6)' };
  if (m.includes('autumn') || m.includes('fall')) return { name:'Autumn', icon:'\u{1F342}', glow:'rgba(216,128,48,.5)' };
  if (m.includes('winter')) return { name:'Winter', icon:'\u{2744}', glow:'rgba(180,220,255,.45)' };
  return { name:'Spring', icon:'\u{1F337}', glow:'rgba(244,168,200,.5)' };
}

function renderHomeCalendar(s) {
  const el = document.getElementById('homeCalendar');
  if (!el) return;
  const date = s?.date || '';
  const season = _seasonFromDate(date);
  const hour = s?.hour != null ? Math.floor(s.hour) : 0;
  const minute = s?.minute != null ? Math.floor(s.minute) : 0;
  el.style.setProperty('--season-glow', season.glow);
  el.innerHTML = `
    <h3>Royal Calendar</h3>
    <div class="hc-season-icon">${season.icon}</div>
    <div class="hc-date-big">${esc(date || '\u2014')}</div>
    <div class="hc-season-name">${season.name} in Calradia</div>
    <div class="hc-clock">
      <div class="hc-clock-num">${String(hour).padStart(2,'0')}</div>
      <div class="hc-clock-sep">:</div>
      <div class="hc-clock-num">${String(minute).padStart(2,'0')}</div>
    </div>
  `;
}

function renderHomeTreasury() {
  const el = document.getElementById('homeTreasury');
  if (!el) return;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem('wealthHistory') || '[]'); } catch(e) {}
  const status = Store.status || {};
  const current = status.gold || 0;
  el.innerHTML = '<h3>\u{1F4B0} Treasury</h3>' +
    `<div class="ht-current">${current.toLocaleString()}</div>` +
    `<div class="ht-label">Current Gold</div>`;
  if (arr.length < 2) {
    el.innerHTML += '<div class="ht-empty">Wealth history records as you play.<br>Check back later for the trend.</div>';
    return;
  }
  const w = 280, h = 80, pad = 8;
  const minT = arr[0].t, maxT = arr[arr.length-1].t;
  const golds = arr.map(p => p.g);
  const minG = Math.min(...golds), maxG = Math.max(...golds);
  const range = Math.max(1, maxG - minG);
  const xOf = t => pad + ((t - minT) / Math.max(1, maxT - minT)) * (w - pad * 2);
  const yOf = g => h - pad - ((g - minG) / range) * (h - pad * 2);
  const path = arr.map((p,i) => (i===0?'M':'L') + xOf(p.t).toFixed(1) + ',' + yOf(p.g).toFixed(1)).join(' ');
  const fill = path + ` L ${xOf(maxT).toFixed(1)},${h-pad} L ${xOf(minT).toFixed(1)},${h-pad} Z`;
  el.innerHTML += `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="htGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5d878" stop-opacity=".4"/>
      <stop offset="1" stop-color="#f5d878" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fill}" fill="url(#htGrad)"/>
    <path d="${path}" fill="none" stroke="#f5d878" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
  el.innerHTML += `<div class="ht-stats">
    <div><span class="ht-stat-val">${minG.toLocaleString()}</span>Lowest</div>
    <div><span class="ht-stat-val">${maxG.toLocaleString()}</span>Peak</div>
    <div><span class="ht-stat-val">${arr.length}</span>Samples</div>
  </div>`;
}

function renderHomeFactions() {
  const el = document.getElementById('homeFactions');
  if (!el) return;
  const kingdoms = (Store.kingdoms || []).slice().sort((a,b)=>(Number(b.strength)||0)-(Number(a.strength)||0)).slice(0,8);
  const max = Math.max(1, ...kingdoms.map(k => Number(k.strength)||0));
  const myKingdom = (Store.status?.kingdom) || '';
  let html = '<h3>\u{1F451} Faction Power</h3>';
  kingdoms.forEach((k, i) => {
    const v = Number(k.strength)||0;
    const pct = (v / max) * 100;
    const banner = k.id && Store._bannerImages?.[k.id] ? `Banners/${encodeURIComponent(k.id)}.png` : '';
    const isMine = k.name === myKingdom;
    html += `<div class="hf-row ${isMine?'is-mine':''}" onclick="openDetail('kingdoms','${esc(k.id)}')">
      <div class="hf-banner">${banner ? `<img src="${banner}" loading="lazy">` : '<div class="hf-banner-empty"></div>'}</div>
      <div class="hf-bar">
        <div class="hf-bar-fill" style="width:${pct}%;animation-delay:${i*0.08}s"></div>
        <div class="hf-name">${esc(k.name||'')}</div>
      </div>
      <div class="hf-num">${v.toLocaleString()}</div>
    </div>`;
  });
  el.innerHTML = html;
}

async function renderHomeHighlights() {
  const el = document.getElementById('homeHighlights');
  if (!el) return;
  const all = await API.getAllChronicle().catch(()=>[]);
  Store.allChronicle = all;
  const chronicle = (all || []).slice(-200);
  const importance = (txt) => {
    const t = (txt||'').toLowerCase();
    if (t.includes('declared war') || t.includes('war broke out')) return 10;
    if (t.includes('captured') || t.includes('conquered')) return 9;
    if (t.includes('died') || t.includes('slain') || t.includes('killed')) return 8;
    if (t.includes('peace')) return 7;
    if (t.includes('siege')) return 6;
    if (t.includes('married')) return 5;
    if (t.includes('born')) return 4;
    if (t.includes('victory')) return 3;
    return 1;
  };
  const ranked = chronicle.map(e => ({...e, _imp: importance(e.text)})).sort((a,b)=>b._imp-a._imp).slice(0,5);
  let html = '<h3>\u{1F4DC} Weekly Highlights</h3>';
  if (ranked.length === 0) {
    html += '<div class="ht-empty">Chronicle is empty. Live world events will appear here.</div>';
  } else {
    ranked.forEach(e => {
      const t = (e.text||'').toLowerCase();
      let icon = '\u{1F4DC}';
      if (t.includes('war')) icon = '\u{2694}';
      else if (t.includes('captured') || t.includes('siege')) icon = '\u{1F3F0}';
      else if (t.includes('died') || t.includes('slain')) icon = '\u{2620}';
      else if (t.includes('peace')) icon = '\u{1F54A}';
      else if (t.includes('married')) icon = '\u{1F48D}';
      else if (t.includes('born')) icon = '\u{1F476}';
      else if (t.includes('victory')) icon = '\u{1F3C6}';
      html += `<div class="hh-card">
        <div class="hh-icon">${icon}</div>
        <div class="hh-body">
          <div class="hh-title">${textToHtml(e.text||'')}</div>
          <div class="hh-date">${esc(e.date||'')}</div>
        </div>
      </div>`;
    });
  }
  el.innerHTML = html;
}

function renderHomeNews() {
  const el = document.getElementById('homeNews');
  if (!el) return;
  const kingdoms = Store.kingdoms || [];
  const clans = Store.clans || [];
  const settlements = Store.settlements || [];
  const heroes = Store.heroes || [];

  // War count
  const warPairs = new Set();
  kingdoms.forEach(k => (k.wars||[]).forEach(e => warPairs.add([k.name,e].sort().join('|'))));
  const wars = warPairs.size;
  // Strongest
  const strongest = [...kingdoms].sort((a,b)=>(b.strength||0)-(a.strength||0))[0];
  // Largest
  const largest = [...kingdoms].sort((a,b)=>(b.fiefCount||0)-(a.fiefCount||0))[0];
  // Richest clan
  const richest = [...clans].filter(c=>!c.isBandit).sort((a,b)=>(b.wealth||0)-(a.wealth||0))[0];
  // Settlements under siege
  const sieged = settlements.filter(s => s.isUnderSiege).length;
  // Highest renown hero
  const renowned = [...heroes].sort((a,b)=>(b.renown||0)-(a.renown||0))[0];

  const lines = [];
  if (wars > 0) lines.push(`&#x2694; <b>${wars}</b> war${wars!==1?'s':''} rage across the realm`);
  else lines.push('&#x1F54A; A rare moment of peace blankets Calradia');
  if (sieged > 0) lines.push(`&#x1F3F0; <b>${sieged}</b> settlement${sieged!==1?'s are':' is'} currently under siege`);
  if (strongest) lines.push(`&#x1F4AA; <b>${esc(strongest.name)}</b> stands as the strongest realm`);
  if (largest && largest.name !== strongest?.name) lines.push(`&#x1F451; <b>${esc(largest.name)}</b> holds the most fiefs (${largest.fiefCount})`);
  if (richest) lines.push(`&#x1F4B0; <b>${esc(richest.name)}</b> is the wealthiest house`);
  if (renowned) lines.push(`&#x2728; <b>${esc(renowned.name)}</b> is the most renowned hero`);
  lines.push(`&#x1F30D; <b>${kingdoms.length}</b> kingdoms &middot; <b>${clans.length}</b> clans &middot; <b>${heroes.length}</b> heroes`);

  let html = '<h3>\u{1F4F0} News from Calradia</h3>';
  lines.forEach(line => {
    html += `<div class="hn-line"><span class="hn-bullet">&#x25C6;</span><span>${line}</span></div>`;
  });
  el.innerHTML = html;
}

// ── Achievements + Glory rank system ──
const GLORY_RANKS = [
  { min: 0,    name: 'Wanderer',  color: '#7c6840', icon: '\u{1F9F3}' },
  { min: 25,   name: 'Initiate',  color: '#8a7858', icon: '\u{1F4DC}' },
  { min: 75,   name: 'Squire',    color: '#a08e6a', icon: '\u{1F6E1}' },
  { min: 150,  name: 'Knight',    color: '#c8a868', icon: '\u{2694}' },
  { min: 300,  name: 'Captain',   color: '#d4b878', icon: '\u{1F396}' },
  { min: 500,  name: 'Lord',      color: '#e8c878', icon: '\u{1F451}' },
  { min: 800,  name: 'Champion',  color: '#f5d878', icon: '\u{1F3C6}' },
  { min: 1200, name: 'Marshal',   color: '#ffe488', icon: '\u{2728}' },
  { min: 1800, name: 'Legend',    color: '#fff4c4', icon: '\u{1F31F}' },
];

function _gloryRank(points) {
  let cur = GLORY_RANKS[0];
  for (const r of GLORY_RANKS) if (points >= r.min) cur = r;
  return cur;
}

function _buildAchievements() {
  const chronicle = (Store.allChronicle || []);
  const text = chronicle.map(e => (e.text||'').toLowerCase()).join(' ');
  const status = Store.status || {};
  const playerName = (status.player || '').toLowerCase();
  const playerClan = (Store.clans||[]).find(c => c.name === (status.clan||''));
  const playerHero = (Store.heroes||[]).find(h => h.name === status.player);
  const settlements = Store.settlements || [];

  const winCount = (text.match(/victory|defeated/g) || []).length;
  const siegeCount = (text.match(/siege/g) || []).length;
  const marriages = (text.match(/married/g) || []).length;
  const births = (text.match(/born|birth/g) || []).length;
  const wars = (text.match(/declared war/g) || []).length;
  const playerMentioned = (txt) => playerName && txt.toLowerCase().includes(playerName);
  const fiefs = playerClan?.fiefs || 0;
  const wealth = status.gold || 0;
  const influence = status.influence || 0;
  const renown = playerHero?.renown || 0;

  // Each achievement now has reward.type + reward.amount + glory
  // type: 'gold' | 'influence' | 'renown' | 'glory'
  return [
    // ── COMBAT (gold) ──
    { id:'first_blood', cat:'Combat', icon:'\u{2694}', name:'First Blood', desc:'Win your first battle', glory:10, reward:{type:'gold',amount:500}, unlocked: winCount >= 1 },
    { id:'veteran', cat:'Combat', icon:'\u{1F5E1}', name:'Veteran', desc:'Win 10 battles', glory:25, reward:{type:'gold',amount:2000}, unlocked: winCount >= 10 },
    { id:'champion', cat:'Combat', icon:'\u{1F3C6}', name:'Champion', desc:'Win 50 battles', glory:75, reward:{type:'gold',amount:8000}, unlocked: winCount >= 50 },
    { id:'master_war', cat:'Combat', icon:'\u{2728}', name:'Master of War', desc:'Win 200 battles', glory:200, reward:{type:'gold',amount:30000}, unlocked: winCount >= 200 },
    { id:'siege_vet', cat:'Combat', icon:'\u{1F3F0}', name:'Siege Veteran', desc:'Witness a siege', glory:15, reward:{type:'renown',amount:25}, unlocked: siegeCount >= 1 },
    { id:'wall_breaker', cat:'Combat', icon:'\u{1F525}', name:'Wall Breaker', desc:'Witness 10 sieges', glory:50, reward:{type:'renown',amount:100}, unlocked: siegeCount >= 10 },
    { id:'survivor', cat:'Combat', icon:'\u{2620}', name:'Survivor', desc:'Survive your first siege', glory:25, reward:{type:'gold',amount:1500}, unlocked: chronicle.some(e => /siege/i.test(e.text||'') && playerMentioned(e.text||'')) },

    // ── ECONOMY (gold) ──
    { id:'coin_purse', cat:'Economy', icon:'\u{1F4B0}', name:'Coin Purse', desc:'Hold 1,000 gold', glory:5, reward:{type:'gold',amount:300}, unlocked: wealth >= 1000 },
    { id:'wealthy', cat:'Economy', icon:'\u{1FA99}', name:'Wealthy', desc:'Hold 10,000 gold', glory:25, reward:{type:'gold',amount:2500}, unlocked: wealth >= 10000 },
    { id:'rich_lord', cat:'Economy', icon:'\u{1F4B5}', name:'Rich Lord', desc:'Hold 50,000 gold', glory:75, reward:{type:'gold',amount:10000}, unlocked: wealth >= 50000 },
    { id:'treasury', cat:'Economy', icon:'\u{1F3E6}', name:'Treasury', desc:'Hold 200,000 gold', glory:200, reward:{type:'gold',amount:50000}, unlocked: wealth >= 200000 },

    // ── POLITICS (influence) ──
    { id:'sworn_vassal', cat:'Politics', icon:'\u{1F451}', name:'Sworn Vassal', desc:'Join a kingdom', glory:25, reward:{type:'influence',amount:50}, unlocked: !!(status.kingdom) },
    { id:'influencer', cat:'Politics', icon:'\u{2726}', name:'Influencer', desc:'Hold 100 influence', glory:25, reward:{type:'influence',amount:50}, unlocked: influence >= 100 },
    { id:'power_broker', cat:'Politics', icon:'\u{1F396}', name:'Power Broker', desc:'Hold 500 influence', glory:75, reward:{type:'influence',amount:150}, unlocked: influence >= 500 },
    { id:'fief_holder', cat:'Politics', icon:'\u{1F3F0}', name:'Fief Holder', desc:'Own a settlement', glory:50, reward:{type:'influence',amount:100}, unlocked: fiefs >= 1 },
    { id:'landed_lord', cat:'Politics', icon:'\u{1F3DB}', name:'Landed Lord', desc:'Own 3 fiefs', glory:100, reward:{type:'influence',amount:200}, unlocked: fiefs >= 3 },
    { id:'realm_builder', cat:'Politics', icon:'\u{1F305}', name:'Realm Builder', desc:'Own 7 fiefs', glory:200, reward:{type:'influence',amount:400}, unlocked: fiefs >= 7 },
    { id:'throne_claim', cat:'Politics', icon:'\u{1F31F}', name:'Throne Claimant', desc:'Own 12 fiefs', glory:400, reward:{type:'gold',amount:50000}, unlocked: fiefs >= 12 },

    // ── RENOWN (renown) ──
    { id:'local_hero', cat:'Renown', icon:'\u{1F4DC}', name:'Local Hero', desc:'Reach 100 renown', glory:10, reward:{type:'renown',amount:25}, unlocked: renown >= 100 },
    { id:'notable', cat:'Renown', icon:'\u{1F6E1}', name:'Notable', desc:'Reach 500 renown', glory:50, reward:{type:'renown',amount:75}, unlocked: renown >= 500 },
    { id:'renowned', cat:'Renown', icon:'\u{1F3C6}', name:'Renowned', desc:'Reach 1,000 renown', glory:100, reward:{type:'renown',amount:150}, unlocked: renown >= 1000 },
    { id:'legendary', cat:'Renown', icon:'\u{2728}', name:'Legendary', desc:'Reach 2,500 renown', glory:250, reward:{type:'renown',amount:300}, unlocked: renown >= 2500 },

    // ── FAMILY (gold) ──
    { id:'wedlock', cat:'Family', icon:'\u{1F48D}', name:'Wedlock', desc:'Get married', glory:25, reward:{type:'gold',amount:1000}, unlocked: marriages > 0 && playerName && chronicle.some(e => /married/i.test(e.text||'') && playerMentioned(e.text||'')) },
    { id:'heir_apparent', cat:'Family', icon:'\u{1F476}', name:'Heir Apparent', desc:'Have a child', glory:25, reward:{type:'gold',amount:1500}, unlocked: births > 0 && playerName && chronicle.some(e => /born/i.test(e.text||'') && playerMentioned(e.text||'')) },
    { id:'patriarch', cat:'Family', icon:'\u{1F465}', name:'Family Patriarch', desc:'Have 3+ children', glory:50, reward:{type:'gold',amount:5000}, unlocked: playerName && chronicle.filter(e => /born/i.test(e.text||'') && playerMentioned(e.text||'')).length >= 3 },

    // ── DIPLOMACY (influence) ──
    { id:'warmonger', cat:'Diplomacy', icon:'\u{1F6E1}', name:'Warmonger', desc:'Witness 5 wars declared', glory:25, reward:{type:'influence',amount:75}, unlocked: wars >= 5 },
    { id:'peacemaker', cat:'Diplomacy', icon:'\u{1F54A}', name:'Peacemaker', desc:'Witness a peace treaty', glory:25, reward:{type:'influence',amount:75}, unlocked: text.includes('peace') || text.includes('truce') },
    { id:'allied', cat:'Diplomacy', icon:'\u{1F91D}', name:'Allied', desc:'Form an alliance', glory:50, reward:{type:'influence',amount:150}, unlocked: text.includes('alliance') },

    // ── EXPLORATION (renown) ──
    { id:'cartographer', cat:'Explorer', icon:'\u{1F3D8}', name:'Cartographer', desc:'Discover 50 settlements', glory:25, reward:{type:'renown',amount:50}, unlocked: settlements.length >= 50 },
    { id:'realm_tracker', cat:'Explorer', icon:'\u{1F30D}', name:'Realm Tracker', desc:'Track 5+ kingdoms', glory:50, reward:{type:'gold',amount:3000}, unlocked: (Store.kingdoms||[]).length >= 5 },
    { id:'chron_reader', cat:'Explorer', icon:'\u{1F4DA}', name:'Chronicle Reader', desc:'Witness 100 events', glory:25, reward:{type:'gold',amount:2000}, unlocked: chronicle.length >= 100 },
    { id:'historian', cat:'Explorer', icon:'\u{1F4D6}', name:'Historian', desc:'Witness 500 events', glory:75, reward:{type:'gold',amount:8000}, unlocked: chronicle.length >= 500 },
  ];
}

function _achClaimedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('achievements_claimed') || '[]')); }
  catch(e) { return new Set(); }
}
function _saveAchClaimed(set) {
  try { localStorage.setItem('achievements_claimed', JSON.stringify([...set])); } catch(e) {}
}

const REWARD_META = {
  gold:      { icon:'\u{1F4B0}', label:'Gold',      color:'#e8c848' },
  influence: { icon:'\u{2726}', label:'Influence', color:'#80a0d0' },
  renown:    { icon:'\u{1F396}', label:'Renown',    color:'#c0a868' },
  glory:     { icon:'\u{2B50}', label:'Glory',     color:'#d4b878' },
};

async function claimAchievement(achId) {
  const checks = _buildAchievements();
  const a = checks.find(c => c.id === achId);
  if (!a) { showToast('Unknown achievement', true); return; }
  if (!a.unlocked) { showToast('Not yet unlocked', true); return; }
  const claimed = _achClaimedSet();
  if (claimed.has(achId)) { showToast('Already claimed', true); return; }
  const reward = a.reward;
  if (!reward || reward.type === 'glory') {
    // Pure cosmetic — no API call needed
    claimed.add(achId);
    _saveAchClaimed(claimed);
    showToast(`\u{1F3C6} Claimed: <b>${a.name}</b> &middot; +${a.glory} Glory`);
    renderHomeAchievements();
    return;
  }
  // Real API grant
  const meta = REWARD_META[reward.type] || REWARD_META.glory;
  const res = await API.grantReward(reward.type, reward.amount).catch(() => null);
  if (res && res.success) {
    claimed.add(achId);
    _saveAchClaimed(claimed);
    showToast(`\u{1F3C6} Claimed <b>${a.name}</b> &middot; +${reward.amount.toLocaleString()} ${meta.label}`);
    renderHomeAchievements();
  } else {
    showToast(res?.error || 'Reward grant failed', true);
  }
}

async function claimAllAchievements() {
  const checks = _buildAchievements();
  const claimed = _achClaimedSet();
  const toClaim = checks.filter(c => c.unlocked && !claimed.has(c.id));
  if (toClaim.length === 0) { showToast('Nothing to claim'); return; }
  showToast(`Claiming ${toClaim.length} reward${toClaim.length !== 1 ? 's' : ''}...`);
  for (const a of toClaim) {
    if (!a.reward || a.reward.type === 'glory') {
      claimed.add(a.id);
      continue;
    }
    const res = await API.grantReward(a.reward.type, a.reward.amount).catch(() => null);
    if (res && res.success) claimed.add(a.id);
  }
  _saveAchClaimed(claimed);
  showToast(`\u{1F3C6} Claimed ${toClaim.length} achievement${toClaim.length !== 1 ? 's' : ''}`);
  renderHomeAchievements();
}

function renderHomeAchievements() {
  const el = document.getElementById('homeAchievements');
  if (!el) return;
  const checks = _buildAchievements();
  const unlocked = checks.filter(c => c.unlocked);
  const totalGlory = unlocked.reduce((s, c) => s + (c.glory || 0), 0);
  const rank = _gloryRank(totalGlory);
  // Next rank progress
  const nextRank = GLORY_RANKS.find(r => r.min > totalGlory);
  const prevMin = rank.min;
  const nextMin = nextRank?.min || (rank.min + 100);
  const pct = Math.min(100, ((totalGlory - prevMin) / Math.max(1, nextMin - prevMin)) * 100);

  // Detect newly-unlocked achievements (vs last load)
  let prevSet = new Set();
  try { prevSet = new Set(JSON.parse(localStorage.getItem('achievements_seen') || '[]')); } catch(e) {}
  const newlyUnlocked = unlocked.filter(c => !prevSet.has(c.name));
  if (newlyUnlocked.length > 0) {
    setTimeout(() => {
      newlyUnlocked.forEach((c, i) => {
        setTimeout(() => showToast(`\u{1F3C6} Achievement: <b>${c.name}</b> &middot; +${c.glory} Glory`), i * 1500);
      });
    }, 800);
  }
  try { localStorage.setItem('achievements_seen', JSON.stringify(unlocked.map(c => c.name))); } catch(e) {}

  const claimed = _achClaimedSet();
  const claimableCount = unlocked.filter(c => !claimed.has(c.id)).length;

  // Header with rank crest + glory bar + claim-all button
  let html = `<div class="ach-header">
    <div class="ach-rank-crest" style="--rank-color:${rank.color}">
      <div class="ach-rank-icon">${rank.icon}</div>
    </div>
    <div class="ach-rank-info">
      <div class="ach-rank-kicker">\u{2606} Rank of Glory</div>
      <div class="ach-rank-name" style="color:${rank.color}">${rank.name}</div>
      <div class="ach-rank-bar"><div class="ach-rank-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${rank.color},#fff4c4)"></div></div>
      <div class="ach-rank-progress">${totalGlory.toLocaleString()} / ${nextMin.toLocaleString()} Glory${nextRank?` &middot; Next: <b style="color:${nextRank.color}">${nextRank.name}</b>`:' &middot; <b>Maximum rank reached</b>'}</div>
    </div>
    <div class="ach-rank-stat">
      <div class="ach-rank-stat-num">${unlocked.length}<span style="color:#7c6840">/${checks.length}</span></div>
      <div class="ach-rank-stat-lbl">Unlocked</div>
    </div>
    ${claimableCount > 0 ? `<button class="ach-claim-all-btn" onclick="claimAllAchievements()">\u{1F381} Claim All (${claimableCount})</button>` : ''}
  </div>`;

  // Group by category
  const cats = {};
  checks.forEach(c => { (cats[c.cat] = cats[c.cat] || []).push(c); });
  Object.entries(cats).forEach(([catName, items]) => {
    const catUnlocked = items.filter(c => c.unlocked).length;
    html += `<div class="ach-cat-title">${esc(catName)} <span class="ach-cat-count">${catUnlocked}/${items.length}</span></div>`;
    html += '<div class="ha-grid">';
    items.forEach(c => {
      const meta = REWARD_META[c.reward?.type] || REWARD_META.glory;
      const isClaimed = claimed.has(c.id);
      const canClaim = c.unlocked && !isClaimed;
      const tipText = `${c.desc} — Reward: ${c.reward?.amount?.toLocaleString() || '?'} ${meta.label} (+${c.glory} Glory)`;
      html += `<div class="ha-card ${c.unlocked?'unlocked':''} ${isClaimed?'claimed':''}" title="${esc(tipText)}">
        <div class="ha-icon">${c.icon}</div>
        <div class="ha-name">${esc(c.name)}</div>
        <div class="ha-desc">${esc(c.desc)}</div>
        <div class="ha-reward" style="color:${meta.color}">${meta.icon} ${(c.reward?.amount||0).toLocaleString()}</div>
        ${canClaim ? `<button class="ha-claim-btn" onclick="event.stopPropagation();claimAchievement('${esc(c.id)}')">Claim</button>` : ''}
        ${isClaimed ? `<div class="ha-claimed-badge">\u{2713} CLAIMED</div>` : ''}
      </div>`;
    });
    html += '</div>';
  });
  el.innerHTML = '<h3>\u{1F396} Achievements &amp; Rewards</h3>' + html;
}

const HOME_QUOTES = [
  ['He who would rule must first earn the loyalty of his people.', 'Empire Proverb'],
  ['Steel is forged in fire, kingdoms in war.', 'Sturgian Saga'],
  ['A blade is only as sharp as the hand that wields it.', 'Aserai Saying'],
  ['The horse knows the way home, even when the rider is lost.', 'Khuzait Wisdom'],
  ['Walls keep enemies out, but also keep allies waiting.', 'Battanian Verse'],
  ['Gold buys swords, but only honor buys lords.', 'Vlandian Lament'],
  ['Those who count the dead are doomed to join them.', 'Imperial Maxim'],
  ['A king without a kingdom is just a man with a fancy hat.', 'Calradian Jest'],
  ['Glory fades, but the chronicle remembers all.', 'Imperial Scribe'],
  ['Even the longest siege ends when the larders run empty.', 'Quartermaster\'s Wisdom'],
  ['He who hesitates at the gate dines in the dungeon.', 'Battanian Proverb'],
  ['Better one true sword than a hundred empty oaths.', 'Sturgian Code'],
];

function renderHomeQuote() {
  const el = document.getElementById('homeQuote');
  if (!el) return;
  // Deterministic per day so it stays the same all session
  const day = Math.floor(Date.now() / 86400000);
  const [text, attr] = HOME_QUOTES[day % HOME_QUOTES.length];
  el.innerHTML = esc(text) + `<span class="home-quote-attr">&mdash; ${esc(attr)}</span>`;
}

function applySeasonParticles(s) {
  const heroBanner = document.querySelector('#page-home .hero-banner');
  if (!heroBanner) return;
  // Remove old layer
  const old = heroBanner.querySelector('.home-season-layer');
  if (old) old.remove();
  const season = _seasonFromDate(s?.date || '');
  const map = { Winter:'home-season-winter', Autumn:'home-season-autumn', Summer:'home-season-summer', Spring:'home-season-spring' };
  const cls = map[season.name];
  if (!cls) return;
  const layer = document.createElement('div');
  layer.className = 'home-season-layer ' + cls;
  for (let i = 0; i < 32; i++) {
    const sp = document.createElement('span');
    sp.style.left = (Math.random() * 100) + '%';
    sp.style.animationDuration = (10 + Math.random() * 10) + 's';
    sp.style.animationDelay = (Math.random() * 8) + 's';
    layer.appendChild(sp);
  }
  heroBanner.appendChild(layer);
}

// Re-init after renderList completes
const origGridInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
// Use MutationObserver to detect grid content changes
const gridObserver = new MutationObserver(() => {
  setTimeout(initScrollReveals, 60);
});
document.querySelectorAll('[id^="grid-"]').forEach(grid => {
  gridObserver.observe(grid, { childList: true });
});

init();
