// Publish a post with an image and a hashtag, like it, comment on it, filter by its tag, delete it.
import { uniqueName } from '../support/helpers.js';

describe('posts', () => {
  it('publish with an image → like → comment → filter by tag → delete', () => {
    const username = uniqueName('poster');
    const tag = uniqueName('tag');
    const text = `מדף חדש מעץ אלון ${tag}`;
    cy.signupApi(username);
    cy.visit('/');

    cy.findByRole('button', { name: /מה בנית היום/ }).click();
    cy.contains('h3', 'פוסט חדש').closest('.shadow-pop').within(() => {
      cy.get('.ProseMirror').click().type(text);
      cy.get('input[type=file]').selectFile('cypress/fixtures/shelf.png', { force: true });
      cy.findByPlaceholderText(/תייגו/).type(`${tag}{enter}`);
      cy.findByRole('button', { name: /פרסם/ }).click();
    });

    // the new post is on top of the feed, with its image (served by the real API)
    cy.contains('main article', text).as('post');
    cy.get('@post').find('img[src^="/uploads/"]').should('be.visible')
      .and(($img) => expect($img[0].naturalWidth).to.be.greaterThan(0));

    // like (the count comes back from the server)
    cy.get('@post').find('button.relative').click();
    cy.get('@post').find('button.relative').should('contain', '1');

    // comment
    cy.get('@post').findByTitle('תגובות').click();
    cy.get('@post').findByLabelText('כתבו תגובה…').type('נראה מעולה!{enter}');
    cy.get('@post').contains('נראה מעולה!').should('be.visible');

    // the hashtag filters the feed
    cy.get('@post').contains('button', `#${tag}`).click();
    cy.contains(`סינון לפי #${tag}`).should('be.visible');
    cy.location('hash').should('eq', `#/tag/${tag}`);

    // delete (the confirm dialog is accepted automatically by Cypress)
    cy.contains('main article', text).findByRole('button', { name: 'אפשרויות' }).click();
    cy.contains('button', 'מחק פוסט').click();
    cy.contains('main article', text).should('not.exist');
  });
});
