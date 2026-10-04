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
});
