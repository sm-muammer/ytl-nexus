<?php
/**
 * Plugin Name: Nexus Studio SSO
 * Description: Seamless single sign-on from YTL Nexus main session. Eliminates separate WordPress accounts and passwords for admins and operators.
 * Version: 1.0.0
 * Author: YTL Nexus
 * License: MIT
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Extracts the session token from the browser cookie.
 * Matches both plain and __Secure- cookies for nexus.session_token and better-auth.session_token.
 */
function nexus_get_session_token_from_cookie(): string {
	foreach ( $_COOKIE as $key => $val ) {
		if ( preg_match( '/^(?:__Secure-)?(?:nexus|better-auth)[._]session_token$/', $key ) ) {
			if ( is_string( $val ) && ! empty( $val ) ) {
				$trimmed = trim( $val );
				if ( str_contains( $trimmed, '.' ) ) {
					$parts = explode( '.', $trimmed, 2 );
					return $parts[0];
				}
				return $trimmed;
			}
		}
	}
	return '';
}

/**
 * Validates the YTL Nexus session in ytl_nexus.session and returns the corresponding WordPress user ID.
 * Auto-provisions or syncs the WordPress user role (admin -> administrator, operator -> editor).
 */
function nexus_sso_authenticate( $user_id = 0 ) {
	if ( ! empty( $user_id ) ) {
		return $user_id;
	}

	$token = nexus_get_session_token_from_cookie();
	if ( empty( $token ) ) {
		return false;
	}

	global $wpdb;
	$row = $wpdb->get_row(
		$wpdb->prepare(
			"SELECT s.userId, s.expiresAt, u.email, u.name, u.role
			 FROM ytl_nexus.session s
			 JOIN ytl_nexus.user u ON s.userId = u.id
			 WHERE s.token = %s",
			$token
		)
	);

	if ( ! $row ) {
		return false;
	}

	$expires = strtotime( $row->expiresAt );
	if ( false !== $expires && $expires < time() ) {
		return false;
	}

	// Access control: only Administrators and Operators access Nexus Studio.
	if ( ! in_array( $row->role, array( 'admin', 'operator' ), true ) ) {
		return false;
	}

	$email = strtolower( trim( $row->email ) );
	$wp_user = get_user_by( 'email', $email );
	$target_role = ( 'admin' === $row->role ) ? 'administrator' : 'editor';

	if ( ! $wp_user ) {
		$username = sanitize_user( current( explode( '@', $email ) ), true );
		if ( username_exists( $username ) ) {
			$username .= '_' . substr( md5( $email ), 0, 4 );
		}
		$random_password = wp_generate_password( 32, true );
		$new_id = wp_insert_user(
			array(
				'user_login'   => $username,
				'user_email'   => $email,
				'display_name' => ! empty( $row->name ) ? $row->name : $username,
				'user_pass'    => $random_password,
				'role'         => $target_role,
			)
		);
		if ( is_wp_error( $new_id ) ) {
			return false;
		}
		$wp_user = get_user_by( 'id', $new_id );
	} else {
		if ( ! in_array( $target_role, (array) $wp_user->roles, true ) ) {
			$wp_user->set_role( $target_role );
		}
	}

	return (int) $wp_user->ID;
}

// Override pluggable function wp_validate_auth_cookie early (in mu-plugins).
if ( ! function_exists( 'wp_validate_auth_cookie' ) ) {
	function wp_validate_auth_cookie( $cookie = '', $scheme = '' ) {
		$sso_user = nexus_sso_authenticate();
		if ( $sso_user ) {
			return $sso_user;
		}
		$cookie_elements = wp_parse_auth_cookie( $cookie, $scheme );
		if ( ! $cookie_elements ) {
			return false;
		}
		$username   = $cookie_elements['username'];
		$expiration = $cookie_elements['expiration'];
		$user       = get_user_by( 'login', $username );
		if ( ! $user ) {
			return false;
		}
		$pass_frag = substr( $user->user_pass, 8, 4 );
		$key       = wp_hash( $username . '|' . $pass_frag . '|' . $expiration, $scheme );
		$hash      = hash_hmac( 'sha256', $username . '|' . $expiration, $key );
		if ( ! hash_equals( $hash, $cookie_elements['hmac'] ) ) {
			return false;
		}
		if ( $expiration < time() ) {
			return false;
		}
		return $user->ID;
	}
}

// Ensure determine_current_user resolves the SSO user immediately.
add_filter( 'determine_current_user', 'nexus_sso_authenticate', 1 );

// In Two_Factor_Core, satisfy 2FA requirement for SSO sessions since 2FA was already completed in YTL Nexus.
add_filter(
	'two_factor_is_required_for_user',
	function( $is_required, $user ) {
		$token = nexus_get_session_token_from_cookie();
		if ( ! empty( $token ) ) {
			return true;
		}
		return $is_required;
	},
	10,
	2
);

// If unauthenticated or accessing wp-login.php, route seamlessly to YTL Nexus sign-in.
add_action(
	'login_init',
	function() {
		$user_id = nexus_sso_authenticate();
		if ( $user_id ) {
			$redirect = ! empty( $_REQUEST['redirect_to'] ) ? $_REQUEST['redirect_to'] : admin_url();
			wp_safe_redirect( $redirect );
			exit;
		}
		$next = ! empty( $_REQUEST['redirect_to'] ) ? $_REQUEST['redirect_to'] : admin_url();
		$signin_url = 'https://ytl-nexus.ytlcomms.my/signin?next=' . rawurlencode( $next );
		wp_redirect( $signin_url );
		exit;
	}
);
