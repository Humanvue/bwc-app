// Mock board grading. Pure functions so they can be tested outside the browser
// (node tools/test_grading.js).
//
// A board answer is graded on three things:
//   address  - starts with the asking member's title ("Sergeant Major," / "First Sergeant,")
//   restate  - repeats most of the question's key words before giving the answer
//   content  - contains the answer's keywords (or the answer itself)
// Delivery (filler words, time used) is feedback only.
(function (root) {
  // How each panel member must be addressed.
  var TITLES = {
    CSM: 'sergeant major',
    SGM: 'sergeant major',
    '1SG': 'first sergeant',
    MSG: 'master sergeant',
    SFC: 'sergeant first class'
  };

  var STOP = ('a an the of to in on for and or by with as at from into is are was were be been being do does did ' +
    'what which who whom whose when where why how this that these those it its your you we our their his her ' +
    'must should can could may might will would shall there than then if not no yes per under about according ' +
    'name list describe explain define state give tell me us').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = true; });

  var FILLERS = ['um', 'uh', 'umm', 'uhh', 'er', 'ah', 'like', 'you know'];

  function clean(s) {
    return String(s || '').toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9' -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Loose word match: plural/singular and simple endings count as the same word.
  function stem(w) {
    return w.replace(/'s$/, '').replace(/(ies)$/, 'y').replace(/(es|s)$/, '').replace(/(ing|ed)$/, '');
  }

  function words(s) {
    return clean(s).split(' ').filter(Boolean);
  }

  function keyWords(question) {
    var seen = {};
    return words(question).filter(function (w) {
      if (STOPSET[w] || w.length < 3) return false;
      var k = stem(w);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function addressOk(answer, title) {
    var want = TITLES[title] || 'sergeant major';
    var a = clean(answer);
    return a.indexOf(want) === 0;
  }

  // Share of the question's key words that appear in the answer.
  function restateScore(answer, question) {
    var keys = keyWords(question);
    if (!keys.length) return 1;
    var have = {};
    words(answer).forEach(function (w) { have[stem(w)] = true; });
    var hit = keys.filter(function (k) { return have[stem(k)]; }).length;
    return hit / keys.length;
  }

  // Content: every keyword phrase counts; a near-verbatim answer always counts.
  function contentScore(answer, q) {
    var a = ' ' + clean(answer) + ' ';
    var aStems = ' ' + words(answer).map(stem).join(' ') + ' ';
    var full = clean(q.answer);
    if (full && a.indexOf(' ' + full + ' ') >= 0) return { score: 1, hit: q.keywords || [], miss: [] };
    var kws = (q.keywords && q.keywords.length) ? q.keywords : keyWords(q.answer);
    var hit = [];
    var miss = [];
    kws.forEach(function (k) {
      var phrase = ' ' + words(k).map(stem).join(' ') + ' ';
      if (aStems.indexOf(phrase) >= 0) hit.push(k); else miss.push(k);
    });
    return { score: kws.length ? hit.length / kws.length : 0, hit: hit, miss: miss };
  }

  function fillers(answer) {
    var a = ' ' + clean(answer) + ' ';
    var n = 0;
    FILLERS.forEach(function (f) {
      var re = new RegExp(' ' + f + ' ', 'g');
      var m = a.match(re);
      if (m) n += m.length;
    });
    return n;
  }

  // Restating half the question's key words counts as restated. Content is right only when
  // every key point is there (a list missing one item is wrong at a real board); half or
  // more is "partly right" and earns reduced points.
  function grade(answer, q, title) {
    var c = contentScore(answer, q);
    var r = restateScore(answer, q.q);
    var result = {
      address: addressOk(answer, title),
      restate: r >= 0.5,
      restateScore: Math.round(r * 100),
      content: c.score >= 1,
      partial: c.score >= 0.5 && c.score < 1,
      contentScore: Math.round(c.score * 100),
      hit: c.hit,
      miss: c.miss,
      fillers: fillers(answer),
      blank: !clean(answer)
    };
    // Points-worthy "correct" means the content is right; format is scored separately.
    result.correct = result.content;
    result.formatPoints = (result.address ? 1 : 0) + (result.restate ? 1 : 0);
    return result;
  }

  // Reporting in: address the president and report.
  function gradeReport(text, rankName, lastName) {
    var a = clean(text);
    return {
      address: a.indexOf('sergeant major') === 0,
      reports: /\breport/.test(a),
      rank: rankName ? a.indexOf(clean(rankName)) >= 0 : true,
      name: lastName ? a.indexOf(clean(lastName)) >= 0 : true
    };
  }

  var api = {
    TITLES: TITLES, grade: grade, gradeReport: gradeReport,
    keyWords: keyWords, restateScore: restateScore, contentScore: contentScore, fillers: fillers, addressOk: addressOk
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BWC = root.BWC || {}; root.BWC.Grading = api; }
})(this);
