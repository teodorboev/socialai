import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "socialai",
  eventKey: process.env.INNGEST_EVENT_KEY,
  fetch: fetch.bind(globalThis),
});
