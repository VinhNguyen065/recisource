// 21 backend — Supabase Edge Function (Deno) — v24
// v24: modes "subs" (ingredient substitutions that respect allergens/diet) and "autotag"
//      (tags, allergens, diet suitability, per-serving nutrition, meal, time) for recipes.
// v23: several photos per scan (images[] — one meal from different angles, several plates,
//      or the pages of one recipe), a fast vision model for calorie/label scans, tighter
//      token budgets, an upstream timeout, and latency logged to scan_debug.resp.
// v22: database-backed daily AI quotas (per signed-in user, or per IP for guests) via
//      public.ai_quota_take — survives cold starts and scales horizontally. The v21
//      in-memory limiter stays as a burst guard.
// v21: SSRF host blocklist on url mode, sanitized client errors, mode:delete_account.
// This file mirrors the live deployment on project czbetvehfqqfhggqlqfp.
const RL = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string, mode: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const caps: Record<string, number> = { signup: 4, resend: 4, url: 20, text: 20, calories: 30, barcode: 30, recipe: 30, chat: 40, subs: 30, autotag: 30, delete_account: 5 };
  const cap = caps[mode] ?? 30;
  const key = ip + ':' + mode;
  const cur = RL.get(key);
  if (!cur || now - cur.t > windowMs) { RL.set(key, { n: 1, t: now }); return false; }
  cur.n++;
  return cur.n > cap;
}
// Daily AI allowance. Signed-in members get a generous cap keyed by user id; guests a
// small one keyed by IP. Counted in Postgres so every function instance agrees.
const AI_CAP_USER = 150, AI_CAP_GUEST = 10;
const AI_MODES = ['calories', 'barcode', 'recipe', 'url', 'text', 'chat', 'subs', 'autotag'];
// Model per job: the calorie/label scans need a fast, accurate vision model; recipes need the
// strongest model because Thermomix settings must be exactly right.
const MODEL: Record<string, string> = { calories: 'claude-sonnet-5', barcode: 'claude-sonnet-5', subs: 'claude-sonnet-5', autotag: 'claude-sonnet-5' };
const DEFAULT_MODEL = 'claude-fable-5';
const MAX_TOKENS: Record<string, number> = { calories: 1200, barcode: 900, subs: 900, autotag: 700 };
const UPSTREAM_TIMEOUT_MS = 85_000;
async function quotaCheck(req: Request, ip: string): Promise<{ ok: boolean; signed: boolean }> {
  const su = Deno.env.get('SUPABASE_URL')!, srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  let key = 'ip:' + ip, signed = false;
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (tok && tok !== anon) {
    try {
      const ur = await fetch(su + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + tok } });
      if (ur.ok) { const uj = await ur.json(); if (uj && uj.id) { key = 'u:' + uj.id; signed = true; } }
    } catch (_e) { /* treat as guest */ }
  }
  try {
    const r = await fetch(su + '/rest/v1/rpc/ai_quota_take', { method: 'POST', headers: { apikey: srk, Authorization: 'Bearer ' + srk, 'content-type': 'application/json' }, body: JSON.stringify({ k: key, cap: signed ? AI_CAP_USER : AI_CAP_GUEST }) });
    if (!r.ok) return { ok: true, signed }; // database hiccup: fail open; the burst limiter still applies
    const j = await r.json();
    if (Math.random() < 0.02) fetch(su + '/rest/v1/rpc/ai_usage_prune', { method: 'POST', headers: { apikey: srk, Authorization: 'Bearer ' + srk, 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
    return { ok: j === true, signed };
  } catch (_e) { return { ok: true, signed }; }
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
// Real, cookable Thermomix (TM5/TM6) settings — appended to every recipe-conversion prompt for accuracy.
const TM_GUIDE = ' THERMOMIX ACCURACY — for every step fill s.temp, s.time, s.speed with REALISTIC settings a Thermomix can actually do; use "" for a field that does not apply. temp = a real Thermomix temperature in °C: one of 37,50,60,70,80,90,98,100,105,110,120 or "Varoma" (steaming); leave "" for room-temperature mixing/kneading/chopping. speed = "1"–"10" ("1"-"3" gentle stirring/sautéing, "4"-"7" mixing/emulsifying, "8"-"10" blending/pureeing/milling), OR "Reverse 1"/"Reverse 2" for stirring that must NOT chop (soups, chunky sauces, risotto, pasta, stews), OR "Knead" for bread/pizza/pasta dough, OR "Turbo" for short pulses. time = "M:SS" or "X min" / "X sec". Map cooking actions to settings: sauté onion/garlic → 120°C, 3-5 min, speed 1; simmer/reduce a sauce → 98-100°C, speed 1 or "Reverse 1"; chop onion/veg/herbs → speed 5, 3-5 sec; mince/puree/smooth sauce → speed 8-10; whip cream or egg whites → speed 3-4 with the butterfly whisk; knead dough → "Knead", 2 min; steam veg/fish/chicken → "Varoma", 15-30 min, speed 1; cook rice/grains → 100°C, speed 1 (Reverse for whole grains); melt chocolate/butter → 50-60°C, speed 2; grind spices/sugar/nuts/coffee → speed 10, 10-20 sec; grate hard cheese → speed 8, 8-10 sec; make stock/soup then blend → cook 100°C speed 1, then blend speed 8-10. Add a dedicated step "Insert the butterfly whisk" before whipping and "Fit the Varoma / simmering basket" before steaming, and remove the butterfly before blending. For a purely manual action (shaping, chilling, resting, plating, or OVEN baking — a Thermomix cannot bake), leave s = {} and say so in the text (e.g. "Bake in a conventional oven at 200°C for 20 min"). Give a Thermomix cook accurate settings they can dial in without guessing.';
const SYS: Record<string, string> = {
  calories: 'You are a nutrition analyst. From the meal photo(s), identify each food item with estimated portion. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Be realistic; round kcal to 5. Write all item names in English. Judge portion size from visible scale cues (plate diameter, cutlery, hands, packaging); when torn between two sizes pick the moderate one and state the assumed weight in portion (e.g. "1 bowl (~350 g)"). Nutrition values must be for ONE typical serving the person would eat, not the whole dish: if the photo shows a multi-serving item (whole cake, whole pizza, family platter), give values per single serving and say so in portion (e.g. "1 slice (1/12 of cake)"). Name each food specifically (e.g. "grilled chicken thigh", "jasmine rice") rather than generically, and do not invent foods that are not visible. If you see ANY food or drink, list it — only return an empty items array when there is clearly no food in the photo.',
  barcode: 'You identify packaged food from a photo of a barcode, nutrition label, or product package. Name the product (brand + name if visible) and give nutrition for one typical serving — use the printed nutrition label values when visible, otherwise realistic estimates for that product type. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Write all text in English. Only return an empty items array if no packaged product is visible.',
  recipe: 'You turn a dish or cookbook-page photo into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Write ALL text (title, description, ingredients, steps, tags) in English.' + TM_GUIDE,
  url: 'You extract a recipe from web page content (recipe sites, blogs, YouTube/TikTok/Instagram video pages — the recipe is often in the video description or JSON-LD). Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Adapt method steps to Thermomix style where sensible. Write ALL text in English. If the page content contains no full recipe but a dish IS clearly named (e.g. a video titled after a dish), write a sensible standard recipe for that named dish and add "estimated" to tags. Only if no dish is identifiable at all, return {"error":"no_recipe"}.' + TM_GUIDE,
  text: 'You turn pasted free-form recipe text (any language, any mess) into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Capture the COMPLETE recipe: include EVERY ingredient with its exact quantity and unit — the main dish AND every sauce, dressing, marinade, spice mix, side dish, garnish and topping. Do not omit, merge, or summarise components. If a sauce or side has its own ingredient list, include all of those too. List up to 30 ingredients. Write the FULL method as clear ordered steps (up to 20), keeping each step complete with its own temperatures, times and quantities; include steps for making any sauces and sides. Write ALL text in English. If the text contains no recipe at all, return {"error":"no_recipe"}.' + TM_GUIDE,
  chat: 'You are the cooking & nutrition assistant inside "21again", a food and wellness app. Answer briefly (2-5 sentences), practically and warmly: recipes, substitutions, techniques, portioning, macros, meal ideas. You provide general wellness information only — no medical diagnosis or treatment advice; suggest a professional for medical questions. Return ONLY JSON: {"reply":string}. Reply in English.',
  subs: 'You are a practical home-cook assistant. The user is missing one ingredient for a recipe. Suggest 3 substitutions that a normal home kitchen or supermarket would have, best first. Respect every listed allergen and diet constraint absolutely (never suggest an ingredient that contains a listed allergen). Return ONLY JSON: {"swaps":[{"item":string,"swap":string,"ratio":string,"why":string}]} where item is the missing ingredient, swap the replacement, ratio like "1:1" or "use half", why one short sentence on taste/texture. Write in English.',
  autotag: 'You are a nutrition and recipe cataloguing assistant. Given a recipe (title, ingredients with quantities, steps, servings), return ONLY JSON: {"tags":[string],"diet":[string],"allergens":[string],"kcal_per_serving":int,"p":int,"f":int,"c":int,"meal":string,"time":int}. tags: 2 to 5 from exactly this list: Healthy, Quick, One-pot, Meal prep, Family, Kids, Budget, High-protein, Low-carb, Comfort, Dessert, Soup, Salad, Rice, Pasta, Chicken, Beef, Pork, Lamb, Fish, Seafood, Vegetarian, Vegan, Baking, Breakfast, Snack, Drinks. diet: any of vegetarian, vegan, gluten-free, dairy-free, nut-free, egg-free, low-carb, high-protein that the recipe genuinely satisfies. allergens: any of gluten, dairy, eggs, tree nuts, peanuts, shellfish, soy, sesame, fish present in the ingredients. kcal_per_serving and p/f/c grams per serving, realistic estimates from the quantities divided by servings. meal: one of Breakfast, Lunch, Dinner, Snack. time: total minutes. Write in English.',
  signup: 'internal',
  resend: 'internal',
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
    const { mode: m2, image, images, url, text: pasted, messages, email, password, access_token, recipe, missing, diet, avoid } = await req.json();
    mode = m2; imageLen = image ? image.length : 0;
    if (mode !== 'delete_account' && !SYS[mode]) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
    const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim();
    if (rateLimited(ip, mode)) return new Response(JSON.stringify({ error: 'Too many requests — please wait a minute and try again.' }), { status: 429, headers: cors });
    if (AI_MODES.includes(mode)) {
      const q = await quotaCheck(req, ip);
      if (!q.ok) return new Response(JSON.stringify({ error: q.signed ? 'You’ve used today’s AI allowance (' + AI_CAP_USER + ' requests). It resets at midnight UTC.' : 'Guest limit reached for today — create a free account for a much bigger AI allowance.' }), { status: 429, headers: cors });
    }
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
      // Public signup endpoint → sends the confirmation email (project has mailer_autoconfirm=false).
      // The user is created UNCONFIRMED and cannot obtain a token until they click the email link.
      const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
      const site = 'https://vinhnguyen065.github.io/recisource/';
      const r1 = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/signup', {
        method: 'POST',
        headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'content-type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw, options: { email_redirect_to: site }, email_redirect_to: site }),
      });
      const j1 = await r1.json();
      // GoTrue returns the created user (id present) or, when confirmation is required, a user object with
      // confirmation_sent_at / no session. Either way, a 200 with a user/id means the confirmation email is on its way.
      if (r1.ok && j1 && (j1.id || j1.user || j1.confirmation_sent_at || j1.email)) {
        const confirmed = !!(j1.confirmed_at || (j1.user && j1.user.confirmed_at));
        await dbg({ mode, err: '', resp: 'signup ok, confirmed=' + confirmed });
        return new Response(JSON.stringify({ ok: true, needsConfirm: !confirmed }), { headers: { ...cors, 'content-type': 'application/json' } });
      }
      const msg = String((j1 && (j1.msg || j1.message || j1.error_description || j1.error)) || 'could not create account');
      const friendly = /already|registered|exists/i.test(msg) ? 'That email already has an account — log in instead' : msg;
      await dbg({ mode, err: 'signup: ' + msg.slice(0, 300) });
      return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: cors });
    }
    if (mode === 'resend') {
      const em = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers: cors });
      const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
      const site = 'https://vinhnguyen065.github.io/recisource/';
      const rr = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/resend', {
        method: 'POST',
        headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'signup', email: em, options: { email_redirect_to: site } }),
      });
      await dbg({ mode, err: rr.ok ? '' : 'resend failed', resp: 'resend ' + rr.status });
      return new Response(JSON.stringify({ ok: rr.ok }), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    if (mode === 'chat') {
      if (!Array.isArray(messages) || !messages.length) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      const msgs = messages.slice(-16).map((m3: { role: string; content: string }) => ({ role: m3.role === 'assistant' ? 'assistant' : 'user', content: String(m3.content || '').slice(0, 2000) }));
      const raw0 = Deno.env.get('ANTHROPIC_API_KEY') || '';
      const km0 = raw0.match(/sk-ant-[A-Za-z0-9_\-]+/);
      const r0 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': km0 ? km0[0] : raw0.trim(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: 700, system: SYS.chat, messages: msgs }),
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
    let shots = 0;
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
    } else if (mode === 'subs' || mode === 'autotag') {
      const rec = recipe && typeof recipe === 'object' ? recipe : null;
      if (!rec || !rec.title) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      const payload: Record<string, unknown> = { recipe: { title: String(rec.title).slice(0, 200), servings: rec.servings || 4, ingredients: (Array.isArray(rec.ingredients) ? rec.ingredients : []).slice(0, 40).map((s: unknown) => String(s).slice(0, 120)), steps: (Array.isArray(rec.steps) ? rec.steps : []).slice(0, 20).map((s: unknown) => String(s).slice(0, 300)) } };
      if (mode === 'subs') { payload.missing = String(missing || '').slice(0, 80); payload.diet = (Array.isArray(diet) ? diet : []).slice(0, 10).map((s: unknown) => String(s).slice(0, 40)); payload.avoid_allergens = (Array.isArray(avoid) ? avoid : []).slice(0, 12).map((s: unknown) => String(s).slice(0, 40)); if (!payload.missing) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors }); }
      const txt = JSON.stringify(payload);
      userContent = [{ type: 'text', text: txt + '\n\nJSON only.' }];
      imageLen = txt.length;
    } else if (mode === 'text') {
      if (!pasted || !pasted.trim()) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      userContent = [{ type: 'text', text: pasted.slice(0, 20000) + '\n\nExtract the recipe. JSON only.' }];
      imageLen = pasted.length;
    } else {
      // One photo, or up to four: the same meal from other angles, several plates eaten together,
      // or the pages of one recipe. Base64 JPEG, downscaled to 900 px by the client.
      const list: string[] = (Array.isArray(images) ? images : []).filter((x: unknown) => typeof x === 'string' && x.length > 100).slice(0, 4);
      if (!list.length && typeof image === 'string' && image.length > 100) list.push(image);
      if (!list.length) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
      shots = list.length;
      imageLen = list.reduce((a, s) => a + s.length, 0);
      const blocks = list.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
      const note = shots > 1
        ? (mode === 'recipe'
          ? 'These ' + shots + ' photos are pages or parts of ONE recipe — combine them into a single complete recipe. '
          : 'These ' + shots + ' photos show one meal from different angles, or several plates eaten together. List every distinct food ONCE with the portion totalled across the photos; never count the same item twice because it appears in two photos. ')
        : '';
      userContent = [...blocks, { type: 'text', text: note + 'Analyse ' + (shots > 1 ? 'these photos' : 'this photo') + '. JSON only.' }];
    }
    const raw = Deno.env.get('ANTHROPIC_API_KEY') || '';
    const km = raw.match(/sk-ant-[A-Za-z0-9_\-]+/);
    const key = km ? km[0] : raw.trim();
    const model = MODEL[mode] || DEFAULT_MODEL;
    const started = Date.now();
    const ac = new AbortController();
    const at = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
    let r: Response;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS[mode] || 4000, system: SYS[mode], messages: [{ role: 'user', content: userContent }] }),
        signal: ac.signal,
      });
    } catch (e) {
      await dbg({ mode, image_len: imageLen, err: 'upstream: ' + String(e).slice(0, 200), resp: 'ms=' + (Date.now() - started) + ' model=' + model + ' n=' + shots });
      return new Response(JSON.stringify({ error: 'The AI took too long — please try again.' }), { status: 504, headers: cors });
    } finally { clearTimeout(at); }
    const j = await r.json();
    const ms = Date.now() - started;
    if (j.error) { await dbg({ mode, image_len: imageLen, err: 'api: ' + JSON.stringify(j.error).slice(0, 500), resp: 'ms=' + ms + ' model=' + model }); return new Response(JSON.stringify({ error: 'The AI service is busy — please try again.' }), { status: 502, headers: cors }); }
    const blk = (j.content || []).find((c: { type: string }) => c.type === 'text');
    const text = blk?.text ?? '{}';
    let parsed; try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch (_e) { await dbg({ mode, err: 'parse fail: ' + text.slice(0,200), resp: 'ms=' + ms + ' model=' + model }); return new Response(JSON.stringify({ error: 'Could not read a result — please try again.' }), { status: 502, headers: cors }); }
    if (imgUrl && !parsed.error) { try { const iu = new URL(imgUrl); if (!hostBlocked(iu.hostname) && (iu.protocol === 'http:' || iu.protocol === 'https:')) parsed.image_url = imgUrl; } catch (_e) {} }
    await dbg({ mode, image_len: imageLen, stop_reason: j.stop_reason, resp: 'ms=' + ms + ' model=' + model + ' n=' + shots + ' items=' + (Array.isArray(parsed.items) ? parsed.items.length : '-') });
    return new Response(JSON.stringify(parsed), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    await dbg({ mode, image_len: imageLen, err: String(e).slice(0, 500) });
    return new Response(JSON.stringify({ error: 'Something went wrong — please try again.' }), { status: 500, headers: cors });
  }
});
