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
      var searchReadOnly = (searchParams.get('readonly') || '').toLowerCase();
      var hashReadOnly = (hashParams.get('readonly') || '').toLowerCase();
      var isReadOnly = searchReadOnly !== '0' && searchReadOnly !== 'false' && hashReadOnly !== '0' && hashReadOnly !== 'false';
      document.documentElement.dataset.standaloneReadonly = isReadOnly ? 'true' : 'false';
      if (isReadOnly) {
        document.documentElement.dataset.standaloneControlsCollapsed = 'true';
      }
      var slidesParam = (searchParams.get('slides') || searchParams.get('slide') || hashParams.get('slides') || hashParams.get('slide') || '').toLowerCase();
      var modeParam = (searchParams.get('mode') || hashParams.get('mode') || '').toLowerCase();
      if (isReadOnly && (slidesParam === '1' || slidesParam === 'true' || slidesParam === 'yes' || modeParam === 'slides' || modeParam === 'slide')) {
        document.documentElement.dataset.slideMode = 'true';
      }
      var theme = searchParams.get('theme') || hashParams.get('theme');
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.dataset.theme = theme;
      }
      var width = searchParams.get('width') || hashParams.get('width') || localStorage.getItem('markdownViewerStandaloneWidth') || 'normal';
      if (['normal', 'wide', 'full'].indexOf(width) !== -1) {
        document.documentElement.dataset.standaloneWidth = width;
      }
      var fontSize = searchParams.get('fontSize') || searchParams.get('size') || hashParams.get('fontSize') || hashParams.get('size') || localStorage.getItem('markdownViewerFontSize');
      if (fontSize) {
        var parsedSize = parseInt(fontSize, 10);
        if (!isNaN(parsedSize) && parsedSize >= 10 && parsedSize <= 72) {
          document.documentElement.style.setProperty('--markdown-font-size', parsedSize + 'px');
          document.documentElement.dataset.markdownFontSize = String(parsedSize);
        }
      }
    }
  } catch (_) {}
})();
