# Nexus Webmail (Roundcube) at /webmail/. Installed as
# /etc/httpd/conf.d/webmail.inc by `setup-mail` and included from the
# 443 vhost in 00-ytl-nexus.conf. It is not named *.conf, so Apache does not load
# it on its own.
# Spec: docs/spec/17-nexus-mail.md (MAIL-06, MAIL-07).

# Served by Apache, never proxied to Next.js. Must be included before the
# catch-all ProxyPass line.
ProxyPass /webmail !

Alias /webmail/skins /var/www/webmail/skins
Alias /webmail/plugins /var/www/webmail/plugins
Alias /webmail/program/js /var/www/webmail/program/js
Alias /webmail/program/resources /var/www/webmail/program/resources
Alias /webmail /var/www/webmail/public_html

<Location "/webmail">
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Cache-Control "no-store"
</Location>

<Directory "/var/www/webmail/public_html">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    DirectoryIndex index.php
    <FilesMatch "\.php$">
        SetHandler "proxy:unix:/run/php-fpm/webmail.sock|fcgi://localhost"
    </FilesMatch>
</Directory>

<Directory "/var/www/webmail/skins">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>

<Directory "/var/www/webmail/plugins">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>

<Directory "/var/www/webmail/program">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>

# Protect sensitive Roundcube folders and files from web access:
<Directory "/var/www/webmail/config">
    Require all denied
</Directory>
<Directory "/var/www/webmail/temp">
    Require all denied
</Directory>
<Directory "/var/www/webmail/logs">
    Require all denied
</Directory>
<Directory "/var/www/webmail/installer">
    Require all denied
</Directory>
<Directory "/var/www/webmail/SQL">
    Require all denied
</Directory>
<Directory "/var/www/webmail/bin">
    Require all denied
</Directory>
<FilesMatch "^(README|INSTALL|LICENSE|CHANGELOG|UPGRADING|composer\..*)$">
    Require all denied
</FilesMatch>
