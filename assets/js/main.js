// StudyAlready - JavaScript principal

document.addEventListener('DOMContentLoaded', () => {

  // ============ Année courante dans le footer ============
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ============ Menu mobile ============
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });
  }

  // ============ Header dynamique au scroll ============
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============ Animation au scroll (IntersectionObserver) ============
  // Note : threshold 0.1 peut laisser des blocs invisibles si l'élément est très haut
  // (moins de 10 % visible). On utilise threshold: 0 + marge pour déclencher plus tôt.
  const fadeEls = document.querySelectorAll('section h2, section .grid > *');
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealAllFadeElements() {
    fadeEls.forEach((el) => {
      el.classList.add('fade-in', 'visible');
    });
  }

  if (fadeEls.length === 0) {
    // Rien à animer
  } else if (prefersReducedMotion) {
    // Pas d'animation : on n'ajoute pas .fade-in (le contenu reste visible)
  } else if ('IntersectionObserver' in window) {
    fadeEls.forEach((el) => el.classList.add('fade-in'));
    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0, rootMargin: '0px 0px 8% 0px' }
      );
      fadeEls.forEach((el) => observer.observe(el));
      // Filet de sécurité : évite une page vide si l'observer échoue silencieusement
      window.setTimeout(() => {
        fadeEls.forEach((el) => {
          if (el.classList.contains('fade-in') && !el.classList.contains('visible')) {
            el.classList.add('visible');
          }
        });
      }, 4000);
    } catch (e) {
      revealAllFadeElements();
    }
  } else {
    revealAllFadeElements();
  }

  // ============ Formulaires AJAX (contact + pré-qualification) ============
  function bindAjaxForm(form, statusEl, successMessage) {
    if (!form || !statusEl) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-amber-700');
      statusEl.classList.add('text-slate-600');
      statusEl.textContent = 'Envoi en cours...';

      if (window.location.protocol === 'file:') {
        statusEl.textContent =
          "Pour tester l'envoi du formulaire, ouvrez le site via un serveur local (XAMPP) ou une fois en ligne sur LWS. En attendant, écrivez-nous sur WhatsApp ou à contact@studyalready.com.";
        statusEl.classList.remove('text-slate-600');
        statusEl.classList.add('text-amber-700');
        return;
      }

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        });

        const raw = await response.text();
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch {
          /* PHP peut renvoyer du HTML d'erreur */
        }

        if (response.ok && data && data.ok) {
          statusEl.textContent = successMessage;
          statusEl.classList.remove('text-slate-600', 'text-amber-700');
          statusEl.classList.add('text-green-600');
          form.reset();
        } else {
          const msg =
            data && data.message
              ? data.message
              : "Le serveur n'a pas confirmé l'envoi. Réessayez ou contactez-nous par WhatsApp.";
          throw new Error(msg);
        }
      } catch (err) {
        statusEl.textContent =
          err && err.message
            ? `❌ ${err.message}`
            : "❌ Une erreur s'est produite. Merci de réessayer ou de nous écrire à contact@studyalready.com.";
        statusEl.classList.remove('text-slate-600', 'text-amber-700');
        statusEl.classList.add('text-red-600');
      }
    });
  }

  bindAjaxForm(
    document.getElementById('contactForm'),
    document.getElementById('formStatus'),
    '✅ Merci ! Votre message a bien été envoyé. Nous vous répondrons sous 48 h.'
  );

  bindAjaxForm(
    document.getElementById('prequalificationForm'),
    document.getElementById('prequalificationStatus'),
    '✅ Merci ! Votre pré-qualification a bien été envoyée. Nous revenons vers vous sous 48 h ouvrées.'
  );
});
