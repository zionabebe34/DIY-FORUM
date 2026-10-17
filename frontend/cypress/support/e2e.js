// Loaded before every spec: Testing Library queries (findByRole, findByLabelText…) + a few shortcuts.
import '@testing-library/cypress/add-commands';
import { PASSWORD } from './helpers.js';

/** Create an account through the API (fast setup) — the browser is then logged in as it. */
Cypress.Commands.add('signupApi', (username, name = 'משתמש בדיקה') =>
  cy.request('POST', '/api/auth/signup', { username, name, email: `${username}@e2e.test`, password: PASSWORD })
    .its('body.user'));

/** Log in through the API (fast setup) — for the flows that aren't about logging in. */
Cypress.Commands.add('loginApi', (login, password = PASSWORD) =>
  cy.request('POST', '/api/auth/login', { login, password }).its('body'));

Cypress.Commands.add('logoutApi', () => cy.request('POST', '/api/auth/logout'));

/** Open the user menu in the navbar and click one of its items. */
Cypress.Commands.add('userMenu', (item) => {
  cy.findByRole('button', { name: 'תפריט משתמש' }).click();
  cy.contains('button', item).click();
});

