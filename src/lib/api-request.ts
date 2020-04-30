import axios, { AxiosResponse } from "axios"

type JsonObj = { [keyname:string]:any }
export type ApiRequestData = { params:JsonObj, data:JsonObj }
export async function makeApiRequest(method:string, url:string, default_axios_config:any, req_data?:ApiRequestData):Promise<AxiosResponse> {
  /**
   * set request data into `default_axios_config`
   */
  if(req_data != undefined) {
    ["params", "data"].forEach((keyname) => {
      /**
       * It is important to prevent adding an empty JSON `{}`, especially to `data` property.
       * For example, google calendar API will throw error for this case. In this case, not
       * including the `data` property at all resolves the issue. And that's exactly what we
       * are doing here.
       */
      const req_param = req_data[<"params" | "data">keyname]
      if(keyname in req_data && req_param != undefined && Object.keys(req_param).length > 0) {
        if(! (keyname in default_axios_config)) {
          default_axios_config[keyname] = req_param
        }
        else {
          /**
           * Override for now. Could implement `setAxiosConfigCb` in the future.
           */
          Object.assign(default_axios_config[keyname], req_param)
        }
      }
    })
  }

  const axios_config = Object.assign({}, default_axios_config, { method, url })

  return await axios(axios_config)
}