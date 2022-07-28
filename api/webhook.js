const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const botName = "@genstickbot";
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

let chrome = {};
let puppeteer;

if (process.env.AWS_REGION) {
  // running on the Vercel platform.
  chrome = require("chrome-aws-lambda");
  puppeteer = require("puppeteer-core");
} else {
  // running locally.
  puppeteer = require("puppeteer");
  chrome = { args: [] };
}

async function renderSketch(code) {
  try {
    let browser = await puppeteer.launch({
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 1024,
      height: 1024,
    });

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
      <meta charset="utf-8">
    </head>
    <body>
      <script>
      ${code}
      </script>
    </body>
    </html>
    `;

    page
      .on("console", (message) =>
        console.log(
          `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
        )
      )
      .on("pageerror", ({ message }) => console.log(message));

    await page.setContent(html);
    await page.waitForSelector("canvas", { timeout: 5000 });

    const element = await page.$("canvas");
    if (!element) throw "Canvas element not found";

    const imageBuffer = await element.screenshot({
      type: "png",
      omitBackground: true,
    });

    await browser.close();

    return imageBuffer;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function fetchSketchData(query) {
  const parts = query.split(" ");

  if (parts.length !== 2) {
    throw new Error(
      `You must include the username and sketch ID like: *rob.clouth Y7eLtQ9Ct*`
    );
  } else {
    const username = parts[0].trim();
    const sketchId = parts[1].trim();
    const url = `https://editor.p5js.org/editor/${username}/projects/${sketchId}`;

    const response = await axios.get(url);

    const data = response.data;
    const files = data.files;
    const sketchFile = files.find((file) => file.name === "sketch.js");

    if (!sketchFile) {
      throw new Error(
        `The sketch must have a single js file named *sketch.js*`
      );
    } else {
      return { code: sketchFile.content, sketchData: data };
    }
  }
}

module.exports = async (request, response) => {
  try {
    const { body } = request;
    if (body.message) {
      let {
        chat: { id },
        text,
      } = body.message;

      text = text.replace(botName, "").trim();

      try {
        const { code, sketchData } = await fetchSketchData(text);

        const imageBuffer = await renderSketch(code);

        await bot.sendSticker(
          id,
          imageBuffer,
          {},
          { contentType: "image/png", filename: "sticker.png" }
        );
      } catch (err) {
        await bot.sendMessage(id, err.message, { parse_mode: "Markdown" });
      }
    } else if (body.inline_query) {
      const { query, id } = body.inline_query;

      try {
        const { code, sketchData } = await fetchSketchData(query);

        await bot.answerInlineQuery(id, [
          {
            type: "article",
            id: crypto.randomUUID(),
            title: sketchData.name,
            description: `By ${sketchData.user.username}`,
            hide_url: false,
            url: `https://editor.p5js.org/editor/${sketchData.user.username}/projects/${sketchData.id}`,
            input_message_content: {
              message_text: `${botName} ${sketchData.user.username} ${sketchData.id}`,
              parse_mode: "Markdown",
            },
          },
        ]);
      } catch (err) {
        console.log(err.message);
      }
    }
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }

  response.send("OK");
};
