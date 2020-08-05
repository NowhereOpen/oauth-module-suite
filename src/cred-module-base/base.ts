import { AxiosResponse } from "axios"

export type OAuthType = "oauth1" | "oauth2"

export type UserInfo = {
  user_uid: string
  friendly_name?: string
  user_id?: string,
  json_content: any
}

/**
 * Abstract class for OAuth implementation for services.
 * 
 * `oauth1-base` and `oauth2-base` extends this function, and these classes are used
 * by modules defined in `~/lib/gyst/services/<service name>/authorization/`.
 * 
 * 2019-08-22 20:05 No need to use `username` because they work with token data
 * which is already retrieved with `username`.
 */
export abstract class OAuthBaseClass {
  oauth_type:OAuthType
  service_id:string
  service_name:string
  constructor(service_id:string, service_name:string, oauth_type:OAuthType) {
    this.service_id = service_id
    this.service_name = service_name
    this.oauth_type = oauth_type
  }
  /**
   * `string` type is returned from OAuth2 types and
   * 
   * `Promise<string>` type is returned from OAuth1 because
   * OAuth1 needs to send another request that retrieves `token` and
   * `token secret`. The `token` is used in the auth url.
   * 
   * oauth 1.0 uses `user_id` parameter for storing oauth1 token and
   * token secret retrieved for getting auth url.
   */
  public abstract getAuthUrl():string|Promise<any>;
  public abstract getTokenResponse(url:string):Promise<any>;
  /**
   * Return `undefined` if service doesn't refresh token.
   * 
   * Unless undefined or null, the returned value will be saved into the access token storage.
   * 
   * 2020-05-19 01:20
   * 
   * Return axios response instead of `{ data }`. The client code should know about this. Else,
   * the module can return `{ data, raw_response }` or something. 
   * 
   * @param token_data 
   */
  public abstract refreshToken(token_data:any):Promise<AxiosResponse|undefined|any>;
  /**
   * Services like 'bitbucket' doesn't have a revoke API. User needs to invalidate it from a
   * user setting page on the service.
   */
  public abstract revokeToken(token_data:any):Promise<any|{redirect_url: string}>;

  /**
   * 2020-03-02 23:54
   * 
   * The return value must be a "user_info", so map and modify, say, the axios response in
   * this method. For example, the twitter (oauth1) is the only service that doesn't need
   * modification because it uses a module to make request, and its response can be used
   * as "user_info" directly.
   * 
   * So, `const { data } = await axios(...)` is repeated in all the other modules
   * except twitter oauth1 module. However if this part becomes the common source of error,
   * then this needs another approach such as having `getUserInfoImpl` as abstract method
   * and `getUserInfo` getting responpse from it and return the `data` property. Then those
   * tricky modules like twitter oauth1 module can override it so that the response from
   * `getUserInfoImpl` is returned as it is, or handle error differently, etc.
   */
  public abstract getUserInfo(token_data:any): Promise<any>

  /**
   * 2020-03-03 00:01
   * 
   * I forgot why this was separated into `lib/gyst/oauth/res-data-to-user-info.ts` in the
   * 2020-w-6 version.
   */
  public abstract resDataToUserInfo(res_data:any): UserInfo

  public abstract makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any>
}