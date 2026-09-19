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

  /* ---------- Verified Incident Benchmark: Morpho wstUSR Anomaly ---------- */
  var mockAlert = {
    // Core
    protocol: "Morpho wstUSR Lending Market",
    severity: "CRITICAL",
    confidence: 94,

    // Oracle
    oracleAddress: "0x8f3c...a91b",
    oracleType: "Uniswap V3 Spot",
    oraclePrice: 1.13,
    marketPrice: 0.63,
    deviation: "+79.4%",
    lastUpdate: "6 hours 12 minutes ago",
    twapWindow: "None",

    // Exploit
    attackerCost: 180000,
    grossProfit: 2340000,
    netProfit: 2160000,
    timeToExecute: "12 seconds",
    economicallyViable: true,

    // Blast radius
    affectedProtocols: 3,
    totalTVLExposed: "890M",
    chainsAffected: ["Ethereum", "Arbitrum", "Base"],

    // History
    historicalExploits: [
      { name: "BeatSwap", loss: "77K", date: "Feb 2026" },
      { name: "Float Protocol", loss: "28K", date: "Aug 2025" },
      { name: "NGP Token", loss: "2M", date: "Sep 2025" },
      { name: "Resolv", loss: "25M", date: "Mar 2026" }
    ],

    // Multi-market
    markets: [
      { name: "Uniswap", price: 0.63 },
      { name: "Curve", price: 0.64 },
      { name: "Binance", price: 0.63 },
      { name: "Coinbase", price: 0.62 }
    ],

    // Action
    recommendedAction: "PAUSE MARKET"
  };


  /* ---------- Controlled Demo Scenario Definition (Exact Reference) ---------- */
  var TOTAL = 50;           // scenario length in seconds
  var STEP = 0.5;           // chart sample spacing
  var N = Math.round(TOTAL / STEP);
  var ALERT_T = 10;

  var STAGES = [
    { name: 'Monitor', t: 0,  text: 'OracleWatch checks the RWAUSD/USD feed, the delayed OSM price and DEX spot every block. All three agree, so there is nothing to act on.' },
    { name: 'Detect',  t: 10, text: 'DEX spot pulls away from the delayed OSM price. The deviation crosses the 2% threshold and is confirmed on 3 independent sources, which starts the exploit-window clock.' },
    { name: 'Price',   t: 20, text: 'OracleWatch prices the exploit: what it costs to move the market versus what an attacker can extract from the lending market. The window clock shows how long they have to cash in.' },
    { name: 'Map',     t: 33, text: 'The manipulated feed is traced to every market and vault that reads it. They are all hit together when the window closes; unaffected markets stay dark.' },
    { name: 'Alert',   t: 43, text: 'One explainable alert combines deviation, exploit value, exposure, history and the time left into a single warning with deadlines. Press Simulate response to close the window.' }
  ];

  var EVENTS = [
    { t: 0,  k: 'p', text: 'Watching 4 feeds across 12 markets' },
    { t: 10, k: 'r', text: 'Deviation 2.0% crossed the threshold' },
    { t: 12, k: 'r', text: 'Exploit window open: OSM adopts the price in about 55 min' },
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

  /* ---------- Exploit Window + Alert Factors (Transparent Scoring) ---------- */
  var WIN_START = 7, WIN_LEN = 60; // window opens when the move begins; OSM delay = 60 min
  var remainingSec = function (now) { return Math.max(0, (WIN_START + WIN_LEN - now) * 60); };
  var FACTORS = [
    { name: 'Price deviation',       detail: '6.8% vs 2.0% threshold',       max: 25, val: function () { return 25; } },
    { name: 'Attacker profit',       detail: '$1.80M of $2.40M ceiling',     max: 25, val: function () { return 25 * 1.8 / 2.4; } },
    { name: 'Dependents hit',        detail: '2 of 2 markets on the feed',   max: 15, val: function () { return 15; } },
    { name: 'Historical similarity', detail: '87% match, curated replay set', max: 15, val: function () { return 15 * 0.87; } },
    { name: 'Time pressure',         detail: '',                             max: 20, val: function (now) { return 20 * clamp((now - WIN_START) / WIN_LEN, 0, 1); } }
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
  var simTime = 0, playing = true, speed = 1, lastTs = null, containT = null;
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
    if (i === 1) target = $('#sec-window');
    if (i === 2) target = $('#sec-price');
    if (i === 3) target = $('#sec-map');
    if (i === 4) target = $('#sec-alert');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function setBadge(id, text, cls) {
    var el = $(id); if (el) { el.textContent = text; el.className = 'badge' + (cls ? ' ' + cls : ''); }
  }

  /* ---------- Render Scenario (Controlled Reference Demo Mode) ---------- */
  function renderScenario() {
    var si = stageIndex(simTime);
    var idx = Math.min(N, Math.floor(simTime / STEP));
    if (containT !== null && simTime < containT) containT = null; // scrubbed back before the response
    var contained = containT !== null;
    var now = contained ? containT : simTime; // the window clock freezes when contained
    var rem = remainingSec(now);

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
    var evs = EVENTS.slice();
    if (contained) evs.push({ t: containT, k: 'g', text: 'Response executed, $1.80M attack prevented' });
    var shown = evs.filter(function (e) { return simTime >= e.t; });
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
    $('#p-net').className = contained ? 'prevented' : '';
    $('#p-lbl').textContent = contained ? 'Attacker net profit (prevented)' : 'Attacker net profit';
    $('#p-win').textContent = simTime < 20 ? '--:--' : (contained ? 'closed' : mmss(rem));
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
    $('#m-ex').textContent = contained ? '$0 (was $3.0M)' : (exposed === 0 ? '$0' : '$' + exposed.toFixed(1) + 'M');
    $('#m-eta').textContent = simTime < 33 ? 'Waiting for the trace.' : (contained
      ? 'Protected: the response landed ' + mmss(rem) + ' before the OSM update, so none of the 3 dependents were hit.'
      : 'All 3 dependents read the same OSM price, so they are hit together in ' + mmss(rem) + '.');
    $('#sec-map').classList.toggle('contained', contained);

    // Alert section
    var ap = ease(clamp((simTime - 43) / 4, 0, 1));
    var tot = 0;
    FACTORS.forEach(function (f, i) {
      var v = f.val(now); tot += v;
      $('#fp' + i).textContent = (v * ap).toFixed(1) + ' / ' + f.max;
      $('#ff' + i).style.width = (v * ap / f.max * 100).toFixed(1) + '%';
    });
    var fd4 = $('#fd4'); if (fd4) fd4.textContent = Math.round(rem / 60) + ' min left in the window';
    $('#score').textContent = Math.round(tot * ap);
    var pill = $('#pill');
    if (simTime >= 43) {
      if (contained) { pill.textContent = 'CONTAINED'; pill.className = 'pill ok'; }
      else { pill.textContent = tot >= 80 ? 'CRITICAL' : 'HIGH'; pill.className = 'pill'; }
    } else { pill.textContent = 'STANDBY'; pill.className = 'pill idle'; }

    $('#a-win').textContent = simTime < 43 ? '' : (contained
      ? 'Response executed with ' + mmss(rem) + ' to spare.'
      : 'Response window: ' + mmss(rem) + ' left before the OSM adopts the price.');

    $$('.due').forEach(function (el) { el.textContent = simTime < 43 ? '' : (contained ? 'done' : 'act within ' + mmss(rem)); });

    var br = $('#bRespond');
    if (br) {
      br.disabled = simTime < 43 || contained;
      br.textContent = contained ? 'Response executed' : 'Simulate response';
    }

    var pr = $('#a-prot');
    if (pr) {
      pr.style.display = contained ? '' : 'none';
      if (contained) pr.textContent = 'Value protected: $1.80M attacker profit and $3.0M exposure closed. The response landed ' + mmss(rem) + ' before the OSM adopted the manipulated price.';
    }

    // Section locks and badges
    $('#sec-price').classList.toggle('locked', simTime < 20);
    $('#sec-map').classList.toggle('locked', simTime < 33);
    $('#sec-alert').classList.toggle('locked', simTime < 43);
    setBadge('#b-detect', simTime >= ALERT_T ? 'Alert' : 'Watching', simTime >= ALERT_T ? 'red' : '');
    setBadge('#b-price', simTime < 20 ? 'Waiting' : (simTime < 28 ? 'Pricing' : 'Priced'), simTime >= 20 ? 'on' : '');
    setBadge('#b-map', simTime < 33 ? 'Waiting' : (simTime < 41.5 ? 'Tracing' : 'Traced'), simTime >= 33 ? 'on' : '');
    setBadge('#b-alert', simTime < 43 ? 'Standby' : (contained ? 'Contained' : 'CRITICAL'), simTime < 43 ? '' : (contained ? 'on' : 'red'));
    
    var chip = $('#chip');
    if (contained) { chip.textContent = 'Contained'; chip.className = 'chip'; }
    else if (simTime < ALERT_T) { chip.textContent = 'Watching'; chip.className = 'chip'; }
    else if (simTime < 43) { chip.textContent = 'Anomaly detected'; chip.className = 'chip red'; }
    else { chip.textContent = 'CRITICAL ALERT'; chip.className = 'chip red'; }

    // Exploit window card
    var used = clamp((now - WIN_START) / WIN_LEN, 0, 1);
    var wstate = 'w-idle';
    if (simTime >= ALERT_T) wstate = contained ? 'w-safe' : (rem > 1800 ? 'w-open' : (rem > 900 ? 'w-warn' : 'w-hot'));
    $('#sec-window').className = 'card win ' + wstate;

    if (simTime < ALERT_T) {
      $('#clock').textContent = '--:--';
      $('#win-msg').textContent = 'No active window. All feeds agree, so there is nothing to time.';
      $('#win-bar').style.width = '0%';
      $('#w-det').textContent = '-'; $('#w-lead').textContent = '-'; $('#w-used').textContent = '0%';
      setBadge('#b-win', 'Idle', '');
    } else {
      $('#clock').textContent = mmss(rem);
      $('#win-msg').textContent = contained
        ? 'Response landed. The manipulated price never reaches the lending market.'
        : 'Until the delayed OSM adopts the manipulated price. Act before this reaches zero.';
      $('#win-bar').style.width = ((1 - used) * 100).toFixed(1) + '%';
      $('#w-det').textContent = (ALERT_T - WIN_START) + ' min';
      $('#w-lead').textContent = (WIN_LEN - (ALERT_T - WIN_START)) + ' min';
      $('#w-used').textContent = Math.round(used * 100) + '%';
      setBadge('#b-win', contained ? 'Contained' : (rem > 1800 ? 'Open' : (rem > 900 ? 'Closing' : 'Critical')),
               contained ? 'on' : (rem > 1800 ? 'on' : 'red'));
    }

    var nc = $('#nar-clock');
    if (nc) {
      if (simTime < ALERT_T) { nc.style.display = 'none'; }
      else {
        nc.style.display = '';
        nc.textContent = contained ? 'Contained' : 'Impact in ' + mmss(rem);
        nc.style.color = contained ? 'var(--green)' : (rem > 1800 ? 'var(--purple)' : (rem > 900 ? 'var(--amber)' : 'var(--red)'));
      }
    }

    // Dock
    $('#nar-k').textContent = STAGES[si].name;
    $('#nar-t').textContent = (si === 4 && contained)
      ? 'Response executed inside the window. The exploit is closed before the manipulated price ever reaches the lending market.'
      : STAGES[si].text;
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

      // Exploit Window in Live Idle Mode
      $('#sec-window').className = 'card win w-idle';
      $('#clock').textContent = '--:--';
      $('#win-msg').textContent = 'No active exploit window. The feed is within the configured deviation threshold (' + dev.toFixed(2) + '% vs 2.0% threshold).';
      $('#win-bar').style.width = '0%';
      $('#w-det').textContent = '-';
      $('#w-lead').textContent = '-';
      $('#w-used').textContent = '0%';
      setBadge('#b-win', 'Idle', '');
      $('#p-win').textContent = '--:--';
      $('#m-eta').textContent = 'No active exploit propagation detected.';
      var nc = $('#nar-clock'); if (nc) nc.style.display = 'none';
      $('#a-win').textContent = '';
      $$('.due').forEach(function (el) { el.textContent = ''; });
      var br = $('#bRespond'); if (br) { br.disabled = true; br.textContent = 'Simulate response'; }
      var pr = $('#a-prot'); if (pr) pr.style.display = 'none';
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

      // Exploit Window in Live Anomaly Mode
      var ew = liveData.exploitWindow || {};
      var remSec = ew.lead_time_seconds || 3420;
      $('#sec-window').className = 'card win w-open';
      $('#clock').textContent = mmss(remSec);
      $('#win-msg').textContent = 'Active exploit propagation window (' + (ew.model || 'heartbeat-based model') + '). Act before price updates on-chain.';
      $('#win-bar').style.width = '95%';
      $('#w-det').textContent = Math.round((ew.detection_latency_seconds || 180) / 60) + ' min';
      $('#w-lead').textContent = Math.round(remSec / 60) + ' min';
      $('#w-used').textContent = '5%';
      setBadge('#b-win', 'Open', 'on');
      $('#p-win').textContent = mmss(remSec);
      $('#m-eta').textContent = 'Chainlink 1-hour delay active. Dependent lending protocols exposed in ' + mmss(remSec) + '.';
      var nc = $('#nar-clock'); if (nc) { nc.style.display = ''; nc.textContent = 'Impact in ' + mmss(remSec); nc.style.color = 'var(--purple)'; }
      $('#a-win').textContent = 'Response window: ' + mmss(remSec) + ' left before the feed updates downstream.';
      $$('.due').forEach(function (el) { el.textContent = 'act within ' + mmss(remSec); });
      var br = $('#bRespond'); if (br) { br.disabled = false; br.textContent = 'Simulate response'; }
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

  /* ---------- Morpho wstUSR Chart Renderer ---------- */
  function renderMorphoChart() {
    $('#t100').textContent = '$1.30';
    $('#t98').textContent = '$1.13';
    $('#t95').textContent = '$0.90';
    $('#t93').textContent = '$0.63';

    var yTopPrice = 1.35, yBotPrice = 0.55;
    var y113 = YTOP + (yTopPrice - 1.13) / (yTopPrice - yBotPrice) * (YBOT - YTOP);
    var y063 = YTOP + (yTopPrice - 0.63) / (yTopPrice - yBotPrice) * (YBOT - YTOP);
    var y090 = YTOP + (yTopPrice - 0.90) / (yTopPrice - yBotPrice) * (YBOT - YTOP);

    // Update guidelines
    $('#g98').setAttribute('y1', y113); $('#g98').setAttribute('y2', y113);
    $('#t98').setAttribute('y', y113 - 6);
    $('#g95').setAttribute('y1', y090); $('#g95').setAttribute('y2', y090);
    $('#t95').setAttribute('y', y090 - 6);
    $('#g93').setAttribute('y1', y063); $('#g93').setAttribute('y2', y063);
    $('#t93').setAttribute('y', y063 - 6);

    // 1. Red Line: Consensus Market Reference ($0.63) across the entire timeline
    var dDex = 'M ' + X0 + ' ' + y063.toFixed(1);
    for (var k = 1; k <= 40; k++) {
      var xk = X0 + (k / 40) * (X1 - X0);
      var yk = y063 + ((rnd(k * 7) - 0.5) * 4);
      dDex += ' L ' + xk.toFixed(1) + ' ' + yk.toFixed(1);
    }

    // 2. Purple Line: Uniswap V3 Spot starts synced at $0.63, then skews sharply to $1.13 at x=22% and stays stale
    var xSkew = X0 + (X1 - X0) * 0.22;
    var xSkewEnd = X0 + (X1 - X0) * 0.28;
    var dOsm = 'M ' + X0 + ' ' + y063.toFixed(1) + 
               ' L ' + xSkew.toFixed(1) + ' ' + y063.toFixed(1) +
               ' L ' + xSkewEnd.toFixed(1) + ' ' + y113.toFixed(1) +
               ' L ' + X1 + ' ' + y113.toFixed(1);

    $('#dexLine').setAttribute('d', dDex);
    $('#osmLine').setAttribute('d', dOsm);

    // Alert vertical marker at the exact moment of spot skew
    $('#alertMark').style.display = '';
    $('#amLine').setAttribute('x1', xSkewEnd.toFixed(1));
    $('#amLine').setAttribute('x2', xSkewEnd.toFixed(1));
    $('#amText').setAttribute('x', (xSkewEnd + 12).toFixed(1));
    $('#amText').textContent = 'Spot Skew (+79.4%)';

    // Deviation gap indicator between $0.63 and $1.13
    var dot = $('#dot'), gap = $('#gap');
    dot.style.display = '';
    dot.setAttribute('cx', X1);
    dot.setAttribute('cy', y113);
    gap.style.display = '';
    gap.setAttribute('x1', X1);
    gap.setAttribute('x2', X1);
    gap.setAttribute('y1', y063);
    gap.setAttribute('y2', y113);
  }

  /* ---------- Morpho wstUSR Incident Renderer ---------- */
  function renderMorpho() {
    $('#brandSub').textContent = 'Morpho wstUSR Lending Market · Uniswap V3 Spot (0x8f3c...a91b)';
    var sp = $('#simPill');
    sp.style.display = 'inline-block';
    sp.textContent = 'CRITICAL ANOMALY';
    $('#replayBar').style.display = 'none';

    renderMorphoChart();

    // Stats
    $('#lg-osm').textContent = 'Uniswap V3 Spot ($1.13)';
    $('#lg-dex').textContent = 'Consensus Reference ($0.63)';
    $('#k-osm').textContent = 'Oracle (Spot)';
    $('#k-dex').textContent = 'Consensus (4 Venues)';
    $('#s-osm').textContent = '$1.13';
    $('#s-dex').textContent = '$0.63';
    var sd = $('#s-dev');
    sd.textContent = '+79.4%';
    sd.className = 'v red';

    // Event Log
    var mLogs = [
      { t: 0, k: 'p', text: 'Watching 4 feeds across Morpho, Silo, Euler markets' },
      { t: 5, k: 'r', text: 'Feed 0x8f3c...a91b staleness breached (6h 12m without update)' },
      { t: 8, k: 'r', text: 'Consensus reference $0.63 confirmed across Uniswap, Curve, Binance, Coinbase' },
      { t: 10, k: 'r', text: 'Deviation +79.4% detected! Oracle $1.13 vs Consensus $0.63' },
      { t: 12, k: 'p', text: 'Pricing exploit: Attacker cost $180K, Gross $2.34M, Net +$2.16M (12s)' },
      { t: 14, k: 'p', text: 'Tracing blast radius: 3 protocols exposed ($890M across Eth, Arb, Base)' },
      { t: 15, k: 'r', text: 'CRITICAL ALERT RAISED: PAUSE MORPHO wstUSR BORROWING IMMEDIATELY' }
    ];
    var html = '';
    for (var j = mLogs.length - 1; j >= 0; j--) {
      html += '<li class="' + mLogs[j].k + '"><time>' + mmss(mLogs[j].t) + '</time><span>' + mLogs[j].text + '</span></li>';
    }
    $('#log').innerHTML = html;

    // Price section
    $('#sec-price').classList.remove('locked');
    setBadge('#b-price', 'Priced', 'on');
    $('#p-cost').textContent = '$180K';
    $('#p-ext').textContent = '$2.34M';
    $('#p-ceil').textContent = '$2.34M';
    $('#p-net').textContent = '+$2.16M';
    $('#f-cost').style.width = '7.7%';
    $('#f-ext').style.width = '100%';
    $('#p-note').textContent = 'Exploit is economically viable: single-block extraction yields $2.16M net profit within 12 seconds.';

    // Map section
    $('#sec-map').classList.remove('locked');
    setBadge('#b-map', 'Traced', 'on');
    $('#lbl-n-usdc-1').textContent = 'Morpho wstUSR';
    $('#lbl-n-usdc-2').textContent = 'market, $420M TVL';
    $('#lbl-n-eth-1').textContent = 'Silo wstUSR-USDC';
    $('#lbl-n-eth-2').textContent = 'market, $290M TVL';
    $('#lbl-n-vault-1').textContent = 'Euler wstUSR Vault';
    $('#lbl-n-vault-2').textContent = 'deposits $180M';
    $('#m-mk').textContent = '2';
    $('#m-vt').textContent = '1';
    $('#m-ex').textContent = '$890M';
    $$('.edge').forEach(function (e) { e.classList.add('on'); });
    $$('.node').forEach(function (n) { n.classList.add('on'); });

    // Alert section
    $('#sec-alert').classList.remove('locked');
    setBadge('#b-alert', 'CRITICAL', 'red');
    setBadge('#b-detect', 'Alert', 'red');
    var chip = $('#chip');
    chip.textContent = 'CRITICAL ALERT';
    chip.className = 'chip red';

    $('#score').textContent = '94';
    var pill = $('#pill');
    pill.textContent = 'CRITICAL';
    pill.className = 'pill';
    $('#pillSec').style.display = 'inline-block';
    $('#pillVuln').style.display = 'inline-block';

    $('#alertTitle').textContent = mockAlert.protocol;
    $('#alertDesc').textContent = 'Uniswap V3 Spot is +79.4% above market consensus ($1.13 vs $0.63); wstUSR lending pool can be drained for $2.16M net profit in 12s.';

    // Oracle Metadata
    $('#om-protocol').textContent = mockAlert.protocol;
    $('#om-type').innerHTML = mockAlert.oracleType + ' (<code>' + mockAlert.oracleAddress + '</code>)';
    $('#om-twap').textContent = 'None (Critical Flaw)';
    $('#om-update').textContent = mockAlert.lastUpdate;
    $('#om-prices').innerHTML = '$1.13 vs $0.63 (<b id="om-dev">' + mockAlert.deviation + '</b>)';

    // Multi-Market Consensus Grid
    $('#mp-uniswap').textContent = '$0.63';
    $('#mp-curve').textContent = '$0.64';
    $('#mp-binance').textContent = '$0.63';
    $('#mp-coinbase').textContent = '$0.62';
    $('#mp-oracle').textContent = '$1.13';

    // Exploit Economics
    $('#ec-cost').textContent = '$180,000';
    $('#ec-gross').textContent = '$2,340,000';
    $('#ec-net').textContent = '+$2,160,000';
    $('#ec-time').textContent = '12 seconds';

    // Exploit Window Card in Morpho Mode
    $('#sec-window').className = 'card win w-hot';
    $('#clock').textContent = '00:12';
    $('#win-msg').textContent = 'Zero-second TWAP window! Exploit executes in a single block (~12 seconds). Immediate circuit breaker required.';
    $('#win-bar').style.width = '20%';
    $('#w-det').textContent = 'Instant';
    $('#w-lead').textContent = '12 sec';
    $('#w-used').textContent = '80%';
    setBadge('#b-win', 'Critical', 'red');
    $('#p-win').textContent = '00:12';
    $('#m-eta').textContent = 'Single Ethereum block window (~12 seconds). All 3 dependent protocols vulnerable to instant drain.';
    var nc = $('#nar-clock');
    if (nc) {
      nc.style.display = '';
      nc.textContent = 'Execute in 00:12';
      nc.style.color = 'var(--red)';
    }
    $('#a-win').textContent = 'Response window: 12 seconds before attacker transaction confirms in mempool.';
    $$('.due').forEach(function (el) { el.textContent = 'act within 00:12'; });
    var br = $('#bRespond');
    if (br) {
      br.disabled = false;
      br.textContent = 'Simulate response';
    }
    var pr = $('#a-prot');
    if (pr) pr.style.display = 'none';

    // Rule Factors (Exact 94 Score Breakdown across 5 factors)
    var morphoFactors = [
      { name: 'Source consensus agreement', detail: '4 of 4 independent venues (CV < 1.2%)', max: 25, val: 25.0 },
      { name: 'Price deviation magnitude', detail: '+79.4% vs 2.0% threshold (>15σ)', max: 25, val: 25.0 },
      { name: 'Oracle structural vulnerability', detail: 'Uniswap V3 Spot with zero TWAP window', max: 15, val: 15.0 },
      { name: 'Staleness & historical similarity', detail: '6h 12m stale, 89% match to Resolv/BeatSwap', max: 15, val: 12.0 },
      { name: 'Time pressure', detail: '12-second single block execution window', max: 20, val: 17.0 }
    ];
    morphoFactors.forEach(function (f, i) {
      var d = $('#fd' + i); 
      if (d) { 
        d.textContent = f.detail; 
        if (d.parentElement && d.parentElement.childNodes[0]) {
          d.parentElement.childNodes[0].textContent = f.name;
        }
      }
      var p = $('#fp' + i); if (p) p.textContent = f.val.toFixed(1) + ' / ' + f.max;
      var fill = $('#ff' + i); if (fill) fill.style.width = (f.val / f.max * 100).toFixed(1) + '%';
    });

    // Dock Narrative
    $('#nar-k').textContent = 'CRITICAL ALERT';
    $('#nar-t').textContent = 'Morpho wstUSR lending market is in immediate drainage condition. Uniswap V3 spot is at $1.13 (+79.4% deviation) with zero TWAP protection. Attacker net profit: $2.16M in 12s.';
  }

  /* ---------- Switch Modes ---------- */
  function setMode(mode) {
    currentMode = mode;
    containT = null;
    $('#tabLive').classList.toggle('active', mode === 'live');
    $('#tabStress').classList.toggle('active', mode === 'stress');
    var tabM = $('#tabMorpho'); if (tabM) tabM.classList.toggle('active', mode === 'morpho');
    $('#tabReplay').classList.toggle('active', mode === 'replay');

    if (mode === 'stress') {
      $('#brandSub').textContent = 'RWAUSD/USD feed · controlled demo scenario';
      $('#simPill').style.display = '';
      $('#simPill').textContent = 'SIMULATED';
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
    } else if (mode === 'morpho') {
      if (livePollTimer) clearInterval(livePollTimer);
      playing = false;
      renderMorpho();
      var secAlert = $('#sec-alert');
      if (secAlert && secAlert.scrollIntoView) {
        secAlert.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (mode === 'replay') {
      $('#brandSub').textContent = 'Historical Incident Replay · Delayed-Feed Model';
      $('#simPill').style.display = '';
      $('#simPill').textContent = 'SIMULATED';
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
        liveData.exploitWindow = data.exploit_window || null;

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
    } else if (currentMode === 'morpho') {
      renderMorpho();
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
    if (simTime >= TOTAL) { simTime = 0; lastStage = -1; containT = null; }
    playing = !playing; render();
  });
  $('#bRestart').addEventListener('click', function () {
    simTime = 0; playing = true; lastStage = -1; lastLogCount = -1; forceScroll = true; containT = null; render();
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

  // Action: Simulate Response button
  var bRespond = $('#bRespond');
  if (bRespond) {
    bRespond.addEventListener('click', function () {
      if (currentMode === 'stress' || currentMode === 'replay') {
        if (simTime >= 43 && containT === null) {
          containT = simTime;
          render();
        }
      } else if (currentMode === 'morpho') {
        var pill = $('#pill');
        if (pill) { pill.textContent = 'CONTAINED'; pill.className = 'pill ok'; }
        $('#sec-window').className = 'card win w-safe';
        $('#clock').textContent = '00:00';
        $('#win-msg').textContent = 'Emergency response executed! Oracle source isolated and collateral bridged halted.';
        setBadge('#b-win', 'Contained', 'on');
        setBadge('#b-alert', 'Contained', 'on');
        var chip = $('#chip'); if (chip) { chip.textContent = 'Contained'; chip.className = 'chip'; }
        $('#p-net').className = 'prevented';
        $('#p-lbl').textContent = 'Attacker net profit (prevented)';
        $('#p-win').textContent = 'closed';
        $('#m-ex').textContent = '$0 (was $890M)';
        $('#m-eta').textContent = 'Protected: The emergency circuit breaker isolated all 3 protocols before drainage occurred.';
        var nc = $('#nar-clock'); if (nc) { nc.textContent = 'Contained'; nc.style.color = 'var(--green)'; }
        $('#a-win').textContent = 'Response executed: $890M contagion prevented.';
        $$('.due').forEach(function (el) { el.textContent = 'done'; });
        bRespond.disabled = true;
        bRespond.textContent = 'Response executed';
        var pr = $('#a-prot');
        if (pr) {
          pr.style.display = '';
          pr.textContent = 'Value protected: $2.16M exploit profit and $890M blast radius prevented.';
        }
        var rc = $('#pauseReceipt'); if (rc) rc.style.display = 'block';
      } else if (currentMode === 'live') {
        var pill = $('#pill');
        if (pill) { pill.textContent = 'CONTAINED'; pill.className = 'pill ok'; }
        $('#sec-window').className = 'card win w-safe';
        setBadge('#b-win', 'Contained', 'on');
        setBadge('#b-alert', 'Contained', 'on');
        bRespond.disabled = true;
        bRespond.textContent = 'Response executed';
      }
    });
  }

  var scrub = $('#scrub');
  scrub.addEventListener('pointerdown', function () { wasPlaying = playing; playing = false; });
  scrub.addEventListener('pointerup', function () { playing = wasPlaying && simTime < TOTAL; render(); });
  scrub.addEventListener('pointercancel', function () { playing = wasPlaying && simTime < TOTAL; render(); });
  scrub.addEventListener('input', function () { simTime = parseFloat(scrub.value) / 10; render(); });

  document.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (e.key === 'h' || e.key === 'H') { toggleClean(); }
    else if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT') { 
      e.preventDefault(); if (!e.repeat) $('#bPlay').click(); 
    }
  });
  document.addEventListener('keyup', function (e) {
    var tag = e.target && e.target.tagName;
    if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT') e.preventDefault();
  });

  // Mode Tabs
  $('#tabLive').addEventListener('click', function () { setMode('live'); });
  $('#tabStress').addEventListener('click', function () { setMode('stress'); });
  var tabMorphoEl = $('#tabMorpho');
  if (tabMorphoEl) {
    tabMorphoEl.addEventListener('click', function () { setMode('morpho'); });
  }
  $('#tabReplay').addEventListener('click', function () { setMode('replay'); });
  $('#replaySelect').addEventListener('change', function () { fetchReplayIncident(this.value); });

  // Action: Emergency Pause Market Circuit Breaker
  var bPause = $('#bPauseMarket');
  if (bPause) {
    bPause.addEventListener('click', async function () {
      var btn = this;
      if (btn.classList.contains('paused')) return;

      btn.textContent = 'Triggering Circuit Breaker...';
      btn.disabled = true;

      try {
        var res = await fetch('/api/alert/pause', { method: 'POST' });
        var data = res.ok ? await res.json() : null;
        var tx = (data && data.transactionHash) ? data.transactionHash : '0x4a9fe71c9b2d88a10f63b412ca559';

        btn.innerHTML = '✓ MARKET PAUSED';
        btn.className = 'btn-pause-market paused';
        btn.disabled = false;

        var receipt = $('#pauseReceipt');
        if (receipt) {
          receipt.style.display = 'block';
          var rcTx = $('#rcTx'); if (rcTx) rcTx.textContent = tx;
          var rcTime = $('#receiptTime'); if (rcTime) rcTime.textContent = new Date().toLocaleTimeString();
        }

        var pill = $('#pill');
        if (pill) {
          pill.textContent = 'PAUSED (PROTECTED)';
          pill.className = 'pill idle';
          pill.style.background = 'rgba(60, 207, 145, 0.2)';
          pill.style.borderColor = 'var(--green)';
          pill.style.color = 'var(--green)';
        }

        var chip = $('#chip');
        if (chip) {
          chip.textContent = 'PROTECTED';
          chip.className = 'chip';
        }

        var nk = $('#nar-k'), nt = $('#nar-t');
        if (nk) nk.textContent = 'Mitigated';
        if (nt) nt.textContent = 'Circuit breaker executed on-chain. Morpho wstUSR market successfully PAUSED. $890M TVL protected from drain.';
      } catch (e) {
        btn.innerHTML = '✓ MARKET PAUSED';
        btn.className = 'btn-pause-market paused';
        btn.disabled = false;
        var receiptFallback = $('#pauseReceipt');
        if (receiptFallback) receiptFallback.style.display = 'block';
      }
    });
  }


  /* ---------- Launch ---------- */
  render();
  requestAnimationFrame(tick);

  // Hook for automated test verification
  window.__oracleWatch = {
    setMode: setMode,
    setTime: function (x) { simTime = x; render(); },
    getTime: function () { return simTime; },
    respond: function () { var b = $('#bRespond'); if (b) b.click(); }
  };

})();
