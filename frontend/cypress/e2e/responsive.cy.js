// Phone size: no horizontal scrolling on the main pages, and the menu works (part 3 b).
describe('responsive (phone)', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.loginApi('daniel_p', 'handyhub123');
  });

  for (const hash of ['#/', '#/market', '#/stores', '#/u/daniel_p', '#/admin']) {
    it(`no horizontal scroll on ${hash}`, () => {
      cy.visit(`/${hash}`);
      cy.findByRole('banner').should('be.visible');
      cy.get('main').should('be.visible');
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(doc.documentElement.clientWidth);
      });
    });
  }

  it('the ☰ menu opens and navigates', () => {
    cy.visit('/');
    cy.findByRole('button', { name: 'תפריט' }).click();
    cy.get('aside.animate-in-rtl-drawer').within(() => {
      cy.contains('תגיות חמות').should('exist');
      cy.contains('button', 'שוק').click();
    });
    cy.location('hash').should('eq', '#/market');
  });
});
