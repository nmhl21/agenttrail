// Deploy page: sends a contract-creation transaction from the USER's own
// injected wallet. No keys, no server, no QR codes. The user confirms the
// transaction in their own wallet app.
import { INIT_CODE } from "./initcode.js";

const $ = (id) => document.getElementById(id);
const BSCSCAN = "https://bscscan.com";
let account = null;

function setStatus(el, msg, kind = "") {
  el.textContent = msg;
  el.className = "statusline" + (kind ? " " + kind : "");
}

async function connect() {
  if (!window.ethereum) {
    setStatus($("walletLine"), "No injected wallet found. Open this page in the Binance Wallet app browser or MetaMask.", "bad");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    if (parseInt(chainHex, 16) !== 56) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      } catch (e) {
        setStatus($("walletLine"), "Please switch your wallet to BNB Chain (chain 56) and reconnect.", "bad");
        return;
      }
    }
    setStatus($("walletLine"), `Connected: ${account} (BNB Chain)`, "ok");
    $("deployBtn").disabled = false;
    // Live gas estimate (read-only).
    try {
      const gasHex = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [{ from: account, data: INIT_CODE }],
      });
      const gasPriceHex = await window.ethereum.request({ method: "eth_gasPrice", params: [] });
      const gas = BigInt(gasHex);
      const price = BigInt(gasPriceHex);
      const costWei = gas * price;
      const costBnb = Number(costWei) / 1e18;
      setStatus(
        $("estimateLine"),
        `Estimated gas: ${gas.toString()} · gas price: ${(Number(price) / 1e9).toFixed(2)} gwei · estimated cost: ~${costBnb.toFixed(6)} BNB. You confirm the real cost in your wallet before anything is sent.`
      );
    } catch (e) {
      setStatus($("estimateLine"), "Could not estimate gas: " + (e.message || e), "bad");
    }
  } catch (e) {
    setStatus($("walletLine"), "Connection failed: " + (e.message || e), "bad");
  }
}

async function deploy() {
  if (!window.ethereum || !account) return;
  $("deployBtn").disabled = true;
  setStatus($("deployStatus"), "Waiting for wallet confirmation…");
  try {
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, data: INIT_CODE }],
    });
    setStatus($("deployStatus"), `Transaction sent: ${txHash}. Waiting for confirmation…`);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt) {
        if (receipt.status === "0x1") {
          const addr = receipt.contractAddress;
          setStatus($("deployStatus"), "Contract deployed.", "ok");
          $("resultLine").innerHTML =
            `Contract address: <a href="${BSCSCAN}/address/${addr}" target="_blank" rel="noopener">${addr}</a> · ` +
            `<a href="${BSCSCAN}/tx/${txHash}" target="_blank" rel="noopener">tx</a><br>` +
            `Copy this address and send it to Muse so the app can be wired up.`;
        } else {
          setStatus($("deployStatus"), "Deployment transaction failed on-chain.", "bad");
        }
        return;
      }
    }
    setStatus($("deployStatus"), "Still waiting — check the transaction on BscScan.", "");
  } catch (e) {
    const msg = e && e.code === 4001 ? "Transaction rejected in wallet." : "Deploy failed: " + (e.message || e);
    setStatus($("deployStatus"), msg, "bad");
    $("deployBtn").disabled = false;
  }
}

$("connectBtn").addEventListener("click", connect);
$("deployBtn").addEventListener("click", deploy);
