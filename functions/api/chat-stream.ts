import {createParser} from "./eventsource-parser/src";
import {requestOpenai} from "./common";

async function createStream(req: Request) {
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



export const onRequestPost: PagesFunction = async ({request}) => {
  try {
    const stream = await createStream(request);
    return new Response(stream);
  } catch (error) {
    console.error("[Chat Stream]", error);
    return new Response(
      JSON.stringify({
        error: {
          message: JSON.stringify(error),
        },
      }),
      {
        status:500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
};
