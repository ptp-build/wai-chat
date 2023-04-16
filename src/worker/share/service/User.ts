import {kv,ENV} from "../../env";

export async function genUserId() {
  let value = await kv.get('USER_INCR', true);
  if (!value) {
    value = parseInt(ENV.USER_ID_START);
  } else {
    value = parseInt(value) + 1;
  }
  await kv.put('USER_INCR', value.toString());
  return value.toString();
}
