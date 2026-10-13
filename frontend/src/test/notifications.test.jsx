// Notifications (bell badge, panel, filters, mark read, open the post) and saved items
// (save posts / listings, the Saved panel, unsave from anywhere, the single-post page).
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, navigate } from './utils.jsx';

const panel = async (title) => (await screen.findByText(title, { selector: 'h2' })).closest('aside');

describe('notifications', () => {
  it('shows the unread badge, filters, and marks everything as read', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    const bell = screen.getByTitle('התראות');
    await waitFor(() => expect(bell).toHaveTextContent('3'));

    await user.click(bell);
    const p = await panel('התראות');
    expect(await within(p).findByText('Bob Levi')).toBeInTheDocument();
    expect(within(p).getByText('3 התראות חדשות')).toBeInTheDocument();
    expect(within(p).getByText(/"Great job!"/)).toBeInTheDocument();
    expect(within(p).getByText('Welcome to HandyHub')).toBeInTheDocument();
    expect(within(p).getByText(/Post number 22/)).toBeInTheDocument();      // the liked post's title

    await user.click(within(p).getByRole('tab', { name: /תגובות ואיזכורים/ }));
    await waitFor(() => expect(within(p).queryByText('Bob Levi')).not.toBeInTheDocument());
    expect(within(p).getByText('Carol Mizrahi')).toBeInTheDocument();

    await user.click(within(p).getByRole('tab', { name: /לא נקראו/ }));
    await user.click(within(p).getByRole('button', { name: 'סמן הכל כנקרא' }));
    expect(await within(p).findByText('הכל מעודכן')).toBeInTheDocument();
    expect(server.db.notifications.every(n => n.user !== 1 || n.read)).toBe(true);
    await user.click(within(p).getByRole('tab', { name: /לא נקראו/ }));    // reload the unread list
    await user.click(within(p).getByRole('tab', { name: /^הכל$/ }));
    await user.click(within(p).getByRole('tab', { name: /לא נקראו/ }));
    expect(await within(p).findByText('אין התראות שלא נקראו.')).toBeInTheDocument();
    expect(bell).not.toHaveTextContent('3');
  });

  it('opens the post (with its comments) or the follower\'s profile', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    await user.click(screen.getByTitle('התראות'));
    let p = await panel('התראות');
    await user.click(await within(p).findByText(/"Great job!"/));
    await waitFor(() => expect(window.location.hash).toBe('#/post/25'));
    expect(await screen.findByText('Great job!')).toBeInTheDocument();          // comments are open
    expect(screen.queryByText('התראות', { selector: 'h2' })).toBeNull();        // panel closed
    expect(server.db.notifications.find(n => n.kind === 'comment').read).toBe(true);

    await user.click(screen.getByTitle('התראות'));
    p = await panel('התראות');
    await user.click(await within(p).findByText('Bob Levi'));
    await waitFor(() => expect(window.location.hash).toBe('#/u/bob'));

    // A system notification has nowhere to go; clicking keeps the panel open
    await user.click(screen.getByTitle('התראות'));
    p = await panel('התראות');
    await user.click(await within(p).findByText('Welcome to HandyHub'));
    expect(screen.getByText('התראות', { selector: 'h2' })).toBeInTheDocument();
  });

  it('a like notifies the author, and unliking takes it back', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await screen.findByText(/Post number 25/);
    const heart = () => document.querySelector('main article.paper-card button.relative');
    const hasLike = () => server.db.notifications.some(n => n.user === 1 && n.actor === 2 && n.kind === 'like');
    // bob already likes post 25: unlike (nothing to undo), like (notifies), unlike (takes it back)
    await user.click(heart());
    await waitFor(() => expect(server.db.likes.some(l => l.user === 2 && l.post === 25)).toBe(false));
    await user.click(heart());
    await waitFor(() => expect(hasLike()).toBe(true));
    await user.click(heart());
    await waitFor(() => expect(hasLike()).toBe(false));
  });

  it('pages with "load more" and recovers from errors', async () => {
    const { user, server } = await renderApp({
      as: 'bob',
      setup: (s) => {
        for (let i = 0; i < 35; i++) {
          s.db.notifications.push({ id: 1000 + i, user: 2, actor: 3, kind: 'like', post: 25, text: null, read: i > 2 });
        }
      },
    });
    await waitFor(() => expect(screen.getByTitle('התראות')).toHaveTextContent('3'));   // initial poll done
    server.fetch.failNext = 'GET /api/notifications';
    await user.click(screen.getByTitle('התראות'));
    const p = await panel('התראות');
    await user.click(await within(p).findByRole('button', { name: 'נסה שוב' }));
    await waitFor(() => expect(within(p).getAllByText('Carol Mizrahi')).toHaveLength(30));
    await user.click(within(p).getByRole('button', { name: 'טען עוד' }));
    await waitFor(() => expect(within(p).getAllByText('Carol Mizrahi')).toHaveLength(35));
    expect(within(p).queryByRole('button', { name: 'טען עוד' })).toBeNull();

    // marking one read fails quietly; the next load shows the truth
    server.fetch.failNext = 'POST /api/notifications/read';
    await user.click(within(p).getAllByText('Carol Mizrahi')[0]);
    await waitFor(() => expect(window.location.hash).toBe('#/post/25'));
  });
});

describe('saved items', () => {
  it('saves a post and a listing, lists them, and unsaves from the panel', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const saveBtn = (await screen.findAllByRole('button', { name: 'שמירה' }))[0];
    await user.click(saveBtn);
    await waitFor(() => expect(saveBtn).toHaveTextContent('נשמר'));
    expect(server.db.saves).toEqual([{ user: 2, post: 25 }]);
    expect(server.db.notifications.some(n => n.user === 1 && n.kind === 'save')).toBe(true);

    navigate('#/market');
    await screen.findByRole('tab', { name: /להשאלה/ });
    const card = (await screen.findByText('TIG welder')).closest('article');
    await user.click(within(card).getByRole('button', { name: 'שמור מודעה' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'הסר משמורים' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('פרויקטים שמורים'));
    const p = await panel('שמורים');
    expect(await within(p).findByText(/Post number 25/)).toBeInTheDocument();
    expect(within(p).getByText('1 פרויקטים · 1 כלים')).toBeInTheDocument();
    await user.click(within(p).getByRole('button', { name: /כלים/ }));
    expect(within(p).getByText('TIG welder')).toBeInTheDocument();
    expect(within(p).getByText(/90/)).toBeInTheDocument();

    // unsaving in the panel removes it there and on the market card
    await user.click(within(p).getByRole('button', { name: 'הסר משמורים' }));
    expect(await within(p).findByText('עוד לא שמרת כלים מהשוק.')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'שמור מודעה' })).toBeInTheDocument();
    expect(server.db.savedListings).toEqual([]);

    await user.click(within(p).getByRole('button', { name: /פרויקטים/ }));
    await user.click(within(p).getByText(/Post number 25/));
    await waitFor(() => expect(window.location.hash).toBe('#/post/25'));
    const post = (await screen.findByText(/Post number 25/)).closest('article');
    expect(within(post).getByRole('button', { name: 'נשמר' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /חזרה לפיד/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('"buy" from a saved listing opens a chat; unsaving a post empties the list', async () => {
    const { user } = await renderApp({
      as: 'bob',
      setup: (s) => { s.db.saves.push({ user: 2, post: 24 }); s.db.savedListings.push({ user: 2, listing: 2 }); },
    });
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('פרויקטים שמורים'));
    let p = await panel('שמורים');
    await within(p).findByText(/Post number 24/);
    await user.click(within(p).getByRole('button', { name: 'הסר משמורים' }));
    expect(await within(p).findByText(/עוד לא שמרת פרויקטים/)).toBeInTheDocument();

    await user.click(within(p).getByRole('button', { name: /כלים/ }));
    await user.click(within(p).getByRole('button', { name: 'קנה' }));
    const box = (await screen.findAllByLabelText('הודעה'))[0];
    expect(box.value).toContain('Chisel set');
  });

  it('rolls back a failed save, asks guests to log in, and shows load errors', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const saveBtn = (await screen.findAllByRole('button', { name: 'שמירה' }))[0];
    server.fetch.failNext = 'POST /api/posts/25/save';
    await user.click(saveBtn);
    expect(await screen.findByText('שגיאת שרת')).toBeInTheDocument();
    expect(saveBtn).toHaveTextContent('שמירה');

    server.fetch.failNext = 'GET /api/saved';
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('פרויקטים שמורים'));
    const p = await panel('שמורים');
    await user.click(await within(p).findByRole('button', { name: 'נסה שוב' }));
    expect(await within(p).findByText(/עוד לא שמרת פרויקטים/)).toBeInTheDocument();
  });

  it('a guest who clicks save is asked to log in', async () => {
    const { user } = await renderApp();
    await user.click((await screen.findAllByRole('button', { name: 'שמירה' }))[0]);
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('a missing post shows an error page', async () => {
    const { user } = await renderApp({ hash: '#/post/9999' });
    expect(await screen.findByText('הפוסט לא נמצא')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByText('הפוסט לא נמצא')).toBeInTheDocument();
  });
});
