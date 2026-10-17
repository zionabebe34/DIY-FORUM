// Turn on two-factor login (QR / key → a code) and log in with a code, like an authenticator app.
import { PASSWORD, uniqueName } from '../support/helpers.js';

describe('two-factor login (TOTP)', () => {
  it('enables 2FA, then needs a code at login', () => {
    const username = uniqueName('secure');
    cy.signupApi(username);
    cy.visit('/');

    cy.userMenu('אבטחת חשבון');
    cy.findByRole('dialog', { name: 'אבטחת חשבון' }).within(() => {
      cy.findByRole('button', { name: 'הפעלת אימות דו-שלבי' }).click();
      cy.findByAltText('QR לאפליקציית האימות').should('be.visible');
      cy.get('code').invoke('text').then((key) => {
        const secret = key.replace(/\s/g, '');
        cy.wrap(secret).as('secret');
        cy.task('totp', { secret }).then((code) => cy.findByLabelText('קוד מהאפליקציה').type(code));
      });
      cy.findByRole('button', { name: 'אישור והפעלה' }).click();
      cy.findByRole('list', { name: 'קודי גיבוי' }).find('li').should('have.length', 8);
      cy.findByRole('button', { name: 'שמרתי אותם' }).click();
      cy.contains('פעיל').should('be.visible');
      cy.findByRole('button', { name: 'סגור' }).click();
    });

    cy.userMenu('התנתק');
    cy.userMenu('התחבר');
    cy.findByLabelText('אימייל או שם משתמש').type(username);
    cy.findByLabelText('סיסמה').type(PASSWORD);
    cy.findByRole('button', { name: 'התחברות' }).click();

    // the password alone isn't enough
    cy.contains('h2', 'אימות דו-שלבי').should('be.visible');
    cy.request('/api/auth/me').its('body.user').should('be.null');
    // a code is accepted once, so use the next 30-second step (the server allows ±1 step)
    cy.get('@secret').then((secret) => cy.task('totp', { secret, offsetSteps: 1 }))
      .then((code) => cy.findByLabelText('קוד אימות').type(code));
    cy.findByRole('button', { name: 'אימות והתחברות' }).click();
    cy.contains('h2', 'אימות דו-שלבי').should('not.exist');
    cy.request('/api/auth/me').its('body.user.username').should('eq', username);
  });
});
