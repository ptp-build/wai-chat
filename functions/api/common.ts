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
