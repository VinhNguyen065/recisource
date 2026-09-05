// 21 scanning backend — Supabase Edge Function (Deno)
// POST /scan  { mode: "calories"|"barcode"|"recipe", image: "<base64 jpeg>" }
//            { mode: "url",  url: "https://…any recipe page / YouTube / social link" }
//            { mode: "text", text: "<pasted recipe text>" }
// Secrets required: ANTHROPIC_API_KEY
// This file mirrors live v17 on project czbetvehfqqfhggqlqfp (errors log to scan_debug via service role).
const RECIPE_JSON = '{"title":string,"description":string,"kcal_per_serving":int,"ingredients":[{"q":number,"u":string,"item":string}],"steps":[{"t":string,"s":{"temp":string,"time":string,"speed":string}}],"tags":[string]}';
const SYS: Record<string, string> = {
  calories: 'You are a nutrition analyst. From the meal photo, identify each food item with estimated portion. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Be realistic; round kcal to 5. Write all item names in English. Judge portion size from visible scale cues (plate diameter, cutlery, hands, packaging); when torn between two sizes pick the moderate one and state the assumed weight in portion (e.g. "1 bowl (~350 g)"). Nutrition values must be for ONE typical serving the person would eat, not the whole dish: if the photo shows a multi-serving item (whole cake, whole pizza, family platter), give values per single serving and say so in portion (e.g. "1 slice (1/12 of cake)"). If you see ANY food or drink, list it — only return an empty items array when there is clearly no food in the photo.',
  barcode: 'You identify packaged food from a photo of a barcode, nutrition label, or product package. Name the product (brand + name if visible) and give nutrition for one typical serving — use the printed nutrition label values when visible, otherwise realistic estimates for that product type. Return ONLY JSON: {"items":[{"n":string,"portion":string,"kcal":int,"p":int,"f":int,"c":int}],"confidence":0-100}. Write all text in English. Only return an empty items array if no packaged product is visible.',
  recipe: 'You turn a dish or cookbook-page photo into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Max 8 ingredients, 6 steps. Write ALL text (title, description, ingredients, steps, tags) in English.',
  url: 'You extract a recipe from web page content (recipe sites, blogs, YouTube/TikTok/Instagram video pages — the recipe is often in the video description or JSON-LD). Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Max 8 ingredients, 6 steps; adapt method steps to Thermomix style where sensible. Write ALL text in English. If the content truly contains no recipe (just estimate one from the dish name if a dish is clearly named), and no dish is identifiable at all, return {"error":"no_recipe"}.',
  signup: 'internal (admin user creation — see deployed v19)',
  text: 'You turn pasted free-form recipe text (any language, any mess) into a structured Thermomix recipe. Return ONLY JSON, no prose: ' + RECIPE_JSON + '. Max 8 ingredients, 6 steps. Write ALL text in English. If the text contains no recipe at all, return {"error":"no_recipe"}.',
  chat: 'You are the cooking & nutrition assistant inside "21", a food and wellness app. Answer briefly (2-5 sentences), practically and warmly: recipes, substitutions, techniques, portioning, macros, meal ideas. You provide general wellness information only — no medical diagnosis or treatment advice; suggest a professional for medical questions. Return ONLY JSON: {"reply":string}. Reply in English.',
};
async function dbg(row: Record<string, unknown>) {
  try {
    await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/scan_debug', {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (_e) { /* logging must never break scanning */ }
}
// Pull the recipe-bearing parts out of arbitrary page HTML: title/meta, JSON-LD
// blocks (most recipe sites), YouTube's shortDescription, then visible text.
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
  parts.push('PAGE TEXT: ' + body.slice(0, 8000));
  return parts.join('\n\n').slice(0, 24000);
}
Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let mode = '', imageLen = 0;
  try {
    const { mode: m2, image, url, text: pasted, messages } = await req.json();
    mode = m2; imageLen = image ? image.length : 0;
    if (!SYS[mode]) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
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
    if (mode === 'url') {
      if (!url || !/^https?:\/\//i.test(url)) return new Response(JSON.stringify({ error: 'bad url' }), { status: 400, headers: cors });
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 15000);
      let html = '';
      try {
        const pr = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'accept-language': 'en' } });
        html = await pr.text();
      } finally { clearTimeout(tm); }
      if (!html) return new Response(JSON.stringify({ error: 'could not fetch that link' }), { status: 422, headers: cors });
      let extra = '';
      if (/youtube\.com|youtu\.be/i.test(url)) {
        try {
          const oe = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
          if (oe.ok) { const oj = await oe.json(); extra = 'VIDEO TITLE: ' + (oj.title || '') + '\nCHANNEL: ' + (oj.author_name || '') + '\n\n'; }
        } catch (_e) { /* oembed is best-effort */ }
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
      body: JSON.stringify({ model: 'claude-fable-5', max_tokens: 2500, system: SYS[mode], messages: [{ role: 'user', content: userContent }] }),
    });
    const j = await r.json();
    if (j.error) { await dbg({ mode, image_len: imageLen, err: 'api: ' + JSON.stringify(j.error).slice(0, 500) }); return new Response(JSON.stringify({ error: j.error.message }), { status: 502, headers: cors }); }
    const blk = (j.content || []).find((c: { type: string }) => c.type === 'text');
    const text = blk?.text ?? '{}';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    await dbg({ mode, image_len: imageLen, stop_reason: j.stop_reason, resp: text.slice(0, 1000) });
    return new Response(JSON.stringify(parsed), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    await dbg({ mode, image_len: imageLen, err: String(e).slice(0, 500) });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
