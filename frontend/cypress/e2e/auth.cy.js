// Sign up, log out and log back in — through the real UI, API and database.
import { PASSWORD, uniqueName } from '../support/helpers.js';

describe('sign up / log in / log out', () => {
  it('a new user signs up, logs out and logs back in', () => {
    const username = uniqueName('maker');
    cy.visit('/');
    cy.userMenu('הרשמה — בחינם');
    cy.findByLabelText('שם מלא').type('יוצרת חדשה');
    cy.findByLabelText('שם משתמש').type(username);
    cy.findByLabelText('אימייל').type(`${username}@e2e.test`);
    cy.findByLabelText('סיסמה').type(PASSWORD);
    cy.findByRole('button', { name: 'הרשמה' }).click();

    // logged in: the user menu shows the new account
    cy.findByRole('button', { name: 'תפריט משתמש' }).click();
    cy.contains(`@${username}`).should('be.visible');
    cy.contains('button', 'התנתק').click();

    cy.userMenu('התחבר');
    cy.findByLabelText('אימייל או שם משתמש').type(username);
    cy.findByLabelText('סיסמה').type(PASSWORD);
    cy.findByRole('button', { name: 'התחברות' }).click();
    cy.findByRole('button', { name: 'תפריט משתמש' }).click();
    cy.contains(`@${username}`).should('be.visible');
  });

  it('a wrong password shows an error', () => {
    cy.visit('/');
    cy.userMenu('התחבר');
    cy.findByLabelText('אימייל או שם משתמש').type('daniel_p');
    cy.findByLabelText('סיסמה').type('not-the-password');
    cy.findByRole('button', { name: 'התחברות' }).click();
    cy.findByRole('alert').should('contain', 'פרטי התחברות שגויים');
  });
});
