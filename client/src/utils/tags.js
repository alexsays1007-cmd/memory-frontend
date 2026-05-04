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
 * Extracts top N tags from an array of raw tag objects returned by backend
 * @param {Array<{tag: string, count: number}>} backendTags 
 * @param {number} topN 
 * @returns {Array<string>}
 */
export function getTopTags(backendTags, topN = 8) {
  if (!backendTags || backendTags.length === 0) return [];
  
  // backendTags might be array of strings or objects.
  // Assuming it returns objects like { tag: '...', count: 5 } based on standard tag grouping queries,
  // or just an array of strings if it's simpler.
  let tagCounts = {};
  
  backendTags.forEach(t => {
    let rawTag = typeof t === 'string' ? t : t.tag || t.name;
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
