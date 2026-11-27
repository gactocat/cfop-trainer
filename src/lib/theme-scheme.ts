// The app's theme as <html data-theme> has it (the head script sets it before
// the first paint, ColorTheme keeps it on the chosen theme, the system's when
// that is the choice), for what draws its own colours, such as the cubes'
// players: `apply` runs now and again whenever the theme changes.
export function watchDarkTheme(apply: (dark: boolean) => void): () => void {
  const html = document.documentElement;
  const read = () => apply(html.dataset.theme === 'dark');
  read();
  const observer = new MutationObserver(read);
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
