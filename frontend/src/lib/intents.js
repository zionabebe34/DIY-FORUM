// Buttons deep inside post cards ask the App to open the composer / a chat via
// window events, so the handlers don't have to be threaded through every list.
export const SHARE_EVENT = 'hh:share';
export const MESSAGE_EVENT = 'hh:message';

/** Open the composer to write a post that shares `post`. */
export function requestShare(post) {
  window.dispatchEvent(new CustomEvent(SHARE_EVENT, { detail: post }));
}

/** Open the private chat with `username`. */
export function requestMessage(username) {
  window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: username }));
}

/** Fired after a post is published or deleted (e.g. the hot-tags counts refresh). */
export const POSTS_CHANGED_EVENT = 'hh:posts-changed';
export function announcePostsChanged() {
  window.dispatchEvent(new Event(POSTS_CHANGED_EVENT));
}
