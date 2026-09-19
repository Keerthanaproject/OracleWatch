import json
import os
import time
from datetime import datetime, timezone
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import requests
from web3 import Web3

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
PROTOCOLS_FILE = os.path.join(DATA_DIR, "protocols.json")
INCIDENTS_FILE = os.path.join(DATA_DIR, "historical_incidents.json")

# Ethereum RPCs with priority order
PRIMARY_RPC = "https://eth.llamarpc.com"
FALLBACK_RPCS = [
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
    "https://1rpc.io/eth",
    "https://cloudflare-eth.com"
]

# Chainlink ETH/USD AggregatorV3 Feed contract on Ethereum Mainnet
CHAINLINK_ETH_USD_ADDRESS = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
AGGREGATOR_V3_ABI = [
    {
        "inputs": [],
        "name": "latestRoundData",
        "outputs": [
            {"internalType": "uint80", "name": "roundId", "type": "uint80"},
            {"internalType": "int256", "name": "answer", "type": "int256"},
            {"internalType": "uint256", "name": "startedAt", "type": "uint256"},
            {"internalType": "uint256", "name": "updatedAt", "type": "uint256"},
            {"internalType": "uint80", "name": "answeredInRound", "type": "uint80"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "description",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]


def make_log_entry(level, message, details=None):
    """Generate a structured log record with millisecond timestamp."""
    return {
        "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        "level": level.upper(),
        "message": message,
        "details": details
    }


def fetch_chainlink_price(logs):
    """
    Fetch live ETH/USD price from Chainlink on-chain aggregator.
    Tries primary RPC first, then falls back to resilient public RPCs.
    """
    all_rpcs = [PRIMARY_RPC] + [r for r in FALLBACK_RPCS if r != PRIMARY_RPC]
    last_error = None

    for idx, rpc_url in enumerate(all_rpcs):
        is_primary = (idx == 0)
        rpc_label = "Primary RPC (llamarpc)" if is_primary else f"Fallback RPC ({rpc_url})"
        logs.append(make_log_entry("INFO", f"Connecting to {rpc_label}..."))

        try:
            w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 6}))
            if not w3.is_connected():
                logs.append(make_log_entry("WARN", f"Connection check failed for {rpc_url}"))
                continue

            contract = w3.eth.contract(
                address=Web3.to_checksum_address(CHAINLINK_ETH_USD_ADDRESS),
                abi=AGGREGATOR_V3_ABI
            )
            
            logs.append(make_log_entry("INFO", f"Calling latestRoundData() on {CHAINLINK_ETH_USD_ADDRESS[:10]}..."))
            round_data = contract.functions.latestRoundData().call()
            
            round_id = round_data[0]
            raw_answer = round_data[1]
            updated_at = round_data[3]

            if raw_answer <= 0:
                logs.append(make_log_entry("ERROR", f"Invalid oracle price returned: {raw_answer}"))
                return None, None, None, f"Non-positive oracle price: {raw_answer}"

            oracle_price = float(raw_answer) / 1e8
            updated_str = datetime.fromtimestamp(updated_at, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

            logs.append(make_log_entry("SUCCESS", f"Chainlink ETH/USD on-chain price: ${oracle_price:,.2f} [Round ID: {round_id}]"))
            return oracle_price, round_id, updated_str, None

        except Exception as err:
            last_error = str(err)
            logs.append(make_log_entry("WARN", f"RPC {rpc_url} failed: {err}"))

    logs.append(make_log_entry("ERROR", f"All Ethereum RPCs exhausted. Last error: {last_error}"))
    return None, None, None, f"RPC failure: {last_error}"


def fetch_coingecko_price(logs):
    """
    Fetch reference ETH market price from CoinGecko public API.
    """
    url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    logs.append(make_log_entry("INFO", "Querying CoinGecko reference market API (GET /simple/price)..."))

    try:
        response = requests.get(
            url,
            timeout=7,
            headers={"User-Agent": "OracleWatch-Security-Monitor/1.0", "Accept": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            if "ethereum" in data and "usd" in data["ethereum"]:
                market_price = float(data["ethereum"]["usd"])
                logs.append(make_log_entry("SUCCESS", f"CoinGecko ETH/USD reference price: ${market_price:,.2f}"))
                return market_price, None
            else:
                msg = f"Unexpected CoinGecko response structure: {data}"
                logs.append(make_log_entry("ERROR", msg))
                return None, msg
        elif response.status_code == 429:
            msg = "CoinGecko API rate limit reached (HTTP 429)"
            logs.append(make_log_entry("ERROR", msg))
            return None, msg
        else:
            msg = f"CoinGecko request failed with HTTP {response.status_code}"
            logs.append(make_log_entry("ERROR", msg))
            return None, msg
    except requests.exceptions.Timeout:
        msg = "CoinGecko API request timed out (>7s)"
        logs.append(make_log_entry("ERROR", msg))
        return None, msg
    except Exception as err:
        msg = f"CoinGecko error: {err}"
        logs.append(make_log_entry("ERROR", msg))
        return None, msg


@app.route("/")
def index():
    """Render the single-page OracleWatch dashboard."""
    return render_template("index.html")


@app.route("/api/detect", methods=["GET"])
def detect_price_anomaly():
    """
    Feature 1 — Detect:
    Fetches on-chain Chainlink ETH/USD and CoinGecko market price (or uses historical inputs),
    calculates percentage deviation, checks against configurable threshold, and returns live logs.
    """
    logs = [make_log_entry("INFO", "Starting OracleWatch security anomaly detection...")]
    
    mode = request.args.get("mode", "live").lower().strip()
    feed = request.args.get("feed", "ETH/USD").strip()
    
    try:
        threshold = float(request.args.get("threshold", 5.0))
        if threshold < 0:
            threshold = 5.0
    except (ValueError, TypeError):
        threshold = 5.0

    oracle_price = None
    market_price = None
    oracle_round_id = None
    oracle_updated_at = None

    if mode == "historical":
        logs.append(make_log_entry("INFO", "Mode: HISTORICAL REPLAY (Processing user-entered price snapshot)"))
        try:
            raw_oracle = request.args.get("historical_oracle_price")
            raw_market = request.args.get("historical_market_price")
            
            if raw_oracle is None or raw_market is None:
                err_msg = "Missing historical_oracle_price or historical_market_price parameter."
                logs.append(make_log_entry("ERROR", err_msg))
                return jsonify({"success": False, "error": err_msg, "logs": logs}), 400
            
            oracle_price = float(raw_oracle)
            market_price = float(raw_market)

            if oracle_price <= 0 or market_price <= 0:
                err_msg = "Historical prices must be strictly positive numbers."
                logs.append(make_log_entry("ERROR", err_msg))
                return jsonify({"success": False, "error": err_msg, "logs": logs}), 400

            logs.append(make_log_entry("INFO", f"Input Historical Oracle Price: ${oracle_price:,.2f}"))
            logs.append(make_log_entry("INFO", f"Input Historical Market Price: ${market_price:,.2f}"))
            oracle_round_id = "HISTORICAL_REPLAY"
            oracle_updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        except ValueError as e:
            err_msg = f"Invalid numeric input for historical replay: {e}"
            logs.append(make_log_entry("ERROR", err_msg))
            return jsonify({"success": False, "error": err_msg, "logs": logs}), 400

    else:
        # LIVE Mode
        logs.append(make_log_entry("INFO", f"Mode: LIVE | Feed: {feed} (Chainlink Aggregator: {CHAINLINK_ETH_USD_ADDRESS})"))
        
        oracle_price, oracle_round_id, oracle_updated_at, oracle_err = fetch_chainlink_price(logs)
        market_price, market_err = fetch_coingecko_price(logs)

        if oracle_price is None or market_price is None:
            err_msg = f"Detection failed. Oracle: {oracle_err or 'OK'}, Market: {market_err or 'OK'}"
            logs.append(make_log_entry("ERROR", err_msg))
            return jsonify({
                "success": False,
                "error": err_msg,
                "oracle_price": oracle_price,
                "market_price": market_price,
                "logs": logs
            }), 502

    # Deviation Calculation: abs(oracle_price - market_price) / market_price * 100
    logs.append(make_log_entry("INFO", "Computing price deviation: abs(oracle - market) / market * 100..."))
    
    if market_price == 0:
        deviation = 0.0
    else:
        deviation = (abs(oracle_price - market_price) / market_price) * 100.0

    is_anomaly = deviation > threshold
    status_label = "ANOMALY_DETECTED" if is_anomaly else "NORMAL"

    if is_anomaly:
        logs.append(make_log_entry("WARN", f"ALERT: Deviation {deviation:.2f}% EXCEEDS threshold ({threshold:.2f}%)! [FLAG: ANOMALY]"))
    else:
        logs.append(make_log_entry("INFO", f"Deviation {deviation:.2f}% is within normal threshold ({threshold:.2f}%). [STATUS: OK]"))

    logs.append(make_log_entry("SUCCESS", f"Detection completed in {mode.upper()} mode."))

    return jsonify({
        "success": True,
        "mode": mode,
        "feed": feed,
        "oracle_price": round(oracle_price, 2),
        "market_price": round(market_price, 2),
        "deviation": round(deviation, 2),
        "threshold": round(threshold, 2),
        "is_anomaly": is_anomaly,
        "status": status_label,
        "oracle_round_id": str(oracle_round_id),
        "oracle_updated_at": oracle_updated_at,
        "logs": logs
    })


@app.route("/api/price-risk", methods=["POST", "GET"])
def calculate_price_risk():
    """
    Feature 2 — Price:
    Aave-style health factor calculation and simulated economic arbitrage exposure.
    Health factor = collateral value * liquidation threshold / debt value
    Handles edge cases: zero debt, zero collateral, negative prices/inputs safely.
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = request.args.to_dict()

    try:
        collateral_val = float(data.get("collateral", 1000000))
        liq_threshold = float(data.get("liquidation_threshold", 0.80))
        debt_val = float(data.get("debt", 600000))
        deviation_pct = float(data.get("deviation", 0.0))
        gas_cost = float(data.get("gas_cost", 50.0))
        flash_loan_fee_pct = float(data.get("flash_loan_fee", 0.09))
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid numeric parameters in price risk payload."}), 400

    # Ensure non-negative sanitary bounds
    collateral_val = max(0.0, collateral_val)
    liq_threshold = max(0.0, min(1.0, liq_threshold))
    debt_val = max(0.0, debt_val)
    gas_cost = max(0.0, gas_cost)
    flash_loan_fee_pct = max(0.0, flash_loan_fee_pct)

    # Health factor calculation
    if debt_val == 0:
        health_factor = None  # Effectively infinite / zero risk of liquidation
        hf_display = "Infinity (No Debt)"
    elif collateral_val == 0:
        health_factor = 0.0
        hf_display = "0.00"
    else:
        health_factor = round((collateral_val * liq_threshold) / debt_val, 4)
        hf_display = f"{health_factor:.2f}"

    # Economic Exposure Arbitrage Model:
    # When oracle reports a deviation, collateral can be revalued artificially:
    # Revalued Collateral = Collateral * (1 + deviation / 100)
    # Maximum Borrow Capacity = Revalued Collateral * Liquidation Threshold
    # Potential Extraction = max(0, Max Borrow Capacity - Current Debt)
    revalued_collateral = collateral_val * (1.0 + (deviation_pct / 100.0))
    max_borrow_capacity = revalued_collateral * liq_threshold
    potential_extraction = max(0.0, max_borrow_capacity - debt_val)

    # Attacker Costs: Flash loan fee on borrowed capital + transaction gas
    capital_needed = potential_extraction if potential_extraction > 0 else debt_val
    flash_loan_fee = capital_needed * (flash_loan_fee_pct / 100.0)
    estimated_attacker_cost = flash_loan_fee + gas_cost

    # Net Opportunity = Extraction - Attacker Cost
    net_opportunity = potential_extraction - estimated_attacker_cost

    # Verdict: VIABLE if net opportunity > 0 and deviation > 0.5% (meaningful anomaly), else NOT VIABLE
    is_viable = (net_opportunity > 0) and (deviation_pct >= 1.0)
    verdict = "VIABLE" if is_viable else "NOT VIABLE"

    assumptions = [
        "Health Factor = (Collateral × Liquidation Threshold) / Debt",
        "Potential Extraction = max(0, [Collateral × (1 + Deviation%)] × LT - Debt)",
        f"Flash Loan Fee = {flash_loan_fee_pct:.2f}% of borrowed capital",
        f"Gas Cost = ${gas_cost:.2f} per transaction batch",
        "Net Opportunity = Potential Extraction - (Flash Loan Fee + Gas Cost)",
        "Result is an estimated / simulated economic exposure, not guaranteed exploit profit."
    ]

    return jsonify({
        "success": True,
        "inputs": {
            "collateral": collateral_val,
            "liquidation_threshold": liq_threshold,
            "debt": debt_val,
            "deviation": deviation_pct,
            "gas_cost": gas_cost,
            "flash_loan_fee_pct": flash_loan_fee_pct
        },
        "results": {
            "health_factor": health_factor,
            "health_factor_display": hf_display,
            "revalued_collateral": round(revalued_collateral, 2),
            "max_borrow_capacity": round(max_borrow_capacity, 2),
            "potential_extraction": round(potential_extraction, 2),
            "flash_loan_fee": round(flash_loan_fee, 2),
            "gas_cost": round(gas_cost, 2),
            "estimated_attacker_cost": round(estimated_attacker_cost, 2),
            "net_opportunity": round(net_opportunity, 2),
            "verdict": verdict,
            "is_viable": is_viable
        },
        "assumptions": assumptions,
        "disclaimer": "Estimated / simulated economic exposure"
    })


@app.route("/api/protocols", methods=["GET"])
def get_protocols():
    """
    Feature 3 — Map:
    Dynamically loads protocols from data/protocols.json, calculates Total Exposed TVL,
    and returns protocol items for the sortable matrix.
    """
    if not os.path.exists(PROTOCOLS_FILE):
        return jsonify({
            "success": False,
            "error": "Protocols dataset not found at data/protocols.json. Please provide data from defillama.com/oracles/chainlink.",
            "protocols": [],
            "total_tvl_exposed": 0
        }), 404

    try:
        with open(PROTOCOLS_FILE, "r", encoding="utf-8") as f:
            protocols_raw = json.load(f)

        # Filter out comment-only entries if any
        protocols = [p for p in protocols_raw if isinstance(p, dict) and "protocol" in p]
        
        total_tvl_exposed = sum(float(p.get("tvl", 0)) for p in protocols)

        return jsonify({
            "success": True,
            "count": len(protocols),
            "total_tvl_exposed": total_tvl_exposed,
            "total_tvl_formatted": f"${total_tvl_exposed:,.0f}",
            "protocols": protocols
        })
    except json.JSONDecodeError as e:
        return jsonify({
            "success": False,
            "error": f"Malformed JSON in data/protocols.json: {e}",
            "protocols": [],
            "total_tvl_exposed": 0
        }), 500


@app.route("/api/replay", methods=["GET"])
def get_historical_replay():
    """
    Feature 4 — Replay:
    Dynamically loads historical incidents from data/historical_incidents.json,
    computes mathematical similarity with the current deviation %, and sorts by closest match.
    """
    try:
        current_dev = float(request.args.get("deviation", 0.0))
    except (ValueError, TypeError):
        current_dev = 0.0

    if not os.path.exists(INCIDENTS_FILE):
        return jsonify({
            "success": False,
            "error": "Historical incidents dataset not found at data/historical_incidents.json.",
            "incidents": [],
            "closest_match": None
        }), 404

    try:
        with open(INCIDENTS_FILE, "r", encoding="utf-8") as f:
            incidents_raw = json.load(f)

        incidents = [inc for inc in incidents_raw if isinstance(inc, dict) and "name" in inc]

        # Real mathematical similarity calculation:
        # Distance = abs(current_dev - incident_dev)
        # Denominator = max(current_dev, incident_dev, 1.0)
        # Similarity% = max(0.0, 100.0 - (Distance / Denominator * 100.0))
        scored_incidents = []
        for inc in incidents:
            inc_dev = float(inc.get("deviation", 0.0))
            distance = abs(current_dev - inc_dev)
            denom = max(current_dev, inc_dev, 1.0)
            
            # Relative similarity score between 0% and 100%
            similarity_pct = max(0.0, min(100.0, round((1.0 - (distance / denom)) * 100.0, 1)))

            scored_incidents.append({
                "name": inc.get("name", "Unknown Incident"),
                "date": inc.get("date", "N/A"),
                "historical_deviation": inc_dev,
                "current_deviation": current_dev,
                "similarity_score": similarity_pct,
                "duration": inc.get("duration", "N/A"),
                "loss": inc.get("loss", "N/A"),
                "outcome": inc.get("outcome", "N/A"),
                "description": inc.get("description", "N/A")
            })

        # Sort descending by calculated similarity score
        scored_incidents.sort(key=lambda x: x["similarity_score"], reverse=True)

        closest_match = scored_incidents[0] if scored_incidents else None

        return jsonify({
            "success": True,
            "current_deviation": current_dev,
            "count": len(scored_incidents),
            "closest_match": closest_match,
            "incidents": scored_incidents
        })
    except json.JSONDecodeError as e:
        return jsonify({
            "success": False,
            "error": f"Malformed JSON in data/historical_incidents.json: {e}",
            "incidents": [],
            "closest_match": None
        }), 500


if __name__ == "__main__":
    print("==================================================================")
    print(" OracleWatch — Oracle Security Monitoring Prototype")
    print(" Running on http://127.0.0.1:5000")
    print(" Chainlink Feed: ETH/USD (0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)")
    print(" Reference Market: CoinGecko API")
    print("==================================================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
