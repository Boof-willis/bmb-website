/* =============================================================================
 * Bell Mountain Builders — vanilla site script. Handles:
 *   - responsive nav (mobile burger)
 *   - tab panels
 *   - testimonial slider (autoplay-aware, arrows + dots, cross-fade)
 *   - lightbox image gallery (linked groups, prev/next, esc/click-out)
 *   - background video play/pause control
 *   - reveal-on-scroll animations
 *   - form submission to GoHighLevel webhook
 *   - chat-widget late fade-in
 * ============================================================================= */

/* ----------------------------------------------------------------------------
 *  CONFIG — Form submission
 *  Submission strategy is "POST with mailto fallback":
 *    1. Submit JSON to the form's `action` URL (e.g. a Formsubmit.co AJAX
 *       endpoint) so the company gets a tidy email in their inbox.
 *    2. If that fetch fails — network error, timeout, non-2xx, third-party
 *       outage, anything — build a `mailto:` link from the form fields and
 *       open the visitor's email client with a pre-filled draft.
 *
 *  That way the form ALWAYS gets the visitor's info into a real email,
 *  even if every third-party form relay is down. The success message is
 *  shown either way — the visitor doesn't need to know which path was
 *  used.
 *
 *  RECIPIENT_EMAIL is used to build the mailto link when the POST fails.
 * ---------------------------------------------------------------------------- */
const FORM_CONFIG = {
  RECIPIENT_EMAIL: 'office@bellmountainbuilders.com',
  RECIPIENT_PHONE: '+14352220850',
  POST_TIMEOUT_MS: 8000,
  MAILTO_SUBJECT: 'New contact request — bellmountainbuilders.com',
};

/* ----------------------------------------------------------------------------
 *  Small DOM helpers
 * ---------------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

/* ----------------------------------------------------------------------------
 *  Responsive nav
 * ---------------------------------------------------------------------------- */
function initNav() {
  const navbar = $('.navbar');
  if (!navbar) return;

  const burger = $('.burger-icon', navbar) || $('.nav-btn .burger-icon');
  const menuList = $('.nav-menu-list', navbar) || $('.nav-menu');
  if (!burger || !menuList) return;

  let isOpen = false;
  const html = document.documentElement;

  function setOpen(open) {
    isOpen = open;
    document.body.classList.toggle('is-menu-open', open);
    html.classList.toggle('is-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menuList.setAttribute('aria-hidden', String(!open));
  }

  burger.setAttribute('aria-controls', 'primary-nav');
  burger.setAttribute('aria-expanded', 'false');
  menuList.setAttribute('id', 'primary-nav');

  burger.addEventListener('click', () => setOpen(!isOpen));

  $$('a', menuList).forEach((a) => {
    a.addEventListener('click', () => {
      if (isOpen) setOpen(false);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setOpen(false);
  });

  navbar.classList.add('less-top');

  const SCROLL_THRESHOLD = 8;
  let scrollScheduled = false;
  function applyScrollState() {
    scrollScheduled = false;
    navbar.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
  }
  function onScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(applyScrollState);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  applyScrollState();
}

/* ----------------------------------------------------------------------------
 *  Tabs
 * ---------------------------------------------------------------------------- */
function initTabs() {
  $$('.tabs').forEach((tabs) => {
    const links = $$('[data-tab]', tabs).filter(
      (el) => el.classList.contains('tab-link') || el.closest('.tab-menu')
    );
    const panes = $$('.tab-pane', tabs);
    if (!links.length || !panes.length) return;

    function activate(target) {
      links.forEach((l) => {
        const match = l.getAttribute('data-tab') === target;
        l.classList.toggle('is-current', match);
        l.setAttribute('aria-selected', String(match));
      });
      panes.forEach((p) => {
        const match = p.getAttribute('data-tab') === target;
        p.classList.toggle('is-tab-active', match);
        p.setAttribute('aria-hidden', String(!match));
      });
    }

    links.forEach((l) => {
      l.setAttribute('role', 'tab');
      l.addEventListener('click', (e) => {
        e.preventDefault();
        const target = l.getAttribute('data-tab');
        if (target) activate(target);
      });
    });
    panes.forEach((p) => p.setAttribute('role', 'tabpanel'));

    const initial = links.find((l) => l.classList.contains('is-current')) || links[0];
    if (initial) activate(initial.getAttribute('data-tab'));
  });
}

/* ----------------------------------------------------------------------------
 *  Slider (testimonial carousel) — cross-fade, autoplay-optional
 * ---------------------------------------------------------------------------- */
function initSliders() {
  $$('.slider').forEach((slider) => {
    const mask = $('.slider-mask', slider);
    if (!mask) return;
    const slides = $$('.slide', mask);
    if (slides.length === 0) return;

    const prev = $('.slider-arrow-left', slider);
    const next = $('.slider-arrow-right', slider);
    const nav = $('.slider-nav', slider);

    // Configure
    const autoplay = slider.dataset.autoplay === 'true';
    const delay = parseInt(slider.dataset.delay || '4000', 10);
    const animation = slider.dataset.animation || 'cross'; // cross | slide
    let index = 0;
    let timer = null;

    // Initial styles — overlay slides for cross-fade
    if (animation === 'cross') {
      mask.style.position = 'relative';
      slides.forEach((s, i) => {
        s.style.position = 'absolute';
        s.style.inset = '0';
        s.style.opacity = i === 0 ? '1' : '0';
        s.style.pointerEvents = i === 0 ? '' : 'none';
        s.style.transition = 'opacity 600ms ease';
      });
    }

    // Build dot navigation if container exists
    let dots = [];
    if (nav) {
      nav.innerHTML = '';
      slides.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slider-dot';
        b.setAttribute('aria-label', `Go to slide ${i + 1}`);
        b.addEventListener('click', () => go(i));
        nav.appendChild(b);
        dots.push(b);
      });
    }

    function render() {
      if (animation === 'cross') {
        slides.forEach((s, i) => {
          const active = i === index;
          s.style.opacity = active ? '1' : '0';
          s.style.pointerEvents = active ? '' : 'none';
        });
      }
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    }

    function go(i) {
      index = (i + slides.length) % slides.length;
      render();
      restartAutoplay();
    }

    function step(delta) {
      go(index + delta);
    }

    function restartAutoplay() {
      if (timer) clearTimeout(timer);
      if (autoplay) timer = setTimeout(() => step(1), delay);
    }

    if (prev) prev.addEventListener('click', () => step(-1));
    if (next) next.addEventListener('click', () => step(1));

    // Keyboard
    slider.tabIndex = 0;
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });

    // Touch swipe
    let startX = 0;
    slider.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    slider.addEventListener('touchend', (e) => {
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
    });

    render();
    restartAutoplay();
  });
}

/* ----------------------------------------------------------------------------
 *  Lightbox — image gallery with grouped prev/next
 * ---------------------------------------------------------------------------- */
function initLightbox() {
  const triggers = $$('.lightbox-trigger');
  if (!triggers.length) return;

  // Build groups from inline <script type="application/json" class="lightbox-config">
  const groups = new Map();
  triggers.forEach((trigger) => {
    const config = $('script.lightbox-config', trigger);
    let groupName = 'default';
    let items = [];
    if (config) {
      try {
        const data = JSON.parse(config.textContent || '{}');
        groupName = data.group || groupName;
        items = data.items || [];
      } catch (err) {
        /* ignore malformed JSON */
      }
    }
    if (!items.length) {
      const img = $('img', trigger);
      if (img) items = [{ url: img.src, alt: img.alt || '' }];
    }
    if (!groups.has(groupName)) groups.set(groupName, []);
    const groupItems = groups.get(groupName);
    const startIndex = groupItems.length;
    items.forEach((it) => groupItems.push(it));
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      open(groupName, startIndex);
    });
  });

  // Construct the lightbox DOM once.
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop lightbox-hide';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.innerHTML = `
    <div class="lightbox-container">
      <div class="lightbox-content">
        <div class="lightbox-view is-active">
          <div class="lightbox-frame">
            <figure class="lightbox-figure">
              <img class="lightbox-img" alt="" />
              <figcaption class="lightbox-caption lightbox-hide"></figcaption>
            </figure>
          </div>
        </div>
      </div>
    </div>
    <button class="lightbox-control lightbox-left" type="button" aria-label="Previous"></button>
    <button class="lightbox-control lightbox-right" type="button" aria-label="Next"></button>
    <button class="lightbox-close" type="button" aria-label="Close"></button>
  `;
  document.body.appendChild(backdrop);

  const img = $('.lightbox-img', backdrop);
  const caption = $('.lightbox-caption', backdrop);
  const btnPrev = $('.lightbox-left', backdrop);
  const btnNext = $('.lightbox-right', backdrop);
  const btnClose = $('.lightbox-close', backdrop);

  let currentGroup = null;
  let currentIndex = 0;

  function render() {
    if (!currentGroup) return;
    const item = currentGroup[currentIndex];
    if (!item) return;
    img.src = item.url;
    img.alt = item.alt || '';
    if (item.caption) {
      caption.textContent = item.caption;
      caption.classList.remove('lightbox-hide');
    } else {
      caption.classList.add('lightbox-hide');
    }
    const multiple = currentGroup.length > 1;
    btnPrev.classList.toggle('lightbox-hide', !multiple);
    btnNext.classList.toggle('lightbox-hide', !multiple);
  }

  function open(name, idx) {
    currentGroup = groups.get(name) || [];
    currentIndex = idx;
    render();
    backdrop.classList.remove('lightbox-hide');
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    document.body.classList.add('lightbox-noscroll');
  }
  function close() {
    backdrop.classList.remove('is-open');
    setTimeout(() => backdrop.classList.add('lightbox-hide'), 300);
    document.body.classList.remove('lightbox-noscroll');
  }
  function step(delta) {
    if (!currentGroup) return;
    currentIndex = (currentIndex + delta + currentGroup.length) % currentGroup.length;
    render();
  }

  btnPrev.addEventListener('click', () => step(-1));
  btnNext.addEventListener('click', () => step(1));
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (backdrop.classList.contains('lightbox-hide')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}

/* ----------------------------------------------------------------------------
 *  Background video play/pause control
 * ---------------------------------------------------------------------------- */
function initBgVideo() {
  $$('.bg-video').forEach((wrap) => {
    const video = $('video', wrap);
    const btn = $('.bg-video-play-pause-btn', wrap) || $('.play-pause-button', wrap);
    if (!video) return;

    // If we have a data-video attribute (comma list of URLs), set up sources.
    if (video.dataset.video && !$('source', video)) {
      video.dataset.video.split(',').forEach((url) => {
        const src = document.createElement('source');
        src.src = url.trim();
        const ext = url.trim().split('.').pop().toLowerCase();
        if (ext === 'mp4') src.type = 'video/mp4';
        else if (ext === 'webm') src.type = 'video/webm';
        video.appendChild(src);
      });
      video.load();
    }

    // Hint best quality
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.play().catch(() => {});

    if (btn) {
      const [spanPause, spanPlay] = btn.querySelectorAll('span');
      function sync() {
        const paused = video.paused;
        if (spanPause) spanPause.toggleAttribute('hidden', paused);
        if (spanPlay) spanPlay.toggleAttribute('hidden', !paused);
      }
      btn.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
        sync();
      });
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
      sync();
    }
  });
}

/* ----------------------------------------------------------------------------
 *  Moving-text scroll scrub
 *  The original Webflow site bound a scroll-driven horizontal translate to
 *  the Commercial / Multifamily / Residential banner — as the section
 *  passes through the viewport, the master slides left. We replicate that
 *  with a passive scroll listener and a single rAF tick per frame.
 * ---------------------------------------------------------------------------- */
function initMovingText() {
  const sections = $$('.section-moving-text');
  if (!sections.length) return;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach((section) => {
    const master = section.querySelector('.master-moving-text');
    if (!master) return;
    if (reduceMotion) { master.style.transform = ''; return; }

    // Damping factor: how much of one viewport-width to slide across the full
    // scroll traversal. ~0.5 == half a screen of horizontal travel from when
    // the section enters the viewport to when it leaves — gentle and readable.
    const SCRUB_AMOUNT = 0.5;
    let maxShift = 0;
    let ticking = false;

    const measure = () => {
      const available = Math.max(0, master.scrollWidth - section.clientWidth);
      const desired = section.clientWidth * SCRUB_AMOUNT;
      // Don't try to slide farther than the master actually has slack for.
      maxShift = Math.min(available, desired);
    };

    const update = () => {
      ticking = false;
      if (!maxShift) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Progress: 0 as the section's top edge enters from the bottom of the
      // viewport, 1 by the time the section's bottom edge exits the top.
      const total = vh + rect.height;
      const traveled = vh - rect.top;
      let p = traveled / total;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      master.style.transform = `translate3d(${-maxShift * p}px, 0, 0)`;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    const onResize = () => {
      measure();
      requestAnimationFrame(update);
    };

    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // In case fonts/images load late and resize the master, re-measure.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(onResize).catch(() => {});
    }
    window.addEventListener('load', onResize, { once: true });
  });
}

/* ----------------------------------------------------------------------------
 *  Sticky-USP image rotator
 *  On the homepage there's a section with a sticky image column on the left
 *  and three stacked text blocks on the right. The original Webflow site
 *  rotated the visible image as each text block scrolled into view; this
 *  replicates that behavior with an IntersectionObserver centered on the
 *  viewport so the active image always matches the block the user is reading.
 * ---------------------------------------------------------------------------- */
function initStickyUsp() {
  if (!('IntersectionObserver' in window)) return;
  const wraps = $$('.wrap-images-usp');
  wraps.forEach((wrap) => {
    const section = wrap.closest('.grid-scroll-usp') || wrap.closest('section');
    if (!section) return;
    const blocks = $$('.single-sticky-usp', section);
    const images = $$('.image-sticky-usp', wrap);
    if (!blocks.length || !images.length) return;

    const setActive = (idx) => {
      const target = images[idx] || images[0];
      images.forEach((img) => img.classList.toggle('is-active', img === target));
    };

    wrap.classList.add('is-init');
    setActive(0);

    const blockIndex = new Map();
    blocks.forEach((b, i) => blockIndex.set(b, i));

    const visible = new Set();
    let lastIdx = 0;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      if (!visible.size) return;
      // Pick the visible block whose center is closest to the viewport center.
      const vhCenter = window.innerHeight / 2;
      let best = null;
      let bestDist = Infinity;
      visible.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - vhCenter);
        if (dist < bestDist) { bestDist = dist; best = el; }
      });
      if (best) {
        const idx = blockIndex.get(best);
        if (idx !== lastIdx) { lastIdx = idx; setActive(idx); }
      }
    }, {
      // 1px-tall band at the viewport center so we always know which block
      // is the "currently reading" one.
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0,
    });

    blocks.forEach((b) => observer.observe(b));
  });
}

/* ----------------------------------------------------------------------------
 *  Reveal-on-scroll
 *  Adds [data-reveal] hooks to fade elements in as they enter the viewport.
 * ---------------------------------------------------------------------------- */
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const candidates = $$('[data-reveal], .section, .single-sticky-usp, .link-blog-tile, .more-power-card, .gallery-blocks');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.setAttribute('data-reveal', '');
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  candidates.forEach((el) => {
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    observer.observe(el);
  });
}

/* ----------------------------------------------------------------------------
 *  Form handling — POST with mailto fallback
 *  - Honeypot fields ("_honey" and "company") are checked but never sent.
 *  - Inline per-field validation: invalid fields get .is-invalid and are
 *    cleared as the user fixes them.
 *  - Submits JSON to the form's `action` URL. If that fetch fails (any
 *    reason — network, timeout, 5xx, CORS), falls back to opening a
 *    pre-filled mailto draft so the visitor's info still gets to the
 *    company's inbox.
 * ---------------------------------------------------------------------------- */
const HONEYPOT_KEYS = new Set(['_honey', 'company']);
const META_KEYS = new Set(['_subject', '_template', '_captcha', '_next', '_replyto', '_cc']);

const FIELD_LABELS = {
  name: 'Name',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  topic: 'Project type',
  message: 'Message',
};

function setSubmitLabel(submit, text) {
  if (!submit) return;
  if (submit.tagName === 'INPUT') submit.value = text;
  else submit.textContent = text;
}

function clearInvalidOnInput(form) {
  $$('.field-contact, .input', form).forEach((field) => {
    const handler = () => field.classList.remove('is-invalid');
    field.addEventListener('input', handler);
    field.addEventListener('change', handler);
  });
}

function validateForm(form) {
  let firstInvalid = null;
  $$('[required]', form).forEach((field) => {
    const ok = field.checkValidity();
    field.classList.toggle('is-invalid', !ok);
    if (!ok && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: false });
    try { firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
  }
  return !firstInvalid;
}

/* Build a mailto URL containing the form fields as a plain-text body. */
function buildMailtoUrl(fields, form) {
  const subject =
    (form && form.querySelector('input[name="_subject"]') && form.querySelector('input[name="_subject"]').value) ||
    FORM_CONFIG.MAILTO_SUBJECT;

  const lines = [];
  Object.entries(fields).forEach(([key, value]) => {
    if (!value || HONEYPOT_KEYS.has(key) || META_KEYS.has(key)) return;
    const label = FIELD_LABELS[key] || key;
    lines.push(`${label}: ${value}`);
  });
  lines.push('', `— Sent from ${window.location.href}`);

  const params = new URLSearchParams({
    subject,
    body: lines.join('\n'),
  });
  return `mailto:${FORM_CONFIG.RECIPIENT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

async function postToEndpoint(endpoint, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FORM_CONFIG.POST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok && res.type !== 'opaque') throw new Error(`HTTP ${res.status}`);
    // Some relays return { success: "false", ... } even with a 200.
    try {
      const data = await res.clone().json();
      if (data && (data.success === 'false' || data.success === false)) {
        throw new Error(data.message || 'Service rejected submission');
      }
    } catch (_) { /* non-JSON response is fine */ }
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
}

function initForms() {
  $$('form.form-contact, form.newsletter-form, form[data-form-handler]').forEach((form) => {
    clearInvalidOnInput(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const wrapper = form.closest('.form-block') || form.parentElement;
      const submit = form.querySelector('[type="submit"]');
      const originalLabel = submit ? (submit.value || submit.textContent) : null;
      const success = wrapper ? wrapper.querySelector('.form-success') : null;
      const errorEl = wrapper ? wrapper.querySelector('.form-error') : null;

      if (success) success.classList.remove('is-visible');
      if (errorEl) errorEl.classList.remove('is-visible');

      if (!validateForm(form)) return;

      const formData = new FormData(form);

      const honeypotHit = [...HONEYPOT_KEYS].some(
        (k) => (formData.get(k) || '').toString().trim() !== ''
      );
      if (honeypotHit) {
        form.reset();
        form.style.display = 'none';
        if (success) success.classList.add('is-visible');
        return;
      }

      form.classList.add('is-form-submitting');
      if (submit) {
        submit.disabled = true;
        setSubmitLabel(submit, submit.dataset.wait || 'Sending...');
      }

      const fields = {};
      formData.forEach((value, key) => {
        if (HONEYPOT_KEYS.has(key)) return;
        fields[key] = value;
      });

      const endpoint = (form.getAttribute('action') || '').trim();
      const payload = {
        ...fields,
        _page: window.location.href,
        _referrer: document.referrer || '',
        _submittedAt: new Date().toISOString(),
      };

      let posted = false;
      if (endpoint) {
        try {
          await postToEndpoint(endpoint, payload);
          posted = true;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Backend submit failed, falling back to mailto:', err);
        }
      }

      const showSuccessUI = () => {
        form.reset();
        form.style.display = 'none';
        if (success) {
          success.classList.add('is-visible');
          try { success.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
        }
      };

      if (posted) {
        showSuccessUI();
      } else {
        // Open the visitor's email client with all data pre-filled. They
        // hit Send and the company gets the same content as a normal email.
        try {
          const url = buildMailtoUrl(fields, form);
          window.location.href = url;
          showSuccessUI();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Mailto fallback failed:', err);
          if (errorEl) errorEl.classList.add('is-visible');
        }
      }

      form.classList.remove('is-form-submitting');
      if (submit) {
        submit.disabled = false;
        if (originalLabel != null) setSubmitLabel(submit, originalLabel);
      }
    });
  });
}

/* ----------------------------------------------------------------------------
 *  FAQs — collapsible accordion rows
 *  Markup: <div class="expandable-content-flex"> ... <div class="expand-open">…</div></div>
 *  All rows start closed; clicking or activating with Enter/Space toggles
 *  the `is-open` class which animates the body via CSS grid-template-rows.
 * ---------------------------------------------------------------------------- */
function initFaqs() {
  $$('.expandable-content-flex').forEach((row, idx) => {
    const body = row.querySelector('.expand-open');
    if (!body) return;
    const heading = row.querySelector('.text-faq-heading');
    const bodyId = `faq-body-${idx}`;
    body.setAttribute('id', bodyId);

    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('aria-controls', bodyId);
    if (heading) heading.setAttribute('aria-label', heading.textContent || '');

    row.classList.remove('is-open');

    const toggle = (open) => {
      const isOpen = typeof open === 'boolean' ? open : !row.classList.contains('is-open');
      row.classList.toggle('is-open', isOpen);
      row.setAttribute('aria-expanded', String(isOpen));
    };

    row.addEventListener('click', (e) => {
      // Don't toggle if user clicked an actual link/button inside the body
      if (e.target.closest('a, button')) return;
      toggle();
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/* ----------------------------------------------------------------------------
 *  Horizontal scroll sections
 *  Each `.horiz-scroll-section > .track > .camera > .frame` translates the
 *  frame horizontally based on scroll progress through the track. The track
 *  is taller than the viewport; the camera is sticky inside the track and
 *  clips the frame. Disabled below the 992px breakpoint where the layout
 *  falls back to a vertical stack.
 * ---------------------------------------------------------------------------- */
function initHorizScroll() {
  const sections = $$('.horiz-scroll-section');
  if (!sections.length) return;

  const mql = window.matchMedia('(min-width: 992px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const tracks = sections.map((section) => {
    const track = $('.track', section);
    const camera = track ? $('.camera', track) : null;
    const frame = camera ? $('.frame', camera) : null;
    const items = frame ? $$('.master-horizontal-item', frame) : [];
    return { section, track, camera, frame, items };
  }).filter((t) => t.track && t.frame && t.items.length > 0);

  if (!tracks.length) return;

  let rafId = null;
  let isDesktop = mql.matches;

  function update() {
    rafId = null;
    if (!isDesktop) return;
    tracks.forEach(({ track, camera, frame, items }) => {
      const itemCount = items.length;
      const maxTranslate = (itemCount - 1) * window.innerWidth;
      const rect = track.getBoundingClientRect();
      const cameraHeight = camera ? camera.offsetHeight : window.innerHeight;
      const scrollableHeight = track.offsetHeight - cameraHeight;
      if (scrollableHeight <= 0) {
        frame.style.transform = 'translate3d(0, 0, 0)';
        return;
      }
      let progress = -rect.top / scrollableHeight;
      if (progress < 0) progress = 0;
      else if (progress > 1) progress = 1;
      frame.style.transform = `translate3d(${-progress * maxTranslate}px, 0, 0)`;
    });
  }

  function schedule() {
    if (rafId == null) rafId = requestAnimationFrame(update);
  }

  function applyMode() {
    isDesktop = mql.matches;
    tracks.forEach(({ frame }) => {
      frame.style.willChange = isDesktop ? 'transform' : '';
      frame.style.transform = '';
    });
    if (isDesktop) update();
  }

  applyMode();
  mql.addEventListener('change', applyMode);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

/* ----------------------------------------------------------------------------
 *  Sales-mockups column parallax
 *  Each `.section-sales-mockups` has three vertical `.sales-mockups-column`s.
 *  As the section scrolls through the viewport, the columns translate
 *  vertically at slightly different rates so the grid feels alive without
 *  losing alignment. Disabled below 992px (only one column is visible) and
 *  under prefers-reduced-motion.
 * ---------------------------------------------------------------------------- */
function initSalesParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sections = $$('.section-sales-mockups');
  if (!sections.length) return;

  const desktopMQ = window.matchMedia('(min-width: 992px)');
  const SPEEDS = [0.22, -0.14, 0.22];
  const MAX_OFFSET = 60;

  const items = sections
    .map((section) => ({
      section,
      columns: $$('.sales-mockups-column', section),
    }))
    .filter((it) => it.columns.length > 1);
  if (!items.length) return;

  let rafId = null;
  let active = desktopMQ.matches;

  function update() {
    rafId = null;
    if (!active) return;
    const vh = window.innerHeight;
    items.forEach(({ section, columns }) => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const total = vh + rect.height;
      const traversed = vh - rect.top;
      const progress = Math.max(0, Math.min(1, traversed / total));
      const centered = progress - 0.5;
      columns.forEach((col, i) => {
        const speed = SPEEDS[i] || 0;
        const offset = centered * 2 * MAX_OFFSET * speed;
        col.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      });
    });
  }
  function schedule() {
    if (rafId == null) rafId = requestAnimationFrame(update);
  }
  function applyMode() {
    active = desktopMQ.matches;
    items.forEach(({ columns }) => {
      columns.forEach((col) => {
        col.style.willChange = active ? 'transform' : '';
        if (!active) col.style.transform = '';
      });
    });
    if (active) update();
  }

  applyMode();
  desktopMQ.addEventListener('change', applyMode);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

/* ----------------------------------------------------------------------------
 *  Chat-widget fade-in
 * ---------------------------------------------------------------------------- */
function initChatWidget() {
  // Late fade-in for any embedded chat-widget element
  setTimeout(() => {
    $$('chat-widget').forEach((el) => (el.style.opacity = '1'));
  }, 1500);
}

/* ----------------------------------------------------------------------------
 *  Boot
 * ---------------------------------------------------------------------------- */
ready(() => {
  initNav();
  initTabs();
  initSliders();
  initLightbox();
  initBgVideo();
  initMovingText();
  initStickyUsp();
  initReveal();
  initForms();
  initFaqs();
  initHorizScroll();
  initSalesParallax();
  initChatWidget();
});
