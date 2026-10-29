const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testSynthesis() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const searchResults = `
[Source 1: Director, RSIM - Ministry of Communications and Digitalisation] (https://moc.gov.gh/director-rsim)
Ms. Barbara Phyllis Barnes is a Lawyer and a Civil Servant with over 17 years of dedicated service in public administration. She currently holds the position of Director for Research, Statistics, and Information Management (RSIM) at the Ministry of Communication, Digital Technology, and Innovations (Ministry of Communications and Digitalisation, Ghana).

[Source 2: RSIM Directorate Mandate - Ministry of Communications and Digitalisation] (https://moc.gov.gh/directorates/rsim)
The Research, Statistics and Information Management (RSIM) Directorate is responsible for conducting research, analysing data, managing information and supporting evidence-based policymaking within the Ministry.
Core functions include:
- Research and statistics: Conducts research, studies and surveys to inform policy development.
- Data and information management: Collects, analyses, documents and maintains information relevant to the ICT sector.
- Public relations: Disseminates information about the Ministry's policies, programmes and activities.
- Right to Information (RTI): Oversees the Ministry's RTI function.
`;

  const systemInstruction = `You are RSIM AI, an intelligent, conversational assistant for the Ministry of Communications, Digital Technology and Innovations (MoCDTI) (Ghana).
- Respond directly in a helpful, conversational chat format — like a knowledgeable expert having a real conversation.
- ALWAYS provide substantive, detailed answers that directly address the user's question with real information, facts, explanations, and analysis.
- Structure answers with clear headings (##), numbered sections, bullet points, and bold text for key terms.
- When verified web search results or documents are provided in the context, synthesize the information into a comprehensive, well-structured answer. DO NOT just list the sources — explain and discuss the content from them.
- Cite sources inline using bracketed numbers like [1], [2] after the relevant statement.
- NEVER include copyright notices, developer credits, or branding text in your responses.

VERIFIED LIVE WEB SEARCH RESULTS:
${searchResults}

CRITICAL SEARCH GROUNDING INSTRUCTIONS:
- Directly answer the user's question with specific facts, details, names, dates, statistics, and explanations drawn from the sources.
- Structure your response with clear headings (## or ###), numbered sections, bullet points, and bold key terms.
- Cite sources inline using bracketed numbers like [1], [2] immediately after the relevant fact or statement.
- DO NOT include any copyright notices, developer credits, or branding text.`;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'what is RSIM in the minstry of comminuctaion of ghana and wgat is the name of the director there',
      config: {
        systemInstruction,
        temperature: 0.3,
      }
    });
    console.log('--- SYNTHESIZED RESPONSE ---');
    console.log(res.text);
  } catch (e) {
    console.log('Synthesis error:', e.message);
  }
}

testSynthesis();
