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
},
{
    name: 'get_customer',
    description: 'Look up a NetSuite customer record by company name, customer ID, sales rep, or location. Returns full customer details including balance, terms, and billing address.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Company name, customer ID (e.g. CUST-10042), sales rep name, or location to search for'
        }
      },
      required: ['search']
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

  if (name === 'get_customer') {
    const { search } = input;

    const customers = [
      {
        entityid: 'CUST-10042',
        companyname: 'Meridian Group LLC',
        email: 'ar@meridiangroup.com',
        phone: '212-555-0182',
        status: 'Active',
        terms: 'Net 30',
        balance: 14250.00,
        salesrep: 'Dana Holloway',
        location: 'Store #142 - SoHo NY',
        billingaddress: '480 Broadway, New York, NY 10013'
      },
      {
        entityid: 'CUST-10078',
        companyname: 'Hargrove Interiors',
        email: 'billing@hargroveinteriors.com',
        phone: '312-555-0247',
        status: 'Active',
        terms: 'Net 60',
        balance: 8750.50,
        salesrep: 'Marcus Webb',
        location: 'Store #205 - Magnificent Mile IL',
        billingaddress: '900 N Michigan Ave, Chicago, IL 60611'
      },
      {
        entityid: 'CUST-10091',
        companyname: 'Coastal Living Co',
        email: 'payments@coastalliving.com',
        phone: '310-555-0394',
        status: 'Active',
        terms: 'Net 30',
        balance: 3200.00,
        salesrep: 'Priya Nair',
        location: 'Store #318 - Santa Monica CA',
        billingaddress: '395 Santa Monica Place, Santa Monica, CA 90401'
      },
      {
        entityid: 'CUST-10103',
        companyname: 'Summit Home Furnishings',
        email: 'info@summithome.com',
        phone: '720-555-0561',
        status: 'Inactive',
        terms: 'Net 15',
        balance: 0.00,
        salesrep: 'Jake Torrence',
        location: 'Store #091 - Cherry Creek CO',
        billingaddress: '3000 E 1st Ave, Denver, CO 80206'
      },
      {
        entityid: 'CUST-10117',
        companyname: 'Northshore Design Group',
        email: 'accounts@northshoredesign.com',
        phone: '617-555-0738',
        status: 'Active',
        terms: 'Net 45',
        balance: 22100.75,
        salesrep: 'Dana Holloway',
        location: 'Store #167 - Newbury Street MA',
        billingaddress: '200 Newbury St, Boston, MA 02116'
      }
    ];

    const matches = customers.filter(c =>
      c.companyname.toLowerCase().includes(search.toLowerCase()) ||
      c.entityid.toLowerCase().includes(search.toLowerCase()) ||
      c.salesrep.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase())
    );

    if (matches.length === 0) {
      return JSON.stringify({ error: `No customers found matching "${search}"` });
    }

    console.log(`   [Tool: netsuite_get_customer "${search}" - ${matches.length} match(es)]`);
    return JSON.stringify(matches);
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
        system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, always use the read_study_notes tool. When asked about customers or accounts, use the get_customer tool to look them up.',
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
