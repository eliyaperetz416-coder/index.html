// READ-ONLY backup of every list you are a member of.
// Run: open https://shopping-list-app-2fa25.web.app, sign in, open DevTools -> Console,
// paste this whole file and press Enter. A JSON file is downloaded.
// (Safari on iPhone has no console: do this from a desktop browser with the same Google account.)
(async () => {
  const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const FB = window.FB;
  const uid = FB.auth.currentUser?.uid;
  if (!uid) { console.error('Not signed in'); return; }
  const snap = await getDocs(FB.query(FB.collection(FB.db, 'lists'), FB.where('members', 'array-contains', uid)));
  const toJson = v => {
    if (v && typeof v.toMillis === 'function') return { __timestamp_ms: v.toMillis() };
    if (Array.isArray(v)) return v.map(toJson);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJson(x)]));
    return v;
  };
  const out = { exportedAt: new Date().toISOString(), uid, lists: snap.docs.map(d => ({ id: d.id, data: toJson(d.data()) })) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = `shopping-list-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  console.log(`Backed up ${out.lists.length} list(s):`, out.lists.map(l => `${l.data.name}: ${(l.data.items||[]).length} items, ${(l.data.purchaseHistory||[]).length} purchases`));
})();
