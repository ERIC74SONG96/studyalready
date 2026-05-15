(function () {
  'use strict';

  function showStatus(el, html, cls) {
    if (!el) return;
    el.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-slate-600');
    el.classList.add(cls || 'text-slate-600');
    el.innerHTML = html;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }

  function localToIso(val) {
    if (!val) return null;
    try {
      return new Date(val).toISOString();
    } catch (e) {
      return null;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('creerEventForm');
    var statusEl = document.getElementById('creerEventStatus');
    var gateEl = document.getElementById('creerEventGate');
    var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    if (!form) return;

    var sb = window.studyalreadySb;
    if (!sb) {
      showStatus(statusEl, '<strong>Service indisponible.</strong> Rechargez la page.', 'text-red-600');
      return;
    }

    sb.auth.getSession().then(function (res) {
      var user = res.data && res.data.session && res.data.session.user;
      if (!user) {
        if (form) form.classList.add('hidden');
        if (gateEl) gateEl.classList.remove('hidden');
        return;
      }
      if (gateEl) gateEl.classList.add('hidden');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) return;

      if (!sb) {
        showStatus(statusEl, 'Service indisponible.', 'text-red-600');
        return;
      }

      var fd = new FormData(form);
      var starts = localToIso(fd.get('starts_at'));
      if (!starts) {
        showStatus(statusEl, 'Date de début invalide.', 'text-red-600');
        return;
      }
      var ends = localToIso(fd.get('ends_at'));
      var isFree = form.querySelector('#is_free') && form.querySelector('#is_free').checked;

      showStatus(statusEl, 'Publication en cours…', 'text-slate-600');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }

      sb.auth.getSession().then(function (sessRes) {
        var user = sessRes.data && sessRes.data.session && sessRes.data.session.user;
        if (!user) {
          showStatus(statusEl, 'Connectez-vous pour publier un événement.', 'text-red-600');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
          return;
        }

        var authorLabel = (user.user_metadata && user.user_metadata.full_name) || user.email || 'Membre';
        var payload = {
          user_id: user.id,
          author_label: String(authorLabel).slice(0, 120),
          title: String(fd.get('title') || '').trim(),
          description: String(fd.get('description') || '').trim(),
          event_type: String(fd.get('event_type') || 'autre'),
          event_format: String(fd.get('event_format') || 'online'),
          starts_at: starts,
          ends_at: ends,
          location: String(fd.get('location') || '').trim() || null,
          city: String(fd.get('city') || '').trim() || null,
          link_url: String(fd.get('link_url') || '').trim() || null,
          contact_hint: String(fd.get('contact_hint') || '').trim() || null,
          is_free: isFree,
          price_hint: isFree ? null : (String(fd.get('price_hint') || '').trim() || null),
          status: 'published'
        };

        var ins = window.StudyAlreadyEvents
          ? window.StudyAlreadyEvents.insertEvent(sb, payload)
          : sb.from('community_events').insert(payload).select('id').maybeSingle();

        ins.then(function (r) {
          if (r.error) {
            var msg = r.error.message || 'Erreur';
            if (r.error.code === '42501' || (msg && msg.indexOf('policy') !== -1)) {
              msg = 'Accès refusé : rejoignez le réseau ou créez un profil annuaire avec la même adresse e-mail.';
            }
            showStatus(statusEl, '<strong>Échec :</strong> ' + msg, 'text-red-600');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
            return;
          }
          var id = r.data && r.data.id;
          showStatus(
            statusEl,
            '<strong>Événement publié !</strong> <a href="annuaire.html?vue=evenements" class="underline font-semibold">Voir dans l\'annuaire</a>',
            'text-green-600'
          );
          form.reset();
          if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
        });
      });
    });
  });
})();
