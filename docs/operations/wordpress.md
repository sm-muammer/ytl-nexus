# Nexus Studio (headless WordPress)

> **Purpose:** how Nexus Studio is installed, secured and operated on Nexus Core 01, and how its content reaches Nexus Library.
> **Audience:** operators and the next builder. Spec: [15 Library and Studio](../spec/15-nexus-library-and-studio.md).

## How it fits together

```
Editor ─ https://…/studio/wp-admin (allowed addresses only, two-factor)
            │ save
            ▼
        WordPress (PHP-FPM pool "wordpress", user wordpress, database nexus_wordpress)
            │ signed POST at shutdown            ▲ Application Password
            ▼                                    │ http://127.0.0.1:8081/studio (loopback only)
   Next.js  /api/revalidate  ── drops cache tags ──► lib/server/wordpress.ts ── lib/server/content.ts ── pages
```

- WordPress never renders public pages. The `nexus-headless` theme redirects every front-end request to the site root (`/`).
- The Next.js server reads content over a loopback-only Apache listener (`127.0.0.1:8081`) with an Application Password of the user `nexus-reader`. That account has no editing rights and cannot sign in to wp-admin.
- Role filtering happens twice: WordPress returns only public items to anyone without the capability `nexus_read_internal` (an anonymous call to `/studio/wp-json/` never sees an internal item), and `lib/server/content.ts` filters again for the signed-in role. Pages and `/api/library` use only that module.

## What was installed

| Item              | Where                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| WP-CLI            | `/usr/local/bin/wp`, phar checksum (sha512) verified against the release file                                   |
| WordPress core    | `/var/www/studio` (code owned by root; only `wp-content/uploads` is writable by the pool)                       |
| PHP-FPM pool      | `/etc/php-fpm.d/wordpress.conf`, socket `/run/php-fpm/wordpress.sock`, `open_basedir`, dangerous functions off  |
| Apache            | `/etc/httpd/conf.d/studio.inc` (included by `00-ytl-nexus.conf`), loopback vhost `127.0.0.1:8081`               |
| Secrets           | `/var/lib/wordpress/secrets.php` (database password, salts, webhook secret; `root:wordpress` 0640)              |
| Next.js variables | `NEXUS_WP_URL`, `NEXUS_WP_USER`, `NEXUS_WP_APP_PASSWORD`, `NEXUS_WP_WEBHOOK_SECRET` in `/etc/ytl-nexus/web.env` |
| Plugins           | `nexus-content` (ours), `two-factor` (official). Hello Dolly, Akismet and the default themes are removed.       |
| Theme             | `nexus-headless`                                                                                                |

Install or repair everything with `infrastructure/scripts/server-run setup-wordpress`. It is safe to run again: secrets, the database and edited content are kept, and seed items are created only when their slug does not exist yet.

## Access rules (LIB-02, LIB-03)

- `wp-admin`, `wp-login.php` and the plugin and theme files under `wp-content` answer only to `127.0.0.1`, `::1` and `10.0.0.0/8`. To change the list, edit `Require ip` in `infrastructure/apache/studio.inc` and run `setup-wordpress`.
- `/studio/wp-json/` and uploads are open to everyone (the API only returns public items to anonymous callers).
- XML-RPC is denied by Apache and switched off in WordPress. File editing is off (`DISALLOW_FILE_EDIT`); automatic updates are off, so updates are a deliberate task.
- Every account must set up two-factor authentication at its first sign-in: `nexus-content` sends anyone without a Two Factor provider to their profile page until they do.
- The Studio administrator `studio-admin` was created with a random password, saved once in `/root/studio-admin-password.txt` on the server. Read it, sign in, set up two-factor, create real editor accounts, then delete the file.

### Creating an editor

```bash
ssh root@10.26.64.164
wp --allow-root --path=/var/www/studio --url=https://ytl-nexus.ytlcomms.my/studio \
  user create jane jane@example.com --role=editor --send-email
```

Editors can edit all content types. They sign in at `https://ytl-nexus.ytlcomms.my/studio/wp-login.php` from an allowed address.

## Content model

Eight post types (`runbook`, `faq`, `announcement`, `story_chapter`, `tour_step`, `business_unit`, `mail_help`, `service_note`), all REST-enabled but not public, so they are absent from the REST search endpoint. Every item has the fields in the "Nexus fields" box: **Who can read this** (`public` or `internal`; a missing value counts as internal), business unit, related service and source URL. A company claim needs an official source URL.

Pages built so far: `/library` (runbooks and FAQs), `/library/<slug>`, `/story` (story chapters). The others (`announcement` in Status, `tour_step` in Tour, `mail_help`, `service_note`, `business_unit`) are readable through the same module when their tasks arrive.

## Revalidation and preview (LIB-05, LIB-06)

- On publish, update, unpublish or delete, the plugin sends a signed POST to `http://127.0.0.1:3000/api/revalidate` after the request finishes. Headers: `X-Nexus-Timestamp` (seconds), `X-Nexus-Nonce` (single use), `X-Nexus-Signature` (`sha256=` + HMAC-SHA256 of `timestamp.nonce.body`). The route accepts a timestamp within 5 minutes and each nonce once, and answers 401 with no detail otherwise. Each attempt is written to `audit_events` (`content.revalidate`).
- The route drops the tags `content`, `content:<type>` and `content:<type>:<slug>`. The next request fetches fresh content, so an edit shows up within seconds. As a safety net, cached lists expire after 5 minutes.
- The nonce list lives in the memory of the single Node process. A restart clears it; the timestamp window still limits a replay to 5 minutes.
- The "Preview" button on a draft opens `/library/preview?token=…`. The token names one item and expires after 10 minutes; it is signed with the same secret. It shows that one draft without the audience filter, so treat a preview link like a password.

## Checks

```bash
# On the server: anonymous callers get public items only (expect 2 public runbooks, 404 for an internal id)
curl -s 'http://127.0.0.1:8081/studio/index.php?rest_route=/wp/v2/nexus-runbooks'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/studio/xmlrpc.php   # 403
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/studio/            # 302 to /
```

`infrastructure/scripts/smoke-test` repeats these checks.

## Rotating secrets

- **Reader Application Password:** delete it in `wp user application-password list nexus-reader`, remove `NEXUS_WP_APP_PASSWORD` from `web.env`, run `setup-wordpress`, then restart `nexus-web`.
- **Webhook secret:** change it in both `/var/lib/wordpress/secrets.php` and `NEXUS_WP_WEBHOOK_SECRET` in `web.env`, then restart `nexus-web` and `php-fpm`.

## Not done on purpose

- Images inside content are served by Apache from `/studio/wp-content/uploads/`; the sanitizer keeps only that path. `images.remotePatterns` in `next.config.ts` is ready for `next/image` once pages need optimized images.
- WordPress core, plugin and theme updates are manual (a future maintenance task).
- WP-Cron is not triggered by visitors (the front end never loads); scheduled posts would need a timer.
