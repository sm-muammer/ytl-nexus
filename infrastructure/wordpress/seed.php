<?php
/**
 * Seeds initial content (LIB-09). Run through WP-CLI:
 *   wp eval-file seed.php /path/to/seed-content.json
 * Creates an item only when no post of that type and slug exists, so edits made
 * in Studio are never overwritten.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit;
}
$file = isset( $args[0] ) ? $args[0] : dirname( __FILE__ ) . '/seed-content.json';
$raw  = file_get_contents( $file );
$list = json_decode( (string) $raw, true );
if ( ! is_array( $list ) ) {
	WP_CLI::error( 'Seed file is not valid JSON.' );
}
$created = 0;
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
	update_post_meta( $id, 'nexus_audience', 'public' === $item['audience'] ? 'public' : 'internal' );
	update_post_meta( $id, 'nexus_business_unit', (string) $item['business_unit'] );
	update_post_meta( $id, 'nexus_related_service', (string) $item['related_service'] );
	update_post_meta( $id, 'nexus_source_url', (string) $item['source_url'] );
	++$created;
}
WP_CLI::success( "Seed: $created created, $skipped already present." );
