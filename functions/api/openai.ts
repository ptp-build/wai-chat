import { requestOpenai } from "./common";

export const onRequestGet: PagesFunction = async ({request}) => {
	return makeRequest({request})
};

export const onRequestPost: PagesFunction = async ({request}) => {
  return makeRequest({request})
};

async function makeRequest({request}:{request:Request}){
  try {
    const api = await requestOpenai(request);
    return new Response(
      api.body,
      {
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.error("[OpenAI] ", request.body, e);
    return new Response(
      JSON.stringify({
        error: {
          message: JSON.stringify(e),
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
}
