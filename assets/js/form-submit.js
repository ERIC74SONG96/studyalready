/**
 * Bind générique des formulaires StudyAlready vers Supabase (table form_submissions).
 * Remplace Web3Forms. Aucune clé externe nécessaire.
 *
 * Usage côté pages :
 *   window.StudyAlreadyForms.bind({
 *     formId: 'contactForm',
 *     statusId: 'formStatus',
 *     formType: 'contact',
 *     successMessage: 'Merci ! Votre message est bien arrivé. Réponse sous 48 h.',
 *   });
 */
(function () {
  'use strict';

  var IGNORED_KEYS = { access_key: 1, botcheck: 1, from_name: 1, subject: 1, website: 1 };

  function readFormData(form) {
    var fd = new FormData(form);
    var payload = {};
    var multi = {};
    fd.forEach(function (value, key) {
      if (IGNORED_KEYS[key]) return;
      if (multi[key] !== undefined) {
        if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
        payload[key].push(value);
      } else {
        multi[key] = true;
        payload[key] = value;
      }
    });
    return payload;
  }

  function pickContact(payload) {
    return {
      nom: payload.nom || payload.nom_complet || payload.prenom || null,
      email: payload.email || null,
      whatsapp: payload.whatsapp || payload.telephone || null,
      subject: payload.subject || null
    };
  }

  function showStatus(el, html, cls) {
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.remove('text-red-600', 'text-green-600', 'text-amber-700', 'text-slate-600');
    el.classList.add(cls || 'text-slate-600');
    el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fallbackMessage() {
    var em =
      (typeof window !== 'undefined' &&
        window.STUDYALREADY_CONFIG &&
        window.STUDYALREADY_CONFIG.CONTACT_EMAIL) ||
      'contact@studyalready.com';
    var subj = encodeURIComponent('StudyAlready - contact site');
    return (
      'L’envoi automatique est temporairement indisponible. ' +
      'En attendant, écrivez-nous : ' +
      '<a href="mailto:' +
      escapeHtml(em) +
      '?subject=' +
      subj +
      '" class="underline font-semibold text-brand-dark">' +
      escapeHtml(em) +
      '</a> ' +
      'ou <a href="https://wa.me/32465339448" target="_blank" rel="noopener" class="underline font-semibold">WhatsApp</a>.'
    );
  }

  function bind(opts) {
    var form = document.getElementById(opts.formId);
    var statusEl = document.getElementById(opts.statusId);
    if (!form || !statusEl) return false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) {
        showStatus(statusEl, 'Envoi ignoré.', 'text-amber-700');
        return;
      }

      var sb = window.studyalreadySb;
      if (!sb) {
        showStatus(statusEl, fallbackMessage(), 'text-amber-700');
        return;
      }

      var payload = readFormData(form);
      var contact = pickContact(payload);

      var row = {
        form_type: opts.formType,
        status: 'new',
        nom: contact.nom,
        email: contact.email,
        whatsapp: contact.whatsapp,
        subject: contact.subject || (opts.subjectPrefix ? opts.subjectPrefix + (contact.nom ? ' - ' + contact.nom : '') : null),
        payload: payload,
        origin_url: (typeof window.location !== 'undefined') ? window.location.href : null,
        user_agent: (typeof navigator !== 'undefined') ? (navigator.userAgent || '').slice(0, 280) : null
      };

      showStatus(statusEl, 'Envoi en cours…', 'text-slate-600');

      /* Si l'étudiant est connecté à son espace, on rattache la demande
         à son compte (user_id). Permet l'affichage dans son dashboard. */
      var insertPromise = sb.auth && sb.auth.getSession
        ? sb.auth.getSession().then(function (r) {
            if (r && r.data && r.data.session && r.data.session.user) {
              row.user_id = r.data.session.user.id;
            }
            return sb.from('form_submissions').insert(row);
          }).catch(function () {
            return sb.from('form_submissions').insert(row);
          })
        : sb.from('form_submissions').insert(row);

      insertPromise.then(function (res) {
        if (res.error) {
          var msg = res.error.message || 'Erreur d’envoi';
          if (res.error.code === '42P01' || /relation .* does not exist/i.test(msg)) {
            msg = 'La table « form_submissions » n’existe pas encore dans Supabase. Exécutez le script SQL <code class="text-xs bg-slate-100 px-1 rounded">supabase/migrations/002_form_submissions.sql</code>.';
          } else if (res.error.code === '42501' || /policy/i.test(msg)) {
            msg = 'Politique RLS bloquante. Vérifiez les policies de la table form_submissions.';
          }
          showStatus(statusEl, escapeHtml(msg), 'text-red-600');
          return;
        }
        showStatus(statusEl, escapeHtml(opts.successMessage || 'Merci ! Votre message est bien arrivé.'), 'text-green-600');
        if (opts.resetOnSuccess !== false) form.reset();
      });
    });

    return true;
  }

  window.StudyAlreadyForms = { bind: bind, readFormData: readFormData };
})();
