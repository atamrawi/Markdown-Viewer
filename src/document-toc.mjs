import { slug as githubSlug } from 'github-slugger';
import { decodeHTML } from 'entities';

export const defaultOptions = Object.freeze({
  minLevel: 2,
  maxLevel: 4,
  format: 'bulleted',
  normalizeLevels: false,
  collapsible: false,
  slugStrategy: 'github',
});

/** A fresh instance per document; custom strategies map plain text to a base slug. */
export function createHeadingSlugger(strategy = 'github') {
  const baseSlug = strategy === 'github' ? githubSlug : strategy;
  if (typeof baseSlug !== 'function') throw new RangeError('Unknown TOC slug strategy');
  const occurrences = new Map();
  return {
    reset() { occurrences.clear(); },
    slug(text) {
      // github-slugger's Unicode table matches GitHub, including underscores and
      // uncollapsed spaces/hyphens: "🚀 Getting Started" -> "-getting-started".
      // https://github.com/Flet/github-slugger
      const candidate = baseSlug(text);
      // Our explicit fallback gives symbol-only headings a usable local target.
      const base = !candidate || /^-+$/.test(candidate) ? 'heading' : candidate;
      let result = base;
      // Reserve every emitted ID, including suffixes, before filtering levels.
      // Thus "a", "a", "a-1" become "a", "a-1", "a-1-1".
      while (occurrences.has(result)) {
        const count = (occurrences.get(base) || 0) + 1;
        occurrences.set(base, count);
        result = base + '-' + count;
      }
      occurrences.set(result, 0);
      return result;
    },
  };
}

/** Read Marked inline AST nodes, never parse Markdown formatting with regex. */
export function headingText(tokens = []) {
  return tokens.map(token => {
    if (token.type === 'html') return /^<br\b/i.test(token.text) ? ' ' : '';
    if (token.type === 'br') return ' ';
    if (token.tokens) return headingText(token.tokens);
    // Marked escapes code spans during lexing; decode once, as for text/entities.
    return decodeHTML(token.text || '');
  }).join('').replace(/[\r\n]/g, ' ');
}

/** Use the same AST text and IDs in both the main preview and its worker. */
export function createHeadingExtension(slugger) {
  return {
    name: 'heading',
    renderer(token) {
      const id = slugger.slug(headingText(token.tokens));
      return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
    },
  };
}

/** Accept a Marked block AST, or Markdown with its lexer supplied in options. */
export function extractHeadings(document, { lexer, slugStrategy = 'github' } = {}) {
  let tokens = document;
  if (typeof document === 'string') {
    if (typeof lexer !== 'function') throw new TypeError('Pass a Markdown lexer or a block AST');
    // Only delimit front matter here. Heading recognition belongs to the AST.
    const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(document);
    const hasMetadata = frontmatter && /^[^\s#:[\]{},]+[ \t]*:(?:[ \t]|$)/m.test(frontmatter[1]);
    const body = hasMetadata ? document.slice(frontmatter[0].length) : document;
    tokens = lexer(body);
  }
  const slugger = createHeadingSlugger(slugStrategy);
  const headings = [];
  function visit(blocks) {
    for (const token of blocks || []) {
      if (token.type === 'heading') {
        const text = headingText(token.tokens);
        headings.push({ level: token.depth, text, slug: slugger.slug(text) });
      } else if (token.type === 'list') {
        token.items.forEach(item => visit(item.tokens));
      } else if (token.type === 'blockquote') {
        visit(token.tokens);
      }
      // Code, inline code in paragraphs, raw HTML and YAML are not headings.
    }
  }
  visit(tokens);
  return headings;
}

function escapeLabel(text) {
  return text.replace(/([\\`*_[\]<>~&])/g, '\\$1');
}

/**
 * Pure TOC generation. All headings receive IDs before depth filtering.
 * generateTableOfContents(marked.lexer(body), options), or
 * generateTableOfContents(markdown, { lexer: marked.lexer, ...options }).
 * Raw input strips front matter before lexing; AST callers supply body tokens.
 */
export function generateTableOfContents(document, options = {}) {
  const settings = { ...defaultOptions, ...options };
  const { minLevel, maxLevel, format, normalizeLevels, collapsible } = settings;
  if (!Number.isInteger(minLevel) || !Number.isInteger(maxLevel) ||
      minLevel < 1 || maxLevel > 6 || minLevel > maxLevel) {
    throw new RangeError('TOC heading levels must satisfy 1 <= min <= max <= 6');
  }
  if (!['bulleted', 'numbered', 'plain'].includes(format)) throw new RangeError('Unknown TOC format');
  const headings = extractHeadings(document, settings)
    .filter(heading => heading.level >= minLevel && heading.level <= maxLevel);
  if (!headings.length) return '';
  const baseLevel = headings.reduce((minimum, heading) => Math.min(minimum, heading.level), 6);
  const parents = [];
  let rootCount = 0;
  const lines = headings.map(heading => {
    while (parents.length && parents[parents.length - 1].level >= heading.level) parents.pop();
    const parent = parents[parents.length - 1];
    const number = parent ? [...parent.number, ++parent.childCount] : [++rootCount];
    const depth = normalizeLevels ? parents.length : heading.level - baseLevel;
    parents.push({ level: heading.level, number, childCount: 0 });
    const indent = '  '.repeat(depth);
    if (format === 'plain') return indent + heading.text;
    const prefix = format === 'numbered' ? number.join('.') + (number.length === 1 ? '.' : '') : '-';
    return indent + prefix + ' [' + escapeLabel(heading.text) + '](#' + heading.slug + ')';
  });
  // Hierarchical prefixes such as 1.1 are text, not CommonMark list markers.
  // Hard breaks keep them on separate lines when the copied Markdown renders.
  const toc = lines.join(format === 'numbered' ? '  \n' : '\n');
  return collapsible && format !== 'plain'
    ? '<details>\n<summary>Table of Contents</summary>\n\n' + toc + '\n\n</details>'
    : toc;
}

function updateHtmlQuoteDepth(rawHtml, currentDepth) {
  let depth = currentDepth;
  const tagPattern = /<\/?(blockquote|q)\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(rawHtml || '')) !== null) {
    const tag = match[0];
    if (/^<\//.test(tag)) {
      depth = Math.max(0, depth - 1);
    } else if (!/\/>\s*$/.test(tag)) {
      depth += 1;
    }
  }
  return depth;
}

function joinSlideRawParts(parts) {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    if (out && !out.endsWith('\n') && !part.startsWith('\n')) {
      out += '\n\n';
    }
    out += part;
  }
  return out.trim();
}

function collectSlideSlugs(blockTokens, slugStrategy) {
  const slugger = createHeadingSlugger(slugStrategy);
  const slugs = [];
  function visit(list) {
    for (const token of list || []) {
      if (!token) continue;
      if (token.type === 'heading') {
        slugs.push(slugger.slug(headingText(token.tokens)));
      } else if (token.type === 'list') {
        (token.items || []).forEach(item => visit(item.tokens));
      } else if (token.type === 'blockquote') {
        visit(token.tokens);
      }
    }
  }
  visit(blockTokens);
  return slugs;
}

/**
 * Extract presentation slides from a Marked block AST or raw Markdown string:
 * - Top-level ATX `#` (level 1): title-only slide containing just the `#` heading.
 * - Top-level ATX `##` (level 2): full section slide including all contents and `###`–`######` subsections.
 * - Headings inside blockquotes (`>`), HTML `<blockquote>`/`<q>`, code fences, lists, or front matter never split slides.
 */
export function extractSlides(document, { lexer, slugStrategy = 'github' } = {}) {
  let tokens = document;
  if (typeof document === 'string') {
    if (typeof lexer !== 'function') throw new TypeError('Pass a Markdown lexer or a block AST');
    const frontmatter = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(document);
    const hasMetadata = frontmatter && /^[^\s#:[\]{},]+[ \t]*:(?:[ \t]|$)/m.test(frontmatter[1]);
    const body = hasMetadata ? document.slice(frontmatter[0].length) : document;
    tokens = lexer(body);
  }

  const sharedDefs = [];
  if (tokens && tokens.links && typeof tokens.links === 'object') {
    for (const [key, def] of Object.entries(tokens.links)) {
      if (def && def.href) {
        const safeTitle = def.title ? ' "' + String(def.title).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : '';
        sharedDefs.push('[' + key + ']: <' + def.href + '>' + safeTitle);
      }
    }
  }
  for (const token of tokens || []) {
    if (token && token.type === 'footnoteDefinition' && token.raw) {
      sharedDefs.push(token.raw.trim());
    }
  }
  const sharedDefinitions = sharedDefs.join('\n\n');

  const slides = [];
  let currentH2 = null;
  let htmlQuoteDepth = 0;

  function flushCurrentH2() {
    if (!currentH2) return;
    const bodyMarkdown = joinSlideRawParts(currentH2.parts);
    slides.push({
      kind: 'h2',
      title: currentH2.title,
      markdown: sharedDefinitions ? (bodyMarkdown + '\n\n' + sharedDefinitions) : bodyMarkdown,
      bodyMarkdown,
      slugs: collectSlideSlugs(currentH2.tokens, slugStrategy),
    });
    currentH2 = null;
  }

  for (const token of tokens || []) {
    if (!token || token.type === 'footnoteDefinition') continue;

    const isTopLevelHeading = token.type === 'heading' && htmlQuoteDepth === 0;
    const isAtxH1 = isTopLevelHeading && token.depth === 1 && /^ {0,3}#(?:[ \t]|\r?$)/m.test(token.raw || '');
    const isAtxH2 = isTopLevelHeading && token.depth === 2 && /^ {0,3}##(?:[ \t]|\r?$)/m.test(token.raw || '');

    if (isAtxH1) {
      flushCurrentH2();
      const title = headingText(token.tokens).trim();
      const bodyMarkdown = String(token.raw || '').trim();
      slides.push({
        kind: 'h1',
        title,
        markdown: sharedDefinitions ? (bodyMarkdown + '\n\n' + sharedDefinitions) : bodyMarkdown,
        bodyMarkdown,
        slugs: collectSlideSlugs([token], slugStrategy),
      });
      continue;
    }

    if (isAtxH2) {
      flushCurrentH2();
      currentH2 = {
        title: headingText(token.tokens).trim(),
        parts: [token.raw || ''],
        tokens: [token],
      };
      continue;
    }

    if (token.type === 'html') {
      htmlQuoteDepth = updateHtmlQuoteDepth(token.raw, htmlQuoteDepth);
    }

    if (currentH2) {
      currentH2.parts.push(token.raw || '');
      currentH2.tokens.push(token);
    }
  }

  flushCurrentH2();

  if (slides.length === 0) {
    const fallbackTokens = (tokens || []).filter(t => t && t.type !== 'footnoteDefinition');
    const bodyMarkdown = joinSlideRawParts(fallbackTokens.map(t => t.raw || ''));
    if (bodyMarkdown) {
      slides.push({
        kind: 'fallback',
        title: '',
        markdown: sharedDefinitions ? (bodyMarkdown + '\n\n' + sharedDefinitions) : bodyMarkdown,
        bodyMarkdown,
        slugs: collectSlideSlugs(fallbackTokens, slugStrategy),
      });
    }
  }

  return slides;
}
