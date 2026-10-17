// A user reports a post → an admin sees the case in the dashboard and deletes the content.
import { uniqueName } from '../support/helpers.js';

describe('report and moderate', () => {
  it('report → the admin deletes the reported post', () => {
    const author = uniqueName('spammer');
    const text = `קנו עכשיו בזול!!! ${author}`;
    cy.signupApi(author);
    cy.request({ method: 'POST', url: '/api/posts', form: true, body: { body: `<p>${text}</p>` } })
      .its('body.post.id').as('postId');

    // another user reports it
    cy.signupApi(uniqueName('reporter'));
    cy.get('@postId').then((id) => cy.visit(`/#/post/${id}`));
    cy.contains('main article', text).findByRole('button', { name: 'אפשרויות' }).click();
    cy.contains('button', 'דיווח על הפוסט').click();
    cy.contains('label', 'ספאם או פרסומת').click();
    cy.findByRole('button', { name: 'שלח דיווח' }).click();
    cy.contains('דיווח על').should('not.exist');

    // the admin (demo account daniel_p) handles it
    cy.logoutApi();
    cy.loginApi('daniel_p', 'handyhub123');
    cy.visit('/#/admin');
    cy.reload();   // visiting a URL that differs only after '#' doesn't reload: make the app see the new user
    cy.contains(text).should('be.visible')
      .parents('article, li, section, div.rounded-2xl').first()
      .contains('button', 'מחק תוכן').click();
    cy.contains('התוכן נמחק').should('be.visible');
    cy.get('@postId').then((id) => {
      cy.request({ url: `/api/posts/${id}`, failOnStatusCode: false }).its('status').should('eq', 404);
    });
  });
});
