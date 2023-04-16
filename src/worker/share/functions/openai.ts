import {createParser} from "../../../lib/eventsource-parser";

const OPENAI_URL = "api.openai.com";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = DEFAULT_PROTOCOL
const BASE_URL = OPENAI_URL

export async function requestOpenai(req: Request) {
  let apiKey = req.headers.get("token");
  const openaiPath = req.headers.get("path");
  console.log("[Proxy]", openaiPath,apiKey?.substring(0,10));

  return fetch(`${PROTOCOL}://${BASE_URL}/${openaiPath}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: req.method,
    body: req.body,
  });
}


export async function createStream(req: Request) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const res = await requestOpenai(req);
  return new ReadableStream({
    async start(controller) {
      function onParse(event: any) {
        if (event.type === "event") {
          const data = event.data;
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
}
