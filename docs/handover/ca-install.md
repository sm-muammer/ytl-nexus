# Installing the YTL Nexus internal CA

> **Purpose:** how to make a computer trust `https://ytl-nexus.internal` (and the other Nexus names) and how to reach the site before DNS exists.
> **Audience:** the project owner on the Mac first, then anyone at YTL who opens the platform from their own machine.

The Nexus server uses a certificate signed by its own small certificate authority (CA), because a public CA will not issue certificates for internal names. Until a computer trusts that CA, browsers show a certificate warning. Installing the CA once removes the warning.

**What the CA can and cannot do.** It is limited by name constraints to `ytl-nexus.ytlcomms.my`, `ytl-nexus.internal`, `sn1lyvx1d0002.ytlcomms.my` and `10.26.64.164`. It cannot vouch for any other site, even if its key were stolen, on clients that enforce name constraints (macOS, Windows, Chrome, Firefox and Edge do). Its private key stays on the server in `/etc/pki/nexus-ca/private/` and is never distributed.

## Step 1: check the file

The public certificate is committed in the repository as `infrastructure/tls/nexus-internal-ca.crt`. Before installing it anywhere, confirm its fingerprint:

```bash
openssl x509 -in infrastructure/tls/nexus-internal-ca.crt -noout -fingerprint -sha256
```

It must print exactly:

```
sha256 Fingerprint=95:0A:A2:21:4F:BE:A8:2F:8F:78:78:BE:70:64:0F:23:89:13:BD:92:4F:6A:9F:CD:74:45:F4:C1:D2:74:FE:C3
```

If it differs, stop and ask the owner. The CA is valid until 2036-10-30.

## Step 2: install it

### macOS (Safari, Chrome, Edge)

1. Double-click `nexus-internal-ca.crt`. Keychain Access opens; choose the **System** keychain and click **Add**.
2. Open **Keychain Access**, select **System**, double-click **YTL Nexus Internal CA**, expand **Trust**, and set **When using this certificate** to **Always Trust**. Close the window and enter your password.

Or in Terminal:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain infrastructure/tls/nexus-internal-ca.crt
```

### Windows (Edge, Chrome)

1. Double-click the file, choose **Install Certificate**, **Local Machine**, then **Place all certificates in the following store**, **Trusted Root Certification Authorities**, and finish.
2. Restart the browser.

### Firefox (all systems)

Firefox keeps its own list. Open **Settings**, search for "certificates", choose **View Certificates**, **Authorities**, **Import**, select the file and tick **Trust this CA to identify websites**.

### Linux (command line tools)

```bash
sudo cp infrastructure/tls/nexus-internal-ca.crt /etc/pki/ca-trust/source/anchors/   # Rocky/RHEL
sudo update-ca-trust
```

On Debian or Ubuntu use `/usr/local/share/ca-certificates/` and `sudo update-ca-certificates`.

## Step 3: reach the site

`ytl-nexus.internal` and `ytl-nexus.ytlcomms.my` do not exist in DNS yet. Until YTL IT adds the second one ([`dns-request.md`](dns-request.md)), map a name to the server on your own computer.

**macOS or Linux:**

```bash
echo "10.26.64.164 ytl-nexus.internal" | sudo tee -a /etc/hosts
```

**Windows:** open Notepad as administrator, open `C:\Windows\System32\drivers\etc\hosts`, add the line `10.26.64.164 ytl-nexus.internal`, save.

Then open `https://ytl-nexus.internal/`. The address bar should show a closed padlock with no warning. `https://10.26.64.164/` and `https://sn1lyvx1d0002.ytlcomms.my/` also work once the CA is installed, because the certificate covers them.

## Check from a terminal

```bash
curl -s --cacert infrastructure/tls/nexus-internal-ca.crt \
  --resolve ytl-nexus.internal:443:10.26.64.164 https://ytl-nexus.internal/api/health/ready
```

Expected: `{"status":"ready","checks":{"app":"ok","database":"not-configured"}}`. (`database` says `not-configured` until Task 5.)

## Renewing the server certificate

The server certificate expires **2027-12-04**. A reminder belongs in the handover calendar for November 2027. To renew, as described in [`../operations/server-baseline.md`](../operations/server-baseline.md#tls): remove `/etc/pki/nexus-ca/server.crt` and `server.key` on the server, then run `infrastructure/scripts/server-run setup-tls` and `setup-apache`. Clients do not need to reinstall the CA.

## Removing the CA

macOS: open Keychain Access, System keychain, delete **YTL Nexus Internal CA**. Windows: `certmgr.msc` (or `certlm.msc`), Trusted Root Certification Authorities, delete it. Remove the hosts line too.

Related: [DNS request](dns-request.md) · [Server baseline](../operations/server-baseline.md) · [Security](../security.md)
