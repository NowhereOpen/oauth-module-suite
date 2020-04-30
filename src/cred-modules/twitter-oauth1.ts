import TwitterModule from "twitter";

import { OAuth1a } from "~/src/cred-module-base/oauth1-base"

type TwitterCred = {
  consumer_key: string
  consumer_secret: string
  access_token_key: string
  access_token_secret: string
}

export class Twitter extends OAuth1a {
  constructor(consumer_key:string, consumer_secret:string, redirect_uri:string) {
    super(
      "twitter", "Twitter",
      { consumer_key, consumer_secret },
      {
        request: "https://api.twitter.com/oauth/request_token",
        access_token: "https://api.twitter.com/oauth/access_token",

        // Alternatives: /authorize and /authenticate.
        // "https://api.twitter.com/oauth/authenticate",
        auth: "https://api.twitter.com/oauth/authorize",

        callback: redirect_uri,
      },
      /**
       * https://developer.twitter.com/en/docs/basics/authentication/api-reference/authorize
       * 
       *   - force_login: Only the value 'true' seems to require the login
       *   - screen_name: I don't know what this does.
       */
      { "force_login": "false", "screen_name": "GYST test" }
    )
  }

  async revokeToken(token_response:any) {
    let access_token_key = token_response["oauth_token"]
    let access_token_secret = token_response["oauth_token_secret"]

    let twitter = new TwitterModule({
      consumer_key: this.cred.consumer_key,
      consumer_secret: this.cred.consumer_secret,
      access_token_key: access_token_key,
      access_token_secret: access_token_secret
    })

    // What the heck is this typing?
    return <Promise<void>> new Promise((resolve, reject) => {
      twitter.post("oauth/invalidate_token", {}, (error:any, tweets:any, response:any) => {
        if(error) {
          // console.log(error)
          return reject(error)
        }

        return resolve()
      })
    })
  }

  refreshToken() {
    // Does not expire
    console.log("Twitter token does not expire.")
    return Promise.resolve(undefined)
  }

  async getUserInfo(token_data:any) {
    const access_token_key = token_data["oauth_token"]
    const access_token_secret = token_data["oauth_token_secret"]

    const twitter_cred = {
      consumer_key: this.cred.consumer_key,
      consumer_secret: this.cred.consumer_secret,
      access_token_key,
      access_token_secret,
    }

    return await makeRequest("get", "account/verify_credentials.json", twitter_cred, { include_email: true })
  }

  resDataToUserInfo(res_data:any) {
    return {
      user_uid: res_data.id_str,
      user_id: res_data.screen_name,
      friendly_name: res_data.name,
      json_content:res_data
    }
  }

  async makeApiRequest(token_data:any, method:string, url:string, req_data?:any): Promise<any> {
    const access_token_key = token_data["oauth_token"]
    const access_token_secret = token_data["oauth_token_secret"]

    const twitter_cred = {
      consumer_key: this.cred.consumer_key,
      consumer_secret: this.cred.consumer_secret,
      access_token_key,
      access_token_secret,
    }
    
    /**
     * Different apis seems to have different conventions. YouTube uses `headers` and
     * google calednar uses `params`, for example.
     */
    return await makeRequest(<"get"|"post"|"stream">method, url, twitter_cred, req_data.params)
  }
}

export async function makeRequest(method:"get"|"post"|"stream", url:string, twitter_cred:TwitterCred, params?:any):Promise<any> {
  const twitter = new TwitterModule(twitter_cred)

  const tweets = await new Promise((res, rej) => {
    const cb = (error:any, tweets:any, response:any) => {
      if(error) {
        console.log(error)
        return rej(error)
      }
      res(tweets)
    }

    // Promise is resolved in the `cb`
    if(params != undefined && Object.keys(params).length > 0) {
      twitter[method](url, params, cb)
    }
    else {
      twitter[method](url, cb)
    }
  })

  return tweets
}