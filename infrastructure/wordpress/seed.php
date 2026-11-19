<?php
/**
 * Seeds initial content (LIB-09). Run through WP-CLI:
 *   wp eval-file seed.php /path/to/seed-content.json
 *   wp eval-file seed.php /path/to/seed-content.json update-type=story_chapter
 * Creates an item only when no post of that type and slug exists, unless its
 * post type is explicitly passed via update-type=<post_type> (or
 * --update-type=<post_type>), so edits made in Studio are never overwritten
 * unintentionally.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit;
}

$file         = dirname( __FILE__ ) . '/seed-content.json';
$update_types = array();

$env_update_types = getenv( 'NEXUS_SEED_UPDATE_TYPES' );
if ( is_string( $env_update_types ) && '' !== trim( $env_update_types ) ) {
	foreach ( explode( ',', $env_update_types ) as $env_type ) {
		$trimmed = trim( $env_type );
		if ( '' !== $trimmed ) {
			$update_types[] = $trimmed;
		}
	}
}

$positional_file_set = false;
if ( isset( $args ) && is_array( $args ) ) {
	foreach ( $args as $arg ) {
		if ( ! is_string( $arg ) ) {
			continue;
		}
		if ( 0 === strpos( $arg, '--update-type=' ) ) {
			$val = trim( substr( $arg, strlen( '--update-type=' ) ) );
			if ( '' !== $val ) {
				$update_types[] = $val;
			}
			continue;
		}
		if ( 0 === strpos( $arg, 'update-type=' ) ) {
			$val = trim( substr( $arg, strlen( 'update-type=' ) ) );
			if ( '' !== $val ) {
				$update_types[] = $val;
			}
			continue;
		}
		if ( ! $positional_file_set ) {
			$file                = $arg;
			$positional_file_set = true;
		}
	}
}

$update_types = array_values( array_unique( $update_types ) );

$raw  = file_get_contents( $file );
$list = json_decode( (string) $raw, true );
if ( ! is_array( $list ) ) {
	WP_CLI::error( 'Seed file is not valid JSON.' );
}
function nexus_seed_write_meta( int $post_id, array $item ): void {
	update_post_meta( $post_id, 'nexus_audience', 'public' === $item['audience'] ? 'public' : 'internal' );
	update_post_meta( $post_id, 'nexus_business_unit', (string) $item['business_unit'] );
	update_post_meta( $post_id, 'nexus_related_service', (string) $item['related_service'] );
	update_post_meta( $post_id, 'nexus_source_url', (string) $item['source_url'] );
}

$created = 0;
$updated = 0;
$skipped = 0;
foreach ( $list as $item ) {
	$existing = get_posts(
		array(
			'post_type'   => $item['type'],
			'name'        => $item['slug'],
			'post_status' => 'any',
			'numberposts' => 1,
		)
	);
	if ( $existing ) {
		if ( in_array( $item['type'], $update_types, true ) ) {
			$existing_id = (int) $existing[0]->ID;
			$result      = wp_update_post(
				array(
					'ID'           => $existing_id,
					'post_title'   => $item['title'],
					'post_content' => $item['content'],
					'post_excerpt' => $item['excerpt'],
					'post_status'  => 'publish',
					'menu_order'   => (int) $item['menu_order'],
				),
				true
			);
			if ( is_wp_error( $result ) ) {
				WP_CLI::warning( 'Could not update ' . $item['slug'] . ': ' . $result->get_error_message() );
				continue;
			}
			nexus_seed_write_meta( $existing_id, $item );
			++$updated;
			continue;
		}
		++$skipped;
		continue;
	}
	$id = wp_insert_post(
		array(
			'post_type'    => $item['type'],
			'post_name'    => $item['slug'],
			'post_title'   => $item['title'],
			'post_content' => $item['content'],
			'post_excerpt' => $item['excerpt'],
			'post_status'  => 'publish',
			'menu_order'   => (int) $item['menu_order'],
		),
		true
	);
	if ( is_wp_error( $id ) ) {
		WP_CLI::warning( 'Could not create ' . $item['slug'] . ': ' . $id->get_error_message() );
		continue;
	}
	nexus_seed_write_meta( (int) $id, $item );
	++$created;
}
WP_CLI::success( "Seed: $created created, $updated updated, $skipped already present." );
