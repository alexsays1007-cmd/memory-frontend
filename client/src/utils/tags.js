/**
 * Tags parsing and grouping utility
 */

const LEGACY_MAPPING = {
  'facts': 'type:fact',
  'fact': 'type:fact',
  'observations': 'type:observation',
  'observation': 'type:observation',
  'milestones': 'type:milestone',
  'milestone': 'type:milestone',
  'note': 'type:note',
  'notes': 'type:note',
  'riven': 'person:riven',
  'velvy': 'person:velvy',
};

const VALID_PREFIXES = ['type', 'topic', 'person', 'source', 'mood', 'project'];

/**
 * Parses a comma-separated tag string into a structured array of tags
 * @param {string} tagsString 
 * @returns {Array<{raw: string, type: string, value: string, isTopic: boolean}>}
 */
export function parseTags(tagsString) {
  if (!tagsString) return [];
  
  const parts = tagsString.split(',').map(t => t.trim()).filter(Boolean);
  const parsed = [];
  const seen = new Set();
  
  for (const part of parts) {
    // Check legacy mapping first
    const mapped = LEGACY_MAPPING[part.toLowerCase()] || part;
    
    // De-duplicate
    const lowerMapped = mapped.toLowerCase();
    if (seen.has(lowerMapped)) continue;
    seen.add(lowerMapped);
    
    // Parse prefix:value
    const colonIdx = mapped.indexOf(':');
    let type = 'topic'; // Default to topic
    let value = mapped;
    
    if (colonIdx > 0) {
      const prefix = mapped.substring(0, colonIdx).toLowerCase();
      const val = mapped.substring(colonIdx + 1);
      
      if (VALID_PREFIXES.includes(prefix)) {
        type = prefix;
        value = val;
      }
    }
    
    parsed.push({
      raw: mapped, // Keep the mapped/original raw form for querying if needed
      type,
      value,
      isTopic: type === 'topic'
    });
  }
  
  return parsed;
}

/**
 * Extracts top N tags from an array of raw tag objects returned by backend or computed
 * @param {Array<{tag: string, count: number}> | Array<string>} backendTags 
 * @param {number} topN 
 * @returns {Array<string>}
 */
export function getTopTags(backendTags, topN = 8) {
  if (!backendTags || backendTags.length === 0) return [];
  
  let tagCounts = {};
  
  backendTags.forEach(t => {
    let rawTag = typeof t === 'string' ? t : t.tag || t.name || t.value;
    let count = typeof t === 'string' ? 1 : t.count || 1;
    if (!rawTag) return;
    
    const parsed = parseTags(rawTag);
    parsed.forEach(p => {
      // Group by the normalized value (for display in chips, we typically just use the value or raw)
      const key = p.type === 'topic' ? p.value : p.raw;
      tagCounts[key] = (tagCounts[key] || 0) + count;
    });
  });
  
  const sorted = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, topN);
    
  return sorted;
}

/**
 * Computes filter options (tags, agents, channels) dynamically from a list of memories.
 * Useful as a fallback when dedicated API endpoints are not available or return empty.
 * @param {Array} memories 
 * @returns {{ tags: Array<{tag: string, count: number}>, agents: Array<string>, channels: Array<string> }}
 */
export function getFilterOptionsFromMemories(memories) {
  if (!memories || memories.length === 0) {
    return { tags: [], agents: [], channels: [] };
  }

  const tagCounts = {};
  const agents = new Set();
  const channels = new Set();

  memories.forEach(m => {
    // Collect agents
    if (m.agent) agents.add(m.agent);
    
    // Collect channels
    if (m.channel) channels.add(m.channel);

    // Collect and count tags
    if (m.tags) {
      const parsed = parseTags(m.tags);
      parsed.forEach(p => {
        const key = p.raw;
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      });
    }
  });

  const tags = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));

  return {
    tags,
    agents: Array.from(agents).sort(),
    channels: Array.from(channels).sort(),
  };
}
