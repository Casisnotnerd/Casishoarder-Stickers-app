const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const token = process.env.SHARE_TOKEN || 'not-a-real-token';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let failed = false;
const fail = (m) => { console.error('FAIL', m); failed = true; };

(async () => {
  for (const t of ['artists', 'sheets', 'orders', 'order_lines', 'usages', 'share_links']) {
    const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers });
    const body = await r.json().catch(() => null);
    if (r.ok && Array.isArray(body) && body.length > 0) fail(`anonymous can read ${t}`);
    else console.log('ok  ', t, 'not readable anonymously');
  }

  const r = await fetch(`${url}/rest/v1/rpc/shared_collection`, {
    method: 'POST', headers, body: JSON.stringify({ p_token: token }),
  });
  const rows = await r.json();
  if (!r.ok) fail(`shared_collection error ${r.status} ${JSON.stringify(rows)}`);
  const allowed = ['artist', 'sheet_id', 'thumb_path', 'title'];
  for (const row of Array.isArray(rows) ? rows : []) {
    const keys = Object.keys(row).sort();
    if (JSON.stringify(keys) !== JSON.stringify(allowed)) fail(`shared row has fields ${keys.join(',')}`);
  }
  console.log('ok   shared_collection returned', Array.isArray(rows) ? rows.length : 0, 'rows with allowed fields only');
  process.exit(failed ? 1 : 0);
})();