// Early initialization script executed synchronously in <head>
(function() {
  try {
    var searchParams = new URLSearchParams(window.location.search);
    var hash = window.location.hash || '';
    var hashParams = new URLSearchParams();
    if (hash.includes('?')) {
      hashParams = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
    } else if (hash.startsWith('#url=') || hash.startsWith('#file=') || hash.startsWith('#src=') || hash.startsWith('#md=')) {
      hashParams = new URLSearchParams(hash.slice(1));
    }
    var hasRemote = Boolean(
      searchParams.get('url') || searchParams.get('file') || searchParams.get('src') || searchParams.get('md') ||
      hashParams.get('url') || hashParams.get('file') || hashParams.get('src') || hashParams.get('md')
    );
    if (hasRemote) {
      document.documentElement.dataset.standaloneMode = 'true';
      var theme = searchParams.get('theme') || hashParams.get('theme');
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.dataset.theme = theme;
      }
      var width = searchParams.get('width') || hashParams.get('width') || localStorage.getItem('markdownViewerStandaloneWidth') || 'normal';
      if (['normal', 'wide', 'full'].indexOf(width) !== -1) {
        document.documentElement.dataset.standaloneWidth = width;
      }
    }
  } catch (_) {}
})();
