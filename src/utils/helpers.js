// helpers.js — utility functions

/**
 * Format a timestamp as "X hours/minutes ago" or absolute date
 */
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-SA', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format "Last updated X hours ago" from a stored timestamp
 */
export function lastUpdatedText(timestamp) {
  if (!timestamp) return 'Never';
  const hours = Math.floor((Date.now() - timestamp) / 3600000);
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Get Saudi Arabia current time (AST = UTC+3)
 */
export function getSaudiTime() {
  return new Date().toLocaleTimeString('en-SA', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Get Saudi date string
 */
export function getSaudiDate() {
  return new Date().toLocaleDateString('en-SA', {
    timeZone: 'Asia/Riyadh',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Truncate text to maxLength with ellipsis
 */
export function truncate(text, maxLength = 120) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Get fallback image for articles without images
 */
export function getFallbackImage(title = '') {
  const seed = encodeURIComponent(title.slice(0, 20) || 'news');
  return `https://picsum.photos/seed/${seed}/800/450`;
}

/**
 * Map a Gemini tag to a topic tab ID
 */
export const TAG_TO_TOPIC_ID = {
  'Vision 2030': 'vision2030',
  'AI & Robotics': 'ai',
  'NEOM & Giga Projects': 'neom',
  'Startups': 'startups',
  'Cybersecurity': 'cyber',
  'Telecom & 5G': 'telecom',
  'Gaming & Entertainment': 'gaming',
  'General': 'all',
};

/**
 * CSS class name combiner (simple cx utility)
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Stagger delay string for CSS animation-delay
 */
export function staggerDelay(index, baseMs = 100) {
  return `${index * baseMs}ms`;
}
