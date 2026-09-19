# OracleWatch — Oracle Security Monitoring

> **Tagline:** Detect. Price. Map.

OracleWatch is a real-time Web3 oracle security monitoring dashboard prototype built for Web3 security hackathons. Inspired by internal security monitoring consoles like Grafana and Tenderly, it provides continuous visibility into oracle health, price divergence, economic exposure, and protocol blast radius.

---

## Core Flow

```
DETECT ───▶ PRICE ───▶ MAP
```

1. **Detect (≈45%)**: Continuously monitors whether an on-chain oracle is deviating from an off-chain reference market.
2. **Price (≈25%)**: Estimates the economic significance of the detected deviation using DEX movement cost and lending extraction upper bounds.
3. **Map (≈30%)**: Maps the dependency tree and blast radius across consumer protocols, adapters, markets, and vaults.

---

## Visual Design & Architecture

- **Security Console Aesthetic**: Continuous dark background (`#08090c`), 1px neutral vertical dividers (`#1a1e2b`), max 4px corner radius, zero gradients, zero drop shadows, zero glows, and zero emojis.
- **Palette**: Neutral grey text (`#94a3b8` / `#e2e8f0`), `#A855F7` purple accent reserved exclusively for oracle data and active elements, `#ef4444` red reserved exclusively for threshold breach alerts.
- **Typography**: `IBM Plex Sans` for interface text, `IBM Plex Mono` for tabular numerals, contract addresses, timestamps, and round IDs.
- **Native SVG Chart**: Real-time step line for the oracle price (purple), standard line for the market reference (neutral grey), and interactive crosshair tooltips.

---

## Live Data Sources

All live data is sourced directly from verifiable on-chain contracts and public APIs (with a 10-second backend response cache):

| Component | Source | Identifier / Endpoint | Method |
| :--- | :--- | :--- | :--- |
| **Oracle Feed** | Chainlink AggregatorV3 | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` (ETH/USD on Ethereum Mainnet) | `latestRoundData()` |
| **Market Reference** | DefiLlama Coins API | `https://coins.llama.fi/prices/current/coingecko:ethereum` | `GET` |
| **Historical Chart** | DefiLlama Chart API | `https://coins.llama.fi/chart/coingecko:ethereum` | `GET` |
| **DeFi Hacks** | DefiLlama Hacks API | `https://api.llama.fi/hacks` (with fallback to `data/hacks.json`) | `GET` |
| **Protocol Dependencies** | Verified Dataset | `data/dependencies.json` | Local File / API |

---

## Monitoring Modes

### 1. Live Mode
- Polls live Chainlink on-chain contract and DefiLlama market API every 15 seconds.
- Computes percentage price deviation:
  $$\text{Deviation \%} = \frac{|\text{Oracle Price} - \text{Market Price}|}{\text{Market Price}} \times 100$$
- Normal state: `"No deviation above 2.0%."`
- Breach state (at or above 2.0%): Triggers the top alert banner, colors the deviation metric in red, and highlights the affected blast radius in the Map region.

### 2. Replay Mode
- Allows selection of historical DeFi oracle exploits (Mango Markets, BonqDAO, Venus Protocol, Synthetix, bZx).
- Fetches real historical price candles around the incident timestamp from DefiLlama.
- Models a delayed-feed oracle line using the standard 1-hour heartbeat delay.
- Plays back the price trajectory at 30x speed to demonstrate how oracle latency triggers exploitable divergence.
- *Note:* Clearly labeled as a **delayed-feed model**, not a historical on-chain archive reconstruction.

### 3. Stress Test Mode
- Injects a simulated **-6.8% reference price drop** relative to the live Chainlink feed.
- Displays a permanent **SIMULATED** badge.
- Triggers the alert banner, recalculates DEX movement costs and net opportunity in the Price region, and highlights the dependent protocol tree in the Map region.
- Completely isolated in memory; performs no write operations, no transactions, and requires no wallet connections.

---

## Economic Model (Price Region)

The Price region provides a mathematical estimate of the capital required to manipulate a spot market versus the extractable upper bound from a dependent lending pool.

### 1. DEX Price Movement Cost Model
$$\text{Cost} \approx R \times \left(\sqrt{\frac{1}{1 - d}} - 1\right)$$
- $d = \text{Deviation as a decimal}$ ($\text{deviation \%} / 100$)
- $R = \text{Pool TVL} / 2$ (Reserve in a representative Uniswap/Curve ETH pool)

### 2. Extractable Upper Bound
$$\text{Extractable Upper Bound} = \min(\text{Borrowable Liquidity}, \text{Collateral Supplied against Feed})$$
*Total protocol TVL is never used as extractable value.*

### 3. Attacker Cost
$$\text{Attacker Cost} = \text{Flash Loan Fee (0.09\%)} + \text{Gas Cost (\$50.00)}$$

### 4. Net Opportunity Estimate
$$\text{Net Opportunity} = \text{Extractable Upper Bound} - \text{DEX Movement Cost} - \text{Attacker Cost}$$

> [!IMPORTANT]
> **Model Disclaimer:** The Price region provides model-based estimates of economic exposure under simplified single-block assumptions. It does not guarantee exploit profitability and should not be interpreted as a real exploit simulation or financial advice.

---

## Protocol Dependency Map (Map Region)

The Map region tracks the blast radius from the monitored Chainlink feed (`0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`) across verified dependent protocols:

- **Aave V3**: \$11.84B exposed across 4 markets (`AaveOracle.sol` adapter)
- **MakerDAO / Sky**: \$5.42B exposed across 3 markets (`ETH-USD OSM` delayed medianizer)
- **Compound V3**: \$2.35B exposed across 2 markets (`PriceFeedAggregator.sol`)
- **Spark Protocol**: \$1.68B exposed across 2 markets (`SparkOracle.sol`)
- **Morpho Blue**: \$1.12B exposed across 3 isolated pairs (`MorphoChainlinkOracleV2.sol`)
- **Liquity V2**: \$720M exposed across ETH Troves (`PriceFeed.sol` fallback)

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /` | `GET` | Single-page security console dashboard |
| `GET /api/detect` | `GET` | Fetches live Chainlink and DefiLlama prices, computes deviation, and logs events |
| `GET /api/history` | `GET` | Returns the in-memory rolling price series for SVG chart rendering |
| `POST /api/price-risk` | `POST/GET`| Computes DEX movement costs, extractable bounds, and net opportunity |
| `GET /api/dependencies` | `GET` | Returns verified dependency tree, affected markets, and exposed dollars |
| `GET /api/hacks` | `GET` | Returns DefiLlama hacks with fallback to `data/hacks.json` |
| `GET /api/replay` | `GET` | Returns historical chart points with delayed-feed oracle line |

---

## Installation & Running Locally

### 1. Prerequisites
- Python 3.9+
- Pip

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

### 4. Open in Browser
Navigate to:
```
http://127.0.0.1:5000
```
