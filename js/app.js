// UI: screens, game flow and input handling.
(function () {
  'use strict';

  const L = window.Logic;
  const AVATARS = ['🐵', '🐼', '🐨', '🐯', '🦄', '🐶', '🐱', '🐻', '🐹', '🦉', '🐬', '🦖', '🤖', '👾'];
  const MODES = {
    oefenen: { title: 'Oefenen', icon: '🎯', desc: '10 sommen, zonder tijd', picker: true },
    tijdrace: { title: 'Tijdrace', icon: '⏱️', desc: 'Zoveel mogelijk in 60 seconden', picker: true },
    slim: { title: 'Slim oefenen', icon: '🧠', desc: 'Oefen wat je nog moeilijk vindt', picker: false },
    toets: { title: 'Toets', icon: '📝', desc: '20 sommen, uitslag op het einde', picker: true },
    duel: { title: 'Duel', icon: '🆚', desc: 'Met twee tegen elkaar, 10 rondes', picker: true }
  };
  const ROUND_SIZE = { oefenen: 10, slim: 20, toets: 20 };
  const RACE_MS = 60000;
  const GOALS = [5, 10, 15]; // daily goal options, in minutes
  const DUEL_ROUNDS = 10;
  const LEVEL_NAMES = ['Nog niet geoefend', 'Net begonnen', 'Gaat soms goed', 'Gaat meestal goed', 'Goed gekend', 'Automatisch'];
  const DAY_NAMES = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  const app = document.getElementById('app');
  let data = Store.load();
  let game = null;
  let pickerMode = null;
  let pickerSel = [];
  let holdTimer = null;
  let duel = null;
  let duelPlayers = ['guest', 'guest'];

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

  // Tables a parent marked as already known (from school or earlier practice).
  function knownTables(p) {
    return L.TABLES.filter((t) => p.known && p.known[t]);
  }

  function todoTables(p) {
    return L.TABLES.filter((t) => !(p.known && p.known[t]));
  }

  // Known tables show as finished; unmarking returns to the stars actually earned.
  function displayStars(p, t) {
    return Math.max(p.stars[t] || 0, p.known && p.known[t] ? 3 : 0);
  }

  function goalMinutes(p) {
    return p.settings.goal || GOALS[0];
  }

  function todaySeconds(p) {
    return p.daily[L.dateKey(new Date())] || 0;
  }

  // Ring that fills up towards today's practice goal.
  function goalChip(p) {
    const goal = goalMinutes(p);
    const secs = todaySeconds(p);
    const done = Math.min(1, secs / (goal * 60));
    const min = Math.floor(secs / 60);
    const C = 2 * Math.PI * 11;
    return `<span class="goal${done >= 1 ? ' goal-done' : ''}" role="img" aria-label="Dagdoel: ${min} van ${goal} minuten geoefend">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle class="goal-track" cx="14" cy="14" r="11"/>
        <circle class="goal-fill" cx="14" cy="14" r="11" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - done)).toFixed(1)}"/>
      </svg>
      <span aria-hidden="true">${done >= 1 ? 'Doel gehaald!' : `${min} / ${goal} min`}</span>
    </span>`;
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
        ${goalChip(p)}
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
    const allThree = L.TABLES.every((t) => displayStars(p, t) === 3);
    if (allThree) return th.allDone;
    const tips = knownTables(p).length ? ['Tip: kies <b>Nog te leren</b> om te oefenen wat je nog niet kent.'] : [];
    return pick(tips.concat([
      'Tip: met <b>Slim oefenen</b> oefen je de sommen die je nog moeilijk vindt.',
      th.helpTip(esc(p.name)),
      th.tapTip,
      'Elke dag een beetje oefenen maakt je supersnel!'
    ]));
  }

  function showHome() {
    const p = profile();
    if (!p) return showProfiles();
    game = null;
    stopDuel();
    duel = null;
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
          const s = displayStars(p, t);
          const extra = theme().badge(t, s);
          const known = p.known && p.known[t];
          return `<li><button class="pen stars-${s}" data-action="quick" data-table="${t}" aria-label="Tafel van ${t}, ${item(t).name}, ${s} van 3 sterren${known ? ', al gekend' : ''}. Oefenen.">
            <span class="pen-animal" aria-hidden="true">${item(t).emoji}</span>
            ${extra ? `<span class="pen-extra" aria-hidden="true">${extra}</span>` : ''}
            <span class="pen-name">Tafel van ${t}</span>
            <span class="pen-known${known ? '' : ' is-empty'}" aria-hidden="true">al gekend</span>
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
    if (mode === 'duel') {
      const other = data.profiles.find((x) => x.id !== p.id);
      duelPlayers = [p.id, other ? other.id : 'guest'];
    }
    renderPicker();
  }

  function renderPicker() {
    const m = MODES[pickerMode];
    const sel = pickerSel;
    const todo = todoTables(profile());
    const groups = Object.assign({ todo }, L.GROUPS);
    const same = (g) => groups[g].length === sel.length && groups[g].every((t) => sel.includes(t));
    render(`<section class="screen picker-screen">
      ${topbar(profile(), m.title)}
      <div class="guide"><span class="mascot" aria-hidden="true">${theme().mascot}</span>
        <p class="bubble">${pickerMode === 'duel'
          ? 'Kies wie er tegen elkaar speelt en welke tafels. Jullie krijgen allebei dezelfde som en kiezen uit 4 antwoorden. Na 10 rondes wint wie de meeste juist heeft.'
          : 'Welke tafels wil je doen? Kies er één, een paar of allemaal. De sommen worden gemengd.'}</p></div>
      ${pickerMode === 'duel' ? duelPlayersHtml() : ''}
      <div class="groups" role="group" aria-label="Snel kiezen">
        ${todo.length && todo.length < 10 ? `<button class="chip" data-action="group" data-group="todo" aria-pressed="${same('todo')}">Nog te leren (${todo.join(', ')})</button>` : ''}
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
      const qs = mode === 'slim' ? L.smartRound(p.stats, ROUND_SIZE.slim, undefined, knownTables(p)) : L.buildRound(tables, ROUND_SIZE[mode]);
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

  // Time spent on the previous question, including feedback and hint:
  // this is what counts as practice time for the daily goal.
  function closeLastAnswer() {
    const last = game.answers[game.answers.length - 1];
    if (last && last.spent == null) last.spent = Date.now() - game.qStart;
  }

  function showQuestion() {
    const p = profile();
    const q = current();
    closeLastAnswer();
    game.input = '';
    game.locked = false;
    game.hint = false;
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
      if (race) game.timers.push(setTimeout(nextQuestion, 1500));
      else showHint(q);
    }
  }

  // Wrong answer: show the sum as rows of dots plus a trick, and let the child continue.
  function showHint(q) {
    game.hint = true;
    const dots = [];
    for (let r = 0; r < q.a; r++) {
      for (let c = 0; c < q.b; c++) {
        dots.push(`<span class="dot${c === 5 ? ' gap-c' : ''}${r === 5 ? ' gap-r' : ''}"></span>`);
      }
    }
    const rows = `${q.a} ${q.a === 1 ? 'rij' : 'rijen'} van ${q.b}`;
    const area = app.querySelector('.input-area');
    area.innerHTML = `<div class="hint">
      <div class="dots" style="grid-template-columns: repeat(${q.b}, auto)" role="img" aria-label="${rows} bolletjes, samen ${q.answer}">${dots.join('')}</div>
      <p class="hint-caption" aria-hidden="true">${rows} = ${q.answer}</p>
      <p class="hint-tip"><span aria-hidden="true">💡</span> ${L.hintFor(q.a, q.b)}</p>
      <button class="btn primary big" data-action="continue">Verder</button>
    </div>`;
    area.querySelector('[data-action="continue"]').focus();
  }

  function continueAfterHint() {
    if (!game || !game.hint) return;
    game.hint = false;
    nextQuestion();
  }

  function highlightChoice(given, answer, scope) {
    (scope || app).querySelectorAll('.choice').forEach((b) => {
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

  // Saves a finished round into a player's profile: practice time, streak, stars.
  function applyRound(p, answers) {
    const now = new Date();
    const today = L.dateKey(now);
    const goalSecs = goalMinutes(p) * 60;
    const before = p.daily[today] || 0;

    // Practice time per question (incl. feedback and hint), capped so a paused game doesn't count.
    const secs = answers.reduce((s, a) => s + Math.min(a.spent || a.ms, 20000), 0) / 1000;
    p.daily[today] = before + secs;
    p.streak = L.updateStreak(p.streak, now);
    p.rounds = (p.rounds || 0) + 1;
    p.totalCorrect = (p.totalCorrect || 0) + answers.filter((a) => a.correct).length;

    p.played = p.played || {};
    answers.forEach((a) => { p.played[a.q.table] = true; });

    // Stars never go down (R-5).
    const newStars = [];
    L.TABLES.forEach((t) => {
      const s = L.computeStars(p.stats, t, p.testPassed[t], !!p.played[t]);
      if (s > (p.stars[t] || 0)) {
        p.stars[t] = s;
        newStars.push({ t, s });
      }
    });
    return { secs, newStars, goalReached: before < goalSecs && before + secs >= goalSecs };
  }

  function finishGame() {
    if (!game || game.finished) return;
    stopTimers();
    game.finished = true;
    closeLastAnswer();
    const p = profile();

    const total = game.mode === 'tijdrace' ? game.answers.length : ROUND_SIZE[game.mode];
    const result = { mode: game.mode, tables: game.tables, score: game.score, total, record: null, passed: false };

    // Before the stars are counted, so a passed test gives its 3rd star right away.
    if (game.mode === 'toets' && game.tables.length === 1 && game.score >= 18) {
      result.passed = true;
      p.testPassed[game.tables[0]] = true;
    }

    Object.assign(result, applyRound(p, game.answers));

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

    if (r.newStars.length || r.record || r.passed || r.goalReached) Sound.play('reward');

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
        ${r.goalReached ? `<p class="reward"><span class="reward-animal" aria-hidden="true">🎯</span>
          Dagdoel gehaald! Je hebt vandaag ${goalMinutes(profile())} minuten geoefend.</p>` : ''}
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

  // ---------- duel ----------

  function duelPlayersHtml() {
    const opts = data.profiles.map((p) => ({ id: p.id, avatar: p.avatar, name: p.name }))
      .concat([{ id: 'guest', avatar: '🙂', name: 'Gast' }]);
    return `<div class="duel-setup">${[0, 1].map((i) => `<div class="duel-slot slot-${i}">
      <h2>Speler ${i + 1}</h2>
      <div class="groups" role="group" aria-label="Speler ${i + 1}">
        ${opts.map((o) => {
          const taken = o.id !== 'guest' && duelPlayers[1 - i] === o.id;
          return `<button class="chip player-chip" data-action="duel-player" data-slot="${i}" data-id="${o.id}" aria-pressed="${duelPlayers[i] === o.id}" ${taken ? 'disabled' : ''}>
            <span aria-hidden="true">${o.avatar}</span> ${esc(o.name)}</button>`;
        }).join('')}
      </div>
    </div>`).join('')}</div>`;
  }

  function makeDuelPlayer(id, i) {
    const p = id === 'guest' ? null : data.profiles.find((x) => x.id === id);
    const twoGuests = duelPlayers[0] === 'guest' && duelPlayers[1] === 'guest';
    return {
      profile: p,
      name: p ? p.name : (twoGuests ? `Gast ${i + 1}` : 'Gast'),
      avatar: p ? p.avatar : '🙂',
      choice: null, ms: 0, score: 0, answers: []
    };
  }

  // Rounds: both players get the same question and the same 4 choices.
  // The next round starts only when both have answered.
  function startDuel(tables) {
    stopDuel();
    game = null;
    tables = L.normalizeTables(tables);
    duel = {
      tables,
      qs: L.buildRound(tables, DUEL_ROUNDS),
      round: 0,
      players: [makeDuelPlayer(duelPlayers[0], 0), makeDuelPlayer(duelPlayers[1], 1)],
      timers: [],
      started: false,
      finished: false
    };
    render(`<section class="screen duel">
      <header class="duel-top">
        <button class="icon-btn" data-action="quit-duel" aria-label="Duel stoppen">✕</button>
        <span class="timer" id="duel-round">Ronde <b>1</b> van ${DUEL_ROUNDS}</span>
        <span class="duel-top-spacer"></span>
      </header>
      <div class="duel-sides">
        ${duel.players.map((pl, i) => `<div class="side side-${i}">
          <div class="side-head">
            <span class="avatar" aria-hidden="true">${pl.avatar}</span>
            <span class="side-name">${esc(pl.name)}</span>
            <span class="side-score" id="score-${i}" aria-label="${esc(pl.name)}: 0 juist">0</span>
          </div>
          <div class="sign side-sign" id="sign-${i}"><span class="sign-q" id="q-${i}">…</span><span class="sign-ans" id="ans-${i}">?</span></div>
          <p class="feedback side-fb" id="fb-${i}" role="status"></p>
          <div class="side-input" id="input-${i}"></div>
        </div>`).join('')}
      </div>
      <div class="countdown" id="countdown" aria-live="assertive"></div>
    </section>`);

    let n = 3;
    const tick = () => {
      const el = document.getElementById('countdown');
      if (!duel || !el) return;
      if (n > 0) {
        el.textContent = n;
        Sound.play('tap');
        n--;
        duel.timers.push(setTimeout(tick, 800));
        return;
      }
      el.remove();
      duel.started = true;
      showDuelRound();
    };
    tick();
  }

  function duelChoicesHtml(i) {
    return `<div class="choices">${duel.opts.map((o) => `<button class="choice" data-duel="choose" data-side="${i}" data-value="${o}">${o}</button>`).join('')}</div>`;
  }

  function showDuelRound() {
    const q = duel.qs[duel.round];
    duel.opts = L.multipleChoice(q);
    duel.roundStart = Date.now();
    duel.revealed = false;
    document.querySelector('#duel-round b').textContent = duel.round + 1;
    duel.players.forEach((pl, i) => {
      pl.choice = null;
      document.getElementById(`q-${i}`).textContent = `${q.a} × ${q.b} =`;
      const ans = document.getElementById(`ans-${i}`);
      ans.textContent = '?';
      ans.classList.remove('filled');
      document.getElementById(`sign-${i}`).classList.remove('is-correct', 'is-wrong');
      document.getElementById(`fb-${i}`).textContent = '';
      document.getElementById(`input-${i}`).innerHTML = duelChoicesHtml(i);
    });
  }

  function duelInput(el) {
    if (!duel || !duel.started || duel.finished || duel.revealed) return;
    const i = Number(el.dataset.side);
    const pl = duel.players[i];
    if (pl.choice != null) return;
    pl.choice = Number(el.dataset.value);
    pl.ms = Date.now() - duel.roundStart;
    Sound.play('tap');
    // Hide the choices after answering, so the other player can't copy.
    const other = duel.players[1 - i];
    if (other.choice == null) {
      document.getElementById(`input-${i}`).innerHTML = `<div class="duel-wait" role="status">
        <span class="duel-wait-icon" aria-hidden="true">👍</span>Klaar!<span class="muted">Wachten op ${esc(other.name)}…</span></div>`;
      document.getElementById(`fb-${1 - i}`).textContent = `${pl.name} is klaar`;
    } else {
      revealDuelRound();
    }
  }

  // Both answered: show on both sides at once who was right.
  function revealDuelRound() {
    duel.revealed = true;
    const q = duel.qs[duel.round];
    let anyWrong = false;
    let anyRight = false;
    duel.players.forEach((pl, i) => {
      const correct = pl.choice === q.answer;
      pl.answers.push({ q, given: pl.choice, correct, ms: pl.ms });
      const ans = document.getElementById(`ans-${i}`);
      ans.textContent = pl.choice;
      ans.classList.add('filled');
      document.getElementById(`sign-${i}`).classList.add(correct ? 'is-correct' : 'is-wrong');
      const box = document.getElementById(`input-${i}`);
      box.innerHTML = duelChoicesHtml(i);
      highlightChoice(pl.choice, q.answer, box);
      const fb = document.getElementById(`fb-${i}`);
      if (correct) {
        anyRight = true;
        pl.score++;
        const sc = document.getElementById(`score-${i}`);
        sc.textContent = pl.score;
        sc.setAttribute('aria-label', `${pl.name}: ${pl.score} juist`);
        fb.innerHTML = '<span class="fb-icon ok" aria-hidden="true">✓</span> Juist!';
      } else {
        anyWrong = true;
        fb.innerHTML = `<span class="fb-icon miss" aria-hidden="true">✗</span> <b>${q.a} × ${q.b} = ${q.answer}</b>`;
      }
    });
    Sound.play(anyRight ? 'correct' : 'wrong');
    duel.timers.push(setTimeout(() => {
      if (!duel || duel.finished) return;
      duel.round++;
      if (duel.round >= DUEL_ROUNDS) finishDuel();
      else showDuelRound();
    }, anyWrong ? 2200 : 1400));
  }

  function stopDuel() {
    if (!duel) return;
    duel.timers.forEach(clearTimeout);
    duel.timers = [];
  }

  function finishDuel() {
    if (!duel || duel.finished) return;
    stopDuel();
    duel.finished = true;
    // Answers count for players with a profile, just like a normal round.
    duel.players.forEach((pl) => {
      if (!pl.profile) return;
      pl.answers.forEach((a) => {
        pl.profile.stats[a.q.key] = L.updateFact(pl.profile.stats[a.q.key], a.correct, a.ms);
      });
      pl.result = applyRound(pl.profile, pl.answers);
    });
    persist();
    showDuelResults();
  }

  function showDuelResults() {
    const [a, b] = duel.players;
    const winner = a.score === b.score ? null : (a.score > b.score ? a : b);
    Sound.play('reward');
    render(`<section class="screen results">
      <div class="guide"><span class="mascot cheer" aria-hidden="true">${theme().mascot}</span>
        <p class="bubble">${winner ? `Knap gespeeld, allebei! ${esc(winner.name)} had er net iets meer juist.` : 'Gelijkspel! Jullie zijn allebei even goed.'}</p></div>
      <div class="card result-card">
        <h1>${winner ? `🏆 ${esc(winner.name)} wint!` : '🤝 Gelijkspel!'}</h1>
        <div class="duel-scores">
          ${duel.players.map((pl) => `<div class="duel-score${pl === winner ? ' is-winner' : ''}">
            <span class="avatar big" aria-hidden="true">${pl.avatar}</span>
            <span class="side-name">${esc(pl.name)}</span>
            <p class="big-score"><b>${pl.score}</b> goed</p>
            ${pl.result && pl.result.newStars.length ? `<span class="sub">⭐ ${pl.result.newStars.length} nieuwe ${pl.result.newStars.length === 1 ? 'ster' : 'sterren'}</span>` : ''}
            ${pl.result && pl.result.goalReached ? '<span class="sub">🎯 Dagdoel gehaald!</span>' : ''}
          </div>`).join('')}
        </div>
      </div>
      <div class="row center">
        <button class="btn primary" data-action="duel-again" autofocus>Nog eens</button>
        <button class="btn ghost" data-action="home">${theme().backLabel}</button>
      </div>
    </section>`);
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
    const goal = goalMinutes(p);
    const maxMin = Math.max(goal, ...days.map((d) => d.min));
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
        <p class="muted">Minuten, laatste 7 dagen. ✓ = dagdoel van ${goal} min gehaald.</p>
        <ul class="bars">
          ${days.map((d) => `<li class="bar-col">
            <span class="bar-val">${d.min >= goal ? '✓ ' : ''}${d.min >= 1 ? Math.round(d.min) : d.min > 0 ? '<1' : '0'}</span>
            <span class="bar-track"><span class="bar" style="height:${(d.min / maxMin) * 100}%"></span></span>
            <span class="bar-label">${d.label}</span>
          </li>`).join('')}
        </ul>
      </div>

      <div class="card">
        <h2>Tafels die ${esc(p.name)} al kent</h2>
        <p class="muted">Duid tafels aan die ${esc(p.name)} al kent, van school of van vroeger oefenen. Ze krijgen meteen 3 sterren, en bij Slim oefenen komen ze alleen nog af en toe terug om te herhalen. Zo gaat de oefentijd naar wat nog niet gekend is.</p>
        <div class="known-picker" role="group" aria-label="Al gekende tafels">
          ${L.TABLES.map((t) => `<button class="chip known-chip" data-action="toggle-known" data-table="${t}" aria-pressed="${!!(p.known && p.known[t])}">
            <span aria-hidden="true">${item(t).emoji}</span> ${t}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <h2>Dagdoel</h2>
        <p class="muted">Na hoeveel minuten oefenen per dag de ring op het startscherm vol is.</p>
        <div class="groups" role="group" aria-label="Dagdoel">
          ${GOALS.map((g) => `<button class="chip" data-action="set-goal" data-goal="${g}" aria-pressed="${goal === g}">${g} minuten</button>`).join('')}
        </div>
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
    // Duel buttons react on touch-down, so two children can tap at the same moment.
    const d = e.target.closest('[data-duel]');
    if (d) { e.preventDefault(); duelInput(d); return; }
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
    group: (el) => {
      const g = el.dataset.group;
      pickerSel = g === 'todo' ? todoTables(profile()) : L.GROUPS[g].slice();
      renderPicker();
    },
    'toggle-table': (el) => {
      const t = Number(el.dataset.table);
      pickerSel = pickerSel.includes(t) ? pickerSel.filter((x) => x !== t) : L.normalizeTables(pickerSel.concat(t));
      renderPicker();
      const again = app.querySelector(`.pick[data-table="${t}"]`);
      if (again) again.focus();
    },
    start: () => {
      if (!pickerSel.length) return;
      if (pickerMode === 'duel') startDuel(pickerSel);
      else startGame(pickerMode, pickerSel);
    },
    'duel-player': (el) => { duelPlayers[Number(el.dataset.slot)] = el.dataset.id; renderPicker(); },
    'duel-again': () => startDuel(duel.tables),
    'quit-duel': () => showHome(),
    continue: () => continueAfterHint(),
    'toggle-known': (el) => {
      const p = profile();
      const t = Number(el.dataset.table);
      p.known = p.known || {};
      if (p.known[t]) delete p.known[t];
      else p.known[t] = true;
      // Next time a table is picked, start with what's still to learn.
      const todo = todoTables(p);
      if (todo.length) p.lastSelection = todo;
      persist();
      el.setAttribute('aria-pressed', !!p.known[t]);
    },
    'set-goal': (el) => {
      profile().settings.goal = Number(el.dataset.goal);
      persist();
      app.querySelectorAll('[data-action="set-goal"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
    },
    digit: (el) => typeDigit(el.dataset.digit),
    erase: () => erase(),
    ok: () => submitAnswer(game && game.input),
    choose: (el) => submitAnswer(el.dataset.value),
    quit: () => quitGame(),
    again: () => { const g = game; startGame(g.mode, g.tables); },
    cell: (el) => showCellDetail(Number(el.dataset.a), Number(el.dataset.b))
  };

  app.addEventListener('click', (e) => {
    const d = e.target.closest('[data-duel]');
    if (d && e.detail === 0) { duelInput(d); return; } // keyboard activation
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
    if (game.hint) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); continueAfterHint(); }
      else if (e.key === 'Escape') quitGame();
      return;
    }
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
