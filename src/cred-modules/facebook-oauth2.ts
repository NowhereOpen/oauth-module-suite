import axios from "axios"

import { OAuth2 } from "~/src/cred-module-base/oauth2-base"
import { makeApiRequest } from "~/src/lib/api-request"

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
  async revokeToken(token_response:any) {
    let at = token_response["access_token"]
    let url = new URL(`https://graph.facebook.com/me/permissions`)
    url.searchParams.append("access_token", at);

    return await axios.delete(url.href)
  }
  
  /**
   * https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing
   * 
   * Doesn't refresh a 'long lived token' it seems, instead it gives an updated 'expired at'
   */
  async refreshToken(token_response:any) {
    let at = token_response["access_token"]

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
  async __checkUserPermissions(token_response:any) {
    let at = token_response["access_token"]

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
    const access_token = token_data["access_token"]
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
    const access_token = token_data["access_token"]
    
    return await makeApiRequest(method, url, {
      baseURL: "https://graph.facebook.com",
      params: { access_token }
    }, req_data)
  }
}