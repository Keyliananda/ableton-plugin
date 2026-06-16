import streamDeck from "@elgato/streamdeck";
import { startAbletonRackStreamDeckPlugin } from "./elgato-runtime.js";
import { describeStartupError } from "./startup-errors.js";

startAbletonRackStreamDeckPlugin({ streamDeck }).catch((error: unknown) => {
  streamDeck.logger.error(describeStartupError(error), error);
});
