/**
 * Nexus Shortcuts: Gmail-inspired keyboard navigation for Roundcube Webmail.
 * Spec: docs/spec/17-nexus-mail.md (MAIL-07).
 */
(function () {
  "use strict";

  var pendingPrefix = "";
  var prefixTimeout = null;
  var previousActiveElement = null;

  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName ? el.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return true;
    }
    return Boolean(el.isContentEditable);
  }

  function getHelpDialog() {
    var dialog = document.getElementById("nexus-shortcuts-dialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "nexus-shortcuts-dialog";
    dialog.setAttribute("aria-labelledby", "nexus-shortcuts-title");
    dialog.style.cssText =
      "border: 1px solid #1d2a47; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; " +
      "background-color: #0d1526; color: #f2f4f7; font-family: system-ui, -apple-system, sans-serif; " +
      "box-shadow: 0 10px 25px rgba(0,0,0,0.5);";

    dialog.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
      '  <h2 id="nexus-shortcuts-title" style="margin:0; font-size:1.15rem; font-weight:600; color:#00b4f0;">Keyboard shortcuts</h2>' +
      '  <button id="nexus-shortcuts-close" type="button" aria-label="Close" style="background:transparent; border:none; color:#a3aab5; font-size:1.4rem; cursor:pointer; line-height:1; padding:4px 8px;">&times;</button>' +
      "</div>" +
      '<table style="width:100%; border-collapse:collapse; font-size:0.9rem; margin-bottom:16px;">' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">c</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Compose new message</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">/</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Focus search</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">g</kbd> then <kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">i</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Go to Inbox</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">r</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Reply</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">a</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Reply all</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">f</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Forward</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">e</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Archive message</td></tr>' +
      '  <tr style="border-bottom:1px solid #1d2a47;"><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">#</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Delete message</td></tr>' +
      '  <tr><td style="padding:8px 0;"><kbd style="background:#16213a; border:1px solid #1d2a47; border-radius:4px; padding:2px 8px; font-family:monospace; color:#00b4f0;">?</kbd></td><td style="padding:8px 0; color:#f2f4f7;">Show this help</td></tr>' +
      "</table>" +
      '<div style="text-align:right;">' +
      '  <button id="nexus-shortcuts-done" type="button" style="background:#00b4f0; color:#070c19; border:none; border-radius:9999px; padding:6px 18px; font-weight:600; cursor:pointer;">Done</button>' +
      "</div>";

    document.body.appendChild(dialog);

    function closeDialog() {
      if (dialog.open) dialog.close();
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    }

    dialog.querySelector("#nexus-shortcuts-close").addEventListener("click", closeDialog);
    dialog.querySelector("#nexus-shortcuts-done").addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", function () {
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    });

    return dialog;
  }

  function showHelp() {
    previousActiveElement = document.activeElement;
    var dialog = getHelpDialog();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function handleKey(evt) {
    if (evt.isComposing || evt.ctrlKey || evt.metaKey || evt.altKey) {
      return;
    }
    if (isEditable(evt.target)) {
      return;
    }

    var key = evt.key;

    if (pendingPrefix === "g") {
      pendingPrefix = "";
      clearTimeout(prefixTimeout);
      if (key === "i" || key === "I") {
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("list", "INBOX");
          } catch (e) {
            // ignore
          }
        }
        return;
      }
    }

    if (key === "g" || key === "G") {
      pendingPrefix = "g";
      prefixTimeout = setTimeout(function () {
        pendingPrefix = "";
      }, 1000);
      return;
    }

    switch (key) {
      case "c":
      case "C":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("compose", "");
          } catch (e) {}
        }
        break;

      case "/":
        evt.preventDefault();
        var searchInput =
          document.getElementById("mailsearchbox") ||
          document.getElementById("s_text") ||
          document.querySelector('input[name="_q"]') ||
          document.querySelector('.searchbar input');
        if (searchInput && typeof searchInput.focus === "function") {
          searchInput.focus();
          if (typeof searchInput.select === "function") searchInput.select();
        }
        break;

      case "r":
      case "R":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("reply", "");
          } catch (e) {}
        }
        break;

      case "a":
      case "A":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("reply-all", "");
          } catch (e) {}
        }
        break;

      case "f":
      case "F":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("forward", "");
          } catch (e) {}
        }
        break;

      case "e":
      case "E":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            if (rcmail.commands && rcmail.commands["plugin.archive"]) {
              rcmail.command("plugin.archive", "");
            } else {
              rcmail.command("archive", "");
            }
          } catch (e) {}
        }
        break;

      case "#":
        evt.preventDefault();
        if (window.rcmail) {
          try {
            rcmail.command("delete", "");
          } catch (e) {}
        }
        break;

      case "?":
        evt.preventDefault();
        showHelp();
        break;
    }
  }

  document.addEventListener("keydown", handleKey, false);
})();
