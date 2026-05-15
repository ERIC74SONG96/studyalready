/**
 * StudyAlready — Événements communautaires (annuaire, calendrier, création).
 */
(function (global) {
  'use strict';

  var EVENT_TYPE_LABELS = {
    webinaire: 'Webinaire',
    atelier: 'Atelier',
    seminaire: 'Séminaire',
    meetup: 'Meetup',
    networking: 'Networking',
    conference: 'Conférence',
    social: 'Social / apéro',
    sport: 'Sport',
    culture: 'Culture',
    autre: 'Autre'
  };

  var FORMAT_LABELS = {
    online: 'En ligne',
    presentiel: 'Présentiel',
    hybride: 'Hybride'
  };

  var FORMAT_ICONS = { online: '💻', presentiel: '📍', hybride: '🔀' };

  var annuaireState = {
    events: [],
    authUserId: null,
    page: 1,
    pageSize: 12
  };

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('fr-BE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Brussels'
      });
    } catch (e) {
      return iso;
    }
  }

  function formatDateRange(ev) {
    var start = formatDateTime(ev.starts_at);
    if (!ev.ends_at) return start;
    try {
      var d1 = new Date(ev.starts_at);
      var d2 = new Date(ev.ends_at);
      if (d1.toDateString() === d2.toDateString()) {
        var endTime = d2.toLocaleString('fr-BE', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Brussels'
        });
        return start + ' → ' + endTime;
      }
    } catch (e2) {}
    return start + ' → ' + formatDateTime(ev.ends_at);
  }

  function isUpcoming(ev) {
    try {
      return new Date(ev.starts_at).getTime() >= Date.now() - 3600000;
    } catch (e) {
      return true;
    }
  }

  function fetchPublishedEvents(sb) {
    if (!sb) return Promise.resolve([]);
    return sb
      .from('community_events')
      .select('*')
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .then(function (res) {
        if (res.error) {
          console.warn('StudyAlready events:', res.error.message);
          return [];
        }
        return res.data || [];
      })
      .catch(function (e) {
        console.warn('StudyAlready events:', e);
        return [];
      });
  }

  function matchEvent(ev, filters) {
    if (!ev) return false;
    if (filters.period === 'upcoming' && !isUpcoming(ev)) return false;
    if (filters.period === 'past' && isUpcoming(ev)) return false;
    /* period === 'all' : pas de filtre date */
    if (filters.eventType && ev.event_type !== filters.eventType) return false;
    if (filters.eventFormat && ev.event_format !== filters.eventFormat) return false;
    if (filters.city && (ev.city || '') !== filters.city) return false;
    if (filters.q) {
      var hay = [
        ev.title, ev.description, ev.location, ev.city, ev.author_label,
        EVENT_TYPE_LABELS[ev.event_type] || '', FORMAT_LABELS[ev.event_format] || ''
      ].join(' ').toLowerCase();
      if (hay.indexOf(filters.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderEventCard(ev, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    var upcoming = isUpcoming(ev);
    var typeLabel = EVENT_TYPE_LABELS[ev.event_type] || ev.event_type;
    var formatLabel = FORMAT_LABELS[ev.event_format] || ev.event_format;
    var icon = FORMAT_ICONS[ev.event_format] || '•';
    var price = ev.is_free
      ? '<span class="annuaire-event-price is-free">Gratuit</span>'
      : '<span class="annuaire-event-price">' + escapeHTML(ev.price_hint || 'Participation') + '</span>';
    var actions = '';
    if (ev.link_url) {
      actions += '<a href="' + escapeHTML(ev.link_url) + '" target="_blank" rel="noopener" class="annuaire-event-btn annuaire-event-btn-primary">Lien / inscription</a>';
    }
    if (ev.contact_hint) {
      actions += '<span class="annuaire-event-contact">' + escapeHTML(ev.contact_hint) + '</span>';
    }
    var desc = compact ? '' : '<p class="annuaire-event-desc">' + escapeHTML(ev.description || '') + '</p>';
    var where = (ev.city || ev.location)
      ? '<p class="annuaire-event-where">' + escapeHTML([ev.location, ev.city].filter(Boolean).join(' · ')) + '</p>'
      : '';

    return '' +
      '<article class="annuaire-event-card' + (upcoming ? ' is-upcoming' : ' is-past') + '">' +
        '<div class="annuaire-event-card-head">' +
          '<p class="annuaire-event-meta">' +
            '<span class="annuaire-event-type">' + escapeHTML(typeLabel) + '</span>' +
            '<span class="annuaire-event-format">' + icon + ' ' + escapeHTML(formatLabel) + '</span>' +
            (upcoming ? '' : '<span class="annuaire-event-past-badge">Passé</span>') +
          '</p>' +
          '<h3 class="annuaire-event-title">' + escapeHTML(ev.title) + '</h3>' +
          '<p class="annuaire-event-when">' + escapeHTML(formatDateRange(ev)) + '</p>' +
          where +
          '<p class="annuaire-event-author">Par ' + escapeHTML(ev.author_label || 'Membre') + '</p>' +
        '</div>' +
        desc +
        '<div class="annuaire-event-card-foot">' + price + '<div class="annuaire-event-actions">' + actions + '</div></div>' +
      '</article>';
  }
  function getEventFiltersFromDom() {
    var fType = document.getElementById('filterEventType');
    var fFormat = document.getElementById('filterEventFormat');
    var fCity = document.getElementById('filterEventCity');
    var fPeriod = document.getElementById('filterEventPeriod');
    var fQ = document.getElementById('filterQ');
    return {
      eventType: fType ? fType.value : '',
      eventFormat: fFormat ? fFormat.value : '',
      city: fCity ? fCity.value : '',
      period: fPeriod ? fPeriod.value : 'upcoming',
      q: fQ ? fQ.value.trim() : ''
    };
  }

  function toggleAnnuaireChrome(isEvents) {
    var membersRefine = document.getElementById('annuaireMembersRefine');
    var eventsRefine = document.getElementById('annuaireEventsRefine');
    var domainBreakdown = document.getElementById('annuaireDomainBreakdown');
    var quickChips = document.getElementById('annuaireQuickChips');
    var listTitle = document.getElementById('annuaireListTitle');
    var fQ = document.getElementById('filterQ');
    if (membersRefine) membersRefine.classList.toggle('hidden', isEvents);
    if (eventsRefine) eventsRefine.classList.toggle('hidden', !isEvents);
    if (domainBreakdown) domainBreakdown.classList.toggle('hidden', isEvents);
    if (quickChips) quickChips.classList.toggle('hidden', isEvents);
    if (listTitle) listTitle.textContent = isEvents ? 'Événements' : 'Membres';
    if (fQ) {
      fQ.placeholder = isEvents
        ? "Titre, ville, type d'événement…"
        : 'Nom, filière, université, visa, mentorat…';
    }
  }

  function renderAnnuaireEventsView() {
    var grid = document.getElementById('annuaireGrid');
    var emptyEl = document.getElementById('annuaireEmpty');
    var countEl = document.getElementById('annuaireCount');
    var pagination = document.getElementById('annuairePagination');
    if (!grid) return;
    if (!Array.isArray(annuaireState.events)) annuaireState.events = [];
    toggleAnnuaireChrome(true);
    var filters = getEventFiltersFromDom();
    var filtered = annuaireState.events.filter(function (ev) { return matchEvent(ev, filters); });
    filtered.sort(function (a, b) {
      var ta = new Date(a.starts_at).getTime();
      var tb = new Date(b.starts_at).getTime();
      return filters.period === 'past' ? tb - ta : ta - tb;
    });
    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / annuaireState.pageSize));
    if (annuaireState.page > pages) annuaireState.page = pages;
    if (annuaireState.page < 1) annuaireState.page = 1;
    var start = (annuaireState.page - 1) * annuaireState.pageSize;
    var slice = filtered.slice(start, start + annuaireState.pageSize);
    if (total === 0) {
      grid.innerHTML = '';
      grid.className = 'annuaire-events-grid min-h-[12rem]';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        var emptyP = emptyEl.querySelector('p');
        if (emptyP) {
          emptyP.textContent = annuaireState.events.length === 0
            ? 'Aucun événement publié. Soyez le premier à en proposer un !'
            : 'Aucun événement pour ces filtres.';
        }
      }
    } else {
      if (emptyEl) emptyEl.classList.add('hidden');
      grid.className = 'annuaire-events-grid min-h-[12rem]';
      grid.innerHTML = slice.map(function (ev) { return renderEventCard(ev, {}); }).join('');
    }
    if (countEl) {
      countEl.textContent = total === 0 ? '0 événement' : (start + 1) + '–' + Math.min(start + annuaireState.pageSize, total) + ' sur ' + total;
    }
    if (pagination) {
      var pages = Math.max(1, Math.ceil(total / annuaireState.pageSize));
      if (total <= annuaireState.pageSize) {
        pagination.innerHTML = '';
      } else {
        var html = '';
        var p;
        html += '<button type="button" class="annuaire-pager-btn" data-event-page="' + (annuaireState.page - 1) + '"' + (annuaireState.page <= 1 ? ' disabled' : '') + '>‹</button>';
        var start = Math.max(1, annuaireState.page - 2);
        var end = Math.min(pages, annuaireState.page + 2);
        for (p = start; p <= end; p++) {
          html += '<button type="button" class="annuaire-pager-btn' + (p === annuaireState.page ? ' is-active' : '') + '" data-event-page="' + p + '">' + p + '</button>';
        }
        html += '<button type="button" class="annuaire-pager-btn" data-event-page="' + (annuaireState.page + 1) + '"' + (annuaireState.page >= pages ? ' disabled' : '') + '>›</button>';
        pagination.innerHTML = html;
        pagination.querySelectorAll('[data-event-page]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var np = Number(btn.getAttribute('data-event-page'));
            if (np >= 1 && np <= pages) {
              annuaireState.page = np;
              renderAnnuaireEventsView();
            }
          });
        });
      }
    }
    var noteEl = document.getElementById('annuaireNote');
    if (noteEl) noteEl.textContent = 'Événements proposés par les membres — non organisés par StudyAlready.';
  }

  function fillEventFilterSelects(events) {
    if (!Array.isArray(events)) events = [];
    var cities = {};
    var i;
    for (i = 0; i < events.length; i++) {
      if (events[i] && events[i].city) cities[events[i].city] = true;
    }
    var fCity = document.getElementById('filterEventCity');
    if (fCity) {
      var html = '<option value="">Toutes les villes</option>';
      Object.keys(cities).sort().forEach(function (c) {
        html += '<option value="' + escapeHTML(c) + '">' + escapeHTML(c) + '</option>';
      });
      fCity.innerHTML = html;
    }
  }

  function renderPublicList(container, events, opts) {
    if (!container) return;
    opts = opts || {};
    var list = (events || []).slice();
    if (!opts.includePast) list = list.filter(isUpcoming);
    list.sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    if (!list.length) {
      container.innerHTML = '<p class="text-sm text-slate-600">Aucun événement à venir. <a href="/creer-evenement" class="text-brand-blue font-semibold underline">Proposer le vôtre</a>.</p>';
      container.className = 'space-y-4';
      return;
    }
    container.className = 'annuaire-events-grid space-y-4';
    container.innerHTML = list.map(function (ev) { return renderEventCard(ev, {}); }).join('');
  }

  function insertEvent(sb, payload) {
    return sb.from('community_events').insert(payload).select('id').maybeSingle();
  }

  global.StudyAlreadyEvents = {
    EVENT_TYPE_LABELS: EVENT_TYPE_LABELS,
    FORMAT_LABELS: FORMAT_LABELS,
    escapeHTML: escapeHTML,
    fetchPublishedEvents: fetchPublishedEvents,
    renderEventCard: renderEventCard,
    renderPublicList: renderPublicList,
    insertEvent: insertEvent,
    setEvents: function (list) {
      annuaireState.events = Array.isArray(list) ? list : [];
      fillEventFilterSelects(annuaireState.events);
    },
    setAuthUserId: function (id) { annuaireState.authUserId = id; },
    resetEventPage: function () { annuaireState.page = 1; },
    renderAnnuaireEventsView: renderAnnuaireEventsView,
    toggleAnnuaireChrome: toggleAnnuaireChrome,
    isUpcoming: isUpcoming
  };
})(typeof window !== 'undefined' ? window : this);
