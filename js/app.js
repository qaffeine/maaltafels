// UI: screens, game flow and input handling.
(function () {
  'use strict';

  const L = window.Logic;
  const AVATARS = ['🐵', '🐼', '🐨', '🐯', '🦄', '🐶', '🐱', '🐻', '🐹', '🦉', '🐬', '🦖'];
  const MODES = {
    oefenen: { title: 'Oefenen', icon: '🎯', desc: '10 sommen, zonder tijd', picker: true },
    tijdrace: { title: 'Tijdrace', icon: '⏱️', desc: 'Zoveel mogelijk in 60 seconden', picker: true },
    slim: { title: 'Slim oefenen', icon: '🧠', desc: 'Oefen wat je nog moeilijk vindt', picker: false },
    toets: { title: 'Toets', icon: '📝', desc: '20 sommen, uitslag op het einde', picker: true }
  };
  const ROUND_SIZE = { oefenen: 10, slim: 20, toets: 20 };
  const RACE_MS = 60000;
  const LEVEL_NAMES = ['Nog niet geoefend', 'Net begonnen', 'Gaat soms goed', 'Gaat meestal goed', 'Goed gekend', 'Automatisch'];
  const DAY_NAMES = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  const app = document.getElementById('app');
  let data = Store.load();
  let game = null;
  let pickerMode = null;
  let pickerSel = [];
  let holdTimer = null;

  // ---------- helpers ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function profile() {
    return data.profiles.find((p) => p.id === data.currentId) || null;
  }

  function persist() {
    Store.save(data);
  }

  // The world of the current player (zoo or city).
  function theme() {
    const p = profile();
    return Themes.get(p && p.theme);
  }

  function item(t) {
    return theme().items[t];
  }

  function render(html) {
    const th = theme();
    document.body.dataset.theme = th.id;
    document.title = th.title;
    app.innerHTML = html;
    const f = app.querySelector('[autofocus]');
    if (f) f.focus();
    window.scrollTo(0, 0);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function starsText(n) {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  function formatDuration(sec) {
    sec = Math.round(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? `${m} min ${s} s` : `${s} s`;
  }

  function fmtSeconds(ms) {
    return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  }

  function streakCount(p) {
    if (!p.streak) return 0;
    const today = new Date();
    const y = new Date(); y.setDate(y.getDate() - 1);
    return (p.streak.last === L.dateKey(today) || p.streak.last === L.dateKey(y)) ? p.streak.count : 0;
  }

  function topbar(p, title) {
    if (title) {
      return `<header class="topbar">
        <button class="btn ghost" data-action="home">‹ ${theme().backLabel}</button>
        <h1 class="topbar-title">${esc(title)}</h1>
      </header>`;
    }
    const streak = streakCount(p);
    return `<header class="topbar">
      <button class="who" data-action="profiles" aria-label="Andere speler kiezen">
        <span class="avatar" aria-hidden="true">${p.avatar}</span><span>${esc(p.name)}</span>
      </button>
      <div class="topbar-right">
        ${streak ? `<span class="streak" title="${streak} dagen na elkaar gespeeld">🔥 ${streak} ${streak === 1 ? 'dag' : 'dagen'}</span>` : ''}
        <button class="icon-btn" data-action="toggle-sound" aria-pressed="${p.settings.sound}" aria-label="Geluid ${p.settings.sound ? 'uit' : 'aan'}zetten">${p.settings.sound ? '🔊' : '🔇'}</button>
      </div>
    </header>`;
  }

  // ---------- profiles ----------

  function showProfiles() {
    game = null;
    if (!data.profiles.length) return showProfileForm(null);
    render(`<section class="screen profiles">
      <div class="brand"><span class="mascot" aria-hidden="true">${theme().mascot}</span><h1>Maaltafels</h1></div>
      <p class="bubble">Hoi! Wie gaat er spelen?</p>
      <ul class="profile-list">
        ${data.profiles.map((p) => `<li>
          <button class="profile-card" data-action="pick-profile" data-id="${p.id}">
            <span class="avatar" aria-hidden="true">${p.avatar}</span><span class="profile-name">${esc(p.name)}</span>
          </button>
          <button class="icon-btn" data-action="edit-profile" data-id="${p.id}" aria-label="${esc(p.name)} wijzigen">✏️</button>
        </li>`).join('')}
      </ul>
      <button class="btn secondary" data-action="new-profile">+ Nieuwe speler</button>
    </section>`);
  }

  function showProfileForm(id) {
    const p = id ? data.profiles.find((x) => x.id === id) : null;
    const chosen = p ? p.avatar : AVATARS[data.profiles.length % AVATARS.length];
    render(`<section class="screen profiles">
      <div class="brand"><span class="mascot" aria-hidden="true">${theme().mascot}</span><h1>${p ? 'Speler wijzigen' : 'Nieuwe speler'}</h1></div>
      <form class="card form" data-form="profile" data-id="${p ? p.id : ''}">
        <label class="field">Hoe heet je?
          <input name="name" maxlength="20" required autocomplete="off" value="${p ? esc(p.name) : ''}" autofocus>
        </label>
        <fieldset class="avatars">
          <legend>Kies je dier</legend>
          ${AVATARS.map((a) => `<label class="avatar-opt">
            <input type="radio" name="avatar" value="${a}" ${a === chosen ? 'checked' : ''}><span>${a}</span>
          </label>`).join('')}
        </fieldset>
        <fieldset class="themes">
          <legend>Kies je wereld</legend>
          ${Themes.list.map((th) => `<label class="theme-opt">
            <input type="radio" name="theme" value="${th.id}" ${(p ? Themes.get(p.theme).id : 'zoo') === th.id ? 'checked' : ''}>
            <span><span class="theme-icon" aria-hidden="true">${th.icon}</span>${th.label}
              <span class="theme-preview" aria-hidden="true">${[2, 5, 7].map((t) => th.items[t].emoji).join('')}</span></span>
          </label>`).join('')}
        </fieldset>
        <div class="row">
          <button class="btn primary" type="submit">${p ? 'Bewaren' : 'Speler maken'}</button>
          ${data.profiles.length ? '<button class="btn ghost" type="button" data-action="profiles">Annuleren</button>' : ''}
        </div>
        ${p ? `<button class="btn danger-link" type="button" data-action="ask-delete" data-id="${p.id}">Speler verwijderen</button>` : ''}
      </form>
    </section>`);
  }

  function showDeleteConfirm(id) {
    const p = data.profiles.find((x) => x.id === id);
    render(`<section class="screen profiles">
      <div class="card confirm">
        <p class="avatar big" aria-hidden="true">${p.avatar}</p>
        <h1>${esc(p.name)} verwijderen?</h1>
        <p>Alle sterren en resultaten van ${esc(p.name)} verdwijnen. Dit kan je niet ongedaan maken.</p>
        <div class="row">
          <button class="btn ghost" data-action="edit-profile" data-id="${p.id}" autofocus>Nee, houden</button>
          <button class="btn danger" data-action="delete-profile" data-id="${p.id}">Ja, verwijderen</button>
        </div>
      </div>
    </section>`);
  }

  function saveProfileForm(form) {
    const name = form.elements.name.value.trim();
    const avatar = form.elements.avatar.value || AVATARS[0];
    const themeId = form.elements.theme.value || 'zoo';
    if (!name) { form.elements.name.focus(); return; }
    let p = data.profiles.find((x) => x.id === form.dataset.id);
    if (p) {
      p.name = name;
      p.avatar = avatar;
      p.theme = themeId;
    } else {
      p = Store.newProfile(name, avatar, themeId);
      data.profiles.push(p);
    }
    data.currentId = p.id;
    persist();
    showHome();
  }

  // ---------- home (zoo or city) ----------

  function guideMessage(p) {
    const th = theme();
    if (!p.rounds) return th.welcome(esc(p.name));
    const allThree = L.TABLES.every((t) => (p.stars[t] || 0) === 3);
    if (allThree) return th.allDone;
    return pick([
      'Tip: met <b>Slim oefenen</b> oefen je de sommen die je nog moeilijk vindt.',
      th.helpTip(esc(p.name)),
      th.tapTip,
      'Elke dag een beetje oefenen maakt je supersnel!'
    ]);
  }

  function showHome() {
    const p = profile();
    if (!p) return showProfiles();
    game = null;
    Sound.enabled = p.settings.sound;
    render(`<section class="screen home">
      ${topbar(p)}
      <div class="guide"><span class="mascot" aria-hidden="true">${theme().mascot}</span><p class="bubble">${guideMessage(p)}</p></div>

      <div class="modes">
        ${Object.keys(MODES).map((m) => `<button class="mode mode-${m}" data-action="mode" data-mode="${m}">
          <span class="mode-icon" aria-hidden="true">${MODES[m].icon}</span>
          <span class="mode-title">${MODES[m].title}</span>
          <span class="mode-desc">${MODES[m].desc}</span>
        </button>`).join('')}
      </div>

      <h2 class="section-title">${theme().worldTitle}</h2>
      <ul class="zoo">
        ${L.TABLES.map((t) => {
          const s = p.stars[t] || 0;
          const extra = theme().badge(t, s);
          return `<li><button class="pen stars-${s}" data-action="quick" data-table="${t}" aria-label="Tafel van ${t}, ${item(t).name}, ${s} van 3 sterren. Oefenen.">
            <span class="pen-animal" aria-hidden="true">${item(t).emoji}</span>
            ${extra ? `<span class="pen-extra" aria-hidden="true">${extra}</span>` : ''}
            <span class="pen-name">Tafel van ${t}</span>
            <span class="pen-stars" aria-hidden="true">${starsText(s)}</span>
          </button></li>`;
        }).join('')}
      </ul>

      <div class="home-footer">
        <label class="switch">
          <input type="checkbox" data-action="toggle-mc" ${p.settings.mc ? 'checked' : ''}>
          <span>Kiezen uit 4 antwoorden</span>
        </label>
        <button class="hold-btn" data-hold="parent" aria-label="Voor ouders: houd 3 seconden ingedrukt">
          <span class="hold-fill" aria-hidden="true"></span>
          <span class="hold-label">Voor ouders · houd 3 tellen vast</span>
        </button>
      </div>
    </section>`);
  }

  // ---------- table picker ----------

  function showPicker(mode, preset) {
    const p = profile();
    pickerMode = mode;
    pickerSel = L.normalizeTables(preset || p.lastSelection || [2]);
    renderPicker();
  }

  function renderPicker() {
    const m = MODES[pickerMode];
    const sel = pickerSel;
    const same = (g) => L.GROUPS[g].length === sel.length && L.GROUPS[g].every((t) => sel.includes(t));
    render(`<section class="screen picker-screen">
      ${topbar(profile(), m.title)}
      <div class="guide"><span class="mascot" aria-hidden="true">${theme().mascot}</span>
        <p class="bubble">Welke tafels wil je doen? Kies er één, een paar of allemaal. De sommen worden gemengd.</p></div>
      <div class="groups" role="group" aria-label="Snel kiezen">
        <button class="chip" data-action="group" data-group="alles" aria-pressed="${same('alles')}">Alles</button>
        <button class="chip" data-action="group" data-group="makkelijk" aria-pressed="${same('makkelijk')}">Makkelijk (1, 2, 5, 10)</button>
        <button class="chip" data-action="group" data-group="moeilijk" aria-pressed="${same('moeilijk')}">Moeilijk (6, 7, 8, 9)</button>
      </div>
      <div class="picker" role="group" aria-label="Tafels">
        ${L.TABLES.map((t) => `<button class="pick" data-action="toggle-table" data-table="${t}" aria-pressed="${sel.includes(t)}">
          <span class="pick-animal" aria-hidden="true">${item(t).emoji}</span>
          <span class="pick-num">${t}</span>
          <span class="pick-check" aria-hidden="true">${sel.includes(t) ? '✓' : ''}</span>
        </button>`).join('')}
      </div>
      <p class="sel-summary">${sel.length ? (sel.length === 10 ? 'Gekozen: alle tafels' : `Gekozen: tafel${sel.length > 1 ? 's' : ''} van ${sel.join(', ')}`) : 'Kies minstens één tafel.'}</p>
      <button class="btn primary big" data-action="start" ${sel.length ? '' : 'disabled'}>Start</button>
    </section>`);
  }

  // ---------- game ----------

  function startGame(mode, tables) {
    const p = profile();
    tables = L.normalizeTables(tables);
    if (MODES[mode].picker) {
      p.lastSelection = tables;
      persist();
    }
    game = {
      mode, tables,
      queue: [],
      idx: 0,
      input: '',
      locked: false,
      answers: [],
      score: 0,
      startedAt: Date.now(),
      timers: []
    };
    if (mode === 'tijdrace') {
      game.endsAt = Date.now() + RACE_MS;
      game.queue.push({ q: L.nextQuestion(tables, null) });
      game.timers.push(setTimeout(finishGame, RACE_MS));
      game.tick = setInterval(updateTimer, 200);
    } else {
      const qs = mode === 'slim' ? L.smartRound(p.stats, ROUND_SIZE.slim) : L.buildRound(tables, ROUND_SIZE[mode]);
      game.queue = qs.map((q) => ({ q, retry: false }));
    }
    showQuestion();
  }

  function current() {
    return game.queue[game.idx].q;
  }

  function progressHtml() {
    if (game.mode === 'tijdrace') {
      const left = Math.max(0, Math.ceil((game.endsAt - Date.now()) / 1000));
      return `<div class="race-info">
        <span class="timer" id="timer" aria-label="${left} seconden over">⏱ <b>${left}</b></span>
        <span class="race-score">✓ <b id="race-score">${game.score}</b></span>
      </div>`;
    }
    const total = game.queue.length;
    const pct = Math.round((game.idx / total) * 100);
    return `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${game.idx}" aria-label="Vraag ${game.idx + 1} van ${total}">
      <span class="progress-fill" style="width:${pct}%"></span>
    </div>
    <span class="progress-text">${game.idx + 1}/${total}</span>`;
  }

  function showQuestion() {
    const p = profile();
    const q = current();
    game.input = '';
    game.locked = false;
    game.qStart = Date.now();
    const animal = item(q.table);
    const inputHtml = p.settings.mc
      ? `<div class="choices">${L.multipleChoice(q).map((o) => `<button class="choice" data-action="choose" data-value="${o}">${o}</button>`).join('')}</div>`
      : `<div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-action="digit" data-digit="${d}">${d}</button>`).join('')}
          <button class="key key-erase" data-action="erase" aria-label="Wissen">⌫</button>
          <button class="key" data-action="digit" data-digit="0">0</button>
          <button class="key key-ok" data-action="ok">OK</button>
        </div>`;

    render(`<section class="screen game mode-${game.mode}">
      <header class="game-top">
        <button class="icon-btn" data-action="quit" aria-label="Stoppen en terug naar de ${theme().world}">✕</button>
        ${progressHtml()}
      </header>
      <div class="stage">
        <div class="sign-wrap">
          <span class="sign-animal" aria-hidden="true">${animal.emoji}</span>
          <div class="sign" id="sign">
            <span class="sign-q"><span aria-hidden="true">${q.a} × ${q.b} =</span><span class="sr-only">Hoeveel is ${q.a} maal ${q.b}?</span></span>
            <span class="sign-ans" id="ans" aria-live="polite">?</span>
          </div>
        </div>
        <p class="feedback" id="feedback" role="status"></p>
      </div>
      <div class="input-area">${inputHtml}</div>
    </section>`);
  }

  function updateTimer() {
    if (!game || game.mode !== 'tijdrace') return;
    const el = document.getElementById('timer');
    if (!el) return;
    const left = Math.max(0, Math.ceil((game.endsAt - Date.now()) / 1000));
    el.querySelector('b').textContent = left;
    el.setAttribute('aria-label', `${left} seconden over`);
    el.classList.toggle('low', left <= 10);
  }

  function updateAnswerDisplay() {
    const el = document.getElementById('ans');
    if (el) {
      el.textContent = game.input || '?';
      el.classList.toggle('filled', !!game.input);
    }
  }

  function typeDigit(d) {
    if (!game || game.locked || game.input.length >= 3) return;
    game.input = (game.input === '0' ? '' : game.input) + d;
    updateAnswerDisplay();
  }

  function erase() {
    if (!game || game.locked) return;
    game.input = game.input.slice(0, -1);
    updateAnswerDisplay();
  }

  function submitAnswer(value) {
    if (!game || game.locked || value === '' || value == null) return;
    const p = profile();
    const q = current();
    const given = Number(value);
    const ms = Date.now() - game.qStart;
    const correct = given === q.answer;
    const item = game.queue[game.idx];
    game.locked = true;

    p.stats[q.key] = L.updateFact(p.stats[q.key], correct, ms);
    game.answers.push({ q, given, correct, ms, retry: !!item.retry });
    if (correct && !item.retry) game.score++;
    persist();

    // Test: no feedback until the end.
    if (game.mode === 'toets') {
      Sound.play('tap');
      game.timers.push(setTimeout(nextQuestion, 150));
      return;
    }

    game.input = String(given);
    updateAnswerDisplay();
    const sign = document.getElementById('sign');
    const fb = document.getElementById('feedback');
    const race = game.mode === 'tijdrace';
    highlightChoice(given, q.answer);

    if (correct) {
      Sound.play('correct');
      sign.classList.add('is-correct');
      fb.innerHTML = `<span class="fb-icon ok" aria-hidden="true">✓</span> ${pick(['Goed zo!', 'Super!', 'Knap!', 'Top!', 'Juist!'])}`;
      const rs = document.getElementById('race-score');
      if (rs) rs.textContent = game.score;
      game.timers.push(setTimeout(nextQuestion, race ? 350 : 700));
    } else {
      Sound.play('wrong');
      sign.classList.add('is-wrong');
      fb.innerHTML = `<span class="fb-icon miss" aria-hidden="true">✗</span> Bijna! <b>${q.a} × ${q.b} = ${q.answer}</b>`;
      if (game.mode === 'oefenen' || game.mode === 'slim') {
        // The same question comes back later in the round.
        const at = Math.min(game.idx + 3, game.queue.length);
        game.queue.splice(at, 0, { q, retry: true });
      }
      game.timers.push(setTimeout(nextQuestion, race ? 1500 : 2000));
    }
  }

  function highlightChoice(given, answer) {
    app.querySelectorAll('.choice').forEach((b) => {
      const v = Number(b.dataset.value);
      b.disabled = true;
      if (v === answer) b.classList.add('is-answer');
      else if (v === given) b.classList.add('is-given');
    });
  }

  function nextQuestion() {
    if (!game) return;
    if (game.mode === 'tijdrace') {
      if (Date.now() >= game.endsAt) return finishGame();
      game.queue.push({ q: L.nextQuestion(game.tables, current().key) });
      game.idx++;
      return showQuestion();
    }
    game.idx++;
    if (game.idx >= game.queue.length) return finishGame();
    showQuestion();
  }

  function stopTimers() {
    if (!game) return;
    game.timers.forEach(clearTimeout);
    game.timers = [];
    if (game.tick) clearInterval(game.tick);
  }

  function quitGame() {
    stopTimers();
    game = null;
    showHome();
  }

  function finishGame() {
    if (!game || game.finished) return;
    stopTimers();
    game.finished = true;
    const p = profile();
    const now = new Date();
    const today = L.dateKey(now);

    // Practice time: sum of answer times, capped so a paused game doesn't count.
    const secs = game.answers.reduce((s, a) => s + Math.min(a.ms, 20000), 0) / 1000;
    p.daily[today] = (p.daily[today] || 0) + secs;
    p.streak = L.updateStreak(p.streak, now);
    p.rounds = (p.rounds || 0) + 1;
    p.totalCorrect = (p.totalCorrect || 0) + game.answers.filter((a) => a.correct).length;

    const total = game.mode === 'tijdrace' ? game.answers.length : ROUND_SIZE[game.mode];
    const result = { mode: game.mode, tables: game.tables, score: game.score, total, secs, newStars: [], record: null, passed: false };

    if (game.mode === 'toets' && game.tables.length === 1 && game.score >= 18) {
      result.passed = true;
      p.testPassed[game.tables[0]] = true;
    }

    p.played = p.played || {};
    game.answers.forEach((a) => { p.played[a.q.table] = true; });

    // Stars never go down (R-5).
    L.TABLES.forEach((t) => {
      const s = L.computeStars(p.stats, t, p.testPassed[t], !!p.played[t]);
      if (s > (p.stars[t] || 0)) {
        p.stars[t] = s;
        result.newStars.push({ t, s });
      }
    });

    if (game.mode === 'tijdrace') {
      const label = L.selectionLabel(game.tables);
      const prev = p.records[label] || 0;
      result.recordLabel = label;
      result.best = Math.max(prev, game.score);
      if (game.score > prev && game.score > 0) {
        p.records[label] = game.score;
        result.record = { prev };
      }
    }

    // A passed test already announces the finished table; don't repeat it.
    if (result.passed) result.newStars = result.newStars.filter((n) => n.t !== game.tables[0]);

    result.mistakes = game.answers.filter((a) => !a.correct);
    persist();
    showResults(result);
  }

  // ---------- results ----------

  function showResults(r) {
    const ratio = r.total ? r.score / r.total : 0;
    let msg;
    if (r.mode === 'tijdrace') msg = r.record ? 'Nieuw record! Wat ben jij snel!' : 'Goed gerend! Probeer je record te breken.';
    else if (ratio === 1) msg = 'Alles juist! Fantastisch!';
    else if (ratio >= 0.8) msg = 'Heel goed gedaan!';
    else if (ratio >= 0.5) msg = 'Goed bezig! Nog wat oefenen en je kent ze.';
    else msg = 'Goed dat je oefent! Elke keer word je beter.';

    if (r.newStars.length || r.record || r.passed) Sound.play('reward');

    const selLabel = r.tables.length === 10 ? 'alle tafels' : `tafel${r.tables.length > 1 ? 's' : ''} van ${r.tables.join(', ')}`;
    const scoreLine = r.mode === 'tijdrace'
      ? `<p class="big-score"><b>${r.score}</b> goed in 60 seconden</p>
         <p class="sub">${r.record ? (r.record.prev ? `Vorig record: ${r.record.prev}` : 'Je eerste record!') : `Jouw record: ${r.best}`} · ${esc(selLabel)}</p>`
      : `<p class="big-score"><b>${r.score}</b> van ${r.total} goed</p>
         <p class="sub">Tijd: ${formatDuration(r.secs)}${r.mode !== 'slim' ? ' · ' + esc(selLabel) : ''}</p>`;

    render(`<section class="screen results">
      <div class="guide"><span class="mascot cheer" aria-hidden="true">${theme().mascot}</span><p class="bubble">${msg}</p></div>
      <div class="card result-card">
        <h1>Klaar!</h1>
        ${scoreLine}
        ${r.passed ? `<p class="reward">${theme().testPassed(r.tables[0])}</p>` : ''}
        ${r.newStars.length > 3
          ? `<p class="reward"><span class="reward-animal" aria-hidden="true">${r.newStars.map((n) => item(n.t).emoji).join(' ')}</span>
              ${theme().manyStars(r.newStars.length)}</p>`
          : r.newStars.map((n) => `<p class="reward"><span class="reward-animal" aria-hidden="true">${item(n.t).emoji}</span>
              ${theme().starMsg(n.t, n.s)} <span class="stars" aria-label="${n.s} van 3 sterren">${starsText(n.s)}</span></p>`).join('')}
        ${r.mode === 'toets' && r.mistakes.length ? `<h2>Deze waren nog niet juist</h2>
          <ul class="mistakes">${r.mistakes.map((a) => `<li><b>${a.q.a} × ${a.q.b} = ${a.q.answer}</b> <span class="muted">(jij: ${a.given})</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="row center">
        <button class="btn primary" data-action="again" autofocus>Nog eens</button>
        <button class="btn ghost" data-action="home">${theme().backLabel}</button>
      </div>
    </section>`);
    game = { mode: r.mode, tables: r.tables, finished: true, timers: [] };
  }

  // ---------- parent overview ----------

  function levelClass(stats, a, b) {
    const s = stats[L.factKey(a, b)];
    return s && s.attempts ? s.level : 0;
  }

  function showParent() {
    const p = profile();
    const hard = L.hardest(p.stats, 10);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ label: i === 0 ? 'vandaag' : DAY_NAMES[d.getDay()], min: (p.daily[L.dateKey(d)] || 0) / 60 });
    }
    const maxMin = Math.max(5, ...days.map((d) => d.min));
    const weekMin = days.reduce((s, d) => s + d.min, 0);

    render(`<section class="screen parent">
      ${topbar(p, 'Voor ouders')}
      <div class="card">
        <h1 class="parent-title"><span aria-hidden="true">${p.avatar}</span> ${esc(p.name)}</h1>
        <p class="muted">${p.rounds || 0} rondes gespeeld · ${p.totalCorrect || 0} juiste antwoorden · ${Math.round(weekMin)} min geoefend deze week</p>
      </div>

      <div class="card">
        <h2>Welke sommen kent ${esc(p.name)}?</h2>
        <p class="muted">Elk vakje is één som (rij × kolom). Hoe donkerder, hoe beter gekend. Tik op een vakje voor details.</p>
        <div class="heat-wrap">
          <table class="heat">
            <thead><tr><th scope="col"><span class="sr-only">rij maal kolom</span>×</th>${L.TABLES.map((b) => `<th scope="col">${b}</th>`).join('')}</tr></thead>
            <tbody>
              ${L.TABLES.map((a) => `<tr><th scope="row">${a}</th>${L.TABLES.map((b) => {
                const lvl = levelClass(p.stats, a, b);
                return `<td><button class="cell lvl-${lvl}" data-action="cell" data-a="${a}" data-b="${b}" aria-label="${a} × ${b}: ${LEVEL_NAMES[lvl]}">${lvl || '·'}</button></td>`;
              }).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
        <ul class="legend">
          ${LEVEL_NAMES.map((n, i) => `<li><span class="swatch lvl-${i}">${i || '·'}</span>${n}</li>`).join('')}
        </ul>
        <p class="cell-detail" id="cell-detail" role="status">Tik op een vakje om te zien hoe vaak die som geoefend werd.</p>
      </div>

      <div class="card">
        <h2>Moeilijkste sommen</h2>
        ${hard.length ? `<ol class="hard-list">${hard.map((f) => {
          const [a, b] = f.key.split('x');
          return `<li><b>${a} × ${b} = ${a * b}</b><span class="muted">${f.correct} van ${f.attempts} juist · gemiddeld ${fmtSeconds(f.avgMs)}</span></li>`;
        }).join('')}</ol>` : `<p class="muted">Nog geen moeilijke sommen gevonden. Ze verschijnen hier zodra ${esc(p.name)} een paar rondes gespeeld heeft.</p>`}
      </div>

      <div class="card">
        <h2>Oefentijd per dag</h2>
        <p class="muted">Minuten, laatste 7 dagen</p>
        <ul class="bars">
          ${days.map((d) => `<li class="bar-col">
            <span class="bar-val">${d.min >= 1 ? Math.round(d.min) : d.min > 0 ? '<1' : '0'}</span>
            <span class="bar-track"><span class="bar" style="height:${(d.min / maxMin) * 100}%"></span></span>
            <span class="bar-label">${d.label}</span>
          </li>`).join('')}
        </ul>
      </div>
    </section>`);
  }

  function showCellDetail(a, b) {
    const p = profile();
    const s = p.stats[L.factKey(a, b)];
    const el = document.getElementById('cell-detail');
    app.querySelectorAll('.cell.selected').forEach((c) => c.classList.remove('selected'));
    const btn = app.querySelector(`.cell[data-a="${a}"][data-b="${b}"]`);
    if (btn) btn.classList.add('selected');
    if (!s || !s.attempts) {
      el.innerHTML = `<b>${a} × ${b} = ${a * b}</b>: nog niet geoefend.`;
      return;
    }
    el.innerHTML = `<b>${a} × ${b} = ${a * b}</b>: ${s.attempts}× gevraagd, ${Math.round((s.correct / s.attempts) * 100)}% juist, gemiddeld ${fmtSeconds(s.totalMs / s.attempts)}. Niveau ${s.level}: ${LEVEL_NAMES[s.level].toLowerCase()}.`;
  }

  // ---------- parent gate (hold 3 s) ----------

  function startHold(btn) {
    cancelHold();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => { holdTimer = null; showParent(); }, 3000);
  }

  function cancelHold() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
    app.querySelectorAll('.holding').forEach((b) => b.classList.remove('holding'));
  }

  app.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-hold]');
    if (btn) { e.preventDefault(); startHold(btn); }
  });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { if (holdTimer) cancelHold(); }));
  app.addEventListener('pointerleave', (e) => {
    if (e.target.matches && e.target.matches('[data-hold]')) cancelHold();
  }, true);
  app.addEventListener('contextmenu', (e) => {
    if (e.target.closest('[data-hold]')) e.preventDefault();
  });

  // ---------- events ----------

  const actions = {
    'pick-profile': (el) => { data.currentId = el.dataset.id; persist(); showHome(); },
    'edit-profile': (el) => showProfileForm(el.dataset.id),
    'new-profile': () => showProfileForm(null),
    'ask-delete': (el) => showDeleteConfirm(el.dataset.id),
    'delete-profile': (el) => {
      data.profiles = data.profiles.filter((p) => p.id !== el.dataset.id);
      if (data.currentId === el.dataset.id) data.currentId = null;
      persist();
      showProfiles();
    },
    profiles: () => showProfiles(),
    home: () => showHome(),
    'toggle-sound': () => {
      const p = profile();
      p.settings.sound = !p.settings.sound;
      Sound.enabled = p.settings.sound;
      persist();
      showHome();
    },
    mode: (el) => {
      const m = el.dataset.mode;
      if (MODES[m].picker) showPicker(m);
      else startGame(m, L.TABLES);
    },
    quick: (el) => showPicker('oefenen', [Number(el.dataset.table)]),
    group: (el) => { pickerSel = L.GROUPS[el.dataset.group].slice(); renderPicker(); },
    'toggle-table': (el) => {
      const t = Number(el.dataset.table);
      pickerSel = pickerSel.includes(t) ? pickerSel.filter((x) => x !== t) : L.normalizeTables(pickerSel.concat(t));
      renderPicker();
      const again = app.querySelector(`.pick[data-table="${t}"]`);
      if (again) again.focus();
    },
    start: () => { if (pickerSel.length) startGame(pickerMode, pickerSel); },
    digit: (el) => typeDigit(el.dataset.digit),
    erase: () => erase(),
    ok: () => submitAnswer(game && game.input),
    choose: (el) => submitAnswer(el.dataset.value),
    quit: () => quitGame(),
    again: () => { const g = game; startGame(g.mode, g.tables); },
    cell: (el) => showCellDetail(Number(el.dataset.a), Number(el.dataset.b))
  };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || !actions[el.dataset.action]) return;
    if (el.type === 'checkbox') return;
    actions[el.dataset.action](el);
  });

  app.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'toggle-mc') {
      profile().settings.mc = e.target.checked;
      persist();
    }
  });

  app.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.dataset.form === 'profile') saveProfileForm(e.target);
  });

  document.addEventListener('keydown', (e) => {
    const hold = e.target.closest && e.target.closest('[data-hold]');
    if (hold && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!e.repeat) startHold(hold);
      return;
    }
    if (!game || game.finished) return;
    if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { erase(); e.preventDefault(); }
    else if (e.key === 'Enter') { submitAnswer(game.input); e.preventDefault(); }
    else if (e.key === 'Escape') quitGame();
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || e.key === ' ') cancelHold();
  });

  // ---------- start ----------

  if (profile()) showHome();
  else showProfiles();
})();
