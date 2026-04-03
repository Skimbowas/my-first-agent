require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const readline = require('readline');

const client = new Anthropic();

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
      city: {
        type: 'string',
        description: 'The city anem, e.g Chicago'
      },
      latitude: {
        type: 'number',
        description: 'Latitude fo the city'
      },
      longitude: {
        type: 'number',
        description: 'longitude of the city'
      }
    },
    required: ['city','latitude','longitude']
  }
}
];

async function executeTool(name, input) {
  if (name === 'read_study_notes') {
    const filename = input.filename || 'study_notes.txt';
    try {
      const contents = fs.readFileSync(filename, 'utf8');
      console.log(`   [Tool: read "${filename}" - ${contents.length} chars]`);
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
      const temp = data.current.temperature_2m;
      console.log(`   [Tool: get_weather for ${city} - ${temp}°F]`);
      return JSON.stringify({ city, temperature_f: temp });
    } catch (err) {
      return `Error fetching weather: ${err.message}`;
    }
  }
  return `Error: unknown tool "${name}"`;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [];

async function turn() {
  rl.question('\nYou: ', async (userInput) => {

    if (userInput.toLowerCase() === 'exit') {
      console.log('\nAgent: Goodbye. Session ended.');
      rl.close();
      return;
    }

    if (!userInput.trim()) {
      turn();
      return;
    }

    messages.push({ role: 'user', content: userInput });

    try {
      console.log('Agent: thinking...');

      let response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, always use the read_study_notes tool to check the study notes first.',
        tools: tools,
        messages: messages
      });

      while (response.stop_reason === 'tool_use') {
  const toolUses = response.content.filter(b => b.type === 'tool_use');

  messages.push({ role: 'assistant', content: response.content });

  const toolResults = [];
  for (const toolUse of toolUses) {
    console.log(`   [Model requested: ${toolUse.name}]`);
    const toolResult = await executeTool(toolUse.name, toolUse.input);
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: toolResult
    });
  }

  messages.push({
    role: 'user',
    content: toolResults
  });

        response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',        max_tokens: 1024,
          system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, always use the read_study_notes tool to check the study notes first.',
          tools: tools,
          messages: messages
        });
      }

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

      messages.push({ role: 'assistant', content: response.content });

      process.stdout.write('\x1B[1A\x1B[2K');
      console.log(`Agent: ${text}`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }

    turn();
  });
}

console.log('Agent ready - I have access to your study notes.');
console.log('Try: "Give me a practice question about User Roles"\n');
turn();
