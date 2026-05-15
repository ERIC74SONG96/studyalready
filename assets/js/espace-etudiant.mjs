/**
 * Espace personnel StudyAlready — authentification Supabase (client uniquement).
 * Charger après assets/js/config.js. data-espace-page="login" | "dashboard"
 */
import { createClient } from '/assets/js/vendor/supabase-js-2.49.4.mjs';
import { syncUserSiteContextRow } from './user-site-context.mjs';

function getConfig() {
  return typeof window !== 'undefined' && window.STUDYALREADY_CONFIG ? window.STUDYALREADY_CONFIG : {};
}

function getSupabase() {
  var c = getConfig();
  var url = c.SUPABASE_URL;
  var key = c.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (String(url).indexOf('REMPLACER') !== -1 || String(key).indexOf('REMPLACER') !== -1) return null;
  return createClient(String(url).trim(), String(key).trim());
}

/** Supprime les clés localStorage du projet (préfixe sb-<ref>-). */
function clearSupabaseAuthStorageForUrl(supabaseUrl) {
  if (!supabaseUrl || typeof localStorage === 'undefined') return;
  try {
    var host = String(supabaseUrl).replace(/^https?:\/\//i, '').split('/')[0];
    var ref = host.split('.')[0];
    if (!ref) return;
    var prefix = 'sb-' + ref + '-';
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) localStorage.removeItem(k);
    }
  } catch (e) {}
}

/** Supprime toutes les clés GoTrue connues (filet si URL projet ≠ parsing hostname). */
function clearAllGoTrueAuthLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (!k || k.indexOf('sb-') !== 0) continue;
      if (k.indexOf('auth-token') !== -1 || k.indexOf('auth-code') !== -1) localStorage.removeItem(k);
    }
  } catch (e) {}
}

/* Après navigation post-déconnexion : purge synchrone AVANT createClient(),
   sinon la session peut être relue depuis localStorage encore présent. */
(function espaceEarlyPostLogoutCleanup() {
  if (typeof window === 'undefined') return;
  var path = window.location.pathname || '';
  if (path.indexOf('espace-etudiant') === -1) return;
  var qs = window.location.search || '';
  if (qs.indexOf('logout=') === -1) return;
  clearSupabaseAuthStorageForUrl(getConfig().SUPABASE_URL);
  clearAllGoTrueAuthLocalStorage();
  try {
    window.history.replaceState(null, '', path + (window.location.hash || ''));
  } catch (eR) {}
})();

/**
 * Après une session valide (connexion sur Mon espace, lien email, etc.) :
 * administrateurs → /admin ; sinon → accueil du site (l’utilisateur ouvre son tableau
 * de bord via « Mon profil » dans la navigation).
 */
function redirectAfterAuth(sb) {
  if (!sb) return Promise.resolve();
  if (typeof window !== 'undefined' && window.__saEspaceAuthRedirect) {
    return Promise.resolve();
  }
  if (typeof window !== 'undefined') window.__saEspaceAuthRedirect = true;
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch (e) {}
  var home = '/';
  try {
    if (window.location && window.location.origin) {
      home = window.location.origin + '/';
    }
  } catch (e0) {}
  return sb.auth
    .getSession()
    .then(function (sessRes) {
      var u = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user;
      if (u) return syncUserSiteContextRow(sb, u);
      return Promise.resolve();
    })
    .then(function () {
      return sb.rpc('is_admin');
    })
    .then(function (a) {
      if (!a.error && a.data === true) {
        window.location.replace('/admin');
      } else {
        window.location.replace(home);
      }
    })
    .catch(function () {
      window.location.replace(home);
    });
}

function showBanner(el, type, text) {
  if (!el) return;
  el.classList.remove('hidden', 'bg-amber-50', 'border-amber-200', 'text-amber-900', 'bg-red-50', 'border-red-200', 'text-red-800', 'bg-green-50', 'border-green-200', 'text-green-800');
  el.textContent = text;
  el.classList.remove('hidden');
  if (type === 'warn') {
    el.classList.add('bg-amber-50', 'border', 'border-amber-200', 'text-amber-900');
  } else if (type === 'err') {
    el.classList.add('bg-red-50', 'border', 'border-red-200', 'text-red-800');
  } else {
    el.classList.add('bg-green-50', 'border', 'border-green-200', 'text-green-800');
  }
}

function page() {
  return document.body.getAttribute('data-espace-page') || '';
}

var sb = getSupabase();
if (typeof window !== 'undefined') {
  window.__saEspaceSb = sb;
}
var pageId = page();

if (pageId === 'login') {
  var PERSONA_KEY = 'sa_espace_persona';
  var PERSONA_VALUES = ['cameroun', 'belgique_etudiant', 'travailleur', 'visiteur'];

  function getSelectedPersona() {
    try {
      var el = document.querySelector('input[name="espace_persona"]:checked');
      if (el && el.value && PERSONA_VALUES.indexOf(el.value) !== -1) return el.value;
    } catch (e) {}
    return 'cameroun';
  }

  function persistPersonaChoice() {
    try {
      sessionStorage.setItem(PERSONA_KEY, getSelectedPersona());
    } catch (e) {}
  }

  function syncPersonaRadiosFromStorage() {
    try {
      var v = sessionStorage.getItem(PERSONA_KEY);
      if (!v || PERSONA_VALUES.indexOf(v) === -1) return;
      var inp = document.querySelector('input[name="espace_persona"][value="' + v + '"]');
      if (inp) inp.checked = true;
    } catch (e) {}
  }

  function wirePersonaRadios() {
    try {
      var nodes = document.querySelectorAll('input[name="espace_persona"]');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].addEventListener('change', persistPersonaChoice);
      }
    } catch (e) {}
  }

  var banner = document.getElementById('espaceBanner');
  var err = document.getElementById('espaceError');
  var btnLogin = document.getElementById('btnLogin');
  var btnSignupNext = document.getElementById('btnSignupNext');
  var btnSignupSubmit = document.getElementById('btnSignupSubmit');
  var btnSignupBack = document.getElementById('btnSignupBack');
  var btnLocBelgique = document.getElementById('btnLocBelgique');
  var btnLocHors = document.getElementById('btnLocHors');
  var tabLogin = document.getElementById('tabLogin');
  var tabSignup = document.getElementById('tabSignup');
  var panelLogin = document.getElementById('panelLogin');
  var panelSignup = document.getElementById('panelSignup');
  var loader = document.getElementById('sessionLoader');

  var personaBlockOuter = document.getElementById('personaBlockOuter');

  function applyPersonaRadioValue(val) {
    if (!val || PERSONA_VALUES.indexOf(val) === -1) return;
    try {
      var inp = document.querySelector('input[name="espace_persona"][value="' + val + '"]');
      if (inp) inp.checked = true;
      sessionStorage.setItem(PERSONA_KEY, val);
    } catch (eA) {}
  }

  var signupLocSelection = null;

  function resetSignupWizard() {
    signupLocSelection = null;
    var s1 = document.getElementById('signupStep1');
    var s2 = document.getElementById('signupStep2');
    if (s1) s1.classList.remove('hidden');
    if (s2) s2.classList.add('hidden');
    var refine = document.getElementById('signupBelgiqueRefine');
    if (refine) refine.classList.add('hidden');
    var cards = document.querySelectorAll('.signup-loc-card');
    for (var c = 0; c < cards.length; c++) {
      cards[c].classList.remove('ring-2', 'ring-inset', 'ring-brand-gold', 'bg-amber-50', 'bg-white');
      cards[c].classList.add('bg-slate-50');
    }
    var pv = document.getElementById('signupUiPreview');
    if (pv) {
      pv.innerHTML =
        '<p class="text-slate-500">Choisissez une option à gauche pour voir comment votre tableau de bord sera organisé.</p>';
    }
    var sub = document.getElementById('btnSignupSubmit');
    if (sub) {
      sub.disabled = true;
      sub.setAttribute('aria-disabled', 'true');
    }
    var hint = document.getElementById('signupSubmitHint');
    if (hint) {
      hint.classList.remove('hidden', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-900');
      hint.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-800');
      hint.innerHTML =
        'Sélectionnez <strong>Belgique</strong> ou <strong>hors Belgique</strong> à gauche pour activer la création du compte.';
    }
    try {
      var rEt = document.querySelector('input[name="signup_be_mode"][value="etudiant"]');
      if (rEt) rEt.checked = true;
    } catch (eR) {}
  }

  function getSignupBelgiqueMode() {
    try {
      var el = document.querySelector('input[name="signup_be_mode"]:checked');
      if (el && el.value === 'pro') return 'pro';
    } catch (eM) {}
    return 'etudiant';
  }

  function resolveSignupPersona() {
    if (signupLocSelection === 'hors') {
      try {
        var elH = document.querySelector('input[name="espace_persona"]:checked');
        if (elH && elH.value === 'visiteur') return 'visiteur';
      } catch (eH) {}
      return 'cameroun';
    }
    if (signupLocSelection === 'belgique') {
      return getSignupBelgiqueMode() === 'pro' ? 'travailleur' : 'belgique_etudiant';
    }
    return getSelectedPersona();
  }

  function renderSignupPreview() {
    var pv = document.getElementById('signupUiPreview');
    if (!pv) return;
    if (signupLocSelection === 'hors') {
      pv.innerHTML =
        '<p class="text-xs font-semibold text-brand-gold uppercase tracking-wide">Aperçu · hors Belgique</p>' +
        '<ul class="mt-2 list-disc pl-5 space-y-1.5 text-slate-700">' +
        '<li>Ouverture sur l’onglet <strong>Mon dossier</strong> : étapes équivalence FWB, visa, pièces.</li>' +
        '<li>Messages et documents centralisés avec StudyAlready.</li>' +
        '<li>Onglet <strong>Services</strong> : blog, formulaires, guides et liens utiles.</li>' +
        '</ul>';
      return;
    }
    if (signupLocSelection === 'belgique') {
      var pro = getSignupBelgiqueMode() === 'pro';
      if (pro) {
        pv.innerHTML =
          '<p class="text-xs font-semibold text-brand-gold uppercase tracking-wide">Aperçu · Belgique (pro)</p>' +
          '<ul class="mt-2 list-disc pl-5 space-y-1.5 text-slate-700">' +
          '<li>Ouverture sur <strong>Services</strong> : guides pratiques, blog, <strong>réseau</strong> / communauté, liens utiles, contact.</li>' +
          '<li>Suivi « dossier » si vous avez un accompagnement avec nous.</li>' +
          '<li>Historique de vos <strong>demandes</strong> via le site.</li>' +
          '</ul>';
      } else {
        pv.innerHTML =
          '<p class="text-xs font-semibold text-brand-gold uppercase tracking-wide">Aperçu · Belgique (études)</p>' +
          '<ul class="mt-2 list-disc pl-5 space-y-1.5 text-slate-700">' +
          '<li>Ouverture sur <strong>Services</strong> : job étudiant, blog, communauté, voyage.</li>' +
          '<li>Onglet <strong>Mes demandes</strong> pour vos formulaires.</li>' +
          '<li><strong>Mon dossier</strong> détaillé surtout si vous êtes accompagné(e) sur une procédure.</li>' +
          '</ul>';
      }
    }
  }

  function setSignupLocation(loc) {
    signupLocSelection = loc;
    var cards = document.querySelectorAll('.signup-loc-card');
    for (var c = 0; c < cards.length; c++) {
      cards[c].classList.remove('ring-2', 'ring-inset', 'ring-brand-gold', 'bg-amber-50', 'bg-white');
      cards[c].classList.add('bg-slate-50');
    }
    var active = loc === 'belgique' ? btnLocBelgique : btnLocHors;
    if (active) {
      active.classList.remove('bg-slate-50');
      active.classList.add('bg-amber-50', 'ring-2', 'ring-inset', 'ring-brand-gold');
    }
    var refine = document.getElementById('signupBelgiqueRefine');
    if (refine) {
      if (loc === 'belgique') refine.classList.remove('hidden');
      else refine.classList.add('hidden');
    }
    applyPersonaRadioValue(resolveSignupPersona());
    renderSignupPreview();
    var sub = document.getElementById('btnSignupSubmit');
    if (sub) {
      sub.disabled = false;
      sub.removeAttribute('aria-disabled');
    }
    var hint = document.getElementById('signupSubmitHint');
    if (hint) {
      hint.classList.remove('hidden', 'bg-amber-50', 'border-amber-200', 'text-amber-800');
      hint.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-900');
      hint.innerHTML =
        'Vous pouvez maintenant cliquer sur <strong>Créer mon compte</strong>.';
    }
  }

  function isRecoveryHash(h) {
    h = h || (typeof window !== 'undefined' ? window.location.hash : '') || '';
    return h.indexOf('type=recovery') !== -1 || h.indexOf('type%3Drecovery') !== -1;
  }

  function getEspacePasswordResetRedirectTo() {
    try {
      var u = new URL(window.location.href);
      u.hash = '';
      u.search = '';
      return u.href;
    } catch (eU) {
      var o = (window.location && window.location.origin) || 'https://www.studyalready.com';
      return o + '/espace-etudiant/';
    }
  }

  function showPasswordRecoveryUI() {
    try {
      window.__saEspacePasswordRecovery = true;
    } catch (eF) {}
    var tabBar = document.getElementById('espaceTabBar');
    if (tabBar) tabBar.classList.add('hidden');
    if (panelLogin) panelLogin.classList.add('hidden');
    if (panelSignup) panelSignup.classList.add('hidden');
    if (personaBlockOuter) personaBlockOuter.classList.add('hidden');
    var pr = document.getElementById('panelRecovery');
    if (pr) pr.classList.remove('hidden');
    hideLoader();
  }

  function switchTab(which) {
    var prRec = document.getElementById('panelRecovery');
    var tbBar = document.getElementById('espaceTabBar');
    if (prRec) prRec.classList.add('hidden');
    if (tbBar) tbBar.classList.remove('hidden');
    try {
      window.__saEspacePasswordRecovery = false;
    } catch (eRec) {}
    var fbox = document.getElementById('forgotPasswordBox');
    if (fbox) fbox.classList.add('hidden');
    if (which === 'login') {
      tabLogin.classList.add('bg-brand-dark', 'text-white');
      tabLogin.classList.remove('bg-slate-100', 'text-slate-700');
      tabSignup.classList.remove('bg-brand-dark', 'text-white');
      tabSignup.classList.add('bg-slate-100', 'text-slate-700');
      panelLogin.classList.remove('hidden');
      panelSignup.classList.add('hidden');
      if (personaBlockOuter) personaBlockOuter.classList.add('hidden');
      resetSignupWizard();
    } else {
      tabSignup.classList.add('bg-brand-dark', 'text-white');
      tabSignup.classList.remove('bg-slate-100', 'text-slate-700');
      tabLogin.classList.remove('bg-brand-dark', 'text-white');
      tabLogin.classList.add('bg-slate-100', 'text-slate-700');
      panelSignup.classList.remove('hidden');
      panelLogin.classList.add('hidden');
      if (personaBlockOuter) personaBlockOuter.classList.remove('hidden');
      resetSignupWizard();
      var pepHide = document.getElementById('pendingEmailConfirmPanel');
      if (pepHide) pepHide.classList.add('hidden');
    }
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
  }

  function applyEspaceUrlMode() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('vue') === 'communaute') {
        sessionStorage.setItem('sa_espace_vue', 'communaute');
      }
      if (sessionStorage.getItem('sa_espace_vue') === 'communaute') {
        var navM = document.getElementById('espaceNavMarketing');
        var navC = document.getElementById('espaceNavCommunaute');
        if (navM) navM.classList.add('hidden');
        if (navC) navC.classList.remove('hidden');
        var sd = document.getElementById('espaceSubtitleDefault');
        var sc = document.getElementById('espaceSubtitleCommunaute');
        if (sd) sd.classList.add('hidden');
        if (sc) sc.classList.remove('hidden');
        var fn = document.getElementById('espaceFooterCommunauteNote');
        if (fn) fn.classList.remove('hidden');
      }
      var openSignup = p.get('tab') === 'inscription' || p.get('inscription') === '1' || p.get('signup') === '1';
      var statsEl = document.getElementById('espaceCommunityStats');
      if (statsEl && (openSignup || sessionStorage.getItem('sa_espace_vue') === 'communaute')) {
        statsEl.classList.remove('hidden');
      }
      var skipSignupForRecovery = false;
      try {
        skipSignupForRecovery = window.__saEspaceRecoveryFlow === true;
      } catch (eSf) {}
      if (openSignup && !skipSignupForRecovery) {
        switchTab('signup');
      }
      var pm = p.get('persona') || p.get('profil');
      if (pm && PERSONA_VALUES.indexOf(String(pm)) !== -1) {
        try {
          sessionStorage.setItem(PERSONA_KEY, String(pm));
        } catch (eP) {}
      }
      var h = window.location.hash || '';
      var hasAuthHash =
        h.indexOf('access_token=') !== -1 ||
        h.indexOf('type=signup') !== -1 ||
        h.indexOf('type=recovery') !== -1 ||
        h.indexOf('type%3Drecovery') !== -1 ||
        h.indexOf('error=') !== -1;
      if (!hasAuthHash && window.location.search) {
        try {
          window.history.replaceState(null, '', window.location.pathname + h);
        } catch (e2) {}
      }
    } catch (e) {}
  }

  function hideLoader() {
    if (typeof window !== 'undefined' && window.__saEspaceAuthRedirect) return;
    if (!loader || !loader.parentNode) return;
    loader.parentNode.removeChild(loader);
    try {
      requestAnimationFrame(function () {
        applyEspaceUrlMode();
        syncPersonaRadiosFromStorage();
        wirePersonaRadios();
      });
    } catch (e3) {
      applyEspaceUrlMode();
      syncPersonaRadiosFromStorage();
      wirePersonaRadios();
    }
  }

  if (!sb) {
    hideLoader();
    showBanner(banner, 'warn', 'Connexion à la base de données impossible pour le moment (votre réseau bloque peut-être Supabase). Patientez quelques secondes puis actualisez la page, ou essayez une autre connexion internet. Si le problème persiste, écrivez-nous sur WhatsApp.');
    if (btnLogin) btnLogin.disabled = true;
    if (btnSignupNext) btnSignupNext.disabled = true;
    if (btnSignupSubmit) btnSignupSubmit.disabled = true;
    var btnSendResetNoSb = document.getElementById('btnSendReset');
    if (btnSendResetNoSb) btnSendResetNoSb.disabled = true;
    var btnRecoverySaveNoSb = document.getElementById('btnRecoverySave');
    if (btnRecoverySaveNoSb) btnRecoverySaveNoSb.disabled = true;
  } else {
    if (banner) banner.classList.add('hidden');

    /* Si l'URL contient un token de confirmation (#access_token=...),
       Supabase JS le parse automatiquement et crée la session.
       On affiche un retour rassurant en attendant la redirection. */
    var hash = window.location.hash || '';
    var recoveryHashAtLoad = isRecoveryHash(hash);
    try {
      if (recoveryHashAtLoad) window.__saEspaceRecoveryFlow = true;
    } catch (eRf) {}
    if (recoveryHashAtLoad && hash.indexOf('access_token=') !== -1) {
      showBanner(banner, 'ok', 'Lien de réinitialisation accepté. Indiquez votre nouveau mot de passe ci-dessous.');
    } else if (hash.indexOf('access_token=') !== -1 || hash.indexOf('type=signup') !== -1) {
      showBanner(banner, 'ok', 'Email confirmé ! Connexion en cours…');
    } else if (hash.indexOf('error=') !== -1 || hash.indexOf('error_description=') !== -1) {
      showBanner(banner, 'warn',
        'Le lien de confirmation a expiré ou est invalide. Reconnectez-vous avec votre email et mot de passe, ou recréez un compte.');
      hideLoader();
    }

    var authRevealTimer = null;
    function clearAuthRevealTimer() {
      if (authRevealTimer) {
        clearTimeout(authRevealTimer);
        authRevealTimer = null;
      }
    }

    /* Un seul flux d’amorçage : INITIAL_SESSION (Supabase v2). Évite la course
       getSession + onAuthStateChange + timer qui retiraient le loader trop tôt. */
    var authBootstrapDone = false;
    var hashAuthPending =
      hash.indexOf('access_token=') !== -1 || hash.indexOf('type=signup') !== -1;
    var fallbackMs = hashAuthPending ? 9000 : 2800;

    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        clearAuthRevealTimer();
        authBootstrapDone = true;
        showPasswordRecoveryUI();
        return;
      }
      if (event === 'INITIAL_SESSION') {
        if (authBootstrapDone) return;
        /* Hash OAuth : la session peut arriver un tick après INITIAL null. */
        if (hashAuthPending && !session) return;
        authBootstrapDone = true;
        clearAuthRevealTimer();
        if (session && recoveryHashAtLoad) {
          showPasswordRecoveryUI();
          return;
        }
        if (session) redirectAfterAuth(sb);
        else hideLoader();
        return;
      }
      if (
        session &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED')
      ) {
        clearAuthRevealTimer();
        if (hashAuthPending && !authBootstrapDone) {
          authBootstrapDone = true;
        }
        try {
          if (window.__saEspacePasswordRecovery) {
            if (event === 'USER_UPDATED') {
              try {
                window.__saEspacePasswordRecovery = false;
              } catch (ePu) {}
              redirectAfterAuth(sb);
            }
            return;
          }
        } catch (ePw) {}
        if (recoveryHashAtLoad) {
          authBootstrapDone = true;
          showPasswordRecoveryUI();
          return;
        }
        redirectAfterAuth(sb);
      }
    });

    authRevealTimer = setTimeout(function () {
      authRevealTimer = null;
      if (authBootstrapDone) return;
      authBootstrapDone = true;
      clearAuthRevealTimer();
      hideLoader();
    }, fallbackMs);
  }

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', function () { switchTab('login'); });
    tabSignup.addEventListener('click', function () { switchTab('signup'); });
  }

  if (btnLogin && sb) {
    btnLogin.addEventListener('click', async function () {
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      if (!email || !password) {
        showBanner(err, 'err', 'Renseignez votre email et votre mot de passe.');
        return;
      }
      btnLogin.disabled = true;
      var r = await sb.auth.signInWithPassword({ email: email, password: password });
      btnLogin.disabled = false;
      if (r.error) {
        var m = r.error.message || '';
        if (m.indexOf('Invalid login credentials') !== -1) m = 'Email ou mot de passe incorrect.';
        showBanner(err, 'err', m);
        return;
      }
      redirectAfterAuth(sb);
    });
  }

  var btnForgotToggle = document.getElementById('btnForgotToggle');
  var btnSendReset = document.getElementById('btnSendReset');
  var btnRecoverySave = document.getElementById('btnRecoverySave');

  if (btnForgotToggle) {
    btnForgotToggle.addEventListener('click', function () {
      var bx = document.getElementById('forgotPasswordBox');
      if (!bx) return;
      bx.classList.toggle('hidden');
    });
  }

  if (btnSendReset && sb) {
    btnSendReset.addEventListener('click', async function () {
      var emailEl = document.getElementById('loginEmail');
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      if (!email) {
        showBanner(err, 'err', 'Indiquez votre adresse e-mail pour recevoir le lien.');
        return;
      }
      btnSendReset.disabled = true;
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: getEspacePasswordResetRedirectTo() });
      btnSendReset.disabled = false;
      if (r.error) {
        var em = r.error.message || 'Envoi impossible pour le moment.';
        showBanner(err, 'err', em);
        return;
      }
      var fmsg = document.getElementById('forgotPasswordMsg');
      if (fmsg) {
        fmsg.textContent =
          'Si un compte existe pour cette adresse, un e-mail avec un lien vient d’être envoyé. Vérifiez aussi les indésirables.';
        fmsg.classList.remove('hidden');
      }
      showBanner(banner, 'ok', 'Si cette adresse correspond à un compte, consultez votre boîte mail (et le dossier spam).');
      if (err) {
        err.textContent = '';
        err.classList.add('hidden');
      }
    });
  }

  if (btnRecoverySave && sb) {
    btnRecoverySave.addEventListener('click', async function () {
      var el1 = document.getElementById('recoveryPassword');
      var el2 = document.getElementById('recoveryPassword2');
      var p1 = el1 ? String(el1.value || '') : '';
      var p2 = el2 ? String(el2.value || '') : '';
      if (p1.length < 8) {
        showBanner(err, 'err', 'Le mot de passe doit compter au moins 8 caractères.');
        return;
      }
      if (p1 !== p2) {
        showBanner(err, 'err', 'Les deux saisies ne correspondent pas.');
        return;
      }
      btnRecoverySave.disabled = true;
      var r = await sb.auth.updateUser({ password: p1 });
      btnRecoverySave.disabled = false;
      if (r.error) {
        showBanner(err, 'err', r.error.message || 'Mise à jour impossible.');
        return;
      }
      try {
        window.__saEspacePasswordRecovery = false;
      } catch (eRecDone) {}
      redirectAfterAuth(sb);
    });
  }

  if (btnSignupNext && sb) {
    btnSignupNext.addEventListener('click', function () {
      var email = document.getElementById('signupEmail').value.trim();
      var password = document.getElementById('signupPassword').value;
      var name = document.getElementById('signupName').value.trim();
      if (!email || !password || password.length < 8) {
        showBanner(err, 'err', 'Email obligatoire et mot de passe d\'au moins 8 caractères.');
        return;
      }
      var s1 = document.getElementById('signupStep1');
      var s2 = document.getElementById('signupStep2');
      if (s1) s1.classList.add('hidden');
      if (s2) s2.classList.remove('hidden');
      if (err) { err.textContent = ''; err.classList.add('hidden'); }
    });
  }

  if (btnSignupBack) {
    btnSignupBack.addEventListener('click', function () {
      resetSignupWizard();
      if (err) { err.textContent = ''; err.classList.add('hidden'); }
    });
  }

  if (btnLocBelgique) {
    btnLocBelgique.addEventListener('click', function () {
      setSignupLocation('belgique');
    });
  }
  if (btnLocHors) {
    btnLocHors.addEventListener('click', function () {
      setSignupLocation('hors');
    });
  }

  try {
    var beModes = document.querySelectorAll('input[name="signup_be_mode"]');
    for (var b = 0; b < beModes.length; b++) {
      beModes[b].addEventListener('change', function () {
        if (signupLocSelection === 'belgique') {
          applyPersonaRadioValue(resolveSignupPersona());
          renderSignupPreview();
        }
      });
    }
  } catch (eBe) {}

  if (btnSignupSubmit && sb) {
    btnSignupSubmit.addEventListener('click', async function () {
      if (!signupLocSelection) {
        showBanner(err, 'err', 'Indiquez si vous êtes en Belgique ou non pour voir l’aperçu, puis créez le compte.');
        return;
      }
      var email = document.getElementById('signupEmail').value.trim();
      var password = document.getElementById('signupPassword').value;
      var name = document.getElementById('signupName').value.trim();
      if (!email || !password || password.length < 8) {
        showBanner(err, 'err', 'Email obligatoire et mot de passe d\'au moins 8 caractères.');
        return;
      }
      var personaFinal = resolveSignupPersona();
      applyPersonaRadioValue(personaFinal);
      persistPersonaChoice();

      btnSignupSubmit.disabled = true;
      btnSignupSubmit.setAttribute('aria-disabled', 'true');
      /* Force l'URL de retour vers le vrai site en production.
         Évite le défaut Supabase qui pointe vers http://localhost:3000. */
      var origin = (window.location && window.location.origin) || 'https://www.studyalready.com';
      var redirectUrl = origin + '/espace-etudiant/dashboard';
      var r = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: name || '',
            espace_persona: personaFinal,
            signup_location: signupLocSelection,
            signup_be_mode: signupLocSelection === 'belgique' ? getSignupBelgiqueMode() : null,
          },
          emailRedirectTo: redirectUrl
        }
      });
      if (r.error) {
        var em = r.error.message || '';
        if (em.indexOf('already registered') !== -1 || em.indexOf('User already registered') !== -1) {
          em = 'Un compte existe déjà avec cet email. Utilisez l\'onglet Connexion.';
        }
        showBanner(err, 'err', em);
        btnSignupSubmit.disabled = false;
        btnSignupSubmit.removeAttribute('aria-disabled');
        return;
      }
      btnSignupSubmit.disabled = false;
      btnSignupSubmit.removeAttribute('aria-disabled');
      if (r.data.session) {
        redirectAfterAuth(sb);
        return;
      }
      if (err) {
        err.textContent = '';
        err.classList.add('hidden');
      }
      showBanner(
        banner,
        'ok',
        'Compte créé : confirmez votre e-mail (voir l’encart jaune sous « Connexion »).'
      );
      switchTab('login');
      var pep = document.getElementById('pendingEmailConfirmPanel');
      var addrEl = document.getElementById('pendingEmailConfirmAddress');
      var loginEmailInput = document.getElementById('loginEmail');
      if (addrEl) addrEl.textContent = email;
      if (pep) pep.classList.remove('hidden');
      if (loginEmailInput) {
        loginEmailInput.value = email;
        try {
          loginEmailInput.focus();
        } catch (eFoc) {}
      }
      try {
        if (pep && pep.scrollIntoView) pep.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (eScroll) {}
    });
  }
}

if (pageId === 'dashboard') {
  var commVue = sessionStorage.getItem('sa_espace_vue') === 'communaute';
  if (commVue) {
    var dashAccueil = document.getElementById('dashLinkAccueil');
    var dashNavCom = document.getElementById('dashNavCommunaute');
    if (dashAccueil) dashAccueil.classList.add('hidden');
    if (dashNavCom) dashNavCom.classList.remove('hidden');
    var dashTabSvc = document.getElementById('dashTabServices');
    if (dashTabSvc) dashTabSvc.classList.add('hidden');
    var dashPaneSvc = document.getElementById('paneServices');
    if (dashPaneSvc) dashPaneSvc.classList.add('hidden');
    var dashComNote = document.getElementById('dashCommunauteNote');
    if (dashComNote) dashComNote.classList.remove('hidden');
  }

  var dashBanner = document.getElementById('espaceBanner');
  var dashErr = document.getElementById('espaceError');
  var btnLogout = document.getElementById('btnLogout');
  var nameEl = document.getElementById('dashName');
  var emailEl = document.getElementById('dashEmail');

  if (!sb) {
    if (dashBanner) {
      showBanner(dashBanner, 'warn', 'Connexion à la base de données impossible pour le moment. Patientez puis actualisez la page, ou réessayez sur une autre connexion internet.');
    }
    if (nameEl) nameEl.textContent = '—';
    if (emailEl) emailEl.textContent = '';
    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        window.location.href = '/espace-etudiant/';
      });
    }
  } else {
    sb.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (!s) {
        window.location.href = '/espace-etudiant/';
        return;
      }
      var u = s.user;
      var um = u.user_metadata || {};
      var persona = um.espace_persona;
      if (!persona || ['cameroun', 'belgique_etudiant', 'travailleur', 'visiteur'].indexOf(persona) === -1) {
        persona = null;
        try {
          var ps = sessionStorage.getItem('sa_espace_persona');
          if (ps && ['cameroun', 'belgique_etudiant', 'travailleur', 'visiteur'].indexOf(ps) !== -1) {
            persona = ps;
          }
        } catch (ePs) {}
        if (!persona) persona = 'cameroun';
      }
      var meta = um.full_name || '';
      var display = meta.trim();
      if (!display) {
        if (persona === 'visiteur') display = 'Invité(e)';
        else display = 'Membre';
      }
      if (nameEl) nameEl.textContent = display;
      if (emailEl) emailEl.textContent = u.email || '';
    });
  }

  if (btnLogout && sb) {
    btnLogout.addEventListener('click', function () {
      if (btnLogout.disabled) return;
      btnLogout.disabled = true;
      var loc = '/espace-etudiant/?logout=' + String(Date.now());
      function go() {
        try {
          if (typeof window !== 'undefined') window.__saEspaceAuthRedirect = false;
        } catch (e0) {}
        try {
          window.location.replace(loc);
        } catch (e1) {
          window.location.href = loc;
        }
      }
      Promise.resolve()
        .then(function () {
          return sb.auth.signOut({ scope: 'local' });
        })
        .catch(function () {})
        .then(function () {
          if (typeof window !== 'undefined' && window.studyalreadySb && window.studyalreadySb.auth) {
            return window.studyalreadySb.auth.signOut({ scope: 'local' }).catch(function () {});
          }
        })
        .then(function () {
          clearSupabaseAuthStorageForUrl(getConfig().SUPABASE_URL);
          clearAllGoTrueAuthLocalStorage();
          try {
            sb.auth.signOut({ scope: 'global' });
          } catch (eG) {}
          go();
        });
    });
  }
}
