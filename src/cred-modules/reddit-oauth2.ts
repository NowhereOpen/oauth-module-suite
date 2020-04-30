import axios from "axios"
import * as querystring from "querystring"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"

export class Reddit extends OAuth2 {
  user_agent:string

  constructor(client_id:string, client_secret:string, user_agent:string, redirect_uri:string) {
    super(
      "reddit", "Reddit",
      { client_id, client_secret },
      {
        auth: "https://www.reddit.com/api/v1/authorize",
        token: "https://www.reddit.com/api/v1/access_token",
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": redirect_uri
        },
        // https://github.com/reddit-archive/reddit/wiki/oauth2#authorization
        auth: {
          "response_type": "code",
          "state": "abc",
          "duration": "permanent",
          "scope": "read identity"
        },
        token: {
          "client_secret": client_secret,
          "code": "",
          "grant_type": "authorization_code"
        },
      },
      {
        method: "POST",
        data_type: "URL_ENCODED",
        is_oauth_header: true
      }
    )

    this.user_agent = user_agent
  }

  async getUserInfo(token_data:any) {
    const access_token = token_data["access_token"]
    const { data } = await axios({
      method: "get", baseURL: "https://oauth.reddit.com", url: "api/v1/me",
      headers: {
        Authorization: `bearer ${access_token}`,
        "User-Agent": this.user_agent
      },
    })

    return data
  }

  resDataToUserInfo(res_data:any) {
    return {
      user_uid: res_data.id,
      user_id: res_data.name,
      json_content: res_data
    }
  }

  /**
   * https://github.com/reddit-archive/reddit/wiki/OAuth2#manually-revoking-a-token
   */
  async revokeToken(token_response:any) {
    let url = new URL("https://www.reddit.com/api/v1/revoke_token");
    let at = token_response["refresh_token"]
    let fields = querystring.stringify({
      "token": at,
      "token_type_hint": "refresh_token"
    })
    url.searchParams.append("token", at);

    return await axios.post(url.href, fields, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })
  }

  async refreshToken(token_response:any) {
    let refresh_token = token_response["refresh_token"]
    let url_str = "https://www.reddit.com/api/v1/access_token";
    let fields = querystring.stringify({
      refresh_token,
      grant_type: "refresh_token"
    })

    const { data } = await axios.post(url_str, fields, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })

    /**
     * Google oauth2 also doesn't return 'refresh_token' in the response of the
     * refresh token request. ... Need to update refreshToken to return the exact
     * data structure that will be stored into the storage?
     */
    return Object.assign(token_response, data)
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = token_data["access_token"]
    
    /**
     * Different apis seems to have different conventions. YouTube uses `headers` and
     * google calednar uses `params`, for example.
     */
    return await makeApiRequest(method, url, {
      baseURL: "https://oauth.reddit.com",
      headers: {
        Authorization: `bearer ${access_token}`,
        "User-Agent": this.user_agent
      },
    }, req_data)
  }
}