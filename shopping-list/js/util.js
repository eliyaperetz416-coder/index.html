export const $ = (id) => document.getElementById(id);

// Open the app with ?debug=1 to see technical error details on screen.
export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

export const DAY_MS = 24 * 60 * 60 * 1000;
