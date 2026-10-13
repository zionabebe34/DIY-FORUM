import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, navigate } from './utils.jsx';

const statValue = (label) => screen.getByText(label, { selector: 'div.font-mono' }).previousSibling;

describe('profile page', () => {
  it('shows profile details, posts and the about tab', async () => {
    const { user } = await renderApp({ hash: '#/u/carol' });
    expect(await screen.findByRole('heading', { name: 'Carol Mizrahi' })).toBeInTheDocument();
    expect(screen.getAllByText('Welder')[0]).toBeInTheDocument();
    expect(screen.getAllByText(/welding/)[0]).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('main article.paper-card').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('tab', { name: /אודות/ }));
    expect(screen.getByText('מיקום').nextSibling).toHaveTextContent('Haifa');
    await user.click(screen.getByRole('button', { name: /חזרה לפיד/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('follows and unfollows, updating the follower count', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/u/carol' });
    await screen.findByRole('heading', { name: 'Carol Mizrahi' });
    await waitFor(() => expect(statValue('עוקבים')).toHaveTextContent('1'));
    const header = screen.getByRole('heading', { name: 'Carol Mizrahi' }).closest('section');
    await user.click(within(header).getByRole('button', { name: /עקוב/ }));
    await waitFor(() => expect(statValue('עוקבים')).toHaveTextContent('2'));
    expect(server.db.follows).toContainEqual({ follower: 2, followee: 3 });
    await user.click(within(header).getByRole('button', { name: /במעקב/ }));
    await waitFor(() => expect(statValue('עוקבים')).toHaveTextContent('1'));
  });

  it('lists followers and following, with follow buttons', async () => {
    const { user } = await renderApp({ as: 'bob', hash: '#/u/alice' });
    await screen.findByRole('heading', { name: 'Alice Cohen' });
    const list = () => within(document.querySelector('main section ul'));
    await user.click(screen.getByRole('tab', { name: /^עוקבים/ }));
    await waitFor(() => expect(list().getByText('Carol Mizrahi', { selector: 'button' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /נעקבים/ }));
    await waitFor(() => expect(list().getByText('Carol Mizrahi', { selector: 'button' })).toBeInTheDocument());
    // follow carol from the list
    const row = list().getByText('Carol Mizrahi', { selector: 'button' }).closest('li');
    await user.click(within(row).getByRole('button', { name: 'עקוב' }));
    await waitFor(() => expect(within(row).getByRole('button', { name: 'במעקב' })).toBeInTheDocument());
    // open the profile from the list
    await user.click(within(row).getByText('Carol Mizrahi', { selector: 'button' }));
    await waitFor(() => expect(window.location.hash).toBe('#/u/carol'));
  });

  it('shows empty lists and a missing profile', async () => {
    const { user } = await renderApp({ hash: '#/u/bob' });
    await screen.findByRole('heading', { name: 'Bob Levi' });
    expect(await screen.findByText('אין כאן פוסטים עדיין')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^עוקבים/ }));
    expect(await screen.findByText(/אף אחד עוד לא עוקב/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /אודות/ }));
    expect(screen.getByText('לא נוסף תיאור.')).toBeInTheDocument();
    navigate('#/u/ghost');
    expect(await screen.findByText('היוצר לא נמצא')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'חזרה לפיד' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('shows a load error for a profile', async () => {
    const { server } = await renderApp();
    server.fetch.failNext = 'GET /api/users/carol';
    navigate('#/u/carol');
    expect(await screen.findByText('שגיאה בטעינת הפרופיל')).toBeInTheDocument();
  });

  it('a guest is asked to log in to follow', async () => {
    const { user } = await renderApp({ hash: '#/u/carol' });
    const header = (await screen.findByRole('heading', { name: 'Carol Mizrahi' })).closest('section');
    await user.click(within(header).getByRole('button', { name: /עקוב/ }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });
});

describe('my profile', () => {
  it('edits name, bio, location, skills, cover and avatar', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/u/bob' });
    await screen.findByRole('heading', { name: 'Bob Levi' });
    expect(screen.getByText(/אין לך עוקבים|הוסיפו ביו/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ערוך פרופיל/ }));
    const name = screen.getByDisplayValue('Bob Levi');
    await user.clear(name);
    await user.type(name, 'Bob L.');
    await user.type(screen.getByPlaceholderText(/ספרו על עצמכם/), 'I build tables');
    await user.type(screen.getByPlaceholderText('תל אביב'), 'Eilat');
    await user.type(screen.getByPlaceholderText(/נגרות, ריתוך/), 'oak, pine');
    await user.click(screen.getByRole('button', { name: 'ph-leaf' }));
    await user.upload(document.querySelector('input[type=file][accept="image/*"]'), new File(['a'], 'me.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByRole('heading', { name: 'Bob L.' })).toBeInTheDocument();
    const bob = server.db.users.find(u => u.username === 'bob');
    expect(bob).toMatchObject({ name: 'Bob L.', bio: 'I build tables', location: 'Eilat', cover: 'ph-leaf',
                                skills: ['oak', 'pine'], avatar_url: '/uploads/avatar.png' });
  });

  it('validates the avatar and shows save errors; removes the avatar', async () => {
    const { user, server } = await renderApp({ as: 'carol', hash: '#/u/carol' });
    await screen.findByRole('heading', { name: 'Carol Mizrahi' });
    await user.click(screen.getByRole('button', { name: /ערוך פרופיל/ }));
    const file = document.querySelector('input[type=file][accept="image/*"]');
    await user.upload(file, new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('5MB');
    // a non-image (bypassing the picker's accept filter)
    fireEvent.change(file, { target: { files: [new File(['a'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('קובץ תמונה');

    const form = within(screen.getByText('עריכת פרופיל', { selector: 'h3' }).closest('form'));
    await user.click(form.getByRole('button', { name: 'הסרת תמונה' }));
    server.fetch.failNext = 'PUT /api/users/me';
    await user.click(form.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת שרת');
    await user.click(form.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(server.db.users.find(u => u.username === 'carol').avatar_url).toBeNull());
  });

  it('opens edit profile from the user menu and closes with Escape', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('עריכת פרופיל'));
    expect(await screen.findByText('עריכת פרופיל', { selector: 'h3' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('עריכת פרופיל', { selector: 'h3' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
    await user.click(screen.getByText('הפרופיל שלי'));
    await waitFor(() => expect(window.location.hash).toBe('#/u/bob'));
  });
});

describe('moderation from the profile', () => {
  it('reports a user', async () => {
    const { user, server } = await renderApp({ as: 'bob', hash: '#/u/carol' });
    await screen.findByRole('heading', { name: 'Carol Mizrahi' });
    await user.click(screen.getByRole('button', { name: 'דיווח על המשתמש' }));
    await user.click(screen.getByText('אחר'));
    await user.click(screen.getByRole('button', { name: 'שלח דיווח' }));
    await waitFor(() => expect(server.db.reports[0]).toMatchObject({ target_type: 'user', target_id: 3 }));
  });

  it('an admin bans and unbans from the profile', async () => {
    const { user, server } = await renderApp({ as: 'alice', hash: '#/u/carol' });
    await screen.findByRole('heading', { name: 'Carol Mizrahi' });
    await user.click(screen.getByRole('button', { name: /^חסום$/ }));
    await user.type(screen.getByPlaceholderText(/סיבת החסימה/), 'spam');
    await user.click(screen.getByLabelText(/למחוק לצמיתות/));
    const dialog = within(screen.getByText(/חסימת Carol/).closest('form'));
    await user.click(dialog.getByRole('button', { name: 'חסום' }));
    expect(await screen.findByText(/החשבון הזה נחסם/)).toBeInTheDocument();
    expect(server.db.users.find(u => u.username === 'carol').is_banned).toBe(true);
    await user.click(screen.getByRole('button', { name: /הסר חסימה/ }));
    await waitFor(() => expect(screen.queryByText(/החשבון הזה נחסם/)).not.toBeInTheDocument());
  });

  it('a regular user sees no ban button', async () => {
    await renderApp({ as: 'bob', hash: '#/u/carol' });
    await screen.findByRole('heading', { name: 'Carol Mizrahi' });
    expect(screen.queryByRole('button', { name: /^חסום$/ })).not.toBeInTheDocument();
  });
});
