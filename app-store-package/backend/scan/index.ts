// 21 backend — Supabase Edge Function (Deno) — v21
// Security hardening: SSRF host blocklist on url mode, sanitized client errors,
// best-effort per-IP rate limiting, mode:delete_account, reduced scan_debug logging.
// Best-effort in-memory rate limiter (resets on cold start; blunts burst abuse).
const RL = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string, mode: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const caps: Record<string, number> = { signup: 4, url: 20, text: 20, calories: 30, barcode: 30, recipe: 30, chat: 40, delete_account: 5 };
  const cap = caps[mode] ?? 30;
  const key = ip + ':' + mode;
  const cur = RL.get(key);
  if (!cur || now - cur.t > windowMs) { RL.set(key, { n: 1, t: now }); return false; }
  cur.n++;
  return cur.n > cap;
}
// SSRF guard: block private, loopback, link-local and cloud-metadata hosts.
function hostBlocked(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a >= 224) return true;
  }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:')) return true;
  return false;
}
const RECIPE_JSON ='{"title":string,"description":string,"kcal_per_serving":int,"ingredients":[{"q":number,"u":string,"item":string}],"steps":[{"t":string,"s":{"temp":string,"time":string,"speed":string}}],"tags":[string]}';
const SYS: Record<string, string> = {
  calories: 'You are a nutrition analyst. From the meal photo, identify each food item with estimated portion. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Be realistic; round kcal to 5. Write all item names in English. Judge portion size from visible scale cues (plate diameter, cutlery, hands, packaging); when torn between two sizes pick the moderate one and state the assumed weight in portion (e.g. "1 bowl (~350 g)"). Nutrition values must be for ONE typical serving the person would eat, not the whole dish: if the photo shows a multi-serving item (whole cake, whole pizza, family platter), give values per single serving and say so in portion (e.g. "1 slice (1/12 of cake)"). If you see ANY food or drink, list it — only return an empty items array when there is clearly no food in the photo.',
  barcode: 'You identify packaged food from a photo of a barcode, nutrition label, or product package. Name the product (brand + name if visible) and give nutrition for one typical serving — use the printed nutrition label values when visible, otherwise realistic estimates for that product type. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Write all text in English. Only return an empty items array if no packaged product is visible.',
  recipe: 'You turn a dish or cookbook-page photo into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Write ALL text (title, description, ingredients, steps, tags) in English.',
  url: 'You extract a recipe from web page content (recipe sites, blogs, YouTube/TikTok/Instagram video pages — the recipe is often in the video description or JSON-LD). Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Adapt method steps to Thermomix style where sensible. Write ALL text in English. If the page content contains no full recipe but a dish IS clearly named (e.g. a video titled after a dish), write a sensible standard recipe for that named dish and add "estimated" to tags. Only if no dish is identifiable at all, return {"error":"no_recipe"}.',
  text: 'You turn pasted free-form recipe text (any language, any mess) into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Write ALL text in English. If the text contains no recipe at all, return {"error":"no_recipe"}.',
  chat: 'You are the cooking & nutrition assistant inside "21again", a food and wellness app. Answer briefly (2-5 sentences), practically and warmly: recipes, substitutions, techniques, portioning, macros, meal ideas. You provide general wellness information only — no medical diagnosis or treatment advice; suggest a professional for medical questions. Return ONLY JSON: {"reply":string}. Reply in English.',
  signup: 'internal',
};
async function dbg(row: Record<string, unknown>) {
  try {
    await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/scan_debug', {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (_e) { /* logging must never break the app */ }
}
function pageDigest(html: string, url: string): string {
  const parts: string[] = ['URL: ' + url];
  const title = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  if (title) parts.push('TITLE: ' + title[1].trim());
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description)["'][^>]+content=["']([^"']{0,500})["']/gi)) parts.push('META: ' + m[1]);
  let ld = '';
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { ld += m[1].trim() + '\n'; if (ld.length > 12000) break; }
  if (ld) parts.push('JSON-LD: ' + ld.slice(0, 12000));
  const yt = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (yt) { try { parts.push('VIDEO DESCRIPTION: ' + JSON.parse('"' + yt[1] + '"').slice(0, 6000)); } catch (_e) { parts.push('VIDEO DESCRIPTION: ' + yt[1].slice(0, 6000)); } }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
  parts.push('PAGE TEXT: ' + body.slice(0, 14000));
  return parts.join('\n\n').slice(0, 32000);
}
function findImage(html: string, base: string): string {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  let u = m ? m[1] : '';
  if (!u) {
    const ld = html.match(/"image"\s*:\s*"(https?:[^"]+)"/i) || html.match(/"image"\s*:\s*\[\s*"(https?:[^"]+)"/i);
    if (ld) u = ld[1];
  }
  if (!u) return '';
  try { u = new URL(u.replace(/&amp;/g, '&'), base).href; } catch (_e) { return ''; }
  return /^https?:\/\//i.test(u) ? u : '';
}
Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let mode = '', imageLen = 0;
  try {
    const { mode: m2, image, url, text: pasted, messages, email, password, access_token } = await req.json();
    mode = m2; imageLen = image ? image.length : 0;
    if (mode !== 'delete_account' && !SYS[mode]) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
    const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim();
    if (rateLimited(ip, mode)) return new Response(JSON.stringify({ error: 'Too many requests — please wait a minute and try again.' }), { status: 429, headers: cors });
    if (mode === 'delete_account') {
      const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const su = Deno.env.get('SUPABASE_URL')!;
      try {
        // identify the caller from their own access token
        const ur = await fetch(su + '/auth/v1/user', { headers: { apikey: srk, Authorization: 'Bearer ' + String(access_token || '') } });
        const uj = await ur.json();
        const uid = uj && uj.id;
        if (!uid) return new Response(JSON.stringify({ error: 'not signed in' }), { status: 401, headers: cors });
        await fetch(su + '/rest/v1/user_state?user_id=eq.' + uid, { method: 'DELETE', headers: { apikey: srk, Authorization: 'Bearer ' + srk, Prefer: 'return=minimal' } });
        const dr = await fetch(su + '/auth/v1/admin/users/' + uid, { method: 'DELETE', headers: { apikey: srk, Authorization: 'Bearer ' + srk } });
        await dbg({ mode, err: dr.ok ? '' : 'delete status ' + dr.status });
        return new Response(JSON.stringify({ ok: dr.ok }), { headers: { ...cors, 'content-type': 'application/json' } });
      } catch (e) { await dbg({ mode, err: String(e).slice(0, 200) }); return new Response(JSON.stringify({ error: 'could not delete' }), { status: 500, headers: cors }); }
    }
    if (mode === 'signup') {
      const em = String(email || '').trim().toLowerCase();
      const pw = String(password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers: cors });
      if (pw.length < 6) return new Response(JSON.stringify({ error: 'password too short' }), { status: 400, headers: cors });
      const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const r1 = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/admin/users', {
        method: 'POST',
        headers: { apikey: srk, Authorization: 'Bearer ' + srk, 'content-type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw, email_confirm: true }),
      });
      const j1 = await r1.json();
      if (j1 && j1.id) { await dbg({ mode, err: '', resp: 'signup ok' }); return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'content-type': 'application/json' } }); }
      const msg = String((j1 && (j1.msg || j1.message || j1.error_description || j1.error)) || 'could not create account');
      const friendly = /already|registered|exists/i.test(msg) ? 'That email already has an account — log in instead' : msg;
      await dbg({ mode, err: 'signup: ' + msg.slice(0, 300) });
      return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: cors });
    }
    if (mode === 'chat') {
      if (!Array.isArray(messages) || !messages.length) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      const msgs = messages.slice(-16).map((m3: { role: string; content: string }) => ({ role: m3.role === 'assistant' ? 'assistant' : 'user', content: String(m3.content || '').slice(0, 2000) }));
      const raw0 = Deno.env.get('ANTHROPIC_API_KEY') || '';
      const km0 = raw0.match(/sk-ant-[A-Za-z0-9_\-]+/);
      const r0 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': km0 ? km0[0] : raw0.trim(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-fable-5', max_tokens: 700, system: SYS.chat, messages: msgs }),
      });
      const j0 = await r0.json();
      if (j0.error) { await dbg({ mode, err: 'api: ' + JSON.stringify(j0.error).slice(0, 500) }); return new Response(JSON.stringify({ error: j0.error.message }), { status: 502, headers: cors }); }
      const t0 = (j0.content || []).find((c: { type: string }) => c.type === 'text')?.text ?? '{}';
      let reply: string;
      try { reply = JSON.parse(t0.slice(t0.indexOf('{'), t0.lastIndexOf('}') + 1)).reply || t0; } catch (_e) { reply = t0; }
      return new Response(JSON.stringify({ reply }), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    let userContent: unknown[];
    let imgUrl = '';
    if (mode === 'url') {
      if (!url || !/^https?:\/\//i.test(url)) return new Response(JSON.stringify({ error: 'bad url' }), { status: 400, headers: cors });
      try { const uu = new URL(url); if (hostBlocked(uu.hostname)) return new Response(JSON.stringify({ error: 'that link can’t be imported' }), { status: 400, headers: cors }); } catch (_e) { return new Response(JSON.stringify({ error: 'bad url' }), { status: 400, headers: cors }); }
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 15000);
      let html = '';
      try {
        const pr = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'accept-language': 'en' } });
        html = await pr.text();
      } finally { clearTimeout(tm); }
      if (!html) return new Response(JSON.stringify({ error: 'could not fetch that link' }), { status: 422, headers: cors });
      imgUrl = findImage(html, url);
      let extra = '';
      if (/youtube\.com|youtu\.be/i.test(url)) {
        try {
          const oe = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
          if (oe.ok) { const oj = await oe.json(); extra = 'VIDEO TITLE: ' + (oj.title || '') + '\nCHANNEL: ' + (oj.author_name || '') + '\n\n'; if (!imgUrl && oj.thumbnail_url) imgUrl = oj.thumbnail_url; }
        } catch (_e) { /* best-effort */ }
      } else if (/tiktok\.com/i.test(url)) {
        try {
          const oe = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url));
          if (oe.ok) { const oj = await oe.json(); extra = 'VIDEO TITLE: ' + (oj.title || '') + '\nCREATOR: ' + (oj.author_name || '') + '\n\n'; if (oj.thumbnail_url) imgUrl = oj.thumbnail_url; }
        } catch (_e) { /* best-effort */ }
      }
      // last-resort image patterns some sites (Instagram/Facebook) still expose in meta
      if (!imgUrl) {
        const m2 = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/"thumbnail_?url"\s*:\s*"(https?:[^"]+)"/i)
          || html.match(/"display_url"\s*:\s*"(https?:[^"]+)"/i);
        if (m2) { try { const u2 = new URL(m2[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'), url); if (/^https?:$/.test(u2.protocol) && !hostBlocked(u2.hostname)) imgUrl = u2.href; } catch (_e) { /* ignore */ } }
      }
      userContent = [{ type: 'text', text: extra + pageDigest(html.slice(0, 600000), url) + '\n\nExtract the recipe. JSON only.' }];
      imageLen = html.length;
    } else if (mode === 'text') {
      if (!pasted || !pasted.trim()) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      userContent = [{ type: 'text', text: pasted.slice(0, 20000) + '\n\nExtract the recipe. JSON only.' }];
      imageLen = pasted.length;
    } else {
      if (!image) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      userContent = [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: 'Analyse this photo. JSON only.' }];
    }
    const raw = Deno.env.get('ANTHROPIC_API_KEY') || '';
    const km = raw.match(/sk-ant-[A-Za-z0-9_\-]+/);
    const key = km ? km[0] : raw.trim();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-fable-5', max_tokens: 4000, system: SYS[mode], messages: [{ role: 'user', content: userContent }] }),
    });
    const j = await r.json();
    if (j.error) { await dbg({ mode, image_len: imageLen, err: 'api: ' + JSON.stringify(j.error).slice(0, 500) }); return new Response(JSON.stringify({ error: 'The AI service is busy — please try again.' }), { status: 502, headers: cors }); }
    const blk = (j.content || []).find((c: { type: string }) => c.type === 'text');
    const text = blk?.text ?? '{}';
    let parsed; try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch (_e) { await dbg({ mode, err: 'parse fail: ' + text.slice(0,200) }); return new Response(JSON.stringify({ error: 'Could not read a result — please try again.' }), { status: 502, headers: cors }); }
    if (imgUrl && !parsed.error) { try { const iu = new URL(imgUrl); if (!hostBlocked(iu.hostname) && (iu.protocol === 'http:' || iu.protocol === 'https:')) parsed.image_url = imgUrl; } catch (_e) {} }
    await dbg({ mode, image_len: imageLen, stop_reason: j.stop_reason });
    return new Response(JSON.stringify(parsed), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    await dbg({ mode, image_len: imageLen, err: String(e).slice(0, 500) });
    return new Response(JSON.stringify({ error: 'Something went wrong — please try again.' }), { status: 500, headers: cors });
  }
});
