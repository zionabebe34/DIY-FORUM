// Hot tags: the number is the exact count of posts using the tag, refreshed after publishing / deleting.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const hotTags = async () => (await screen.findByText('תגיות חמות')).closest('section');
const countOf = (section, tag) =>
  within(section).getByRole('button', { name: new RegExp(tag) }).querySelector('.font-mono').textContent;

describe('hot tags', () => {
  it('shows exact counts and updates them when a post is published or deleted', async () => {
    const { user, server } = await renderApp({ as: 'alice' });
    const section = await hotTags();
    await waitFor(() => expect(countOf(section, 'woodwork')).toBe('12 פוסטים'));
    expect(countOf(section, 'welding')).toBe('13 פוסטים');

    // someone else posts (no refresh yet) …
    server.db.posts.push({ id: 500, author: 3, kind: 'project', title: null, body_html: '<p>x</p>', location: '',
                           steps: [], images: [], tags: ['#woodwork'], created_at: new Date().toISOString() });
    expect(countOf(section, 'woodwork')).toBe('12 פוסטים');
    // … then alice deletes her post → the list refreshes right away and picks up both changes
    const mine = (await screen.findByText(/Post number 25/)).closest('article');
    await user.click(within(mine).getByRole('button', { name: 'אפשרויות' }));
    await user.click(within(mine).getByRole('button', { name: /מחק פוסט/ }));
    // post 25 had #welding/#metal → 12; Carol's new #woodwork post → 13
    await waitFor(() => expect(countOf(section, 'welding')).toBe('12 פוסטים'));
    expect(countOf(section, 'woodwork')).toBe('13 פוסטים');
  });

  it('a tag on a single post says "פוסט"', async () => {
    await renderApp({ setup: (s) => { s.db.posts = s.db.posts.slice(0, 1); s.db.posts[0].tags = ['#solo']; } });
    const section = await hotTags();
    await waitFor(() => expect(countOf(section, 'solo')).toBe('1 פוסט'));
  });
});
