import path from 'path';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { formatInTimeZone } from 'date-fns-tz';

const W = 1080;
const H = 1920;
const TIME_Y = Math.round(H * 0.38);            // 730
const CAPTION_TOP = TIME_Y + 60;                 // 8px below baseline-ish
const CAPTION_LINE_HEIGHT = 60;
const CAPTION_MAX_WIDTH = Math.round(W * 0.8);   // 864
const CAPTION_MAX_LINES = 2;

let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  const fontsDir = path.join(__dirname, '../../assets/fonts');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Baloo2-Bold.ttf'), 'Baloo 2 Bold');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Baloo2-Medium.ttf'), 'Baloo 2 Medium');
  fontsRegistered = true;
}

export async function renderOverlayPng(opts: {
  takenAt: Date;
  caption: string | null;
}): Promise<Buffer> {
  ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Bottom scrim — matches story-view LinearGradient(transparent → 0.55 → 0.82).
  // Spec says y=1280 — exactly H*2/3, not the rounded 0.667 approximation.
  const scrimTop = Math.round((H * 2) / 3);
  const grad = ctx.createLinearGradient(0, scrimTop, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  // Shared text style — white + soft dark halo (matches OutlinedText)
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Hour stamp
  const timeStr = formatInTimeZone(opts.takenAt, 'Asia/Ho_Chi_Minh', 'HH:mm');
  ctx.font = '700 56px "Baloo 2 Bold"';
  ctx.shadowBlur = 22;
  ctx.fillText(timeStr, W / 2, TIME_Y);

  // Caption (static — no typewriter)
  const caption = (opts.caption ?? '').trim();
  if (caption.length > 0) {
    ctx.font = '500 50px "Baloo 2 Medium"';
    ctx.shadowBlur = 16;
    const lines = wrapText(ctx, caption, CAPTION_MAX_WIDTH, CAPTION_MAX_LINES);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, CAPTION_TOP + i * CAPTION_LINE_HEIGHT);
    });
  }

  return canvas.toBuffer('image/png');
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let consumed = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      consumed = i + 1;
    } else {
      if (current) lines.push(current);
      current = word;
      consumed = i + 1;
      if (lines.length >= maxLines) {
        current = '';
        break;
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (consumed < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}
