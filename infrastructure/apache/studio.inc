# Nexus Studio (headless WordPress) at /studio. Installed as
# /etc/httpd/conf.d/studio.inc by `setup-wordpress` and included from the
# 443 vhost and the loopback reader vhost in 00-ytl-nexus.conf. It is not named
# *.conf, so Apache does not load it on its own.
# Spec: docs/spec/15-nexus-library-and-studio.md (LIB-01 to LIB-03).

# Served by Apache, never proxied to Next.js. Must be included before the
# catch-all ProxyPass line.
ProxyPass /studio !
Alias /studio /var/www/studio

# wp-admin needs inline scripts and its own frames; everything stays same-origin.
<Location "/studio">
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    Header always set X-Frame-Options "SAMEORIGIN"
</Location>
<Directory "/var/www/studio">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    DirectoryIndex index.php
    # PHP-FPM must receive the Authorization header (Application Passwords).
    CGIPassAuth On
    # Pretty permalinks (/studio/wp-json/...) without .htaccess.
    FallbackResource /studio/index.php
    <FilesMatch "\.php$">
        SetHandler "proxy:unix:/run/php-fpm/wordpress.sock|fcgi://localhost"
    </FilesMatch>
</Directory>

# The admin area and everything WordPress loads only for it: allowed source
# addresses only (LIB-03). The list is edited in one place, below.
<LocationMatch "^/studio/(wp-admin(/|$)|wp-login\.php|wp-content/(?!uploads/))">
    Require ip 127.0.0.1 ::1 10.0.0.0/8
</LocationMatch>

# No XML-RPC, no PHP in uploads, no stray readme or config files.
<Files "xmlrpc.php">
    Require all denied
</Files>
<Directory "/var/www/studio/wp-content/uploads">
    <FilesMatch "\.(php|phtml|phar)$">
        Require all denied
    </FilesMatch>
</Directory>
<FilesMatch "^(readme\.html|license\.txt|wp-config\.php|wp-config-sample\.php|wp-cron\.php)$">
    Require all denied
</FilesMatch>
