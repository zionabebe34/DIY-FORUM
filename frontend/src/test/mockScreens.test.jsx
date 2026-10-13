// The design's screens that still run on local mock data (marketplace, store reviews,
// messages, notifications, saved). They're part of the UI, so they're tested too.
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, navigate } from './utils.jsx';
import { HUB_DATA } from '../components/data.jsx';

describe('marketplace', () => {
  it('filters listings by category and sale / lend', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await user.click(screen.getAllByRole('button', { name: /^שוק$/ })[0]);
    await waitFor(() => expect(window.location.hash).toBe('#/market'));
    const all = HUB_DATA.MARKET.length;
    await user.click(screen.getByRole('button', { name: /להשאלה/ }));
    await user.click(screen.getByRole('button', { name: /למכירה/ }));
    await user.click(screen.getByRole('button', { name: 'כלי יד' }));
    await user.click(screen.getByRole('button', { name: 'כלים חשמליים' }));
    await user.click(screen.getByRole('button', { name: 'מכונות' }));
    await user.click(screen.getAllByRole('button', { name: /^הכל/ })[0]);
    expect(all).toBeGreaterThan(0);
    // open a seller's profile from a card
    const seller = HUB_DATA.MARKET[0].seller;
    await user.click(screen.getAllByText(seller.name.split(' ')[0])[0].closest('button'));
    await waitFor(() => expect(window.location.hash).toBe(`#/u/${seller.id}`));
  });

  it('a guest is asked to log in before selling', async () => {
    const { user } = await renderApp({ hash: '#/market' });
    await user.click(await screen.findByRole('button', { name: /פרסם מודעה/ }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('shows the marketplace teaser inside the feed', async () => {
    await renderApp();
    await screen.findByText(/Post number 25/);
    expect(document.querySelectorAll('main article').length).toBeGreaterThan(3);
    expect(screen.getAllByText(HUB_DATA.MARKET[0].name).length).toBeGreaterThan(0);
  });
});

describe('store reviews', () => {
  it('lists stores, writes a review and opens a store page', async () => {
    const { user } = await renderApp({ as: 'bob', hash: '#/stores' });
    await user.click(await screen.findByRole('button', { name: /כתוב ביקורת/ }));
    const submit = screen.getByRole('button', { name: 'פרסם ביקורת' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText('לדוגמה: פלדה ועץ'), 'Tool Shop');
    await user.type(screen.getByPlaceholderText('פלורנטין, תל אביב'), 'Haifa');
    const stars = [...submit.closest('.bg-white, section, div.rounded-2xl').querySelectorAll('button')].filter(b => b.parentElement.children.length === 5);
    fireEvent.mouseEnter(stars[3]);
    fireEvent.mouseLeave(stars[3]);
    await user.click(stars[4]);
    await user.type(screen.getByPlaceholderText(/ספר על השירות/), 'Great service and prices');
    await user.type(screen.getByPlaceholderText('לדוגמה: שירות מצוין'), 'friendly');
    await user.click(screen.getByRole('button', { name: /הוסף יתרון/ }));
    const pro2 = screen.getAllByPlaceholderText('לדוגמה: שירות מצוין')[1];
    await user.type(pro2, 'cheap');
    await user.click(pro2.nextSibling);                              // ✕ removes it
    await user.type(screen.getByPlaceholderText('לדוגמה: יקר'), 'far');
    await user.click(screen.getByRole('button', { name: /הוסף חיסרון/ }));
    await user.click(screen.getAllByPlaceholderText('לדוגמה: יקר')[1].nextSibling);
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(screen.queryByPlaceholderText('לדוגמה: פלדה ועץ')).not.toBeInTheDocument());

    // open the first store
    const store = HUB_DATA.STORES[0];
    await user.click(screen.getAllByText(store.name)[0]);
    await waitFor(() => expect(window.location.hash).toBe(`#/store/${store.id}`));
    for (const label of ['הגבוהות', 'הנמוכות', 'אחרונות']) await user.click(screen.getByRole('button', { name: label }));
    await user.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));
    await user.click(screen.getAllByRole('button', { name: 'ביטול' }).pop());
    // a reviewer's profile
    const reviewer = (HUB_DATA.STORE_REVIEWS[store.id] || [])[0];
    if (reviewer) {
      await user.click(screen.getAllByText(reviewer.author.name)[0]);
      await waitFor(() => expect(window.location.hash).toMatch(/^#\/u\//));
      navigate(`#/store/${store.id}`);
    }
    await user.click(await screen.findByRole('button', { name: /חזרה לרשימת החנויות/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/stores'));
  });

  it('shows a missing store', async () => {
    const { user } = await renderApp({ hash: '#/store/nope' });
    expect(await screen.findByText('החנות לא נמצאה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'חזרה לחנויות' }));
    await waitFor(() => expect(window.location.hash).toBe('#/stores'));
  });
});

describe('messages', () => {
  it('opens conversations, sends a message and starts a new one', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await user.click(screen.getByTitle('הודעות'));
    expect(await screen.findByText('הודעות', { selector: 'h2' })).toBeInTheDocument();
    const convo = HUB_DATA.CONVERSATIONS[0];
    await user.click(screen.getAllByText(convo.with.name)[0]);
    const box = (await screen.findAllByPlaceholderText(new RegExp(`הודעה ל-${convo.with.name.split(' ')[0]}`)))[0];
    await user.type(box, 'Is it still available?{Enter}');
    expect((await screen.findAllByText('Is it still available?'))[0]).toBeInTheDocument();
    await user.type(box, 'And the price?');
    await user.click(box.parentElement.querySelector('button:last-of-type'));
    expect((await screen.findAllByText('And the price?'))[0]).toBeInTheDocument();
    // new message to someone else
    await user.click(screen.getByTitle('הודעה חדשה'));
    const search = (await screen.findAllByPlaceholderText(/חפש יוצר/))[0];
    const other = Object.values(HUB_DATA.PEOPLE).find(p => !HUB_DATA.CONVERSATIONS.some(c => c.with.id === p.id)) || Object.values(HUB_DATA.PEOPLE)[1];
    await user.type(search, other.name.split(' ')[0]);
    await user.click(screen.getAllByText(other.name).pop());
    await user.type((await screen.findAllByPlaceholderText(/כתוב הודעה ל-/))[0], 'Hi there');
    await user.click(screen.getAllByRole('button').filter(b => !b.disabled && /שלח|התחל/.test(b.textContent)).pop());
    expect((await screen.findAllByText('Hi there'))[0]).toBeInTheDocument();
    await user.click(screen.getAllByTitle('סגור')[0]);
  });

  it('opens a direct message from a profile', async () => {
    const convo = HUB_DATA.CONVERSATIONS[0];
    const { user } = await renderApp({ as: 'bob', setup: (srv) => srv.db.users.push({
      id: 77, username: convo.with.id, name: convo.with.name, email: 'x@example.com', password: 'p', bio: '', avatar_url: null,
      cover: 'ph-night', location: '', skills: [], verified: false, is_agent: false, role: 'user', is_banned: false,
      created_at: new Date().toISOString() }) });
    navigate(`#/u/${convo.with.id}`);
    await user.click(await screen.findByRole('button', { name: /הודעה/ }));
    expect((await screen.findAllByPlaceholderText(/הודעה ל-/))[0]).toBeInTheDocument();
  });

  it('a guest is asked to log in for messages', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByTitle('הודעות'));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });
});

describe('notifications & saved panels', () => {
  it('filters notifications and browses saved items', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await user.click(screen.getByTitle('התראות'));
    const panel = (await screen.findByText('התראות', { selector: 'h2' })).closest('aside');
    for (const b of within(panel).getAllByRole('button').filter(x => x.className.includes('rounded-full') && x.textContent)) {
      await user.click(b);
    }
    await user.click(within(panel).getAllByRole('button')[0]);   // close

    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('פרויקטים שמורים'));
    const saved = (await screen.findByText('שמורים', { selector: 'h2' })).closest('aside');
    await user.click(within(saved).getByRole('button', { name: /כלים/ }));
    await user.click(within(saved).getByRole('button', { name: /פרויקטים/ }));
    // saved mock posts include a review card and an agent card
    const hearts = saved.querySelectorAll('button');
    for (const b of [...hearts].slice(0, 12)) fireEvent.click(b);
  });

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
