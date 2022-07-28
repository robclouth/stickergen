const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

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

async function renderSketch(sketchSource) {
  try {
    let browser = await puppeteer.launch({
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
      <meta charset="utf-8">
    </head>
    <body>
      <script>
      ${sketchSource}
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

    console.log(imageBuffer.length);

    // const webpBuffer = await webp.buffer2webpbuffer(pngBuffer, "png", "-q 80");

    await browser.close();

    return imageBuffer;
  } catch (err) {
    console.error(err);
    return null;
  }
}

module.exports = async (request, response) => {
  try {
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

    const { body } = request;
    if (body.message) {
      const {
        chat: { id },
        text,
      } = body.message;

      const parts = text.split(" ");

      if (parts.length !== 2) {
        await bot.sendMessage(
          id,
          `You must include the username and sketch ID like: */generate rob.clouth Y7eLtQ9Ct*`,
          { parse_mode: "Markdown" }
        );
      } else {
        console.log("Rendering sketch...");
        const username = parts[0].trim();
        const sketchId = parts[1].trim();
        const url = `https://editor.p5js.org/editor/${username}/projects/${sketchId}`;

        const response = await axios.get(url);

        const data = response.data;
        const files = data.files;
        const sketchFile = files.find((file) => file.name === "sketch.js");

        if (!sketchFile) {
          await bot.sendMessage(
            id,
            `The sketch must have a single js file named *sketch.js*`,
            { parse_mode: "Markdown" }
          );
        } else {
          const imageBuffer = await renderSketch(sketchFile.content);
          console.log("Rendered.");
          await bot.sendSticker(
            id,
            imageBuffer,
            {},
            { contentType: "image/webp", filename: "sticker.webp" }
          );
        }
      }
    }
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }

  response.send("OK");
};
