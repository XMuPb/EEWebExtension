// ═══════════════════════════════════════════════════════════════
//  Bannerlord Banner Renderer — Canvas-based with real game icons
//  Uses icon images from bannerlord.party for accurate rendering
// ═══════════════════════════════════════════════════════════════

// Bannerlord color palette — use runtime-extracted colors, fallback to built-in
// NOTE: BANNER_COLORS is provided by banner_colors.js (var, not const)
if (typeof BANNER_COLORS === 'undefined') window.BANNER_COLORS = {}; // safety net
if (typeof window._BANNER_FALLBACK === 'undefined') window._BANNER_FALLBACK = {
  0:'#b57a1e',1:'#4e1a13',2:'#284e19',3:'#b4f0f1',4:'#793191',5:'#fcde90',
  6:'#382188',7:'#dea940',8:'#591645',9:'#ffad54',10:'#429081',11:'#efc990',
  12:'#224277',13:'#cedae7',14:'#8d291a',15:'#f7bf46',16:'#6bd5dc',17:'#eed690',
  18:'#aec382',19:'#c3c3c3',20:'#d5d7d4',21:'#e7ecd6',22:'#eaeeef',23:'#7f6b60',
  24:'#967e7e',25:'#b6aba7',26:'#e7d3ba',27:'#eae1da',28:'#d9dbce',29:'#dfd6cd',
  30:'#cac1ba',31:'#ece8dd',32:'#e0dcd9',33:'#efece5',34:'#eae9e5',35:'#f5f5f5',
  36:'#f5b365',37:'#f5b365',38:'#e68c36',39:'#dcac46',40:'#ffffff',41:'#eee7d4',
  42:'#e9e2c5',43:'#ebdcbb',44:'#f0e0a5',45:'#e0c78e',46:'#cda87c',47:'#f9d575',
  48:'#e44434',49:'#e69077',50:'#e79c7d',51:'#c94b4e',52:'#e6b0a6',53:'#e4c8c7',
  54:'#f2b0a2',55:'#da6c6d',56:'#e2bcaf',57:'#bd7e75',58:'#d1c7c5',59:'#975b43',
  60:'#e6a57f',61:'#7b5e4e',62:'#d2bb9f',63:'#5e4d37',64:'#b5a996',65:'#917d6c',
  66:'#d5a577',67:'#c7b699',68:'#584b45',69:'#937f6d',70:'#c8a67b',71:'#c1c1c1',
  72:'#bfbfbf',73:'#bababa',74:'#b8b8b8',75:'#b3b3b3',76:'#acacac',77:'#a6a6a6',
  78:'#9e9e9e',79:'#989898',80:'#929292',81:'#878787',82:'#7a7a7a',83:'#6b6b6b',
  84:'#616161',85:'#545454',86:'#454545',87:'#383838',88:'#2b2b2b',89:'#1e1e1e',
  90:'#141414',91:'#0a0a0a',92:'#3e2819',93:'#522d14',94:'#5e381a',95:'#6e4422',
  96:'#7e5a30',97:'#86653a',98:'#94734b',99:'#a18252',100:'#332c4d',101:'#38305c',
  102:'#3f3465',103:'#453d6c',104:'#4c4279',105:'#594d89',106:'#685b9e',107:'#7568a9',
  108:'#000000',109:'#0d1117',110:'#1b2631',111:'#2c3e50',112:'#566573',113:'#808b96',
  114:'#abb2b9',115:'#d5d8dc',116:'#f2f3f4',117:'#ffffff',118:'#340e08',119:'#41140c',
  120:'#4c1e12',121:'#5c2c1b',122:'#6d3623',123:'#813c26',124:'#8c462e',125:'#9c5537',
  126:'#a5623d',127:'#b87144',128:'#006400',129:'#006500',130:'#007100',131:'#007e00',
  132:'#008400',133:'#009500',134:'#00a000',135:'#00af00',136:'#00b900',137:'#00c800',
  138:'#141f36',139:'#19263f',140:'#1f2f50',141:'#273b62',142:'#2d4471',143:'#345085',
  144:'#3c5c98',145:'#4167a6',146:'#4e79bf',147:'#5888d1',148:'#1f0a10',149:'#2b0e16',
  150:'#34111c',151:'#3f1525',152:'#49192c',153:'#591e38',154:'#662143',155:'#79284e',
  156:'#8c2d5f',157:'#a13569',158:'#272207',159:'#32290a',160:'#3a300c',161:'#45390e',
  162:'#4e4110',163:'#5d4e13',164:'#665515',165:'#766319',166:'#88721d',167:'#967e1e',
  168:'#211f15',169:'#2c2a1d',170:'#353223',171:'#3f3b2b',172:'#494432',173:'#57513c',
  174:'#615a43',175:'#70694e',176:'#7f7658',177:'#8c8363'
};

const SHIELD_PATH = 'M 10,2 L 90,2 L 90,55 Q 90,90 50,98 Q 10,90 10,55 Z';
const ICON_BASE_URL = 'BannerIcons/';

// Image cache
const _iconCache = {};

function loadIcon(meshId) {
  if (_iconCache[meshId]) return _iconCache[meshId];
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { console.log('[Banner] Loaded icon', meshId); resolve(img); };
    img.onerror = () => {
      // Fallback: try .png if .webp fails (e.g. manually added Naval DLC icons)
      const img2 = new Image();
      img2.onload = () => { console.log('[Banner] Loaded icon (png fallback)', meshId); resolve(img2); };
      img2.onerror = () => { console.warn('[Banner] Failed to load icon', meshId); resolve(null); };
      img2.src = ICON_BASE_URL + meshId + '.png';
    };
    img.src = ICON_BASE_URL + meshId + '.webp';
  });
  _iconCache[meshId] = p;
  return p;
}

/**
 * Render a banner to a canvas element. Returns the canvas.
 */
async function renderBannerCanvas(code, size = 200) {
  console.log('[Banner] renderBannerCanvas called, code length:', code?.length, 'size:', size);
  if (!code || typeof code !== 'string') return null;
  const parts = code.split('.').map(Number);
  if (parts.length < 10 || parts.some(isNaN)) return null;

  const layers = [];
  for (let i = 0; i + 9 < parts.length; i += 10) {
    layers.push({
      meshId: parts[i], color1: parts[i+1], color2: parts[i+2],
      sizeX: parts[i+3], sizeY: parts[i+4], posX: parts[i+5], posY: parts[i+6],
      drawStroke: parts[i+7], mirror: parts[i+8], rotation: parts[i+9]
    });
  }
  if (layers.length === 0) return null;
  console.log('[Banner] Layers:', layers.length, 'meshIds:', layers.map(l => l.meshId));

  // Preload all layer icons
  const iconPromises = layers.map(l => loadIcon(l.meshId));
  const icons = await Promise.all(iconPromises);
  console.log('[Banner] Icons loaded:', icons.map((ic, i) => `${layers[i].meshId}=${ic ? 'OK' : 'FAIL'}`));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = size / 100; // scale factor for 100-unit coordinate system

  // Draw shield clip path
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(10*s, 2*s);
  ctx.lineTo(90*s, 2*s);
  ctx.lineTo(90*s, 55*s);
  ctx.quadraticCurveTo(90*s, 90*s, 50*s, 98*s);
  ctx.quadraticCurveTo(10*s, 90*s, 10*s, 55*s);
  ctx.closePath();
  ctx.clip();

  // Background layer
  const bg = layers[0];
  const bgColor = BANNER_COLORS[bg.color1] || '#8b4513';
  const bgColor2 = BANNER_COLORS[bg.color2] || bgColor;
  const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
  bgGrad.addColorStop(0, bgColor);
  bgGrad.addColorStop(1, bgColor2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Background pattern overlay (skip icon 11 which is solid green)
  if (bg.meshId !== 11 && icons[0]) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(icons[0], 0, 0, size, size);
    ctx.globalAlpha = 1;
  }

  // Render emblem layers using offscreen canvas for proper color tinting
  for (let i = 1; i < layers.length && i < 8; i++) {
    const l = layers[i];
    const icon = icons[i];

    const color = BANNER_COLORS[l.color1] || '#ffffff';

    // Position: 764 = center in Bannerlord's 0-1528 coordinate space
    const cx = (l.posX / 1528) * size;
    const cy = (l.posY / 1528) * size;

    // Size: the icon occupies sizeX/sizeY of the 1528-unit space
    const w = (l.sizeX / 1528) * size;
    const h = (l.sizeY / 1528) * size;

    const rot = (l.rotation * 0.00174533);

    if (icon) {
      // Tint the icon on a high-res offscreen canvas so source-atop works against the icon only
      const offSize = Math.max(256, Math.ceil(Math.max(w, h)));
      const off = document.createElement('canvas');
      off.width = offSize;
      off.height = offSize;
      const octx = off.getContext('2d');
      octx.drawImage(icon, 0, 0, offSize, offSize);
      octx.globalCompositeOperation = 'source-atop';
      octx.fillStyle = color;
      octx.fillRect(0, 0, offSize, offSize);

      // Draw tinted icon onto main canvas with position/rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      if (l.mirror) ctx.scale(-1, 1);
      ctx.drawImage(off, -w/2, -h/2, w, h);
      ctx.restore();
    } else {
      // Fallback for missing icons (e.g. Naval DLC): draw a colored diamond shape
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      if (l.mirror) ctx.scale(-1, 1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -h/2);
      ctx.lineTo(w/2, 0);
      ctx.lineTo(0, h/2);
      ctx.lineTo(-w/2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  // Shield border
  ctx.beginPath();
  ctx.moveTo(10*s, 2*s);
  ctx.lineTo(90*s, 2*s);
  ctx.lineTo(90*s, 55*s);
  ctx.quadraticCurveTo(90*s, 90*s, 50*s, 98*s);
  ctx.quadraticCurveTo(10*s, 90*s, 10*s, 55*s);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  return canvas;
}

/**
 * SVG fallback renderer (used for data URIs and instant rendering before canvas loads)
 */
function renderBannerSVG(code, size = 64) {
  if (!code || typeof code !== 'string') return '';
  const parts = code.split('.').map(Number);
  if (parts.length < 10 || parts.some(isNaN)) return '';

  const layers = [];
  for (let i = 0; i + 9 < parts.length; i += 10) {
    layers.push({
      meshId: parts[i], color1: parts[i+1], color2: parts[i+2],
      sizeX: parts[i+3], sizeY: parts[i+4], posX: parts[i+5], posY: parts[i+6],
      drawStroke: parts[i+7], mirror: parts[i+8], rotation: parts[i+9]
    });
  }
  if (layers.length === 0) return '';

  const uid = 'b' + Math.random().toString(36).substring(2, 8);
  const bg = layers[0];
  const bgColor = BANNER_COLORS[bg.color1] || '#8b4513';
  const bgColor2 = BANNER_COLORS[bg.color2] || bgColor;

  // SVG with background gradient only — icons are rendered via canvas async
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">`;
  svg += `<defs><clipPath id="${uid}c"><path d="${SHIELD_PATH}"/></clipPath>`;
  svg += `<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1">`;
  svg += `<stop offset="0%" stop-color="${bgColor}"/><stop offset="100%" stop-color="${bgColor2}"/>`;
  svg += `</linearGradient></defs>`;
  svg += `<path d="${SHIELD_PATH}" fill="url(#${uid}g)" clip-path="url(#${uid}c)"/>`;
  svg += `<path d="${SHIELD_PATH}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`;
  svg += `</svg>`;
  return svg;
}

/**
 * Generate a data URI for a banner SVG (instant, used for img src).
 */
function bannerToDataUri(code, size) {
  const svg = renderBannerSVG(code, size);
  if (!svg) return '';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * Render banner into a target element using canvas (high quality, async).
 * Falls back to SVG if canvas fails.
 */
async function renderBannerInto(element, code, size = 200) {
  if (!element || !code) return;
  try {
    const canvas = await renderBannerCanvas(code, size);
    if (canvas) {
      element.innerHTML = '';
      element.appendChild(canvas);
      return;
    }
  } catch (e) {
    console.warn('[Banner] Canvas render failed, using SVG fallback:', e);
  }
  // SVG fallback
  element.innerHTML = `<img src="${bannerToDataUri(code, size)}" alt="Banner" width="${size}" height="${size}">`;
}
