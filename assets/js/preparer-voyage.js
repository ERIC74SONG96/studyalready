(function () {
  'use strict';

  // ----------------------------------------------------------------
  // PRÉPARER MON VOYAGE — comparateur, formulaire, départs groupés
  // ----------------------------------------------------------------

  // Liste réduite et pertinente d'aéroports pour le couloir Cameroun ↔ Belgique / Europe
  var AIRPORTS = [
    { code: 'NSI', label: 'Yaoundé Nsimalen (NSI)', country: 'Cameroun' },
    { code: 'DLA', label: 'Douala (DLA)', country: 'Cameroun' },
    { code: 'BRU', label: 'Bruxelles Zaventem (BRU)', country: 'Belgique' },
    { code: 'CRL', label: 'Bruxelles-Charleroi (CRL)', country: 'Belgique' },
    { code: 'CDG', label: 'Paris Charles-de-Gaulle (CDG)', country: 'France' },
    { code: 'ORY', label: 'Paris Orly (ORY)', country: 'France' },
    { code: 'AMS', label: 'Amsterdam Schiphol (AMS)', country: 'Pays-Bas' },
    { code: 'FRA', label: 'Francfort (FRA)', country: 'Allemagne' },
    { code: 'IST', label: 'Istanbul (IST)', country: 'Turquie' },
    { code: 'CMN', label: 'Casablanca (CMN)', country: 'Maroc' },
    { code: 'ADD', label: 'Addis-Abeba (ADD)', country: 'Éthiopie' }
  ];

  function fillAirportSelect(sel, defaultCode) {
    if (!sel) return;
    var html = '<option value="">— Choisir —</option>';
    var byCountry = {};
    AIRPORTS.forEach(function (a) {
      byCountry[a.country] = byCountry[a.country] || [];
      byCountry[a.country].push(a);
    });
    Object.keys(byCountry).forEach(function (country) {
      html += '<optgroup label="' + country + '">';
      byCountry[country].forEach(function (a) {
        html += '<option value="' + a.code + '"' + (a.code === defaultCode ? ' selected' : '') + '>' + a.label + '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toSkyscannerDate(yyyyMmDd) {
    // Skyscanner attend YYMMDD
    if (!yyyyMmDd) return '';
    var parts = yyyyMmDd.split('-');
    if (parts.length !== 3) return '';
    return parts[0].slice(2) + pad2(parts[1]) + pad2(parts[2]);
  }

  function buildSkyscannerURL(from, to, depart, ret) {
    var cfg = window.STUDYALREADY_CONFIG || {};
    var locale = (cfg.SKYSCANNER_LOCALE || 'fr-FR').toLowerCase();
    var domain = locale.indexOf('fr') === 0 ? 'fr' : 'com';
    var base = 'https://www.skyscanner.' + domain + '/transport/vols.html';
    var url = base + '/' + from.toLowerCase() + '/' + to.toLowerCase() + '/';
    if (depart) url += toSkyscannerDate(depart) + '/';
    if (ret) url += toSkyscannerDate(ret) + '/';

    var params = [];
    params.push('adults=1');
    if (cfg.SKYSCANNER_MARKET) params.push('market=' + encodeURIComponent(cfg.SKYSCANNER_MARKET));
    if (cfg.SKYSCANNER_LOCALE) params.push('locale=' + encodeURIComponent(cfg.SKYSCANNER_LOCALE));
    if (cfg.SKYSCANNER_ASSOCIATE_ID) params.push('associateid=' + encodeURIComponent(cfg.SKYSCANNER_ASSOCIATE_ID));
    if (params.length) url += '?' + params.join('&');
    return url;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-.html' + pad2(d.getMonth() + 1) + '-.html' + pad2(d.getDate());
  }

  function initComparateur() {
    var form = document.getElementById('formComparateur');
    if (!form) return;

    var selFrom = document.getElementById('selFrom');
    var selTo = document.getElementById('selTo');
    var inpDepart = document.getElementById('inpDepart');
    var inpReturn = document.getElementById('inpReturn');
    var chkAller = document.getElementById('chkAllerSimple');

    fillAirportSelect(selFrom, 'NSI');
    fillAirportSelect(selTo, 'BRU');

    if (inpDepart) {
      inpDepart.min = todayISO();
    }

    if (chkAller && inpReturn) {
      chkAller.addEventListener('change', function () {
        if (chkAller.checked) {
          inpReturn.value = '';
          inpReturn.setAttribute('disabled', 'disabled');
          inpReturn.parentElement.classList.add('opacity-50');
        } else {
          inpReturn.removeAttribute('disabled');
          inpReturn.parentElement.classList.remove('opacity-50');
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var from = selFrom.value;
      var to = selTo.value;
      var depart = inpDepart.value;
      var ret = (chkAller && chkAller.checked) ? '' : (inpReturn ? inpReturn.value : '');

      if (!from || !to) { alert('Merci de sélectionner un aéroport de départ et d\'arrivée.'); return; }
      if (from === to) { alert('Le départ et l\'arrivée doivent être différents.'); return; }

      var url = buildSkyscannerURL(from, to, depart, ret);
      window.open(url, '_blank', 'noopener');
    });
  }

  function initChasseurBillet() {
    var form = document.getElementById('chasseurBilletForm');
    if (!form) return;

    var cfg = window.STUDYALREADY_CONFIG || {};
    var tarifEl = document.getElementById('chasseurTarifAffiche');
    if (tarifEl && cfg.CHASSEUR_BILLETS_TARIF_EUR) {
      tarifEl.textContent = cfg.CHASSEUR_BILLETS_TARIF_EUR + ' €';
    }
  }

  function initDepartsGroupes() {
    var form = document.getElementById('departsGroupesForm');
    if (!form) return;

    // Génère dynamiquement les fenêtres de départ (rentrée FWB sept et fév)
    var sel = document.getElementById('selFenetreDepart');
    if (sel) {
      var now = new Date();
      var year = now.getFullYear();
      var options = [];

      // 4 fenêtres glissantes à partir de maintenant
      var slots = [
        { mois: 8, label: 'Août' },     // Préparation rentrée septembre
        { mois: 9, label: 'Septembre' }, // Rentrée FWB
        { mois: 0, label: 'Janvier' },   // Préparation rentrée février
        { mois: 1, label: 'Février' }    // Quadri 2
      ];

      for (var y = 0; y < 2; y++) {
        slots.forEach(function (s) {
          var slotYear = year + y;
          var slotDate = new Date(slotYear, s.mois, 1);
          if (slotDate.getTime() < now.getTime() - (1000 * 60 * 60 * 24 * 30)) return;
          options.push({ value: s.label + ' ' + slotYear, label: s.label + ' ' + slotYear });
        });
      }

      var html = '<option value="">— Choisir —</option>';
      options.forEach(function (o) {
        html += '<option value="' + o.value + '">' + o.label + '</option>';
      });
      sel.innerHTML = html;
    }
  }

  function init() {
    initComparateur();
    initChasseurBillet();
    initDepartsGroupes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
