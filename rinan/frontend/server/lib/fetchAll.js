// Supabase（PostgREST）單次查詢最多只回 1000 筆，統計與 CSV 匯出要拿完整資料就分頁抓到空頁為止。
// buildQuery 每次都要回傳一個新的、已排序的查詢（排序固定，分頁才不會重複或漏抓）。
export async function fetchAll(buildQuery, pageSize = 1000) {
  const rows = [];
  for (;;) {
    const { data, error } = await buildQuery().range(rows.length, rows.length + pageSize - 1);
    if (error) return { data: null, error };
    if (data.length === 0) return { data: rows, error: null };
    rows.push(...data);
  }
}
