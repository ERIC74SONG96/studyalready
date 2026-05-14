/**
 * Soumission du formulaire « Créer mon profil » → insert Supabase (table profiles).
 * Statut : published immédiatement (trigger SQL) pour visibilité annuaire.
 */
(function () {
  'use strict';

  function showStatus(el, html, cls) {
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.remove('text-red-600', 'text-green-600', 'text-amber-700', 'text-slate-600');
    el.classList.add(cls || 'text-slate-600');
    el.innerHTML = html;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  }

  function parseOuvertures(form) {
    var boxes = form.querySelectorAll('input[name="ouverture"]:checked');
    var out = [];
    boxes.forEach(function (b) { out.push(b.value); });
    return out;
  }

  function boolCheckbox(form, name) {
    var el = form.querySelector('input[name="' + name + '"]');
    return !!(el && el.checked);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('creerProfilForm');
    var statusEl = document.getElementById('creerProfilStatus');
    var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    if (!form) return;

    if (!window.studyalreadySb) {
      showStatus(
        statusEl,
        '<strong>Connexion au serveur impossible.</strong> Rechargez la page, vérifiez votre réseau ou désactivez temporairement les bloqueurs de publicité pour ce site (le script Supabase doit se charger). Sans cela, l’envoi du formulaire ne peut pas fonctionner.',
        'text-red-600'
      );
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var sb = window.studyalreadySb;
      if (!sb) {
        showStatus(
          statusEl,
          '<strong>Client Supabase indisponible.</strong> Rechargez la page ou essayez un autre navigateur. Si le problème continue, écrivez à <a href="mailto:contact@studyalready.com" class="underline font-semibold">contact@studyalready.com</a>.',
          'text-red-600'
        );
        return;
      }

      var honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) {
        showStatus(statusEl, 'Envoi ignoré.', 'text-amber-700');
        return;
      }

      var fd = new FormData(form);
      var row = {
        prenom: (fd.get('prenom') || '').trim(),
        initial_nom: (fd.get('initial_nom') || '').trim(),
        email: (fd.get('email') || '').trim(),
        whatsapp: (fd.get('telephone') || '').trim() || null,
        linkedin: (fd.get('linkedin') || '').trim() || null,
        statut: (fd.get('statut') || '').trim(),
        annee: (fd.get('annee') || '').trim() || null,
        universite: (fd.get('universite') || '').trim(),
        filiere: (fd.get('filiere') || '').trim(),
        domaine: (fd.get('domaine') || '').trim(),
        ville: (fd.get('ville') || '').trim() || null,
        specialites: (fd.get('specialites') || '').trim() || null,
        bio: (fd.get('bio') || '').trim() || null,
        ouvertures: parseOuvertures(form),
        consent_publication: boolCheckbox(form, 'consent_publication'),
        contact_via_studyalready: boolCheckbox(form, 'contact_via_studyalready'),
        afficher_linkedin: boolCheckbox(form, 'afficher_linkedin'),
        newsletter: boolCheckbox(form, 'newsletter'),
        consent_rgpd: boolCheckbox(form, 'rgpd')
      };

      showStatus(statusEl, 'Envoi en cours…', 'text-slate-600');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
      }

      sb.from('profiles')
        .insert(row)
        .then(function (res) {
          if (res.error) {
            var msg = res.error.message || 'Erreur serveur';
            if (res.error.code === '42501' || (msg && msg.indexOf('policy') !== -1)) {
              msg += ' — Avez-vous exécuté le script SQL dans Supabase (voir dossier supabase/migrations) ?';
            }
            showStatus(statusEl, escapeHtml(msg), 'text-red-600');
            return;
          }
          showStatus(
            statusEl,
            'Merci ! Votre profil est <strong>visible dans l’annuaire</strong> pour les autres membres (rafraîchissez la page annuaire si besoin). Pour une modification ou un retrait : <a href="mailto:contact@studyalready.com" class="underline font-semibold">contact@studyalready.com</a>.',
            'text-green-600'
          );
          form.reset();
        })
        .catch(function (err) {
          var m = (err && err.message) || String(err);
          showStatus(
            statusEl,
            escapeHtml('Erreur réseau ou technique : ' + m + '. Réessayez ou contactez contact@studyalready.com.'),
            'text-red-600'
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
          }
        });
    }, true);
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
