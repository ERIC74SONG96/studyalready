/**
 * Adhésion « Rejoindre le réseau » : création de compte Supabase (Mon espace) + enregistrement form_submissions.
 * Remplace l’ancien envoi anonyme seul (StudyAlreadyForms sur ce formulaire est désactivé dans main.js).
 */
(function () {
  'use strict';

  var PWD_KEYS = { password: 1, password_confirm: 1, website: 1 };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readPayload(form) {
    var fd = new FormData(form);
    var payload = {};
    var multi = {};
    fd.forEach(function (value, key) {
      if (PWD_KEYS[key]) return;
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

  function parcoursToUserMeta(parcours, paysResidence) {
    if (parcours === 'deja_belgique_etudiant') {
      return { signup_location: 'belgique', signup_be_mode: 'etudiant', espace_persona: 'belgique_etudiant' };
    }
    if (parcours === 'deja_belgique_travailleur') {
      return { signup_location: 'belgique', signup_be_mode: 'pro', espace_persona: 'travailleur' };
    }
    if (parcours === 'autre') {
      return { signup_location: 'hors', signup_be_mode: null, espace_persona: 'visiteur' };
    }
    if (parcours === 'hors_belgique' || parcours === 'au_cameroun') {
      var pays = String(paysResidence || '').trim();
      if (pays === 'CM') {
        return { signup_location: 'hors', signup_be_mode: null, espace_persona: 'cameroun', signup_country: 'CM' };
      }
      return {
        signup_location: 'hors',
        signup_be_mode: null,
        espace_persona: 'visiteur',
        signup_country: pays || null,
      };
    }
    return { signup_location: 'hors', signup_be_mode: null, espace_persona: 'visiteur' };
  }

  function showStatus(el, html, cls) {
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.remove('text-red-600', 'text-green-600', 'text-amber-700', 'text-slate-600');
    el.classList.add(cls || 'text-slate-600');
    el.innerHTML = html;
  }

  function initSb() {
    var c = window.STUDYALREADY_CONFIG;
    var root = window.supabase;
    if (!c || !root) return null;
    var url = String(c.SUPABASE_URL || '').trim();
    var key = String(c.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key || url.indexOf('REMPLACER') !== -1 || key.indexOf('REMPLACER') !== -1) return null;
    var createClientFn = typeof root.createClient === 'function' ? root.createClient.bind(root) : root;
    try {
      var sb = createClientFn(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      window.studyalreadySb = sb;
      return sb;
    } catch (e) {
      console.warn('StudyAlready rejoindre auth:', e);
      return null;
    }
  }

  function togglePwdRow(sb, wrap) {
    if (!wrap) return;
    sb.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      if (u) {
        wrap.classList.add('hidden');
        var hint = document.getElementById('rejoindreLoggedInHint');
        if (hint) hint.classList.remove('hidden');
      } else {
        wrap.classList.remove('hidden');
        var h2 = document.getElementById('rejoindreLoggedInHint');
        if (h2) h2.classList.add('hidden');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sb = initSb();
    var form = document.getElementById('rejoindreReseauForm');
    var statusEl = document.getElementById('rejoindreReseauStatus');
    var pwdWrap = document.getElementById('rejoindrePasswordRow');
    if (!form || !sb) return;

    togglePwdRow(sb, pwdWrap);

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) {
        showStatus(statusEl, 'Envoi ignoré.', 'text-amber-700');
        return;
      }

      var payload = readPayload(form);
      var contact = pickContact(payload);
      if (!contact.email || !contact.nom) {
        showStatus(statusEl, 'Nom et e-mail sont obligatoires.', 'text-red-600');
        return;
      }

      var parcoursCheck = String(payload.parcours || '');
      if (parcoursCheck === 'hors_belgique' || parcoursCheck === 'au_cameroun') {
        if (!String(payload.pays_residence || '').trim()) {
          showStatus(statusEl, 'Indiquez votre pays de résidence (hors Belgique).', 'text-red-600');
          return;
        }
      }

      var pwd = (form.querySelector('input[name="password"]') && form.querySelector('input[name="password"]').value) || '';
      var pwd2 =
        (form.querySelector('input[name="password_confirm"]') && form.querySelector('input[name="password_confirm"]').value) ||
        '';

      sb.auth.getSession().then(async function (sessRes) {
        var existingUser = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user;

        if (!existingUser) {
          if (pwd.length < 8) {
            showStatus(statusEl, 'Mot de passe d’au moins 8 caractères (compte Mon espace).', 'text-red-600');
            return;
          }
          if (pwd !== pwd2) {
            showStatus(statusEl, 'Les deux mots de passe ne correspondent pas.', 'text-red-600');
            return;
          }
        }

        var row = {
          form_type: 'rejoindre-reseau',
          status: 'new',
          nom: contact.nom,
          email: contact.email,
          whatsapp: contact.whatsapp,
          subject: contact.nom ? 'Réseau — ' + contact.nom : 'Réseau StudyAlready',
          payload: payload,
          origin_url: typeof window.location !== 'undefined' ? window.location.href : null,
          user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 280) : null,
        };

        showStatus(statusEl, 'Envoi en cours…', 'text-slate-600');

        try {
          if (!existingUser) {
            var parcours = String(payload.parcours || '');
            var meta = parcoursToUserMeta(parcours, payload.pays_residence);
            var origin = (window.location && window.location.origin) || 'https://www.studyalready.com';
            var redirectUrl = origin + '/espace-etudiant/';
            var sign = await sb.auth.signUp({
              email: String(contact.email).trim(),
              password: pwd,
              options: {
                data: Object.assign({ full_name: String(contact.nom).trim() }, meta),
                emailRedirectTo: redirectUrl,
              },
            });
            if (sign.error) {
              var em = sign.error.message || '';
              if (em.indexOf('already registered') !== -1 || em.indexOf('User already registered') !== -1) {
                showStatus(
                  statusEl,
                  'Un compte existe déjà avec cet e-mail. <a href="espace-etudiant/" class="underline font-semibold text-brand-dark">Connectez-vous sur Mon espace</a>, puis soumettez à nouveau ce formulaire (l’adhésion sera liée à votre compte).',
                  'text-amber-700'
                );
                return;
              }
              showStatus(statusEl, escapeHtml(em), 'text-red-600');
              return;
            }
            var user = sign.data && sign.data.user;
            if (user && user.id) row.user_id = user.id;
            try {
              var mod = await import('/assets/js/user-site-context.mjs');
              if (mod && typeof mod.syncUserSiteContextRow === 'function' && user) {
                await mod.syncUserSiteContextRow(sb, user);
              }
            } catch (eSync) {}

            var ins = await sb.from('form_submissions').insert(row);
            if (ins.error) {
              showStatus(
                statusEl,
                'Compte créé, mais l’enregistrement de l’adhésion a échoué : ' +
                  escapeHtml(ins.error.message || '') +
                  '. Écrivez-nous sur WhatsApp avec votre e-mail.',
                'text-amber-700'
              );
              return;
            }

            if (sign.data && sign.data.session) {
              try {
                sessionStorage.setItem('sa_espace_vue', 'communaute');
              } catch (eS) {}
              showStatus(statusEl, 'Compte créé — redirection vers votre espace…', 'text-green-600');
              window.location.href = origin + '/espace-etudiant/dashboard.html';
              return;
            }
            showStatus(
              statusEl,
              '<strong>Compte créé.</strong> Consultez votre boîte e-mail pour confirmer l’adresse, puis connectez-vous sur <a href="espace-etudiant/" class="underline font-semibold">Mon espace</a>. Votre adhésion au réseau est enregistrée : après confirmation, vous pourrez consulter l’annuaire des membres.',
              'text-green-600'
            );
            form.reset();
            return;
          }

          /* Déjà connecté : enregistrement seul */
          row.user_id = existingUser.id;
          var ins2 = await sb.from('form_submissions').insert(row);
          if (ins2.error) {
            showStatus(statusEl, escapeHtml(ins2.error.message || 'Erreur d’envoi'), 'text-red-600');
            return;
          }
          showStatus(
            statusEl,
            'Merci ! Votre adhésion est enregistrée sur votre compte. Vous pouvez consulter l’<a href="annuaire.html" class="underline font-semibold">annuaire</a> des membres.',
            'text-green-600'
          );
          form.reset();
        } catch (err) {
          showStatus(statusEl, escapeHtml((err && err.message) || 'Erreur inattendue.'), 'text-red-600');
        }
      });
    });
  });
})();
