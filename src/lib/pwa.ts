/**
 * Inline script for the root layout's <head> (installed-app support). It is a plain <script> on purpose:
 * next/script "beforeInteractive" inline code is queued until Next's runtime starts, which can be after the
 * browser's install offer and the page's load event. It:
 *  - keeps the browser's one-time "install" offer (Chrome/Edge/Samsung Internet fire it once, often before React
 *    has loaded) so the "Install the Casita app" button can use it later, and
 *  - registers the service worker (production only) for the offline page.
 */
export function installBootScript(registerServiceWorker: boolean): string {
  return [
    "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__cdjInstall=e;window.dispatchEvent(new Event('cdj-install'))});",
    "window.addEventListener('appinstalled',function(){window.__cdjInstall=null;window.dispatchEvent(new Event('cdj-install'))});",
    registerServiceWorker
      ? "if('serviceWorker' in navigator){var r=function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})};if(document.readyState==='complete')r();else window.addEventListener('load',r)}"
      : "",
  ].join("");
}
