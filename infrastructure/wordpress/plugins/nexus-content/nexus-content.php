<?php
/**
 * Plugin Name: Nexus Content
 * Description: Content model for YTL Nexus (headless WordPress): post types, audience fields, audience-filtered REST, signed revalidation webhook and preview links.
 * Version: 1.0.0
 * Requires PHP: 8.1
 * Author: YTL Nexus
 * License: MIT
 *
 * Spec: docs/spec/15-nexus-library-and-studio.md. Operations: docs/operations/wordpress.md.
 *
 * Configuration (constants in wp-config.php, written by infrastructure/scripts/setup-wordpress):
 *   NEXUS_WEBHOOK_SECRET   shared HMAC secret (also NEXUS_WP_WEBHOOK_SECRET in web.env)
 *   NEXUS_REVALIDATE_URL   where to send the signed POST (http://127.0.0.1:3000/api/revalidate)
 *   NEXUS_PUBLIC_URL       public address of the Next.js site, used for preview links
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const NEXUS_CONTENT_TYPES = array(
	'runbook'       => array( 'rest' => 'nexus-runbooks', 'label' => 'Runbooks', 'single' => 'Runbook' ),
	'faq'           => array( 'rest' => 'nexus-faqs', 'label' => 'FAQs', 'single' => 'FAQ' ),
	'announcement'  => array( 'rest' => 'nexus-announcements', 'label' => 'Announcements', 'single' => 'Announcement' ),
	'story_chapter' => array( 'rest' => 'nexus-story-chapters', 'label' => 'Story chapters', 'single' => 'Story chapter' ),
	'tour_step'     => array( 'rest' => 'nexus-tour-steps', 'label' => 'Tour steps', 'single' => 'Tour step' ),
	'business_unit' => array( 'rest' => 'nexus-business-units', 'label' => 'Business units', 'single' => 'Business unit' ),
	'mail_help'     => array( 'rest' => 'nexus-mail-help', 'label' => 'Mail help', 'single' => 'Mail help item' ),
	'service_note'  => array( 'rest' => 'nexus-service-notes', 'label' => 'Service notes', 'single' => 'Service note' ),
);

const NEXUS_META_FIELDS = array(
	'audience'        => 'nexus_audience',
	'business_unit'   => 'nexus_business_unit',
	'related_service' => 'nexus_related_service',
	'source_url'      => 'nexus_source_url',
);

/** Capability that lets a user (or the server-to-server reader) see internal items through REST. */
const NEXUS_READ_INTERNAL = 'nexus_read_internal';

/* ------------------------------------------------------------------ post types */

add_action(
	'init',
	static function () {
		foreach ( NEXUS_CONTENT_TYPES as $type => $def ) {
			register_post_type(
				$type,
				array(
					'labels'              => array(
						'name'          => $def['label'],
						'singular_name' => $def['single'],
					),
					// Not public: never rendered by WordPress, never in the REST search endpoint.
					'public'              => false,
					'show_ui'             => true,
					'show_in_menu'        => true,
					'show_in_rest'        => true,
					'rest_base'           => $def['rest'],
					'supports'            => array( 'title', 'editor', 'excerpt', 'page-attributes', 'revisions' ),
					'menu_icon'           => 'dashicons-media-document',
					'capability_type'     => 'post',
					'map_meta_cap'        => true,
				)
			);
			foreach ( NEXUS_META_FIELDS as $meta_key ) {
				register_post_meta(
					$type,
					$meta_key,
					array(
						'type'              => 'string',
						'single'            => true,
						'show_in_rest'      => false,
						'sanitize_callback' => 'nexus_sanitize_meta',
						'auth_callback'     => static fn() => current_user_can( 'edit_posts' ),
					)
				);
			}
		}
	}
);

function nexus_sanitize_meta( $value, $meta_key ) {
	$value = is_string( $value ) ? trim( $value ) : '';
	if ( 'nexus_audience' === $meta_key ) {
		return 'public' === $value ? 'public' : 'internal';
	}
	if ( 'nexus_source_url' === $meta_key ) {
		return esc_url_raw( $value, array( 'https' ) );
	}
	if ( 'nexus_business_unit' === $meta_key || 'nexus_related_service' === $meta_key ) {
		return sanitize_title( $value );
	}
	return sanitize_text_field( $value );
}

function nexus_get_fields( int $post_id ): array {
	$audience = get_post_meta( $post_id, 'nexus_audience', true );
	return array(
		// Fail closed: a missing or unknown value is internal.
		'audience'        => 'public' === $audience ? 'public' : 'internal',
		'business_unit'   => (string) get_post_meta( $post_id, 'nexus_business_unit', true ),
		'related_service' => (string) get_post_meta( $post_id, 'nexus_related_service', true ),
		'source_url'      => (string) get_post_meta( $post_id, 'nexus_source_url', true ),
	);
}

/* ------------------------------------------------------------------ editor UI */

add_action(
	'add_meta_boxes',
	static function () {
		foreach ( array_keys( NEXUS_CONTENT_TYPES ) as $type ) {
			add_meta_box( 'nexus_fields', 'Nexus fields', 'nexus_render_meta_box', $type, 'side', 'high' );
		}
	}
);

function nexus_render_meta_box( WP_Post $post ): void {
	$f = nexus_get_fields( $post->ID );
	wp_nonce_field( 'nexus_fields_save', 'nexus_fields_nonce' );
	?>
	<p>
		<label for="nexus_audience"><strong>Who can read this?</strong></label><br>
		<select name="nexus_audience" id="nexus_audience">
			<option value="internal" <?php selected( $f['audience'], 'internal' ); ?>>Internal (signed-in Viewers and above)</option>
			<option value="public" <?php selected( $f['audience'], 'public' ); ?>>Public (everyone)</option>
		</select>
	</p>
	<p>
		<label for="nexus_business_unit">Business unit (optional)</label><br>
		<input type="text" class="widefat" name="nexus_business_unit" id="nexus_business_unit" value="<?php echo esc_attr( $f['business_unit'] ); ?>">
	</p>
	<p>
		<label for="nexus_related_service">Related service (optional)</label><br>
		<input type="text" class="widefat" name="nexus_related_service" id="nexus_related_service" value="<?php echo esc_attr( $f['related_service'] ); ?>">
	</p>
	<p>
		<label for="nexus_source_url">Source URL</label><br>
		<input type="url" class="widefat" name="nexus_source_url" id="nexus_source_url" value="<?php echo esc_attr( $f['source_url'] ); ?>">
		<span class="description">Required when the text makes a claim about a company. Use an official YTL or Yes page.</span>
	</p>
	<?php
}

add_action(
	'save_post',
	static function ( int $post_id, WP_Post $post ) {
		if ( ! isset( NEXUS_CONTENT_TYPES[ $post->post_type ] ) ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! isset( $_POST['nexus_fields_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nexus_fields_nonce'] ) ), 'nexus_fields_save' ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		foreach ( NEXUS_META_FIELDS as $meta_key ) {
			$raw = isset( $_POST[ $meta_key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $meta_key ] ) ) : '';
			update_post_meta( $post_id, $meta_key, nexus_sanitize_meta( $raw, $meta_key ) );
		}
	},
	10,
	2
);

/* ------------------------------------------------------------------ REST: fields and audience filter */

add_action(
	'rest_api_init',
	static function () {
		foreach ( array_keys( NEXUS_CONTENT_TYPES ) as $type ) {
			register_rest_field(
				$type,
				'nexus',
				array(
					'get_callback' => static fn( array $object ) => nexus_get_fields( (int) $object['id'] ),
					'schema'       => array( 'type' => 'object' ),
				)
			);
		}
	}
);

function nexus_can_read_internal(): bool {
	return current_user_can( NEXUS_READ_INTERNAL );
}

foreach ( array_keys( NEXUS_CONTENT_TYPES ) as $nexus_type ) {
	// Lists: anyone without the capability only receives public items (LIB-07).
	add_filter(
		"rest_{$nexus_type}_query",
		static function ( array $args ) {
			if ( nexus_can_read_internal() ) {
				return $args;
			}
			$meta_query   = isset( $args['meta_query'] ) && is_array( $args['meta_query'] ) ? $args['meta_query'] : array();
			$meta_query[] = array(
				'key'     => 'nexus_audience',
				'value'   => 'public',
				'compare' => '=',
			);
			$args['meta_query'] = $meta_query;
			return $args;
		}
	);
	// Single items: an internal item looks absent to anyone without the capability.
	add_filter(
		"rest_prepare_{$nexus_type}",
		static function ( $response, $post ) {
			if ( nexus_can_read_internal() ) {
				return $response;
			}
			if ( 'public' !== get_post_meta( $post->ID, 'nexus_audience', true ) ) {
				return new WP_Error( 'rest_post_invalid_id', 'Invalid post ID.', array( 'status' => 404 ) );
			}
			return $response;
		},
		10,
		2
	);
}

// No user enumeration, and no anonymous listing of site details beyond the index.
add_filter(
	'rest_endpoints',
	static function ( array $endpoints ) {
		if ( ! is_user_logged_in() ) {
			unset( $endpoints['/wp/v2/users'], $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );
		}
		return $endpoints;
	}
);

/* ------------------------------------------------------------------ roles */

register_activation_hook(
	__FILE__,
	static function () {
		add_role( 'nexus_reader', 'Nexus reader (server-to-server)', array( 'read' => true, NEXUS_READ_INTERNAL => true ) );
		foreach ( array( 'administrator', 'editor' ) as $role_name ) {
			$role = get_role( $role_name );
			if ( $role ) {
				$role->add_cap( NEXUS_READ_INTERNAL );
			}
		}
	}
);

/* ------------------------------------------------------------------ signed revalidation webhook (LIB-05) */

/** Events queued during a request are sent at shutdown, after meta has been saved. */
function nexus_queue_event( string $event, WP_Post $post ): void {
	static $queue = array();
	if ( ! isset( NEXUS_CONTENT_TYPES[ $post->post_type ] ) ) {
		return;
	}
	$queue[ $post->ID . ':' . $event ] = array(
		'event' => $event,
		'type'  => $post->post_type,
		'id'    => (int) $post->ID,
		'slug'  => $post->post_name,
	);
	static $hooked = false;
	if ( ! $hooked ) {
		$hooked = true;
		add_action(
			'shutdown',
			static function () use ( &$queue ) {
				foreach ( $queue as $payload ) {
					nexus_send_webhook( $payload );
				}
			}
		);
	}
}

function nexus_send_webhook( array $payload ): void {
	if ( ! defined( 'NEXUS_WEBHOOK_SECRET' ) || ! defined( 'NEXUS_REVALIDATE_URL' ) || strlen( NEXUS_WEBHOOK_SECRET ) < 32 ) {
		return;
	}
	$body      = wp_json_encode( $payload );
	$timestamp = (string) time();
	$nonce     = bin2hex( random_bytes( 16 ) );
	$signature = 'sha256=' . hash_hmac( 'sha256', $timestamp . '.' . $nonce . '.' . $body, NEXUS_WEBHOOK_SECRET );
	wp_remote_post(
		NEXUS_REVALIDATE_URL,
		array(
			'timeout'  => 3,
			'blocking' => false,
			'headers'  => array(
				'Content-Type'       => 'application/json',
				'X-Nexus-Timestamp'  => $timestamp,
				'X-Nexus-Nonce'      => $nonce,
				'X-Nexus-Signature'  => $signature,
			),
			'body'     => $body,
		)
	);
}

add_action(
	'transition_post_status',
	static function ( string $new_status, string $old_status, WP_Post $post ) {
		if ( 'publish' === $new_status ) {
			nexus_queue_event( 'publish' === $old_status ? 'update' : 'publish', $post );
		} elseif ( 'publish' === $old_status ) {
			// Unpublished: it must disappear from Library.
			nexus_queue_event( 'delete', $post );
		}
	},
	10,
	3
);
add_action(
	'save_post',
	static function ( int $post_id, WP_Post $post ) {
		if ( 'publish' === $post->post_status ) {
			nexus_queue_event( 'update', $post );
		}
	},
	99,
	2
);
add_action(
	'before_delete_post',
	static function ( int $post_id, WP_Post $post ) {
		nexus_queue_event( 'delete', $post );
	},
	10,
	2
);

/* ------------------------------------------------------------------ preview (LIB-06) */

/** Preview link: signed with the same secret, valid ten minutes. Verified by lib/content/preview.ts. */
add_filter(
	'preview_post_link',
	static function ( string $link, WP_Post $post ) {
		if ( ! isset( NEXUS_CONTENT_TYPES[ $post->post_type ] ) || ! defined( 'NEXUS_WEBHOOK_SECRET' ) || ! defined( 'NEXUS_PUBLIC_URL' ) ) {
			return $link;
		}
		$data = rtrim( strtr( base64_encode( wp_json_encode( array( 'type' => $post->post_type, 'id' => (int) $post->ID, 'exp' => ( time() + 600 ) * 1000 ) ) ), '+/', '-_' ), '=' );
		$sig  = rtrim( strtr( base64_encode( hash_hmac( 'sha256', 'preview.' . $data, NEXUS_WEBHOOK_SECRET, true ) ), '+/', '-_' ), '=' );
		return rtrim( NEXUS_PUBLIC_URL, '/' ) . '/library/preview?token=' . rawurlencode( $data . '.' . $sig );
	},
	10,
	2
);

/* ------------------------------------------------------------------ two-factor enforcement (LIB-03) */

/** Everyone who signs in to wp-admin must set up a Two Factor provider before doing anything else. */
add_action(
	'admin_init',
	static function () {
		if ( ! is_user_logged_in() || wp_doing_ajax() || wp_doing_cron() || ! class_exists( 'Two_Factor_Core' ) ) {
			return;
		}
		if ( Two_Factor_Core::is_user_using_two_factor() ) {
			return;
		}
		global $pagenow;
		if ( in_array( $pagenow, array( 'profile.php', 'admin-post.php', 'admin-ajax.php', 'async-upload.php' ), true ) ) {
			return;
		}
		wp_safe_redirect( admin_url( 'profile.php?nexus_2fa=required' ) );
		exit;
	}
);
add_action(
	'admin_notices',
	static function () {
		if ( isset( $_GET['nexus_2fa'] ) && class_exists( 'Two_Factor_Core' ) && ! Two_Factor_Core::is_user_using_two_factor() ) { // phpcs:ignore WordPress.Security.NonceVerification
			echo '<div class="notice notice-error"><p><strong>Set up two-factor authentication to continue.</strong> Scroll to "Two-Factor Options", enable an authenticator app, and save backup codes.</p></div>';
		}
	}
);

/* ------------------------------------------------------------------ hardening */

add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'xmlrpc_methods', '__return_empty_array' );
