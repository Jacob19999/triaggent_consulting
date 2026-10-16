// Shared by the root layout (server) and the theme hook (client).
export const THEME_KEY = "foodbridge.theme";

/** Runs in <head> before paint so the first frame already has the right theme. Dark is the default. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'dark';var t=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`;
