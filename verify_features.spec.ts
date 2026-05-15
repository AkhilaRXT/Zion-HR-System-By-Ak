import { test, expect } from '@playwright/test';

test('verify new features are visible', async ({ page }) => {
  const session = {
    empId: 'EMP003',
    name: 'Master Administrator',
    email: 'zioncommercialcreditampara@gmail.com',
    isAdmin: true,
    permissions: ['staff', 'attendance', 'leave', 'payroll', 'settings'],
    viewableBranches: ['ALL']
  };

  // Inject session before page loads
  await page.addInitScript((s) => {
    localStorage.setItem('zion_hr_v2_session', JSON.stringify(s));
  }, session);

  // Go to the app - using port 3001 as per log
  await page.goto('http://localhost:3001/dashboard');

  // Wait for the dashboard to load
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

  // Check for Documents in Sidebar
  const docLink = page.getByRole('link', { name: 'Documents' });
  await expect(docLink).toBeVisible();

  // Check for Reviews in Sidebar
  const perfLink = page.getByRole('link', { name: 'Reviews' });
  await expect(perfLink).toBeVisible();

  // Click on Documents and take a screenshot
  await docLink.click();
  await expect(page.getByRole('heading', { name: 'Document Management' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/document_management.png' });

  // Click on Reviews and take a screenshot
  await perfLink.click();
  await expect(page.getByRole('heading', { name: 'Performance Reviews' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/performance_reviews.png' });
});
