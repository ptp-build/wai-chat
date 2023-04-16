
// Set  / responses
export const onRequest: PagesFunction = async ({ request,next ,env}) => {
  const url = new URL(request.url)
  if(env['IS_DEV'] === 'true' && url.pathname === "/"){
    return new Response(
      JSON.stringify({
        hello: "world",
      }),
      {
        status:200,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }else{
    return await next();
  }
};
