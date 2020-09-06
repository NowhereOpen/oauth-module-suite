import axios, { AxiosError } from "axios"
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
    const access_token = getAccessTokenFromStrTokenData(token_data)
    return await axios.delete(`https://api.github.com/applications/${this.cred.client_id}/tokens`, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      },
      params: { access_token }
    })
  }

  /**
   * It's said that the github access_token don't expire but the following request works, response including the same token.
   */
  async refreshToken(token_data:any) {
    const access_token = getAccessTokenFromStrTokenData(token_data)
    return await axios.post(`https://api.github.com/applications/${this.cred.client_id}/tokens`, { access_token }, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromStrTokenData(token_data)
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
    const access_token = getAccessTokenFromStrTokenData(token_data)
    
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
function getAccessTokenFromStrTokenData(token_data:any) {
  const parsed_token_data = querystring.parse(token_data);
  return parsed_token_data["access_token"]
}

export function getAccessTokenFromTokenData(token_data:any) {
  if(typeof token_data == "string") {
    const access_token = getAccessTokenFromStrTokenData(token_data)
    return access_token
  }
  else {
    return token_data.token
  }
}

/**
 * https://developer.github.com/v3/#failed-login-limit
 */
export function isTokenInvalidOrExpired(e:AxiosError) {
  return e.response?.status == 401
}

export function isRefreshTokenError(e:AxiosError) {
  if(e.response!.status == 404) {
    /**
    2020-09-06 16:03
    ```
    {
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest/reference/apps#check-an-authorization'
    }
    ```
    
    404 error. But note that github access token doesn't expire. And that the url used in the refresh
    token is actually called "Check a token":
    
      - https://developer.github.com/v3/apps/oauth_applications/#check-a-token
      
     */
    return true
  }
}