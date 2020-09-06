import axios, { AxiosError } from "axios"
import * as querystring from "querystring"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"
import { getAccessTokenFromTokenDataSimple } from "~/src/lib/utility"

export class Twitch extends OAuth2 {
  constructor(client_id:string, client_secret:string, redirect_uri:string) {
    super(
      "twitch", "Twitch",
      { client_id, client_secret },
      {
        auth: "https://id.twitch.tv/oauth2/authorize",
        token: "https://id.twitch.tv/oauth2/token",
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": redirect_uri
        },
        // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
        auth: {
          "response_type": "code",
          "scope": "user:edit channel:read:subscriptions moderation:read user:read:email",
          force_verify: true,
        },
        token: {
          "client_secret": client_secret,
          "grant_type": "authorization_code",
        },
      },
      {
        method: "POST",
        data_type: "QUERY_PARAM",
        is_oauth_header: false
      }
    )
  }

  async revokeToken(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    return await axios.post("https://id.twitch.tv/oauth2/revoke", null, {
      params: {
        client_id: this.cred.client_id,
        token: access_token
      }
    })
  }
  
  async refreshToken(token_data:any) {
    const data = querystring.stringify({
      grant_type: "refresh_token",
      refresh_token: token_data["refresh_token"],
      client_id: this.cred.client_id,
      client_secret: this.cred.client_secret
    })

    return await axios.post("https://id.twitch.tv/oauth2/token", data)
  }

  async getUserInfo(token_data:any) {
    const { data } = await this.makeApiRequest(token_data, "get", "users")
    return data
  }

  resDataToUserInfo(res_data:any) {
    const user_info = res_data.data[0]
    return {
      user_uid: user_info.id,
      user_id: user_info.login,
      friendly_name: user_info.display_name,
      json_content: user_info
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    /**
     * Different apis seems to have different conventions. YouTube uses `headers` and
     * google calednar uses `params`, for example.
     */
    return await makeApiRequest(method, url, {
      baseURL: "https://api.twitch.tv/helix",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Client-Id": this.cred.client_id
      },
    }, req_data)
  }
}

/**
 * https://dev.twitch.tv/docs/authentication/#refresh-in-response-to-server-rejection-for-bad-authentication
 */
export function isTokenInvalidOrExpired(e:AxiosError) {
  return e.response?.status ==  401
}

export function getAccessTokenFromTokenData(token_data:any) {
  return getAccessTokenFromTokenDataSimple(token_data)
}


export function isRefreshTokenError(e:AxiosError) {
  if(e.response!.status == 400) {
    /**
    2020-09-06 17:05
    
    400 error
    
    ```
    { status: 400, message: 'Invalid refresh token' }

    ```
    
    for both gibberish and token revoked from `https://www.twitch.tv/settings/connections`
     */
    return true
  }
}