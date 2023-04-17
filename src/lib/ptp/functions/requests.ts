import {ChatRequest, ChatResponse, Message} from "../../../../functions/api/types";
import {AI_PROXY_API} from "../../../config";
import {PbChatGptModelConfig_Type} from "../protobuf/PTPCommon/types";

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

export function filterConfig(oldConfig: PbChatGptModelConfig_Type): Partial<PbChatGptModelConfig_Type> {
  const config = Object.assign({}, oldConfig);

  const validator: {
    [k in keyof PbChatGptModelConfig_Type]: (x: PbChatGptModelConfig_Type[keyof PbChatGptModelConfig_Type]) => boolean;
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
    const key = k as keyof PbChatGptModelConfig_Type;
    if (!validator[key](config[key])) {
      delete config[key];
    }
  });

  return config;
}

export async function requestChatStream(
  botApi?:string,
  messages: Message[],
  options?: {
    apiKey:string,
    filterBot?: boolean;
    modelConfig?: PbChatGptModelConfig_Type;
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
    const res = await fetch(botApi ? botApi : AI_PROXY_API + "/api/chat-stream", {
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
    debugger
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

export async function requestUsage(apiKey:string) {
  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  const ONE_DAY = 2 * 24 * 60 * 60 * 1000;
  const now = new Date(Date.now() + ONE_DAY);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = formatDate(startOfMonth);
  const endDate = formatDate(now);

  const [used, subs] = await Promise.all([
    requestOpenaiClient(
      `dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
      apiKey
    )(null, "GET"),
    requestOpenaiClient("dashboard/billing/subscription",apiKey)(null, "GET"),
  ]);

  const response = (await used.json()) as {
    total_usage?: number;
    error?: {
      type: string;
      message: string;
    };
  };

  const total = (await subs.json()) as {
    hard_limit_usd?: number;
  };

  if (response.error && response.error.type) {
    console.error(response.error)
    throw new Error(response.error.type)
  }

  if (response.total_usage) {
    response.total_usage = Math.round(response.total_usage) / 100;
  }

  if (total.hard_limit_usd) {
    total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
  }

  return {
    used: response.total_usage,
    subscription: total.hard_limit_usd,
  };
}
