import _ from "lodash"
import axios, { AxiosError } from "axios"
import * as querystring from "querystring"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"
import { getAccessTokenFromTokenDataSimple } from "~/src/lib/utility"

export class Bitbucket extends OAuth2 {
  oauth2_request:any
  oauth_setting:any

  constructor(client_id:string, client_secret:string) {
    super(
      "bitbucket", "Bitbucket",
      { client_id, client_secret },
      {
        auth: "https://bitbucket.org/site/oauth2/authorize",
        token: "https://bitbucket.org/site/oauth2/access_token",
      },
      {
        shared: { "client_id": client_id },
        /**
         * - https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html
         * - https://developer.atlassian.com/cloud/bitbucket/oauth-2/
         */
        auth: { "response_type": "code" },
        token: {
          "client_secret": client_secret,
          "grant_type": "authorization_code",
          "code": ""
        }
      },
      {
        method: "POST",
        data_type: "FORM_DATA",
        is_oauth_header: false
      }
    )
  }

  async revokeToken(token_data:any) {
    return {
      redirect_url: "https://bitbucket.org/account"
    };
  }
  
  async refreshToken(token_data:any) {
    let refresh_token = token_data["refresh_token"]
    let url = new URL("https://bitbucket.org/site/oauth2/access_token")
    let fields = querystring.stringify({
      grant_type: "refresh_token",
      refresh_token
    })

    return await axios.post(url.href, fields, {
      auth: {
        username: this.cred.client_id,
        password: this.cred.client_secret
      }
    })
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    const { data } = await axios.get("https://api.bitbucket.org/2.0/user", {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    })
    return data
  }

  resDataToUserInfo(res_data:any) {
    return {
      user_uid: res_data.account_id,
      user_id: res_data.username,
      friendly_name: res_data.display_name,
      json_content: res_data
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    return await makeApiRequest(method, url, {
      baseURL: "https://api.bitbucket.org/2.0/",
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    }, req_data)
  }
  
  errorCanBeFixedByRefreshToken(e:AxiosError) {
    return _.get(e, "response.status") == 401
  }
}

/**
 * https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/#OAuthonBitbucketCloud-Refreshtokens
 */
export function isTokenInvalidOrExpired(e:AxiosError) {
  if(e.response!.status == 401) {
    return true
  }

  return false
}

export function getAccessTokenFromTokenData(token_data:any) {
  return getAccessTokenFromTokenDataSimple(token_data)
}

export function isRefreshTokenError(e:AxiosError) {
  if(e.response!.status == 400) {
    /**
    2020-09-06 15:50
    
    https://developer.atlassian.com/cloud/bitbucket/oauth-2/
    
    Cannot find error status detail.
    
    ```
    {
      error_description: 'Invalid refresh_token',
      error: 'invalid_request'
    }
    ```
     */
    return true
  }
}