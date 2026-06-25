import { Html, Head, Main, NextScript } from 'next/document';

// Runs before first paint: set the theme class from localStorage so there's no
// flash of the wrong theme. Default is 'dark' for new visitors.
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme') || 'dark';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = saved === 'dark' || (saved === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
  } catch (_) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="FIFA World Cup 2026 prediction pool" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
