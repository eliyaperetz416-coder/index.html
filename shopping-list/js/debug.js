// Opt-in diagnostics for phones without devtools: open the app with ?debug=1
// and uncaught errors are shown on screen.
if (new URLSearchParams(location.search).get('debug') === '1') {
  var showDebug = function (text) {
    var box = document.getElementById('debugErrorBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'debugErrorBox';
      box.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff3333;color:#fff;font-size:12px;padding:10px;z-index:99999;direction:ltr;text-align:left;word-break:break-word;';
      document.body.appendChild(box);
    }
    box.textContent = text;
  };
  window.addEventListener('error', function (e) { showDebug('JS ERROR: ' + e.message + ' (line ' + e.lineno + ')'); });
  window.addEventListener('unhandledrejection', function (e) {
    showDebug('PROMISE: ' + ((e.reason && (e.reason.code || e.reason.message)) || e.reason));
  });
}
