import { OAuthBaseClass } from "~/src/cred-module-base/base"

/**
 * 2020-04-24 10:46
 * 
 * `token_data` is passed from the same scope as the "task callback"
 * is passed. So I don't think even having any parameters is necessary.
 * 
 * For example, Github's token response is just a string, so it will pass
 * the token response, and define its task callback to use a parsed
 * access token.
 */
export type TaskCb = (token_data:any) => Promise<any>

export type RefreshTokenIfFailOutput<T=any> = {
  error_task_first_try: undefined | any
  error_refresh_token: undefined | any
  error_task_after_refresh: undefined | any
  refresh_token_response: undefined | any
  result:T
}

export type GetTokenData = () => Promise<any>|any

export abstract class RefreshTokenIfFailTask {
  cred_module:OAuthBaseClass
  
  output:RefreshTokenIfFailOutput = {
    error_task_first_try: undefined,
    error_refresh_token: undefined,
    error_task_after_refresh: undefined,
    refresh_token_response: undefined,
    result: undefined
  }

  is_first_try = true

  /**
   * 2020-05-14 09:32
   * The child class would need to take more parameters that can be
   * used by the abstract methods. For example, `getTokenData` may
   * require values required to query entries from the user app's
   * data base.
   */
  constructor(cred_module:OAuthBaseClass) {
    this.cred_module = cred_module
  }

  abstract getTokenData():Promise<any>
  /**
   * 2020-05-14 09:25
   * 
   * Store the refreshed token and update the old entry or something.
   * 
   * 2020-05-19 01:39
   * Some services like Google and Reddit don't return the refresh
   * token used in the request. In those cases, the returned refresh
   * token response, and the 'token data' used in making the request
   * should be merged or something before updating the DB.
   *
   * @param refresh_token_result 
   * @param token_data 
   */
  abstract onRefreshToken(refresh_token_result:any, token_data?:any):Promise<void>
  /**
   * 2020-05-14 09:37
   * COULD use the token_data returned by `this.getTokenData`
   */
  abstract doTask(token_data:any):Promise<void>

  async useToken() {
    return await this.refreshTokenIfFail()
  }

  async refreshTokenIfFail():Promise<RefreshTokenIfFailOutput> {
    const token_data = await this.getTokenData()

    try {
      this.output.result = await this.doTask(token_data)
    }
    catch(e) {
      // if-else: Second try after refreshing
      if(this.is_first_try == false) {
        this.output.error_task_after_refresh = e
      }
      // if-else: First try
      else {
        if((this.returnOnFirstTryError(e)) == true) {
          this.output.error_task_first_try = e
        }
        else {
          const refresh_token_result = await this.refreshToken(token_data)
          await this.onRefreshToken(refresh_token_result, token_data)
          
          this.is_first_try = false
          return await this.refreshTokenIfFail() 
        }
      }
    }
    
    return this.output
  }

  async refreshToken(token_data:any):Promise<any> {
    try {
      /**
       * 2020-05-14 09:55
       * 
       * TODO
       * Module like `github` returns the full 'axios response' data structure ... and that's how it
       * is from the old GYST code as well. What's happening?
       * 
       * Remove this comment after this is resolved.
       * 
       * 2020-05-14 10:16
       * 
       * I think the reason for not having encountered any error is that when I login to GYST using
       * Github account, it just renews the token data and I haven't used GYST for a long time that
       * it requires refreshing the token
       */
       this.output.refresh_token_response = await this.cred_module.refreshToken(token_data)
       return
    }
    catch(e) {
      this.output.error_refresh_token = e
      return
    }
  }

  /**
   * 2020-09-06 18:12
   * 
   * With `false` it will alwasy attempt to refresht the token and perform the task again.
   * 
   * Return true when you know the error is from un-refreshable error (eg, by calling `isTokenInvalidOrExpired`)
   */
  returnOnFirstTryError(e:Error):boolean {
    return false
  }
}