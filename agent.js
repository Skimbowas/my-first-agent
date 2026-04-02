require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key from the environment
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: GOOGLE_API_KEY is not set. Run: export GOOGLE_API_KEY='your_key'");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// UPDATED: Using gemini-2.0-flash for 2026 compatibility
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash", 
    systemInstruction: "You are a senior IT Architect. Give concise, technical answers." 
});

const readline = require('readline');

// Create the chat session — this holds conversation history automatically
const chat = model.startChat();

// Set up terminal input/output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// This function asks for input, sends it, prints the reply, then calls itself again
async function turn() {
  rl.question('\nYou: ', async (userInput) => {

    // Let the user type 'exit' to quit cleanly
    if (userInput.toLowerCase() === 'exit') {
      console.log('\nAgent: Goodbye. Session ended.');
      rl.close();
      return;
    }

    // Skip empty input
    if (!userInput.trim()) {
      turn();
      return;
    }

    try {
      console.log('Agent: thinking...');
      const result = await chat.sendMessage(userInput);
      const text = result.response.text();

      // Clear the "thinking..." line and print the real response
      process.stdout.write('\x1B[1A\x1B[2K'); // moves up one line, clears it
      console.log(`Agent: ${text}`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }

    // Call ourselves again to keep the loop going
    turn();
  });
}

console.log('Agent ready. Type your message and press Enter. Type "exit" to quit.\n');
turn(); // start the loop