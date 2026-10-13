import { describe, expect, it, vi } from 'vitest';
import { AN } from '../components/anims.jsx';
import { HUB_DATA } from '../components/data.jsx';
import { api, ApiError, minutesSince, toPerson } from '../lib/api.js';

describe('timeAgoCasual ("time ago" labels)', () => {
  const t = AN.timeAgoCasual;
  it.each([
    [0, 'עכשיו'], [5, 'לפני 5 דק׳'], [60, 'לפני 1 שע׳'], [60 * 23, 'לפני 23 שע׳'],
    [60 * 24, 'אתמול'], [60 * 24 * 3, 'לפני 3 ימים'], [60 * 24 * 7, 'לפני שבוע'],
    [60 * 24 * 15, 'לפני 2 שבועות'], [60 * 24 * 35, 'לפני חודש'], [60 * 24 * 100, 'לפני 3 חודשים'],
    [60 * 24 * 400, 'לפני שנה'], [60 * 24 * 365 * 3, 'לפני 3 שנים'],
  ])('%i minutes → %s', (min, label) => expect(t(min)).toBe(label));
});

describe('design helpers (data.jsx)', () => {
  it('formats the older timeAgo and shekels', () => {
    expect(HUB_DATA.timeAgo(0)).toBe('הרגע');
    expect(HUB_DATA.timeAgo(30)).toBe('לפני 30 דק׳');
    expect(HUB_DATA.timeAgo(60)).toBe('לפני שעה');
    expect(HUB_DATA.timeAgo(180)).toBe('לפני 3 שעות');
    expect(HUB_DATA.timeAgo(60 * 24)).toBe('אתמול');
    expect(HUB_DATA.timeAgo(60 * 24 * 3)).toBe('לפני 3 ימים');
    expect(HUB_DATA.timeAgo(60 * 24 * 7)).toBe('לפני שבוע');
    expect(HUB_DATA.timeAgo(60 * 24 * 14)).toBe('לפני 2 שבועות');
    expect(HUB_DATA.timeAgo(60 * 24 * 60)).toBe('לפני 2 חודשים');
    expect(HUB_DATA.NIS(1200)).toMatch(/₪1,200/);
    expect(HUB_DATA.avatarDataURI('אאא')).toMatch(/^data:image\/svg\+xml/);   // no latin chars → "??"
  });
});

describe('api helpers', () => {
  it('computes minutes since an ISO time', () => {
    expect(minutesSince(null)).toBe(0);
    expect(minutesSince(new Date(Date.now() - 5 * 60000).toISOString())).toBe(5);
    expect(minutesSince(new Date(Date.now() + 60000).toISOString())).toBe(0);   // clock skew → never negative
  });

  it('maps users to the design shape', () => {
    expect(toPerson(null)).toBeNull();
    const p = toPerson({ id: 1, username: 'a', name: 'A', role: 'moderator', created_at: '2024-05-01T00:00:00Z' });
    expect(p).toMatchObject({ id: 'a', handle: '@a', isStaff: true, joined: 2024, cover: 'ph-night', skills: [] });
  });

  it('turns network failures and empty error bodies into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(api.me()).rejects.toMatchObject({ message: 'אין חיבור לשרת', status: 0 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('no body')) }));
    const e = await api.trending().catch(x => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ message: 'שגיאת שרת', status: 502 });
  });
});
