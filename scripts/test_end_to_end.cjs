async function testEndToEnd() {
  const prompt = 'what is RSIM in the minstry of comminuctaion of ghana and wgat is the name of the director there';
  console.log('Testing Prompt:', prompt);

  // 1. Test POST /api/ai/complete
  console.log('\n--- 1. Testing /api/ai/complete ---');
  try {
    const res = await fetch('http://localhost:3000/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        useSearchGrounding: true,
        model: 'gemini-3.8-flash'
      })
    });
    console.log('/api/ai/complete status:', res.status);
    const data = await res.json();
    console.log('isGrounded:', data.isGrounded);
    console.log('Model used:', data.modelUsed);
    console.log('Sources count:', data.sources?.length);
    console.log('First 2 Sources:', data.sources?.slice(0, 2));
    console.log('Response preview:\n', data.text?.slice(0, 500));
    console.log('Mentions Barbara Barnes?', /barbara/i.test(data.text));
    console.log('Mentions Research, Statistics?', /research,\s*statistics|research\s+statistics/i.test(data.text));
  } catch (e) {
    console.error('complete error:', e.message);
  }

  // 2. Test POST /api/ai/complete-stream
  console.log('\n--- 2. Testing /api/ai/complete-stream ---');
  try {
    const streamRes = await fetch('http://localhost:3000/api/ai/complete-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        useSearchGrounding: true,
        model: 'gemini-3.8-flash'
      })
    });
    console.log('/api/ai/complete-stream status:', streamRes.status);
    const text = await streamRes.text();
    let streamedText = '';
    let sources = [];
    text.split('\n').forEach(line => {
      if (line.startsWith('data: ')) {
        try {
          const d = JSON.parse(line.slice(6));
          if (d.text && !d.phase) streamedText += d.text;
          if (d.sources) sources = d.sources;
        } catch {}
      }
    });
    console.log('Streamed text length:', streamedText.length);
    console.log('Streamed sources count:', sources.length);
    console.log('Streamed response preview:\n', streamedText.slice(0, 500));
    console.log('Stream mentions Barbara Barnes?', /barbara/i.test(streamedText));
  } catch (e) {
    console.error('complete-stream error:', e.message);
  }
}

testEndToEnd();
