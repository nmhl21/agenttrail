// AgentTrail — daily check-in + agent activity log for Agent ID holders.
// Reads via public BSC RPCs; writes only through the user's injected wallet
// (Binance Wallet app browser / MetaMask). No QR codes, no pairing codes,
// no server, no session storage. Demo mode (?demo=1) simulates everything.
const AGENT_ID = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
// Set by the owner right after deploying the contract (see deploy.html).
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEPLOY_BLOCK = 0;
const CHAIN_ID = 56;
const RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
];
const SEL = {
  checkIn: "0xf21bb4c5",
  lastDay: "0x4dea080a",
  streak: "0x6a2a6518",
  checkInsOf: "0xda38a831",
  agentCount: "0xb7dc1284",
  totalCheckInCount: "0xa6454aca",
  agentAt: "0xedb1e63d",
  hasAgentId: "0x4eab3ef2",
};
const TOPIC_CHECKIN = "0x4591ebce88ab6ad2d1f7c2faadd7a558310d80d870369fca2e22cf424730caab";
const BSCSCAN = "https://bscscan.com";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEMO = params.get("demo") === "1";
const DEPLOYED = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

// ---------- tiny helpers ----------
const hexToBytes = (hex) => {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (bytes) => "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const toHex = (n) => "0x" + BigInt(n).toString(16);
const u256 = (hex) => BigInt(hex);
function padAddress(addr) {
  return "0x" + "0".repeat(24) + addr.toLowerCase().slice(2);
}
function padU256(n) {
  return "0x" + BigInt(n).toString(16).padStart(64, "0");
}
function encodeCheckIn(note) {
  const bytes = new TextEncoder().encode(note);
  const lenHex = BigInt(bytes.length).toString(16).padStart(64, "0");
  const dataHex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const padded = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, "0");
  return SEL.checkIn + "0".repeat(63) + "20" + lenHex + padded;
}
function decodeEventNote(dataHex) {
  // data = streak(32) | noteOffset(32)=0x40 | noteLen(32) | note bytes
  const b = hexToBytes(dataHex);
  const dv = new DataView(b.buffer);
  const streak = Number(dv.getBigUint64(24)); // low 8 bytes of first word
  const len = Number(dv.getBigUint64(64 + 24));
  const note = new TextDecoder().decode(b.slice(96, 96 + len));
  return { streak, note };
}
const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const dayLabel = (day) => {
  const d = new Date(Number(day) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
};

// ---------- JSON-RPC with failover ----------
async function rpc(method, params) {
  let lastErr = null;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return j.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("all RPCs failed");
}
async function ethCall(to, data) {
  return rpc("eth_call", [{ to, data }, "latest"]);
}
async function callUint(to, data) {
  const r = await ethCall(to, data);
  return Number(u256(r));
}

// ---------- demo data (days computed from today so dates stay consistent) ----------
const TODAY_DAY = Math.floor(Date.now() / 86400000);
const DEMO_FEED = [
  { agent: "0xF865270e05876eD4E9F420f942AE337B9fA3a142", day: TODAY_DAY, streak: 3, note: "My agent scanned 3 contracts and found 0 criticals." },
  { agent: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", day: TODAY_DAY, streak: 7, note: "Agent drafted today's trading plan and set alerts." },
  { agent: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", day: TODAY_DAY - 1, streak: 2, note: "Agent summarized 12 governance proposals." },
  { agent: "0xF865270e05876eD4E9F420f942AE337B9fA3a142", day: TODAY_DAY - 1, streak: 2, note: "My agent checked the markets and drafted today's plan." },
  { agent: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", day: TODAY_DAY - 1, streak: 6, note: "Agent rebalanced the watchlist and pruned dead pairs." },
];

// ---------- state ----------
let account = null;
let isHolder = false;
let myStreak = 0;
let myCheckIns = 0;
let checkedInToday = false;

function setStatus(el, msg, kind = "") {
  el.textContent = msg;
  el.className = "statusline" + (kind ? " " + kind : "");
}

function renderFeed(feed) {
  const list = $("feedList");
  if (!feed.length) {
    list.innerHTML = '<li class="muted">No check-ins yet — be the first.</li>';
    return;
  }
  list.innerHTML = feed
    .map(
      (e) =>
        `<li><span class="addr">${shortAddr(e.agent)}</span> <span class="meta">· streak ${e.streak} · ${dayLabel(e.day)}</span><span class="note">${escapeHtml(e.note)}</span></li>`
    )
    .join("");
}
function renderBoard(board) {
  const list = $("boardList");
  if (!board.length) {
    list.innerHTML = '<li class="muted">No streaks yet.</li>';
    return;
  }
  list.innerHTML = board
    .map(
      (b, i) =>
        `<li><b>#${i + 1}</b> <span class="addr">${shortAddr(b.agent)}</span> <span class="meta">· streak ${b.streak} · ${b.total} check-ins</span></li>`
    )
    .join("");
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- live data ----------
async function loadStats() {
  if (!DEPLOYED) return;
  try {
    const [agents, total] = await Promise.all([
      callUint(CONTRACT_ADDRESS, SEL.agentCount),
      callUint(CONTRACT_ADDRESS, SEL.totalCheckInCount),
    ]);
    $("statAgents").textContent = agents;
    $("statCheckins").textContent = total;
  } catch (e) {
    $("statAgents").textContent = "?";
    $("statCheckins").textContent = "?";
  }
}
async function loadMyState() {
  if (!DEPLOYED || !account) return;
  try {
    const [holder, streak, mine, last] = await Promise.all([
      callUint(CONTRACT_ADDRESS, SEL.hasAgentId + padAddress(account).slice(2)),
      callUint(CONTRACT_ADDRESS, SEL.streak + padAddress(account).slice(2)),
      callUint(CONTRACT_ADDRESS, SEL.checkInsOf + padAddress(account).slice(2)),
      callUint(CONTRACT_ADDRESS, SEL.lastDay + padAddress(account).slice(2)),
    ]);
    isHolder = holder > 0;
    myStreak = streak;
    myCheckIns = mine;
    const today = Math.floor(Date.now() / 86400000);
    checkedInToday = last === today;
    $("statStreak").textContent = myStreak;
    $("statMine").textContent = myCheckIns;
    updateAgentStatus();
    updateCheckinButton();
  } catch (e) {
    setStatus($("agentStatus"), "Could not read your on-chain state: " + e.message, "bad");
  }
}
async function loadFeed() {
  if (!DEPLOYED) {
    $("feedList").innerHTML = '<li class="muted">Contract not deployed yet.</li>';
    return;
  }
  try {
    const latestHex = await rpc("eth_blockNumber", []);
    const latest = parseInt(latestHex, 16);
    const CHUNK = 2000;
    const feed = [];
    for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latest);
      const logs = await rpc("eth_getLogs", [
        { fromBlock: toHex(from), toBlock: toHex(to), address: CONTRACT_ADDRESS, topics: [TOPIC_CHECKIN] },
      ]);
      for (const log of logs || []) {
        const agent = "0x" + log.topics[1].slice(-40);
        const day = Number(u256(log.topics[2]));
        const { streak, note } = decodeEventNote(log.data);
        feed.push({ agent, day, streak, note, block: parseInt(log.blockNumber, 16) });
      }
    }
    feed.sort((a, b) => b.block - a.block);
    renderFeed(feed.slice(0, 20));
  } catch (e) {
    $("feedList").innerHTML = `<li class="muted">Could not load the trail feed: ${escapeHtml(e.message)}</li>`;
  }
}
async function loadBoard() {
  if (!DEPLOYED) {
    $("boardList").innerHTML = '<li class="muted">Contract not deployed yet.</li>';
    return;
  }
  try {
    const n = await callUint(CONTRACT_ADDRESS, SEL.agentCount);
    const rows = [];
    const BATCH = 20;
    for (let i = 0; i < n; i += BATCH) {
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH, n); j++) {
        batch.push(
          (async () => {
            const addrHex = await ethCall(CONTRACT_ADDRESS, SEL.agentAt + padU256(j).slice(2));
            const addr = "0x" + addrHex.slice(-40);
            const streak = await callUint(CONTRACT_ADDRESS, SEL.streak + padAddress(addr).slice(2));
            const total = await callUint(CONTRACT_ADDRESS, SEL.checkInsOf + padAddress(addr).slice(2));
            return { agent: addr, streak, total };
          })()
        );
      }
      rows.push(...(await Promise.all(batch)));
    }
    rows.sort((a, b) => b.streak - a.streak || b.total - a.total);
    renderBoard(rows.slice(0, 10));
  } catch (e) {
    $("boardList").innerHTML = `<li class="muted">Could not load the leaderboard: ${escapeHtml(e.message)}</li>`;
  }
}

// ---------- wallet / check-in ----------
function updateAgentStatus() {
  const el = $("agentStatus");
  if (!account) {
    setStatus(el, "Connect to see your Agent ID status and streak.");
    return;
  }
  if (!isHolder) {
    setStatus(el, `Connected as ${shortAddr(account)} — this address holds no Agent ID, so it cannot check in. Claim an Agent ID in the Binance app first.`, "bad");
  } else if (checkedInToday) {
    setStatus(el, `Connected as ${shortAddr(account)} — Agent ID held. Streak ${myStreak}. Already checked in today, come back tomorrow.`, "ok");
  } else {
    setStatus(el, `Connected as ${shortAddr(account)} — Agent ID held. Streak ${myStreak}. You can check in today.`, "ok");
  }
}
function updateCheckinButton() {
  $("checkinBtn").disabled = DEMO ? false : !(account && isHolder && !checkedInToday && DEPLOYED);
}
async function connect() {
  if (!window.ethereum) {
    setStatus($("agentStatus"), "No injected wallet found. Open this page in the Binance Wallet app browser or MetaMask.", "bad");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    if (parseInt(chainHex, 16) !== CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      } catch (e) {
        setStatus($("agentStatus"), "Please switch your wallet to BNB Chain (chain 56) and reconnect.", "bad");
        return;
      }
    }
    $("accountLabel").textContent = `Connected: ${account}`;
    $("connectBtn").textContent = "Connected";
    await loadMyState();
  } catch (e) {
    setStatus($("agentStatus"), "Connection failed: " + (e.message || e), "bad");
  }
}
async function checkIn() {
  const note = $("noteInput").value.trim();
  if (note.length > 140) {
    setStatus($("checkinStatus"), "Note is over 140 characters.", "bad");
    return;
  }
  if (DEMO) {
    const today = Math.floor(Date.now() / 86400000);
    myStreak += 1;
    myCheckIns += 1;
    checkedInToday = true;
    $("statStreak").textContent = myStreak;
    $("statMine").textContent = myCheckIns;
    DEMO_FEED.unshift({ agent: "0xF865270e05876eD4E9F420f942AE337B9fA3a142", day: today, streak: myStreak, note: note || "(no note)" });
    renderFeed(DEMO_FEED.slice(0, 20));
    setStatus($("checkinStatus"), "Demo check-in recorded (simulated — no transaction sent).", "ok");
    updateCheckinButton();
    return;
  }
  if (!window.ethereum || !account) return;
  setStatus($("checkinStatus"), "Waiting for wallet confirmation…");
  try {
    const data = encodeCheckIn(note);
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to: CONTRACT_ADDRESS, value: "0x0", data }],
    });
    $("txLine").innerHTML = `Tx sent: <a href="${BSCSCAN}/tx/${txHash}" target="_blank" rel="noopener">${txHash.slice(0, 18)}…</a> — waiting for confirmation…`;
    setStatus($("checkinStatus"), "Transaction sent, waiting for confirmation…");
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
      if (receipt) {
        if (receipt.status === "0x1") {
          setStatus($("checkinStatus"), "Check-in confirmed on-chain.", "ok");
          await loadMyState();
          await loadStats();
          await loadFeed();
          await loadBoard();
        } else {
          setStatus($("checkinStatus"), "Transaction failed on-chain (reverted).", "bad");
        }
        return;
      }
    }
    setStatus($("checkinStatus"), "Still waiting — check the tx link above.", "");
  } catch (e) {
    const msg = e && e.code === 4001 ? "Transaction rejected in wallet." : "Check-in failed: " + (e.message || e);
    setStatus($("checkinStatus"), msg, "bad");
  }
}

// ---------- boot ----------
function bootDemo() {
  $("demoBanner").classList.remove("hidden");
  account = "0xF865270e05876eD4E9F420f942AE337B9fA3a142";
  isHolder = true;
  myStreak = 3;
  myCheckIns = 5;
  checkedInToday = false;
  $("accountLabel").textContent = "Demo account: 0xF865…3a142 (simulated)";
  $("connectBtn").textContent = "Demo connected";
  $("statAgents").textContent = 3;
  $("statCheckins").textContent = 12;
  $("statStreak").textContent = myStreak;
  $("statMine").textContent = myCheckIns;
  setStatus($("agentStatus"), "Demo mode — simulated Agent ID holder, streak 3.", "ok");
  renderFeed(DEMO_FEED);
  renderBoard([
    { agent: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", streak: 7, total: 9 },
    { agent: "0xF865270e05876eD4E9F420f942AE337B9fA3a142", streak: 3, total: 5 },
    { agent: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", streak: 2, total: 3 },
  ]);
  updateCheckinButton();
}
async function bootLive() {
  if (!DEPLOYED) {
    $("notDeployedBanner").classList.remove("hidden");
    $("feedList").innerHTML = '<li class="muted">Contract not deployed yet.</li>';
    $("boardList").innerHTML = '<li class="muted">Contract not deployed yet.</li>';
    $("checkinBtn").disabled = true;
  } else {
    $("contractLink").textContent = shortAddr(CONTRACT_ADDRESS);
    $("contractLink").href = `${BSCSCAN}/address/${CONTRACT_ADDRESS}`;
    await loadStats();
    await loadFeed();
    await loadBoard();
  }
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accs) => {
      account = accs[0] || null;
      if (account) {
        $("accountLabel").textContent = `Connected: ${account}`;
        loadMyState();
      } else {
        $("accountLabel").textContent = "Not connected.";
        updateAgentStatus();
        updateCheckinButton();
      }
    });
  }
}

$("connectBtn").addEventListener("click", () => {
  if (!DEMO) connect();
});
$("checkinBtn").addEventListener("click", checkIn);
$("noteInput").addEventListener("input", (e) => {
  $("charCount").textContent = `${e.target.value.length} / 140`;
});
$("charCount").textContent = `${$("noteInput").value.length} / 140`;
if (DEMO) bootDemo();
else bootLive();

// Debug hooks for the automated UI test (read-only).
window.__agenttrailDebug = {
  DEMO,
  DEPLOYED,
  encodeCheckIn,
  decodeEventNote,
  readAgentIdBalance: async (addr) => callUint(AGENT_ID, "0x70a08231" + padAddress(addr).slice(2)),
  contractAddress: CONTRACT_ADDRESS,
};
