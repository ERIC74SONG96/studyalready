/**
 * Espace étudiant StudyAlready — authentification Supabase (client uniquement).
 * Charger après assets/js/config.js. data-espace-page="login" | "dashboard"
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

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

/**
 * Après une session valide : si l'utilisateur est dans public.admins,
 * redirige vers le dashboard admin ; sinon vers l'espace étudiant.
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
  return sb.rpc('is_admin').then(function (a) {
    if (!a.error && a.data === true) {
      window.location.replace('/admin.html');
    } else {
      window.location.replace('/espace-etudiant/dashboard.html');
    }
  }).catch(function () {
    window.location.replace('/espace-etudiant/dashboard.html');
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
var pageId = page();

if (pageId === 'login') {
  var banner = document.getElementById('espaceBanner');
  var err = document.getElementById('espaceError');
  var btnLogin = document.getElementById('btnLogin');
  var btnSignup = document.getElementById('btnSignup');
  var tabLogin = document.getElementById('tabLogin');
  var tabSignup = document.getElementById('tabSignup');
  var panelLogin = document.getElementById('panelLogin');
  var panelSignup = document.getElementById('panelSignup');
  var loader = document.getElementById('sessionLoader');

  function switchTab(which) {
    if (which === 'login') {
      tabLogin.classList.add('bg-brand-dark', 'text-white');
      tabLogin.classList.remove('bg-slate-100', 'text-slate-700');
      tabSignup.classList.remove('bg-brand-dark', 'text-white');
      tabSignup.classList.add('bg-slate-100', 'text-slate-700');
      panelLogin.classList.remove('hidden');
      panelSignup.classList.add('hidden');
    } else {
      tabSignup.classList.add('bg-brand-dark', 'text-white');
      tabSignup.classList.remove('bg-slate-100', 'text-slate-700');
      tabLogin.classList.remove('bg-brand-dark', 'text-white');
      tabLogin.classList.add('bg-slate-100', 'text-slate-700');
      panelSignup.classList.remove('hidden');
      panelLogin.classList.add('hidden');
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
      if (openSignup) {
        switchTab('signup');
      }
      var h = window.location.hash || '';
      var hasAuthHash = h.indexOf('access_token=') !== -1 || h.indexOf('type=signup') !== -1 || h.indexOf('error=') !== -1;
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
      });
    } catch (e3) {
      applyEspaceUrlMode();
    }
  }

  if (!sb) {
    hideLoader();
    showBanner(banner, 'warn', 'Connexion à la base de données impossible pour le moment (votre réseau bloque peut-être Supabase). Forcez le rechargement avec Ctrl + Shift + R, ou essayez en navigation privée / sur une autre connexion. Si le problème persiste, écrivez-nous sur WhatsApp.');
    if (btnLogin) btnLogin.disabled = true;
    if (btnSignup) btnSignup.disabled = true;
  } else {
    if (banner) banner.classList.add('hidden');

    /* Si l'URL contient un token de confirmation (#access_token=...),
       Supabase JS le parse automatiquement et crée la session.
       On affiche un retour rassurant en attendant la redirection. */
    var hash = window.location.hash || '';
    if (hash.indexOf('access_token=') !== -1 || hash.indexOf('type=signup') !== -1) {
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
      if (event === 'INITIAL_SESSION') {
        if (authBootstrapDone) return;
        /* Hash OAuth : la session peut arriver un tick après INITIAL null. */
        if (hashAuthPending && !session) return;
        authBootstrapDone = true;
        clearAuthRevealTimer();
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

  if (btnSignup && sb) {
    btnSignup.addEventListener('click', async function () {
      var email = document.getElementById('signupEmail').value.trim();
      var password = document.getElementById('signupPassword').value;
      var name = document.getElementById('signupName').value.trim();
      if (!email || !password || password.length < 8) {
        showBanner(err, 'err', 'Email obligatoire et mot de passe d\'au moins 8 caractères.');
        return;
      }
      btnSignup.disabled = true;
      /* Force l'URL de retour vers le vrai site en production.
         Évite le défaut Supabase qui pointe vers http://localhost:3000. */
      var origin = (window.location && window.location.origin) || 'https://www.studyalready.com';
      var redirectUrl = origin + '/espace-etudiant/dashboard.html';
      var r = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: name || '' },
          emailRedirectTo: redirectUrl
        }
      });
      btnSignup.disabled = false;
      if (r.error) {
        var em = r.error.message || '';
        if (em.indexOf('already registered') !== -1 || em.indexOf('User already registered') !== -1) {
          em = 'Un compte existe déjà avec cet email. Utilisez l\'onglet Connexion.';
        }
        showBanner(err, 'err', em);
        return;
      }
      if (r.data.session) {
        redirectAfterAuth(sb);
        return;
      }
      showBanner(err, 'warn',
        'Compte créé ! Ouvrez l\'email de confirmation que nous venons de vous envoyer (vérifiez le dossier spam). ' +
        'Le lien vous ramènera ici, connecté. Si vous arrivez sur une page d\'erreur, dites-le à l\'admin : la "Site URL" dans Supabase doit pointer vers ' + origin + '.');
      switchTab('login');
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
      showBanner(dashBanner, 'warn', 'Connexion à la base de données impossible pour le moment. Forcez le rechargement (Ctrl + Shift + R) ou réessayez sur une autre connexion.');
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
      var meta = (u.user_metadata && u.user_metadata.full_name) || '';
      if (nameEl) nameEl.textContent = meta || 'Étudiant(e)';
      if (emailEl) emailEl.textContent = u.email || '';
    });
  }

  if (btnLogout && sb) {
    btnLogout.addEventListener('click', async function () {
      await sb.auth.signOut();
      window.location.href = '/espace-etudiant/';
    });
  }
}
