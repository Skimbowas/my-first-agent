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
  },
  {
    name: 'get_invoices',
    description: 'Look up NetSuite invoices for a customer by company name or customer ID. Returns invoice number, amount, due date, and status.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Company name or customer ID to find invoices for'
        }
      },
      required: ['search']
    }
  },
  {
    name: 'get_sales_orders',
    description: 'Look up NetSuite sales orders for a customer by company name or customer ID. Returns order number, amount, status, and items ordered.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Company name or customer ID to find sales orders for'
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

  if (name === 'get_invoices') {
    const { search } = input;

    const invoices = [
      {
        tranid: 'INV-9901',
        customer: 'Meridian Group LLC',
        entityid: 'CUST-10042',
        amount: 5200.00,
        amountremaining: 5200.00,
        duedate: '2026-04-15',
        status: 'Overdue',
        location: 'Store #142 - SoHo NY'
      },
      {
        tranid: 'INV-9944',
        customer: 'Meridian Group LLC',
        entityid: 'CUST-10042',
        amount: 9050.00,
        amountremaining: 9050.00,
        duedate: '2026-05-01',
        status: 'Open',
        location: 'Store #142 - SoHo NY'
      },
      {
        tranid: 'INV-9872',
        customer: 'Hargrove Interiors',
        entityid: 'CUST-10078',
        amount: 8750.50,
        amountremaining: 8750.50,
        duedate: '2026-04-30',
        status: 'Open',
        location: 'Store #205 - Magnificent Mile IL'
      },
      {
        tranid: 'INV-9815',
        customer: 'Coastal Living Co',
        entityid: 'CUST-10091',
        amount: 3200.00,
        amountremaining: 1600.00,
        duedate: '2026-04-20',
        status: 'Partial',
        location: 'Store #318 - Santa Monica CA'
      },
      {
        tranid: 'INV-9788',
        customer: 'Northshore Design Group',
        entityid: 'CUST-10117',
        amount: 22100.75,
        amountremaining: 22100.75,
        duedate: '2026-03-31',
        status: 'Overdue',
        location: 'Store #167 - Newbury Street MA'
      }
    ];

    const matches = invoices.filter(i =>
      i.customer.toLowerCase().includes(search.toLowerCase()) ||
      i.entityid.toLowerCase().includes(search.toLowerCase()) ||
      i.tranid.toLowerCase().includes(search.toLowerCase())
    );

    if (matches.length === 0) {
      return JSON.stringify({ error: `No invoices found for "${search}"` });
    }

    console.log(`   [Tool: netsuite_get_invoices "${search}" - ${matches.length} match(es)]`);
    return JSON.stringify(matches);
  }

  if (name === 'get_sales_orders') {
    const { search } = input;

    const salesOrders = [
      {
        tranid: 'SO-44821',
        customer: 'Meridian Group LLC',
        entityid: 'CUST-10042',
        amount: 12400.00,
        status: 'Pending Fulfillment',
        trandate: '2026-03-28',
        location: 'Store #142 - SoHo NY',
        items: [
          { item: 'Sactional Base - Deep', quantity: 4, rate: 1200.00 },
          { item: 'Sactional Side - Deep', quantity: 8, rate: 650.00 }
        ]
      },
      {
        tranid: 'SO-44756',
        customer: 'Hargrove Interiors',
        entityid: 'CUST-10078',
        amount: 8750.50,
        status: 'Pending Billing',
        trandate: '2026-03-15',
        location: 'Store #205 - Magnificent Mile IL',
        items: [
          { item: 'Sactional Base - Standard', quantity: 3, rate: 995.00 },
          { item: 'Sactional Cover - Lapis', quantity: 6, rate: 180.00 },
          { item: 'StealthTech Sound + Charge', quantity: 2, rate: 795.00 }
        ]
      },
      {
        tranid: 'SO-44690',
        customer: 'Coastal Living Co',
        entityid: 'CUST-10091',
        amount: 4800.00,
        status: 'Billed',
        trandate: '2026-03-01',
        location: 'Store #318 - Santa Monica CA',
        items: [
          { item: 'Sactional Base - Deep', quantity: 2, rate: 1200.00 },
          { item: 'Sactional Side - Deep', quantity: 4, rate: 650.00 },
          { item: 'Sactional Cover - Ivory Felt', quantity: 4, rate: 175.00 }
        ]
      },
      {
        tranid: 'SO-44601',
        customer: 'Northshore Design Group',
        entityid: 'CUST-10117',
        amount: 22100.75,
        status: 'Pending Fulfillment',
        trandate: '2026-02-20',
        location: 'Store #167 - Newbury Street MA',
        items: [
          { item: 'Sactional Base - Deep', quantity: 8, rate: 1200.00 },
          { item: 'Sactional Side - Deep', quantity: 12, rate: 650.00 },
          { item: 'StealthTech Sound + Charge', quantity: 4, rate: 795.00 },
          { item: 'Sactional Cover - Charcoal', quantity: 8, rate: 180.00 }
        ]
      }
    ];

    const matches = salesOrders.filter(o =>
      o.customer.toLowerCase().includes(search.toLowerCase()) ||
      o.entityid.toLowerCase().includes(search.toLowerCase()) ||
      o.tranid.toLowerCase().includes(search.toLowerCase())
    );

    if (matches.length === 0) {
      return JSON.stringify({ error: `No sales orders found for "${search}"` });
    }

    console.log(`   [Tool: netsuite_get_sales_orders "${search}" - ${matches.length} match(es)]`);
    return JSON.stringify(matches);
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
      system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, use the read_study_notes tool. When asked about customers or accounts, use the get_customer tool. When asked about invoices, use the get_invoices tool. When asked about sales orders or orders, use the get_sales_orders tool. When asked about weather, use the get_weather tool.',
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
        system: 'You are a senior IT Architect and NetSuite specialist helping a colleague study for the SuiteFoundation exam. When asked about NetSuite topics, use the read_study_notes tool. When asked about customers or accounts, use the get_customer tool. When asked about invoices, use the get_invoices tool. When asked about sales orders or orders, use the get_sales_orders tool. When asked about weather, use the get_weather tool.',
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
