import { OAuth } from 'oauth';

export type TokenResponse = { token:string, token_secret:string }

export function isOAuth1CallbackUrlValid(url:string):boolean {
  let _url = new URL(url)
  const lookup_value = _url.searchParams.get("oauth_verifier")
  const contains_invalid_value = [undefined, null, ""].includes(lookup_value)
  return ! contains_invalid_value
}

export function getOAuthVerifier(url:string):string {
  let _url = new URL(url)
  const lookup_value = <string> _url.searchParams.get("oauth_verifier")
  return lookup_value
}

export function createOAuthHelper(consumer_key:string, consumer_secret:string, request_url:string, access_token_url:string, callback_url:string) {
  let oauth_version = "1.0a";
  let oauth_signature_method = "HMAC-SHA1";
  
  let oauth1a = new OAuth(
    request_url,
    access_token_url,
    consumer_key,
    consumer_secret,
    oauth_version,
    callback_url,
    oauth_signature_method
  )

  return oauth1a;
}

export function requestRequestToken(oauth1a_helper:OAuth): Promise<{ token:string, token_secret:string }> {
  return new Promise((resolve, reject) => {
    oauth1a_helper.getOAuthRequestToken((err:any, token:string, token_secret:string, q:any) => {
      if(err) {
        /**
         * E.g., changed redirect uri
         */
        console.error(err);
        throw err
      }

      resolve({ token, token_secret });
    });
  })
}

export function getAccessToken(oauth1a_helper:OAuth, request_token:string, request_token_secret:string,oauth_verifier:string
):Promise<{ oauth_token:string, oauth_token_secret:string }>
{
  return new Promise((resolve, reject) => {
    /**
     * Throws `cannot read property 'getOAuthAccessToken' of null` when the server was built while the browser in "/oauth". Refreshing fixes it.
     */
    oauth1a_helper.getOAuthAccessToken(request_token, request_token_secret, oauth_verifier,
      /**
       * Refer to: https://github.com/ciaranj/node-oauth/blob/a7f8a1e21c362eb4ed2039431fb9ac2ae749f26a/lib/oauth.js#L456
       * 
       * for the name of the parameters and return property names.
       */
      (err:any, oauth_token:string, oauth_token_secret:string, results:any) => {
        if(err) {
          console.error(err);
          return reject(err);
        }

        return resolve({ oauth_token, oauth_token_secret });
      }
    )
  })
}