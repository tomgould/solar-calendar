/* Applies the chosen theme before first paint. Load it in <head>, without
   defer, so there is no flash. "System" leaves data-theme off. */
(function () {
  try {
    var t = localStorage.getItem('almanac-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system */ }
})();
