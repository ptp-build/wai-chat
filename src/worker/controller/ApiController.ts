import WaiOpenAPIRoute from "../share/cls/WaiOpenAPIRoute";
import {randomize} from "worktop/utils";
import {Int,Query} from "@cloudflare/itty-router-openapi";

export class RandomController extends WaiOpenAPIRoute{
  static schema = {
    tags: ['Utils'],
    parameters: {
      length: Query(Int, {
        description: 'Random key length',
        default:16
      }),
    },
    responses: {
      '200': {
        schema: {},
      },
    },
  };

  async handle(request: Request, data: Record<string, any>) {
    const len = data.length;
    return {
      random:Buffer.from(randomize(len)).toString("hex"),
      len
    }
  }
}
