<?php

/**
 * Nexus Shortcuts
 *
 * Gmail-inspired keyboard shortcuts for Roundcube Webmail on YTL Nexus.
 * Spec: docs/spec/17-nexus-mail.md (MAIL-07).
 *
 * @version 1.0
 * @author YTL Nexus Team
 * @license GNU GPLv3+
 */
class nexus_shortcuts extends rcube_plugin
{
    public $task = 'mail';

    #[\Override]
    public function init()
    {
        $rcmail = rcmail::get_instance();
        if ($rcmail->task === 'mail' && ($rcmail->action === '' || $rcmail->action === 'show')) {
            $this->include_script('nexus_shortcuts.js');
        }
    }
}
