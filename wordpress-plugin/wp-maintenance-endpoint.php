<?php
/**
 * Plugin Name: wp-maintenance-endpoints
 * Description: Read-only REST endpoint exposing core, plugin and theme inventory for the WordPress Maintenance Skill.
 * Version: 1.3.0
 * Author: Agency Team
 */

if (!defined('ABSPATH')) {
    exit;
}

const AGENCY_MAINTENANCE_VERSION = '1.3.0';
const AGENCY_MAINTENANCE_CAP     = 'view_maintenance_status';
const AGENCY_MAINTENANCE_ROLE    = 'maintenance_auditor';

add_action('init', function () {
    if (!get_role(AGENCY_MAINTENANCE_ROLE)) {
        add_role(AGENCY_MAINTENANCE_ROLE, 'Maintenance Auditor', array(
            'read'                   => true,
            AGENCY_MAINTENANCE_CAP   => true,
        ));
    }
});

register_deactivation_hook(__FILE__, function () {
    remove_role(AGENCY_MAINTENANCE_ROLE);
});

add_action('rest_api_init', function () {
    register_rest_route('agency/v1', '/maintenance-status', array(
        'methods'             => 'GET',
        'callback'            => 'agency_get_maintenance_status',
        'permission_callback' => function () {
            return current_user_can(AGENCY_MAINTENANCE_CAP) || current_user_can('manage_options');
        },
    ));
});

function agency_last_checked($transient) {
    return (is_object($transient) && !empty($transient->last_checked))
        ? gmdate('c', (int) $transient->last_checked)
        : null;
}

function agency_update_source($entry) {
    if (isset($entry['id']) && strpos($entry['id'], 'w.org/') === 0) {
        return 'wordpress.org';
    }
    if (isset($entry['url']) && strpos($entry['url'], 'wordpress.org') !== false) {
        return 'wordpress.org';
    }
    return 'third-party';
}

function agency_update_state($transient, $key) {
    $unknown = array('update_available' => null, 'offered_version' => null, 'source' => 'unknown');
    if (!is_object($transient)) {
        return $unknown;
    }
    if (isset($transient->response[$key])) {
        $entry = (array) $transient->response[$key];
        return array(
            'update_available' => true,
            'offered_version'  => isset($entry['new_version']) ? $entry['new_version'] : null,
            'source'           => agency_update_source($entry),
        );
    }
    if (isset($transient->no_update[$key])) {
        return array(
            'update_available' => false,
            'offered_version'  => null,
            'source'           => agency_update_source((array) $transient->no_update[$key]),
        );
    }
    return $unknown;
}

function agency_get_maintenance_status() {
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $plugin_updates = get_site_transient('update_plugins');
    $theme_updates  = get_site_transient('update_themes');
    $core_updates   = get_site_transient('update_core');

    global $wp_version;

    $site_data = array(
        'url'               => home_url(),
        'checked_at'        => gmdate('c'),
        'installed_version' => $wp_version,
        'update_available'  => null,
        'latest_version'    => null,
        'core_last_check'   => agency_last_checked($core_updates),
        'endpoint_version'  => AGENCY_MAINTENANCE_VERSION,
    );
    if (is_object($core_updates) && !empty($core_updates->updates)) {
        $offer = $core_updates->updates[0];
        if (isset($offer->response) && $offer->response === 'upgrade') {
            $site_data['update_available'] = true;
            $site_data['latest_version']   = $offer->version;
        } elseif (isset($offer->response) && $offer->response === 'latest') {
            $site_data['update_available'] = false;
            $site_data['latest_version']   = $wp_version;
        }
    }

    $active_plugins = (array) get_option('active_plugins', array());
    $network_active = is_multisite() ? (array) get_site_option('active_sitewide_plugins', array()) : array();
    $plugin_checked = agency_last_checked($plugin_updates);
    $formatted_plugins = array();

    foreach (get_plugins() as $plugin_file => $plugin_data) {
        $state = agency_update_state($plugin_updates, $plugin_file);
        $formatted_plugins[] = array(
            'plugin_identifier' => $plugin_file,
            'name'              => $plugin_data['Name'],
            'installed_version' => $plugin_data['Version'],
            'active'            => in_array($plugin_file, $active_plugins, true) || isset($network_active[$plugin_file]),
            'update_available'  => $state['update_available'],
            'offered_version'   => $state['offered_version'],
            'source'            => $state['source'],
            'last_check'        => $plugin_checked,
        );
    }

    $current_theme = wp_get_theme();
    $formatted_themes = array();

    foreach (wp_get_themes() as $slug => $theme_obj) {
        $state = agency_update_state($theme_updates, $slug);
        $formatted_themes[] = array(
            'theme_slug'        => $slug,
            'name'              => $theme_obj->get('Name'),
            'installed_version' => $theme_obj->get('Version'),
            'active'            => ($current_theme->get_stylesheet() === $slug || $current_theme->get_template() === $slug),
            'update_available'  => $state['update_available'],
            'offered_version'   => $state['offered_version'],
        );
    }

    $response = rest_ensure_response(array(
        'site'    => $site_data,
        'plugins' => $formatted_plugins,
        'themes'  => $formatted_themes,
    ));
    $response->header('Cache-Control', 'no-store');
    return $response;
}
