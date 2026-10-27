# Best Warrior

Study and training app for the TY27 Best Warrior season (HHBn → 34ID → MNNG State → Region IV).
Built on the same pattern as Squad Trivia: plain JavaScript, no build step, installable to a phone's home screen.

Phase 1 (this version): Google sign-in with admin approval, roles, a cited question bank, study library,
flashcards, untimed topic quizzes, Daily 10, mark-as-learned, question error reports, points, app ranks
PVT → SMA, leaderboard and five themes.

Phase 2 (in progress): **Mock board.** A CSM-led panel of SGMs and 1SGs reads each question aloud; the Soldier
answers by voice or typing against a timer and is graded on address ("Sergeant Major," / "First Sergeant,"),
restating the question, and content (`public/js/grading.js`, tested by `node tools/test_grading.js`).
Board settings and points are in `public/js/config.js` under `board`.

**Fitness log.** Workouts with or without a wearable screenshot (shrunk to a small JPEG on the phone, which also
strips any GPS data; a no-map confirmation is required). Points per 10 minutes with ruck and AFT multipliers and a
daily cap, vehicle unlocks by ruck miles, and AFT practice trends (raw results for the five AFT events). Settings
are under `fitness` in `config.js`.

**Squad discussion board.** Channels (Announcements for leaders only, Board Prep, Fitness, Land Nav, Weapons &
WTBDs, General), threads, replies, @mentions, Hooahs, and a **Discuss** button on every quiz and board answer that
opens one shared thread per question. Leaders pin and hide (hidden posts are kept for review); anyone can report a
post to the leaders' queue. There are no private messages.

**Creed trainer** (Study → Creeds and Army Values). The Soldier's Creed, Warrior Ethos and NCO Creed from FM 1
(May 2025) Appendix D, and the Army Values from ADP 6-22 para 1-71, word for word. Levels hide 25%, 50%, 75%, then
all words; the Soldier recites by typing or speaking and every word is checked in order (pass 97%). The NCO Creed
can be practiced by paragraph. The General Orders come from TRADOC Pamphlet 600-4 (C1, 27 Oct 2014) para 10-4,
exactly as printed. Admins can add more texts (e.g. the Army Song) under Creeds → Texts you added, copied from an
official source; they train the same way. Matching is tested by `node tools/test_creeds.js`.

**Audio flashcards** (Study → Audio flashcards, or from Fitness). Each question is read aloud, then a pause to
answer in your head, then the answer and its source. Pick a topic, group or "questions I missed", pause length,
speed and count. Large controls, screen kept awake while playing (Wake Lock). Browsers generally stop speaking when
the phone is locked, so the screen stays on. A fallback timer keeps it moving if a phone's speech engine stalls.

**AI grading and App Check** (Phase 3). The app registers with Firebase App Check (reCAPTCHA / Fraud Defense key
in `firebase-config.js`). On the mock board, answers the keyword check didn't mark right get a second opinion from
Gemini through Firebase AI Logic (`public/js/ai.js`, model and SDK version under `ai` in `config.js`). The AI can
raise a grade, never lower one; if it's unavailable, keyword grading stands. Only the question, reference answer
and the Soldier's words are sent. Admins can check it under Me → Admin → Test AI grading.

**Readiness alerts** (Phase 4; sponsors' and leaders' Home screen and competitor roster). Computed in the app from
each competitor's records (no paid push service): never started, no activity in 7+ days (4+ is a warning), behind on
Daily 10 or no workouts by Thursday, a topic stuck under 60% that hasn't improved in two weeks, no board in 14+ days
within 60 days of the next competition, and screenshots to verify. Snooze hides an alert for 3 days on that device.
Rules in `public/js/alerts.js`, tested by `node tools/test_alerts.js`.

**Award and NCOER drafts** (Phase 4; competitor page → Award and NCOER drafts, sponsors and leaders only). Builds
DA Form 638 achievement bullets and a proposed citation, and NCOER bullets (SGT and above) grouped by part IV block,
only from the Soldier's records dated inside the chosen rating period. Follows AR 623-3: bullets start with an action
verb, stay within two lines, use no pronouns, and avoid the prohibited comments in paras 3-21 and 3-22. Every output
is marked DRAFT for the rater to review. Generator tested by `node tools/test_drafts.js`.

**Arms room and ribbons** (Phase 3; Me → Arms room and ribbons). Weapons unlock with weapons points (first-time
right answers in weapons topics plus weapons drill GOs): M17, M4, M249, M240, M2, Javelin, XM7. Ten app ribbons are
earned from tracked activity (boards, creeds, Lifesaver drills, land nav, zeroing, study, ruck miles, Daily 10 days)
and worn in the app's order of precedence. They are app badges with their own names and colors, not Army awards.
New unlocks are announced on the Home screen. Rules are in `public/js/collect.js`.

**Linked sponsor board** (Phase 3; sponsors: Me → Run a sponsor board; Soldiers: Mock Board → Join a sponsor
board). The sponsor's phone creates a 4-letter code and shows the answer key, citation, timer, GO/NO-GO, format
checks, and final bearing/confidence/notes. The Soldier's device shows the panel and reads questions aloud, with
no answer key. Both stay in sync through `liveBoards/{code}` in Firestore (live listeners); only the sponsor and
that Soldier can read it, and only the sponsor can score. The Soldier earns 5 points per GO plus 20 for finishing.

**Weapons and WTBD drills** (Phase 3; Home → Weapons or WTBDs). 14 put-the-steps-in-order drills (M4 clear,
disassemble, assemble, function check, cycle of function, immediate action for M4/M249/M240/pistol, pistol unload,
masking, CAT tourniquet, MARCH, 25 m zero), 5 match-the-format drills (9-line MEDEVAC, MEDEVAC precedence, SALUTE,
SPOTREP, call-for-fire elements), and a 25 m zero adjustment drill using the STP 21-1 click rules. Content is in
`content/raw/drills.json`; `tools/build_questions.py` checks every quote against its page and writes
`public/js/drills-data.js`.

**Land nav drills** (Phase 3; Home → Land Nav). Plot the point, read the grid, and shoot an azimuth on the Camp
Ripley 1:25,000 map. Points are generated by the app inside the training area, never from the course answer keys.
The map tiles in `public/maps/ripley/` were rendered from the georeferenced frame of the CRTC GeoPDF:

```sh
swift tools/make_map_tiles.swift "<Camp Ripley 1-25K Map (GeoPDF).pdf>" public/maps/ripley 460.937324 270.164467 2546.37895 3714.76142 2
```

`public/js/geo.js` converts map pixels to UTM and MGRS (zone 15T, square UM). `node tools/test_geo.js` checks it;
a pixel scan of the printed 1 km grid found all 26 lines within 3 m of where the math puts them.
Note: Firebase Hosting serves the tiles at public URLs (not linked anywhere outside the app).

**Sponsor dashboard** (Me → My competitor / Competitors). Sponsors see the competitors assigned to them; leaders and
admins see every approved Soldier. Roster cards flag anyone quiet for 7 days and screenshots waiting for review.
Each competitor page shows readiness bars (board, knowledge, weapons, land nav, WTBDs, fitness), topics weakest
first, recently missed questions, board history, and workouts with **Verify** / **Flag** on screenshots.

Add `?demo` to the address (e.g. `http://localhost:8765/?demo`) to test on this device without signing in.

## Run it on this computer

```sh
cd public && python3 -m http.server 8765
```

Then open http://localhost:8765. With no Firebase config the app runs in demo mode: one person, saved in this browser.

## Question bank

Questions live in `content/raw/*.json`, one object per question with its publication, paragraph, PDF page and a
verbatim quote. Rebuild the app's question file after any change:

```sh
python3 -I tools/build_questions.py "$HOME/Downloads/TY27 BWC Source Docs"
```

The build re-checks every quote against the cited PDF page. Anything that fails is left out of the app and listed
in `content/needs-review.json`. Source links go to the Army Publishing Directory (`tools/apd_links.json`); some
need a CAC.

Content rules:
- Never use the folders starting `00` (CUI, FOUO, limited distribution), `01` (land nav course keys) or `90`
  (Gemini study guide) as sources.
- PDFs are never put in `public/`: Firebase Hosting is publicly reachable, and several publications are
  "Distribution authorized to U.S. Government agencies only".

## Put it online (Firebase, free Spark plan)

One-time setup, done by the admin:

1. **Create the project.** In the [Firebase console](https://console.firebase.google.com), add a project
   (e.g. `mn-bwc-ty27`). Analytics is not needed.
2. **Add a web app.** Project settings → Your apps → Web. Copy the config values into `public/js/firebase-config.js`.
3. **Turn on Google sign-in.** Build → Authentication → Sign-in method → Google → Enable.
4. **Create Firestore.** Build → Firestore Database → Create database (production mode, a US region).
5. **Set the admin email.** In `firestore.rules`, replace `REPLACE_WITH_ADMIN_EMAIL@gmail.com` with your Google
   account email.
6. **Deploy with the Firebase CLI** (installed in this project by `npm install`):

   ```sh
   npm install
   npx firebase login
   npx firebase use --add      # pick the project
   npm run deploy              # hosting + firestore rules
   ```

7. **Approve yourself.** Open the site, sign in, and on the "Waiting for approval" screen tap **I am the app admin**.
   Then approve everyone else from **Me → Admin**, and set roles (soldier, sponsor, leader, admin) and sponsors there.

Keep the GitHub repo **private**. Firebase Hosting does not need a public repo.

### What the security rules do

- Nobody reads anything until an admin approves their account.
- Soldiers can change only their own name, rank, unit and theme. Points can only go up, at most 100 per save.
- Answers and points history are visible to the Soldier, their assigned sponsor, leaders and admins.
- Error reports can be filed by anyone approved and worked by leaders and admins.

Without Cloud Functions (paid plan) the app adds points from the phone, so a determined user could inflate their
score within those limits. Leaders can review each person's answers if a score looks wrong.
