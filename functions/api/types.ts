import type {
  ChatCompletionResponseMessage,
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
} from "openai";


export type Message = ChatCompletionResponseMessage & {
  date: string;
  streaming?: boolean;
};

export type ChatRequest = CreateChatCompletionRequest;
export type ChatResponse = CreateChatCompletionResponse;
