/**
 * Refer to:
 *   * https://developers.trello.com/page/authorization
 * for authorization url parameters and OAuth guide.
 * 
 * 
 */
import axios, { AxiosError } from "axios"

import { OAuth1a } from "~/src/cred-module-base/oauth1-base"
import { makeApiRequest } from "~/src/lib/api-request"

export class Trello extends OAuth1a {
  constructor(consumer_key:string, consumer_secret:string, redirect_uri:string) {
    super(
      "trello", "Trello",
      { consumer_key, consumer_secret },
      {
        request: "https://trello.com/1/OAuthGetRequestToken",
        auth: "https://trello.com/1/OAuthAuthorizeToken",
        access_token: "https://trello.com/1/OAuthGetAccessToken",
        // https://developers.trello.com/page/authorization#section-1authorize-route-options
        callback: redirect_uri,
      },
      { "scope": "read,write", "expiration": "30days", "name": "Testing app" }
    )
  }

  async revokeToken(token_data:any) {
    let access_token:string = getAccessTokenFromTokenData(token_data)
    
    return await axios.delete(`https://api.trello.com/1/tokens/${access_token}`, {
      params: {
        token: access_token, key: this.cred.consumer_key
      }
    })
  }

  refreshToken() {
    // Cannot refresh. User needs to re-authorize.
    console.log("Trello doesn't require refreshing if access token was retrieved with 'expiration=never'. Please check the code or setting.")
    return Promise.resolve(undefined)
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    const { data } = await axios({
      method: "get", url: "members/me",
      params: {
        key: this.cred.consumer_key,
        token: access_token,
      },
      baseURL: "https://api.trello.com/1"
    })

    return data
  }

  resDataToUserInfo(res_data:any) {
    return {
      user_uid: res_data.id,
      user_id: res_data.username,
      friendly_name: res_data.fullName,
      json_content: res_data
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    /**
     * Different apis seems to have different conventions. YouTube uses `headers` and
     * google calednar uses `params`, for example.
     */
    return await makeApiRequest(method, url, {
      baseURL: "https://api.trello.com/1",
      params: {
        key: this.cred.consumer_key,
        token: access_token,
      },
    }, req_data)
  }
}

/**
 * Trello token doesn't expire
 * 
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/#revoking-tokens
 */
export function isTokenInvalid(e:AxiosError) {
  return e.response?.status == 401
}

export function getAccessTokenFromTokenData(token_data:any) {
  return token_data.oauth_token
}