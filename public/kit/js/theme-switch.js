/* Makes the System / Light / Dark switches work and keeps them in step.
   Markup: snippets/theme-switch.html. Load with defer. */
(function () {
  var root = document.documentElement;
  var switches = document.querySelectorAll('[data-theme-switch]');
  var show = function (value) {
    switches.forEach(function (form) {
      var input = form.querySelector('input[value="' + value + '"]');
      if (input) input.checked = true;
    });
  };
  var stored = 'system';
  try { stored = localStorage.getItem('almanac-theme') || 'system'; } catch (e) { /* blocked */ }
  show(stored);
  switches.forEach(function (form) {
    form.hidden = false;
    form.addEventListener('change', function (event) {
      var value = event.target.value;
      if (value === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', value);
      try { localStorage.setItem('almanac-theme', value); } catch (e) { /* blocked */ }
      show(value);
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: value } }));
    });
  });
})();
