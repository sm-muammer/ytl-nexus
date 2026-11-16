# Nexus Transfer: the SFTPGo WebClient at /files/ (TRF-06). Installed as
# /etc/httpd/conf.d/files.inc by `setup-sftpgo` and included from the 443 vhost
# in 00-ytl-nexus.conf, before the catch-all ProxyPass line. It is not named
# *.conf, so Apache does not load it on its own.
#
# Only the WebClient binding (127.0.0.1:8090) is published. The WebAdmin and the
# REST API are on 127.0.0.1:8091 and are never proxied (TRF-07); an Administrator
# reaches them through an SSH tunnel (docs/operations/sftp.md).

RedirectMatch 302 "^/files$" "/files/"

# Deny access to the WebAdmin interface (TRF-07) through the public proxy.
<Location "/files/web/admin">
    Require all denied
</Location>

ProxyPass        /files/ http://127.0.0.1:8090/files/ timeout=600
ProxyPassReverse /files/ http://127.0.0.1:8090/files/

# The portal has its own pages and scripts; everything stays same-origin.
# Uploads of any size are allowed here; each user's quota is the limit.
<Location "/files/">
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Cache-Control "no-store"
</Location>
