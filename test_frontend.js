const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, 'templates', 'index.html'), 'utf-8');
const jsContent = fs.readFileSync(path.join(__dirname, 'static', 'app.js'), 'utf-8');

// Lightweight DOM emulator
const domElements = {};

function makeElement(tag, id, classes) {
  const el = {
    tagName: tag.toUpperCase(),
    id: id || '',
    className: classes || '',
    classList: {
      contains: (c) => el.className.split(/\s+/).includes(c),
      add: (c) => { if (!el.classList.contains(c)) el.className = (el.className + ' ' + c).trim(); },
      remove: (c) => { el.className = el.className.split(/\s+/).filter(x => x !== c).join(' '); },
      toggle: (c, force) => {
        const has = el.classList.contains(c);
        const shouldHave = force !== undefined ? force : !has;
        if (shouldHave) el.classList.add(c); else el.classList.remove(c);
      }
    },
    textContent: '',
    innerHTML: '',
    style: {},
    attributes: {},
    setAttribute: (k, v) => { el.attributes[k] = String(v); },
    getAttribute: (k) => el.attributes[k] || null,
    listeners: {},
    addEventListener: (ev, fn) => {
      el.listeners[ev] = el.listeners[ev] || [];
      el.listeners[ev].push(fn);
    },
    click: () => {
      if (el.disabled) return;
      (el.listeners['click'] || []).forEach(fn => fn.call(el, { target: el }));
    },
    scrollIntoView: () => {},
    appendChild: (child) => { el.children = el.children || []; el.children.push(child); }
  };
  return el;
}

// Extract all IDs from HTML
const idMatches = htmlContent.match(/id="([^"]+)"/g) || [];
idMatches.forEach(m => {
  const id = m.replace('id="', '').replace('"', '');
  domElements['#' + id] = makeElement('div', id);
});

// Setup mock document & window
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.window = {
  scrollTo: () => {},
  addEventListener: () => {},
  requestAnimationFrame: (cb) => setTimeout(cb, 16)
};
global.document = {
  documentElement: makeElement('html', 'html'),
  body: makeElement('body', 'body'),
  querySelector: (sel) => domElements[sel] || makeElement('div'),
  querySelectorAll: (sel) => {
    if (sel === '.due') return [makeElement('span', 'due1', 'due'), makeElement('span', 'due2', 'due'), makeElement('span', 'due3', 'due')];
    if (sel === '[data-t]') return [];
    if (sel === '.edge') return [];
    if (sel === '.node') return [];
    if (sel === '#stages .btn') return [];
    return [];
  },
  createElement: (tag) => makeElement(tag),
  addEventListener: () => {}
};

// Execute app.js in sandbox
eval(jsContent);

const api = global.window.__oracleWatch;
if (!api) {
  console.error("FAIL: __oracleWatch hook not exposed");
  process.exit(1);
}

let passed = 0;
let total = 0;
function test(name, cond, info) {
  total++;
  if (cond) {
    passed++;
    console.log(`[PASS] ${name} ${info || ''}`);
  } else {
    console.error(`[FAIL] ${name} ${info || ''}`);
  }
}

// 1. Initial State (t = 0)
api.setTime(0);
test("Initial clock is --:--", domElements['#clock'].textContent === '--:--');
test("Initial Exploit window badge is Idle", domElements['#b-win'].textContent === 'Idle');
test("Initial Price window closes in is --:--", domElements['#p-win'].textContent === '--:--');
test("Simulate response button is disabled at t=0", domElements['#bRespond'].disabled === true);

// 2. Alert Triggered at t = 10 (3 minutes in)
api.setTime(10);
test("Clock runs near 57:00 at t=10", domElements['#clock'].textContent === '57:00', `clock: ${domElements['#clock'].textContent}`);
test("Exploit window badge is Open at t=10", domElements['#b-win'].textContent === 'Open');
test("Detection latency is 3 min", domElements['#w-det'].textContent === '3 min', `w-det: ${domElements['#w-det'].textContent}`);
test("Lead time gained is 57 min", domElements['#w-lead'].textContent === '57 min', `w-lead: ${domElements['#w-lead'].textContent}`);
test("Bottom bar shows countdown at t=10", domElements['#nar-clock'].textContent === 'Impact in 57:00');

// 3. Price Stage at t = 20
api.setTime(20);
test("Price window closes in shows mm:ss at t=20", domElements['#p-win'].textContent === '47:00', `p-win: ${domElements['#p-win'].textContent}`);

// 4. Map Stage at t = 33
api.setTime(33);
test("Map ETA note shows impact ETA at t=33", domElements['#m-eta'].textContent.includes('34:00'), `m-eta: ${domElements['#m-eta'].textContent}`);

// 5. Alert Stage at t = 47 (when ease-in is complete)
api.setTime(47);
test("Score includes Time Pressure (85/100)", parseInt(domElements['#score'].textContent) >= 84, `score: ${domElements['#score'].textContent}`);
test("Simulate response button is enabled at t=47", domElements['#bRespond'].disabled === false);
test("Action items show act within mm:ss", domElements['#a-win'].textContent.includes('Response window: 20:00 left'));

// 6. Simulate Response Execution at t = 46
api.setTime(46);
api.respond();
test("Clock freezes after response executed", domElements['#clock'].textContent === '21:00', `clock: ${domElements['#clock'].textContent}`);
test("Pill shows CONTAINED", domElements['#pill'].textContent === 'CONTAINED');
test("Attacker net profit struck through as prevented", domElements['#p-net'].className === 'prevented');
test("Value protected message shown", domElements['#a-prot'].style.display !== 'none' && domElements['#a-prot'].textContent.includes('$1.80M'));
test("Exploit window badge is Contained", domElements['#b-win'].textContent === 'Contained');
test("Simulate response button is disabled once executed", domElements['#bRespond'].disabled === true);

// 7. Scrubbing back before containment resets it
api.setTime(10);
test("Scrubbing back resets containment", domElements['#pill'].textContent === 'STANDBY');

// 8. Test Morpho Mode
api.setMode('morpho');
test("Morpho mode clock shows 00:12", domElements['#clock'].textContent === '00:12');
test("Morpho mode badge is Critical", domElements['#b-win'].textContent === 'Critical');
test("Morpho mode score is 94", domElements['#score'].textContent === '94');

console.log("=".repeat(50));
console.log(`FRONTEND UNIT TEST RESULTS: ${passed}/${total} PASSED`);
console.log("=".repeat(50));
process.exit(passed === total ? 0 : 1);
