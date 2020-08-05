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

export type GetTokenData = () => Promise<any>|any

export class ThrownOnFirstTry extends Error {
  error:Error
  msg:string|undefined

  constructor(e:Error, msg?:string) {
    super()
    this.error = e
    this.msg = msg
  }
}

/**
 * 2020-06-18 18:01
 * 
 * Keeping trask of when the error was thrown is important because both
 * invalid and expired tokens throw the same error. Not sure if it's the
 * case for all services, but regardless if supporting multiple services
 * there is no consistency and it's bad.
 * 
 * By keeping track of when the error was thrown, we can see that the
 * token is not just 'expired' if the "invalid or expired" error is
 * thrown after refreshing the token.
 * 
 * Also, if there is something completely wrong about refresh token, then
 * we can tell so if the error was included as the `oringial_error` in
 * `ErrorOnRefreshRequest`.
 * 
 * I did consider whether to not wrap the error in these named error. So,
 * above is the good reason.
 */
// 
export class ErrorAfterRefreshing extends Error {
  original_error:Error
  constructor(e:Error) {
    super("Error after refreshing the token and executing the task second time. Check your task code?");
    this.original_error = e
  }
}

export class ErrorBeforeRefreshing extends Error {
  original_error:Error
  constructor(e:Error) {
    super("Error before refreshing the token.");
    this.original_error = e
  }
}

export class ErrorOnRefreshRequest extends Error {
  original_error:Error
  constructor(e:Error) {
    super("Error while making the refresh token request.");
    this.original_error = e
  }
}

export abstract class RefreshTokenIfFailTask {
  cred_module:OAuthBaseClass

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

  async refreshTokenIfFail():Promise<any> {
    const token_data = await this.getTokenData()

    try {
      return await this.doTask(token_data)
    }
    catch(e) {
      if(this.is_first_try == false) {
        await this.onErrorAfterRefreshCb(e)
        throw new ErrorAfterRefreshing(e)
      }
      else {
        if((this.isThrowOnFirstTry(e)) == true) {
          throw new ErrorBeforeRefreshing(e)
        }

        const refresh_token_result = await this.refreshToken(token_data)
        await this.onRefreshToken(refresh_token_result, token_data)
        
        this.is_first_try = false
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
      console.log(`Error caught while running \`await refreshToken\`.`)
      throw new ErrorOnRefreshRequest(e)
    }
  }

  /**
   * 2020-06-18 07:15
   * 
   * If the call back never throws `ThrownOnFirstTry` error because it doesn't know about this
   * feature is to always refresh the token if an error occurs even when the error thrown can't
   * be fixed by refreshing the token. For example, the user revoked already or the value used
   * in the API request is just wrong.
   * 
   * Control this by throwing `ThrownOnFirstTry` error or overriding this method to return true
   * to throw error, and not refresh the token on the error.
   */
  isThrowOnFirstTry(e:Error):boolean {
    return e instanceof ThrownOnFirstTry
  }

  async onErrorAfterRefreshCb(e:Error): Promise<void> {
    console.error(`Error after refreshing the token:`)
    console.error(e)
  }
}