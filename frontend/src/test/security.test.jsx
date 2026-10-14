// Two-factor login: turning it on (QR → code → backup codes), logging in with a code or a
// backup code, wrong / expired codes, and turning it off.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from './utils.jsx';
import { TOTP_BACKUP } from './fakeServer.js';

const withTwoFactor = (username) => (s) => {
  const u = s.db.users.find(x => x.username === username);
  u.totp = true;
  u.backup = [...TOTP_BACKUP];
};

const openSecurity = async (user) => {
  await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
  await user.click(screen.getByText('אבטחת חשבון'));
  return screen.findByRole('dialog', { name: 'אבטחת חשבון' });
};

const loginAs = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'תפריט משתמש' }));
  await user.click(screen.getByText('התחבר'));
  await user.type(screen.getByLabelText('אימייל או שם משתמש'), name);
  await user.type(screen.getByLabelText('סיסמה'), 'password123');
  await user.click(screen.getByRole('button', { name: 'התחברות' }));
};

describe('two-factor setup', () => {
  it('turns 2FA on: QR + secret, a wrong code, then backup codes', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    const dialog = await openSecurity(user);
    expect(await within(dialog).findByText('כבוי')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'הפעלת אימות דו-שלבי' }));

    expect(await within(dialog).findByAltText('QR לאפליקציית האימות')).toHaveAttribute('src', 'data:image/svg+xml,qr');
    expect(within(dialog).getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('קוד מהאפליקציה'), '000000');
    await user.click(within(dialog).getByRole('button', { name: 'אישור והפעלה' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('הקוד שגוי');

    await user.clear(within(dialog).getByLabelText('קוד מהאפליקציה'));
    await user.type(within(dialog).getByLabelText('קוד מהאפליקציה'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'אישור והפעלה' }));
    const codes = await within(dialog).findByRole('list', { name: 'קודי גיבוי' });
    expect(within(codes).getAllByRole('listitem')).toHaveLength(8);
    expect(server.db.users.find(u => u.username === 'bob').totp).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'העתקה' }));   // no clipboard in jsdom: ignored

    await user.click(within(dialog).getByRole('button', { name: 'שמרתי אותם' }));
    expect(within(dialog).getByText('פעיל')).toBeInTheDocument();
    expect(within(dialog).getByText('נותרו 8 קודי גיבוי')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('dialog', { name: 'אבטחת חשבון' })).toBeNull();
  });

  it('new backup codes and turning 2FA off need the password and a code', async () => {
    const { user, server } = await renderApp({ as: 'bob', setup: withTwoFactor('bob') });
    let dialog = await openSecurity(user);
    await user.click(await within(dialog).findByRole('button', { name: 'קודי גיבוי חדשים' }));
    await user.type(within(dialog).getByLabelText('סיסמה'), 'password123');
    await user.type(within(dialog).getByLabelText('קוד אימות'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'יצירת קודים חדשים' }));
    expect(await within(dialog).findByText('naaa-bbbb-cccc')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'שמרתי אותם' }));

    await user.click(within(dialog).getByRole('button', { name: 'כיבוי אימות דו-שלבי' }));
    await user.type(within(dialog).getByLabelText('סיסמה'), 'wrong-pass');
    await user.type(within(dialog).getByLabelText('קוד אימות'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'כיבוי' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('הסיסמה שגויה');
    await user.clear(within(dialog).getByLabelText('סיסמה'));
    await user.type(within(dialog).getByLabelText('סיסמה'), 'password123');
    await user.click(within(dialog).getByRole('button', { name: 'כיבוי' }));
    expect(await within(dialog).findByText('כבוי')).toBeInTheDocument();
    expect(server.db.users.find(u => u.username === 'bob').totp).toBe(false);

    // cancel goes back to the status screen
    await user.click(within(dialog).getByRole('button', { name: 'הפעלת אימות דו-שלבי' }));
    await user.click(await within(dialog).findByRole('button', { name: 'ביטול' }));
    expect(within(dialog).getByText('כבוי')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'אבטחת חשבון' })).toBeNull());
  });

  it('shows a load error with retry', async () => {
    const { user, server } = await renderApp({ as: 'bob' });
    server.fetch.failNext = 'GET /api/auth/2fa';
    const dialog = await openSecurity(user);
    await user.click(await within(dialog).findByRole('button', { name: 'נסה שוב' }));
    expect(await within(dialog).findByText('כבוי')).toBeInTheDocument();
  });
});

describe('two-factor login', () => {
  it('asks for the code after the password, then logs in', async () => {
    const { user, server } = await renderApp({ setup: withTwoFactor('bob') });
    await loginAs(user, 'bob');
    expect(await screen.findByText('אימות דו-שלבי')).toBeInTheDocument();
    expect(server.db.sessionUser).toBeNull();

    await user.type(screen.getByLabelText('קוד אימות'), '111111');
    await user.click(screen.getByRole('button', { name: 'אימות והתחברות' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('הקוד שגוי');
    expect(screen.getByText('אימות דו-שלבי')).toBeInTheDocument();     // still on the code step

    await user.clear(screen.getByLabelText('קוד אימות'));
    await user.type(screen.getByLabelText('קוד אימות'), '123456');
    await user.click(screen.getByRole('button', { name: 'אימות והתחברות' }));
    await waitFor(() => expect(screen.queryByText('אימות דו-שלבי')).toBeNull());
    expect(server.db.sessionUser).toBe(2);
  });

  it('a backup code works once and reports how many are left', async () => {
    const { user } = await renderApp({ setup: withTwoFactor('bob') });
    await loginAs(user, 'bob');
    await user.click(await screen.findByRole('button', { name: /שימוש בקוד גיבוי/ }));
    await user.type(screen.getByLabelText('קוד גיבוי'), 'AAAA-BBBB-CCCC');
    await user.click(screen.getByRole('button', { name: 'אימות והתחברות' }));
    expect(await screen.findByText(/נותרו 7/)).toBeInTheDocument();
  });

  it('too many wrong codes → back to the password; "back to login" works', async () => {
    const { user } = await renderApp({ setup: withTwoFactor('bob') });
    await loginAs(user, 'bob');
    await user.click(await screen.findByRole('button', { name: /שימוש בקוד גיבוי/ }));
    await user.click(screen.getByRole('button', { name: /שימוש בקוד מהאפליקציה/ }));
    for (let i = 0; i < 3; i++) {
      await user.clear(screen.getByLabelText('קוד אימות'));
      await user.type(screen.getByLabelText('קוד אימות'), '999999');
      await user.click(screen.getByRole('button', { name: 'אימות והתחברות' }));
      await screen.findByRole('alert');
    }
    expect(await screen.findByText('טוב שחזרת')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('יותר מדי ניסיונות');

    // the password is still filled in → log in again, then go back from the code step
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    await user.click(await screen.findByRole('button', { name: 'חזרה להתחברות' }));
    expect(screen.getByText('טוב שחזרת')).toBeInTheDocument();
  });
});
