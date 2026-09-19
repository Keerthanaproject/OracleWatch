"""
OracleWatch Configuration
Centralized configuration parameters for oracle feeds, RPC providers, market APIs, and anomaly thresholds.
"""

# Chain & Feed Configuration
CHAIN_NAME = "Ethereum Mainnet"
CHAINLINK_FEED_ADDRESS = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
CHAINLINK_FEED_NAME = "ETH / USD"
FEED_DECIMALS = 8

# Ethereum RPC Endpoints (Primary with automatic resilient fallback)
ETHEREUM_RPC_URL = "https://eth.llamarpc.com"
PRIMARY_RPC = ETHEREUM_RPC_URL
FALLBACK_RPCS = [
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
    "https://1rpc.io/eth",
    "https://cloudflare-eth.com"
]

# Market Reference Price Source (DefiLlama Coins API)
MARKET_COIN_ID = "coingecko:ethereum"
DEFILLAMA_PRICES_URL = "https://coins.llama.fi/prices/current/{coin_id}"
DEFILLAMA_CHART_URL = "https://coins.llama.fi/chart/{coin_id}?start={start}&span={span}&period={period}"

# DefiLlama Protocol & Yield APIs
DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols"
DEFILLAMA_PROTOCOL_DETAIL_URL = "https://api.llama.fi/protocol/{slug}"
DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools"
DEFILLAMA_LENDBORROW_URL = "https://yields.llama.fi/lendBorrow"
DEFILLAMA_HACKS_URL = "https://api.llama.fi/hacks"

# Detection & Anomaly Settings
DEFAULT_DEVIATION_THRESHOLD = 2.0  # Anomaly flagged when deviation >= 2.0%
POLL_INTERVAL_SECONDS = 15        # Polling heartbeat interval (15s)
POLLING_INTERVAL_SECONDS = POLL_INTERVAL_SECONDS
CACHE_TTL_SECONDS = 10            # In-memory response cache TTL (10s)
CACHE_DURATION_SECONDS = CACHE_TTL_SECONDS
DEFAULT_HEARTBEAT_SECONDS = 3600  # Default heartbeat (1 hour)

# Standard Chainlink AggregatorV3 Interface ABI
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
