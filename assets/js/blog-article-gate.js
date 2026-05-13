/**
 * Affiche le corps d’un article du blog seulement si une session Supabase
 * est présente (même détection que sa-nav-session.js).
 */
(function () {
  'use strict';

  function applyBlogArticleGate() {
    var full = document.getElementById('blogArticleFull');
    var gate = document.getElementById('blogArticleGate');
    if (!full || !gate) return;
    var ok =
      typeof window.__saHasPersistedSession === 'function' &&
      window.__saHasPersistedSession();
    if (ok) {
      full.classList.remove('hidden');
      gate.classList.add('hidden');
    }
  }

  function boot() {
    applyBlogArticleGate();
  }
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) applyBlogArticleGate();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
