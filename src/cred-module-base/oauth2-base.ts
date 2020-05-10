import { OAuthBaseClass } from "./base"
import {
  getAuthorizationUrl,
  requestToken,
  isOAuth2CallbackUrlValid,
  getCodeQueryParam,
  TokenRequestMethod,
  TokenRequestDataType
} from "~/src/lib/oauth2-lib"

/**
 * Responsible for getting the access token.
 * NOT responsible for revoking, refreshing, etc.
 * 
 * Do NOT extend this any further just to satify the requirements
 * of a new service. If the new service can't utilize this class
 * without minimal modification, consider using its own
 * implementation to retrieve `auth_url` and `access_token`.
 */

type OAuthParams = {
  shared?:any
  auth?:any
  token?:any
}

type Urls = {
  auth: string
  token: string
}

type Cred = {
  client_id: string
  client_secret: string
}

export type TokenRequestDetails = {
  method:TokenRequestMethod
  data_type:TokenRequestDataType
  is_oauth_header: boolean
}
export type axios_auth_header = { username:string, password:string }

export abstract class OAuth2 extends OAuthBaseClass {
  cred:Cred
  urls:Urls
  params:OAuthParams

  token_request_details:TokenRequestDetails

  constructor(service_id:string, service_name:string, cred:Cred, urls: Urls, params:OAuthParams, token_request_details:TokenRequestDetails) {
    super(service_id, service_name, "oauth2")
    this.cred = cred
    this.urls = urls
    this.params = params
    this.token_request_details = token_request_details
  }

  /**
   * Main API
   * 
   * Return the authrozation url that the user needs to visit to click on 'allow access'.
   * This is created from the `shared` and `auth`.
   * 
   * The key-value pair simply converted into `auth_url` with parameters.
   */
  public getAuthUrl():string {
    const params = Object.assign({}, this.params.shared, this.params.auth)
    return getAuthorizationUrl(this.urls.auth, params)
  }

  /**
   * Main API for getting the `access_token`.
   * 
   * @param code 
   * @param method It's usually "POST" but there are special cases like Facebook, which uses "GET"
   * @param data_type 
   * @param auth_header 
   */
  async getTokenResponse(url:string):Promise<any>
  {
    if(! isOAuth2CallbackUrlValid(url)) {
      throw Error()
    }

    const code:string = getCodeQueryParam(url)

    const { method, data_type } = this.token_request_details
    const params = Object.assign({}, this.params.shared, this.params.token)

    /**
     * 2020-03-03 00:11
     * 
     * OAuth1 uses a module which is not encapsulated in `{ data }` unlike axios response.
     * If this destructuring becomes a problem or there needs to be a use case where the
     * axios response is ALSO needed, found another approach.
     */
    const { data } = await requestToken(
      this.cred,
      { data_type, method, url: this.urls.token, params },
      code,
      { is_oauth_header: this.token_request_details.is_oauth_header }
    )

    return data
  }
}