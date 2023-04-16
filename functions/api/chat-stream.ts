// @ts-ignore
import {createStream} from "../../src/worker/share/functions/openai";

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
