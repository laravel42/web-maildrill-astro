/**
 * Record a narrated video tour of the Maildrill dashboard.
 *
 * Drives the real, signed-in workspace with Playwright while Edge neural TTS
 * (via `uvx edge-tts`) narrates each section; ffmpeg muxes the result into an
 * mp4. Dev-only: it signs in by inserting a one-time login-code hash straight
 * into the local Postgres (the same sha256(email:code) the verifier checks)
 * and opening /auth/verify, so no email is sent and no prior code is revoked.
 *
 * Usage:  node scripts/present-dashboard.mjs [--out <dir>]
 * Needs:  astro dev on :4321, workers on :3001, Postgres, ffmpeg, uvx.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.PRESENT_BASE_URL ?? 'http://localhost:4321';
const EMAIL = process.env.PRESENT_EMAIL ?? 'hello@laravel42.com';
const VOICE = process.env.PRESENT_VOICE ?? 'en-US-AndrewMultilingualNeural';
const TARGET_SECONDS = 180;
const SIZE = { width: 1440, height: 900 };

const outIdx = process.argv.indexOf('--out');
const OUT = path.resolve(outIdx > -1 ? process.argv[outIdx + 1] : 'presentation-out');
fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ script */

const SECTIONS = [
  {
    id: 'dashboard',
    text:
      'This is Maildrill — a multichannel messaging workspace for email, S M S, WhatsApp, and voice. ' +
      'The dashboard opens on the state of play: subscriber growth, lists, campaigns, and engagement ' +
      'rates for the week, with a per-channel performance breakdown underneath. Time ranges switch ' +
      'from seven days to twelve months, and recent activity streams in live as subscribers join, ' +
      'confirm, or unsubscribe.',
  },
  {
    id: 'campaigns',
    text:
      'The campaigns board tracks every send through its lifecycle — draft, scheduled, sending, sent — ' +
      'with filters that slice the pipeline by channel, opens, and clicks. ' +
      'Each campaign opens into a full report page: delivery outcomes, opens and clicks over time, ' +
      'and a link table that separates total clicks from unique recipients — all reconciled from real delivery reports.',
  },
  {
    id: 'templates',
    text:
      'Templates cover all four channels. Email opens in a full visual builder, while S M S, WhatsApp, ' +
      'and voice use focused composers with live previews. A gallery of ready-made designs seeds new ' +
      'work, and every template can be previewed, cloned, and favorited. Merge tags come from the ' +
      'workspace’s real subscriber schema, so what you insert is exactly what gets merged at send time.',
  },
  {
    id: 'subscribers',
    text:
      'Subscribers is the C R M view — everyone across your lists and segments, with search, saved segments, ' +
      'bulk actions, and statuses one filter away. Every person has a full profile: an engagement score, ' +
      'weekly activity, campaign history, clicked links, and consent — all bound to live delivery data.',
  },
  {
    id: 'lists',
    text:
      'Lists organize the audience, each row carrying its color, tags, growth, and engagement at a glance, ' +
      'with the workspace-wide custom field schema managed in a single modal. A list opens into its own ' +
      'detail page — membership health, growth over time, the full roster, and per-list settings like ' +
      'double opt-in, backed by real columns in the database.',
  },
  {
    id: 'media',
    text:
      'The media library keeps campaign imagery on S3 with CDN delivery — ' +
      'drop assets in once, and they are ready to place into any email.',
  },
  {
    id: 'analytics',
    text:
      'Analytics rolls it all up: daily activity across the workspace and performance per channel, ' +
      'powered by PostHog queries when connected, with a Postgres fallback — and the by-channel ' +
      'panel adapts its layout to whichever channel you focus on.',
  },
  {
    id: 'settings',
    text:
      'And settings manages the workspace and the team. Everything you have seen runs in one codebase — ' +
      'Maildrill: the fastest professional workspace to create, deliver, and analyze campaigns.',
  },
];

/* ------------------------------------------------------------------- utils */

const log = (m) => console.log(`[present] ${m}`);

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.resolve('.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env');
  return line.slice('DATABASE_URL='.length).trim();
}

function psql(sql) {
  return sh('psql', [databaseUrl(), '-At', '-c', sql]);
}

function audioSeconds(file) {
  return Number(
    sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]),
  );
}

async function smoothScroll(page, px, ms) {
  const steps = Math.max(1, Math.round(ms / 60));
  const per = px / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, per);
    await page.waitForTimeout(60);
  }
}

/* ------------------------------------------------------------------- steps */

async function generateAudio() {
  for (const s of SECTIONS) {
    const file = path.join(OUT, `${s.id}.mp3`);
    if (!fs.existsSync(file)) {
      log(`tts: ${s.id}`);
      sh('uvx', ['edge-tts', '--voice', VOICE, '--text', s.text, '--write-media', file]);
    }
    s.audio = file;
    s.audioSec = audioSeconds(file);
  }
  const total = SECTIONS.reduce((n, s) => n + s.audioSec, 0);
  // Pad each section with silence so the tour lands near the target length.
  const gap = Math.min(3, Math.max(0.4, (TARGET_SECONDS - total) / SECTIONS.length));
  for (const s of SECTIONS) s.screenSec = s.audioSec + gap;
  log(`narration ${total.toFixed(1)}s + ${gap.toFixed(2)}s/section gap`);
}

function mintLoginCode() {
  const code = String(randomInt(100_000, 1_000_000));
  const hash = createHash('sha256').update(`${EMAIL}:${code}`).digest('hex');
  psql(
    `INSERT INTO magic_link_tokens (email, token_hash, expires_at)
     VALUES ('${EMAIL}', '${hash}', now() + interval '10 minutes')`,
  );
  return code;
}

function detailIds() {
  const campaign = psql(
    `SELECT id FROM campaigns WHERE status = 'sent' ORDER BY updated_at DESC LIMIT 1`,
  );
  const subscriber = psql(`SELECT id FROM subscribers ORDER BY created_at ASC LIMIT 1`);
  const list = psql(`SELECT id FROM lists ORDER BY created_at ASC LIMIT 1`);
  return { campaign, subscriber, list };
}

/** Per-section choreography; each gets the remaining time paced by the caller. */
function actions(ids) {
  return {
    dashboard: async (p) => {
      await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await smoothScroll(p, 700, 2600);
      await smoothScroll(p, -700, 1800);
    },
    campaigns: async (p) => {
      await p.goto(`${BASE}/dashboard/campaigns`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await smoothScroll(p, 400, 1500);
      if (ids.campaign) {
        await p.goto(`${BASE}/dashboard/campaigns/${ids.campaign}/report`, {
          waitUntil: 'networkidle',
        });
        await smoothScroll(p, 800, 3200);
      }
    },
    templates: async (p) => {
      await p.goto(`${BASE}/dashboard/templates`, { waitUntil: 'networkidle' });
      await smoothScroll(p, 900, 3600);
      await smoothScroll(p, -300, 1200);
    },
    subscribers: async (p) => {
      await p.goto(`${BASE}/dashboard/subscribers`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await smoothScroll(p, 400, 1600);
      if (ids.subscriber) {
        await p.goto(`${BASE}/dashboard/subscribers/${ids.subscriber}`, {
          waitUntil: 'networkidle',
        });
        await smoothScroll(p, 600, 2600);
      }
    },
    lists: async (p) => {
      await p.goto(`${BASE}/dashboard/lists`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2200);
      if (ids.list) {
        await p.goto(`${BASE}/dashboard/lists/${ids.list}`, { waitUntil: 'networkidle' });
        await smoothScroll(p, 500, 2200);
        // Settings tab shows the consent & lifecycle switches.
        await p
          .getByRole('tab', { name: /settings/i })
          .click({ timeout: 2000 })
          .catch(() => {});
      }
    },
    media: async (p) => {
      await p.goto(`${BASE}/dashboard/media`, { waitUntil: 'networkidle' });
      await smoothScroll(p, 500, 2400);
    },
    analytics: async (p) => {
      await p.goto(`${BASE}/dashboard/analytics`, { waitUntil: 'networkidle' });
      await smoothScroll(p, 600, 2800);
    },
    settings: async (p) => {
      await p.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' });
      await smoothScroll(p, 400, 2000);
    },
  };
}

async function record(ids) {
  const browser = await chromium.launch();

  // Sign in outside the recording so the video opens on the dashboard.
  const authCtx = await browser.newContext({ viewport: SIZE });
  const authPage = await authCtx.newPage();
  const code = mintLoginCode();
  await authPage.goto(`${BASE}/auth/verify?email=${encodeURIComponent(EMAIL)}&code=${code}`);
  await authPage.waitForURL('**/dashboard**', { timeout: 20_000 });
  const state = await authCtx.storageState();
  await authCtx.close();
  log('signed in');

  const ctx = await browser.newContext({
    viewport: SIZE,
    storageState: state,
    recordVideo: { dir: OUT, size: SIZE },
  });
  // The Astro dev toolbar floats over every page in `astro dev`; keep it out
  // of the recording without touching the project's dev configuration.
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  const page = await ctx.newPage();
  const videoT0 = Date.now();
  const act = actions(ids);
  const offsets = [];

  for (const s of SECTIONS) {
    const start = Date.now();
    offsets.push({ id: s.id, atMs: start - videoT0 });
    log(`section: ${s.id} (${s.screenSec.toFixed(1)}s)`);
    try {
      await act[s.id](page);
    } catch (err) {
      log(`  (choreography error, holding frame: ${err.message})`);
    }
    const left = s.screenSec * 1000 - (Date.now() - start);
    if (left > 0) await page.waitForTimeout(left);
  }

  await ctx.close(); // flushes the video file
  const video = await page.video().path();
  await browser.close();
  return { video, offsets };
}

function mux(video, offsets) {
  const inputs = ['-i', video];
  const delays = [];
  const labels = [];
  SECTIONS.forEach((s, i) => {
    inputs.push('-i', s.audio);
    const at = Math.max(0, Math.round(offsets[i].atMs));
    delays.push(`[${i + 1}:a]adelay=${at}|${at}[a${i}]`);
    labels.push(`[a${i}]`);
  });
  const filter = `${delays.join(';')};${labels.join('')}amix=inputs=${SECTIONS.length}:normalize=0[out]`;
  const target = path.join(OUT, 'dashboard-presentation.mp4');
  sh('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '0:v',
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    target,
  ]);
  return target;
}

/* -------------------------------------------------------------------- main */

await generateAudio();
const ids = detailIds();
log(
  `detail ids: campaign=${ids.campaign || '—'} subscriber=${ids.subscriber || '—'} list=${ids.list || '—'}`,
);
const { video, offsets } = await record(ids);
log(`raw video: ${video}`);
const finalPath = mux(video, offsets);
log(`final: ${finalPath} (${audioSeconds(finalPath).toFixed(1)}s)`);
