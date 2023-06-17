import openai from "openai";
import fetch from "node-fetch";
import { createBot } from "whatsapp-cloud-api";
import Tokenizer from "tiktoken";

openai.api_key = process.env.OPENAI_API_KEY;

const conversationHistory = [];

function countTokens(message) {
  const tokenizer = new Tokenizer();
  return tokenizer.tokenize(message).length;
}

async function getOpenAIResponse(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });
  const messages = [
    {
      role: "system",
      content:
        "You are an AI personal assistant, similar to Janet from The Good Place. You are always cheerful, courteous, non-judgmental, and incredibly knowledgeable. You are helpful and efficient, and you provide information and assistance to users while maintaining the characteristics of Janet.",
    },
    ...conversationHistory,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo-16k",
      temperature: 1,
      messages: messages,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("OpenAI API Error:", error);
    return "An error occurred while processing your request.";
  }

  const data = await response.json();
  const botAnswer = data?.choices?.[0]?.message?.content;
  conversationHistory.push({ role: "assistant", content: botAnswer });
  let totalTokens = 0;
  for (const message of conversationHistory) {
    totalTokens += countTokens(message.content);
  }
  while (totalTokens > 15000) {
    const removedMessage = conversationHistory.shift();
    totalTokens -= countTokens(removedMessage.content);
  }

  return botAnswer;
}

// const bot = createBot(from, token)

// bot.on("message", async (msg) => {
//   console.log(msg);
//   if (msg.type === "text") {
//     const openAIResponse = await getOpenAIResponse(msg.body);
//     await bot.sendText(msg.from, openAIResponse);
//   } else if (msg.type === "image") {
//     await bot.sendText(msg.from, "Received your image!");
//   }
// });

(async () => {
  try {
    const from = process.env.FROM_PHONE_NUMBER_ID;
    const token = process.env.ACCESS_TOKEN;
    const to = process.env.TO_PHONE_NUMBER;
    const webhookVerifyToken = "bju#hfre@iu!e87328eiekjnfw";

    const bot = createBot(from, token);

    const result = await bot.sendText(to, "Hello I'm Janet, here to help you.");

    await bot.startExpressServer({
      webhookVerifyToken,
    });

    bot.on("message", async (msg) => {
      if (msg.type === "text") {
        const messageRecieved = msg.data.text;
        console.log("User message: ", messageRecieved);

        const openAIResponse = await getOpenAIResponse(messageRecieved);
        console.log("Bot message: ", openAIResponse);
        await bot.sendText(msg.from, openAIResponse);
      } else if (msg.type === "image") {
        await bot.sendText(msg.from, "Received your image!");
      }
    });
  } catch (error) {
    console.error(error);
  }
})();
