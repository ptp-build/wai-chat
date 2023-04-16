import { initEnv } from './env';
import { handleEvent } from './route';
addEventListener('fetch', async (event: FetchEvent) => {
	initEnv(global);
	// @ts-ignore
	event.respondWith(handleEvent(event));
});



