// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = "test";

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

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
      <script src="p5.js"></script>
      <script src="p5.sound.min.js"></script>
      <link rel="stylesheet" type="text/css" href="style.css">
      <meta charset="utf-8">
    </head>
    <body>
      <script type="text/javascript">
      ${sketchSource}
      </script>
    </body>
    </html>
    `;

    await page.goto(`file://${__dirname}/sketch/empty.html`);
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
          await bot.sendPhoto(
            id,
            imageBuffer,
            {
              parse_mode: "Markdown",
              caption: `[${data.name} by ${data.user.username}](https://editor.p5js.org/${data.user.username}/sketches/${data.id})`,
            },
            {
              filename: "render.png",
              contentType: "image/png",
            }
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
