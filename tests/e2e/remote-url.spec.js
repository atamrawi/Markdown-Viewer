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
  });
});

