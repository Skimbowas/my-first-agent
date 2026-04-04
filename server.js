require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static('public'));

// --- TOOLS (same as agent.js) ---
const tools = [
  {
    name: 'read_study_notes',
    description: 'Reads the contents of the local study notes file. Use this when the user asks about NetSuite topics, exam questions, or anything that might be in the study notes.',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename to read. Default: study_notes.txt'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_weather',
    description: 'Gets the current weather for a city. Use this when the user asks about weather anywhere.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'The city name' },
        latitude: { type: 'number', description: 'Latitude of the city' },
        longitude: { type: 'number', description: 'Longitude of the city' }
      },
      required: ['city', 'latitude', 'longitude']
    }
  },
  {
    name: 'get_customer',
    description: 'Look up a customer by name. Use this when the user asks about a customer or account.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Customer name to search for'
        }
      },
      required: ['search']
    }
  }
];

// --- TOOL EXECUTION (same logic as agent.js) ---
async function executeTool(name, input) {
  if (name === 'read_study_notes') {
    const filename = input.filename || 'study_notes.txt';
    try {
      const contents = fs.readFileSync(filename, 'utf8');
      return contents;
    } catch (err) {
      return `Error: could not read file "${filename}". ${err.message}`;
    }
  }

  if (name === 'get_weather') {
    const { city, latitude, longitude } = input;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
      const res = await fetch(url);
      const data = await res.json();
      return JSON.stringify({ city, temperature_f: data.current.temperature_2m });
    } catch (err) {
      return `Error fetching weather: ${err.message}`;
    }
  }

  if (name === 'get_customer') {
    const { search } = input;
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/users');
      const users = await res.json();
      const matches = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.company.name.toLowerCase().includes(search.toLowerCase())
      );
      if (matches.length === 0) {
        return JSON.stringify({ error: `No customers found matching "${search}"` });
      }
      return JSON.stringify(matches.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        company: u.company.name,
        city: u.address.city
      })));
    } catch (err) {
      return `Error fetching customer: ${err.message}`;
    }
  }

  return `Error: unknown tool "${name}"`;
}

// --- CONVERSATION STORAGE ---
// Stores conversation history per session
const sessions = {};

// --- CHAT ENDPOINT ---
// This is what the browser calls when you send a message
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }

  const messages = sessions[sessionId];
  messages.push({ role: 'user', content: message });

  try {
    let response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, use the read_study_notes tool. When asked about customers, use the get_customer tool. When asked about weather, use the get_weather tool.',
      tools: tools,
      messages: messages
    });

    while (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const toolUse of toolUses) {
        const toolResult = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult
        });
      }

      messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, use the read_study_notes tool. When asked about customers, use the get_customer tool. When asked about weather, use the get_weather tool.',
        tools: tools,
        messages: messages
      });
    }

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    messages.push({ role: 'assistant', content: response.content });

    res.json({ reply: text });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser to see the chat interface`);
});
