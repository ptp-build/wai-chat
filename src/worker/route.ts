import ProtoController from './controller/ProtoController';
import { OpenAPIRouter } from '@cloudflare/itty-router-openapi';
import {ENV, initEnv} from './env';
import { SWAGGER_DOC } from './setting';
import {getCorsHeader, ResponseJson} from "./share/utils/utils";
import {RandomController} from "./controller/ApiController";

const router = OpenAPIRouter(SWAGGER_DOC);

router.all('*', async (request: Request) => {
	const { WAI_WORKER_API_TOKEN, IS_PROD } = ENV;
  if (request.method === 'OPTIONS') {
    return new Response('', {
      headers: {
        ...getCorsHeader(ENV.Access_Control_Allow_Origin),
      },
    });
  }

  if (IS_PROD && request.url.includes('/api/')) {
		if (
			!WAI_WORKER_API_TOKEN ||
			request.headers.get('Authorization') !== `Bearer ${WAI_WORKER_API_TOKEN}`
		) {
			return ResponseJson({
				err_msg: 'invalid token',
			});
		}
	}
});

router.original.get('/', request => Response.redirect(`${request.url}docs`, 302));
router.post('/proto', ProtoController);
router.get('/utils/random', RandomController);
router.all('*', () => new Response('Not Found.', { status: 404 }));

export async function handleEvent({request}) {

	return await router.handle(request);
}
