// AI second opinion for mock board answers, through Firebase AI Logic (Gemini Developer API).
// The app's main Firebase code uses the older "compat" library, which has no AI support, so
// this file loads the current modular library on first use, as a separate app instance with
// its own App Check. Only the question, the reference answer and the Soldier's words are
// sent: never names or other personal details.
(function () {
  var C = window.BWC_CONFIG.ai;
  var config = window.BWC_FIREBASE_CONFIG;
  var model = null, starting = null;

  function available() {
    return !!(C && C.enabled && config && config.apiKey && window.BWC_APPCHECK_SITE_KEY && !/[?&]demo\b/.test(location.search));
  }

  function init() {
    if (model) return Promise.resolve(model);
    if (starting) return starting;
    var base = 'https://www.gstatic.com/firebasejs/' + C.sdkVersion + '/';
    starting = Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-app-check.js'),
      import(base + 'firebase-ai.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(config, 'bwc-ai');
      if (location.hostname === 'localhost') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      m[1].initializeAppCheck(app, { provider: new m[1].ReCaptchaEnterpriseProvider(window.BWC_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
      var S = m[2].Schema;
      var ai = m[2].getAI(app, { backend: new m[2].GoogleAIBackend() });
      model = m[2].getGenerativeModel(ai, {
        model: C.model,
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: S.object({
            properties: {
              verdict: S.enumString({ enum: ['right', 'partial', 'wrong'] }),
              reason: S.string()
            }
          })
        }
      });
      return model;
    }).catch(function (e) { starting = null; throw e; });
    return starting;
  }

  function prompt(q, answer) {
    return [
      'You grade answers at a U.S. Army promotion board. Judge ONLY whether the Soldier\'s answer has the same meaning as the reference answer.',
      'Ignore how the Soldier addressed the board member ("Sergeant Major," etc.) and whether they restated the question; that is graded separately.',
      'Accept different wording, word order and spoken-style grammar if the meaning matches the reference.',
      'For a list (for example "the four triage categories"), every item must be present for "right"; some but not all is "partial".',
      'Numbers, names, publications and units must match exactly; a wrong number is "wrong".',
      'Do not reward an answer for being close in topic if the facts differ. If the Soldier gives extra correct detail, that is fine.',
      'Reply as JSON: verdict is "right", "partial" or "wrong"; reason is one short sentence for the Soldier.',
      '',
      'Question: ' + q.q,
      'Reference answer: ' + q.answer,
      (q.quote ? 'Source text (' + q.pub + (q.para ? ' para ' + q.para : '') + '): ' + q.quote : ''),
      'Soldier\'s answer: ' + answer
    ].join('\n');
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })]);
  }

  // Resolves { verdict, reason } or rejects (offline, quota, App Check, model unavailable).
  function grade(q, answer) {
    if (!available()) return Promise.reject(new Error('AI grading is not set up'));
    return withTimeout(init().then(function (m) { return m.generateContent(prompt(q, answer)); }), C.timeoutMs)
      .then(function (res) {
        var out = JSON.parse(res.response.text());
        if (['right', 'partial', 'wrong'].indexOf(out.verdict) < 0) throw new Error('bad verdict');
        return { verdict: out.verdict, reason: String(out.reason || '').slice(0, 240) };
      });
  }

  window.BWC = window.BWC || {};
  BWC.AI = { available: available, grade: grade };
})();
