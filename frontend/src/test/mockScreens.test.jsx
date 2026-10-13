// Marketplace, store reviews and private messages, plus the mobile drawer.
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, navigate } from './utils.jsx';

describe('marketplace', () => {
  it('lists real listings, filters by type and category', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await user.click(screen.getAllByRole('button', { name: /^שוק$/ })[0]);
    expect(await screen.findByText('TIG welder')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /הכל/ })).toHaveTextContent('3');
    await user.click(screen.getByRole('tab', { name: /להשאלה/ }));
    await waitFor(() => expect(screen.queryByText('Chisel set')).not.toBeInTheDocument());
    expect(screen.getByText(/קהילתי/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /למכירה/ }));
    expect(await screen.findByText('Chisel set')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'כלי יד' }));
    await waitFor(() => expect(screen.queryByText('Impact driver')).not.toBeInTheDocument());
    expect(server.db.calls.some(([, p]) => p.includes('category=hand') && p.includes('type=sale'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'מכונות' }));
    expect(await screen.findByText('אין מודעות כאן עדיין')).toBeInTheDocument();
  });

  it('"buy" opens a private chat with the seller, pre-filled and with the listing attached', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/market' });
    const card = (await screen.findByText('Chisel set')).closest('article');
    await user.click(within(card).getByRole('button', { name: 'קנה עכשיו' }));
    const box = (await screen.findAllByLabelText('הודעה'))[0];
    expect(box.value).toContain('Chisel set');
    expect(screen.getAllByText('בנוגע למודעה:')[0]).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'שלח' })[0]);
    await waitFor(() => expect(server.db.messages.some(m => m.to === 1 && m.listing_id === 2)).toBe(true));
    expect((await screen.findAllByText(/Chisel set/)).length).toBeGreaterThan(0);
  });

  it('"lend" works from the feed teaser too; guests must log in', async () => {
    const { user } = await renderApp();
    const teaser = (await screen.findByText('שוק כלים באזורך')).closest('section');
    await user.click(within(teaser).getAllByRole('button', { name: /השאל|קנה/ })[0]);
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(teaser).getByRole('button', { name: /לכל המוצרים/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/market'));
    await user.click(await screen.findByRole('button', { name: /פרסם מודעה/ }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('owners and moderators can delete a listing; open a seller profile', async () => {
    const { user, server } = await renderApp({ as: 'alice', hash: '#/market' });   // alice is admin, sells the chisels
    const mine = (await screen.findByText('Chisel set')).closest('article');
    expect(within(mine).getByText('המודעה שלך')).toBeInTheDocument();
    await user.click(within(mine).getByRole('button', { name: /מחק/ }));
    await waitFor(() => expect(screen.queryByText('Chisel set')).not.toBeInTheDocument());
    const other = screen.getByText('Impact driver').closest('article');
    server.fetch.failNext = 'DELETE /api/listings';
    await user.click(within(other).getByRole('button', { name: 'מחק (ניהול)' }));
    expect(await screen.findByText('שגיאת שרת')).toBeInTheDocument();
    await user.click(within(other).getByRole('button', { name: /BenchBot|Bench/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/u/benchbot'));
  });

  it('publishes a new listing with a photo from the composer', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/market' });
    await user.click(await screen.findByRole('button', { name: /פרסם מודעה/ }));
    const dialog = within(screen.getByText('פוסט חדש').closest('.shadow-pop'));
    await user.selectOptions(dialog.getByLabelText('קטגוריה'), 'power');
    await user.type(dialog.getByPlaceholderText(/DeWalt/), 'Old drill');
    await user.type(dialog.getByPlaceholderText('320'), '150');
    await user.upload(document.querySelector('input[type=file]'), new File(['x'], 'drill.png', { type: 'image/png' }));
    expect(dialog.queryByRole('button', { name: 'הסר תמונה' })).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: /^פרסם$/ }));
    await waitFor(() => expect(server.db.listings.some(l => l.title === 'Old drill' && l.image_url && l.category === 'power')).toBe(true));
    expect(await screen.findByText('Old drill')).toBeInTheDocument();
  });

  it('publishes a lending listing and shows server errors', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/market' });
    await user.click(await screen.findByRole('button', { name: /פרסם מודעה/ }));
    const dialog = within(screen.getByText('פוסט חדש').closest('.shadow-pop'));
    await user.click(dialog.getByText('השאלה'));
    await user.type(dialog.getByPlaceholderText(/DeWalt/), 'Router');
    await user.type(dialog.getByPlaceholderText('60'), '40');
    await user.type(dialog.getByPlaceholderText('800'), '300');
    server.fetch.failNext = 'POST /api/listings';
    await user.click(dialog.getByRole('button', { name: /^פרסם$/ }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('שגיאת שרת');
    await user.click(dialog.getByRole('button', { name: /^פרסם$/ }));
    await waitFor(() => expect(server.db.listings.find(l => l.title === 'Router')).toMatchObject({ daily_price: 40, deposit: 300 }));
  });
});

describe('store reviews', () => {
  it('reviewing a new store creates it and opens its page', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/stores' });
    expect(await screen.findByText('Wood & Steel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));
    const submit = screen.getByRole('button', { name: 'פרסם ביקורת' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText('לדוגמה: פלדה ועץ'), 'Tool Barn');
    await user.type(screen.getByPlaceholderText('פלורנטין, תל אביב'), 'Haifa');
    fireEvent.mouseEnter(screen.getByRole('radio', { name: '3 כוכבים' }));
    fireEvent.mouseLeave(screen.getByRole('radiogroup', { name: 'דירוג' }));
    await user.click(screen.getByRole('radio', { name: '5 כוכבים' }));
    await user.type(screen.getByPlaceholderText(/ספר על השירות/), 'Great prices');
    await user.type(screen.getByPlaceholderText('לדוגמה: שירות מצוין'), 'friendly');
    await user.click(screen.getByRole('button', { name: /הוסף יתרון/ }));
    await user.click(screen.getAllByRole('button', { name: 'הסר שורה' })[0]);
    await user.type(screen.getByPlaceholderText('לדוגמה: יקר'), 'far');
    await user.click(screen.getByRole('button', { name: /הוסף חיסרון/ }));
    await user.click(submit);
    expect(await screen.findByRole('heading', { name: 'Tool Barn' })).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/store\/\d+$/);
    expect(server.db.reviews.find(r => r.body === 'Great prices')).toMatchObject({ rating: 5, cons: ['far'] });
    expect(screen.getByRole('button', { name: /ערוך את הביקורת שלי/ })).toBeInTheDocument();
  });

  it('shows a store page: sorting, reviewing, deleting, errors', async () => {
    const { user, server } = await renderApp({ as: 'alice', hash: '#/stores' });
    await user.click(await screen.findByText('Wood & Steel'));
    expect(await screen.findByRole('heading', { name: 'Wood & Steel' })).toBeInTheDocument();
    expect(screen.getByText('Helpful staff')).toBeInTheDocument();
    for (const label of ['הגבוהות', 'הנמוכות', 'אחרונות']) await user.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(server.db.calls.some(([, p]) => p.includes('sort=lowest'))).toBe(true));

    await user.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));
    await user.click(screen.getByRole('radio', { name: '4 כוכבים' }));
    server.fetch.failNext = 'POST /api/stores/reviews';
    await user.click(screen.getByRole('button', { name: 'פרסם ביקורת' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת שרת');
    await user.click(screen.getByRole('button', { name: 'פרסם ביקורת' }));
    await waitFor(() => expect(server.db.reviews.some(r => r.author === 1)).toBe(true));

    // alice is an admin → can delete any review
    const benchReview = screen.getByText('OK').closest('article');
    await user.click(within(benchReview).getByRole('button', { name: 'מחק ביקורת' }));
    await waitFor(() => expect(server.db.reviews.some(r => r.author === 4)).toBe(false));
    await user.click(screen.getAllByText('Carol Mizrahi')[0]);
    await waitFor(() => expect(window.location.hash).toBe('#/u/carol'));
    navigate('#/store/1');
    await user.click(await screen.findByRole('button', { name: /חזרה לרשימת החנויות/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/stores'));
  });

  it('empty store, missing store, load error, and guests must log in', async () => {
    const { user, server } = await renderApp({ hash: '#/store/2' });
    expect(await screen.findByText('אין עדיין ביקורות בקהילה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    navigate('#/store/999');
    expect(await screen.findByText('החנות לא נמצאה')).toBeInTheDocument();
    server.fetch.failNext = 'GET /api/stores/1';
    navigate('#/store/1');
    expect(await screen.findByText('שגיאה בטעינת החנות')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'חזרה לחנויות' }));
    await waitFor(() => expect(window.location.hash).toBe('#/stores'));
    await user.click(await screen.findByRole('button', { name: /כתוב ביקורת/ }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('shows the store list error and empty state', async () => {
    const { user, server } = await renderApp({ setup: (srv) => { srv.db.stores = []; } });
    server.fetch.failNext = 'GET /api/stores';
    navigate('#/stores');
    await user.click(await screen.findByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByText('עוד אין חנויות')).toBeInTheDocument();
  });
});

describe('messages', () => {
  it('shows only my conversations, opens a thread and replies', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await waitFor(() => expect(screen.getByTitle('הודעות')).toHaveTextContent('1'));   // unread badge
    await user.click(screen.getByTitle('הודעות'));
    const panel = within((await screen.findByText('הודעות', { selector: 'h2' })).closest('aside'));
    // bob talks to carol and alice — not to anyone else
    expect(await panel.findByText('Carol Mizrahi')).toBeInTheDocument();
    expect(panel.getByText('Alice Cohen')).toBeInTheDocument();
    await user.click(panel.getByText('Carol Mizrahi'));
    expect((await panel.findAllByText('Hi Bob, still need the welder?'))[0]).toBeInTheDocument();
    expect(panel.getAllByText('TIG welder')[0]).toBeInTheDocument();          // listing card in the message
    const box = panel.getAllByLabelText('הודעה')[0];
    await user.type(box, 'Yes please!{Enter}');
    expect((await panel.findAllByText('Yes please!'))[0]).toBeInTheDocument();
    expect(server.db.messages.at(-1)).toMatchObject({ from: 2, to: 3, body: 'Yes please!' });
    await user.type(box, 'FAIL{Enter}');
    expect((await panel.findAllByRole('alert'))[0]).toHaveTextContent('שגיאה מדומה');
    await user.keyboard('{Escape}');       // back to list (mobile)
    await user.keyboard('{Escape}');       // close
    await waitFor(() => expect(screen.queryByText('הודעות', { selector: 'h2' })).not.toBeInTheDocument());
  });

  it('starts a new conversation by searching for a user', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await user.click(screen.getByTitle('הודעות'));
    await user.click(await screen.findByTitle('הודעה חדשה'));
    await user.type((await screen.findAllByPlaceholderText(/חפש יוצר/))[0], 'benchbot');
    const panel = within(screen.getByText('הודעות', { selector: 'h2' }).closest('aside'));
    await user.click(await panel.findByText('BenchBot'));
    await user.type((await screen.findAllByPlaceholderText(/כתוב הודעה ל-/))[0], 'Hello bot{Enter}');
    await waitFor(() => expect(server.db.messages.some(m => m.to === 4 && m.body === 'Hello bot')).toBe(true));
    expect((await screen.findAllByText('Hello bot'))[0]).toBeInTheDocument();
  });

  it('opens a chat from a profile and an empty inbox', async () => {
    const { user } = await renderApp({ as: 'carol', setup: (srv) => { srv.db.messages = []; }, hash: '#/u/benchbot' });
    await user.click(await screen.findByRole('button', { name: /הודעה/ }));
    expect((await screen.findAllByText(/תחילת השיחה שלך עם/))[0]).toBeInTheDocument();
    await user.click(screen.getAllByTitle('הודעה חדשה')[0]);
    await user.click(screen.getAllByRole('button', { name: 'ביטול' })[0]);
  });

  it('alerts about a new message without a refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { server } = await renderApp({ as: 'alice' });
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      server.db.messages.push({ id: 999, from: 3, to: 1, body: 'Ping!', listing_id: null, read: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(10500); });
      expect(await screen.findByText(/הודעה חדשה מCarol Mizrahi/)).toBeInTheDocument();
      expect(screen.getByTitle('הודעות')).toHaveTextContent('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a guest is asked to log in for messages', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByTitle('הודעות'));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });
});

describe('mobile drawer', () => {
  it('mobile drawer navigates and opens panels', async () => {
    const { user } = await renderApp({ as: 'alice' });
    const openDrawer = () => user.click(screen.getByRole('button', { name: 'תפריט' }));
    await openDrawer();
    const drawer = () => within(document.querySelector('aside.animate-in-rtl-drawer'));
    await user.click(drawer().getByRole('button', { name: /ביקורות חנויות/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/stores'));
    await openDrawer();
    await user.click(drawer().getByRole('button', { name: /שוק/ }));
    await openDrawer();
    await user.click(drawer().getByRole('button', { name: /לוח ניהול/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/admin'));
    await openDrawer();
    await user.click(drawer().getByRole('button', { name: /^פיד/ }));
    for (const label of ['התראות', 'הודעות', 'שמורים']) {
      await openDrawer();
      await user.click(drawer().getByRole('button', { name: label }));
      await user.keyboard('{Escape}');
    }
    await openDrawer();
    fireEvent.click(document.querySelector('.fixed.inset-0.z-50.lg\\:hidden'));   // backdrop closes it
    await waitFor(() => expect(document.querySelector('aside.animate-in-rtl-drawer')).toBeNull());
  });
});
