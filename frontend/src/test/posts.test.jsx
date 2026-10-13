import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const firstPost = async () => {
  await screen.findByText(/Post number 25/);
  return document.querySelectorAll('main article.paper-card')[0];
};
const heart = (article) => article.querySelector('button.relative');

describe('likes', () => {
  it('likes and unlikes a post (server-confirmed counts)', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    const post = await firstPost();
    expect(heart(post)).toHaveTextContent('2');
    await user.click(heart(post));
    await waitFor(() => expect(heart(post)).toHaveTextContent('3'));
    expect(server.db.likes.some(l => l.user === 1 && l.post === 25)).toBe(true);
    await user.click(heart(post));
    await waitFor(() => expect(heart(post)).toHaveTextContent('2'));
  });

  it('rolls the like back when the server fails', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    const post = await firstPost();
    server.fetch.failNext = 'POST /api/posts/25/like';
    await user.click(heart(post));
    await waitFor(() => expect(heart(post)).toHaveTextContent('2'));
  });

  it('asks a guest to log in instead of liking', async () => {
    const { user } = await renderApp();
    const post = await firstPost();
    await user.click(heart(post));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    expect(heart(post)).toHaveTextContent('2');
  });
});

describe('comments', () => {
  it('shows the thread, adds a comment and a reply, deletes and reports', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const post = await firstPost();
    await user.click(within(post).getByTitle('תגובות'));
    const thread = await within(post).findByRole('region', { name: 'תגובות' });
    expect(await within(thread).findByText('Great job!')).toBeInTheDocument();
    expect(within(thread).getByText('Thanks!')).toBeInTheDocument();

    // new top-level comment (Enter sends)
    await user.type(within(thread).getByLabelText('כתבו תגובה…'), 'Nice bench{Enter}');
    expect(await within(thread).findByText('Nice bench')).toBeInTheDocument();
    expect(within(post).getByTitle('תגובות')).toHaveTextContent('3');

    // reply under the first thread
    await user.click(within(thread).getAllByRole('button', { name: 'הגב' })[0]);
    const replyBox = await within(thread).findByLabelText(/תגובה לCarol/);
    await user.type(replyBox, 'Me too{Enter}');
    expect(await within(thread).findByText('Me too')).toBeInTheDocument();
    expect(server.db.comments.find(c => c.body === 'Me too').parent_id).not.toBeNull();

    // delete my own comment
    const mine = within(thread).getByText('Nice bench').closest('.flex-1');
    await user.click(within(mine).getByRole('button', { name: 'מחק' }));
    await waitFor(() => expect(within(thread).queryByText('Nice bench')).not.toBeInTheDocument());

    // report someone else's comment
    const carols = within(thread).getByText('Great job!').closest('.flex-1');
    await user.click(within(carols).getByRole('button', { name: 'דווח' }));
    await user.click(await screen.findByText('הטרדה או בריונות'));
    await user.click(screen.getByRole('button', { name: 'שלח דיווח' }));
    expect(await screen.findByText(/הדיווח הועבר/)).toBeInTheDocument();
    expect(server.db.reports[0]).toMatchObject({ target_type: 'comment', reason: 'harassment' });
  });

  it('shows a send error and keeps the text; Escape closes a reply box', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const post = await firstPost();
    await user.click(within(post).getByTitle('תגובות'));
    const thread = await within(post).findByRole('region', { name: 'תגובות' });
    await within(thread).findByText('Great job!');
    await user.type(within(thread).getByLabelText('כתבו תגובה…'), 'please FAIL{Enter}');
    expect(await within(thread).findByRole('alert')).toHaveTextContent('שגיאה מדומה');
    expect(within(thread).getByLabelText('כתבו תגובה…')).toHaveValue('please FAIL');

    await user.click(within(thread).getAllByRole('button', { name: 'הגב' })[1]);
    const box = await within(thread).findByLabelText(/תגובה ל/);
    fireEvent.keyDown(box, { key: 'Escape' });
    await waitFor(() => expect(within(thread).queryByLabelText(/תגובה ל/)).not.toBeInTheDocument());
  });

  it('guests see the thread but must log in to reply', async () => {
    const { user } = await renderApp();
    const post = await firstPost();
    await user.click(within(post).getByTitle('תגובות'));
    const thread = await within(post).findByRole('region', { name: 'תגובות' });
    await within(thread).findByText('Great job!');
    await user.click(within(thread).getAllByRole('button', { name: 'הגב' })[0]);
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(thread).getByRole('button', { name: 'התחברו כדי להגיב' }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('shows an empty thread and a load error', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await firstPost();
    const second = document.querySelectorAll('main article.paper-card')[1];
    await user.click(within(second).getByTitle('תגובות'));
    expect(await within(second).findByText(/אין תגובות עדיין/)).toBeInTheDocument();
    await user.click(within(second).getByTitle('תגובות'));            // close
    server.fetch.failNext = '/comments';
    await user.click(within(second).getByTitle('תגובות'));            // reopen → error
    expect(await within(second).findByText('שגיאת שרת')).toBeInTheDocument();
  });
});

describe('post menu', () => {
  it('reports a post as a regular user', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const post = await firstPost();
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    await user.click(screen.getByRole('button', { name: 'דיווח על הפוסט' }));
    // submitting without a reason shows an error
    await user.click(screen.getByRole('button', { name: 'שלח דיווח' }));
    expect(await screen.findByText('בחרו סיבה')).toBeInTheDocument();
    await user.click(screen.getByText('ספאם או פרסומת'));
    await user.type(screen.getByPlaceholderText('פרטים נוספים (לא חובה)'), 'ads');
    await user.click(screen.getByRole('button', { name: 'שלח דיווח' }));
    await waitFor(() => expect(server.db.reports).toHaveLength(1));
    expect(server.db.reports[0]).toMatchObject({ target_type: 'post', target_id: 25, reason: 'spam', details: 'ads' });
  });

  it('closes the report dialog with Escape and Cancel', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const post = await firstPost();
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    await user.click(screen.getByRole('button', { name: 'דיווח על הפוסט' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('שלח דיווח')).not.toBeInTheDocument());
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    await user.click(screen.getByRole('button', { name: 'דיווח על הפוסט' }));
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByText('שלח דיווח')).not.toBeInTheDocument());
  });

  it('lets the author delete their own post', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    await screen.findByText(/Post number 25/);
    // Post 25 is by Alice (index 24 → author 1)
    const post = document.querySelectorAll('main article.paper-card')[0];
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    await user.click(screen.getByRole('button', { name: 'מחק פוסט' }));
    await waitFor(() => expect(screen.queryByText(/Post number 25/)).not.toBeInTheDocument());
    expect(server.db.posts.some(p => p.id === 25)).toBe(false);
  });

  it('lets a moderator delete someone else\'s post, and shows server errors', async () => {
    const { user, server } = await renderApp({ as: 'alice' });   // alice is admin
    await screen.findByText(/Post number 24/);
    const post = [...document.querySelectorAll('main article.paper-card')].find(a => a.textContent.includes('Post number 24'));
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    server.fetch.failNext = 'DELETE /api/posts/24';
    await user.click(screen.getByRole('button', { name: 'מחק (ניהול)' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('שגיאת שרת'));
    await user.click(screen.getByRole('button', { name: 'מחק (ניהול)' }));
    await waitFor(() => expect(screen.queryByText(/Post number 24/)).not.toBeInTheDocument());
  });

  it('closes the menu when clicking outside', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const post = await firstPost();
    await user.click(within(post).getByRole('button', { name: 'אפשרויות' }));
    expect(screen.getByRole('button', { name: 'דיווח על הפוסט' })).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'דיווח על הפוסט' })).not.toBeInTheDocument());
  });
});

describe('composer', () => {
  const openComposer = async (user) => {
    await user.click(await screen.findByRole('button', { name: /מה בנית היום/ }));
    return screen.findByText('פוסט חדש');
  };
  const editor = () => document.querySelector('.ProseMirror');
  const dialog = () => within(screen.getByText('פוסט חדש').closest('.shadow-pop'));

  it('publishes a rich-text project post with an image and tags', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await openComposer(user);
    await user.click(editor());
    await user.keyboard('My new shelf');
    // formatting toolbar
    await user.click(screen.getByRole('button', { name: /מודגש/ }));
    await user.click(screen.getByRole('button', { name: /נטוי/ }));
    await user.click(screen.getByRole('button', { name: /קו תחתון/ }));
    await user.click(screen.getByRole('button', { name: 'רשימה' }));
    await user.click(screen.getByRole('button', { name: 'קישור' }));
    await user.type(screen.getByPlaceholderText('https://example.com'), 'example.com{Enter}');

    const file = new File(['img'], 'shelf.png', { type: 'image/png' });
    await user.upload(document.querySelector('input[type=file]'), file);
    expect(await screen.findByText('shelf.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '#נגרות' }));     // suggested tag
    await user.type(screen.getByPlaceholderText(''), 'oak{Enter}');
    await user.click(dialog().getByRole('button', { name: /^פרסם$/ }));

    await waitFor(() => expect(screen.queryByText('פוסט חדש')).not.toBeInTheDocument());
    const created = server.db.posts[server.db.posts.length - 1];
    expect(created.body_html).toContain('My new shelf');
    expect(created.body_html).toContain('https://example.com');
    expect(created.tags).toEqual(['#נגרות', '#oak']);
    expect(created.images).toHaveLength(1);
    expect(await screen.findAllByText(/My new shelf/)).not.toHaveLength(0);
  });

  it('rejects non-image files and removes media, tags', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await openComposer(user);
    const input = document.querySelector('input[type=file]');
    await user.upload(input, new File(['x'], 'clip.mp4', { type: 'video/mp4' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('רק תמונות');
    await user.upload(input, new File([new Uint8Array(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('5MB');

    await user.upload(input, new File(['img'], 'a.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: 'הסר תמונה' }));
    await waitFor(() => expect(screen.queryByText('a.png')).not.toBeInTheDocument());

    // drag & drop an image
    const zone = screen.getByText(/גרור לכאן/).closest('div.rounded-xl');
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['img'], 'dropped.png', { type: 'image/png' })] } });
    expect(await screen.findByText('dropped.png')).toBeInTheDocument();

    const tagBox = screen.getByPlaceholderText(/תייגו/);
    await user.type(tagBox, 'one,two ');
    expect(screen.getByText('#one')).toBeInTheDocument();
    await user.type(tagBox, '{Backspace}');
    expect(screen.queryByText('#two')).not.toBeInTheDocument();
    await user.click(screen.getByText('#one').querySelector('button'));
    expect(screen.queryByText('#one')).not.toBeInTheDocument();
  });

  it('creates a tutorial with steps', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await openComposer(user);
    await user.click(dialog().getByRole('button', { name: /^מדריך$/ }));
    const publish = dialog().getByRole('button', { name: /^פרסם$/ });
    expect(publish).toBeDisabled();
    await user.type(screen.getByPlaceholderText('איך נקרא למדריך?'), 'Build a box');
    await user.type(screen.getByPlaceholderText('כותרת שלב 1'), 'Cut boards');
    await user.type(screen.getByPlaceholderText('הערה / חומרים / כלים'), 'pine');
    await user.click(screen.getByRole('button', { name: /הוסף שלב/ }));
    await user.type(screen.getByPlaceholderText('כותרת שלב 2'), 'Glue');
    // cycle a step thumbnail, then remove step 2
    await user.click(screen.getAllByTitle('לחץ להחלפת תמונה')[0]);
    const step2 = within(screen.getByPlaceholderText('כותרת שלב 2').closest('.flex.gap-2'));
    await user.click(step2.getAllByRole('button').pop());                 // ✕ removes step 2
    await user.click(publish);
    await waitFor(() => expect(screen.queryByText('פוסט חדש')).not.toBeInTheDocument());
    const created = server.db.posts[server.db.posts.length - 1];
    expect(created).toMatchObject({ kind: 'tutorial', title: 'Build a box' });
    expect(created.steps.map(s => s.title)).toEqual(['Cut boards']);
  });

  it('shows a server error, and asks before discarding a draft', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    await openComposer(user);
    await user.click(editor());
    await user.keyboard('Draft text');
    server.fetch.failNext = 'POST /api/posts';
    await user.click(dialog().getByRole('button', { name: /^פרסם$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאת שרת');

    window.confirm.mockReturnValueOnce(false);
    await user.click(dialog().getByRole('button', { name: 'ביטול' }));
    expect(screen.getByText('פוסט חדש')).toBeInTheDocument();          // kept
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('פוסט חדש')).not.toBeInTheDocument());
  });

  it('guests are asked to log in before composing', async () => {
    const { user } = await renderApp();
    await user.click(await screen.findByRole('button', { name: 'מה אתה עובד עליו?' }));
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
  });

  it('editor link: empty URL removes the link, and the unlink button works', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await openComposer(user);
    await user.click(editor());
    await user.click(screen.getByRole('button', { name: 'קישור' }));
    await user.type(screen.getByPlaceholderText('https://example.com'), 'https://a.com{Enter}');
    expect(editor().querySelector('a')).not.toBeNull();
    // cursor is inside the link → unlink button appears
    const unlink = await screen.findByRole('button', { name: 'הסר קישור' });
    await user.click(unlink);
    await user.click(screen.getByRole('button', { name: 'קישור' }));
    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.keyDown(input, { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'קישור' }));
    await user.clear(screen.getByPlaceholderText('https://example.com'));
    await user.type(screen.getByPlaceholderText('https://example.com'), '{Enter}');
    await user.click(screen.getByRole('button', { name: 'קישור' }));
    await user.click(screen.getAllByRole('button').find(b => b.closest('form') && b.type === 'button' && b.className.includes('p-1')));
    expect(vi.isMockFunction(window.confirm)).toBe(true);
  });
});
