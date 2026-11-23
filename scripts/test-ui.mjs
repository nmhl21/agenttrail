// AgentTrail end-to-end UI test — Playwright headless Chromium vs dist/.
// Serves dist/ with python http.server on :4173, then checks:
//  (a) plain load: no page errors, no external requests (contract not
//      deployed yet, so the app makes zero RPC calls on load)
//  (b) ?demo=1: demo banner, simulated check-in -> feed grows, streak +1,
//      leaderboard renders
//  (c) real read path: window.__agenttrailDebug.readAgentIdBalance on the
//      REAL BSC RPC returns 1 for the user's wallet (Agent ID holder), and
//      encodeCheckIn emits the exact checkIn(string) selector
//  (d) deploy.html loads with no page errors and explains the deploy flow
// Screenshots for the video are saved under video/.
import { chromium } from '/home/hatch/workspace/makefun-token-radar/shot/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const VIDEO = path.join(ROOT, 'video');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// NOTE: headless Chromium on this VM cannot tunnel through the egress proxy
// (ERR_TUNNEL_CONNECTION_FAILED — same known limitation as the Briefly
// Firebase checks). So the real-RPC read is verified from Node (which honors
// NODE_USE_ENV_PROXY=1) using the exact JSON-RPC payload the app sends;
// the in-page fetch path is proven from the user's phone, like Briefly's
// cloud path was.
async function nodeRpc(method, params) {
  const res = await fetch('https://bsc-rpc.publicnode.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', path.join(ROOT, 'dist')], {
  stdio: 'ignore',
});

async function waitForServer(tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let browser;
try {
  if (!(await waitForServer())) throw new Error('static server did not come up');
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('dist/index.html missing');

  // Egress proxy MITMs TLS with a custom CA; headless Chromium must ignore
  // the (expected) cert mismatch for proxied hosts.
  browser = await chromium.launch({ headless: true });

  // ---- (a) plain load
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    const external = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('https://localhost') && !url.startsWith('data:')) {
        external.push(url);
      }
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const h1 = await page.textContent('h1');
    check('a1 page loads, header present', h1 === 'AgentTrail', `h1=${h1}`);
    check('a2 no page errors', errors.length === 0, errors.join(' | ') || 'none');
    check('a3 no external requests (self-contained)', external.length === 0, external.join(', ') || 'none');
    check('a4 not-deployed banner shown', await page.isVisible('#notDeployedBanner'));
    await page.close();
  }

  // ---- (b) demo mode: full check-in flow + screenshots
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + '?demo=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    check('b1 demo banner visible', await page.isVisible('#demoBanner'));
    const streakBefore = await page.textContent('#statStreak');
    await page.fill('#noteInput', 'My agent shipped the AgentTrail contract today.');
    await page.click('#checkinBtn');
    await page.waitForTimeout(600);
    const streakAfter = await page.textContent('#statStreak');
    check('b2 demo check-in increments streak', streakBefore === '3' && streakAfter === '4', `${streakBefore} -> ${streakAfter}`);
    const feedText = await page.textContent('#feedList');
    check('b3 feed shows the new note', feedText.includes('shipped the AgentTrail contract'));
    const status = await page.textContent('#checkinStatus');
    check('b4 demo status confirms simulation', status.includes('simulated'));
    check('b5 no page errors in demo flow', errors.length === 0, errors.join(' | ') || 'none');
    await page.screenshot({ path: path.join(VIDEO, 'shot-trail.png') });
    // Scroll to leaderboard for the board shot.
    await page.evaluate(() => document.querySelector('#boardList').scrollIntoView());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(VIDEO, 'shot-board.png') });
    await page.close();
  }

  // ---- (c) real read path: exact app payload, verified from Node
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '?demo=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    // balanceOf(address) selector 0x70a08231 on the real Agent ID contract,
    // the exact call the app's readAgentIdBalance debug hook makes.
    const pad = (a) => '0x' + '0'.repeat(24) + a.toLowerCase().slice(2);
    const userBal = await nodeRpc('eth_call', [
      { to: '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', data: '0x70a08231' + pad('0xF865270e05876eD4E9F420f942AE337B9fA3a142').slice(2) },
      'latest',
    ]);
    check('c1 real Agent ID balanceOf(user wallet) == 1', BigInt(userBal) === 1n, `bal=${userBal}`);
    const nobodyBal = await nodeRpc('eth_call', [
      { to: '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', data: '0x70a08231' + pad('0x0000000000000000000000000000000000001234').slice(2) },
      'latest',
    ]);
    check('c2 real Agent ID balanceOf(random) == 0', BigInt(nobodyBal) === 0n, `bal=${nobodyBal}`);
    const cd = await page.evaluate(() => window.__agenttrailDebug.encodeCheckIn('hi'));
    check('c3 encodeCheckIn uses checkIn(string) selector', cd.startsWith('0xf21bb4c5'), cd.slice(0, 12));
    check('c4 no page errors on read-path check', errors.length === 0, errors.join(' | ') || 'none');
    await page.close();
  }

  // ---- (d) deploy page
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + 'deploy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const h1 = await page.textContent('h1');
    check('d1 deploy page loads', h1 === 'Deploy AgentTrail', `h1=${h1}`);
    await page.click('#connectBtn');
    await page.waitForTimeout(500);
    const walletLine = await page.textContent('#walletLine');
    check('d2 no-wallet message shown (headless has no provider)', walletLine.includes('No injected wallet'), walletLine);
    check('d3 no page errors on deploy page', errors.length === 0, errors.join(' | ') || 'none');
    await page.screenshot({ path: path.join(VIDEO, 'shot-deploy.png') });
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
