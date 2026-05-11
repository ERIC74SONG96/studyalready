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

  if (!sb) {
    showBanner(banner, 'warn', 'Connexion à la base de données impossible pour le moment (votre réseau bloque peut-être Supabase). Forcez le rechargement avec Ctrl + Shift + R, ou essayez en navigation privée / sur une autre connexion. Si le problème persiste, écrivez-nous sur WhatsApp.');
    if (btnLogin) btnLogin.disabled = true;
    if (btnSignup) btnSignup.disabled = true;
  } else {
    if (banner) banner.classList.add('hidden');
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        window.location.replace('dashboard.html');
      }
    });
  }

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
      window.location.href = 'dashboard.html';
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
      var r = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name || '' } }
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
        window.location.href = 'dashboard.html';
        return;
      }
      showBanner(err, 'warn', 'Compte créé. Si la confirmation par email est activée dans Supabase, ouvrez le lien reçu puis connectez-vous.');
      switchTab('login');
    });
  }
}

if (pageId === 'dashboard') {
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
        window.location.href = 'index.html';
      });
    }
  } else {
    sb.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (!s) {
        window.location.href = 'index.html';
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
      window.location.href = 'index.html';
    });
  }
}
