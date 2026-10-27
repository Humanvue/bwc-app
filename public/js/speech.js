// Text-to-speech shared by the mock board and audio flashcards, with iPhone workarounds:
// - iPhones list voices that aren't downloaded (and novelty voices); picking one of those plays
//   nothing, so on iPhone/iPad the system default voice is used and seats differ by pitch only.
// - Safari can drop speech started right after cancel(), so a short gap follows any cancel.
// - iPhones only allow speech that starts from a tap; unlock() must run inside a tap handler.
(function () {
  var synth = window.speechSynthesis;
  var supported = !!synth && 'SpeechSynthesisUtterance' in window;
  var apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandma|Grandpa|Rocko|Shelley|Sandy|Flo|Eddy|Reed/i;

  function voices() {
    if (!supported || apple) return [];
    return synth.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang) && !NOVELTY.test(v.name) && v.localService !== false; });
  }
  if (supported && synth.addEventListener) synth.addEventListener('voiceschanged', function () {});

  // speak(text, { voiceIndex, pitch, rate, onend })
  function speak(text, opts) {
    opts = opts || {};
    if (!supported) { if (opts.onend) setTimeout(opts.onend, 0); return; }
    var busy = synth.speaking || synth.pending;
    if (busy) synth.cancel();
    var go = function () {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      var vs = voices();
      if (vs.length && opts.voiceIndex != null) u.voice = vs[opts.voiceIndex % vs.length];
      u.pitch = opts.pitch || 1;
      u.rate = opts.rate || 1;
      u.volume = 1;
      if (opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
      if (synth.paused) synth.resume();
      synth.speak(u);
    };
    if (busy) setTimeout(go, 150); else go();
  }

  function cancel() { if (supported) synth.cancel(); }

  // Call from a tap: a real (short, quiet) utterance unlocks speech on iPhone for the session.
  function unlock() {
    if (!supported) return;
    var u = new SpeechSynthesisUtterance('.');
    u.volume = 0.01;
    u.lang = 'en-US';
    synth.speak(u);
  }

  var TIP = 'No sound? On iPhone, turn off silent mode (ring/silent switch or Action button) and turn up the volume.';

  // A "Test speaker" button: speaks right away from the tap.
  function testButton(id) {
    return '<button type="button" class="btn small ghost" id="' + id + '">' + BWC.UI.icon('mic', 16) + 'Test speaker</button>';
  }
  function wireTest(id, line) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { speak(line || 'Sergeant Major. Voice check. One, two, three.'); });
  }

  window.BWC = window.BWC || {};
  BWC.Speech = { supported: supported, apple: apple, speak: speak, cancel: cancel, unlock: unlock, TIP: TIP, testButton: testButton, wireTest: wireTest };
})();
