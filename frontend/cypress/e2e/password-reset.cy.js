// "Forgot password" → the email with the link (e2e.sh writes emails to files) → a new password → log in with it.
import { uniqueName } from '../support/helpers.js';

describe('password reset by email', () => {
  it('resets the password through the emailed link', () => {
    const username = uniqueName('forgetful');
    const email = `${username}@e2e.test`;
    cy.signupApi(username);
    cy.logoutApi();

    cy.visit('/');
    cy.userMenu('התחבר');
    cy.contains('button', 'שכחתי סיסמה').click();
    cy.findByLabelText('אימייל').type(email);
    cy.findByRole('button', { name: 'שלחו לי קישור' }).click();
    cy.findByRole('status').should('contain', 'שלחנו אליה קישור');

    cy.task('lastMail', email).then((mail) => {
      expect(mail, 'the reset email').to.exist;
      const link = mail.text.match(/https?:\/\/\S+#\/reset\/\S+/)[0];
      cy.visit(link);
    });
    cy.contains('h1', 'בחירת סיסמה חדשה').should('be.visible');
    cy.findByLabelText(/^סיסמה חדשה/).type('brand-new-pass');   // the label also holds the "הצג" button
    cy.findByLabelText('אימות סיסמה').type('brand-new-pass');
    cy.findByRole('button', { name: 'שמירת סיסמה' }).click();
    cy.contains('h1', 'הסיסמה עודכנה').should('be.visible');

    // the new password works, the old one doesn't
    cy.request({ method: 'POST', url: '/api/auth/login', body: { login: username, password: 'password123' },
                 failOnStatusCode: false }).its('status').should('eq', 401);
    cy.loginApi(username, 'brand-new-pass').its('user.username').should('eq', username);
  });
});
