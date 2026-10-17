// Apply a saved theme before the first paint, so dark mode never flashes white.
// A separate file rather than an inline script, so the Content-Security-Policy
// can forbid inline scripts.
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {}
