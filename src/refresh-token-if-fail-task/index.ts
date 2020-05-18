import { OAuthBaseClass } from "~/src/cred-module-base/base"

/**
 * 2020-04-24 10:46
 * 
 * `token_response` is passed from the same scope as the "task callback"
 * is passed. So I don't think even having any parameters is necessary.
 * 
 * For example, Github's token response is just a string, so it will pass
 * the token response, and define its task callback to use a parsed
 * access token.
 */
export type TaskCb = (token_response:any) => Promise<any>

export type GetTokenData = () => Promise<any>|any

export class TokenFail extends Error {
  error:Error
  msg:string|undefined

  constructor(e:Error, msg?:string) {
    super()
    this.error = e
    this.msg = msg
  }
}

export class ErrorAfterRefreshing extends Error {
  e:Error
  constructor(e:Error) {
    super("Error after refreshing the token and executing the task second time. Check your task code?");
    this.e = e
  }
}

export class ErrorBeforeRefreshing extends Error {
  e:Error
  constructor(e:Error) {
    super("Error before refreshing the token.");
    this.e = e
  }
}

export class ErrorOnRefreshRequest extends Error {
  e:Error
  constructor(e:Error) {
    super("Error while making the refresh token request.");
    this.e = e
  }
}

export abstract class RefreshTokenIfFailTask {
  cred_module:OAuthBaseClass

  is_retry = false

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

  async refreshTokenIfFail():Promise<any> {
    const token_data = await this.getTokenData()

    try {
      return await this.doTask(token_data)
    }
    catch(e) {
      if(this.is_retry) {
        await this.onErrorAfterRefreshCb(e)
        throw new ErrorAfterRefreshing(e)
      }
      else {
        /**
         * 2020-05-14 09:24
         * Refresh token
         */
        if((this.isThrowOnErrorBeforeRefreshCb(e)) == true) {
          console.log(`You can change the behavior by overriding 'isThrowOnErrorBeforeRefreshCb' method.`)
          throw new ErrorBeforeRefreshing(e)
        }

        const refresh_token_result = await this.refreshToken(token_data)
        await this.onRefreshToken(refresh_token_result, token_data)
        
        this.is_retry = true
        return await this.refreshTokenIfFail()
      }
    }
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
      return await this.cred_module.refreshToken(token_data)
    }
    catch(e) {
      console.log(`Error while refreshing the token.`)
      throw new ErrorOnRefreshRequest(e)
    }
  }

  /**
   * 2020-04-24 09:49
   * 
   * Default is to check if the error is TokenFail instance.
   * 
   * Returning `true` will throw error even before refreshing (You don't want to do that).
   * Return `false` will always refresh the token on the error before refreshing even when
   * that error may not be related to the token failure.
   */
  isThrowOnErrorBeforeRefreshCb(e:Error) {
    return e instanceof TokenFail
  }

  async onErrorAfterRefreshCb(e:Error): Promise<void> {
    console.error(`Error after refreshing the token:`)
    console.error(e)
  }
}