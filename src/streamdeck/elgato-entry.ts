import streamDeck from "@elgato/streamdeck";
import { startAbletonRackStreamDeckPlugin } from "./elgato-runtime.js";

startAbletonRackStreamDeckPlugin({ streamDeck }).catch((error: unknown) => {
  streamDeck.logger.error("Ableton Rack Control failed to start", error);
});
