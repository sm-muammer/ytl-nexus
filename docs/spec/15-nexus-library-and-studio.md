# Nexus Library and Nexus Studio (headless WordPress)

> **Purpose:** requirements for editable content: WordPress as the content store (Studio) and the Nexus pages that render it (Library, Story, FAQ, notices).
> **Audience:** builders and reviewers of Task 7. Studio access: separate WordPress Editor accounts. Library: Visitors see public items; Viewers and above see internal items.

## Summary

WordPress runs headless at `/studio`. Editors manage content in `wp-admin`; Next.js reads it through a server-only client and renders it in the Nexus design. WordPress never renders public pages itself.

## Content model (`nexus-content` plugin)

| Post type       | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| `runbook`       | Operational procedures per service                         |
| `faq`           | Questions and answers                                      |
| `announcement`  | Maintenance notices shown in Status                        |
| `story_chapter` | Project Story sections                                     |
| `tour_step`     | Nexus Tour steps                                           |
| `business_unit` | Approved YTL business units for a future Ecosystem section |
| `mail_help`     | Help shown on the `/mail` entry page                       |
| `service_note`  | Notes attached to services in Atlas                        |

Fields on every type: `audience` (`public` or `internal`), `business_unit` (optional), `related_service` (optional), `source_url` (required when the content makes a company claim). All types are REST-enabled.

## Requirements

| ID     | Requirement                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LIB-01 | Fresh WordPress install with WP-CLI (phar verified) at `/studio`, database `nexus_wordpress` with its own user, its own PHP-FPM pool and system user                             |
| LIB-02 | The WordPress frontend redirects to `/`. Only `wp-admin`, `wp-login.php` and `wp-json` are served                                                                                |
| LIB-03 | `wp-admin` and `wp-login.php` are restricted to allowed internal source IPs. The official Two Factor plugin is required for every account. XML-RPC and file editing are disabled |
| LIB-04 | Next.js reads WordPress through a `server-only` client using an Application Password, with fetch tags and ISR                                                                    |
| LIB-05 | Publishing, updating or deleting content sends a signed (HMAC) POST to `/api/revalidate`, which revalidates the matching tags. Replays and bad signatures are rejected           |
| LIB-06 | Draft preview uses a short-lived signed token                                                                                                                                    |
| LIB-07 | `/library` lists and renders runbooks, FAQs and notes filtered by the caller's role. Internal items never reach Visitors, through pages or APIs                                  |
| LIB-08 | WordPress media is served through `next/image` with `images.remotePatterns` restricted to the WordPress uploads path                                                             |
| LIB-09 | Initial content: platform overview, first runbooks and FAQs                                                                                                                      |

## Demo mode

Fixture content with the same shape; editing links are hidden.

## Acceptance criteria

- Contract tests with mocked WordPress JSON pass.
- Webhook signature and replay tests pass.
- Audience-leak test: a Visitor never receives an internal item.
- Editing a runbook in Studio updates Library within seconds.

## Related

[18 AI](18-nexus-ai.md) (indexes this content) · [22 Tour and Story](22-nexus-tour-story-and-demo-mode.md)
