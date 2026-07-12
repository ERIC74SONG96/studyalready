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

  var IGNORED_KEYS = { access_key: 1, botcheck: 1, from_name: 1, subject: 1, website: 1, company: 1 };
  var MIN_SUBMIT_DELAY_MS = 1800;

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
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fieldLabel(field) {
    if (field.id) {
      var label = document.querySelector('label[for="' + field.id.replace(/"/g, '\\"') + '"]');
      if (label) return label.textContent.replace(/\s*\*\s*$/, '').trim();
    }
    var wrapLabel = field.closest ? field.closest('label') : null;
    if (wrapLabel) return wrapLabel.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();
    return field.getAttribute('aria-label') || field.name || 'champ';
  }

  function normalizeText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function looksLikeSpam(payload) {
    var combined = Object.keys(payload).map(function (k) {
      return normalizeText(payload[k]);
    }).join(' ').toLowerCase();
    if (!combined) return false;
    if ((combined.match(/https?:\/\//g) || []).length > 2) return true;
    if (/\b(crypto|casino|loan|viagra|porn|escort|seo backlinks)\b/i.test(combined)) return true;
    return false;
  }

  function validateForm(form) {
    var invalid = [];
    var fields = form.querySelectorAll('input, textarea, select');

    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (field.disabled || field.type === 'hidden' || field.name === 'website' || field.name === 'company') continue;

      var value = normalizeText(field.value);
      if (field.required && !value && field.type !== 'checkbox' && field.type !== 'radio') {
        invalid.push(fieldLabel(field));
        continue;
      }
      if ((field.type === 'checkbox' || field.type === 'radio') && field.required && !field.checked) {
        invalid.push(fieldLabel(field));
        continue;
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        invalid.push(fieldLabel(field));
        continue;
      }
      if ((field.name === 'whatsapp' || field.name === 'telephone' || field.name === 'telephone_whatsapp') &&
          value && !/^\+?[0-9 () .-]{7,24}$/.test(value)) {
        invalid.push(fieldLabel(field));
        continue;
      }
      if (field.minLength > 0 && value && value.length < field.minLength) {
        invalid.push(fieldLabel(field));
        continue;
      }
      if (field.maxLength > 0 && value.length > field.maxLength) {
        invalid.push(fieldLabel(field));
        continue;
      }
      if (field.pattern && value) {
        try {
          var re = new RegExp('^(?:' + field.pattern + ')$');
          if (!re.test(value)) invalid.push(fieldLabel(field));
        } catch (_e) {}
      }
    }

    if (invalid.length) {
      return {
        ok: false,
        message: 'Merci de corriger : ' + escapeHtml(invalid.slice(0, 4).join(', ')) + (invalid.length > 4 ? '…' : '.')
      };
    }

    if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
      if (typeof form.reportValidity === 'function') form.reportValidity();
      return { ok: false, message: 'Merci de vérifier les champs obligatoires avant l’envoi.' };
    }

    return { ok: true, message: '' };
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
      '.'
    );
  }

  function bind(opts) {
    var form = document.getElementById(opts.formId);
    var statusEl = document.getElementById(opts.statusId);
    if (!form || !statusEl) return false;
    var startedAt = Date.now();
    var submitting = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;

      var honeypot = form.querySelector('input[name="website"], input[name="company"]');
      if (honeypot && honeypot.value) {
        showStatus(statusEl, 'Envoi ignoré.', 'text-amber-700');
        return;
      }

      if (Date.now() - startedAt < (opts.minSubmitDelayMs || MIN_SUBMIT_DELAY_MS)) {
        showStatus(statusEl, 'Envoi ignoré. Rechargez la page si vous êtes bien un visiteur humain.', 'text-amber-700');
        return;
      }

      var validation = validateForm(form);
      if (!validation.ok) {
        showStatus(statusEl, validation.message, 'text-red-600');
        return;
      }

      var sb = window.studyalreadySb;
      if (!sb) {
        showStatus(statusEl, fallbackMessage(), 'text-amber-700');
        return;
      }

      var payload = readFormData(form);
      if (looksLikeSpam(payload)) {
        showStatus(statusEl, 'Votre message ressemble à un contenu automatisé. Si c’est une erreur, écrivez-nous directement à contact@studyalready.com.', 'text-amber-700');
        return;
      }
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

      submitting = true;
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
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
            msg = 'Service temporairement indisponible. Réessayez plus tard ou écrivez à contact@studyalready.com.';
          } else if (res.error.code === '42501' || /policy/i.test(msg)) {
            msg = 'Envoi refusé pour des raisons de sécurité. Vérifiez que tous les champs obligatoires sont remplis, ou contactez-nous : contact@studyalready.com.';
          }
          showStatus(statusEl, escapeHtml(msg), 'text-red-600');
          return;
        }
        showStatus(statusEl, escapeHtml(opts.successMessage || 'Merci ! Votre message est bien arrivé.'), 'text-green-600');
        if (opts.resetOnSuccess !== false) form.reset();
      }).catch(function () {
        showStatus(statusEl, fallbackMessage(), 'text-amber-700');
      }).then(function () {
        submitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    return true;
  }

  window.StudyAlreadyForms = { bind: bind, readFormData: readFormData };
})();
