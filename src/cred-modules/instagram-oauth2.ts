/**
 * 2020-08-01 02:53
 * 
 * There are short lived and long lived, and only the long lived access token
 * can be refreshed.
 * 
 * Short lived lasts for 1 hour can be used only once. The overview page says the
 * long lived ones last 60 days and can be refreshed before they expire.
 * 
 * References for everything:
 * 
 *   - https://developers.facebook.com/docs/instagram-basic-display-api/reference
 */

import axios, { AxiosError } from "axios"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"
import { getAccessTokenFromTokenDataSimple } from "~/src/lib/utility"

export class Instagram extends OAuth2 {
  /**
   * 
   * @param client_id 
   * @param client_secret 
   * @param redirect_uri Note! Sensitive to trailing `/` and the protocol `http` vs `https`.
   */
  constructor(client_id:string, client_secret:string, redirect_uri:string) {
    super(
      "instagram", "Instagram",
      { client_id, client_secret },
      {
        auth: "https://api.instagram.com/oauth/authorize",
        // Retreives a short-lived access token
        token: "https://api.instagram.com/oauth/access_token", 
      },
      {
        shared: {
          "client_id": client_id,
          "redirect_uri": redirect_uri,
        },
        /**
         * https://developers.facebook.com/docs/instagram-basic-display-api/reference/oauth-authorize
         */
        auth: {
          response_type: "code",
          // `user_profile` is REQUIRED
          scope: "user_profile,user_media",
          state: "",
        },
        /**
         * https://developers.facebook.com/docs/instagram-basic-display-api/reference/oauth-access-token
         */
        token: {
          "client_secret": client_secret,
          grant_type: "authorization_code",
          "code": "",
        },
      },
      {
        method: "POST",
        data_type: "URL_ENCODED",
        is_oauth_header: false
      }
    )
  }

  async getTokenResponse(url:string) {
    /**
     * 2020-08-01 03:55
     * 
     * Has no 'expires_in`
     */
    const short_lived_token_data = await super.getTokenResponse(url)
    const short_lived_access_token = short_lived_token_data.access_token

    /**
     * 2020-08-01 03:50 
     * 
     * Exchange a short lived token for long lived one.
     */
    const response = await axios.get("https://graph.instagram.com/access_token", {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: this.cred.client_secret,
        access_token: short_lived_access_token
      }
    })

    /**
     * 2020-08-01 03:55
     * 
     * Has 'expires_in` and is `5184000`. Note that it's in seconds, and it's 60 days
     */
    const token_resposne = response.data

    return token_resposne
  }

  async revokeToken(token_data:any) {
    return {
      redirect_url: "https://www.instagram.com/accounts/manage_access/"
    };
  }
  
  /**
   * Has a long term access token and a short one. The 
   */
  async refreshToken(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)

    /**
     * https://developers.facebook.com/docs/instagram-basic-display-api/reference/refresh_access_token
     * access_token=long lived token
     */
    return await axios.get("https://graph.instagram.com/refresh_access_token", {
      params: {
        grant_type: "ig_refresh_token",
        /**
         * 2020-08-01 03:57
         * Needs to be unexpired access token? WTF?
         */
        access_token,
      }
    })
  }

  async getUserInfo(token_data:any) {
    const access_token = getAccessTokenFromTokenData(token_data)
    const { data } = await axios.get("https://graph.instagram.com/me", {
      params: { access_token: access_token, fields: "id,username,media_count,account_type" }
    })

    return data
  }

  resDataToUserInfo(res_data:any) {
    // https://developers.facebook.com/docs/instagram-basic-display-api/reference/user
    return {
      json_content: res_data,
      user_uid: res_data.id,
      friendly_name: res_data.username
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token = getAccessTokenFromTokenData(token_data)
    
    return await makeApiRequest(method, url, {
      baseURL: "https://graph.instagram.com",
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

// export function isTokenExpired(e:AxiosError) {
//   return isErrorSubcode(e, 436)
// }

// export function isInvalidToken(e:AxiosError) {
//   return isErrorSubcode(e, 460)
// }

// function isErrorSubcode(e:AxiosError, subcode:number) {
//   const error = e.response?.data.error
//   return error.code == 190 && error.error_subcode == subcode
// }

export function getAccessTokenFromTokenData(token_data:any) {
  return getAccessTokenFromTokenDataSimple(token_data)
}

async function main() {
  const instance = new Instagram(<string>process.env.CLIENT_ID, <string>process.env.CLIENT_SECRET, "https://localhost:3000/oauth/instagram/callback")

  function testUrl() {
    const url = instance.getAuthUrl()
    console.log(url)
  }

  async function testTokenResponse() {
    try {
      const response = await instance.getTokenResponse("https://localhost:3000/oauth/instagram/callback?code=AQBveeuQOlDTCoZJloeBoBefgMl4HZ_Z8AIXiUzwWeMfo4VtL7vU1a-ZwY6Uypcs7zWXB-jxVWwSjawIVdOcxUB8nI-TcYdS9FVGdwkbYfVZgss28shRgol65sXFuKO0kDZCcD_OowhX0qwq2EGerI5RwWeWjB_jXuU92S8KCJWDfORFG1EGW9w-TUcJ-KjZ0N-oJIE_rPesKayrYODGXP6kpk7ze1o4_dsU7q4RjmWYTA#_")
      console.log(response)
    }
    catch(e) {
      console.log(e)
      console.log(e.response.data)
    }
  }
  
  async function testUserInfo(token_data:any) {
    const user_info = await instance.getUserInfo(token_data)
    console.log(user_info)
  }

  async function testRefreshToken(token_data:any) {
    const refresh_response = await instance.refreshToken(token_data)
    console.log(refresh_response)
  }
  
  async function testMakeApiRequest(token_data:any) {
    const response = await instance.makeApiRequest(token_data, "get", "/me/media", {
      params: {
        access_token: token_data.access_token
      }
    })

    console.dir(response, { depth: 6 })
  }
}
main()