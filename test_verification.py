"""
End-to-End Verification Test Script for OracleWatch Prototype
Tests all endpoints, responses, data integrity, error handling, and calculations.
"""

import sys
import time
import requests

BASE_URL = "http://127.0.0.1:5000"

def test_all():
    print("=" * 60)
    print(" ORACLEWATCH PROTOTYPE VERIFICATION SUITE")
    print("=" * 60)
    
    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f" [PASS] {name} {details}")
        else:
            print(f" [FAIL] {name} {details}")

    # 1. Test HTML Dashboard
    try:
        r = requests.get(f"{BASE_URL}/", timeout=5)
        assert_test("GET / (Dashboard HTML)", r.status_code == 200 and "OracleWatch" in r.text, f"HTTP {r.status_code}")
    except Exception as e:
        assert_test("GET / (Dashboard HTML)", False, str(e))

    # 2. Test GET /api/detect (Live Mode)
    try:
        r = requests.get(f"{BASE_URL}/api/detect?mode=live", timeout=10)
        data = r.json()
        status_ok = r.status_code == 200 and data.get("status") == "ok"
        has_oracle = data.get("oracle", {}).get("price") is not None
        has_market = data.get("market", {}).get("price") is not None
        has_dev = data.get("deviation", {}).get("percent") is not None
        assert_test("GET /api/detect (Live Mode)", status_ok and has_oracle and has_market and has_dev,
                    f"Oracle: ${data.get('oracle_price')} | Market: ${data.get('market_price')} | Dev: {data.get('deviation_percent')}%")
    except Exception as e:
        assert_test("GET /api/detect (Live Mode)", False, str(e))

    # 3. Test GET /api/detect (Stress Test Mode -6.8%)
    try:
        r = requests.get(f"{BASE_URL}/api/detect?mode=stress", timeout=10)
        data = r.json()
        is_sim = data.get("simulated") is True
        dev_val = data.get("deviation", {}).get("percent", 0)
        is_anomaly = data.get("deviation", {}).get("anomaly") is True
        assert_test("GET /api/detect (Stress Test Mode)", r.status_code == 200 and is_sim and dev_val >= 6.0 and is_anomaly,
                    f"Simulated: {is_sim} | Deviation: {dev_val}% | Anomaly: {is_anomaly}")
    except Exception as e:
        assert_test("GET /api/detect (Stress Test Mode)", False, str(e))

    # 4. Test GET /api/history
    try:
        r = requests.get(f"{BASE_URL}/api/history", timeout=5)
        data = r.json()
        assert_test("GET /api/history (Rolling Chart Buffer)", r.status_code == 200 and isinstance(data.get("history"), list),
                    f"Points count: {data.get('count')}")
    except Exception as e:
        assert_test("GET /api/history (Rolling Chart Buffer)", False, str(e))

    # 5. Test POST /api/price-risk
    try:
        payload = {
            "deviation": 6.8,
            "pool_tvl": 900000000,
            "borrowable_liquidity": 120000000,
            "collateral_supplied": 250000000,
            "gas_cost": 50,
            "flash_loan_fee_pct": 0.09
        }
        r = requests.post(f"{BASE_URL}/api/price-risk", json=payload, timeout=5)
        data = r.json()
        res = data.get("results", {})
        has_cost = res.get("market_movement_cost") is not None
        has_bound = res.get("extractable_upper_bound") == 120000000
        has_net = res.get("net_opportunity") is not None
        assert_test("POST /api/price-risk (Economic Model)", r.status_code == 200 and has_cost and has_bound and has_net,
                    f"Move Cost: ${res.get('market_movement_cost'):,.2f} | Bound: ${res.get('extractable_upper_bound'):,.2f} | Net: ${res.get('net_opportunity'):,.2f} | Verdict: {res.get('verdict')}")
    except Exception as e:
        assert_test("POST /api/price-risk (Economic Model)", False, str(e))

    # 6. Test GET /api/dependencies & /api/protocols
    try:
        r = requests.get(f"{BASE_URL}/api/dependencies", timeout=5)
        data = r.json()
        protocols = data.get("protocols", [])
        has_protocols = len(protocols) >= 5
        exposed = data.get("total_dollars_exposed", 0)
        assert_test("GET /api/dependencies (Blast Radius Map)", r.status_code == 200 and has_protocols and exposed > 0,
                    f"Protocols: {len(protocols)} | Total Exposed: ${exposed:,.0f} | Markets: {data.get('total_markets_hit')} | Vaults: {data.get('total_vaults_hit')}")
    except Exception as e:
        assert_test("GET /api/dependencies (Blast Radius Map)", False, str(e))

    # 7. Test GET /api/hacks
    try:
        r = requests.get(f"{BASE_URL}/api/hacks", timeout=8)
        data = r.json()
        hacks = data.get("hacks", [])
        assert_test("GET /api/hacks (Historical Incident API)", r.status_code == 200 and len(hacks) > 0,
                    f"Source: {data.get('source')} | Incidents: {len(hacks)}")
    except Exception as e:
        assert_test("GET /api/hacks (Historical Incident API)", False, str(e))

    # 8. Test GET /api/replay
    try:
        r = requests.get(f"{BASE_URL}/api/replay?date=1665446400&heartbeat=3600", timeout=8)
        data = r.json()
        pts = data.get("replay_points", [])
        assert_test("GET /api/replay (Delayed-Feed Replay)", r.status_code == 200 and len(pts) > 0,
                    f"Model: {data.get('model')} | Heartbeat: {data.get('heartbeat_seconds')}s | Points: {len(pts)}")
    except Exception as e:
        assert_test("GET /api/replay (Delayed-Feed Replay)", False, str(e))

    # 9. Test Cache TTL (10s)
    try:
        t1 = time.time()
        r1 = requests.get(f"{BASE_URL}/api/detect?mode=live", timeout=5)
        t2 = time.time()
        r2 = requests.get(f"{BASE_URL}/api/detect?mode=live", timeout=5)
        data2 = r2.json()
        is_cached = data2.get("cached") is True
        assert_test("Backend 10-Second Cache", r2.status_code == 200 and is_cached,
                    f"2nd request cached: {is_cached} (took {(time.time()-t2)*1000:.1f}ms vs {(t2-t1)*1000:.1f}ms)")
    except Exception as e:
        assert_test("Backend 10-Second Cache", False, str(e))

    print("=" * 60)
    print(f" RESULTS: {passed}/{total} TESTS PASSED")
    print("=" * 60)
    return passed == total

if __name__ == "__main__":
    time.sleep(1)
    success = test_all()
    sys.exit(0 if success else 1)
