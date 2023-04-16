import { getCorsHeader } from '../utils/utils';
import { ENV } from '../../env';

import { OpenAPIRoute } from '@cloudflare/itty-router-openapi';
import {Pdu} from "../../../lib/ptp/protobuf/BaseMsg";

export default class WaiOpenAPIRoute extends OpenAPIRoute {
	jsonResp(params: { data: Record<string, any>; status?: number }): Response {
		return new Response(JSON.stringify(params.data), {
			headers: {
				...getCorsHeader(ENV.Access_Control_Allow_Origin),
			},
			status: params.status || 200,
		});
	}

  static responseError(error = '',status=500) {
    return WaiOpenAPIRoute.responseJson({error,status},status)
  }

  static responseJson(data:object,status=200){
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        ...getCorsHeader(ENV.Access_Control_Allow_Origin),
      },
    });
  }
  static responseBuffer(data:Buffer,status=200){
    return new Response(data, {
      status,
      headers: {
        ...getCorsHeader(ENV.Access_Control_Allow_Origin, "application/octet-stream"),
      },
    });
  }
  static responsePdu(data:Pdu,status=200){
    return WaiOpenAPIRoute.responseBuffer(Buffer.from(data.getPbData()),status)
  }
}
