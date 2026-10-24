export const $ = (id) => document.getElementById(id);

// Open the app with ?debug=1 to see technical error details on screen.
export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
