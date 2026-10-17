// Follow someone → their posts in "people I follow"; send them a private message that really arrives.
import { uniqueName } from '../support/helpers.js';

describe('follow and private messages', () => {
  it('follows a maker and sees their posts in the following feed', () => {
    cy.signupApi(uniqueName('fan'));
    cy.visit('/#/u/alon_builds');
    cy.contains('main h1', 'אלון כהן').should('be.visible');
    // the big button in the profile header (lists further down have their own small ones)
    cy.get('main').findAllByRole('button', { name: 'עקוב' }).first().click();
    cy.get('main').findAllByRole('button', { name: 'במעקב' }).first().should('have.attr', 'aria-pressed', 'true');

    cy.visit('/');
    cy.findByRole('tab', { name: /אנשים שאני עוקב/ }).click();
    cy.get('main article.paper-card').should('have.length.greaterThan', 0)   // posts (not the marketplace strip)
      .each(($post) => expect($post.text()).to.contain('אלון כהן'));
  });

  it('sends a private message from a profile, and the recipient gets it', () => {
    const sender = uniqueName('writer');
    const body = `היי אלון, אפשר לראות את הסדנה? ${sender}`;
    cy.signupApi(sender);
    cy.visit('/#/u/alon_builds');
    cy.get('main').contains('button', 'הודעה').click();
    cy.findAllByLabelText('הודעה').filter(':visible').first().type(body);
    cy.findAllByRole('button', { name: 'שלח' }).filter(':visible').first().click();
    cy.contains(body).should('be.visible');

    // the recipient really has it (as alon_builds, through the API)
    cy.logoutApi();
    cy.loginApi('alon_builds', 'handyhub123');
    cy.request('/api/messages/unread').its('body.count').should('be.greaterThan', 0);
    cy.request(`/api/messages/with/${sender}`).its('body.items').then((items) => {
      expect(items.map(m => m.body)).to.include(body);
    });
  });
});
