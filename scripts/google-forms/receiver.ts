// Receives pages a docs.google.com tab posts to this window, and saves them.
const dir = process.argv[2]!
const page = `<!doctype html><meta charset=utf-8><title>receiver</title><pre id=log>ready</pre><script>
addEventListener('message', async (e) => {
  if (e.origin !== 'https://docs.google.com') return;
  const r = await fetch('/save', { method: 'POST', body: JSON.stringify(e.data) });
  document.getElementById('log').textContent += '\\n' + e.data.name + ' ' + (await r.text());
  e.source.postMessage({ saved: e.data.name }, e.origin);
});
</script>`
Bun.serve({
  port: 4400,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/save' && req.method === 'POST') {
      const { name, html } = await req.json()
      if (!/^[a-z0-9-]+(\.[A-Za-z-]+)?$/.test(name)) return new Response('bad name', { status: 400 })
      await Bun.write(`${dir}/${name}.html`, html)
      return new Response(`saved ${html.length}`)
    }
    return new Response(page, { headers: { 'content-type': 'text/html' } })
  },
})
