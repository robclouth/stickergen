// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = "test";

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

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

      if (parts[0] === "/generate") {
        if (parts.length !== 3) {
          await bot.sendMessage(
            id,
            `You must include the username and sketch ID like: */generate rob.clouth Y7eLtQ9Ct*`,
            { parse_mode: "Markdown" }
          );
        } else {
          const username = parts[1].trim();
          const sketchId = parts[2].trim();
          const url = `https://editor.p5js.org/editor/${username}/projects/${sketchId}`;
          console.log(url);

          const response = await axios.get(url);
          const files = response.data.files;
          const sketchFile = files.find((file) => file.name === "sketch.js");

          if (!sketchFile) {
            await bot.sendMessage(
              id,
              `The sketch must have a single js file named *sketch.js*`,
              { parse_mode: "Markdown" }
            );
          } else {
            console.log(sketchFile.content);
            await bot.sendMessage(id, sketchFile.content, {
              parse_mode: "Markdown",
            });
          }
        }
      } else {
        await bot.sendMessage(id, `Unrecognised command`, {
          parse_mode: "Markdown",
        });
      }
    }
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }

  response.send("OK");
};
