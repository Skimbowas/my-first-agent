# AI Study & Lookup Agent

A conversational AI Agent built with Node.js and the Anthropic Claude API.

## What it does

This agent was built to help study for the Netsuite SuiteFoundation Certification exam. It answers questions using a local study notes file, but it can also retrieve live weather data for any city and look up customer information - all through free public APIs.

Although the agent is focused on examp prep, it will answer most general questions while reminding you of its main purpose.

## How it works

- **Study questions** - reads from a local 'study_notes.txt' file
- **Weather lookups** - calls the Open-Meteo API (no key needed)
- **Customer lookups** - calls the JSONPlaceholder API (no key needed)

The agent maintains conversation history across turns, so it remembers context from earlier in the session. It decides on its won which tool to call basted on what you ask - including multiple tools in a single response.

## Tools used

- [Anthropic Claude API](https://anthropic.com) - the AI model
- [Open-Meteo](https://open-meteo.com) - free weather API
- [JSONPlaceholder](https://jsonplaceholder.typicode.com) - free mock customer API

## Setup

1. Clone this repo
2. Install dependecies

npm install

3. Create a '.env' file in the project root:

ANTHROPIC_API_KEY=your_key_here

4. Get an API key from [console.anthropic.com](https://console.anthropic.com) and add credits to your account
5. run the agent:

node agent.js

## Exmaple prompts

- 'Give me a practice question about User Roles'
- 'What is the weather in Chicago?'
- 'Look up a customer named Leanne'
- 'Look up a customer named Ervin and tell me the weather in New York'


## What this project demonstrates

- Connecting to a padi AI API from Node.js
- Tool calling / function calling with multiple tools
- Chaining tools in a single response
- Maintaining conversation history across turns
- Calling live external REST APIs from agent tools
- Secure API key management with dotenv

## Author

Stephen Ssonko - Building AI agent skills.

Save with Ctrl+X>Y>Enter.
