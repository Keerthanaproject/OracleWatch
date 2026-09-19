/**
 * OracleWatch — Security Incident Reconstruction Controller
 * Visual Specification: DETECT -> TRACE -> PRICE -> MAP -> ALERT
 * Modes: Live (15s polling), Stress Test (Simulated -6.8% incident), Replay (Delayed-feed model)
 */

(function () {
  'use strict';

  // Application State
  const state = {
    mode: 'live', // 'live' | 'stress' | 'replay'
    threshold: 2.0,
    isPaused: false,
    speedMultiplier: 1.0,
    pollIntervalMs: 15000,
    pollTimer: null,
    replayTimer: null,
    
    // Live Ingestion Cache
    oraclePrice: null,
    marketPrice: null,
    deviation: 0,
    isAnomaly: false,
    roundId: '129127208515966895126',
    feedAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    lastUpdateIso: null,

    // Chart Points (Rolling trajectory)
    chartPoints: [],

    // Replay State
    replayIncidentDate: 1665446400,
    replayPoints: [],
    replayIndex: 0,
    isReplayRunning: false
  };

  // DOM Elements
  const dom = {
    // Header & Navigation
    systemStatusDot: document.getElementById('systemStatusDot'),
    systemStatusText: document.getElementById('systemStatusText'),
    feedTitleDisplay: document.getElementById('feedTitleDisplay'),
    btnModeLive: document.getElementById('btnModeLive'),
    btnModeStress: document.getElementById('btnModeStress'),
    btnModeReplay: document.getElementById('btnModeReplay'),
    simulatedBadge: document.getElementById('simulatedBadge'),
    btnRefresh: document.getElementById('btnRefresh'),
    
    // Metadata Bar
    techMetadataBar: document.getElementById('techMetadataBar'),
    metaFeedAddress: document.getElementById('metaFeedAddress'),
    metaRoundId: document.getElementById('metaRoundId'),
    metaLastUpdate: document.getElementById('metaLastUpdate'),

    // Replay Toolbar
    replayToolbar: document.getElementById('replayToolbar'),
    replayIncidentSelect: document.getElementById('replayIncidentSelect'),
    btnReplayPlay: document.getElementById('btnReplayPlay'),
    btnReplayPause: document.getElementById('btnReplayPause'),
    btnReplayReset: document.getElementById('btnReplayReset'),

    // Detect (Screen 1)
    chartViewport: document.getElementById('chartViewport'),
    mainChartSvg: document.getElementById('mainChartSvg'),
    chartGridGroup: document.getElementById('chartGridGroup'),
    chartAlertZoneGroup: document.getElementById('chartAlertZoneGroup'),
    chartThresholdLine: document.getElementById('chartThresholdLine'),
    chartMarketPath: document.getElementById('chartMarketPath'),
    chartOraclePath: document.getElementById('chartOraclePath'),
    chartAlertMarkerGroup: document.getElementById('chartAlertMarkerGroup'),
    alertMarkerLine: document.getElementById('alertMarkerLine'),
    alertMarkerAnnotation: document.getElementById('alertMarkerAnnotation'),
    chartCrosshairGroup: document.getElementById('chartCrosshairGroup'),
    crosshairLineX: document.getElementById('crosshairLineX'),
    crosshairLineY: document.getElementById('crosshairLineY'),
    crosshairDotMarket: document.getElementById('crosshairDotMarket'),
    crosshairDotOracle: document.getElementById('crosshairDotOracle'),
    chartTimeAxisGroup: document.getElementById('chartTimeAxisGroup'),
    chartTooltip: document.getElementById('chartTooltip'),
    ttTime: document.getElementById('ttTime'),
    ttOracle: document.getElementById('ttOracle'),
    ttMarket: document.getElementById('ttMarket'),
    ttDev: document.getElementById('ttDev'),
    legendMarketDot: document.getElementById('legendMarketDot'),
    legendThresholdVal: document.getElementById('legendThresholdVal'),

    valOraclePrice: document.getElementById('valOraclePrice'),
    valMarketPrice: document.getElementById('valMarketPrice'),
    valDeviation: document.getElementById('valDeviation'),
    valOracleSub: document.getElementById('valOracleSub'),
    valMarketSub: document.getElementById('valMarketSub'),
    valDeviationSub: document.getElementById('valDeviationSub'),

    detectStatusBanner: document.getElementById('detectStatusBanner'),
    statusBannerText: document.getElementById('statusBannerText'),
    thresholdInput: document.getElementById('thresholdInput'),
    valThresholdDisplay: document.getElementById('valThresholdDisplay'),

    // Trace (Screen 2)
    traceEventList: document.getElementById('traceEventList'),

    // Price (Screen 3)
    valMarketMoveCost: document.getElementById('valMarketMoveCost'),
    valExtractableBound: document.getElementById('valExtractableBound'),
    valLiquidityCeiling: document.getElementById('valLiquidityCeiling'),
    valNetOpportunity: document.getElementById('valNetOpportunity'),
    barMoveCost: document.getElementById('barMoveCost'),
    barExtractable: document.getElementById('barExtractable'),
    barCeiling: document.getElementById('barCeiling'),
    barNet: document.getElementById('barNet'),
    btnFormulaToggle: document.getElementById('btnFormulaToggle'),
    formulaDrawer: document.getElementById('formulaDrawer'),
    inputPoolTvl: document.getElementById('inputPoolTvl'),
    inputBorrowable: document.getElementById('inputBorrowable'),
    inputCollateral: document.getElementById('inputCollateral'),
    btnRecalcRisk: document.getElementById('btnRecalcRisk'),

    // Map (Screen 4)
    secMap: document.getElementById('sec-map'),
    countMarketsHit: document.getElementById('countMarketsHit'),
    countVaultsHit: document.getElementById('countVaultsHit'),
    countExposure: document.getElementById('countExposure'),

    // Alert (Screen 5)
    alertWhatBody: document.getElementById('alertWhatBody'),
    alertWhyBody: document.getElementById('alertWhyBody'),
    alertImpactBody: document.getElementById('alertImpactBody'),
    evFeed: document.getElementById('evFeed'),
    evOraclePrice: document.getElementById('evOraclePrice'),
    evMarketSource: document.getElementById('evMarketSource'),
    evMarketPrice: document.getElementById('evMarketPrice'),
    evThreshold: document.getElementById('evThreshold'),
    evState: document.getElementById('evState'),

    // Bottom Navigation Bar
    btnTogglePause: document.getElementById('btnTogglePause'),
    iconPause: document.getElementById('iconPause'),
    textPause: document.getElementById('textPause'),
    btnRestart: document.getElementById('btnRestart'),
    btnSpeedToggle: document.getElementById('btnSpeedToggle'),
    textSpeed: document.getElementById('textSpeed'),
    btnCleanView: document.getElementById('btnCleanView'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    navJumpBtns: document.querySelectorAll('.nav-jump-btn')
  };

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    setupEventListeners();
    setupScrollSpy();
    fetchLiveData();
    startPolling();
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    // Mode Switcher
    dom.btnModeLive.addEventListener('click', () => switchMode('live'));
    dom.btnModeStress.addEventListener('click', () => switchMode('stress'));
    dom.btnModeReplay.addEventListener('click', () => switchMode('replay'));

    // Manual Refresh
    dom.btnRefresh.addEventListener('click', () => {
      if (state.mode === 'live') fetchLiveData();
      else if (state.mode === 'stress') triggerStressTest();
    });

    // Threshold Slider
    dom.thresholdInput.addEventListener('input', (e) => {
      state.threshold = parseFloat(e.target.value);
      dom.valThresholdDisplay.textContent = state.threshold.toFixed(1) + '%';
      dom.legendThresholdVal.textContent = state.threshold.toFixed(1) + '%';
      evaluateDeviationState();
      renderChart();
    });

    // Formula Toggle
    dom.btnFormulaToggle.addEventListener('click', () => {
      dom.formulaDrawer.classList.toggle('hidden');
      dom.btnFormulaToggle.textContent = dom.formulaDrawer.classList.contains('hidden') 
        ? 'Show Formula ▾' 
        : 'Hide Formula ▴';
    });

    // Recalculate Risk
    dom.btnRecalcRisk.addEventListener('click', fetchPriceRiskCalculation);

    // Replay Controls
    dom.replayIncidentSelect.addEventListener('change', (e) => {
      state.replayIncidentDate = parseInt(e.target.value);
      fetchReplayData();
    });
    dom.btnReplayPlay.addEventListener('click', startReplay);
    dom.btnReplayPause.addEventListener('click', pauseReplay);
    dom.btnReplayReset.addEventListener('click', resetReplay);

    // Bottom Bar Controls
    dom.btnTogglePause.addEventListener('click', togglePause);
    dom.btnRestart.addEventListener('click', restartCurrentMode);
    dom.btnSpeedToggle.addEventListener('click', toggleSpeed);
    dom.btnCleanView.addEventListener('click', () => document.body.classList.toggle('clean-view'));
    dom.btnThemeToggle.addEventListener('click', toggleTheme);

    // Chart Crosshair Interactions
    dom.chartViewport.addEventListener('mousemove', onChartMouseMove);
    dom.chartViewport.addEventListener('mouseleave', onChartMouseLeave);
  }

  // =========================================================================
  // MODE MANAGEMENT
  // =========================================================================
  function switchMode(newMode) {
    state.mode = newMode;
    dom.btnModeLive.classList.toggle('active', newMode === 'live');
    dom.btnModeStress.classList.toggle('active', newMode === 'stress');
    dom.btnModeReplay.classList.toggle('active', newMode === 'replay');

    // Simulated badge
    dom.simulatedBadge.classList.toggle('hidden', newMode === 'live');
    dom.replayToolbar.classList.toggle('hidden', newMode !== 'replay');

    if (newMode === 'live') {
      stopReplay();
      fetchLiveData();
      startPolling();
    } else if (newMode === 'stress') {
      stopPolling();
      stopReplay();
      triggerStressTest();
    } else if (newMode === 'replay') {
      stopPolling();
      fetchReplayData();
    }
  }

  function togglePause() {
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
      dom.iconPause.textContent = '▶';
      dom.textPause.textContent = 'Resume';
      if (state.isReplayRunning) pauseReplay();
    } else {
      dom.iconPause.textContent = '⏸';
      dom.textPause.textContent = 'Pause';
      if (state.mode === 'replay') startReplay();
    }
  }

  function restartCurrentMode() {
    if (state.mode === 'live') {
      state.chartPoints = [];
      fetchLiveData();
    } else if (state.mode === 'stress') {
      triggerStressTest();
    } else if (state.mode === 'replay') {
      resetReplay();
      startReplay();
    }
  }

  function toggleSpeed() {
    state.speedMultiplier = state.speedMultiplier === 1.0 ? 2.0 : 1.0;
    dom.textSpeed.textContent = state.speedMultiplier.toFixed(0) + 'x';
    if (state.isReplayRunning) {
      pauseReplay();
      startReplay();
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('theme-charcoal');
  }

  // =========================================================================
  // DATA INGESTION — LIVE MODE
  // =========================================================================
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (!state.isPaused && state.mode === 'live') {
        fetchLiveData();
      }
    }, state.pollIntervalMs);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function fetchLiveData() {
    try {
      const res = await fetch(`/api/detect?mode=live&threshold=${state.threshold}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.status === 'ok') {
        state.oraclePrice = data.oracle.price;
        state.marketPrice = data.market.price;
        state.roundId = data.oracle.round_id || state.roundId;
        state.feedAddress = data.oracle.feed || state.feedAddress;
        state.lastUpdateIso = data.oracle.updated_at_utc || new Date().toISOString();

        // Update rolling history from backend
        if (data.history && data.history.length > 0) {
          state.chartPoints = data.history.map(pt => ({
            timeLabel: pt.time_label || 'now',
            oraclePrice: pt.oracle_price,
            marketPrice: pt.market_price,
            deviation: pt.deviation || 0
          }));
        } else {
          appendChartPoint('now', state.oraclePrice, state.marketPrice);
        }

        evaluateDeviationState();
        updateTraceWithLogs(data.logs || []);
        fetchPriceRiskCalculation();
        fetchDependenciesMap();
      } else {
        showDataSourceUnavailable();
      }
    } catch (err) {
      console.warn('Live poll error:', err);
      showDataSourceUnavailable(err.message);
    }
  }

  function showDataSourceUnavailable(reason) {
    dom.systemStatusDot.className = 'status-dot';
    dom.systemStatusText.textContent = 'Degraded';
    dom.statusBannerText.textContent = reason ? `Data source unavailable (${reason})` : 'Reference price unavailable';
    dom.statusBannerText.style.color = '#e2e8f0';
  }

  // =========================================================================
  // STRESS TEST SCENARIO (-6.8% Market Drop)
  // =========================================================================
  async function triggerStressTest() {
    dom.systemStatusDot.className = 'status-dot alert';
    dom.systemStatusText.textContent = 'Alert';

    // 1. Fetch stress test detection data from backend
    try {
      const res = await fetch(`/api/detect?mode=stress&threshold=${state.threshold}`);
      const data = await res.json();
      
      const oracleP = data.oracle.price || 2650.25;
      const marketP = data.market.price || (oracleP * (1 - 0.068));
      
      state.oraclePrice = oracleP;
      state.marketPrice = marketP;
      state.roundId = data.oracle.round_id || '129127208515966895126';

      // 2. Synthesize clear dramatic trajectory for the reference video scenario
      // Normalized: Oracle = 1.0000; Market: 1.00 -> 1.00 -> 0.98 -> 0.95 -> 0.9314
      const syntheticPoints = [
        { timeLabel: '00:00', oraclePrice: oracleP, marketPrice: oracleP * 1.001, deviation: 0.10 },
        { timeLabel: '00:05', oraclePrice: oracleP, marketPrice: oracleP * 0.998, deviation: 0.20 },
        { timeLabel: '00:10', oraclePrice: oracleP, marketPrice: oracleP * 0.985, deviation: 1.50 },
        { timeLabel: '00:15', oraclePrice: oracleP, marketPrice: oracleP * 0.965, deviation: 3.50, isBreachPoint: true },
        { timeLabel: '00:20', oraclePrice: oracleP, marketPrice: oracleP * 0.940, deviation: 6.00 },
        { timeLabel: '00:25', oraclePrice: oracleP, marketPrice: marketP, deviation: 6.86 }
      ];

      state.chartPoints = syntheticPoints;

      // 3. Populate Activity Trace exactly matching specification
      renderStressTraceSequence();

      // 4. Update metrics & alert state
      evaluateDeviationState(true);

      // 5. Update Price Section with reference values
      renderPriceBars(96000, 1900000, 2400000, 1800000);

      // 6. Highlight Map Blast Radius
      highlightMapAffected(true);

      renderChart();
    } catch (err) {
      console.error('Stress test trigger error:', err);
    }
  }

  function renderStressTraceSequence() {
    const events = [
      { time: '00:33', desc: 'Tracing dependents of the feed', status: 'ALERT', statusClass: 'status-alert' },
      { time: '00:20', desc: 'Pricing the exploit for RWAUSD/USDC', status: 'ACTIVE', statusClass: 'status-warn' },
      { time: '00:15', desc: '6.8% confirmed on 3 independent sources', status: 'CONFIRMED', statusClass: 'status-alert' },
      { time: '00:06', desc: 'Deviation 2.0% crossed the threshold', status: 'BREACH', statusClass: 'status-alert' },
      { time: '00:00', desc: 'Watching 4 feeds across 12 markets', status: 'INITIALIZED', statusClass: 'status-ok' }
    ];

    dom.traceEventList.innerHTML = events.map(e => `
      <div class="trace-row">
        <span class="trace-time mono">${e.time}</span>
        <span class="trace-marker ${e.statusClass}"></span>
        <span class="trace-desc">${e.desc}</span>
        <span class="trace-status mono text-dim">${e.status}</span>
      </div>
    `).join('');
  }

  function updateTraceWithLogs(logs) {
    if (!logs || logs.length === 0) return;
    const items = logs.slice(-5).reverse();
    dom.traceEventList.innerHTML = items.map((l, idx) => {
      const timeStr = l.timestamp || `00:${idx * 3}`;
      const statusClass = l.level === 'ERROR' || l.level === 'WARN' ? 'status-alert' : 'status-ok';
      return `
        <div class="trace-row">
          <span class="trace-time mono">${timeStr}</span>
          <span class="trace-marker ${statusClass}"></span>
          <span class="trace-desc">${l.message}</span>
          <span class="trace-status mono text-dim">${l.level || 'INFO'}</span>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // DEVIATION EVALUATION & METRIC READOUTS
  // =========================================================================
  function evaluateDeviationState(forceAlert) {
    if (state.oraclePrice === null || state.marketPrice === null) return;

    const absDelta = Math.abs(state.oraclePrice - state.marketPrice);
    const devPct = (absDelta / state.marketPrice) * 100.0;
    state.deviation = devPct;

    const isBreached = forceAlert || (devPct >= state.threshold);
    state.isAnomaly = isBreached;

    // 3 Large Metric Blocks
    dom.valOraclePrice.textContent = `$${state.oraclePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    dom.valMarketPrice.textContent = `$${state.marketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    dom.valDeviation.textContent = `${devPct.toFixed(2)}%`;

    // Normalised labels in subtitle if in stress mode
    if (state.mode === 'stress') {
      dom.valOracleSub.textContent = 'Normalized: 1.0000';
      dom.valMarketSub.textContent = 'Normalized: 0.9314';
      dom.valDeviationSub.textContent = 'Threshold: 2.00%';
    } else {
      dom.valOracleSub.textContent = 'Chainlink ETH/USD';
      dom.valMarketSub.textContent = 'DefiLlama Spot Aggregate';
      dom.valDeviationSub.textContent = `Threshold: ${state.threshold.toFixed(1)}%`;
    }

    // Colors & Status Banner
    const metricDevCard = document.querySelector('.metric-deviation');
    if (isBreached) {
      dom.systemStatusDot.className = 'status-dot alert';
      dom.systemStatusText.textContent = 'Alert';
      dom.detectStatusBanner.className = 'detect-status-banner mono alert';
      
      const dir = state.oraclePrice >= state.marketPrice ? 'above' : 'below';
      dom.statusBannerText.textContent = `Alert: Oracle price is ${devPct.toFixed(2)}% ${dir} reference market`;
      
      metricDevCard.classList.add('alert');
      dom.legendMarketDot.classList.add('alert');

      // Update Alert Quadrants
      dom.alertWhatBody.textContent = `The on-chain oracle diverges significantly from the independent reference market by ${devPct.toFixed(2)}% (Delta: $${absDelta.toFixed(2)} USD).`;
      dom.alertWhyBody.textContent = `Calculated deviation (${devPct.toFixed(2)}%) crossed the configured monitoring threshold (${state.threshold.toFixed(2)}%).`;
      
      if (state.oraclePrice > state.marketPrice) {
        dom.alertImpactBody.textContent = 'CRITICAL: Oracle overvalues collateral. Borrowers can borrow exceeding real liquidation bounds, threatening protocol bad debt.';
      } else {
        dom.alertImpactBody.textContent = 'CRITICAL: Oracle severely undervalues collateral. Solvent positions risk premature, unjustified liquidations across lending pools.';
      }

      dom.evState.textContent = 'ALERT';
      dom.evState.className = 'text-alert';
      highlightMapAffected(true);
    } else {
      dom.systemStatusDot.className = 'status-dot';
      dom.systemStatusText.textContent = 'Monitoring';
      dom.detectStatusBanner.className = 'detect-status-banner mono';
      dom.statusBannerText.textContent = `No deviation above ${state.threshold.toFixed(1)}%`;
      
      metricDevCard.classList.remove('alert');
      dom.legendMarketDot.classList.remove('alert');

      dom.alertWhatBody.textContent = 'Oracle price is aligned with the independent reference market. No significant divergence detected.';
      dom.alertWhyBody.textContent = `Calculated deviation (${devPct.toFixed(2)}%) is currently within the configured monitoring threshold (${state.threshold.toFixed(1)}%).`;
      dom.alertImpactBody.textContent = 'Solvent state. Consumer lending protocols (Aave, MakerDAO, Compound) calculate valid collateral values and health factors.';

      dom.evState.textContent = 'NORMAL';
      dom.evState.className = 'text-ok';
      highlightMapAffected(false);
    }

    // Metadata updates
    dom.metaFeedAddress.textContent = `${state.feedAddress.slice(0, 8)}...${state.feedAddress.slice(-4)}`;
    dom.metaRoundId.textContent = state.roundId;
    dom.metaLastUpdate.textContent = state.lastUpdateIso ? new Date(state.lastUpdateIso).toLocaleTimeString() : 'just now';

    // Evidence Box
    dom.evFeed.textContent = `Chainlink (${state.feedAddress.slice(0, 8)}...)`;
    dom.evOraclePrice.textContent = `$${state.oraclePrice.toFixed(2)}`;
    dom.evMarketPrice.textContent = `$${state.marketPrice.toFixed(2)}`;
    dom.evThreshold.textContent = `${state.threshold.toFixed(1)}%`;
  }

  // =========================================================================
  // PRICE SECTION: PROPORTIONAL HORIZONTAL BARS
  // =========================================================================
  async function fetchPriceRiskCalculation() {
    if (state.mode === 'stress') return; // Stress test uses fixed reference values

    try {
      const payload = {
        deviation: state.deviation,
        pool_tvl: parseFloat(dom.inputPoolTvl.value) || 900000000,
        borrowable_liquidity: parseFloat(dom.inputBorrowable.value) || 120000000,
        collateral_supplied: parseFloat(dom.inputCollateral.value) || 250000000
      };

      const res = await fetch('/api/price-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const r = data.results;
        const maxVal = Math.max(r.extractable_upper_bound, r.market_movement_cost, 1);
        
        renderPriceBars(
          r.market_movement_cost,
          r.extractable_upper_bound,
          payload.borrowable_liquidity,
          r.net_opportunity
        );
      }
    } catch (err) {
      console.warn('Price calculation error:', err);
    }
  }

  function renderPriceBars(moveCost, extractable, ceiling, netOpportunity) {
    const maxVal = Math.max(ceiling, extractable, moveCost, 1);

    dom.valMarketMoveCost.textContent = formatCurrency(moveCost);
    dom.valExtractableBound.textContent = formatCurrency(extractable);
    dom.valLiquidityCeiling.textContent = formatCurrency(ceiling);

    const pctMove = Math.min(100, (moveCost / maxVal) * 100);
    const pctExtract = Math.min(100, (extractable / maxVal) * 100);
    const pctCeiling = Math.min(100, (ceiling / maxVal) * 100);
    const pctNet = Math.min(100, (Math.max(0, netOpportunity) / maxVal) * 100);

    dom.barMoveCost.style.width = `${Math.max(3, pctMove)}%`;
    dom.barExtractable.style.width = `${Math.max(5, pctExtract)}%`;
    dom.barCeiling.style.width = `${Math.max(10, pctCeiling)}%`;
    dom.barNet.style.width = `${Math.max(2, pctNet)}%`;

    if (netOpportunity > 0 && state.isAnomaly) {
      dom.valNetOpportunity.textContent = `+${formatCurrency(netOpportunity)}`;
      dom.valNetOpportunity.className = 'price-bar-val-primary mono';
      dom.barNet.className = 'price-bar-fill fill-net';
    } else {
      dom.valNetOpportunity.textContent = '$0.00 (Not Viable)';
      dom.valNetOpportunity.className = 'price-bar-val-primary mono safe';
      dom.barNet.className = 'price-bar-fill fill-net safe';
    }
  }

  function formatCurrency(val) {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(2)}`;
  }

  // =========================================================================
  // MAP SECTION: DEPENDENCY GRAPH & BLAST RADIUS
  // =========================================================================
  async function fetchDependenciesMap() {
    try {
      const res = await fetch('/api/dependencies');
      if (res.ok) {
        const data = await res.json();
        dom.countMarketsHit.textContent = data.total_markets_hit || '3';
        dom.countVaultsHit.textContent = data.total_vaults_hit || '2';
        dom.countExposure.textContent = data.total_dollars_formatted || '$4.1M';
      }
    } catch (err) {
      console.warn('Map dependency fetch error:', err);
    }
  }

  function highlightMapAffected(isAlert) {
    const mapPanel = document.querySelector('.map-panel');
    if (isAlert) {
      mapPanel.classList.add('alert');
    } else {
      mapPanel.classList.remove('alert');
    }
  }

  // =========================================================================
  // REPLAY ENGINE (Historical Incidents / Delayed-feed Model)
  // =========================================================================
  async function fetchReplayData() {
    try {
      const res = await fetch(`/api/replay?date=${state.replayIncidentDate}&heartbeat=3600`);
      if (res.ok) {
        const data = await res.json();
        state.replayPoints = data.replay_points || [];
        state.replayIndex = 0;
        dom.btnReplayPlay.disabled = false;
        dom.btnReplayPause.disabled = true;

        if (state.replayPoints.length > 0) {
          applyReplayStep(0);
        }
      }
    } catch (err) {
      console.warn('Replay data fetch error:', err);
    }
  }

  function startReplay() {
    if (state.replayPoints.length === 0) return;
    state.isReplayRunning = true;
    dom.btnReplayPlay.disabled = true;
    dom.btnReplayPause.disabled = false;

    const intervalMs = Math.max(300, 1500 / state.speedMultiplier);
    stopReplayTimer();
    state.replayTimer = setInterval(() => {
      if (state.isPaused) return;

      state.replayIndex++;
      if (state.replayIndex >= state.replayPoints.length) {
        state.replayIndex = 0; // loop
      }
      applyReplayStep(state.replayIndex);
    }, intervalMs);
  }

  function pauseReplay() {
    state.isReplayRunning = false;
    dom.btnReplayPlay.disabled = false;
    dom.btnReplayPause.disabled = true;
    stopReplayTimer();
  }

  function resetReplay() {
    pauseReplay();
    state.replayIndex = 0;
    if (state.replayPoints.length > 0) {
      applyReplayStep(0);
    }
  }

  function stopReplay() {
    pauseReplay();
    state.replayPoints = [];
  }

  function stopReplayTimer() {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
  }

  function applyReplayStep(idx) {
    const pt = state.replayPoints[idx];
    if (!pt) return;

    state.oraclePrice = pt.oracle_price;
    state.marketPrice = pt.market_price;
    
    // Maintain rolling buffer of replay points for chart
    state.chartPoints = state.replayPoints.slice(0, idx + 1).map(p => ({
      timeLabel: p.time_label || 'now',
      oraclePrice: p.oracle_price,
      marketPrice: p.market_price,
      deviation: p.deviation || 0,
      isBreachPoint: (p.deviation >= state.threshold)
    }));

    evaluateDeviationState();
    renderChart();
  }

  // =========================================================================
  // SVG CHART RENDERING (Native, Responsive, High Performance)
  // =========================================================================
  function appendChartPoint(timeLabel, oraclePrice, marketPrice) {
    const dev = Math.abs(oraclePrice - marketPrice) / marketPrice * 100;
    state.chartPoints.push({
      timeLabel: timeLabel,
      oraclePrice: oraclePrice,
      marketPrice: marketPrice,
      deviation: dev
    });
    if (state.chartPoints.length > 30) {
      state.chartPoints.shift();
    }
    renderChart();
  }

  function renderChart() {
    const pts = state.chartPoints;
    if (!pts || pts.length < 2) return;

    const svgW = 1000;
    const svgH = 360;
    const padL = 65;
    const padR = 30;
    const padT = 35;
    const padB = 40;

    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    // 1. Min / Max Price Bounds
    let minP = Infinity;
    let maxP = -Infinity;
    pts.forEach(p => {
      minP = Math.min(minP, p.oraclePrice, p.marketPrice);
      maxP = Math.max(maxP, p.oraclePrice, p.marketPrice);
    });

    const padRange = Math.max((maxP - minP) * 0.12, minP * 0.01 || 10);
    minP = Math.max(0, minP - padRange);
    maxP = maxP + padRange;
    const rangeP = maxP - minP;

    // Helper functions for coordinates
    const getX = (idx) => padL + (idx / (pts.length - 1)) * plotW;
    const getY = (val) => padT + plotH - ((val - minP) / rangeP) * plotH;

    // 2. Render Horizontal Grid Lines & Y-Axis Labels
    const gridLines = 5;
    let gridHtml = '';
    for (let i = 0; i <= gridLines; i++) {
      const priceVal = minP + (i / gridLines) * rangeP;
      const yPos = getY(priceVal);
      gridHtml += `
        <line x1="${padL}" y1="${yPos}" x2="${svgW - padR}" y2="${yPos}"/>
        <text x="${padL - 10}" y="${yPos + 3}" text-anchor="end">$${priceVal.toFixed(0)}</text>
      `;
    }
    dom.chartGridGroup.innerHTML = gridHtml;

    // 3. Render X-Axis Time Labels
    let timeHtml = '';
    const stepX = Math.max(1, Math.floor(pts.length / 6));
    pts.forEach((p, idx) => {
      if (idx % stepX === 0 || idx === pts.length - 1) {
        const xPos = getX(idx);
        timeHtml += `<text x="${xPos}" y="${svgH - 12}" text-anchor="middle">${p.timeLabel}</text>`;
      }
    });
    dom.chartTimeAxisGroup.innerHTML = timeHtml;

    // 4. Build SVG Path Strings
    let oracleD = '';
    let marketD = '';
    let breachIndex = -1;

    pts.forEach((p, idx) => {
      const x = getX(idx);
      const yOra = getY(p.oraclePrice);
      const yMkt = getY(p.marketPrice);

      if (idx === 0) {
        oracleD += `M ${x} ${yOra}`;
        marketD += `M ${x} ${yMkt}`;
      } else {
        // Oracle line uses horizontal step line or smooth linear
        oracleD += ` L ${x} ${yOra}`;
        marketD += ` L ${x} ${yMkt}`;
      }

      // Check where deviation breaches threshold for the alert marker
      if (breachIndex === -1 && p.deviation >= state.threshold) {
        breachIndex = idx;
      }
    });

    dom.chartOraclePath.setAttribute('d', oracleD);
    dom.chartMarketPath.setAttribute('d', marketD);

    // 5. Threshold Dashed Line (derived from current threshold boundary)
    const thresholdPrice = state.oraclePrice ? state.oraclePrice * (1.0 - state.threshold / 100.0) : minP;
    const threshY = getY(thresholdPrice);
    dom.chartThresholdLine.setAttribute('y1', threshY);
    dom.chartThresholdLine.setAttribute('y2', threshY);

    // 6. Alert Marker & Annotation (│ Alert │ ▼)
    if (state.isAnomaly && breachIndex !== -1) {
      const alertX = getX(breachIndex);
      dom.chartAlertMarkerGroup.classList.remove('hidden');
      dom.alertMarkerLine.setAttribute('x1', alertX);
      dom.alertMarkerLine.setAttribute('x2', alertX);
      dom.alertMarkerAnnotation.setAttribute('transform', `translate(${alertX}, ${padT + 20})`);
      dom.chartMarketPath.classList.add('breached');
    } else {
      dom.chartAlertMarkerGroup.classList.add('hidden');
      dom.chartMarketPath.classList.remove('breached');
    }
  }

  // =========================================================================
  // CHART TOOLTIP & CROSSHAIR
  // =========================================================================
  function onChartMouseMove(e) {
    const pts = state.chartPoints;
    if (!pts || pts.length < 2) return;

    const rect = dom.chartViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgW = 1000;
    const padL = 65;
    const padR = 30;
    const plotW = svgW - padL - padR;

    const relX = (mouseX / rect.width) * svgW;
    if (relX < padL || relX > svgW - padR) {
      onChartMouseLeave();
      return;
    }

    const normX = (relX - padL) / plotW;
    const idx = Math.min(pts.length - 1, Math.max(0, Math.round(normX * (pts.length - 1))));
    const pt = pts[idx];

    // Compute Y bounds
    let minP = Infinity, maxP = -Infinity;
    pts.forEach(p => {
      minP = Math.min(minP, p.oraclePrice, p.marketPrice);
      maxP = Math.max(maxP, p.oraclePrice, p.marketPrice);
    });
    const padRange = Math.max((maxP - minP) * 0.12, minP * 0.01 || 10);
    minP = Math.max(0, minP - padRange);
    maxP = maxP + padRange;
    const rangeP = maxP - minP;

    const getX = (i) => padL + (i / (pts.length - 1)) * plotW;
    const getY = (val) => 35 + (360 - 35 - 40) - ((val - minP) / rangeP) * (360 - 35 - 40);

    const crossX = getX(idx);
    const yOra = getY(pt.oraclePrice);
    const yMkt = getY(pt.marketPrice);

    dom.chartCrosshairGroup.classList.remove('hidden');
    dom.crosshairLineX.setAttribute('x1', crossX);
    dom.crosshairLineX.setAttribute('x2', crossX);
    dom.crosshairLineY.setAttribute('y1', yMkt);
    dom.crosshairLineY.setAttribute('y2', yMkt);

    dom.crosshairDotMarket.setAttribute('cx', crossX);
    dom.crosshairDotMarket.setAttribute('cy', yMkt);
    dom.crosshairDotOracle.setAttribute('cx', crossX);
    dom.crosshairDotOracle.setAttribute('cy', yOra);

    // Position Tooltip
    dom.chartTooltip.classList.remove('hidden');
    dom.ttTime.textContent = pt.timeLabel;
    dom.ttOracle.textContent = `$${pt.oraclePrice.toFixed(2)}`;
    dom.ttMarket.textContent = `$${pt.marketPrice.toFixed(2)}`;
    dom.ttDev.textContent = `${pt.deviation.toFixed(2)}%`;
    dom.ttDev.className = pt.deviation >= state.threshold ? 'tt-val tt-dev alert' : 'tt-val tt-dev';

    const ttLeft = (crossX / svgW) * rect.width;
    dom.chartTooltip.style.left = `${Math.min(rect.width - 150, Math.max(10, ttLeft - 70))}px`;
    dom.chartTooltip.style.top = '16px';
  }

  function onChartMouseLeave() {
    dom.chartCrosshairGroup.classList.add('hidden');
    dom.chartTooltip.classList.add('hidden');
  }

  // =========================================================================
  // SCROLL SPY FOR PERSISTENT BOTTOM BAR
  // =========================================================================
  function setupScrollSpy() {
    const sections = [
      { id: 'sec-monitor', navTarget: 'sec-monitor' },
      { id: 'sec-detect', navTarget: 'sec-detect' },
      { id: 'sec-trace', navTarget: 'sec-trace' },
      { id: 'sec-price', navTarget: 'sec-price' },
      { id: 'sec-map', navTarget: 'sec-map' },
      { id: 'sec-alert', navTarget: 'sec-alert' }
    ];

    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 160;
      let currentSection = 'sec-detect';

      sections.forEach(sec => {
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= scrollPos) {
          currentSection = sec.navTarget;
        }
      });

      dom.navJumpBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === currentSection);
      });
    });
  }

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
