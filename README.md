# Bell Mountain Builders

Static marketing site — vanilla HTML/CSS/JS, deployed on Cloudflare Pages.

## Layout

```
.
├── *.html                  pages (root + /commercial-service + /residential-service)
├── css/styles.css          single consolidated stylesheet
├── js/main.js              nav, slider, tabs, lightbox, video, forms, reveals
├── fonts/                  Satoshi + Lora font files
├── images/                 site imagery
├── videos/                 hero/background video
├── wrangler.toml           Cloudflare Pages project config
├── _headers                security + caching headers
├── _redirects              pretty-URL redirects
└── robots.txt
```

## Local dev

```bash
python3 -m http.server 8080
# open http://localhost:8080/
```

## Form submissions

The contact form on `contact-us.html` uses a two-tier submission strategy
defined in `js/main.js` (`initForms`):

1. **Primary — POST to a form-relay endpoint.** The form's `<form action>`
   attribute points at a service like Formsubmit.co or Formspree that
   forwards the submission to `office@bellmountainbuilders.com`. The
   handler sends a flat JSON payload of every field, plus `_page`,
   `_referrer`, and `_submittedAt` for context.
2. **Fallback — `mailto:` link.** If the POST fails for any reason
   (timeout, 5xx, CORS, third-party outage, no `action` URL at all), the
   handler opens the visitor's email client with a subject and pre-filled
   body containing every field they entered. The visitor hits Send, the
   message hits the company's inbox.

The visitor always sees the success message either way — they never see a
broken form.

### Configuring the relay

The default `action` is set to Formsubmit.co's free AJAX endpoint:

```html
<form action="https://formsubmit.co/ajax/office@bellmountainbuilders.com" ...>
```

To change the recipient, swap the email in that URL. The first submission
through Formsubmit triggers an activation email to the recipient — click
the link once to confirm, after which every future submission is delivered
directly to the inbox.

To use a different service (Formspree, Web3Forms, Cloudflare Pages
Functions, etc.), swap the `action` URL and add any hidden inputs that
service requires. The handler treats any endpoint that accepts JSON the
same way.

The optional hidden inputs the contact form ships with:

| Field        | Effect                                                    |
| ------------ | --------------------------------------------------------- |
| `_subject`   | Email subject line (and the subject used in the mailto)   |
| `_template`  | `table` renders Formsubmit emails as a formatted table    |
| `_captcha`   | `false` disables Formsubmit's built-in CAPTCHA            |
| `_honey`     | Bot honeypot; submissions where it's filled are dropped   |
| `company`    | Legacy honeypot, same behavior                            |

### Where to change the recipient

Two places:

1. The `<form action="...">` URL in `contact-us.html` (the POST recipient).
2. `FORM_CONFIG.RECIPIENT_EMAIL` in `js/main.js` (the mailto fallback
   recipient).

Keep these two in sync.

## Deploying to Cloudflare Pages

### Option A — Direct upload (no Git)

```bash
npx wrangler pages deploy . --project-name=bell-mountain-builders
```

### Option B — Git-connected

1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create application → Pages → Connect to Git**.
3. Project settings:
   - Build command: *(leave blank)*
   - Build output directory: `/`
4. Save & Deploy.

`_headers` and `_redirects` are picked up automatically.
