/**
 * OracleWatch — Security Incident Reconstruction Controller
 * Replicates the reference demo interactions, visual hierarchy, and animations,
 * while seamlessly binding to the existing real backend (Chainlink, DefiLlama, Price-Risk, Dependencies).
 */

(function () {
  'use strict';

  /* ---------- DOM Helpers ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var ease = function (p) { return 1 - Math.pow(1 - p, 3); };
  var rnd = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  var mmss = function (s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; };
  var money = function (v) {
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
    return '$' + Math.round(v);
  };

  /* ---------- Mode State ---------- */
  var currentMode = 'stress'; // 'live' | 'stress' | 'replay' (Default to reference demo for immediate fidelity)
  var livePollTimer = null;
  var liveData = {
    oraclePrice: 2650.25,
    marketPrice: 2647.37,
    deviation: 0.11,
    roundId: '129127208515966895126',
    feed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    history: []
  };

  /* ---------- Controlled Demo Scenario Definition (Exact Reference) ---------- */
  var TOTAL = 50;           // scenario length in seconds
  var STEP = 0.5;           // chart sample spacing
  var N = Math.round(TOTAL / STEP);
  var ALERT_T = 10;

  var STAGES = [
    { name: 'Monitor', t: 0,  text: 'OracleWatch checks the RWAUSD/USD feed, the delayed OSM price and DEX spot every block. All three agree, so there is nothing to act on.' },
    { name: 'Detect',  t: 10, text: 'DEX spot pulls away from the delayed OSM price. The deviation crosses the 2% threshold and is confirmed on 3 independent sources.' },
    { name: 'Price',   t: 20, text: 'OracleWatch prices the exploit: what it costs to move the market versus what an attacker can extract from the lending market.' },
    { name: 'Map',     t: 33, text: 'The manipulated feed is traced to every market and vault that reads it. Anything downstream is at risk; unaffected markets stay dark.' },
    { name: 'Alert',   t: 43, text: 'One explainable alert combines the deviation, exploit value, exposure and history into a single CRITICAL warning with actions.' }
  ];

  var EVENTS = [
    { t: 0,  k: 'p', text: 'Watching 4 feeds across 12 markets' },
    { t: 10, k: 'r', text: 'Deviation 2.0% crossed the threshold' },
    { t: 15, k: 'r', text: '6.8% confirmed on 3 independent sources' },
    { t: 20, k: 'p', text: 'Pricing the exploit for RWAUSD/USDC' },
    { t: 33, k: 'p', text: 'Tracing dependents of the feed' },
    { t: 43, k: 'r', text: 'CRITICAL alert raised: pause RWAUSD/USDC borrowing' }
  ];

  /* Deviation Control Points */
  var CP = [[0, 0], [7, 0], [10, 2.0], [12, 4.5], [15, 6.8], [TOTAL, 6.8]];
  function baseDev(t) {
    for (var i = 1; i < CP.length; i++) {
      if (t <= CP[i][0]) {
        var a = CP[i - 1], b = CP[i];
        return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0]));
      }
    }
    return CP[CP.length - 1][1];
  }
  var DEX = [];
  (function () {
    for (var i = 0; i <= N; i++) {
      var t = i * STEP;
      var trans = t > 7 && t < 15.5;
      var noise = (rnd(i + 1) - 0.5) * (trans ? 0.1 : 0.3);
      if (i === ALERT_T / STEP) noise = 0;
      DEX.push(1 - (baseDev(t) + noise) / 100);
    }
  })();
  function dexAt(t) {
    var f = clamp(t, 0, TOTAL) / STEP, i = Math.floor(f);
    if (i >= N) return DEX[N];
    return DEX[i] + (DEX[i + 1] - DEX[i]) * (f - i);
  }

  /* ---------- Chart Geometry ---------- */
  var X0 = 10, X1 = 925, YTOP = 24, YBOT = 325, VMAX = 1.006, VMIN = 0.925;
  var X = function (t) { return X0 + (t / TOTAL) * (X1 - X0); };
  var Y = function (v) { return YTOP + (VMAX - v) / (VMAX - VMIN) * (YBOT - YTOP); };
  
  function initChartGrid() {
    [['100', 1.0], ['98', 0.98], ['95', 0.95], ['93', 0.93]].forEach(function (g) {
      var y = Y(g[1]);
      var line = $('#g' + g[0]); line.setAttribute('y1', y); line.setAttribute('y2', y);
      var tx = $('#t' + g[0]); tx.setAttribute('y', y - 6);
    });
    $('#amLine').setAttribute('x1', X(ALERT_T)); $('#amLine').setAttribute('x2', X(ALERT_T));
    $('#amText').setAttribute('x', X(ALERT_T) + 12);
  }
  initChartGrid();

  /* ---------- Alert Factors ---------- */
  var FACTORS = [
    { name: 'Price deviation',       detail: '6.8% vs 2.0% threshold',  max: 30, val: 30 },
    { name: 'Attacker profit',       detail: '$1.80M of $2.40M ceiling', max: 30, val: 22.5 },
    { name: 'Dependents hit',        detail: '2 of 2 markets on the feed', max: 20, val: 20 },
    { name: 'Historical similarity', detail: '87% match, curated replay set', max: 20, val: 17.4 }
  ];
  var factorsEl = $('#factors');
  FACTORS.forEach(function (f, i) {
    var d = document.createElement('div');
    d.className = 'factor';
    d.innerHTML = '<div class="row"><span>' + f.name + '<span class="d" id="fd' + i + '">' + f.detail + '</span></span>' +
      '<span class="amt" id="fp' + i + '">0 / ' + f.max + '</span></div>' +
      '<div class="track"><div class="fill" id="ff' + i + '"></div></div>';
    factorsEl.appendChild(d);
  });
  var TOTAL_SCORE = FACTORS.reduce(function (s, f) { return s + f.val; }, 0);

  /* ---------- Stage Navigation Buttons ---------- */
  var stagesEl = $('#stages');
  STAGES.forEach(function (s, i) {
    var b = document.createElement('button');
    b.className = 'btn sm'; b.textContent = s.name; b.setAttribute('data-i', i);
    b.addEventListener('click', function () { 
      forceScroll = true; 
      simTime = s.t; 
      render(); 
    });
    stagesEl.appendChild(b);
  });
  var stageBtns = $$('#stages .btn');

  /* ---------- Scenario State ---------- */
  var simTime = 0, playing = true, speed = 1, lastTs = null;
  var lastStage = -1, forceScroll = false, lastLogCount = -1, wasPlaying = false;
  var nodesTimed = $$('[data-t]');

  function stageIndex(x) {
    var idx = 0;
    for (var i = 0; i < STAGES.length; i++) if (x >= STAGES[i].t) idx = i;
    return idx;
  }
  function scrollToStage(i) {
    var target = null;
    if (i === 0) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (i === 1) target = $('#sec-detect');
    if (i === 2) target = $('#sec-price');
    if (i === 3) target = $('#sec-map');
    if (i === 4) target = $('#sec-alert');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function setBadge(id, text, cls) {
    var el = $(id); el.textContent = text; el.className = 'badge' + (cls ? ' ' + cls : '');
  }

  /* ---------- Render Scenario (Controlled Reference Demo Mode) ---------- */
  function renderScenario() {
    var si = stageIndex(simTime);
    var idx = Math.min(N, Math.floor(simTime / STEP));

    // Chart paths
    var d = '';
    for (var i = 0; i <= idx; i++) d += (i ? 'L' : 'M') + X(i * STEP).toFixed(1) + ' ' + Y(DEX[i]).toFixed(1);
    var dexNow = dexAt(simTime), xNow = X(simTime), yDex = Y(dexNow), yOsm = Y(1.0);
    d += (idx ? 'L' : 'M') + xNow.toFixed(1) + ' ' + yDex.toFixed(1);
    $('#dexLine').setAttribute('d', d);
    $('#osmLine').setAttribute('d', 'M' + X(0) + ' ' + yOsm + 'L' + xNow.toFixed(1) + ' ' + yOsm);
    
    var dev = Math.abs(1 - dexNow) * 100;
    var gap = $('#gap'), dot = $('#dot');
    if (simTime > 0.2) {
      dot.style.display = ''; dot.setAttribute('cx', xNow); dot.setAttribute('cy', yDex);
      gap.style.display = dev >= 1 ? '' : 'none';
      gap.setAttribute('x1', xNow); gap.setAttribute('x2', xNow);
      gap.setAttribute('y1', yOsm); gap.setAttribute('y2', yDex);
    } else { 
      dot.style.display = 'none'; gap.style.display = 'none'; 
    }
    $('#alertMark').style.display = simTime >= ALERT_T ? '' : 'none';

    // Stat cards
    $('#s-osm').textContent = '1.0000';
    $('#s-dex').textContent = dexNow.toFixed(4);
    var sd = $('#s-dev'); sd.textContent = dev.toFixed(2) + '%'; sd.className = 'v' + (dev >= 2 ? ' red' : '');

    // Event log
    var shown = EVENTS.filter(function (e) { return simTime >= e.t; });
    if (shown.length !== lastLogCount) {
      lastLogCount = shown.length;
      var html = '';
      for (var j = shown.length - 1; j >= 0; j--) {
        html += '<li class="' + shown[j].k + '"><time>' + mmss(shown[j].t) + '</time><span>' + shown[j].text + '</span></li>';
      }
      $('#log').innerHTML = html;
    }

    // Price section
    var pp = ease(clamp((simTime - 20) / 8, 0, 1));
    var cost = 96000 * pp, ext = 1900000 * pp, net = ext - cost;
    $('#p-cost').textContent = money(cost);
    $('#p-ext').textContent = money(ext);
    $('#p-ceil').textContent = '$2.40M';
    $('#p-net').textContent = pp > 0 ? '+' + money(net) : '$0';
    $('#f-cost').style.width = (cost / 2400000 * 100).toFixed(2) + '%';
    $('#f-ext').style.width = (ext / 2400000 * 100).toFixed(2) + '%';

    // Map section
    nodesTimed.forEach(function (el) {
      var on = simTime >= parseFloat(el.getAttribute('data-t'));
      var cur = el.classList.contains('on');
      if (on && !cur) el.classList.add('on');
      if (!on && cur) el.classList.remove('on');
    });
    var usdcOn = $('#n-usdc').classList.contains('on'), ethOn = $('#n-eth').classList.contains('on');
    var vaultOn = $('#n-vault').classList.contains('on');
    $('#m-mk').textContent = (usdcOn ? 1 : 0) + (ethOn ? 1 : 0);
    $('#m-vt').textContent = vaultOn ? 1 : 0;
    var exposed = (usdcOn ? 2.4 : 0) + (ethOn ? 0.6 : 0);
    $('#m-ex').textContent = exposed === 0 ? '$0' : '$' + exposed.toFixed(1) + 'M';

    // Alert section
    var ap = ease(clamp((simTime - 43) / 4, 0, 1));
    FACTORS.forEach(function (f, i) {
      $('#fp' + i).textContent = (f.val * ap).toFixed(1) + ' / ' + f.max;
      $('#ff' + i).style.width = (f.val * ap / f.max * 100).toFixed(1) + '%';
    });
    $('#score').textContent = Math.round(TOTAL_SCORE * ap);
    var pill = $('#pill');
    if (simTime >= 43) { pill.textContent = 'CRITICAL'; pill.className = 'pill'; }
    else { pill.textContent = 'STANDBY'; pill.className = 'pill idle'; }

    // Section locks and badges
    $('#sec-price').classList.toggle('locked', simTime < 20);
    $('#sec-map').classList.toggle('locked', simTime < 33);
    $('#sec-alert').classList.toggle('locked', simTime < 43);
    setBadge('#b-detect', simTime >= ALERT_T ? 'Alert' : 'Watching', simTime >= ALERT_T ? 'red' : '');
    setBadge('#b-price', simTime < 20 ? 'Waiting' : (simTime < 28 ? 'Pricing' : 'Priced'), simTime >= 20 ? 'on' : '');
    setBadge('#b-map', simTime < 33 ? 'Waiting' : (simTime < 41.5 ? 'Tracing' : 'Traced'), simTime >= 33 ? 'on' : '');
    setBadge('#b-alert', simTime < 43 ? 'Standby' : 'CRITICAL', simTime >= 43 ? 'red' : '');
    
    var chip = $('#chip');
    if (simTime < ALERT_T) { chip.textContent = 'Watching'; chip.className = 'chip'; }
    else if (simTime < 43) { chip.textContent = 'Anomaly detected'; chip.className = 'chip red'; }
    else { chip.textContent = 'CRITICAL ALERT'; chip.className = 'chip red'; }

    // Dock
    $('#nar-k').textContent = STAGES[si].name;
    $('#nar-t').textContent = STAGES[si].text;
    stageBtns.forEach(function (b, i) { b.classList.toggle('active', i === si); });
    $('#bPlay').textContent = simTime >= TOTAL && !playing ? 'Replay' : (playing ? 'Pause' : 'Play');
    $('#scrub').value = Math.round(simTime * 10);

    // Follow the active stage
    if (si !== lastStage) {
      lastStage = si;
      if (playing || forceScroll) scrollToStage(si);
      forceScroll = false;
    }
  }

  /* ---------- Live Mode Renderer (Real Chainlink & DefiLlama) ---------- */
  function renderLive() {
    $('#brandSub').textContent = 'ETH/USD feed · Ethereum mainnet';
    $('#simPill').style.display = 'none';
    $('#replayBar').style.display = 'none';

    // Chart in Live Mode
    renderLiveChart();

    // Stats
    $('#k-osm').textContent = 'Chainlink ETH';
    $('#k-dex').textContent = 'DefiLlama Spot';
    $('#s-osm').textContent = '$' + liveData.oraclePrice.toFixed(2);
    $('#s-dex').textContent = '$' + liveData.marketPrice.toFixed(2);
    
    var dev = liveData.deviation;
    var sd = $('#s-dev'); 
    sd.textContent = dev.toFixed(2) + '%'; 
    sd.className = 'v' + (dev >= 2.0 ? ' red' : '');

    var isAnomaly = dev >= 2.0;
    var chip = $('#chip');
    if (!isAnomaly) {
      chip.textContent = 'Watching'; chip.className = 'chip';
      setBadge('#b-detect', 'Watching', '');
      setBadge('#b-price', 'Waiting', '');
      setBadge('#b-map', 'Waiting', '');
      setBadge('#b-alert', 'Standby', '');
      $('#pill').textContent = 'STANDBY'; $('#pill').className = 'pill idle';
      $('#score').textContent = '0';
      $('#sec-price').classList.add('locked');
      $('#sec-map').classList.add('locked');
      $('#sec-alert').classList.add('locked');
    } else {
      chip.textContent = 'CRITICAL ALERT'; chip.className = 'chip red';
      setBadge('#b-detect', 'Alert', 'red');
      setBadge('#b-price', 'Priced', 'on');
      setBadge('#b-map', 'Traced', 'on');
      setBadge('#b-alert', 'CRITICAL', 'red');
      $('#pill').textContent = 'CRITICAL'; $('#pill').className = 'pill';
      $('#score').textContent = '85';
      $('#sec-price').classList.remove('locked');
      $('#sec-map').classList.remove('locked');
      $('#sec-alert').classList.remove('locked');
    }

    // Dock narrative in Live mode
    $('#nar-k').textContent = 'Monitor';
    $('#nar-t').textContent = isAnomaly 
      ? 'CRITICAL ALERT: Chainlink ETH/USD deviates by ' + dev.toFixed(2) + '% from DefiLlama spot. Downstream lending markets exposed.'
      : 'OracleWatch live monitoring active. Chainlink ETH/USD ($' + liveData.oraclePrice.toFixed(2) + ') and DefiLlama spot ($' + liveData.marketPrice.toFixed(2) + ') agree within 2% threshold.';
  }

  function renderLiveChart() {
    var pts = liveData.history;
    if (!pts || pts.length < 2) return;

    var minP = Infinity, maxP = -Infinity;
    pts.forEach(function (p) {
      minP = Math.min(minP, p.oracle_price, p.market_price);
      maxP = Math.max(maxP, p.oracle_price, p.market_price);
    });

    var pad = Math.max((maxP - minP) * 0.1, 20);
    minP = Math.max(0, minP - pad);
    maxP = maxP + pad;

    // Update Y-Axis labels
    var gridSteps = [
      { id: '100', val: maxP },
      { id: '98',  val: minP + (maxP - minP) * 0.66 },
      { id: '95',  val: minP + (maxP - minP) * 0.33 },
      { id: '93',  val: minP }
    ];
    gridSteps.forEach(function (g) {
      $('#t' + g.id).textContent = '$' + Math.round(g.val);
    });

    // Build SVG paths
    var dOsm = '', dDex = '';
    var len = pts.length;
    pts.forEach(function (p, i) {
      var x = X0 + (i / (len - 1)) * (X1 - X0);
      var yO = YTOP + (maxP - p.oracle_price) / (maxP - minP) * (YBOT - YTOP);
      var yD = YTOP + (maxP - p.market_price) / (maxP - minP) * (YBOT - YTOP);
      dOsm += (i ? ' L ' : 'M ') + x.toFixed(1) + ' ' + yO.toFixed(1);
      dDex += (i ? ' L ' : 'M ') + x.toFixed(1) + ' ' + yD.toFixed(1);
    });

    $('#osmLine').setAttribute('d', dOsm);
    $('#dexLine').setAttribute('d', dDex);
    $('#dot').style.display = 'none';
    $('#gap').style.display = 'none';
    $('#alertMark').style.display = liveData.deviation >= 2.0 ? '' : 'none';
  }

  /* ---------- Switch Modes ---------- */
  function setMode(mode) {
    currentMode = mode;
    $('#tabLive').classList.toggle('active', mode === 'live');
    $('#tabStress').classList.toggle('active', mode === 'stress');
    $('#tabReplay').classList.toggle('active', mode === 'replay');

    if (mode === 'stress') {
      $('#brandSub').textContent = 'RWAUSD/USD feed · controlled demo scenario';
      $('#simPill').style.display = '';
      $('#replayBar').style.display = 'none';
      $('#lg-osm').textContent = 'OSM price (1 hour delay)';
      $('#lg-dex').textContent = 'DEX spot';
      $('#k-osm').textContent = 'OSM price';
      $('#k-dex').textContent = 'DEX spot';
      initChartGrid();
      simTime = 0; playing = true; lastStage = -1; lastLogCount = -1; forceScroll = true;
      render();
    } else if (mode === 'live') {
      fetchLiveData();
      startLivePolling();
    } else if (mode === 'replay') {
      $('#brandSub').textContent = 'Historical Incident Replay · Delayed-Feed Model';
      $('#simPill').style.display = '';
      $('#replayBar').style.display = '';
      fetchReplayIncident($('#replaySelect').value);
    }
  }

  /* ---------- Live Data Poller ---------- */
  async function fetchLiveData() {
    try {
      var res = await fetch('/api/detect?mode=live');
      if (res.ok) {
        var data = await res.json();
        liveData.oraclePrice = data.oracle.price;
        liveData.marketPrice = data.market.price;
        liveData.deviation = data.deviation.percent;
        liveData.history = data.history || [];

        // Log events
        if (data.logs && data.logs.length > 0) {
          var html = '';
          data.logs.slice(-5).reverse().forEach(function (l) {
            html += '<li class="' + (l.level === 'ERROR' ? 'r' : '') + '"><time>' + (l.timestamp || '00:00') + '</time><span>' + l.message + '</span></li>';
          });
          $('#log').innerHTML = html;
        }

        // Fetch price risk & dependencies in background
        fetchPriceRiskLive(liveData.deviation);
        fetchDependenciesLive();

        if (currentMode === 'live') {
          renderLive();
        }
      }
    } catch (e) {
      console.warn('Live poll error:', e);
    }
  }

  async function fetchPriceRiskLive(dev) {
    try {
      var res = await fetch('/api/price-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviation: dev, pool_tvl: 900000000, borrowable_liquidity: 120000000, collateral_supplied: 250000000 })
      });
      if (res.ok) {
        var d = await res.json();
        var r = d.results;
        if (currentMode === 'live') {
          $('#p-cost').textContent = money(r.market_movement_cost);
          $('#p-ext').textContent = money(r.extractable_upper_bound);
          $('#p-ceil').textContent = '$120M';
          $('#p-net').textContent = r.net_opportunity > 0 ? '+' + money(r.net_opportunity) : '$0';
          $('#f-cost').style.width = Math.min(100, (r.market_movement_cost / 120000000) * 100).toFixed(1) + '%';
          $('#f-ext').style.width = Math.min(100, (r.extractable_upper_bound / 120000000) * 100).toFixed(1) + '%';
          $('#p-note').textContent = 'Extraction is capped by the lending market\'s borrowable liquidity, not by protocol total TVL.';
        }
      }
    } catch (e) {}
  }

  async function fetchDependenciesLive() {
    try {
      var res = await fetch('/api/dependencies');
      if (res.ok) {
        var d = await res.json();
        if (currentMode === 'live') {
          $('#m-mk').textContent = d.total_markets_hit || '6';
          $('#m-vt').textContent = d.total_vaults_hit || '12';
          $('#m-ex').textContent = d.total_dollars_formatted || '$23.13B';
        }
      }
    } catch (e) {}
  }

  function startLivePolling() {
    if (livePollTimer) clearInterval(livePollTimer);
    livePollTimer = setInterval(function () {
      if (currentMode === 'live') fetchLiveData();
    }, 15000);
  }

  /* ---------- Historical Incident Replay ---------- */
  async function fetchReplayIncident(incidentDate) {
    try {
      var res = await fetch('/api/replay?date=' + incidentDate + '&heartbeat=3600');
      if (res.ok) {
        var data = await res.json();
        var pts = data.replay_points || [];
        if (pts.length > 0) {
          // Re-seed scenario curve with historical replay points
          DEX = pts.map(function (p) { return p.market_price / p.oracle_price; });
          simTime = 0; playing = true; lastStage = -1; lastLogCount = -1; forceScroll = true;
          render();
        }
      }
    } catch (e) {
      console.warn('Replay fetch error:', e);
    }
  }

  /* ---------- Main Playback Animation Loop ---------- */
  function render() {
    if (currentMode === 'stress' || currentMode === 'replay') {
      renderScenario();
    } else if (currentMode === 'live') {
      renderLive();
    }
  }

  function tick(ts) {
    if (lastTs === null) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;

    if (playing && (currentMode === 'stress' || currentMode === 'replay')) {
      simTime = Math.min(TOTAL, simTime + dt * speed);
      if (simTime >= TOTAL) playing = false;
      render();
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Controls & Event Bindings ---------- */
  $('#bPlay').addEventListener('click', function () {
    if (simTime >= TOTAL) { simTime = 0; lastStage = -1; }
    playing = !playing; render();
  });
  $('#bRestart').addEventListener('click', function () {
    simTime = 0; playing = true; lastStage = -1; lastLogCount = -1; forceScroll = true; render();
  });
  $('#bSpeed').addEventListener('click', function () {
    speed = speed === 1 ? 2 : 1;
    this.textContent = speed === 1 ? '2x speed' : '1x speed';
    this.classList.toggle('active', speed === 2);
  });
  function toggleClean() {
    document.body.classList.toggle('clean');
    $('#bClean').classList.toggle('active', document.body.classList.contains('clean'));
  }
  $('#bClean').addEventListener('click', toggleClean);
  $('#bTheme').addEventListener('click', function () {
    var h = document.documentElement;
    h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var scrub = $('#scrub');
  scrub.addEventListener('pointerdown', function () { wasPlaying = playing; playing = false; });
  scrub.addEventListener('pointerup', function () { playing = wasPlaying && simTime < TOTAL; render(); });
  scrub.addEventListener('pointercancel', function () { playing = wasPlaying && simTime < TOTAL; render(); });
  scrub.addEventListener('input', function () { simTime = parseFloat(scrub.value) / 10; render(); });

  document.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (e.key === 'h' || e.key === 'H') { toggleClean(); }
    else if (e.code === 'Space' && tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'SELECT') { 
      e.preventDefault(); $('#bPlay').click(); 
    }
  });

  // Mode Tabs
  $('#tabLive').addEventListener('click', function () { setMode('live'); });
  $('#tabStress').addEventListener('click', function () { setMode('stress'); });
  $('#tabReplay').addEventListener('click', function () { setMode('replay'); });
  $('#replaySelect').addEventListener('change', function () { fetchReplayIncident(this.value); });

  /* ---------- Launch ---------- */
  render();
  requestAnimationFrame(tick);

  // Hook for automated test verification
  window.__oracleWatch = {
    setMode: setMode,
    setTime: function (x) { simTime = x; render(); },
    getTime: function () { return simTime; }
  };

})();
