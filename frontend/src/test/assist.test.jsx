// The AI writing assistant (part 2 c): auto-correct in the composer (before/after → replace),
// "suggest a post" (pick a draft → editor + tags), and comment suggestions (pick → comment box).
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const openComposer = async (user) => {
  await user.click(await screen.findByRole('button', { name: /מה בנית היום/ }));
  return (await screen.findByText('פוסט חדש')).closest('.shadow-pop');
};
const editor = (dialog) => dialog.querySelector('.ProseMirror');

describe('writing assistant in the composer', () => {
  it('auto-correct: shows the fixes and the corrected text, and replaces it on request', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const dialog = await openComposer(user);
    const assist = await within(dialog).findByLabelText('עוזר כתיבה');
    expect(within(assist).getByRole('button', { name: '✨ תיקון כתיב' })).toBeDisabled();   // nothing to fix yet

    await user.click(editor(dialog));
    await user.keyboard('תודה לכולמ על העזרה, בעובי 4 סמ');
    await user.click(within(assist).getByRole('button', { name: '✨ תיקון כתיב' }));
    const fixes = await within(assist).findByRole('list', { name: 'תיקונים' });
    expect(within(fixes).getAllByRole('listitem').map(li => li.textContent)).toEqual(['• לכולמ ← לכולם', '• סמ ← ס״מ']);
    expect(within(assist).getByText('אחרי התיקון')).toBeInTheDocument();
    expect(within(assist).queryByText(/תיקונים בסיסיים בלבד/)).toBeNull();

    await user.click(within(assist).getByRole('button', { name: 'החלפה בטקסט המתוקן' }));
    await waitFor(() => expect(editor(dialog)).toHaveTextContent('תודה לכולם על העזרה, בעובי 4 ס״מ'));
    expect(within(assist).queryByRole('list', { name: 'תיקונים' })).toBeNull();

    // nothing left to fix
    await user.click(within(assist).getByRole('button', { name: '✨ תיקון כתיב' }));
    expect(await within(assist).findByText('✓ לא נמצאו שגיאות לתיקון.')).toBeInTheDocument();
    await user.click(within(assist).getByRole('button', { name: 'סגירה' }));

    // publish → the corrected text is what gets saved
    await user.click(within(dialog).getByRole('button', { name: /פרסם/ }));
    await waitFor(() => expect(server.db.posts[server.db.posts.length - 1].body_html).toContain('לכולם'));
  });

  it('cancel keeps the original; an unavailable assistant shows a message', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const dialog = await openComposer(user);
    const assist = await within(dialog).findByLabelText('עוזר כתיבה');
    await user.click(editor(dialog));
    await user.keyboard('לכולמ NOAI');
    await user.click(within(assist).getByRole('button', { name: '✨ תיקון כתיב' }));
    expect(await within(assist).findByText('תיקונים בסיסיים בלבד — העוזר החכם לא זמין כרגע.')).toBeInTheDocument();
    await user.click(within(assist).getByRole('button', { name: 'ביטול' }));
    expect(editor(dialog)).toHaveTextContent('לכולמ');

    await user.click(editor(dialog));
    await user.keyboard(' DOWN');
    await user.click(within(assist).getByRole('button', { name: '✨ תיקון כתיב' }));
    expect(await within(assist).findByRole('alert')).toHaveTextContent('העוזר החכם לא זמין כרגע');
  });

  it('suggest a post: drafts by topic → the picked one fills the editor and its tags', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const dialog = await openComposer(user);
    const assist = await within(dialog).findByLabelText('עוזר כתיבה');
    await user.click(within(assist).getByRole('button', { name: '✨ הצע לי פוסט' }));
    await user.type(within(assist).getByLabelText('נושא להצעה'), 'שולחן לגינה');
    await user.click(within(assist).getByRole('button', { name: 'הצע' }));
    const pick = await within(assist).findByRole('button', { name: /סיימתי \[שם הפרויקט\] — שולחן לגינה/ });
    expect(within(assist).getByRole('button', { name: 'הצעות חדשות' })).toBeInTheDocument();
    await user.click(pick);
    await waitFor(() => expect(editor(dialog)).toHaveTextContent('סיימתי [שם הפרויקט] — שולחן לגינה! מה דעתכם?'));
    expect(within(dialog).getByText('#נגרות')).toBeInTheDocument();

    await user.click(within(assist).getByRole('button', { name: '✨ הצע לי פוסט' }));
    await user.type(within(assist).getByLabelText('נושא להצעה'), 'DOWN');
    await user.click(within(assist).getByRole('button', { name: 'הצע' }));
    expect(await within(assist).findByRole('alert')).toHaveTextContent('לא זמין');
  });

  it('is hidden when the server has no AI; no "suggest a post" for tutorials or listings', async () => {
    const { user } = await renderApp({ as: 'bob', setup: (s) => { s.db.aiEnabled = false; } });
    const dialog = await openComposer(user);
    await within(dialog).findByText('פרויקט');
    expect(within(dialog).queryByLabelText('עוזר כתיבה')).toBeNull();
  });

  it('tutorials get only auto-correct', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const dialog = await openComposer(user);
    await user.click(within(dialog).getByRole('button', { name: /מדריך/ }));
    const assist = await within(dialog).findByLabelText('עוזר כתיבה');
    expect(within(assist).queryByRole('button', { name: '✨ הצע לי פוסט' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: /מכירה\/השאלה/ }));
    expect(within(dialog).queryByLabelText('עוזר כתיבה')).toBeNull();
  });
});

describe('comment suggestions', () => {
  it('suggests comments for the post and for a reply; a pick fills the box', async () => {
    const { user } = await renderApp({ as: 'bob' });
    await screen.findByText(/Post number 25/);
    const post = document.querySelector('main article.paper-card');
    await user.click(within(post).getByTitle('תגובות'));
    await within(post).findByText('Great job!');

    await user.click(within(post).getByRole('button', { name: '✨ הצע לי תגובה' }));
    const chips = await within(post).findByLabelText('הצעות לתגובה');
    expect(within(chips).getByRole('button', { name: 'איזה גימור השתמשת? (post 25)' })).toBeInTheDocument();
    await user.click(within(chips).getByRole('button', { name: 'הצעות אחרות' }));
    await user.click(await within(chips).findByRole('button', { name: 'נראה מעולה!' }));
    const box = within(post).getByLabelText('כתבו תגובה…');
    expect(box).toHaveValue('נראה מעולה!');
    expect(box).toHaveFocus();
    expect(within(post).queryByRole('button', { name: '✨ הצע לי תגובה' })).toBeNull();   // hidden while typing

    // a reply asks with the parent comment; closing hides the chips
    await user.click(within(post).getAllByRole('button', { name: 'הגב' })[0]);
    const replyHelp = within(post).getAllByRole('button', { name: '✨ הצע לי תגובה' })[0];
    await user.click(replyHelp);
    const replyChips = await within(post).findByLabelText('הצעות לתגובה');
    expect(within(replyChips).getByRole('button', { name: /\(reply 25\)/ })).toBeInTheDocument();
    await user.click(within(replyChips).getByRole('button', { name: 'סגירה' }));
    expect(within(post).queryByLabelText('הצעות לתגובה')).toBeNull();
  });

  it('shows a message when the assistant is unavailable', async () => {
    const { user } = await renderApp({ as: 'bob', setup: (s) => { s.db.aiDownComments = true; } });
    await screen.findByText(/Post number 25/);
    const post = document.querySelector('main article.paper-card');
    await user.click(within(post).getByTitle('תגובות'));
    await user.click(await within(post).findByRole('button', { name: '✨ הצע לי תגובה' }));
    expect(await within(post).findByRole('alert')).toHaveTextContent('לא זמין');
  });
});
