/**
 * HTML generator — loads template and replaces placeholders with chat data.
 * Shared execution context with other content scripts.
 */

/* exported ChatHtmlGenerator */
// eslint-disable-next-line no-var
var ChatHtmlGenerator = (() => {
  'use strict';

  // Template as a string (embedded for Chrome extension compatibility)
  // In a real implementation, you'd fetch this from a file, but for Chrome extensions
  // we need to embed it or use chrome.runtime.getURL
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
    
    // Prepare JSON strings
    const chatJson = JSON.stringify(chatData, null, 2);
    const statsJson = JSON.stringify(stats || {});
    
    // Replace all placeholders
    let html = template
      .replace(/__AVATAR_INITIALS__/g, avatarInitials)
      .replace(/__DISPLAY_NAME__/g, escapeHtml(displayName))
      .replace(/__STATUS_TEXT__/g, escapeHtml(statusText))
      .replace(/__MESSAGE_COUNT__/g, messageCount)
      .replace('__CHAT_JSON__', chatJson)
      .replace('__STATS_JSON__', statsJson);
    
    return html;
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