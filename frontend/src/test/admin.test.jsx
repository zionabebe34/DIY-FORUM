import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

/** Seed three open reports: two on post 24 (benchbot), one on carol's comment. */
function seedReports(server) {
  const r = (extra) => server.db.reports.push({
    id: Math.random(), reporter: 'bob', status: 'open', created_at: new Date().toISOString(), details: null, ...extra });
  r({ target_type: 'post', target_id: 24, author: 4, reason: 'spam', snapshot: 'Post number 24 bold', details: 'ads!' });
  r({ target_type: 'post', target_id: 24, author: 4, reason: 'hate', snapshot: 'Post number 24 bold', reporter: null });
  r({ target_type: 'comment', target_id: server.db.comments[0].id, author: 3, reason: 'harassment', snapshot: 'Great job!' });
}

async function openDashboard(as = 'alice') {
  const app = await renderApp({ as });
  seedReports(app.server);
  await app.user.click(screen.getByRole('button', { name: 'לוח ניהול' }));
  await screen.findByRole('heading', { name: 'לוח ניהול' });
  return app;
}

const caseCard = (text) => screen.getByText(text, { selector: 'span' }).closest('article');

describe('admin dashboard', () => {
  it('blocks non-staff users', async () => {
    const { user } = await renderApp({ as: 'bob', hash: '#/admin' });
    expect(await screen.findByText('העמוד הזה מיועד לצוות הניהול')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'לוח ניהול' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'חזרה לפיד' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('shows stats and grouped report cases', async () => {
    const { user } = await openDashboard();
    await waitFor(() => expect(screen.getByText('מקרים פתוחים').previousSibling).toHaveTextContent('2'));
    const post = caseCard('Post number 24 bold');
    expect(within(post).getByText(/2 דיווחים/)).toBeInTheDocument();
    expect(within(post).getByText('ספאם או פרסומת')).toBeInTheDocument();
    await user.click(within(post).getByRole('button', { name: /הצג את הדיווחים/ }));
    expect(within(post).getByText('@bob')).toBeInTheDocument();
    expect(within(post).getByText(/סינון אוטומטי/)).toBeInTheDocument();
    expect(within(post).getByText('"ads!"')).toBeInTheDocument();
    await user.click(within(post).getByRole('button', { name: /הסתר את הדיווחים/ }));
    await user.click(screen.getByRole('button', { name: /רענון/ }));
  });

  it('deletes reported content and moves the case to "handled"', async () => {
    const { user, server } = await openDashboard();
    const post = await waitFor(() => caseCard('Post number 24 bold'));
    await user.click(within(post).getByRole('button', { name: /מחק תוכן/ }));
    await waitFor(() => expect(screen.queryByText('Post number 24 bold', { selector: 'span' })).not.toBeInTheDocument());
    expect(server.db.posts.some(p => p.id === 24)).toBe(false);
    await user.click(screen.getByRole('tab', { name: /טופלו/ }));
    const done = await screen.findByText('Post number 24 bold', { selector: 'span' });
    expect(done.closest('article')).toHaveTextContent('התוכן נמחק');
    expect(done.closest('article')).toHaveTextContent('התוכן כבר לא קיים');
  });

  it('dismisses a case and reports action errors', async () => {
    const { user, server } = await openDashboard();
    const comment = await waitFor(() => caseCard('Great job!'));
    server.fetch.failNext = 'POST /api/admin/cases/dismiss';
    await user.click(within(comment).getByRole('button', { name: /אין הפרה/ }));
    expect(await screen.findByText('שגיאת שרת')).toBeInTheDocument();
    await user.click(within(comment).getByRole('button', { name: /אין הפרה/ }));
    await waitFor(() => expect(screen.queryByText('Great job!', { selector: 'span' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /טופלו/ }));
    expect(await screen.findByText('נסגר ללא הפרה')).toBeInTheDocument();
  });

  it('bans the author from a case card', async () => {
    const { user, server } = await openDashboard();
    const post = await waitFor(() => caseCard('Post number 24 bold'));
    await user.click(within(post).getByRole('button', { name: /חסום את/ }));
    const form = within(screen.getByText(/חסימת BenchBot/).closest('form'));
    await user.type(form.getByPlaceholderText(/סיבת החסימה/), 'bot spam');
    await user.click(form.getByRole('button', { name: 'חסום' }));
    await waitFor(() => expect(server.db.users.find(u => u.username === 'benchbot').is_banned).toBe(true));
    expect(await screen.findByText(/@benchbot נחסם/)).toBeInTheDocument();
  });

  it('shows the empty state and a load error', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    await user.click(screen.getByRole('button', { name: 'לוח ניהול' }));
    expect(await screen.findByText(/אין דיווחים פתוחים/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /טופלו/ }));
    expect(await screen.findByText('עוד לא טופלו דיווחים')).toBeInTheDocument();
    server.fetch.failNext = 'GET /api/admin/reports';
    await user.click(screen.getByRole('tab', { name: /דיווחים פתוחים/ }));
    await user.click(await screen.findByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByText(/אין דיווחים פתוחים/)).toBeInTheDocument();
  });

  it('manages users: filter, search, roles, ban and unban', async () => {
    const { user, server } = await openDashboard();
    await user.click(screen.getByRole('tab', { name: /משתמשים/ }));
    await screen.findByText('carol@example.com', { exact: false });
    // promote bob to moderator
    await user.selectOptions(screen.getByLabelText('תפקיד של bob'), 'moderator');
    await waitFor(() => expect(server.db.users.find(u => u.username === 'bob').role).toBe('moderator'));
    // ban carol from the list, then unban via the "banned" filter
    const carolRow = (await screen.findByText(/carol@example.com/)).closest('li');
    await user.click(within(carolRow).getByRole('button', { name: /חסום/ }));
    const form = within(screen.getByText(/חסימת Carol/).closest('form'));
    await user.click(form.getByRole('button', { name: 'ביטול' }));
    await user.click(within(carolRow).getByRole('button', { name: /חסום/ }));
    await user.click(within(screen.getByText(/חסימת Carol/).closest('form')).getByRole('button', { name: 'חסום' }));
    await waitFor(() => expect(server.db.users.find(u => u.username === 'carol').is_banned).toBe(true));

    await user.selectOptions(screen.getByLabelText('סינון'), 'banned');
    const banned = await screen.findByText(/carol@example.com/);
    await user.click(within(banned.closest('li')).getByRole('button', { name: 'הסר חסימה' }));
    await waitFor(() => expect(server.db.users.find(u => u.username === 'carol').is_banned).toBe(false));

    await user.selectOptions(screen.getByLabelText('סינון'), 'all');
    await user.type(screen.getByLabelText('חיפוש משתמשים'), 'zzz');
    expect(await screen.findByText('לא נמצאו משתמשים')).toBeInTheDocument();
  });

  it('shows errors from user actions', async () => {
    const { user, server } = await openDashboard();
    await user.click(screen.getByRole('tab', { name: /משתמשים/ }));
    await screen.findByText(/bob@example.com/);
    server.fetch.failNext = 'PUT /api/admin/users';
    await user.selectOptions(screen.getByLabelText('תפקיד של bob'), 'admin');
    expect(await screen.findByText('שגיאת שרת')).toBeInTheDocument();

    const carolRow = screen.getByText(/carol@example.com/).closest('li');
    await user.click(within(carolRow).getByRole('button', { name: /חסום/ }));
    server.fetch.failNext = 'POST /api/admin/users/carol/ban';
    await user.click(within(screen.getByText(/חסימת Carol/).closest('form')).getByRole('button', { name: 'חסום' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת שרת');
  });

  it('a moderator cannot change roles or act on staff', async () => {
    const { user } = await renderApp({ as: 'bob', setup: (srv) => { srv.db.users.find(u => u.username === 'bob').role = 'moderator'; } });
    await user.click(screen.getByRole('button', { name: 'לוח ניהול' }));
    expect(await screen.findByText(/מחובר\/ת כמודרטור/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /משתמשים/ }));
    const carolRow = (await screen.findByText(/carol@example.com/)).closest('li');
    const aliceRow = screen.getByText(/alice@example.com/).closest('li');
    expect(screen.queryByLabelText(/תפקיד של/)).not.toBeInTheDocument();       // no role selects
    expect(within(carolRow).getByRole('button', { name: /חסום/ })).toBeInTheDocument();
    expect(within(aliceRow).queryByRole('button', { name: /חסום/ })).not.toBeInTheDocument();
  });
});

describe('password reset', () => {
  it('requests a reset link from the login dialog', async () => {
    const { user, server } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('התחבר'));
    await user.click(screen.getByRole('button', { name: 'שכחתי סיסמה' }));
    expect(screen.getByText('שכחתם סיסמה?')).toBeInTheDocument();
    await user.type(screen.getByLabelText('אימייל'), 'bob@example.com');
    await user.click(screen.getByRole('button', { name: 'שלחו לי קישור' }));
    expect(await screen.findByRole('status')).toHaveTextContent('אם הכתובת רשומה');
    expect(server.db.resets).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'חזרה להתחברות' }));
    expect(screen.getByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('sets a new password from a valid link', async () => {
    const app = await renderApp();
    app.server.db.resets.push({ token: 'tok-bob', user: 2, used: false });
    window.location.hash = '#/reset/tok-bob';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const { user, server } = app;
    expect(await screen.findByText('בחירת סיסמה חדשה')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();

    const [pw, confirm] = document.querySelectorAll('input[autocomplete=new-password]');
    await user.type(pw, 'short');
    await user.type(confirm, 'short');
    await user.click(screen.getByRole('button', { name: 'שמירת סיסמה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('לפחות 8');

    await user.clear(pw); await user.type(pw, 'new-password-1');
    await user.clear(confirm); await user.type(confirm, 'different-1');
    await user.click(screen.getByRole('button', { name: 'שמירת סיסמה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('לא תואמות');

    await user.click(screen.getByRole('button', { name: 'הצג' }));
    await user.clear(confirm); await user.type(confirm, 'new-password-1');
    await user.click(screen.getByRole('button', { name: 'שמירת סיסמה' }));
    expect(await screen.findByText('הסיסמה עודכנה')).toBeInTheDocument();
    expect(server.db.users.find(u => u.username === 'bob').password).toBe('new-password-1');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('logs out a logged-in user after reset, and handles server errors', async () => {
    const app = await renderApp({ as: 'bob' });
    app.server.db.resets.push({ token: 'tok-bob', user: 2, used: false });
    window.location.hash = '#/reset/tok-bob';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const { user, server } = app;
    await screen.findByText('בחירת סיסמה חדשה');
    const [pw, confirm] = document.querySelectorAll('input[autocomplete=new-password]');
    await user.type(pw, 'new-password-1');
    await user.type(confirm, 'new-password-1');
    server.fetch.failNext = 'POST /api/auth/reset';
    await user.click(screen.getByRole('button', { name: 'שמירת סיסמה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת שרת');
    await user.click(screen.getByRole('button', { name: 'שמירת סיסמה' }));
    expect(await screen.findByText('הסיסמה עודכנה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'לפיד' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(await screen.findByText('מה אתה עובד עליו?')).toBeInTheDocument();   // logged out
  });

  it('shows an invalid link and offers a new one', async () => {
    const { user } = await renderApp({ hash: '#/reset/bad-token' });
    expect(await screen.findByText('הקישור לא תקף')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'שלחו לי קישור חדש' }));
    expect(await screen.findByText('שכחתם סיסמה?')).toBeInTheDocument();
  });

  it('treats a network failure while checking the link as invalid', async () => {
    const app = await renderApp();
    app.server.fetch.failNext = 'GET /api/auth/reset';
    window.location.hash = '#/reset/x';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByText('הקישור לא תקף')).toBeInTheDocument();
  });
});
