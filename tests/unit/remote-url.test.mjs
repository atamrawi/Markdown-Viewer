import test from 'node:test';
import assert from 'node:assert/strict';

function resolveMarkdownUrlInfo(input) {
  const rawInput = (input || '').trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(rawInput);
  } catch (_) {
    throw new Error('Invalid URL provided.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are supported.');
  }

  const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
  const segments = parsedUrl.pathname.split('/').filter(Boolean);

  // GitHub blob URL: github.com/:owner/:repo/blob/:ref/...path
  if (host === 'github.com' && segments.length >= 4 && segments[2] === 'blob') {
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, '');
    const ref = segments[3];
    const filePathSegments = segments.slice(4);
    const filePath = filePathSegments.map(decodeURIComponent).join('/');
    const fileName = decodeURIComponent(filePathSegments[filePathSegments.length - 1] || `${repo}.md`);
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${filePathSegments.map(encodeURIComponent).join('/')}`;
    const dirSegments = filePathSegments.slice(0, -1);
    const baseUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${dirSegments.length ? dirSegments.map(encodeURIComponent).join('/') + '/' : ''}`;
    return {
      owner,
      repo,
      ref,
      filePath,
      title: fileName,
      rawUrl,
      baseUrl,
      apiUrl: `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePathSegments.map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`
    };
  }

  // GitHub raw URL: raw.githubusercontent.com/:owner/:repo/:ref/...path
  if (host === 'raw.githubusercontent.com' && segments.length >= 3) {
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, '');
    const ref = segments[2];
    const filePathSegments = segments.slice(3);
    const filePath = filePathSegments.map(decodeURIComponent).join('/');
    const fileName = decodeURIComponent(filePathSegments[filePathSegments.length - 1] || `${repo}.md`);
    const baseUrl = rawInput.substring(0, rawInput.lastIndexOf('/') + 1);
    return {
      owner,
      repo,
      ref,
      filePath,
      title: fileName,
      rawUrl: rawInput,
      baseUrl,
      apiUrl: `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePathSegments.map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`
    };
  }

  // GitHub Gist: gist.github.com/:user/:gistId
  if (host === 'gist.github.com' && segments.length >= 2) {
    const gistId = segments[1];
    return {
      gistId,
      title: `Gist ${gistId}`,
      rawUrl: null,
      baseUrl: null,
      apiUrl: `https://api.github.com/gists/${encodeURIComponent(gistId)}`
    };
  }

  // Generic / raw URL
  const lastSegment = segments[segments.length - 1] || 'Document.md';
  return {
    title: decodeURIComponent(lastSegment),
    rawUrl: rawInput,
    baseUrl: rawInput.includes('/') ? rawInput.substring(0, rawInput.lastIndexOf('/') + 1) : rawInput,
    apiUrl: null
  };
}

test('resolves GitHub blob URL to raw URL and API URL', () => {
  const resolved = resolveMarkdownUrlInfo('https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/docs/sub/README.md');
  assert.equal(resolved.owner, 'ThisIs-Developer');
  assert.equal(resolved.repo, 'Markdown-Viewer');
  assert.equal(resolved.ref, 'main');
  assert.equal(resolved.filePath, 'docs/sub/README.md');
  assert.equal(resolved.title, 'README.md');
  assert.equal(resolved.rawUrl, 'https://raw.githubusercontent.com/ThisIs-Developer/Markdown-Viewer/main/docs/sub/README.md');
  assert.equal(resolved.baseUrl, 'https://raw.githubusercontent.com/ThisIs-Developer/Markdown-Viewer/main/docs/sub/');
  assert.equal(resolved.apiUrl, 'https://api.github.com/repos/ThisIs-Developer/Markdown-Viewer/contents/docs/sub/README.md?ref=main');
});

test('resolves GitHub raw URL correctly', () => {
  const resolved = resolveMarkdownUrlInfo('https://raw.githubusercontent.com/owner/my-repo/master/docs/guide.md');
  assert.equal(resolved.owner, 'owner');
  assert.equal(resolved.repo, 'my-repo');
  assert.equal(resolved.ref, 'master');
  assert.equal(resolved.filePath, 'docs/guide.md');
  assert.equal(resolved.title, 'guide.md');
  assert.equal(resolved.rawUrl, 'https://raw.githubusercontent.com/owner/my-repo/master/docs/guide.md');
  assert.equal(resolved.baseUrl, 'https://raw.githubusercontent.com/owner/my-repo/master/docs/');
});

test('resolves generic raw Markdown URL', () => {
  const resolved = resolveMarkdownUrlInfo('https://example.com/files/notes.markdown');
  assert.equal(resolved.title, 'notes.markdown');
  assert.equal(resolved.rawUrl, 'https://example.com/files/notes.markdown');
  assert.equal(resolved.baseUrl, 'https://example.com/files/');
  assert.equal(resolved.apiUrl, null);
});

test('resolves GitHub gist URL', () => {
  const resolved = resolveMarkdownUrlInfo('https://gist.github.com/octocat/6cad326836d38bd3a7ae');
  assert.equal(resolved.gistId, '6cad326836d38bd3a7ae');
  assert.equal(resolved.apiUrl, 'https://api.github.com/gists/6cad326836d38bd3a7ae');
});

test('rejects non-HTTP protocols', () => {
  assert.throws(() => resolveMarkdownUrlInfo('javascript:alert(1)'), /Only HTTP\/HTTPS URLs are supported/);
  assert.throws(() => resolveMarkdownUrlInfo('file:///etc/passwd'), /Only HTTP\/HTTPS URLs are supported/);
});
