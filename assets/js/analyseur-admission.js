(function () {
  'use strict';

  // ----------------------------------------------------------------
  // RÈGLES D'ORIENTATION — StudyAlready
  // Notes:
  // - Cet outil donne un score d'ORIENTATION basé sur l'expérience
  //   StudyAlready, PAS un pourcentage officiel d'admission.
  // - Les seuils sont volontairement transparents et ajustables ici.
  // - Médecine / sciences dentaires / vétérinaire : examen d'entrée
  //   obligatoire en FWB → traité à part (encadré spécifique).
  // ----------------------------------------------------------------

  var DOMAINES = [
    { id: 'medecine', label: 'Médecine / dentaire / vétérinaire', concours: true, penalite: -10 },
    { id: 'ingenieur_civil', label: 'Ingénieur civil (Polytech)', concours: 'examen_entree', penalite: -5 },
    { id: 'sciences_pures', label: 'Sciences (maths, physique, chimie, bio)', penalite: 0 },
    { id: 'droit', label: 'Droit & sciences politiques', penalite: 0 },
    { id: 'economie', label: 'Économie / gestion / business', penalite: 0 },
    { id: 'sante_para', label: 'Paramédical (infirmier, kiné, sage-femme)', penalite: -3 },
    { id: 'info', label: 'Informatique / data', penalite: 2 },
    { id: 'ingenierie_industriel', label: 'Ingénieur industriel', penalite: 0 },
    { id: 'arts_com', label: 'Arts, communication, design', penalite: 0 },
    { id: 'sciences_humaines', label: 'Sciences humaines & éducation', penalite: 2 },
    { id: 'autre', label: 'Autre / je ne sais pas encore', penalite: 0 }
  ];

  // Base d'établissements FWB (sélectivité indicative selon notre expérience).
  // 'seuil' : score d'orientation minimal recommandé (0–100) pour viser l'établissement
  // 'profil' : axe principal de l'établissement
  var ETABLISSEMENTS = [
    { id: 'ulb', nom: 'ULB', type: 'Université', ville: 'Bruxelles', seuil: 70, profils: ['medecine','ingenieur_civil','sciences_pures','droit','economie','sciences_humaines','info'] },
    { id: 'uclouvain', nom: 'UCLouvain', type: 'Université', ville: 'Louvain-la-Neuve', seuil: 70, profils: ['medecine','ingenieur_civil','sciences_pures','droit','economie','sciences_humaines','info','arts_com'] },
    { id: 'uliege', nom: 'ULiège', type: 'Université', ville: 'Liège', seuil: 65, profils: ['medecine','ingenieur_civil','sciences_pures','droit','economie','info','sciences_humaines','ingenierie_industriel'] },
    { id: 'umons', nom: 'UMons', type: 'Université', ville: 'Mons', seuil: 55, profils: ['ingenieur_civil','sciences_pures','economie','sciences_humaines','info','ingenierie_industriel'] },
    { id: 'unamur', nom: 'UNamur', type: 'Université', ville: 'Namur', seuil: 58, profils: ['medecine','sciences_pures','droit','economie','info','sciences_humaines'] },
    { id: 'usl_b', nom: 'USL-B', type: 'Université', ville: 'Bruxelles', seuil: 60, profils: ['droit','economie','sciences_humaines','arts_com'] },

    { id: 'ichec', nom: 'ICHEC', type: 'École de gestion', ville: 'Bruxelles', seuil: 55, profils: ['economie'] },
    { id: 'ihecs', nom: 'IHECS', type: 'École supérieure', ville: 'Bruxelles', seuil: 55, profils: ['arts_com'] },

    { id: 'he_ldv', nom: 'HE Léonard de Vinci', type: 'Haute École', ville: 'Bruxelles / Louvain-la-Neuve', seuil: 42, profils: ['sante_para','info','economie','arts_com'] },
    { id: 'he2b', nom: 'HE2B', type: 'Haute École', ville: 'Bruxelles', seuil: 40, profils: ['info','economie','sciences_humaines','sante_para'] },
    { id: 'ephec', nom: 'EPHEC', type: 'Haute École', ville: 'Bruxelles / LLN', seuil: 42, profils: ['economie','info','arts_com'] },
    { id: 'helha', nom: 'HELHa', type: 'Haute École', ville: 'Hainaut (Mons, Tournai, Charleroi…)', seuil: 38, profils: ['economie','sante_para','sciences_humaines','info','ingenierie_industriel'] },
    { id: 'heh', nom: 'HEH', type: 'Haute École', ville: 'Hainaut (Mons)', seuil: 40, profils: ['economie','sante_para','sciences_humaines','ingenierie_industriel','info'] },
    { id: 'condorcet', nom: 'HE Condorcet', type: 'Haute École', ville: 'Charleroi / Mons', seuil: 38, profils: ['sante_para','economie','sciences_humaines','ingenierie_industriel'] },
    { id: 'hepl', nom: 'HEPL', type: 'Haute École', ville: 'Liège', seuil: 40, profils: ['sante_para','economie','info','sciences_humaines','ingenierie_industriel'] },
    { id: 'helmo', nom: 'HELMo', type: 'Haute École', ville: 'Liège', seuil: 42, profils: ['sante_para','economie','info','sciences_humaines'] },
    { id: 'henallux', nom: 'Hénallux', type: 'Haute École', ville: 'Namur / Bastogne / Malonne…', seuil: 40, profils: ['sante_para','economie','sciences_humaines','ingenierie_industriel'] }
  ];

  // ----------------------------------------------------------------
  // CALCUL DU SCORE
  // ----------------------------------------------------------------
  function normaliserMoyenne(valeur, base) {
    var v = parseFloat(valeur);
    if (isNaN(v)) return null;
    if (base === '20') return Math.max(0, Math.min(20, v));
    if (base === '100') return Math.max(0, Math.min(100, v)) * 0.2; // convertir sur 20
    if (base === '4') return Math.max(0, Math.min(4, v)) * 5; // GPA → /20
    return v;
  }

  function scoreMoyenne(m20) {
    // 50 points max
    if (m20 == null) return { pts: 0, comment: 'Moyenne non renseignée.' };
    if (m20 >= 16) return { pts: 50, comment: 'Excellent niveau (≥ 16/20).' };
    if (m20 >= 14) return { pts: 45, comment: 'Très bon niveau (14–16/20).' };
    if (m20 >= 12) return { pts: 35, comment: 'Bon niveau (12–14/20).' };
    if (m20 >= 10) return { pts: 22, comment: 'Niveau passable (10–12/20).' };
    if (m20 >= 8)  return { pts: 10, comment: 'Niveau fragile (< 10/20).' };
    return { pts: 5, comment: 'Niveau très fragile (< 8/20).' };
  }

  function scoreParcours(redoublements, dejaInscrit, echecsEnseignementSup) {
    // 30 points max — la régularité du parcours pèse lourd en Belgique
    var pts = 30;
    var details = [];
    var r = parseInt(redoublements, 10);
    if (isNaN(r) || r < 0) r = 0;
    if (r === 0) details.push('Aucun redoublement (très valorisé en FWB).');
    else if (r === 1) { pts -= 8; details.push('1 redoublement (toléré).'); }
    else if (r === 2) { pts -= 18; details.push('2 redoublements (vigilance sur le finançabilité).'); }
    else { pts -= 25; details.push(r + ' redoublements (la finançabilité devient incertaine).'); }

    if (dejaInscrit === 'oui_belgique') {
      var e = parseInt(echecsEnseignementSup, 10) || 0;
      if (e === 0) details.push('Échec(s) belge(s) : aucun.');
      else if (e === 1) { pts -= 3; details.push('1 échec dans l\'enseignement supérieur belge.'); }
      else if (e === 2) { pts -= 8; details.push('2 échecs côté belge : risque de non-finançabilité.'); }
      else { pts -= 14; details.push('≥ 3 échecs belges : finançabilité quasi certainement perdue.'); }
    }

    return { pts: Math.max(0, pts), comment: details.join(' ') };
  }

  function scoreDomaine(domaineId) {
    // ± 10 points selon la spécificité du domaine choisi
    var dom = DOMAINES.filter(function (d) { return d.id === domaineId; })[0];
    if (!dom) return { pts: 0, comment: 'Domaine non précisé.' };
    return { pts: dom.penalite, comment: 'Domaine : ' + dom.label + (dom.concours === true ? ' — examen d\'entrée FWB obligatoire.' : (dom.concours === 'examen_entree' ? ' — examen d\'admission requis.' : '')) };
  }

  function scoreLangue(niveauFr) {
    // 10 points max
    if (niveauFr === 'maternelle') return { pts: 10, comment: 'Français langue maternelle.' };
    if (niveauFr === 'c1') return { pts: 8, comment: 'Français courant (≥ C1).' };
    if (niveauFr === 'b2') return { pts: 5, comment: 'Français B2 — niveau minimum exigé par la plupart des établissements FWB.' };
    if (niveauFr === 'b1') return { pts: 1, comment: 'Français B1 : insuffisant pour la plupart des admissions FWB.' };
    return { pts: 0, comment: 'Niveau de français non précisé.' };
  }

  function calculerScore(formData) {
    var m20 = normaliserMoyenne(formData.moyenne, formData.baseMoyenne);
    var sM = scoreMoyenne(m20);
    var sP = scoreParcours(formData.redoublements, formData.dejaInscrit, formData.echecsBelgique);
    var sD = scoreDomaine(formData.domaine);
    var sL = scoreLangue(formData.langue);

    var total = sM.pts + sP.pts + sD.pts + sL.pts;
    total = Math.max(0, Math.min(100, total));

    return {
      total: Math.round(total),
      moyenne20: m20,
      composantes: [
        { label: 'Moyenne académique', max: 50, value: sM.pts, comment: sM.comment },
        { label: 'Régularité du parcours', max: 30, value: sP.pts, comment: sP.comment },
        { label: 'Adéquation domaine', max: 10, min: -10, value: sD.pts, comment: sD.comment },
        { label: 'Niveau de français', max: 10, value: sL.pts, comment: sL.comment }
      ]
    };
  }

  function classerEtablissements(score, domaineId) {
    // 3 paniers : Sécurité (score - 15+ marge), Réaliste (≈ score), Ambitieux (>+10)
    var listes = { securite: [], realiste: [], ambitieux: [], horsCible: [] };
    ETABLISSEMENTS.forEach(function (e) {
      if (domaineId && domaineId !== 'autre' && e.profils.indexOf(domaineId) === -1) return;
      var ecart = score - e.seuil;
      if (ecart >= 15) listes.securite.push(e);
      else if (ecart >= -5) listes.realiste.push(e);
      else if (ecart >= -15) listes.ambitieux.push(e);
      else listes.horsCible.push(e);
    });
    return listes;
  }

  function badgeFor(score) {
    if (score >= 75) return { label: 'Profil très solide', color: 'emerald', message: 'Vous êtes en bonne position pour viser les universités FWB les plus sélectives.' };
    if (score >= 60) return { label: 'Profil correct', color: 'sky', message: 'Plusieurs universités et écoles supérieures sont accessibles. Soignez le dossier de motivation.' };
    if (score >= 45) return { label: 'Profil moyen', color: 'amber', message: 'Privilégiez les Hautes Écoles et les universités les moins sélectives. Un coaching renforce le dossier.' };
    return { label: 'Profil fragile', color: 'red', message: 'Une remise à niveau ou une réorientation est recommandée. Parlons-en avant de soumettre le dossier.' };
  }

  // ----------------------------------------------------------------
  // RENDU
  // ----------------------------------------------------------------
  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderEtab(e) {
    return '' +
      '<li class="rounded-xl bg-white border border-slate-200 p-4 hover:border-brand-gold transition">' +
        '<p class="font-display font-bold text-brand-dark">' + escapeHTML(e.nom) + '</p>' +
        '<p class="text-xs text-slate-500">' + escapeHTML(e.type) + ' · ' + escapeHTML(e.ville) + '</p>' +
        '<p class="mt-2 text-[11px] text-slate-400">Seuil d\'orientation : ' + e.seuil + '/100</p>' +
      '</li>';
  }

  function rendreResultat(result, formData) {
    var box = document.getElementById('resultatAnalyse');
    if (!box) return;

    var b = badgeFor(result.total);
    var listes = classerEtablissements(result.total, formData.domaine);

    var colorClasses = {
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-400' },
      sky: { bg: 'bg-sky-100', text: 'text-sky-800', ring: 'ring-sky-400' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-400' },
      red: { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-400' }
    }[b.color];

    var medecineEncadre = '';
    if (formData.domaine === 'medecine') {
      medecineEncadre =
        '<div class="mt-6 p-5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">' +
          '<p class="font-bold">⚠️ Médecine / dentaire / vétérinaire en FWB</p>' +
          '<p class="mt-1">L\'admission passe par un <strong>examen d\'entrée obligatoire</strong> organisé par l\'ARES (souvent fin août). Ce score n\'évalue PAS vos chances de réussir cet examen. Une préparation dédiée (4 à 6 mois minimum) est indispensable.</p>' +
        '</div>';
    } else if (formData.domaine === 'ingenieur_civil') {
      medecineEncadre =
        '<div class="mt-6 p-5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">' +
          '<p class="font-bold">⚠️ Ingénieur civil</p>' +
          '<p class="mt-1">Un <strong>examen d\'admission</strong> est requis dans plusieurs universités FWB (épreuve de maths principalement). Préparez-le en amont du dossier.</p>' +
        '</div>';
    }

    var composantesHTML = result.composantes.map(function (c) {
      var min = (typeof c.min === 'number') ? c.min : 0;
      var range = c.max - min;
      var rel = Math.max(0, Math.min(100, ((c.value - min) / range) * 100));
      return '' +
        '<div>' +
          '<div class="flex items-center justify-between text-xs"><span class="font-semibold text-slate-700">' + escapeHTML(c.label) + '</span><span class="text-slate-500">' + c.value + (min < 0 ? '' : '/' + c.max) + '</span></div>' +
          '<div class="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-brand-gold" style="width:' + rel.toFixed(0) + '%"></div></div>' +
          '<p class="mt-1 text-[11px] text-slate-500">' + escapeHTML(c.comment) + '</p>' +
        '</div>';
    }).join('');

    function bloc(titre, items, vide) {
      if (!items.length) return '<p class="mt-2 text-xs text-slate-500 italic">' + vide + '</p>';
      return '<ul class="mt-3 grid sm:grid-cols-2 gap-3">' + items.map(renderEtab).join('') + '</ul>';
    }

    box.innerHTML =
      '<div class="rounded-2xl border-2 ring-1 ' + colorClasses.ring + ' bg-white shadow-sm">' +
        '<div class="p-6 sm:p-8 border-b border-slate-100">' +
          '<div class="flex flex-col sm:flex-row sm:items-center gap-5">' +
            '<div class="flex items-center justify-center w-28 h-28 rounded-full ' + colorClasses.bg + ' shrink-0">' +
              '<span class="font-display font-extrabold text-4xl ' + colorClasses.text + '">' + result.total + '</span>' +
            '</div>' +
            '<div>' +
              '<span class="inline-block text-xs font-bold uppercase tracking-wider ' + colorClasses.bg + ' ' + colorClasses.text + ' px-3 py-1 rounded-full">' + escapeHTML(b.label) + '</span>' +
              '<p class="mt-2 text-sm text-slate-600">Score d\'orientation StudyAlready · échelle 0–100 · <strong>indicatif, non garanti</strong>.</p>' +
              '<p class="mt-3 text-slate-700">' + escapeHTML(b.message) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="p-6 sm:p-8 border-b border-slate-100">' +
          '<h3 class="font-display font-bold text-brand-dark">Détail du score</h3>' +
          '<div class="mt-4 grid md:grid-cols-2 gap-4">' + composantesHTML + '</div>' +
        '</div>' +

        '<div class="p-6 sm:p-8 border-b border-slate-100">' +
          '<h3 class="font-display font-bold text-brand-dark">🎯 Établissements à viser en priorité (réalistes)</h3>' +
          '<p class="text-xs text-slate-500">Adéquation forte avec votre profil aujourd\'hui.</p>' +
          bloc('realiste', listes.realiste, 'Aucun établissement dans cette catégorie pour votre profil.') +
        '</div>' +

        '<div class="p-6 sm:p-8 border-b border-slate-100">' +
          '<h3 class="font-display font-bold text-brand-dark">🛟 Établissements « sécurité »</h3>' +
          '<p class="text-xs text-slate-500">Profil largement au-dessus du seuil : forte probabilité d\'acceptation.</p>' +
          bloc('securite', listes.securite, 'Pas de panier « sécurité » avec ce score. Ajoutez des Hautes Écoles à votre liste.') +
        '</div>' +

        '<div class="p-6 sm:p-8 border-b border-slate-100">' +
          '<h3 class="font-display font-bold text-brand-dark">🚀 Cibles ambitieuses (à compléter par un excellent dossier)</h3>' +
          '<p class="text-xs text-slate-500">Au-dessus de votre niveau actuel — possible avec un dossier de motivation très soigné.</p>' +
          bloc('ambitieux', listes.ambitieux, 'Aucune cible ambitieuse identifiée.') +
        '</div>' +

        medecineEncadre +

        '<div class="p-6 sm:p-8 bg-slate-50">' +
          '<p class="text-sm text-slate-600">Ce score est un <strong>outil d\'orientation interne</strong>. Seuls la FWB et chaque établissement décident de l\'admission finale. Un <a href="prequalification-dossier.html" class="underline font-semibold text-brand-dark">dossier de pré-qualification détaillé</a> vous donnera une réponse personnalisée par un humain.</p>' +
          '<div class="mt-5 flex flex-wrap gap-3">' +
            '<button type="button" id="btnRapportEmail" class="inline-flex items-center gap-2 bg-brand-gold text-brand-dark font-bold px-5 py-3 rounded-full text-sm hover:bg-yellow-400">Recevoir le rapport par email</button>' +
            '<button type="button" id="btnImprimer" class="inline-flex items-center gap-2 border border-slate-300 text-brand-dark font-semibold px-5 py-3 rounded-full text-sm hover:border-brand-gold">Imprimer / sauvegarder PDF</button>' +
            '<a href="prequalification-dossier.html" class="inline-flex items-center gap-2 bg-brand-dark text-white font-semibold px-5 py-3 rounded-full text-sm hover:bg-brand-blue">Demander la pré-qualification humaine</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    box.classList.remove('hidden');
    setTimeout(function () {
      try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }, 50);

    // Préparer le formulaire d'envoi de rapport
    var hidScore = document.getElementById('rapportScore');
    var hidProfil = document.getElementById('rapportProfil');
    var hidReco = document.getElementById('rapportReco');
    if (hidScore) hidScore.value = result.total + '/100 — ' + b.label;
    if (hidProfil) hidProfil.value = JSON.stringify({
      moyenne: formData.moyenne,
      baseMoyenne: formData.baseMoyenne,
      redoublements: formData.redoublements,
      echecsBelgique: formData.echecsBelgique,
      domaine: formData.domaine,
      langue: formData.langue,
      type_diplome: formData.typeDiplome
    });
    if (hidReco) {
      var labels = function (arr) { return arr.map(function (e) { return e.nom + ' (' + e.type + ')'; }).join(', ') || '—'; };
      hidReco.value =
        'Réalistes: ' + labels(listes.realiste) + ' | ' +
        'Sécurité: ' + labels(listes.securite) + ' | ' +
        'Ambitieux: ' + labels(listes.ambitieux);
    }

    // Bind boutons
    var btnEmail = document.getElementById('btnRapportEmail');
    var btnPrint = document.getElementById('btnImprimer');
    var modal = document.getElementById('modalRapport');
    if (btnEmail && modal) btnEmail.addEventListener('click', function () { modal.classList.remove('hidden'); });
    if (btnPrint) btnPrint.addEventListener('click', function () { window.print(); });
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------
  function init() {
    var form = document.getElementById('formAnalyse');
    var selectDomaine = document.getElementById('selDomaine');
    if (!form || !selectDomaine) return;

    // Remplir la liste des domaines
    var optsHTML = '<option value="">— Choisir —</option>';
    DOMAINES.forEach(function (d) {
      optsHTML += '<option value="' + d.id + '">' + escapeHTML(d.label) + '</option>';
    });
    selectDomaine.innerHTML = optsHTML;

    // Gestion conditionnelle : champ "échecs Belgique" visible seulement si dejaInscrit = oui_belgique
    var dejaInscrit = document.getElementById('selDejaInscrit');
    var blocEchecs = document.getElementById('blocEchecsBelgique');
    function toggleEchecs() {
      if (!blocEchecs) return;
      if (dejaInscrit && dejaInscrit.value === 'oui_belgique') blocEchecs.classList.remove('hidden');
      else blocEchecs.classList.add('hidden');
    }
    if (dejaInscrit) dejaInscrit.addEventListener('change', toggleEchecs);
    toggleEchecs();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var formData = {
        typeDiplome: fd.get('type_diplome') || '',
        moyenne: fd.get('moyenne') || '',
        baseMoyenne: fd.get('base_moyenne') || '20',
        redoublements: fd.get('redoublements') || '0',
        dejaInscrit: fd.get('deja_inscrit') || 'non',
        echecsBelgique: fd.get('echecs_belgique') || '0',
        domaine: fd.get('domaine') || '',
        langue: fd.get('langue') || ''
      };
      var result = calculerScore(formData);
      rendreResultat(result, formData);
    });

    var btnReset = document.getElementById('btnResetAnalyse');
    if (btnReset) btnReset.addEventListener('click', function () {
      var box = document.getElementById('resultatAnalyse');
      if (box) box.classList.add('hidden');
      form.reset();
      toggleEchecs();
    });

    // Modal fermeture
    var modal = document.getElementById('modalRapport');
    var modalClose = document.getElementById('btnFermerModal');
    if (modal && modalClose) modalClose.addEventListener('click', function () { modal.classList.add('hidden'); });
    if (modal) modal.addEventListener('click', function (ev) {
      if (ev.target === modal) modal.classList.add('hidden');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
