<?php
/**
 * Headless theme (LIB-02): the WordPress front end redirects to the Nexus site root.
 * wp-admin, wp-login.php and wp-json do not use templates and are unaffected.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'template_redirect',
	static function () {
		$parts  = wp_parse_url( home_url() );
		$scheme = isset( $parts['scheme'] ) ? $parts['scheme'] : 'https';
		$host   = isset( $parts['host'] ) ? $parts['host'] : '';
		$port   = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		// Only ever redirect to this site's own host, never to a request value.
		wp_safe_redirect( $scheme . '://' . $host . $port . '/', 302 );
		exit;
	},
	0
);
