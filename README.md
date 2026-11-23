# AgentTrail — leave your agent's trail on-chain

Daily check-in + agent activity log for Agent ID holders on BNB Chain.
Built for the **Binance Agent ID Hackathon** (Binance Wallet × BNB Chain).

- **Live app:** https://nmhl21.github.io/agenttrail/
- **Deploy page:** https://nmhl21.github.io/agenttrail/deploy.html
- **Demo video:** `video/agenttrail-demo.mp4` (YouTube link added after upload)
- **Contract:** `contracts/AgentTrail.sol` (Solidity 0.8.30, no dependencies)
- **Hackathon announcement:** https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf

## What it is

Agent ID holders check in once per UTC day and write what their agent did
today (max 140 characters). The note is published as a public on-chain
event. Consecutive days build a streak; a missed day resets it to 1. A
public leaderboard shows the longest streaks.

**Free — gas only. No token, no rewards, no airdrop, no fees.**
Check-ins cost a few thousandths of a BNB in gas, paid by each user for
their own transaction.

## How Agent ID is used

The contract checks `balanceOf` on the SPACE ID Agent ID contract
(`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, ERC-721, non-transferable)
on **every** `checkIn` call. Only addresses holding an Agent ID can check
in. This is access control + identity, one of the use cases the hackathon
asks for.

## Contract

| Item | Detail |
|---|---|
| `checkIn(string note)` | One per UTC day, note ≤ 140 bytes, emits `CheckIn(agent, day, streak, note)` |
| `streak(address)` / `lastDay(address)` / `checkInsOf(address)` | Public views |
| `agentCount()` / `agentAt(i)` | Enumerate all agents (for the leaderboard) |
| `hasAgentId(address)` | View: does this address hold an Agent ID |
| Owner powers | **None.** No admin functions, no pause, no mint, no fees, no withdrawals |
| Deploy gas | ~463,000 (~0.00003 BNB at 0.05 gwei) |

Notes are **emitted as events, never stored** — cheap gas, public trail.

## Hackathon rules (verified from the official announcement, 23 Nov 2026)

- Submission: 18 Nov 08:00 UTC → **9 Dec 2026 08:00 UTC (16:00 WITA)**.
  No registration needed; submit project name, website, contract
  address(es), Agent ID usage description.
- Two project awards, $29,000 each, top 10 each (1st $10,000, 2nd $6,000,
  3rd $4,000, 4th $3,000, 5th $2,000, 6th–10th $800). Each project can win
  only one award.
- **Pioneer Award:** ranked by real on-chain data — number of interacting
  Agent ID addresses, transaction volume, transaction count (weighted).
- **Innovation Award:** judged (Agent ID depth 30%, practicality 25%,
  completion 25%, innovation 20%). Requires the product live **and at
  least 30 Agent ID addresses** interacting during the Submission Period.
- Community Promotion Award: 2,000 USDC shared by 20 winners for original
  X posts with `#BinanceWalletHackathon` + `#AgenticWallet`.
- Safety red lines (all respected here): no web QR-code login, no prompts
  bypassing user tx confirmation, no unauthorized transfers, contracts
  open-source with disclosed owner permissions (none), no Binance/BNB
  brand impersonation in names/domains, no credential collection, no
  promised returns, Agent ID not packaged as a wallet-lookup tool.

## Honest assessment

The Pioneer Award is a pure traction race — existing entries already have
thousands of interactions, so top 10 there is out of reach for a solo
build with ~$0 marketing. This project targets the **Innovation Award**:
a genuinely useful, complete product, with the ≥30-holder gate as the
real challenge. Getting 30 real Agent ID holders to try it in ~2 weeks
takes active promotion (X, Binance Square, BNB communities) — the build
is the easy part.

## Deploy (owner, one click, from your own wallet)

1. Open https://nmhl21.github.io/agenttrail/deploy.html in the Binance
   Wallet app browser (or MetaMask).
2. Connect, review the live gas estimate, tap Deploy, confirm in your
   wallet. Cost ~0.00003 BNB.
3. Copy the deployed contract address and wire it into `src/main.js`
   (`CONTRACT_ADDRESS` + `DEPLOY_BLOCK`), rebuild, republish.
4. Verify the source on BscScan (exact source in `contracts/`,
   solc 0.8.30, optimizer on, 200 runs).

No keys, seeds, or pairing codes are ever involved. `baw` (Binance
Agentic Wallet CLI) has no deploy command, which is why deployment goes
through the owner's own wallet app instead.

## Web app

Static Vite site, zero dependencies, self-contained `dist/`. Reads via
public BSC RPCs; writes only through the user's injected wallet
(`window.ethereum`). `?demo=1` runs a fully simulated flow (no wallet,
no chain) for demos and the video.

## Tests

```sh
forge test                          # 9 unit tests (mock Agent ID)
forge test --match-contract AgentTrailForkTest \
  --fork-url https://bsc-rpc.publicnode.com   # 4 fork tests vs real BSC state
npm test                            # 16 Playwright UI checks (scripts/test-ui.mjs)
```

Fork tests prove, against real mainnet state: the user's wallet
(`0xF865270e05876eD4E9F420f942AE337B9fA3a142`, Agent ID `imperson`)
holds an Agent ID and can check in; a non-holder reverts.

## License

MIT. See `LICENSE`.
