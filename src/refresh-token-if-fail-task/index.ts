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

export class RefreshTokenIfFailTask {
  token_response:any
  cred_module:OAuthBaseClass
  task:TaskCb

  is_retry = false

  constructor(token_response:any, cred_module:OAuthBaseClass, task:TaskCb) {
    this.token_response = token_response
    this.cred_module = cred_module
    this.task = task
  }

  async useToken() {
    return await this.refreshTokenIfFail()
  }

  async refreshTokenIfFail():Promise<any> {
    try {
      return await this.task(this.token_response)
    }
    catch(e) {
      if(this.is_retry) {
        await this.onErrorAfterRefreshCb(e)
        throw new ErrorAfterRefreshing(e)
      }
      else {
        if((this.isThrowOnErrorBeforeRefreshCb(e)) == true) {
          console.log(`You can change the behavior by overriding 'isThrowOnErrorBeforeRefreshCb' method.`)
          throw new ErrorBeforeRefreshing(e)
        }

        await this.refreshToken()
        
        this.is_retry = true
        return await this.refreshTokenIfFail()
      }
    }
  }

  async refreshToken():Promise<any> {
    try {
      return await this.cred_module.refreshToken(this.token_response)
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

  async onErrorAfterRefreshCb(e:Error): Promise<void> {}
}