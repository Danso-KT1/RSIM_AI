async function test() {
  const userQuery = 'what is RSIM in the minstry of comminuctaion of ghana and wgat is the name of the director there';
  
  function cleanQuery(q) {
    return q
      .replace(/\bminstry\b/gi, 'ministry')
      .replace(/\bcomminuctaion\b/gi, 'communications')
      .replace(/\bcomunication\b/gi, 'communications')
      .replace(/\bwgat\b/gi, 'what');
  }

  const queries = [
    cleanQuery(userQuery),
    'RSIM Ministry of Communications Ghana director'
  ];

  for (const q of queries) {
    console.log('\n--- Searching for:', q);
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    const html = await res.text();
    const parts = html.split(/<div class="result\s+results_links/g).slice(1);
    console.log('Results count:', parts.length);
    if (parts.length > 0) {
      const part = parts[0];
      const titleMatch = part.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = part.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);
      console.log('Top Result Title:', titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').trim() : 'none');
      console.log('Top Result Snippet:', snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : 'none');
    }
  }
}

test();
