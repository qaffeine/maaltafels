# Maaltafels: Requirements

A web game that helps children learn the multiplication tables 1–10.

Status: **v1.0, ready to build**. All open questions are resolved (see §12).
Priorities: **M** = Must (v1), **S** = Should (v1 if time allows), **C** = Could (later).

---

## 1. Goal & audience

- **Goal:** children know all 100 facts (1×1 … 10×10) by heart. They answer correctly **and quickly** (within ~3 seconds).
- **Primary users:** children aged 6–10, primary school (grade 2–4), a mix of beginners and kids automating the facts.
- **Secondary users:** parents or teachers who want to see progress.
- **Devices:** tablet first, then desktop and phone. Touch and keyboard.
- **UI language:** Dutch only (Flemish wording, e.g. "maaltafel van 7").

## 2. Content scope

| ID | Requirement | Prio |
|----|-------------|------|
| C-1 | Covers tables 1 to 10, each with multipliers 1 to 10 (100 facts). | M |
| C-2 | Questions use the form `a × b = ?`, where `a` is the chosen table. With the "mix" option, `b × a` also appears. | M |
| C-3 | The player can pick one or more tables to practise (see §4.0). | M |
| C-4 | "Missing factor" questions (`6 × ? = 42`). | C |

## 3. Player profiles

| ID | Requirement | Prio |
|----|-------------|------|
| P-1 | Several children can use the same device, each with a profile (name and avatar). No passwords. | M |
| P-2 | Each profile's progress is stored locally in the browser (localStorage). | M |
| P-3 | A profile can be renamed or deleted. Deleting asks for confirmation. | M |
| P-4 | Export/import progress as a file, to move to another device. | C |

## 4. Game modes

### 4.0 Choosing tables (applies to all modes). **M**
- A table picker shows the tables 1–10 as toggle buttons. The player can select **one, several, or all** of them.
- Shortcuts: **"Alles"** (all 10 tables), plus quick groups such as **"Makkelijk" (1, 2, 5, 10)** and **"Moeilijk" (6, 7, 8, 9)**.
- When several tables are selected, a round **mixes questions from all selected tables at random**. It doesn't go table by table. Each selected table appears about equally often.
- The last selection is remembered per profile.
- Stars and records are kept per single table. A mixed round still updates the mastery of every fact it asks.

### 4.1 Practice (Oefenen). **M**
- Uses the table selection from §4.0 (one table or a mix).
- Rounds of 10 questions. There is no time pressure.
- After a wrong answer, the correct answer is shown and the same question comes back later in the round.

### 4.2 Time challenge (Tijdrace). **M**
- The player answers as many questions as possible in 60 seconds.
- Uses the table selection from §4.0.
- Score = number of correct answers. Each profile keeps a personal best per table selection (e.g. "7", "6+7+8", "Alles").
- A wrong answer costs no points but uses time.

### 4.3 Smart practice (Slim oefenen). **S**
- The game picks questions based on the child's weak facts (see §6).
- This is the recommended daily mode (about 5 minutes).

### 4.4 Test (Toets). **S**
- 20 questions from the selected tables, with no help and no feedback until the end.
- The result shows a score and lists the mistakes. The test counts toward "mastered" status (§7).

### 4.5 Duel. **M**
- Two players on one screen, side by side. Each player is a profile or a guest.
- Both get the same questions from the chosen tables and answer at their own pace.
- 3-2-1 countdown, then 60 seconds; the most correct answers wins (a tie is possible).
- Each side uses that player's own input setting (keypad or 4 choices). Buttons react on touch-down, so both can tap at the same time.
- Answers count toward each profile's mastery, stars, streak and daily goal. Guests save nothing.

## 5. Question & answer interaction

| ID | Requirement | Prio |
|----|-------------|------|
| Q-1 | One question on screen at a time, in large type. | M |
| Q-2 | Answers are typed on a large on-screen numeric keypad (0–9, erase, OK). A physical keyboard also works (digits, Backspace, Enter). | M |
| Q-3 | Multiple-choice mode (4 options) for beginners, which can be switched on per profile, on by default for new profiles. Distractors are plausible, e.g. neighbouring products `a×(b±1)`. | M |
| Q-4 | Correct answer: short positive animation and sound, then the next question follows automatically (<1 s). | M |
| Q-5 | Wrong answer: gentle feedback (no harsh "fail" sound), then the correct fact is shown for ~2 s. | M |
| Q-6 | After a wrong answer in Practice and Smart practice: the sum as a dot grid (e.g. 7 rows of 8, grouped by 5) plus a trick built on an easier fact (e.g. "maal 9 = maal 10 min één keer"). The child continues with a **Verder** button. Not in Tijdrace, Toets or Duel. | M |
| Q-7 | The same question never comes twice in a row. | M |

## 6. Adaptive learning

| ID | Requirement | Prio |
|----|-------------|------|
| A-1 | For each profile and each fact (`a×b`, treated as the same fact as `b×a`) the game records: attempts, correct answers, and the last answer time. | M |
| A-2 | Each fact has a mastery level 0–5 (Leitner-style). Correct and fast (<3 s) → +1. Correct but slow → unchanged. Wrong → back to 1. | S |
| A-3 | Smart practice mixes the questions: about 60% weak facts (level 0–2), 30% medium, 10% mastered (for review). | S |

## 7. Progress & motivation

| ID | Requirement | Prio |
|----|-------------|------|
| R-1 | A home screen shows each table with 0–3 stars. 1★ = practised, 2★ = ≥80% correct, 3★ = all 10 facts at mastery level ≥4 (or a passed test). | M |
| R-2 | End-of-round summary: score, time, and new stars or a new record. | M |
| R-3 | Daily streak counter (days in a row with at least one round played). | S |
| R-6 | Daily goal: a ring on the home screen fills up towards the day's practice minutes (5, 10 or 15; set by a parent, default 5). Reaching it is celebrated once on the results screen. Practice time per question includes feedback and hint time, capped at 20 s. | M |
| R-4 | Badges, e.g. "first round", "table of 7 mastered", "100 correct", "all tables". | C |
| R-5 | Motivation stays positive: nothing is ever taken away and there are no punishing messages. | M |

## 8. Parent / teacher overview

| ID | Requirement | Prio |
|----|-------------|------|
| O-1 | A 10×10 grid (heatmap) per profile, coloured by mastery level of each fact, with a colour legend. Tapping a cell shows that fact's attempts, % correct and average answer time. Cells also show a number or icon, so colour isn't the only signal (U-5). | M |
| O-2 | A list of the 10 hardest facts for the child, plus the practice time per day for the last 7 days (✓ on days the daily goal was reached). | M |
| O-4 | Parents set the daily goal: 5, 10 or 15 minutes. | M |
| O-3 | Access to this overview via a simple gate (e.g. "hold for 3 seconds" or a sum an adult can solve), so children don't wander in. | S |

## 9. UI / UX

**Themes:** each player picks a world on their profile, and can change it later. The game logic is the same in every world.

**City theme (Stad).**
- A builder guide (👷) leads the child through the game.
- Each table is a building: 1 🏠 huisje, 2 🏪 winkel, 3 🏫 school, 4 🏥 ziekenhuis, 5 🚉 station, 6 🏛️ museum, 7 🏟️ stadion, 8 🎡 pretpark, 9 🏰 kasteel, 10 🗼 toren.
- Stars make the building rise: 0★ construction site 🚧, 1★ foundation 🏗️, 2★ walls 🧱, 3★ finished 🎉.
- The question is shown on a yellow construction board with hazard stripes.

**Zoo theme (default).**
- A friendly guide mascot (e.g. a monkey 🐵) leads the child through the game. It cheers on correct answers and encourages on mistakes.
- Each table has its own animal and habitat on a zoo map, e.g. 1 🐭 mouse, 2 🐰 rabbit, 3 🐸 frog, 4 🐢 turtle, 5 🦊 fox, 6 🐧 penguin, 7 🦒 giraffe, 8 🐙 octopus, 9 🦁 lion, 10 🐘 elephant. The final list can still change.
- Stars on a table make its animal happier and its habitat richer: 1★ the animal appears, 2★ it gets food or toys, 3★ it gets a crown or party.
- Mixed rounds ("Alles") are played at the zoo entrance, where all the animals appear together.
- Visuals use emoji or inline SVG, with no image downloads (see T-1, T-5).

| ID | Requirement | Prio |
|----|-------------|------|
| U-1 | Playful, colourful, calm design. No ads, no external links in the child's flow. | M |
| U-2 | Touch targets are at least 48×48 px. The question text is at least 48 px. | M |
| U-3 | Works from 360 px wide (phone portrait) to desktop, with no horizontal scrolling. Tablet is the priority. | M |
| U-4 | Short sound effects for correct answers, mistakes and rewards, generated with the Web Audio API so no audio files are needed (works on `file://`). A sound on/off toggle, remembered per profile. | M |
| U-5 | Accessibility: sufficient contrast (WCAG AA), meaning is never conveyed only by colour (✓/✗ icons too), and `prefers-reduced-motion` is respected. | M |
| U-6 | Minimal reading: icons and short words, suitable for early readers. | M |

## 10. Technical & non-functional

| ID | Requirement | Prio |
|----|-------------|------|
| T-1 | Static web app (HTML/CSS/JS), with no backend, no login and no build step. | M |
| T-2 | Runs in current Chrome, Safari (iPad!), Firefox and Edge. | M |
| T-3 | Works offline after the first visit (PWA, installable on the home screen, with a big × on green as the app icon). | M |
| T-4 | Privacy: no data leaves the device, no analytics or trackers, no cookies (GDPR-friendly for children). | M |
| T-5 | Loads in under 2 s on an average tablet. Total size under 1 MB, excluding sounds. | S |
| T-6 | Question-generation and mastery logic is covered by unit tests. | S |
| T-7 | **Runs locally for now:** works by opening `index.html` directly in the browser (`file://`), so it can't use ES modules or `fetch` of local files. It stays hostable as plain static files later (GitHub Pages, own domain) without changes. | M |

## 11. Out of scope (v1)

- Online accounts, syncing between devices, and leaderboards against other children.
- A teacher/classroom dashboard with multiple pupils across devices.
- Tables beyond 10, and other operations (addition, subtraction, **division**).
- Spoken questions / text-to-speech.

## 12. Decisions

| Topic | Decision |
|-------|----------|
| Language | Dutch only |
| Age | 6–10, mixed. Multiple choice is in v1 |
| Theme | Chosen per player: zoo (monkey guide, default) or city (builder guide) |
| Mixed tables | Yes. Any combination of tables, shuffled together (§4.0) |
| Division | No, out of scope |
| Parent overview | Yes, in v1 (§8) |
| Spoken questions | No. Sound effects only |
| Hosting | GitHub Pages: https://qaffeine.github.io/maaltafels/, installable on iPad |

## 13. Acceptance criteria (v1 "done")

- A child can select tables 3, 6 and 7 together and get a round with mixed questions from all three.
- A new child can create a profile, pick the table of 7, and play a Practice round of 10 questions using only touch.
- A wrong answer shows the correct fact, and that fact reappears in the same round.
- The time challenge ends at exactly 60 s and saves a new personal best.
- Stars on the home screen update correctly after a round, and survive a page reload.
- Two profiles on the same device keep separate progress.
- The app works on an iPad in Safari, portrait and landscape, with no horizontal scroll.
- The parent overview shows a 10×10 grid that reflects the facts just practised, and children can't open it by a single tap.
- No network requests go to third parties (verified in the browser devtools).
