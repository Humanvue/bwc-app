// 25 m zero adjustment drill. Built once the zeroing facts are extracted and verified
// (see drills-data.js). Until then the drills menu hides this card.
(function () {
  BWC.Zero = { view: function () { location.hash = '#/drills#weapons'; } };
})();
