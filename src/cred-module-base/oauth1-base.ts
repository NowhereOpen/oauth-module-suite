import { OAuthBaseClass } from "./base"
import {
  TokenResponse, isCallbackUrlValid, getOAuthVerifier,
  createOAuthHelper, requestRequestToken, getAccessToken
} from "~/src/lib/oauth1-lib"

type _Urls = {
  request: string,
  access_token: string
  callback: string
}

type Urls = { auth: string } & _Urls

type Cred = {
  consumer_key: string
  consumer_secret: string
}

export abstract class OAuth1a extends OAuthBaseClass {
  urls:Urls
  cred:Cred
  auth_params:any
  oauth1a:any
  
  /**
   * "Token" stuff that are requested before gereating the 'auth_url' and
   * is used when retrieving the access token
   */
  request_token:string
  request_token_secret:string
  
  constructor(service_id:string, service_name:string, cred:Cred, urls:Urls, auth_params?:any) {
    super(service_id, service_name, "oauth1")
    // Set at App.vue
    this.urls = urls

    this.cred = cred
    this.auth_params = auth_params

    // After requesting for the access token
    this.request_token = "";
    this.request_token_secret = "";

    this.oauth1a = createOAuthHelper(cred.consumer_key, cred.consumer_secret, urls.request, urls.access_token, urls.callback)
  }

  validateRequestTokens():boolean {
    const contains_undefined = [this.request_token, this.request_token_secret].some(entry => [undefined, null, ""].includes(entry))
    return ! contains_undefined
  }

  async requestRequestToken() {
    const { token, token_secret } = await requestRequestToken(this.oauth1a)

    this.request_token = token
    this.request_token_secret = token_secret
  }

  async getAuthUrl():Promise<string> {
    await this.requestRequestToken()

    let full_auth_url:URL = new URL(this.urls.auth);

    full_auth_url.searchParams.append("oauth_token", this.request_token);
    for(let key in this.auth_params) {
      let value = this.auth_params[key];
      full_auth_url.searchParams.append(key, value);
    }

    return full_auth_url.href
  }

  async getTokenResponse(url:string) {
    if(! this.validateRequestTokens()) {
      console.error(`request_token: ${this.request_token}, request_token_secret: ${this.request_token_secret}`)
      throw Error(`'request_token' and 'request_token_secret' must be set. Set them manually or call 'requestRequestToken'.`)
    }

    if(! isCallbackUrlValid(url)) {
      throw Error("The passed url doesn't contain necessary query parameter 'oauth_verifier'.")
    }

    const oauth_verifier = getOAuthVerifier(url)

    return await getAccessToken(this.oauth1a, this.request_token, this.request_token_secret, oauth_verifier)
  }
}