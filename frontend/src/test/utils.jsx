import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AuthProvider } from '../lib/auth.jsx';
import { App } from '../components/App.jsx';
import { createFakeServer } from './fakeServer.js';

/** Render the whole app against a fresh fake server. Optionally logged in / at a hash route. */
export async function renderApp({ as, hash, setup } = {}) {
  const server = createFakeServer();
  if (setup) setup(server);
  if (as) server.loginAs(as);
  vi.stubGlobal('fetch', server.fetch);
  if (hash) window.location.hash = hash;
  const user = userEvent.setup();
  const utils = render(<AuthProvider><App /></AuthProvider>);
  // wait for /api/auth/me to settle (the spinner goes away)
  await screen.findByRole('banner');
  return { server, user, ...utils };
}

export const navigate = (hash) => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};
