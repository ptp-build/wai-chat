import {ChatRequest, ChatResponse, Message} from "../../../../functions/api/types";
import {AI_PROXY_API} from "../../../config";
import {PbChatGptConfig_Type} from "../protobuf/PTPCommon/types";

const TIME_OUT_MS = 30000;

const ENABLE_GPT4 = true;

export const ALL_MODELS = [
  {
    name: "gpt-4",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4-0314",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4-32k",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4-32k-0314",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-3.5-turbo",
    available: true,
  },
  {
    name: "gpt-3.5-turbo-0301",
    available: true,
  },
];

export function isValidModel(name: string) {
  return ALL_MODELS.some((m) => m.name === name && m.available);
}

export function isValidNumber(x: number, min: number, max: number) {
  return typeof x === "number" && x <= max && x >= min;
}


const makeRequestParam = (
  messages: Message[],
  options?: {
    filterBot?: boolean;
    stream?: boolean;
  },
): ChatRequest => {
  let sendMessages = messages.map((v) => ({
    role: v.role,
    content: v.content,
  }));

  if (options?.filterBot) {
    sendMessages = sendMessages.filter((m) => m.role !== "assistant");
  }

  return {
    model: "gpt-3.5-turbo",
    messages: sendMessages,
    stream: options?.stream,
  };
};

function getHeaders(apiKey:string) {
  let headers: Record<string, string> = {};
  headers["token"] = apiKey;
  return headers;
}

export function requestOpenaiClient(path: string,apiKey:string) {
  return (body: any, method = "POST") =>
    fetch(AI_PROXY_API +"/api/openai", {
      method,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        path,
        ...getHeaders(apiKey),
      },
      body: body && JSON.stringify(body),
    });
}

export async function requestChat(messages: Message[],apiKey:string) {
  const req: ChatRequest = makeRequestParam(messages, { filterBot: true });

  const res = await requestOpenaiClient("v1/chat/completions",apiKey)(req);

  try {
    return (await res.json()) as ChatResponse;
  } catch (error) {
    console.error("[Request Chat] ", error, res.body);
  }
}

export async function requestUsage(apiKey:string) {
  const res = await requestOpenaiClient(
    "dashboard/billing/credit_grants?_vercel_no_cache=1",apiKey
  )(null, "GET");

  try {
    const response = (await res.json()) as {
      total_available: number;
      total_granted: number;
      total_used: number;
    };
    return response;
  } catch (error) {
    console.error("[Request usage] ", error, res.body);
  }
}


export function filterConfig(oldConfig: PbChatGptConfig_Type): Partial<PbChatGptConfig_Type> {
  const config = Object.assign({}, oldConfig);

  const validator: {
    [k in keyof PbChatGptConfig_Type]: (x: PbChatGptConfig_Type[keyof PbChatGptConfig_Type]) => boolean;
  } = {
    model(x) {
      return isValidModel(x as string);
    },
    max_tokens(x) {
      return isValidNumber(x as number, 100, 4000);
    },
    presence_penalty(x) {
      return isValidNumber(x as number, -2, 2);
    },
    temperature(x) {
      return isValidNumber(x as number, 0, 2);
    },
  };

  Object.keys(validator).forEach((k) => {
    const key = k as keyof PbChatGptConfig_Type;
    if (!validator[key](config[key])) {
      delete config[key];
    }
  });

  return config;
}

export async function requestChatStream(
  messages: Message[],
  options?: {
    apiKey:string,
    filterBot?: boolean;
    modelConfig?: PbChatGptConfig_Type;
    onMessage: (message: string, done: boolean) => void;
    onAbort: (error: Error) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
  },
) {
  const req = makeRequestParam(messages, {
    stream: true,
    filterBot: options?.filterBot,
  });

  // valid and assign model config
  if (options?.modelConfig) {
    Object.assign(req, filterConfig(options.modelConfig));
  }

  console.log("[Request] ", req);

  const controller = new AbortController();
  const reqTimeoutId = setTimeout(() => controller.abort(), TIME_OUT_MS);

  try {
    const res = await fetch(AI_PROXY_API + "/api/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        path: "v1/chat/completions",
        ...getHeaders(options!.apiKey),
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(reqTimeoutId);

    let responseText = "";

    const finish = () => {
      options?.onMessage(responseText, true);
      controller.abort();
    };

    if (res.ok) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      options?.onController?.(controller);

      while (true) {
        // handle time out, will stop if no response in 10 secs
        const resTimeoutId = setTimeout(() => finish(), TIME_OUT_MS);
        const content = await reader?.read();
        clearTimeout(resTimeoutId);
        const text = decoder.decode(content?.value);
        responseText += text;

        const done = !content || content.done;
        options?.onMessage(responseText, false);

        if (done) {
          break;
        }
      }

      finish();
    } else if (res.status === 401) {
      console.error("Anauthorized");
      responseText = "Unauthorized";
      finish();
    } else {
      console.error("Stream Error", res.body);
      options?.onError(new Error("Stream Error"));
    }
  } catch (err:any) {
    if(err.code === 20){
      console.error("onAbort", err);
      options?.onAbort(err);
    }else{
      // AbortError
      console.error("NetWork Error", err);
      options?.onError(err);
    }
  }
}

export async function requestWithPrompt(messages: Message[], prompt: string,apiKey:string) {
  messages = messages.concat([
    {
      role: "user",
      content: prompt,
      date: new Date().toLocaleString(),
    },
  ]);

  const res = await requestChat(messages,apiKey);

  return res?.choices?.at(0)?.message?.content ?? "";
}

// To store message streaming controller
export const ControllerPool = {
  controllers: {} as Record<string, AbortController>,

  addController(
    sessionIndex: number,
    messageIndex: number,
    controller: AbortController,
  ) {
    const key = this.key(sessionIndex, messageIndex);
    this.controllers[key] = controller;
    return key;
  },

  stop(sessionIndex: number, messageIndex: number) {
    const key = this.key(sessionIndex, messageIndex);
    if(this.controllers[key]){
      const controller = this.controllers[key];
      console.log(controller);
      controller?.abort();
    }
  },

  remove(sessionIndex: number, messageIndex: number) {
    const key = this.key(sessionIndex, messageIndex);
    delete this.controllers[key];
  },

  key(sessionIndex: number, messageIndex: number) {
    return `${sessionIndex},${messageIndex}`;
  },
};
