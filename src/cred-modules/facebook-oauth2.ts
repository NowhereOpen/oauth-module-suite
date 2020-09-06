import axios, { AxiosError } from "axios"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"
import { getAccessTokenFromTokenDataSimple } from "~/src/lib/utility"

export class Facebook extends OAuth2 {
  constructor(client_id:string, client_secret:string, redirect_uri:string) {
    super(
      "facebook", "Facebook",
      { client_id, client_secret },
      {
        auth: "https://www.facebook.com/v3.2/dialog/oauth",
        token: "https://graph.facebook.com/v3.2/oauth/access_token", 
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": `${redirect_uri}/`,
          "state": ""
        },
        /**
         * https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
         * 
         *   - response_type. response_type=code is default
         *   - scope. Refer to [this](https://developers.facebook.com/docs/facebook-login/permissions/) page
         *     for scope reference.
         */
        auth: {},
        token: {
          "client_secret": client_secret,
          "code": ""
        },
      },
      {
        method: "GET",
        data_type: "QUERY_PARAM",
        is_oauth_header: false
      }
    )
  }

  /**
   * https://developers.facebook.com/docs/facebook-login/permissions/requesting-and-revoking/#revoking
   */
  async revokeToken(token_data:any) {
    let at = getAccessTokenFromTokenData(token_data)
    let url = new URL(`https://graph.facebook.com/me/permissions`)
    url.searchParams.append("access_token", at);

    return await axios.delete(url.href)
  }
  
  /**
   * https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing
   * 
   * Doesn't refresh a 'long lived token' it seems, instead it gives an updated 'expired at'
   */
  async refreshToken(token_data:any) {
    let at = getAccessTokenFromTokenData(token_data)

    return await axios.get("https://graph.facebook.com/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: this.cred.client_id,
        client_secret: this.cred.client_secret,
        fb_exchange_token: at,
      }
    })
  }

  /**
   * https://developers.facebook.com/docs/facebook-login/permissions/requesting-and-revoking/#checking
   */
  async __checkUserPermissions(token_data:any) {
    let at = getAccessTokenFromTokenData(token_data)

    try {
      const { data } = await axios.get(`https://graph.facebook.com/me/permissions`, {
        params: { access_token: at }
      })
      console.log(data);
      console.log(`debug token successful`);
    }
    catch(e) {
      console.error(e)
      console.log(`debug failed`);
    }
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    const { data } = await axios.get("https://graph.facebook.com/me", {
      params: { access_token: access_token }
    })

    return data
  }

  resDataToUserInfo(res_data:any) {
    return {
      json_content: res_data,
      user_uid: res_data.id,
      friendly_name: res_data.name
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    return await makeApiRequest(method, url, {
      baseURL: "https://graph.facebook.com",
      params: { access_token }
    }, req_data)
  }
}

/**
 * https://developers.facebook.com/docs/facebook-login/access-tokens/debugging-and-error-handling/?locale=en_US#expiredtokens
 * 
 * Doesn't mention 401 status code, but the actually response uses 401 status code and the response structure is:
 * 
 * ```
 * {
 *   error: {
 *     message, code, error_subcode ... etc
 *   }
 * }
 * ```
 */
//

export function isTokenExpired(e:AxiosError) {
  return isErrorSubcode(e, 436)
}

export function isInvalidToken(e:AxiosError) {
  return isErrorSubcode(e, 460)
}

function isErrorSubcode(e:AxiosError, subcode:number) {
  const error = e.response?.data.error
  return error.code == 190 && error.error_subcode == subcode
}

export function getAccessTokenFromTokenData(token_data:any) {
  return getAccessTokenFromTokenDataSimple(token_data)
}

export function isRefreshTokenError(e:AxiosError) {
  if(e.response!.status == 404) {
    /**
    2020-09-06 16:00
    
    https://developer.atlassian.com/cloud/bitbucket/oauth-2/
    
    Cannot find error status detail.
    
    With 'gibberish' access token:
    ```
    {
      error: {
        message: 'Invalid OAuth access token.',
        type: 'OAuthException',
        code: 190,
        fbtrace_id: '...'
      }
    }
    ```
    
    With access token with one character difference:
    ```
    {
      error: {
        message: 'The access token could not be decrypted',
        type: 'OAuthException',
        code: 190,
        fbtrace_id: '...'
      }
    }
    ```
    
    all 400
     */
    return true
  }
}