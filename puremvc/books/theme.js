const storageKey = "game-dev-docs-theme";
const themeSelect = document.querySelector("#theme");

function applyTheme(choice) {
  if (choice === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = choice;
  if (themeSelect) themeSelect.value = choice;
  // The reader frame is same-origin and shares the website's theme.
  const frame = document.querySelector("#pdf-viewer");
  try {
    const root = frame?.contentDocument?.documentElement;
    if (root) root.style.colorScheme = choice === "system" ? "light dark" : choice;
  } catch (_) {}
}

let saved = "system";
try {
  const value = localStorage.getItem(storageKey);
  if (["light", "dark", "system"].includes(value)) saved = value;
} catch (_) {}
applyTheme(saved);

themeSelect?.addEventListener("change", () => {
  const choice = themeSelect.value;
  try { localStorage.setItem(storageKey, choice); } catch (_) {}
  applyTheme(choice);
});

document.querySelector("#pdf-viewer")?.addEventListener("load", () => {
  applyTheme(themeSelect?.value || saved);
});
