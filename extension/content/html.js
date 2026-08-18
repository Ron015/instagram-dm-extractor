/**
 * HTML generator — loads template and replaces placeholders with chat data.
 * Shared execution context with other content scripts.
 */

/* exported ChatHtmlGenerator */
// eslint-disable-next-line no-var
var ChatHtmlGenerator = (() => {
  'use strict';

  const TEMPLATE_URL = chrome.runtime.getURL('template/chat_export.html');

  let cachedTemplate = null;

  async function loadTemplate() {
    if (cachedTemplate) return cachedTemplate;
    const response = await fetch(TEMPLATE_URL);
    cachedTemplate = await response.text();
    return cachedTemplate;
  }

  function getDisplayName(chatData) {
      if (chatData.chatWith) {
        return chatData.chatWith;
      }
    
      const participants = chatData.participants || [];
    
      for (const p of participants) {
        if (!p.toLowerCase().includes('me')) {
          return p.replace(/^_|_$/g, '');
        }
      }
    
      return 'Unknown';
    }

  function getAvatarInitials(chatData) {
      const displayName = getDisplayName(chatData);
    
      return displayName
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }

  function getStatusText(chatData) {
    const messages = chatData.messages || [];
    if (messages.length === 0) return 'No messages';
    
    const lastMsg = messages[messages.length - 1];
    const lastMsgDate = new Date(lastMsg.timestampUnix * 1000);
    const daysSince = Math.floor((Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince === 0) return 'Active now';
    if (daysSince === 1) return 'Active yesterday';
    if (daysSince < 7) return 'Active ' + daysSince + 'd ago';
    if (daysSince < 30) return 'Active ' + Math.floor(daysSince / 7) + 'w ago';
    return 'Active ' + daysSince + ' days ago';
  }

  async function generateHtml(chatData, stats) {
    const template = await loadTemplate();
    
    const displayName = getDisplayName(chatData);
    const avatarInitials = getAvatarInitials(chatData);
    const statusText = getStatusText(chatData);
    const messageCount = (chatData.messages || []).length;
    
    // The JSON is embedded inside a <script> block, so escape "<" to keep
    // attacker-controlled message text (e.g. "</script>") from breaking out
    // of the script context. < is valid in both JSON and JS source.
    const chatJson = JSON.stringify(chatData, null, 2).replace(/</g, '\\u003c');
    const statsJson = JSON.stringify(stats || {}).replace(/</g, '\\u003c');

    // Function replacers: a string replacement would interpret $&, $', $` etc.
    // inside chat data as replacement patterns and corrupt the output.
    return template
      .replace(/__AVATAR_INITIALS__/g, () => escapeHtml(avatarInitials))
      .replace(/__DISPLAY_NAME__/g, () => escapeHtml(displayName))
      .replace(/__STATUS_TEXT__/g, () => escapeHtml(statusText))
      .replace(/__MESSAGE_COUNT__/g, () => String(messageCount))
      .replace('__CHAT_JSON__', () => chatJson)
      .replace('__STATS_JSON__', () => statsJson);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { generateHtml, escapeHtml };
})();
