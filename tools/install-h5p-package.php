<?php
/**
 * Install the libraries from an H5P package through the WordPress H5P plugin.
 *
 * Usage:
 *   wp eval-file tools/install-h5p-package.php -- /absolute/path/package.h5p
 *
 * This intentionally skips package content and uses the plugin's own validator
 * and storage implementation. It is intended for disposable local hosts only.
 */

if (!defined('WP_CLI') || !WP_CLI) {
  fwrite(STDERR, "Run this helper through WP-CLI.\n");
  exit(1);
}

if (empty($args[0])) {
  WP_CLI::error('Provide an absolute path to an .h5p package.');
}

$source = realpath($args[0]);
if ($source === false || !is_file($source)) {
  WP_CLI::error('Package does not exist or is not a regular file.');
}

if (strtolower(pathinfo($source, PATHINFO_EXTENSION)) !== 'h5p') {
  WP_CLI::error('Package must use the .h5p extension.');
}

$temporary = wp_tempnam(basename($source));
if ($temporary === false || !copy($source, $temporary)) {
  WP_CLI::error('Could not stage the package for H5P validation.');
}

wp_set_current_user(1);
$_FILES['h5p_file'] = array(
  'name' => basename($source),
  'type' => 'application/zip',
  'tmp_name' => $temporary,
  'error' => UPLOAD_ERR_OK,
  'size' => filesize($temporary),
);

$admin = H5P_Plugin_Admin::get_instance();
$admin->handle_upload(null, false);

$interface = H5P_Plugin::get_instance()->get_h5p_instance('interface');
$errors = $interface->getMessages('error');
if (!empty($errors)) {
  foreach ($errors as $message) {
    $text = is_object($message) && isset($message->message) ? $message->message : $message;
    WP_CLI::warning(wp_strip_all_tags((string) $text));
  }
  if (is_file($temporary)) {
    @unlink($temporary);
  }
  WP_CLI::error('The H5P plugin rejected the package. Review its validation messages.');
}

if (is_file($temporary)) {
  @unlink($temporary);
}

WP_CLI::success('Validated package and installed its libraries: ' . basename($source));
