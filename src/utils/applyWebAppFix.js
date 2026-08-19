import { Platform } from 'react-native';

const VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

const WEB_APP_CSS = `
  html, body, #root {
    height: 100%;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }
  #root {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  input, textarea, select {
    font-size: 16px !important;
  }
  input:focus, textarea:focus, select:focus {
    font-size: 16px !important;
  }
  [role="button"], button, a {
    cursor: pointer !important;
  }
`;

let applied = false;

export function applyWebAppFix() {
  if (applied || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  applied = true;

  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', VIEWPORT);

  if (!document.getElementById('mystoneinn-web-app-fix')) {
    const style = document.createElement('style');
    style.id = 'mystoneinn-web-app-fix';
    style.textContent = WEB_APP_CSS;
    document.head.appendChild(style);
  }

  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.overflow = 'auto';
}
