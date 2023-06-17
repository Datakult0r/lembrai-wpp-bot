import openai from "openai";
import fetch from "node-fetch";
import { createBot } from "whatsapp-cloud-api";
import { isWithinTokenLimit } from "gpt-tokenizer";
import fs from "fs";
import path from "path";

openai.api_key = process.env.OPENAI_API_KEY;

function logToFile(filename, message) {
  const dir = "./logs";

  // If logs directory does not exist, create it
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.appendFile(path.join(dir, filename), message + "\n", function (err) {
    if (err) {
      console.error("An error occurred while writing to the file:", err);
    }
  });
}

const conversationHistory = [];

async function getOpenAIResponse(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });
  // convert all messages to a single string
  const conversationHistoryString = conversationHistory
    .map((message) => message.content)
    .join("\n\n");

  // check if the string is within the token limit

  if (!isWithinTokenLimit(conversationHistoryString)) {
    conversationHistory.shift();
  }

  const messages = [
    {
      role: "system",
      content:
        "You are an AI personal assistant, similar to Janet from The Good Place. You are always cheerful, courteous, non-judgmental, and incredibly knowledgeable. You are helpful and efficient, and you provide information and assistance to users while maintaining the characteristics of Janet.",
    },
    ...conversationHistory,
  ];
  try {
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
    return botAnswer;
  } catch (error) {
    console.error("Fetch Error:", error);
    return "An error occurred while processing your request.";
  }
}

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
      console.log("Message received:", msg);
      try {
        if (msg.type === "text") {
          const messageRecieved = msg.data.text;
          console.log("User message: ", messageRecieved);

          // Log user's message to a file
          const dateStr = new Date().toISOString().split("T")[0]; // get current date in YYYY-MM-DD format
          const filename = `${dateStr}_${msg.from}.txt`;
          logToFile(filename, `User message: ${messageRecieved}`);

          const openAIResponse = await getOpenAIResponse(messageRecieved);
          console.log("Bot message: ", openAIResponse);
          console.log("number: ", msg.from);
          console.log("number: ", to);

          // Log bot's message to the same file
          logToFile(filename, `Bot message: ${openAIResponse}`);

          await bot.sendText(msg.from, openAIResponse);
        } else if (msg.type === "image") {
          await bot.sendText(msg.from, "Received your image!");
        }
      } catch (error) {
        console.error("An error occurred:", error);
      }
    });
  } catch (error) {
    console.error(error);
  }
})();
