# AgentTrail deploy plan (via baw, 23 Nov 2026 ~21:55 WITA)

baw has NO deploy command. Deploy goes through the deterministic deployment
proxy (Safe Singleton Factory) as a plain contract-call — the user approves
in the Binance app, same as every other baw tx.

- Factory (BSC): 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7
  Runtime code disassembled 23 Nov: expects calldata = salt(32B) ++ initCode,
  strips first 32B as salt, CREATE2-deploys the rest. Verified by eth_call.
- Salt: keccak256("agenttrail-v1") =
  0x8c11f63707f38b65cb48ae227c1d8dfa5b8a9b9cc2c023a7f2e7b426ae30cacd
- Init code: initcode.txt (AgentTrail.sol, solc 0.8.30, optimizer 200,
  1758 bytes, sha256 8e3f0a80...)
- Full calldata (salt ++ initcode): deploy-calldata.txt (3580 hex chars)
- Predicted contract address (CREATE2, verified by eth_call + cast create2):
  0x1f258B07B6C0B2A0656764383923d08590dE14a4 (currently empty, 0x)
- Gas estimate (eth_estimateGas, 23 Nov): 437,000 (~0.000022 BNB @ 0.05 gwei)
- Wallet: 0xF865270e05876eD4E9F420f942AE337B9fA3a142, BNB 0.000334 (fits ~15x)
- From: 0xF865270e05876eD4E9F420f942AE337B9fA3a142, value 0, chain 56

## baw command (after re-pair)
baw-main contract-call preview --binanceChainId 56 \
  --from 0xF865270e05876eD4E9F420f942AE337B9fA3a142 \
  --to 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7 \
  --value 0 --inputData $(cat deploy-calldata.txt) --json > pv_deploy_main.json
Then: txguard preview check, show preview to user, wait for "gas",
execute --requestId <id>, verify code at 0x1f25... + checkIn simulation.

## Re-pair in progress (23 Nov ~21:56)
qrCodeId: 94927138-9d47-4696-8289-f9759a383bfa
After user approves in Binance app:
baw-main auth verify --qrCodeId 94927138-9d47-4696-8289-f9759a383bfa --json
Then: wallet status -> should be CONNECTED.
