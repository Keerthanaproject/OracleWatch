# OracleWatch — Oracle Security Monitoring

Real-time Web3 oracle security and protocol health monitoring prototype that detects price anomalies between on-chain Chainlink feeds and off-chain market prices, quantifies potential economic exploit exposure using Aave-style lending mechanics, maps exposed protocols consuming the oracle, and calculates mathematical similarity against historical oracle failure incidents.

---

## Architecture & Genuine Sequence

```
DETECT ───▶ PRICE ───▶ MAP ───▶ REPLAY ───▶ LIVE SYSTEM CONSOLE
```

### 1. DETECT (Live Anomaly Detection)
- **On-Chain Chainlink Aggregator**: Queries contract `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` on Ethereum mainnet via Web3.py (`latestRoundData()`), scaled by $10^8$.
- **Off-Chain Market Reference**: Fetches current ETH/USD spot rate from CoinGecko API (`/api/v3/simple/price?ids=ethereum&vs_currencies=usd`).
- **Percentage Deviation**:
  $$\text{Deviation \%} = \frac{|\text{Oracle Price} - \text{Market Price}|}{\text{Market Price}} \times 100$$
- **Anomaly Trigger**: Flagged when $\text{Deviation \%} > \text{Configured Threshold \%}$ (default $5.0\%$, dynamically adjustable via UI slider).
- **Historical Replay Mode**: Allows manual entry of historical oracle and market price snapshots to run the exact same detection pipeline.

### 2. PRICE (Economic Impact & Liquidation Exposure)
- **Aave-Style Health Factor**:
  $$\text{Health Factor} = \frac{\text{Collateral Value} \times \text{Liquidation Threshold}}{\text{Debt Value}}$$
- **Arbitrage Simulation & Exposure**:
  - $\text{Revalued Collateral} = \text{Collateral Value} \times \left(1 + \frac{\text{Deviation \%}}{100}\right)$
  - $\text{Max Borrow Capacity} = \text{Revalued Collateral} \times \text{Liquidation Threshold}$
  - $\text{Gross Potential Extraction} = \max(0, \text{Max Borrow Capacity} - \text{Debt Value})$
  - $\text{Flash Loan Fee (0.09\%)} = \text{Borrow Capital} \times 0.0009$
  - $\text{Estimated Attacker Cost} = \text{Flash Loan Fee} + \text{Gas Cost}$
  - $\text{Net Opportunity} = \text{Gross Potential Extraction} - \text{Estimated Attacker Cost}$
  - $\text{Verdict}: \mathbf{VIABLE} \text{ if } (\text{Net Opportunity} > 0 \text{ and } \text{Deviation} \ge 1.0\%) \text{ else } \mathbf{NOT\ VIABLE}$
- **Disclaimer**: Output is strictly labeled as *"Estimated / simulated economic exposure"* under single-block arbitrage assumptions.

### 3. MAP (Exposed Protocol Surface)
- Dynamically loaded from `data/protocols.json`.
- Sortable table by **Protocol**, **TVL**, and **Category**.
- Computes **Total TVL Exposed** dynamically across all consumer protocols.
- Expandable rows for integration specifics and risk analysis.

### 4. REPLAY (Historical Exploit Similarity Matcher)
- Dynamically loaded from `data/historical_incidents.json`.
- Calculates real mathematical similarity between the active price deviation and historical DeFi oracle attacks (Mango Markets, BonqDAO, Venus Protocol, Synthetix, bZx):
  $$\text{Distance} = |\text{Current Deviation} - \text{Incident Deviation}|$$
  $$\text{Similarity \%} = \max\left(0, 100 - \frac{\text{Distance}}{\max(\text{Current Deviation}, \text{Incident Deviation}, 1.0)} \times 100\right)$$
- Automatically ranks incidents and highlights the closest match.
- Expandable post-mortem breakdown for root cause analysis.

### 5. LIVE SYSTEM LOG
- Auto-scrolling terminal window displaying genuine backend execution milestones with millisecond timestamps (`[HH:MM:SS.mmm]`), RPC round IDs, status codes, and network error reporting.

---

## File Structure

```
OracleWatch/
├── app.py                      # Flask backend (APIs for detect, price-risk, protocols, replay)
├── requirements.txt            # Python dependencies (flask, flask-cors, web3, requests)
├── README.md                   # Project documentation
│
├── data/
│   ├── protocols.json          # Protocols dataset (defillama.com/oracles/chainlink)
│   └── historical_incidents.json # Historical oracle attacks dataset (defillama.com/hacks)
│
├── templates/
│   └── index.html              # Security console single-page UI
│
└── static/
    ├── style.css               # Console stylesheet (#000 background, #A855F7 accent, monospace font)
    └── app.js                  # Vanilla JS controller with real-time UI interactivity
```

---

## Quick Start & Running Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python app.py
```

### 3. Access Dashboard
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## Data Customization

To supply your own data:
- **`data/protocols.json`**: Add or update protocols consuming the Chainlink feed from [defillama.com/oracles/chainlink](https://defillama.com/oracles/chainlink).
- **`data/historical_incidents.json`**: Add or update historical oracle failure incidents from [defillama.com/hacks](https://defillama.com/hacks).
