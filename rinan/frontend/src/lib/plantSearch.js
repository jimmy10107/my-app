import { PLANTS, plantById } from './plants.js';

export const SEARCH_LIMIT = 30;

export function matchingPlantings(rows, keyword) {
  const query = keyword.trim().toLocaleLowerCase();
  if (!query) return [];
  return rows.filter((row) => {
    const plant = plantById(row.plant_type);
    return [row.display_name, row.message, plant?.name, `${row.display_name || ''}的${plant?.name || ''}`]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function mergeSearchResults(rows, keyword, limit = SEARCH_LIMIT) {
  const query = keyword.trim().toLocaleLowerCase();
  const unique = new Map(rows.map((row) => [row.id, row]));
  const rank = (row) => {
    const name = (row.display_name || '').toLocaleLowerCase();
    return name === query ? 0 : name.includes(query) ? 1 : 2;
  };
  return matchingPlantings([...unique.values()], keyword)
    .sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

// 只查詢已公開紀錄；用欄位查詢處理使用者文字，避免拼接 PostgREST 過濾語法。
export async function searchPlantings(client, keyword) {
  const query = keyword.trim();
  if (!query) return [];
  const titledPlant = PLANTS.find((plant) => query.endsWith(`的${plant.name}`));
  const nameQuery = titledPlant ? query.slice(0, -(`的${titledPlant.name}`).length) : query;
  const pattern = (value) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;
  const base = () => client.from('plantings')
    .select('id, plant_type, display_name, message, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(SEARCH_LIMIT);
  const byName = base();
  if (titledPlant) {
    byName.eq('plant_type', titledPlant.id);
    if (nameQuery) byName.ilike('display_name', pattern(nameQuery));
  } else byName.ilike('display_name', pattern(query));
  const requests = [byName, base().ilike('message', pattern(query))];
  // 同名片段很多時，也保留較早的完整姓名命中。
  if (nameQuery) {
    const exactName = base().eq('display_name', nameQuery);
    if (titledPlant) exactName.eq('plant_type', titledPlant.id);
    requests.push(exactName);
  }
  const species = PLANTS.filter((plant) => plant.name.includes(query)).map((plant) => plant.id);
  if (species.length) requests.push(base().in('plant_type', species));
  const responses = await Promise.all(requests);
  if (responses.some((response) => response.error)) throw new Error('搜尋暫時無法連線');
  return mergeSearchResults(responses.flatMap((response) => response.data || []), query);
}
