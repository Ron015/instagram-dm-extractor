/**
 * Adversarial tests for the HTML export: attacker-controlled DM content must
 * not escape the <script> data block or corrupt the export.
 * Run: node tests/html-export-security.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Stub the extension APIs html.js touches, then load it.
globalThis.chrome = { runtime: { getURL: (p) => join(root, 'extension', p) } };
globalThis.fetch = async (p) => ({ text: async () => readFileSync(p, 'utf8') });
const src = readFileSync(join(root, 'extension/content/html.js'), 'utf8');
const ChatHtmlGenerator = new Function(`${src}; return ChatHtmlGenerator;`)();

const breakout = '</script><script>window.__pwned=1</script>';
const dollars = "replacement patterns: $& $' $` $$ $1";
const chatData = {
  chatWith: '<img src=x onerror=alert(1)> $&',
  participants: ['me', 'attacker'],
  messages: [
    { sender: 'attacker', text: breakout, timestampUnix: 1700000000 },
    { sender: 'me', text: dollars, timestampUnix: 1700000001 },
    {
      sender: 'attacker',
      text: 'reaction vector',
      timestampUnix: 1700000002,
      reactions: [{ user: '<b>evil</b>', emoji: '<script>x</script>' }],
    },
  ],
};

const template = readFileSync(join(root, 'extension/template/chat_export.html'), 'utf8');
const html = await ChatHtmlGenerator.generateHtml(chatData, { '<key>': "$' stats" });

// 1. No script-tag breakout: the export gains no </script> beyond the template's own.
const count = (s) => (s.match(/<\/script/gi) || []).length;
assert.equal(count(html), count(template), 'chat data introduced a </script> terminator');
assert.ok(!html.includes(breakout), 'raw breakout payload present in export');

// 2. Embedded JSON round-trips exactly (covers < escaping and $-patterns).
const m = html.match(/const chatData = ([\s\S]*?);\n\s*const extractionStats = ([\s\S]*?);\n/);
assert.ok(m, 'could not locate embedded chat JSON');
assert.deepEqual(JSON.parse(m[1]), chatData, 'chat data corrupted during embedding');
assert.deepEqual(JSON.parse(m[2]), { '<key>': "$' stats" }, 'stats corrupted during embedding');

// 3. Display name is HTML-escaped in the header, never raw.
assert.ok(!html.includes('<img src=x onerror'), 'unescaped display name in header');
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'escaped display name missing');

console.log('html-export-security: all assertions passed');
