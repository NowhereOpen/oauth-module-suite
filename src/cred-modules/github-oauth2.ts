import axios from "axios"
import * as querystring from "querystring"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"

export class Github extends OAuth2 {
  constructor(client_id:string, client_secret:string, redirect_uri:string) {
    super(
      "github", "Github",
      { client_id, client_secret },
      {
        auth: "https://github.com/login/oauth/authorize",
        token: "https://github.com/login/oauth/access_token",
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": redirect_uri,
          "state":"",
        },
        /**
         * https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#1-request-a-users-github-identity
         */
        auth: { scope: "repo" },
        token: {
          "client_secret": client_secret,
          "code": ""
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
    const access_token = getAccessTokenFromTokenResponse(token_data)
    return await axios.delete(`https://api.github.com/applications/${this.cred.client_id}/tokens/${access_token}`, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })
  }

  /**
   * It's said that the github access_token don't expire but the following request works, response including the same token.
   */
  async refreshToken(token_data:any) {
    const access_token = getAccessTokenFromTokenResponse(token_data)
    return await axios.get(`https://api.github.com/applications/${this.cred.client_id}/tokens/${access_token}`, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenResponse(token_data)
    const axios_config:any = {
      headers: {
        Authorization: `token ${access_token}`
      },
      baseURL: "https://api.github.com",
      url: "user", method: "get"
    }

    const { data } = await axios(axios_config)
    return data
  }

  resDataToUserInfo(res_data:any) {
    return {
      user_uid: res_data.id,
      user_id: res_data.login,
      json_content:res_data
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenResponse(token_data)
    
    return await makeApiRequest(method, url, {
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${access_token}`
      }
    }, req_data)
  }
}

/**
 * Github sends a string type that can be parsed with `querystring` module
 * when requesting a token, but returns JSON when refreshing the token.
 */
function getAccessTokenFromTokenResponse(token_data:any) {
  const parsed_token_response = querystring.parse(token_data);
  return parsed_token_response["access_token"]
}