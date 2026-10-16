// The toxicity check on comments (part 2 e.iii): a warning lets the author edit or publish anyway
// (→ an automatic report for the moderators); a block shows why and publishes nothing.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const openComments = async (user) => {
  await screen.findByText(/Post number 25/);
  const post = document.querySelector('main article.paper-card');
  await user.click(within(post).getByTitle('תגובות'));
  await within(post).findByText('Great job!');
  return post;
};

describe('toxicity check on comments', () => {
  it('warns: edit clears the warning; publish anyway posts it and reports it', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const post = await openComments(user);
    const box = within(post).getByLabelText('כתבו תגובה…');

    await user.type(box, 'WARN you');
    await user.click(within(post).getByRole('button', { name: 'שלח תגובה' }));
    const warning = await within(post).findByRole('alertdialog', { name: 'אזהרת תוכן' });
    expect(warning).toHaveTextContent('נסו לנסח בלי עלבונות');
    expect(server.db.comments.some(c => c.body === 'WARN you')).toBe(false);

    await user.click(within(warning).getByRole('button', { name: 'עריכת התגובה' }));
    expect(within(post).queryByRole('alertdialog')).toBeNull();
    expect(box).toHaveValue('WARN you');                       // the text is kept for editing
    expect(box).toHaveFocus();

    await user.click(within(post).getByRole('button', { name: 'שלח תגובה' }));
    await user.click(await within(post).findByRole('button', { name: 'פרסום בכל זאת' }));
    expect(await within(post).findByText('WARN you')).toBeInTheDocument();
    expect(box).toHaveValue('');
    expect(server.db.reports.some(r => r.reporter === null && r.target_type === 'comment')).toBe(true);
    expect(server.db.calls.some(([m, p]) => m === 'POST' && p.includes('/comments'))).toBe(true);
  });

  it('typing after a warning hides it', async () => {
    const { user } = await renderApp({ as: 'bob' });
    const post = await openComments(user);
    const box = within(post).getByLabelText('כתבו תגובה…');
    await user.type(box, 'WARN{Enter}');
    await within(post).findByRole('alertdialog');
    await user.type(box, '!');
    expect(within(post).queryByRole('alertdialog')).toBeNull();
  });

  it('blocks: shows why and keeps the text', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const post = await openComments(user);
    const box = within(post).getByLabelText('כתבו תגובה…');
    await user.type(box, 'BLOCK me{Enter}');
    expect(await within(post).findByRole('alert')).toHaveTextContent('🚫 התוכן פוגע — לא ניתן לפרסם');
    expect(box).toHaveValue('BLOCK me');
    await waitFor(() => expect(server.db.comments.some(c => c.body === 'BLOCK me')).toBe(false));
  });
});
