// ===== CRICKET TRUMPS - game logic =====

const $ = (sel) => document.querySelector(sel);
const CPU_NAMES = ["ROBO-BOWLER", "CPU-KING", "BYTE-BATTER", "PIXEL-PACER"];
const MAX_PLAYERS = 4;
const CARDS_EACH = 25;

// Cricket commentary shouted after each round (picked at random, never the same twice in a row)
const SHOUTS = ["HOWZAT!", "SIX!", "FOUR!", "BOWLED!", "CRACKING!", "WHAT A SHOT!", "SMASHED IT!",
                "OUT OF THE PARK!", "STUMPED!", "BRILLIANT!", "CAUGHT!", "WHAM!"];
let lastShout = "";

const setup = {
  players: [],      // { name, cpu }
  level: "easy",
};

let S = null;       // current game state
let sound = true;

// ---------- Sound (tiny retro bleeps with Web Audio) ----------
let audio;
function beep(freq, dur = 0.1, type = "square", when = 0, vol = 0.07) {
  if (!sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + when;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch (e) { /* audio not available */ }
}
const SFX = {
  click: () => beep(700, 0.05),
  flip:  () => { beep(300, 0.06, "triangle"); beep(600, 0.06, "triangle", 0.06); },
  good:  () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.14, "square", i * 0.1)),
  bad:   () => [392, 330, 262, 196].forEach((f, i) => beep(f, 0.18, "sawtooth", i * 0.13, 0.05)),
  tie:   () => [440, 440, 660].forEach((f, i) => beep(f, 0.1, "square", i * 0.14)),
  out:   () => [300, 200, 120].forEach((f, i) => beep(f, 0.22, "triangle", i * 0.18, 0.09)),
  fanfare: () => [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, "square", i * 0.13)),
};

// ---------- Helpers ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initials(name) {
  return name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("");
}
function fmt(card, key) {
  const v = card[key];
  return key === "avg" ? v.toFixed(2) : v.toLocaleString("en-US");
}
function statLabel(key) { return STATS.find((s) => s.key === key).label; }
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function randomShout() {
  let s;
  do { s = SHOUTS[Math.floor(Math.random() * SHOUTS.length)]; } while (s === lastShout);
  return (lastShout = s);
}

// ---------- Setup screen ----------
function presetMode(mode) {
  if (mode === "cpu") {
    setup.players = [{ name: "YOU", cpu: false }, { name: CPU_NAMES[0], cpu: true }];
  } else {
    setup.players = [{ name: "PLAYER 1", cpu: false }, { name: "PLAYER 2", cpu: false }];
  }
  document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("selected", b.dataset.mode === mode));
  renderPlayerList();
}

function renderPlayerList() {
  $("#playerList").innerHTML = setup.players.map((p, i) => `
    <div class="player-row">
      <span class="num">${i + 1}</span>
      <input maxlength="14" value="${escapeHTML(p.name)}" data-i="${i}">
      <button class="type-btn ${p.cpu ? "cpu" : ""}" data-i="${i}">${p.cpu ? "🤖 CPU" : "🙂 HUMAN"}</button>
      ${setup.players.length > 2 ? `<button class="remove-btn" data-i="${i}" title="Remove">✖</button>` : ""}
    </div>`).join("");
  $("#addPlayer").disabled = setup.players.length >= MAX_PLAYERS;
}

$("#playerList").addEventListener("input", (e) => {
  if (e.target.tagName === "INPUT") setup.players[e.target.dataset.i].name = e.target.value;
});
$("#playerList").addEventListener("click", (e) => {
  const i = +e.target.dataset.i;
  if (e.target.classList.contains("type-btn")) {
    const p = setup.players[i];
    p.cpu = !p.cpu;
    if (p.cpu && !CPU_NAMES.includes(p.name)) p.name = CPU_NAMES[i % CPU_NAMES.length];
    else if (!p.cpu && CPU_NAMES.includes(p.name)) p.name = "PLAYER " + (i + 1);
    SFX.click();
    renderPlayerList();
  } else if (e.target.classList.contains("remove-btn")) {
    setup.players.splice(i, 1);
    SFX.click();
    renderPlayerList();
  }
});
$("#addPlayer").addEventListener("click", () => {
  if (setup.players.length >= MAX_PLAYERS) return;
  const n = setup.players.length;
  const vsCpu = setup.players.filter((p) => !p.cpu).length === 1 && setup.players.some((p) => p.cpu);
  setup.players.push(vsCpu ? { name: CPU_NAMES[n % CPU_NAMES.length], cpu: true } : { name: "PLAYER " + (n + 1), cpu: false });
  SFX.click();
  renderPlayerList();
});
document.querySelectorAll(".mode-btn").forEach((b) =>
  b.addEventListener("click", () => { SFX.click(); presetMode(b.dataset.mode); })
);
$("#levelToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  $("#levelToggle").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
  SFX.click();
  setup.level = btn.dataset.val;
});

$("#soundBtn").addEventListener("click", () => {
  sound = !sound;
  $("#soundBtn").textContent = sound ? "🔊" : "🔇";
  SFX.click();
});

$("#startBtn").addEventListener("click", () => {
  if (!setup.players.some((p) => !p.cpu)) {
    alert("You need at least one HUMAN player! 🙂");
    return;
  }
  setup.players.forEach((p, i) => { p.name = (p.name || "").trim().toUpperCase() || "PLAYER " + (i + 1); });
  startGame();
});

// ---------- Game flow ----------
function startGame() {
  const n = setup.players.length;
  const deck = shuffle(CARDS).slice(0, CARDS_EACH * n);   // 25 random stars for each player
  const players = setup.players.map((p) => ({ name: p.name, cpu: p.cpu, deck: [] }));
  deck.forEach((card, i) => players[i % n].deck.push(card));

  S = {
    players,
    total: deck.length,
    pot: [],
    round: 0,
    outOrder: [],
    chooser: Math.floor(Math.random() * n),
    level: setup.level,
    phase: "idle",
  };
  SFX.fanfare();
  nextRound();
}

const alive = () => S.players.map((p, i) => i).filter((i) => S.players[i].deck.length > 0);
const aliveHumans = () => alive().filter((i) => !S.players[i].cpu);

// Whose card should be face-up while choosing?
function viewer() {
  const humans = aliveHumans();
  if (humans.length === 1) return humans[0];
  return S.players[S.chooser].cpu ? -1 : S.chooser;
}

function nextRound() {
  $("#nextBtn").classList.add("hidden");
  if (alive().length <= 1) return endGame();

  S.round++;
  S.phase = "choose";
  const chooser = S.players[S.chooser];

  if (!chooser.cpu && aliveHumans().length > 1) {
    $("#passName").textContent = chooser.name;
    show("pass");
  } else {
    show("game");
    beginChoose();
  }
}

$("#readyBtn").addEventListener("click", () => { SFX.click(); show("game"); beginChoose(); });

function beginChoose() {
  const chooser = S.players[S.chooser];
  updateHud();
  renderTable({ selectable: !chooser.cpu });
  if (chooser.cpu) {
    setMsg(`🤖 ${escapeHTML(chooser.name)} is thinking<span class="thinking"></span>`);
    const game = S, roundAtStart = S.round;
    setTimeout(() => {
      if (S === game && S.phase === "choose" && S.round === roundAtStart) choose(cpuPick(chooser.deck[0]));
    }, 1600);
  } else {
    setMsg(`${escapeHTML(chooser.name)}, tap your BEST stat! 👇`);
  }
}

// CPU brain: easy = random stat, hard = stat that beats the most cards in the pack
function cpuPick(card) {
  if (S.level === "easy") return STATS[Math.floor(Math.random() * STATS.length)].key;
  let best = null, bestScore = -1;
  for (const s of STATS) {
    const beats = CARDS.filter((c) => c[s.key] < card[s.key]).length;
    if (beats > bestScore) { bestScore = beats; best = s.key; }
  }
  return best;
}

function choose(key) {
  if (S.phase !== "choose") return;
  S.phase = "reveal";
  SFX.flip();

  const ids = alive();
  const played = ids.map((i) => ({ i, card: S.players[i].deck.shift() }));
  const best = Math.max(...played.map((p) => p.card[key]));
  const tops = played.filter((p) => p.card[key] === best);
  const cards = played.map((p) => p.card);
  const shown = Object.fromEntries(played.map((p) => [p.i, p.card]));
  const result = {};
  let sticker = {};
  let msg;

  if (tops.length === 1) {
    const t = tops[0];
    const gained = cards.length + S.pot.length;
    S.players[t.i].deck.push(...shuffle(cards), ...S.pot);
    S.pot = [];
    S.chooser = t.i;
    played.forEach((p) => (result[p.i] = p.i === t.i ? "top" : "low"));
    sticker[t.i] = `+${gained} cards`;
    msg = `<span class="shout">${randomShout()}</span>
           <span class="sub">${escapeHTML(t.card.name)}: ${fmt(t.card, key)} ${statLabel(key)} — the cards go to ${escapeHTML(S.players[t.i].name)} 🃏</span>`;
    setTimeout(S.players[t.i].cpu ? SFX.bad : SFX.good, 450);
    if (!S.players[t.i].cpu) setTimeout(() => confetti(25), 400);
  } else {
    S.pot.push(...cards);
    played.forEach((p) => (result[p.i] = p.card[key] === best ? "tie" : "low"));
    tops.forEach((t) => (sticker[t.i] = "TIE"));
    msg = `<span class="shout">TIE!</span>
           <span class="sub">${fmt(tops[0].card, key)} ${statLabel(key)} each — ${cards.length} cards go into the POT</span>`;
    setTimeout(SFX.tie, 450);
  }

  // Anyone who just ran out of cards is OUT
  const knocked = ids.filter((i) => S.players[i].deck.length === 0);
  if (knocked.length) {
    S.outOrder.push(...knocked);
    msg += `<span class="sub">❌ ${knocked.map((i) => escapeHTML(S.players[i].name)).join(" & ")} ${knocked.length > 1 ? "are" : "is"} OUT!</span>`;
    setTimeout(SFX.out, 1100);
  }
  if (S.players[S.chooser].deck.length === 0 && alive().length) S.chooser = alive()[0];

  renderTable({ shown, hl: key, result, sticker });
  updateHud();
  setMsg(msg, true);

  const btn = $("#nextBtn");
  btn.textContent = alive().length <= 1 ? "See the champion 🏆" : "Next round ▶";
  btn.classList.remove("hidden");
}

$("#nextBtn").addEventListener("click", () => { SFX.click(); nextRound(); });
$("#quitBtn").addEventListener("click", () => {
  if (confirm("Quit this game and go back to the menu?")) { S.phase = "idle"; show("setup"); }
});

// ---------- Rendering ----------
function updateHud() {
  $("#roundInfo").textContent = S.round;
  $("#potInfo").textContent = S.pot.length;
  $("#goalInfo").textContent = S.total;
}

function setMsg(html, pop = false) {
  const m = $("#message");
  m.innerHTML = html;
  m.classList.remove("pop");
  if (pop) { void m.offsetWidth; m.classList.add("pop"); }
}

// Player silhouettes drawn with thick round strokes (viewBox 0 0 100 120)
const L = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w * 1.4}" stroke-linecap="round"/>`;
const FIGURES = {
  BAT: `<circle cx="47" cy="22" r="11"/>${L(46,32,44,64,15)}${L(44,64,32,90,11)}${L(32,90,26,116,10)}
        ${L(44,64,58,90,11)}${L(58,90,68,116,10)}${L(46,38,60,48,7)}${L(60,48,70,38,7)}${L(70,38,86,6,6)}`,
  BOWL: `<circle cx="56" cy="24" r="11"/>${L(54,34,46,66,15)}${L(46,66,32,90,11)}${L(32,90,20,108,10)}
        ${L(46,66,62,88,11)}${L(62,88,66,118,10)}${L(55,38,70,20,7)}${L(70,20,74,4,7)}${L(52,40,36,46,7)}${L(36,46,26,58,7)}
        <circle cx="76" cy="2" r="5"/>`,
  WK: `<circle cx="50" cy="44" r="11"/>${L(50,54,50,78,17)}${L(50,78,30,88,11)}${L(30,88,28,116,10)}
       ${L(50,78,70,88,11)}${L(70,88,72,116,10)}${L(48,60,40,76,7)}${L(52,60,60,76,7)}
       <circle cx="38" cy="80" r="7"/><circle cx="62" cy="80" r="7"/>`,
  AR: `<circle cx="50" cy="26" r="11"/>${L(50,36,50,68,15)}${L(50,68,38,92,11)}${L(38,92,36,118,10)}
       ${L(50,68,62,92,11)}${L(62,92,64,118,10)}${L(52,42,66,30,7)}${L(66,30,72,14,7)}${L(72,14,80,-14,6)}
       ${L(48,42,34,30,7)}${L(34,30,28,14,7)}`,
};

const playerPhotoRequests = new Map();

function getPlayerPhoto(name) {
  if (playerPhotoRequests.has(name)) return playerPhotoRequests.get(name);

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    titles: `${name}|${name} (cricketer)`,
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
  });
  const request = fetch(`https://en.wikipedia.org/w/api.php?${params}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const source = data.query?.pages?.find((page) => page.thumbnail?.source)?.thumbnail?.source;
      if (!source) throw new Error(`No portrait found for ${name}`);
      const url = new URL(source);
      const trustedHosts = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
      if (url.protocol !== "https:" || !trustedHosts.has(url.hostname)) {
        throw new Error(`Unexpected portrait source for ${name}`);
      }
      return url.href;
    });

  playerPhotoRequests.set(name, request);
  return request;
}

function loadPlayerPhotos(root) {
  root.querySelectorAll(".player-photo[data-player]").forEach((image) => {
    getPlayerPhoto(image.dataset.player)
      .then((source) => {
        if (!image.isConnected) return;
        image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
        image.src = source;
      })
      .catch((error) => {
        console.warn(error.message);
        image.remove();
      });
  });
}

function cardBackHTML() {
  return `<div class="face back">
      <div class="emblem"><div><div class="ball">🏏</div><div class="word">CRICKET<br>TRUMPS</div></div></div>
      <div class="tagline">WORLD STARS EDITION</div>
      <div class="glare"></div>
    </div>`;
}

// state: "up" (face up), "down" (face down) or "reveal" (flip from back to front)
function cardHTML(card, o = {}) {
  const state = o.state || "up";
  if (!card) {
    return `<div class="card3d"><div class="flipper down">${cardBackHTML()}</div></div>`;
  }
  const t = TEAMS[card.team];
  const words = card.name.split(" ");
  const last = words.length > 1 ? words.slice(1).join(" ") : words[0];
  const first = words.length > 1 ? words[0] : "";
  const cls = ["card3d", card.legend ? "legend" : "", o.result || ""].join(" ");
  return `
    <div class="${cls}" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="flipper ${state === "reveal" ? "reveal" : ""}">
        <div class="face front">
          <div class="frame">
            <div class="art">
              <div class="watermark">${initials(card.name)}</div>
              <svg class="figure" viewBox="0 -20 100 140">${FIGURES[card.role]}</svg>
              <img class="player-photo" data-player="${escapeHTML(card.name)}" alt="${escapeHTML(card.name)}" loading="eager">
              <div class="team-chip"><span class="code">${card.team}</span><span class="stripe"></span><span class="role-ic">${ROLES[card.role].split(" ")[0]}</span></div>
              ${card.legend ? `<div class="legend-seal">★ LEGEND</div>` : ""}
            </div>
            <div class="plate">
              <div class="first">${escapeHTML(first) || "&nbsp;"}</div>
              <div class="last">${escapeHTML(last)}</div>
              <div class="meta">${t.name} • ${ROLES[card.role].split(" ").slice(1).join(" ")}</div>
            </div>
            <ul class="stats">
              ${STATS.map((s) => `
                <li class="stat ${o.selectable ? "pick" : ""} ${o.hl === s.key ? "hl" : ""}" data-stat="${s.key}">
                  <span class="lbl">${s.icon} ${s.label}</span><b>${fmt(card, s.key)}</b>
                </li>`).join("")}
            </ul>
            <div class="card-foot"><span>ODI Career</span><span>No. ${String(card.id + 1).padStart(3, "0")}</span></div>
          </div>
          ${card.legend ? `<div class="holo"></div>` : ""}
          <div class="glare"></div>
        </div>
        ${cardBackHTML()}
      </div>
    </div>`;
}

// 3D tilt + moving light glare when the mouse moves over a card
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest && e.target.closest(".card3d");
  document.querySelectorAll(".card3d.tilting").forEach((c) => {
    if (c !== card) { c.classList.remove("tilting"); c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); c.style.setProperty("--mx", "50%"); c.style.setProperty("--my", "30%"); }
  });
  if (!card || card.querySelector(".flipper.down")) return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  card.classList.add("tilting");
  card.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
  card.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
  card.style.setProperty("--mx", `${x * 100}%`);
  card.style.setProperty("--my", `${y * 100}%`);
});

function renderTable({ shown = null, hl = null, result = {}, sticker = {}, selectable = false } = {}) {
  const v = viewer();
  $("#table").innerHTML = S.players.map((p, i) => {
    const isOut = p.deck.length === 0 && !(shown && shown[i]);
    const pct = Math.round((p.deck.length / S.total) * 100);
    const head = `
      <div class="slot-head">
        <span class="pname">${p.cpu ? "🤖" : "🙂"} ${escapeHTML(p.name)}</span>
        <span class="count">🃏 ${p.deck.length} / ${S.total}</span>
        <div class="bar"><i style="width:${pct}%"></i></div>
        ${i === S.chooser && !shown ? `<span class="picking">👑 PICKING</span>` : ""}
      </div>`;
    if (isOut) return `<div class="slot out">${head}<div class="out-card">OUT!</div></div>`;

    let body;
    if (shown) {
      body = cardHTML(shown[i], { state: "reveal", hl, result: result[i] });
      if (sticker[i]) body += `<div class="sticker ${sticker[i] === "TIE" ? "tie" : ""}">${sticker[i]}</div>`;
    } else {
      const faceUp = i === v;
      body = cardHTML(faceUp ? p.deck[0] : null, { selectable: selectable && i === S.chooser && faceUp });
    }
    return `<div class="slot ${i === S.chooser && !shown ? "chooser" : ""}">${head}${body}</div>`;
  }).join("");
  loadPlayerPhotos($("#table"));
}

$("#table").addEventListener("click", (e) => {
  const li = e.target.closest(".stat.pick");
  if (li && S && S.phase === "choose" && !S.players[S.chooser].cpu) choose(li.dataset.stat);
});

// ---------- End of game ----------
function endGame() {
  S.phase = "over";
  const champIdx = alive()[0];
  const champ = S.players[champIdx];
  // Champion first, then everyone else in reverse order of being knocked out
  const ranking = [champIdx, ...S.outOrder.slice().reverse()];

  $("#winnerText").textContent = `${champ.name} 🏆`;
  const medals = ["🥇", "🥈", "🥉", "🎗️"];
  $("#scoreList").innerHTML = ranking.map((i, r) => {
    const p = S.players[i];
    return `<li>${medals[r]} ${escapeHTML(p.name)} — ${i === champIdx ? `collected all ${S.total} cards!` : "out"}</li>`;
  }).join("") + `<li>🏏 Game lasted ${S.round} rounds</li>`;

  show("over");
  if (!champ.cpu) { SFX.fanfare(); confetti(120); } else SFX.bad();
}

$("#againBtn").addEventListener("click", () => { SFX.click(); startGame(); });
$("#menuBtn").addEventListener("click", () => { SFX.click(); show("setup"); });

function confetti(n) {
  const colors = ["#ff3d7f", "#ff9a3d", "#ffe066", "#22d3ee", "#a35cff", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.5 + Math.random() * 2 + "s";
    c.style.animationDelay = Math.random() * 0.5 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

// Default: vs computer
presetMode("cpu");
