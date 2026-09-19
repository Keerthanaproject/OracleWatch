/**
 * OracleWatch — Frontend Controller
 * Vanilla JS interacting with Flask API endpoints:
 * /api/detect, /api/price-risk, /api/protocols, /api/replay
 */

(function () {
  'use strict';

  // State Management
  const state = {
    mode: 'live', // 'live' | 'historical'
    feed: 'ETH/USD',
    threshold: 5.0,
    currentDeviation: 0.0,
    oraclePrice: 0.0,
    marketPrice: 0.0,
    isAnomaly: false,
    protocols: [],
    protocolSortField: 'tvl',
    protocolSortAsc: false,
    historicalIncidents: []
  };

  // DOM Elements
  const el = {
    // Header
    globalStatusDot: document.getElementById('globalStatusDot'),
    globalStatusText: document.getElementById('globalStatusText'),
    lastSyncTime: document.getElementById('lastSyncTime'),
    alertBanner: document.getElementById('alertBanner'),
    alertBannerText: document.getElementById('alertBannerText'),

    // Detect Section
    modeLiveBtn: document.getElementById('modeLiveBtn'),
    modeHistBtn: document.getElementById('modeHistBtn'),
    triggerDetectBtn: document.getElementById('triggerDetectBtn'),
    feedSelect: document.getElementById('feedSelect'),
    thresholdSlider: document.getElementById('thresholdSlider'),
    thresholdDisplay: document.getElementById('thresholdDisplay'),
    historicalInputsGroup: document.getElementById('historicalInputsGroup'),
    histOraclePrice: document.getElementById('histOraclePrice'),
    histMarketPrice: document.getElementById('histMarketPrice'),
    
    // Readout cards
    deviationCard: document.getElementById('deviationCard'),
    deviationHero: document.getElementById('deviationHero'),
    deviationStatus: document.getElementById('deviationStatus'),
    oraclePriceVal: document.getElementById('oraclePriceVal'),
    oracleMeta: document.getElementById('oracleMeta'),
    marketPriceVal: document.getElementById('marketPriceVal'),
    marketMeta: document.getElementById('marketMeta'),
    securityStatusVal: document.getElementById('securityStatusVal'),
    roundMeta: document.getElementById('roundMeta'),

    // Price Section
    verdictBadge: document.getElementById('verdictBadge'),
    inputCollateral: document.getElementById('inputCollateral'),
    inputLiqThreshold: document.getElementById('inputLiqThreshold'),
    ltValDisplay: document.getElementById('ltValDisplay'),
    inputDebt: document.getElementById('inputDebt'),
    inputGasCost: document.getElementById('inputGasCost'),
    inputFlashFee: document.getElementById('inputFlashFee'),

    outHealthFactor: document.getElementById('outHealthFactor'),
    outRevaluedCollateral: document.getElementById('outRevaluedCollateral'),
    outPotentialExtraction: document.getElementById('outPotentialExtraction'),
    outFlashLoanFee: document.getElementById('outFlashLoanFee'),
    outAttackerCost: document.getElementById('outAttackerCost'),
    outNetOpportunity: document.getElementById('outNetOpportunity'),

    // Map Section
    totalTvlExposed: document.getElementById('totalTvlExposed'),
    protocolTableBody: document.getElementById('protocolTableBody'),
    protocolTable: document.getElementById('protocolTable'),

    // Replay Section
    replayCurrentDevTag: document.getElementById('replayCurrentDevTag'),
    replayListContainer: document.getElementById('replayListContainer'),

    // System Log
    terminalWindow: document.getElementById('terminalWindow'),
    terminalLogs: document.getElementById('terminalLogs'),
    clearLogsBtn: document.getElementById('clearLogsBtn')
  };

  // Utilities
  function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }

  function formatNumber(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
  }

  function getClientTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  function appendLog(level, message, timestamp = null) {
    const time = timestamp || getClientTimestamp();
    const logLine = document.createElement('div');
    logLine.className = 'log-line';

    const levelClass = (level || 'INFO').toLowerCase();
    logLine.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-level ${levelClass}">[${level.toUpperCase()}]</span>
      <span class="log-msg">${escapeHtml(message)}</span>
    `;

    el.terminalLogs.appendChild(logLine);
    el.terminalWindow.scrollTop = el.terminalWindow.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================
  // 1. ANOMALY DETECTION (Feature 1)
  // ==========================================================
  async function runDetection() {
    el.triggerDetectBtn.disabled = true;
    el.triggerDetectBtn.querySelector('.btn-text').textContent = 'DETECTING...';

    appendLog('INFO', `Starting detection cycle in ${state.mode.toUpperCase()} mode...`);

    let url = `/api/detect?mode=${encodeURIComponent(state.mode)}&feed=${encodeURIComponent(state.feed)}&threshold=${state.threshold}`;

    if (state.mode === 'historical') {
      const histOracle = parseFloat(el.histOraclePrice.value);
      const histMarket = parseFloat(el.histMarketPrice.value);

      if (isNaN(histOracle) || isNaN(histMarket) || histOracle <= 0 || histMarket <= 0) {
        appendLog('ERROR', 'Historical detection failed: Please enter valid positive numbers for both Historical Oracle and Market prices.');
        el.triggerDetectBtn.disabled = false;
        el.triggerDetectBtn.querySelector('.btn-text').textContent = 'RUN DETECTION';
        return;
      }

      url += `&historical_oracle_price=${histOracle}&historical_market_price=${histMarket}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();

      // Ingest real backend logs
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach(logItem => {
          appendLog(logItem.level, logItem.message, logItem.timestamp);
        });
      }

      if (res.ok && data.success) {
        state.oraclePrice = data.oracle_price;
        state.marketPrice = data.market_price;
        state.currentDeviation = data.deviation;
        state.isAnomaly = data.is_anomaly;

        updateDetectUI(data);
        recalculatePriceRisk();
        fetchHistoricalReplay(state.currentDeviation);
      } else {
        const errorMsg = data.error || 'Unknown error occurred during price detection.';
        appendLog('ERROR', `Detection error: ${errorMsg}`);
        el.securityStatusVal.textContent = 'ERROR';
        el.securityStatusVal.className = 'readout-status status-alert';
        el.deviationStatus.textContent = 'FAILED';
      }
    } catch (err) {
      appendLog('ERROR', `Network / Server communication error: ${err.message}`);
      el.securityStatusVal.textContent = 'RPC/API OFFLINE';
      el.securityStatusVal.className = 'readout-status status-alert';
    } finally {
      el.triggerDetectBtn.disabled = false;
      el.triggerDetectBtn.querySelector('.btn-text').textContent = 'RUN DETECTION';
      el.lastSyncTime.textContent = `SYNC: ${new Date().toLocaleTimeString()}`;
    }
  }

  function updateDetectUI(data) {
    // Large Hero Deviation
    const sign = data.oracle_price >= data.market_price ? '+' : '-';
    el.deviationHero.textContent = `${sign}${formatNumber(data.deviation, 2)}%`;
    el.oraclePriceVal.textContent = formatCurrency(data.oracle_price);
    el.marketPriceVal.textContent = formatCurrency(data.market_price);

    if (data.mode === 'live') {
      el.oracleMeta.textContent = `Round: ${data.oracle_round_id || 'N/A'}`;
      el.roundMeta.textContent = `Updated: ${data.oracle_updated_at || 'Just now'}`;
    } else {
      el.oracleMeta.textContent = 'Mode: Historical Input';
      el.roundMeta.textContent = 'Snapshot Evaluation';
    }

    // Evaluate against current configured threshold
    const isOverThreshold = data.deviation > state.threshold;

    if (isOverThreshold) {
      el.deviationStatus.textContent = `CRITICAL: EXCEEDS ${state.threshold.toFixed(1)}% THRESHOLD`;
      el.securityStatusVal.textContent = 'ALERT: ANOMALY';
      el.securityStatusVal.className = 'readout-status status-alert';

      // Trigger Pulse and Banner
      el.deviationCard.classList.add('anomaly-breach-pulse');
      el.alertBanner.classList.remove('hidden');
      el.alertBannerText.textContent = `ETH/USD Deviation (${data.deviation.toFixed(2)}%) exceeds configured ${state.threshold.toFixed(1)}% safety threshold. Lending markets exposed.`;
      
      el.globalStatusDot.className = 'status-indicator alert-pulse';
      el.globalStatusText.textContent = 'ANOMALY DETECTED';
    } else {
      el.deviationStatus.textContent = `NORMAL (Threshold: ${state.threshold.toFixed(1)}%)`;
      el.securityStatusVal.textContent = 'NORMAL';
      el.securityStatusVal.className = 'readout-status';

      el.deviationCard.classList.remove('anomaly-breach-pulse');
      el.alertBanner.classList.add('hidden');

      el.globalStatusDot.className = 'status-indicator live-pulse';
      el.globalStatusText.textContent = 'FEED ONLINE';
    }
  }

  // ==========================================================
  // 2. ECONOMIC IMPACT & EXPLOIT EXPOSURE (Feature 2)
  // ==========================================================
  function recalculatePriceRisk() {
    const collateral = Math.max(0, parseFloat(el.inputCollateral.value) || 0);
    const lt = Math.max(0, Math.min(1.0, parseFloat(el.inputLiqThreshold.value) || 0.8));
    const debt = Math.max(0, parseFloat(el.inputDebt.value) || 0);
    const gas = Math.max(0, parseFloat(el.inputGasCost.value) || 0);
    const flashFeePct = Math.max(0, parseFloat(el.inputFlashFee.value) || 0.09);
    const dev = state.currentDeviation || 0.0;

    // Health Factor = (Collateral * LT) / Debt
    let hf = 0.0;
    let hfDisplay = '0.00';
    if (debt === 0) {
      hfDisplay = 'Infinity (No Debt)';
    } else if (collateral === 0) {
      hfDisplay = '0.00';
    } else {
      hf = (collateral * lt) / debt;
      hfDisplay = hf.toFixed(2);
    }
    el.outHealthFactor.textContent = hfDisplay;

    // Revalued Collateral = Collateral * (1 + Deviation / 100)
    const revaluedCollateral = collateral * (1.0 + (dev / 100.0));
    el.outRevaluedCollateral.textContent = formatCurrency(revaluedCollateral);

    // Max Borrow Capacity = Revalued Collateral * LT
    const maxBorrowCapacity = revaluedCollateral * lt;

    // Potential Extraction = max(0, Max Borrow Capacity - Current Debt)
    const potentialExtraction = Math.max(0, maxBorrowCapacity - debt);
    el.outPotentialExtraction.textContent = formatCurrency(potentialExtraction);

    // Attacker Cost: Flash loan fee (0.09%) on extracted borrow capital + gas cost
    const flashFee = potentialExtraction * (flashFeePct / 100.0);
    el.outFlashLoanFee.textContent = formatCurrency(flashFee);

    const attackerCost = flashFee + gas;
    el.outAttackerCost.textContent = formatCurrency(attackerCost);

    // Net Opportunity = Potential Extraction - Attacker Cost
    const netOpportunity = potentialExtraction - attackerCost;
    el.outNetOpportunity.textContent = formatCurrency(netOpportunity);

    // Verdict: VIABLE if net opportunity > 0 and deviation > 0.5%, else NOT VIABLE
    const isViable = (netOpportunity > 0) && (dev >= 1.0);
    if (isViable) {
      el.verdictBadge.textContent = 'VIABLE EXPLOIT';
      el.verdictBadge.className = 'badge-verdict viable mono';
    } else {
      el.verdictBadge.textContent = 'NOT VIABLE';
      el.verdictBadge.className = 'badge-verdict not-viable mono';
    }
  }

  // ==========================================================
  // 3. EXPOSED PROTOCOL SURFACE (Feature 3)
  // ==========================================================
  async function fetchProtocols() {
    try {
      const res = await fetch('/api/protocols');
      const data = await res.json();

      if (res.ok && data.success) {
        state.protocols = data.protocols || [];
        el.totalTvlExposed.textContent = data.total_tvl_formatted || formatCurrency(data.total_tvl_exposed);
        renderProtocolTable();
      } else {
        el.protocolTableBody.innerHTML = `
          <tr><td colspan="6" class="loading-cell mono">${escapeHtml(data.error || 'Protocols data unavailable.')}</td></tr>
        `;
      }
    } catch (err) {
      el.protocolTableBody.innerHTML = `
        <tr><td colspan="6" class="loading-cell mono">Failed to load protocols: ${escapeHtml(err.message)}</td></tr>
      `;
    }
  }

  function renderProtocolTable() {
    if (!state.protocols.length) {
      el.protocolTableBody.innerHTML = `
        <tr><td colspan="6" class="loading-cell mono">No protocols found in data/protocols.json.</td></tr>
      `;
      return;
    }

    // Sort protocols
    const sorted = [...state.protocols].sort((a, b) => {
      let valA = a[state.protocolSortField];
      let valB = b[state.protocolSortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return state.protocolSortAsc ? -1 : 1;
      if (valA > valB) return state.protocolSortAsc ? 1 : -1;
      return 0;
    });

    let html = '';
    sorted.forEach((proto, index) => {
      const rowId = `proto-row-${index}`;
      const drawerId = `proto-drawer-${index}`;
      
      html += `
        <tr class="protocol-row" data-drawer="${drawerId}">
          <td class="mono" style="font-weight:600; color:#fff;">${escapeHtml(proto.protocol)}</td>
          <td class="mono">${formatCurrency(proto.tvl)}</td>
          <td class="mono">${escapeHtml(proto.category || 'DeFi')}</td>
          <td class="mono">${escapeHtml(proto.chain || 'Ethereum')}</td>
          <td class="mono" style="color:var(--text-muted); font-size:11px;">${escapeHtml(proto.oracle || 'Chainlink ETH/USD')}</td>
          <td class="mono" style="color:var(--accent-purple); font-size:11px;">[VIEW +]</td>
        </tr>
        <tr class="protocol-drawer" id="${drawerId}">
          <td colspan="6">
            <div class="drawer-grid mono">
              <div>
                <strong style="color:#fff;">Oracle Integration Details:</strong><br>
                ${escapeHtml(proto.details || 'Consumes Chainlink ETH/USD feed for protocol collateral evaluation.')}
              </div>
              <div>
                <strong style="color:#fff;">Impact Surface:</strong><br>
                TVL Exposed: ${formatCurrency(proto.tvl)} | Feed: ${escapeHtml(proto.oracle || 'ETH/USD')}<br>
                Liquidation vulnerability: Single-block price discrepancy can trigger cascading liquidations or bad debt.
              </div>
            </div>
          </td>
        </tr>
      `;
    });

    el.protocolTableBody.innerHTML = html;

    // Attach click listeners for expand/collapse
    document.querySelectorAll('.protocol-row').forEach(row => {
      row.addEventListener('click', () => {
        const drawerId = row.getAttribute('data-drawer');
        const drawer = document.getElementById(drawerId);
        if (drawer) {
          const isCurrentlyActive = drawer.classList.contains('active');
          document.querySelectorAll('.protocol-drawer').forEach(d => d.classList.remove('active'));
          if (!isCurrentlyActive) {
            drawer.classList.add('active');
          }
        }
      });
    });
  }

  // ==========================================================
  // 4. HISTORICAL INCIDENT REPLAY (Feature 4)
  // ==========================================================
  async function fetchHistoricalReplay(deviation) {
    el.replayCurrentDevTag.textContent = `COMPARING AGAINST CURRENT DEVIATION: ${deviation.toFixed(2)}%`;

    try {
      const res = await fetch(`/api/replay?deviation=${encodeURIComponent(deviation)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        state.historicalIncidents = data.incidents || [];
        renderReplayList(data.closest_match);
      } else {
        el.replayListContainer.innerHTML = `
          <div class="loading-cell mono">${escapeHtml(data.error || 'Historical incident data unavailable.')}</div>
        `;
      }
    } catch (err) {
      el.replayListContainer.innerHTML = `
        <div class="loading-cell mono">Failed to compute historical similarity: ${escapeHtml(err.message)}</div>
      `;
    }
  }

  function renderReplayList(closestMatch) {
    if (!state.historicalIncidents.length) {
      el.replayListContainer.innerHTML = `
        <div class="loading-cell mono">No historical incidents found in data/historical_incidents.json.</div>
      `;
      return;
    }

    let html = '';
    state.historicalIncidents.forEach((inc, idx) => {
      const isTop = (idx === 0);
      const topBadge = isTop ? `<span class="badge-verdict viable mono" style="font-size:10px; padding:2px 6px;">CLOSEST MATCH</span>` : '';

      html += `
        <div class="replay-card ${isTop ? 'closest-match' : ''}" data-index="${idx}">
          <div class="replay-summary-row mono">
            <div class="replay-name">${escapeHtml(inc.name)} ${topBadge}</div>
            <div class="replay-meta">Date: ${escapeHtml(inc.date)}</div>
            <div class="replay-meta">Dev: +${formatNumber(inc.historical_deviation, 1)}%</div>
            <div class="replay-meta">Loss: ${escapeHtml(inc.loss)}</div>
            <div class="similarity-bar-wrap">
              <div class="similarity-bar-bg">
                <div class="similarity-bar-fill" style="width: ${Math.min(100, inc.similarity_score)}%;"></div>
              </div>
              <span class="similarity-score-text">${inc.similarity_score.toFixed(1)}%</span>
            </div>
            <div style="font-size:11px; color:var(--accent-purple);">[DETAILS]</div>
          </div>
          <div class="replay-drawer mono">
            <div class="drawer-grid">
              <div>
                <strong style="color:#fff;">Incident Summary:</strong><br>
                ${escapeHtml(inc.outcome)}
              </div>
              <div>
                <strong style="color:#fff;">Attack Vector & Duration:</strong><br>
                Duration: ${escapeHtml(inc.duration)} | Loss: ${escapeHtml(inc.loss)}<br>
                ${escapeHtml(inc.description)}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    el.replayListContainer.innerHTML = html;

    // Attach click listeners for accordion expansion
    document.querySelectorAll('.replay-card').forEach(card => {
      card.addEventListener('click', () => {
        const isExpanded = card.classList.contains('expanded');
        document.querySelectorAll('.replay-card').forEach(c => c.classList.remove('expanded'));
        if (!isExpanded) {
          card.classList.add('expanded');
        }
      });
    });
  }

  // ==========================================================
  // Event Listeners & Initialization
  // ==========================================================
  function setupEventListeners() {
    // Mode Switching
    el.modeLiveBtn.addEventListener('click', () => {
      state.mode = 'live';
      el.modeLiveBtn.classList.add('active');
      el.modeHistBtn.classList.remove('active');
      el.historicalInputsGroup.classList.add('hidden');
      appendLog('INFO', 'Switched to LIVE on-chain monitoring mode.');
      runDetection();
    });

    el.modeHistBtn.addEventListener('click', () => {
      state.mode = 'historical';
      el.modeHistBtn.classList.add('active');
      el.modeLiveBtn.classList.remove('active');
      el.historicalInputsGroup.classList.remove('hidden');
      appendLog('INFO', 'Switched to HISTORICAL REPLAY mode. Enter manual oracle & market prices.');
    });

    // Run Detection Button
    el.triggerDetectBtn.addEventListener('click', () => {
      runDetection();
    });

    // Threshold Slider
    el.thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseFloat(e.target.value);
      el.thresholdDisplay.textContent = `${state.threshold.toFixed(1)}%`;
      
      // Update anomaly evaluation with current deviation without re-fetching
      if (state.currentDeviation > 0) {
        updateDetectUI({
          oracle_price: state.oraclePrice,
          market_price: state.marketPrice,
          deviation: state.currentDeviation,
          oracle_round_id: 'CURRENT',
          oracle_updated_at: 'LIVE',
          mode: state.mode
        });
      }
    });

    // Price Simulation Inputs (Real-time live recalculation)
    [el.inputCollateral, el.inputDebt, el.inputGasCost, el.inputFlashFee].forEach(input => {
      input.addEventListener('input', recalculatePriceRisk);
    });

    el.inputLiqThreshold.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      el.ltValDisplay.textContent = `${Math.round(val * 100)}%`;
      recalculatePriceRisk();
    });

    // Clear Logs Button
    el.clearLogsBtn.addEventListener('click', () => {
      el.terminalLogs.innerHTML = '';
      appendLog('INFO', 'Console log cleared.');
    });

    // Protocol Table Sorting
    document.querySelectorAll('.protocol-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (state.protocolSortField === field) {
          state.protocolSortAsc = !state.protocolSortAsc;
        } else {
          state.protocolSortField = field;
          state.protocolSortAsc = (field === 'protocol'); // Default asc for name, desc for TVL
        }
        renderProtocolTable();
      });
    });
  }

  // Initialize
  function init() {
    setupEventListeners();
    fetchProtocols();
    runDetection();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
