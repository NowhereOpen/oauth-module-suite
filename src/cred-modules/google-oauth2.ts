import axios, { AxiosError } from "axios"
import * as querystring from "querystring"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"
import { getAccessTokenFromTokenDataSimple } from "~/src/lib/utility"

/**
 * Extend OAuth2BaseClass to make use of its oauth2 token retrieving methods
 */
export class Google extends OAuth2 {
  constructor(client_id:string, client_secret:string, redirect_uri:string) {
    super(
      "google", "Google",
      { client_id, client_secret },
      {
        auth: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://www.googleapis.com/oauth2/v4/token",
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": redirect_uri
        },
        // https://developers.google.com/identity/protocols/OAuth2WebServer#creatingclient
        auth: {
          "response_type": "code",
          "state": "",
          "include_granted_scopes": "",
          "access_type": "offline", // Makes the server return 'refresh token'
          // Space delimited: https://developers.google.com/identity/protocols/OAuth2UserAgent#obtainingaccesstokens
          "scope": [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/youtube",
            
            // For viewing comments
            "https://www.googleapis.com/auth/youtube.force-ssl",

            // For user info
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email"
          ].join(" ")
        },
        token: {
          "client_secret": client_secret,
          "code": "",
          "grant_type": "authorization_code"
        },
      },
      {
        method: "POST",
        data_type: "QUERY_PARAM",
        is_oauth_header: false
      }
    )
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    const { data } = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", { params: { access_token } })
    return data
  }

  resDataToUserInfo(res_data:any) {
    /**
     * https://developers.google.com/identity/protocols/OpenIDConnect#server-flow
     * 
     * Scroll down to "An ID token's payload"
     */
    return {
      user_uid: res_data.sub,
      friendly_name: res_data.name,
      user_id: res_data.email,
      json_content: res_data
    }
  }

  /**
   * 
   * @param token Can be either access_token or refresh_token, but the refresh_token or
   *              refresh_token corresponding to the access_token will be revoked
   *              (Refer to [here](https://developers.google.com/identity/protocols/OAuth2WebServer#tokenrevoke)).
   */
  revokeToken(token_data:any) {
    let access_token = getAccessTokenFromTokenData(token_data)
    let url = new URL("https://accounts.google.com/o/oauth2/revoke");
    url.searchParams.append("token", access_token);
    return axios.get(url.href)
  }

  async refreshToken(token_data:any) {
    let refresh_token = token_data["refresh_token"]

    /**
     * 2020-05-19 01:28
     * 
     * Note that the response doesn't include the used `refresh_token` for Google and Reddit refresh token API reseponse.
     */
    return await this._refreshToken(refresh_token)
  }

  /**
   * Refactored for convenience. `refreshToken` uses the refresh token to refresh while `testToken` uses the
   * access token to refresh.
   * 
   * The following is the behavior of google's oauth2 when refresh vs access token is used:
   * 
   * When the access token is used, the refresh token api won't refresh the `refresh_token` associated with
   * the passed `access_token`, but return a response with the value how long the access token will be alive
   * for in `expires_in` property.
   * 
   * Note that with `refresh_token` used with the refresh token API, it will refresh the token, return a new `access_token`
   * and the `expires_in` will always be greater than `3598`.
   * 
   * @param refresh_token refresh_token instead of the refresh_token
   */
  private _refreshToken(refresh_token:any) {
    let url_str = "https://www.googleapis.com/oauth2/v4/token";
    let fields = querystring.stringify({
      // requires `refresh_token=` parameter.
      refresh_token,
      client_id: this.cred.client_id,
      client_secret: this.cred.client_secret,
      grant_type: "refresh_token"
    })

    return axios.post(url_str, fields)
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    /**
     * Different apis seems to have different conventions. YouTube uses `headers` and
     * google calednar uses `params`, for example.
     */
    return await makeApiRequest(method, url, {
      baseURL: "https://www.googleapis.com/",
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    }, req_data)
  }
}

/**
 * YouTube:
 * 
 *   - https://developers.google.com/youtube/v3/docs/errors#youtube.api.RequestContextError
 * 
 * Google Calendar:
 * 
 *   - https://developers.google.com/calendar/v3/errors#401_invalid_credentials
 */
export function isTokenInvalidOrExpired(e:AxiosError) {
  return e.response?.status == 401
}

export function getAccessTokenFromTokenData(token_data:any) {
  return getAccessTokenFromTokenDataSimple(token_data)
}