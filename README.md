# OracleWatch

<p align="center">
  <img src="https://img.shields.io/badge/Web3-Security-8B5CF6?style=for-the-badge" alt="Web3 Security">
  <img src="https://img.shields.io/badge/Blockchain-Ethereum-627EEA?style=for-the-badge" alt="Ethereum">
  <img src="https://img.shields.io/badge/Oracle-Chainlink-375BD2?style=for-the-badge" alt="Chainlink">
  <img src="https://img.shields.io/badge/Backend-Flask-000000?style=for-the-badge" alt="Flask">
  <img src="https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=for-the-badge" alt="JavaScript">
</p>

<h1 align="center">OracleWatch</h1>

<h3 align="center">
Detect. Price. Map.
</h3>

<p align="center">
A real-time Web3 oracle security monitoring and protocol health intelligence platform.
</p>

<p align="center">
<b>Detect oracle anomalies → quantify economic significance → map the blast radius → understand the response window.</b>
</p>

---

## Quick Start

> **For judges and evaluators:** OracleWatch is designed to run locally with a simple Python setup.

### 1. Clone the repository

```bash
git clone https://github.com/Keerthanaproject/OracleWatch.git
cd OracleWatch
## Core Flow

```
DETECT ───▶ PRICE ───▶ MAP
```

## Core Architecture

OracleWatch is organized into three security-analysis regions:

| Region | Role | Approx. UI Area |
|---|---|---:|
| **Detect** | Continuously monitors oracle-vs-market divergence | ~45% |
| **Price** | Estimates the economic significance of the deviation | ~25% |
| **Map** | Maps dependent protocols and potential blast radius | ~30% |

### 1. Detect

Continuously monitors whether an on-chain oracle is deviating from an independent off-chain market reference.

### 2. Price

Estimates the economic significance of a detected deviation using:

- DEX price-movement cost
- Borrowable liquidity
- Collateral exposed to the monitored feed
- Attacker transaction costs
- Estimated net economic opportunity

### 3. Map

Maps the dependency chain from the monitored oracle to downstream consumers:

```text
Market
   ↓
Oracle Feed
   ↓
Oracle / OSM
   ↓
Adapter
   ↓
Lending Markets
   ↓
Vaults
The Map region is intended to show how an oracle anomaly could propagate through dependent DeFi infrastructure.
Visual Design & Architecture
OracleWatch is designed as a security-monitoring console, rather than a conventional marketing dashboard.
Interface Principles
- Continuous dark surface: #08090c
- Neutral 1px dividers: #1a1e2b
- Maximum corner radius: 4px
- No gradients
- No drop shadows
- No glow effects
- No decorative emojis
Color System
Color	Hex	Usage
Neutral Grey	#94a3b8	Secondary interface text
Light Grey	#e2e8f0	Primary interface text
Oracle Purple	#A855F7	Oracle data and active elements
Alert Red	#ef4444	Threshold-breach states


Purple is reserved for oracle-related information and active UI elements. Red is reserved for actual threshold-breach conditions.
Typography
- IBM Plex Sans — interface text and labels
- IBM Plex Mono — timestamps, contract addresses, round IDs, and tabular values
Native SVG Visualization
The monitoring chart uses native SVG rendering to display:
- Oracle price as a purple step line
- Market reference as a neutral line
- Configurable deviation threshold
- Time-series axes and ticks
- Interactive crosshair
- Hover tooltips
- Live price updates
Live Data Sources
OracleWatch uses verifiable on-chain data and public DeFi APIs for its monitoring workflow.
A short backend response cache is used to avoid unnecessary repeated requests.
Component	Source	Identifier / Endpoint	Method
Oracle Feed	Chainlink AggregatorV3	0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419	latestRoundData()
Market Reference	DefiLlama Coins API	https://coins.llama.fi/prices/current/coingecko:ethereum	GET
Historical Chart	DefiLlama Chart API	https://coins.llama.fi/chart/coingecko:ethereum	GET
DeFi Hacks	DefiLlama Hacks API	https://api.llama.fi/hacks	GET
Dependency Dataset	Local verified dataset	data/dependencies.json	Local file


Oracle Feed
The monitored feed is the Ethereum Mainnet Chainlink ETH/USD AggregatorV3 feed:
0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
OracleWatch reads the latest feed value using:
latestRoundData()
The returned value is normalized according to the feed's decimal representation before comparison with the market reference.
Monitoring Modes
OracleWatch provides three monitoring modes.
1. Live Mode
Live Mode compares the current Chainlink oracle value with the DefiLlama market reference.
The monitoring cycle runs periodically and computes:
\[
\text{Deviation \%}
=
\frac{|\text{Oracle Price}-\text{Market Price}|}
{\text{Market Price}}
\times100
\]Normal State
No deviation above 2.0%.
Breach State
When the configured deviation threshold is reached or exceeded:
- The alert state becomes active.
- The deviation metric is displayed in red.
- The affected dependency path is highlighted.
- The Price region recalculates the economic exposure.
- The Map region reflects the affected dependency scope.
The default threshold is configurable and set to:
2.0%
2. Replay Mode
Replay Mode is designed to demonstrate how oracle/market divergence can develop during historical DeFi incidents.
The workflow:
1. Select a historical incident.
2. Retrieve historical market data around the incident timestamp.
3. Reconstruct the market trajectory.
4. Generate a delayed-feed oracle line.
5. Play the resulting sequence at accelerated speed.
6. Display the resulting divergence and economic model.
The delayed oracle is modeled using a configurable default heartbeat delay of:
1 hour
Important: Replay Mode is a delayed-feed model, not a reconstruction of the historical on-chain oracle state at every block.

This distinction prevents the visualization from presenting a modeled replay as an exact historical transaction-level reconstruction.
3. Stress Test Mode
Stress Test Mode injects a controlled simulated market movement into the monitoring pipeline.
Default scenario:
Simulated reference-price movement: -6.8%
The interface displays a permanent:
SIMULATED
indicator while Stress Test Mode is active.
The scenario can trigger:
- Oracle deviation detection
- Alert generation
- Price-risk recalculation
- Dependency-map highlighting
Stress Test Mode is isolated from live blockchain state.
It performs:
- No blockchain transactions
- No contract writes
- No wallet connections
- No protocol modifications
Economic Model — Price Region
The Price region estimates whether a detected oracle deviation could represent meaningful economic exposure.
The model separates:
1. Market movement cost
2. Potential extractable liquidity
3. Attacker transaction costs
4. Estimated net opportunity
These values are model-based estimates, not guaranteed exploit profits.
1. DEX Price Movement Cost
OracleWatch estimates the cost of moving a representative constant-product market by the detected deviation.
\[
\text{Cost}
\approx
R
\times
\left(
\sqrt{\frac{1}{1-d}}-1
\right)
\]Where:
d = deviation / 100
R = representative pool reserve
For the prototype model:
\[
R = \frac{\text{Pool TVL}}{2}
\]This provides an approximate capital requirement for producing the observed market movement.
2. Extractable Upper Bound
The model does not treat total protocol TVL as immediately extractable value.
Instead:
\[
\text{Extractable Upper Bound}
=
\min(
\text{Borrowable Liquidity},
\text{Collateral Supplied Against Feed}
)
\]This limits the modeled exposure to liquidity that is more directly relevant to the affected oracle dependency.
3. Attacker Cost
The prototype includes transaction-level attack costs:
\[
\text{Attacker Cost}
=
\text{Flash Loan Fee}
+
\text{Gas Cost}
\]The prototype defaults to:
Flash-loan fee: 0.09%
Gas cost: $50
These values are configurable assumptions for the prototype model.
4. Net Opportunity Estimate
The resulting model is:
\[
\text{Net Opportunity}
=
\text{Extractable Upper Bound}
-
\text{DEX Movement Cost}
-
\text{Attacker Cost}
\]The output should be interpreted as an estimated economic exposure, not as a guaranteed executable attack.
[!IMPORTANT]
Model Disclaimer: The Price region provides model-based estimates under simplified assumptions. It does not guarantee exploit profitability, reproduce a complete protocol-specific exploit, or constitute financial advice.

Protocol Dependency Map — Map Region
The Map region represents the potential downstream impact of the monitored oracle.
The dependency model follows the path:
Chainlink Feed
      ↓
Oracle / OSM
      ↓
Adapter
      ↓
Consumer Protocol
      ↓
Market
      ↓
Vault / Position
The dashboard can represent:
- Dependent protocols
- Oracle adapters
- Consumer markets
- Vaults
- Estimated exposed value
- Number of affected markets
- Dependency paths
Example protocol dependencies represented by the prototype include:
Protocol	Example Exposure	Dependency
Aave V3	$11.84B	AaveOracle.sol
MakerDAO / Sky	$5.42B	ETH-USD OSM
Compound V3	$2.35B	PriceFeedAggregator.sol
Spark Protocol	$1.68B	SparkOracle.sol
Morpho Blue	$1.12B	MorphoChainlinkOracleV2.sol
Liquity V2	$720M	PriceFeed.sol


Data note: Exposure values displayed by the prototype must be treated according to the underlying dataset and its verification status. They should not be interpreted as continuously updated protocol TVL unless the implementation explicitly retrieves and refreshes those values from a live source.

Alert Flow
When the monitoring engine detects a threshold breach, OracleWatch connects the three regions:
Oracle Divergence
       ↓
    DETECT
       ↓
Economic Analysis
       ↓
     PRICE
       ↓
Dependency Analysis
       ↓
      MAP
       ↓
Explainable Security Alert
The alert is intended to answer three questions:
What happened?
The oracle and reference market are diverging.
Why does it matter?
The deviation may have economic significance based on the modeled market-movement cost and dependent liquidity.
What could be affected?
The dependency map identifies downstream markets and protocols associated with the monitored feed.
API Endpoints
Endpoint	Method	Description
/	GET	Serves the security-console dashboard
/api/detect	GET	Retrieves oracle/reference prices and computes deviation
/api/history	GET	Returns the rolling price series used by the chart
/api/price-risk	POST / GET	Calculates modeled DEX movement cost and economic exposure
/api/dependencies	GET	Returns dependency and exposure information
/api/hacks	GET	Retrieves historical DeFi incidents
/api/replay	GET	Generates historical/replay visualization data


Installation & Running Locally
Prerequisites
- Python 3.9+
- pip
- Internet connection for live API and blockchain data
1. Clone the Repository
git clone https://github.com/Keerthanaproject/OracleWatch.git
cd OracleWatch
2. Install Dependencies
pip install -r requirements.txt
3. Start OracleWatch
python app.py
The Flask server should start locally.
4. Open the Dashboard
Navigate to:
http://127.0.0.1:5000
Quick Demo Flow
For a hackathon demonstration, use the following sequence:
Step 1 — Live Monitoring
Open the dashboard in Live Mode.
Show:
- Chainlink ETH/USD price
- Market reference price
- Current deviation
- Oracle round ID
- Last update time
- Live chart
Step 2 — Detect
Explain that OracleWatch continuously compares:
On-chain Oracle
       vs
Independent Market Reference
Step 3 — Stress Test
Switch to Stress Test Mode.
Use the simulated deviation to demonstrate:
DETECT
  ↓
PRICE
  ↓
MAP
Step 4 — Price
Show how the detected deviation affects:
- Estimated DEX movement cost
- Extractable upper bound
- Attacker cost
- Net opportunity estimate
Step 5 — Map
Show the dependency chain from:
Oracle
  ↓
Adapter
  ↓
Market
  ↓
Protocol
  ↓
Vault / Position
Step 6 — Replay
Open Replay Mode and select a historical incident.
Explain that the replay uses historical market data combined with a modeled delayed-feed oracle.
Security & Safety
OracleWatch is a monitoring and analysis prototype.
It does not:
- Execute trades
- Submit blockchain transactions
- Modify smart contracts
- Connect to user wallets
- Request private keys
- Execute flash loans
- Perform real exploit transactions
- Modify protocol state
All Stress Test calculations are performed locally/in memory.
The system is intended for security analysis, monitoring, and educational demonstration.
Data Integrity
OracleWatch separates externally sourced data from modeled data.
External Data
Examples include:
- Chainlink oracle values
- DefiLlama market prices
- DefiLlama historical prices
- DefiLlama incident records
Modeled Data
Examples include:
- Delayed-feed replay
- DEX movement-cost estimates
- Extractable upper bounds
- Stress-test deviations
- Dependency relationships when sourced from the local dependency dataset
This distinction is important because a security-monitoring system should clearly identify what is observed and what is calculated.
Limitations
OracleWatch is a hackathon prototype and therefore does not attempt to reproduce every component of a production-grade security-monitoring platform.
Current limitations include:
- A single primary Chainlink feed is monitored.
- Reference-market data depends on external APIs.
- Replay Mode uses a modeled delayed-feed mechanism.
- Economic calculations use simplified assumptions.
- Dependency coverage depends on the available dependency dataset.
- Exposure values may not represent continuously refreshed protocol TVL.
- The prototype does not execute transaction-level exploit simulations.
- The prototype does not provide a guarantee that a detected condition is exploitable.
Future Scope
Potential extensions include:
- Multi-oracle monitoring
- Multi-chain monitoring
- WebSocket-based streaming
- More granular block-level replay
- Protocol-specific liquidation models
- Automated dependency discovery
- Historical oracle-state reconstruction
- Cross-oracle correlation
- Governance and admin-risk monitoring
- RPC health monitoring
- Automated alert delivery
- Production-grade historical data storage
- Protocol-specific exploitability models
Project Structure
OracleWatch/
│
├── app.py
├── config.py
├── requirements.txt
├── README.md
│
├── data/
│   ├── hacks.json
│   └── dependencies.json
│
└── static/
    └── index.html
Technology Stack
Layer	Technology
Backend	Python
Web Framework	Flask
Blockchain Access	Web3.py
Oracle	Chainlink AggregatorV3
Market Data	DefiLlama
Visualization	Native SVG
Frontend	HTML, CSS, Vanilla JavaScript
Typography	IBM Plex Sans / IBM Plex Mono
Version Control	Git / GitHub


Why OracleWatch?
Oracle manipulation is not only an oracle problem.
A meaningful security-monitoring workflow needs to connect:
Observed Deviation
       ↓
Economic Significance
       ↓
Protocol Dependency
       ↓
Potential Blast Radius
OracleWatch brings these dimensions into a single monitoring console.
Instead of displaying only a price difference, the prototype attempts to answer:
Is the deviation significant, what could it economically affect, and which dependent components should be investigated?

Project Objective
OracleWatch is designed around three principles:
Detect
Identify abnormal divergence between an on-chain oracle and an independent market reference.
Price
Estimate whether the divergence represents meaningful economic exposure.
Map
Identify the downstream protocol components that depend on the affected oracle.
             ORACLEWATCH

       DETECT  →  PRICE  →  MAP
          │         │        │
       Observe   Quantify  Trace
          │         │        │
          └─────────┴────────┘
                    ↓
          Explainable Alert
Prototype Disclaimer
OracleWatch is a research and hackathon prototype.
The system combines live blockchain/API observations with mathematical models and locally maintained datasets. Modeled values, replay scenarios, simulated deviations, and economic estimates must not be interpreted as guaranteed exploit conditions, guaranteed financial returns, or complete representations of production protocol state.
No real exploit transactions are executed by the prototype.
License
This project was developed as a hackathon prototype for experimentation, security research, and demonstration purposes.

### Important

After pasting this into GitHub's `README.md` editor:

1. Click **Preview**.
2. You should see the formatted tables, headings, formulas, code blocks, etc.
3. If you're editing the **raw Markdown file**, seeing `##`, `|`, and ``` while editing is **normal**. Those symbols disappear in **Preview** and on the actual GitHub repository page.

Also, I deliberately changed the dependency section to say **“Example protocol dependencies represented by the prototype”** and added the data-verification note. That is safer than presenting those dollar figures as continuously verified live exposure unless your current code actually fetches those exact values live.

# Demo

### Live Monitoring

![OracleWatch Live Dashboard]
<img width="850" height="743" alt="image" src="https://github.com/user-attachments/assets/6901ac3a-c653-4bb8-a091-29abec518d07" />


### Stress Test

![OracleWatch Stress Test]<img width="1036" height="733" alt="image" src="https://github.com/user-attachments/assets/64b9ffa6-f5e1-45c8-bbd4-77715c78d49d" />


### Exploit Window

![OracleWatch Exploit Window]<img width="563" height="568" alt="image" src="https://github.com/user-attachments/assets/06f7490c-e30a-48e8-ae8c-a12f5ce4b6b4" />


### Dependency Map

![OracleWatch Dependency Map]<img width="584" height="573" alt="image" src="https://github.com/user-attachments/assets/b27f9f0d-8eb4-40ce-9c54-3b896e3bac6a" />

