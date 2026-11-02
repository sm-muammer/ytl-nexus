# DNS request for YTL Nexus

> **Purpose:** a ready-to-send request asking YTL IT to create the DNS name for the platform.
> **Audience:** the project owner, who sends it to the YTL IT team that manages DNS for `ytlcomms.my`.

Nothing in the platform depends on this record to work today: the certificate already covers `ytl-nexus.ytlcomms.my`, and Apache already answers to it. Without the record, people reach the site only through a hosts-file entry ([`ca-install.md`](ca-install.md)) or by IP address.

## Message to send

> **Subject:** DNS A record request: ytl-nexus.ytlcomms.my
>
> Hello,
>
> Please create an internal DNS A record:
>
> - **Name:** `ytl-nexus.ytlcomms.my`
> - **Address:** `10.26.64.164`
> - **Server:** `sn1lyvx1d0002.ytlcomms.my` (the IT Infrastructure test server, Nexus Core 01)
> - **Scope:** internal only; no public or external record.
> - **TTL:** the default is fine.
>
> The server already serves HTTPS for this name with an internal certificate, so no change is needed on the server once the record exists. The project is YTL Nexus, an IT Infrastructure internship project; the contact is Muammer.
>
> Thank you.

## After the record exists

1. From a computer on the YTL network: `nslookup ytl-nexus.ytlcomms.my` must return `10.26.64.164`.
2. Open `https://ytl-nexus.ytlcomms.my/` on a computer that has the CA installed ([`ca-install.md`](ca-install.md)). No warning should appear.
3. The hosts-file line for `ytl-nexus.internal` can stay for demos or be removed.

The server hostname is still `sn1lyvx1d0002.ytlcomms.my`. Renaming it was offered and declined on 2026-11-02; the record above works without a rename.

Related: [Install the CA](ca-install.md) · [Server baseline](../operations/server-baseline.md)
