// Sharing a post (composer in "share" mode → a post that quotes the original) and
// contacting the maker from the image overlay / the ⋯ menu.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const firstPost = async () => {
  await screen.findByText(/Post number 25/);
  return document.querySelector('main article.paper-card');
};

describe('share', () => {
  it('shares a post from the footer: composer preview → a quoting post on top of the feed', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await user.click(within(await firstPost()).getByTitle('שתף בפוסט חדש'));
    expect(await screen.findByText('שיתוף פוסט')).toBeInTheDocument();
    const dialog = screen.getByText('שיתוף פוסט').closest('.shadow-pop');
    expect(within(dialog).getByText(/Post number 25/)).toBeInTheDocument();       // preview of the original
    expect(within(dialog).queryByText('מדריך')).toBeNull();                          // no type tabs
    await user.click(within(dialog).getByRole('button', { name: /פרסם/ }));

    await waitFor(() => expect(screen.queryByText('שיתוף פוסט')).toBeNull());
    const share = server.db.posts[server.db.posts.length - 1];
    expect(share).toMatchObject({ author: 2, shared_post_id: 25 });
    const card = document.querySelector('main article.paper-card');
    expect(within(card).getByText('שיתף/ה פוסט')).toBeInTheDocument();
    expect(within(card).getByText('Bob Levi')).toBeInTheDocument();

    // clicking the preview opens the original post
    await user.click(within(card).getByRole('link', { name: 'הפוסט של Alice Cohen' }));
    await waitFor(() => expect(window.location.hash).toBe('#/post/25'));
  });

  it('sharing a share quotes the original; a removed original shows a note', async () => {
    const { user, server } = await renderApp({
      as: 'carol',
      setup: (s) => {
        s.db.posts.push({ id: 900, author: 2, kind: 'project', title: null, body_html: '<p>look at this</p>', location: '',
                          steps: [], images: [], tags: [], shared_post_id: 24, created_at: new Date().toISOString() });
        s.db.posts.push({ id: 901, author: 2, kind: 'project', title: null, body_html: '<p>gone</p>', location: '',
                          steps: [], images: [], tags: [], shared_post_id: 999, created_at: new Date().toISOString() });
      },
    });
    expect(await screen.findByText('הפוסט המקורי הוסר')).toBeInTheDocument();
    const card = (await screen.findByText('look at this')).closest('article');
    expect(within(card).getByText(/Post number 24/)).toBeInTheDocument();
    await user.click(within(card).getByTitle('שתף בפוסט חדש'));
    const dialog = (await screen.findByText('שיתוף פוסט')).closest('.shadow-pop');
    expect(within(dialog).getByText(/Post number 24/)).toBeInTheDocument();
    expect(within(dialog).queryByText('look at this')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: /פרסם/ }));
    await waitFor(() => expect(server.db.posts[server.db.posts.length - 1].shared_post_id).toBe(24));
  });

  it('a guest who clicks share is asked to log in', async () => {
    const { user } = await renderApp();
    await user.click(within(await firstPost()).getByTitle('שתף בפוסט חדש'));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    expect(screen.queryByText('שיתוף פוסט')).toBeNull();
  });
});

describe('contact the maker', () => {
  it('the image overlay shares or opens a chat with the maker (not on your own post)', async () => {
    const { user } = await renderApp({ as: 'bob', hash: '#/post/1' });
    const card = (await screen.findByText(/Post number 1\b/)).closest('article');
    expect(within(card).queryByText('שמור')).toBeNull();            // the decorative "save" is gone
    await user.click(within(card).getByRole('button', { name: 'פנה ליוצר' }));
    expect((await screen.findAllByLabelText('הודעה')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alice Cohen').length).toBeGreaterThan(1);
  });

  it('overlay "share" opens the share composer; the author sees no "contact" button', async () => {
    const { user } = await renderApp({ as: 'alice', hash: '#/post/1' });
    const card = (await screen.findByText(/Post number 1\b/)).closest('article');
    expect(within(card).queryByRole('button', { name: 'פנה ליוצר' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'שתף' }));
    expect(await screen.findByText('שיתוף פוסט')).toBeInTheDocument();
  });

  it('the ⋯ menu can message the maker', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await user.click(within(await firstPost()).getByRole('button', { name: 'אפשרויות' }));
    await user.click(screen.getByRole('button', { name: /שלח הודעה ליוצר/ }));
    expect((await screen.findAllByLabelText('הודעה')).length).toBeGreaterThan(0);
  });
});
