import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, navigate } from './utils.jsx';

const posts = () => document.querySelectorAll('main article.paper-card');

describe('feed', () => {
  it('loads the global feed with real counts, rich text and images', async () => {
    await renderApp();
    expect(await screen.findByText(/Post number 25/)).toBeInTheDocument();
    // rich text is rendered (bold), tutorial card shows its title + steps
    expect(screen.getAllByText('bold')[0].tagName).toBe('STRONG');
    expect(await screen.findByText('Concrete countertop', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Pour')).toBeInTheDocument();
    // newest post has 2 likes and 2 comments from the fake server
    const first = posts()[0];
    expect(within(first).getByTitle('תגובות')).toHaveTextContent('2');
  });

  it('lazy-loads more posts as you scroll, then shows the end marker', async () => {
    await renderApp();
    await waitFor(() => expect(posts().length).toBe(25), { timeout: 5000 });
    expect(await screen.findByText(/הגעת לסוף הפיד/)).toBeInTheDocument();
  });

  it('filters by hashtag and clears the filter', async () => {
    const { user, server } = await renderApp();
    await screen.findByText(/Post number 25/);
    await user.click(screen.getAllByRole('button', { name: '#woodwork' })[0]);
    expect(await screen.findByText(/סינון לפי #woodwork/)).toBeInTheDocument();
    await waitFor(() => expect(server.db.calls.some(([, p]) => p.includes('tag=%23woodwork'))).toBe(true));
    await user.click(screen.getByRole('button', { name: /נקה סינון/ }));
    await waitFor(() => expect(screen.queryByText(/סינון לפי/)).not.toBeInTheDocument());
  });

  it('asks a guest to log in for the following tab, and shows it after login', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('tab', { name: /אנשים שאני עוקב/ }));
    const dialog = await screen.findByText('טוב שחזרת');
    expect(dialog).toBeInTheDocument();

    await user.type(screen.getByLabelText('אימייל או שם משתמש'), 'bob');
    await user.type(screen.getByLabelText('סיסמה'), 'password123');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    await waitFor(() => expect(screen.queryByText('טוב שחזרת')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /אנשים שאני עוקב/ }));
    // bob follows only alice → every post shown is by Alice Cohen
    await waitFor(() => expect(posts().length).toBeGreaterThan(0));
    await waitFor(() => posts().forEach(a => expect(a).toHaveTextContent('Alice Cohen')));
  });

  it('shows a login error for a wrong password', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('התחבר'));
    await user.type(screen.getByLabelText('אימייל או שם משתמש'), 'bob');
    await user.type(screen.getByLabelText('סיסמה'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('פרטי התחברות שגויים');
  });

  it('signs up a new user and logs out', async () => {
    const { user, server } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('הרשמה — בחינם'));
    await user.type(screen.getByLabelText('שם מלא'), 'Dana Tester');
    await user.type(screen.getByLabelText('שם משתמש'), 'dana');
    await user.type(screen.getByLabelText('אימייל'), 'dana@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'password123');
    await user.click(screen.getByRole('button', { name: 'הרשמה' }));
    expect(await screen.findByText(/מה בנית היום, Dana\?/)).toBeInTheDocument();
    expect(server.db.users.some(u => u.username === 'dana')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('התנתק'));
    expect(await screen.findByText('מה אתה עובד עליו?')).toBeInTheDocument();
  });

  it('switches between signup and login modes and closes with Escape', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('הרשמה — בחינם'));
    await user.click(screen.getByRole('button', { name: 'להתחברות' }));
    expect(screen.getByText('טוב שחזרת')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'להרשמה' }));
    expect(screen.getByText('בואו נבנה דברים')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('בואו נבנה דברים')).not.toBeInTheDocument());
  });

  it('searches people, posts and tags from the navbar', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByLabelText('חיפוש'));
    await user.type(screen.getByLabelText('חיפוש'), 'w');
    expect(await screen.findByText('#woodwork', { selector: 'div' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('חיפוש'));
    await user.type(screen.getByLabelText('חיפוש'), 'carol');
    const result = await screen.findByText('Carol Mizrahi', { selector: 'span' });
    await user.click(result);
    await waitFor(() => expect(window.location.hash).toBe('#/u/carol'));

    await user.type(screen.getByLabelText('חיפוש'), 'zzzz');
    expect(await screen.findByText(/לא נמצאו תוצאות/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('opens a tag from the search box and from trending', async () => {
    const { user } = await renderApp();
    await user.type(screen.getByLabelText('חיפוש'), 'wood');
    const tag = await screen.findByText('#woodwork', { selector: 'div' });
    await user.click(tag);
    await waitFor(() => expect(window.location.hash).toBe('#/tag/woodwork'));
    navigate('#/');
    await user.click(await screen.findByRole('button', { name: /welding/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/tag/welding'));
  });

  it('retries after a failed page load', async () => {
    const { user, server } = await renderApp();
    await screen.findByText(/Post number 25/);
    server.fetch.failNext = 'GET /api/feed';
    navigate('#/tag/metal');
    const retry = await screen.findByRole('button', { name: 'נסה שוב' });
    await user.click(retry);
    expect(await screen.findByText(/Post number 25/)).toBeInTheDocument();
  });
});
