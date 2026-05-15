(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('communityEventsPublicList');
    if (!list || !window.StudyAlreadyEvents) return;
    var sb = window.studyalreadySb;
    window.StudyAlreadyEvents.fetchPublishedEvents(sb).then(function (events) {
      window.StudyAlreadyEvents.renderPublicList(list, events, { includePast: false });
    });
  });
})();
