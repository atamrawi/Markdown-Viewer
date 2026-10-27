import { test, expect } from '@playwright/test';

test.describe('Remote URL and Parameter Viewer', () => {
  test('loads remote GitHub markdown file and sets preview-only with custom theme and fullscreen parameters', async ({ page }) => {
    // Mock the remote raw GitHub URL response
    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/guide.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Welcome to Remote Guide\n\nThis is a fetched read-only markdown file.\n\n- Feature A\n- Feature B'
      });
    });

    // Navigate with URL parameters: url, theme=dark, mode=preview, fullscreen=1
    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/guide.md&theme=dark&fullscreen=1&readonly=1');

    // Wait for the app to finish loading
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    // Verify dark theme applied
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Verify preview mode applied
    const container = page.locator('.content-container');
    await expect(container).toHaveClass(/view-preview-only/);

    // Verify the preview contains the rendered content
    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Welcome to Remote Guide');
    await expect(preview.locator('li').first()).toHaveText('Feature A');

    // Verify standalone reader mode is active
    await expect(page.locator('body')).toHaveClass(/standalone-file-mode/);
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('#tab-bar')).toBeHidden();
    await expect(page.locator('#markdown-format-toolbar')).toBeHidden();

    // Verify top-right floating theme toggle is visible and works
    const standaloneToggle = page.locator('#standalone-theme-toggle');
    await expect(standaloneToggle).toBeVisible();
    await standaloneToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await standaloneToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Verify top-right floating reader width toggle is visible and cycles widths
    const widthToggle = page.locator('#standalone-width-toggle');
    await expect(widthToggle).toBeVisible();
    await widthToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-standalone-width', 'wide');
    await widthToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-standalone-width', 'full');
    await widthToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-standalone-width', 'normal');

    // Verify top-right floating font size decrease and increase buttons
    const fontDecBtn = page.locator('#standalone-font-decrease');
    const fontIncBtn = page.locator('#standalone-font-increase');
    await expect(fontDecBtn).toBeVisible();
    await expect(fontIncBtn).toBeVisible();
    
    // Increase font size
    await fontIncBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-markdown-font-size', '18');
    await fontIncBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-markdown-font-size', '20');

    // Decrease font size
    await fontDecBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-markdown-font-size', '18');

    // Change width to wide
    await widthToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-standalone-width', 'wide');

    // Verify reset button restores width and font size to default
    const resetBtn = page.locator('#standalone-reset');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-markdown-font-size', '16');
    await expect(page.locator('html')).toHaveAttribute('data-standalone-width', 'normal');
  });

  test('loads remote Markdown with light theme and standalone reader mode', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/my-user/notes/master/README.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: '# Notes Readme\n\nSome notes here.'
      });
    });

    await page.goto('/?url=https://raw.githubusercontent.com/my-user/notes/master/README.md&theme=light');

    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Notes Readme');

    // Verify standalone reader mode is active: header, tab bar, toolbars hidden
    await expect(page.locator('body')).toHaveClass(/standalone-file-mode/);
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('#tab-bar')).toBeHidden();
    await expect(page.locator('#standalone-theme-toggle')).toBeVisible();
  });

  test('resolves relative image paths and links against the remote repository base URL', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/org/repo/main/docs/guides/intro.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Guide with relative assets\n\n![Screenshot](../../assets/images/3.png)\n\n[Related Docs](../architecture.md)'
      });
    });

    await page.goto('/?url=https://github.com/org/repo/blob/main/docs/guides/intro.md');

    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Guide with relative assets');

    // Verify image src was rewritten from ../../assets/images/3.png to https://raw.githubusercontent.com/org/repo/main/assets/images/3.png
    const img = preview.locator('.preview-image-container img');
    await expect(img).toHaveAttribute('src', 'https://raw.githubusercontent.com/org/repo/main/assets/images/3.png');

    const link = preview.locator('a:has-text("Related Docs")');
    await expect(link).toHaveAttribute('href', 'https://raw.githubusercontent.com/org/repo/main/docs/architecture.md');
  });

  test('immediately suppresses split view and editor workspace without flashing when loading remote URL', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/slow.md', async route => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Slow Loaded Document\n\nContent loaded after delay.'
      });
    });

    const navigationPromise = page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/slow.md');

    // Immediately after DOM loads, verify standalone mode is set on html and editor/header are hidden
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('html')).toHaveAttribute('data-standalone-mode', 'true');
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('.editor-pane')).toBeHidden();
    await expect(page.locator('#tab-bar')).toBeHidden();
    await expect(page.locator('#document-sidebar')).toBeHidden();

    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Slow Loaded Document');
  });

  test('displays a clean error card with reload button on fetch failure without flashing editor workspace', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/nonexistent.md', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: '404: Not Found'
      });
    });

    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/nonexistent.md');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    // Standalone reader mode is maintained
    await expect(page.locator('body')).toHaveClass(/standalone-file-mode/);
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('.editor-pane')).toBeHidden();
    await expect(page.locator('#tab-bar')).toBeHidden();

    // Clean error card is rendered in preview
    const errorContainer = page.locator('.remote-url-error-container');
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer.locator('.remote-url-error-title')).toHaveText('Unable to Load Document');
    await expect(errorContainer.locator('.remote-url-error-btn-primary')).toHaveText('Reload Page');

    // Right-click on the error view leaves native browser context menu intact
    const errorContextMenuPrevented = await page.locator('#markdown-preview').evaluate(el => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 120, clientY: 160 });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(errorContextMenuPrevented).toBe(false);
    await expect(page.locator('.document-menu-context.open')).toHaveCount(0);
  });

  test('disables custom context menu in read-only remote URL mode while keeping native browser context menu', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/readonly-menu.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Read Only Context Menu\n\nA **bold selection** in read-only mode.'
      });
    });

    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/readonly-menu.md');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Read Only Context Menu');

    // Dispatch contextmenu and verify defaultPrevented is false (native menu allowed) and custom menu stays closed
    const contextMenuPrevented = await preview.evaluate(el => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 120, clientY: 220 });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(contextMenuPrevented).toBe(false);
    await expect(page.locator('.document-menu-context.open')).toHaveCount(0);

    // Touch tap on selected text also does not open the custom surface menu
    await preview.locator('strong').evaluate(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await preview.locator('strong').dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, clientX: 100, clientY: 100 });
    await preview.locator('strong').dispatchEvent('click', { button: 0, clientX: 100, clientY: 100 });
    await expect(page.locator('.document-menu-context.open')).toHaveCount(0);
  });

  test('keeps custom context menu available when remote URL mode has readonly=0', async ({ page }) => {
    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/editable-menu.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Editable Remote Document\n\nCustom menu remains available when readonly=0.'
      });
    });

    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/editable-menu.md&readonly=0');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    const preview = page.locator('#markdown-preview');
    await expect(preview.locator('h1')).toHaveText('Editable Remote Document');

    await preview.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2 });
    await preview.dispatchEvent('contextmenu', { button: 2, clientX: 120, clientY: 220 });
    await expect(page.locator('.document-menu-context.open')).toBeVisible();
    await expect(page.locator('#standalone-slide-toggle')).toBeHidden();
  });

  test('supports slide mode in read-only remote URL mode with # title-only slides, ## full sections, and quote safety', async ({ page }) => {
    const deckMarkdown = [
      '# Architecture Presentation',
      '',
      'This intro under level 1 should be hidden in slide mode.',
      '',
      '## System Overview',
      '',
      'Top-level section content.',
      '',
      '> # Quoted Title Inside Blockquote',
      '> ## Quoted Section Inside Blockquote',
      '> Quoted explanation stays in System Overview.',
      '',
      '```markdown',
      '# Heading in Code Block',
      '## Subheading in Code Block',
      '```',
      '',
      '"## Quoted inline paragraph"',
      '',
      '### Core Components',
      '',
      'Subsection details under Core Components.',
      '',
      '#### Data Layer',
      '',
      'Deep subsection details.',
      '',
      '# Closing Chapter',
      '',
      'Hidden paragraph under second H1.',
      '',
      '## Next Steps',
      '',
      'Read the [Reference Guide][guide-link] to continue.',
      '',
      '[guide-link]: https://example.com/guide'
    ].join('\n');

    await page.route('https://raw.githubusercontent.com/test-org/test-repo/main/docs/slides.md', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: deckMarkdown
      });
    });

    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/slides.md');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');

    const preview = page.locator('#markdown-preview');
    const slideToggle = page.locator('#standalone-slide-toggle');
    const slideNav = page.locator('#standalone-slide-nav');
    const prevBtn = page.locator('#standalone-slide-prev');
    const nextBtn = page.locator('#standalone-slide-next');
    const counter = page.locator('#standalone-slide-counter');

    await expect(slideToggle).toBeVisible();
    await expect(slideNav).toBeHidden();

    // Enter Slide Mode
    await slideToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-slide-mode', 'true');
    await expect(slideNav).toBeVisible();
    await expect(counter).toHaveText('1 / 4');
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    // Slide 1: Level # shows ONLY the section title name
    await expect(preview).toHaveAttribute('data-slide-kind', 'h1');
    await expect(preview.locator('h1')).toHaveText('Architecture Presentation');
    await expect(preview).not.toContainText('This intro under level 1 should be hidden');

    // Slide 2: Level ## shows full contents, subsections, and keeps quoted/code headings inside this slide
    await nextBtn.click();
    await expect(counter).toHaveText('2 / 4');
    await expect(prevBtn).toBeEnabled();
    await expect(nextBtn).toBeEnabled();
    await expect(preview).toHaveAttribute('data-slide-kind', 'h2');
    await expect(preview.locator('> h2')).toHaveText('System Overview');
    await expect(preview.locator('h3')).toHaveText('Core Components');
    await expect(preview.locator('h4')).toHaveText('Data Layer');
    await expect(preview.locator('blockquote h2')).toHaveText('Quoted Section Inside Blockquote');
    await expect(preview).toContainText('Subheading in Code Block');

    // Slide 3 via keyboard ArrowRight: second Level # shows ONLY title
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('3 / 4');
    await expect(preview).toHaveAttribute('data-slide-kind', 'h1');
    await expect(preview.locator('h1')).toHaveText('Closing Chapter');
    await expect(preview).not.toContainText('Hidden paragraph under second H1.');

    // Slide 4: final ## section with bottom-of-file reference link resolved
    await nextBtn.click();
    await expect(counter).toHaveText('4 / 4');
    await expect(nextBtn).toBeDisabled();
    await expect(preview.locator('> h2')).toHaveText('Next Steps');
    await expect(preview.locator('a', { hasText: 'Reference Guide' })).toHaveAttribute('href', 'https://example.com/guide');

    // Navigate back with Previous button
    await prevBtn.click();
    await expect(counter).toHaveText('3 / 4');

    // Exit Slide Mode via Escape and verify full document is restored
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).not.toHaveAttribute('data-slide-mode', 'true');
    await expect(slideNav).toBeHidden();
    await expect(preview).toContainText('This intro under level 1 should be hidden in slide mode.');
    await expect(preview).toContainText('Next Steps');

    // Verify &slides=1 URL parameter launches directly into Slide Mode
    await page.goto('/?url=https://github.com/test-org/test-repo/blob/main/docs/slides.md&slides=1');
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-slide-mode', 'true');
    await expect(slideNav).toBeVisible();
    await expect(counter).toHaveText('1 / 4');
    await expect(preview.locator('h1')).toHaveText('Architecture Presentation');
  });
});

