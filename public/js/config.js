// Season settings, topics, point values and the rank ladder.
// Admins change values here (and later in the Admin screen) without touching app logic.
(function () {
  window.BWC_CONFIG = {
    appName: 'Best Warrior',
    season: 'TY27',

    // Competitions in order. A null date shows "Date TBD" until an admin sets it.
    competitions: [
      { id: 'hhbn', name: 'HHBn Best Warrior', date: '2027-01-10' },
      { id: 'division', name: '34ID Best Warrior', date: null },
      { id: 'state', name: 'MNNG Best Warrior', date: '2027-04-13', place: 'Camp Ripley' },
      { id: 'region', name: 'Region IV Best Warrior', date: '2027-04-28', place: 'Marseilles, IL' }
    ],

    // Season stages. An admin moves a Soldier forward as they advance; each stage unlocks a harder
    // board level and any content packs tagged for it (a question's optional "stage" field).
    stages: [
      { id: 'hhbn', name: 'HHBn', comp: 'hhbn' },
      { id: 'division', name: '34ID', comp: 'division', board: { name: 'Division board', questions: 15, seconds: 45, minLevel: 2 } },
      { id: 'state', name: 'MNNG State', comp: 'state', board: { name: 'State board', questions: 15, seconds: 30, minLevel: 2 } },
      { id: 'region', name: 'Region IV', comp: 'region', board: { name: 'Region IV board', questions: 20, seconds: 30, minLevel: 3 } }
    ],
    advanceBonus: 50,

    // Study topics, grouped the way the library shows them.
    groups: [
      { id: 'profession', name: 'Profession and Leadership' },
      { id: 'standards', name: 'Standards and Policy' },
      { id: 'skills', name: 'Soldier Skills' }
    ],
    topics: [
      { id: 'army-profession', group: 'profession', name: 'Army Profession', icon: 'flag' },
      { id: 'leadership', group: 'profession', name: 'Leadership', icon: 'star' },
      { id: 'counseling', group: 'profession', name: 'Counseling', icon: 'chat' },
      { id: 'training', group: 'profession', name: 'Training', icon: 'target' },
      { id: 'risk-management', group: 'profession', name: 'Risk Management', icon: 'shield' },
      { id: 'command-policy', group: 'standards', name: 'Command Policy', icon: 'chain' },
      { id: 'uniforms', group: 'standards', name: 'Uniforms (AR 670-1)', icon: 'shirt' },
      { id: 'awards', group: 'standards', name: 'Awards', icon: 'medal' },
      { id: 'evaluations', group: 'standards', name: 'Evaluations', icon: 'clipboard' },
      { id: 'fitness', group: 'standards', name: 'Fitness and H2F', icon: 'fitness' },
      { id: 'drill-ceremonies', group: 'standards', name: 'Drill and Ceremonies', icon: 'flag' },
      { id: 'mnng-policy', group: 'standards', name: 'MNNG Policies', icon: 'book' },
      { id: 'warrior-tasks', group: 'skills', name: 'Warrior Tasks', icon: 'shield' },
      { id: 'rifle', group: 'skills', name: 'Rifle and Carbine', icon: 'target' },
      { id: 'pistol', group: 'skills', name: 'Pistol', icon: 'target' },
      { id: 'machine-guns', group: 'skills', name: 'Machine Guns', icon: 'target' },
      { id: 'qualification', group: 'skills', name: 'Weapons Qualification', icon: 'target' },
      { id: 'land-nav', group: 'skills', name: 'Land Navigation', icon: 'compass' },
      { id: 'first-aid', group: 'skills', name: 'First Aid and TCCC', icon: 'medic' },
      { id: 'call-for-fire', group: 'skills', name: 'Call for Fire', icon: 'radio' },
      { id: 'cbrn', group: 'skills', name: 'CBRN', icon: 'shield' },
      { id: 'range-safety', group: 'skills', name: 'Range Safety', icon: 'alert' }
    ],

    // Default point values (see the spec, section 8).
    points: {
      readSource: 1,          // opening a source document or finishing a flashcard set
      readDailyCap: 5,
      quizCorrect: 1,         // first correct answer per question only
      dailyCorrect: 1,
      dailyFinish: 5,
      weeklyGoalDays: 4       // Daily 10 days per week that count as "on track"
    },

    // Points needed for each rank. Early ranks come fast; SMA takes a full season.
    ranks: [
      { id: 'PVT', name: 'Private', need: 0 },
      { id: 'PV2', name: 'Private Second Class', need: 50 },
      { id: 'PFC', name: 'Private First Class', need: 150 },
      { id: 'SPC', name: 'Specialist', need: 350 },
      { id: 'CPL', name: 'Corporal', need: 700 },
      { id: 'SGT', name: 'Sergeant', need: 1200 },
      { id: 'SSG', name: 'Staff Sergeant', need: 2000 },
      { id: 'SFC', name: 'Sergeant First Class', need: 3200 },
      { id: 'MSG', name: 'Master Sergeant', need: 4600 },
      { id: '1SG', name: 'First Sergeant', need: 6000 },
      { id: 'SGM', name: 'Sergeant Major', need: 8000 },
      { id: 'CSM', name: 'Command Sergeant Major', need: 10500 },
      { id: 'SMA', name: 'Sergeant Major of the Army', need: 14000 }
    ],

    // Mock board. The CSM presides from the center seat; each question comes from a
    // different member, and the Soldier must address that member correctly.
    // Format, time per question and pass mark are defaults until the board SOP is known.
    board: {
      seats: [
        { title: '1SG', label: 'First Sergeant' },
        { title: 'SGM', label: 'Sergeant Major' },
        { title: 'CSM', label: 'Command Sergeant Major', president: true },
        { title: 'SGM', label: 'Sergeant Major' },
        { title: '1SG', label: 'First Sergeant' }
      ],
      questionCounts: [5, 10, 15],
      defaultQuestions: 10,
      secondsOptions: [30, 45, 60, 90],
      defaultSeconds: 60,
      passPct: 70,
      points: { right: 3, partial: 1, format: 1, pass: 10 },
      boardsPerDayForPoints: 2
    },

    // Fitness log. Typed entries earn the same base points as entries with a screenshot;
    // a screenshot adds a Verified-pending badge and a small bonus.
    fitness: {
      types: [
        { id: 'run', name: 'Run', mult: 1 },
        { id: 'ruck', name: 'Ruck march', mult: 1.5 },
        { id: 'lift', name: 'Strength', mult: 1 },
        { id: 'hiit', name: 'HIIT / circuit', mult: 1 },
        { id: 'swim', name: 'Swim', mult: 1 },
        { id: 'aft', name: 'AFT practice', mult: 1.25 },
        { id: 'other', name: 'Other', mult: 1 }
      ],
      perTenMinutes: 1,
      screenshotBonus: 0.1,
      dailyCap: 15,
      backdateDays: 7,
      // Raw results only: the package has no current AFT scoring tables.
      aftEvents: [
        { id: 'mdl', name: '3-rep max deadlift', unit: 'lb', better: 'high' },
        { id: 'hrp', name: 'Hand-release push-up', unit: 'reps', better: 'high' },
        { id: 'sdc', name: 'Sprint-drag-carry', unit: 'm:ss', better: 'low' },
        { id: 'plk', name: 'Plank', unit: 'm:ss', better: 'high' },
        { id: '2mr', name: '2-mile run', unit: 'm:ss', better: 'low' }
      ],
      // Vehicles unlock with total ruck miles.
      vehicles: [
        { need: 5, name: 'HMMWV', kind: 'truck' },
        { need: 25, name: 'JLTV', kind: 'truck' },
        { need: 50, name: 'Stryker', kind: 'apc' },
        { need: 75, name: 'Bradley', kind: 'tank' },
        { need: 100, name: 'Abrams', kind: 'tank' },
        { need: 150, name: 'UH-60 Black Hawk', kind: 'heli' },
        { need: 200, name: 'AH-64 Apache', kind: 'heli' }
      ]
    },

    // Hands-on training with real weapons and radios. Points come only once a sponsor or leader
    // verifies a session (or logs it for the Soldier).
    handson: {
      equipment: [
        { id: 'M4', kind: 'weapon', name: 'M4/M16' }, { id: 'M17', kind: 'weapon', name: 'M17 pistol' },
        { id: 'M249', kind: 'weapon', name: 'M249' }, { id: 'M240', kind: 'weapon', name: 'M240' },
        { id: 'M2', kind: 'weapon', name: 'M2' }, { id: 'SINCGARS', kind: 'radio', name: 'SINCGARS radio' },
        { id: 'other-radio', kind: 'radio', name: 'Other radio' }
      ],
      tasks: {
        weapon: ['Clearing', 'Function check', 'Disassembly / assembly', 'Malfunctions and immediate action', 'Loading / unloading', 'Dry fire', 'Live fire'],
        radio: ['Set up and operate (single channel)', 'Frequency hop operation', 'Presets', 'Radio checks and procedure', 'Troubleshooting']
      },
      perMinutes: 15,       // 1 point per 15 verified minutes
      maxPerSession: 8
    },

    // AI second opinion on board answers (Firebase AI Logic, Gemini Developer API free tier).
    // Keyword grading runs first; only answers it didn't mark right go to the AI.
    ai: {
      enabled: true,
      model: 'gemini-3.8-flash',
      sdkVersion: '13.0.0',
      timeoutMs: 12000
    },

    themes: [
      { id: 'black-gold', name: 'Black and Gold' },
      { id: 'desert-storm', name: 'Desert Storm' },
      { id: 'arctic-electric', name: 'Arctic Electric' },
      { id: 'camo-pop', name: 'Camo Pop' },
      { id: 'tropic-fiesta', name: 'Tropic Fiesta' }
    ],

    militaryRanks: ['PVT', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM',
      '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'WO1', 'CW2', 'CW3', 'CW4', 'CW5']
  };
})();
