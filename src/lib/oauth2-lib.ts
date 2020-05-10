import FormData from "form-data"
import axios from "axios"

export type TokenRequestMethod = "POST"|"GET"
export type TokenRequestDataType = "FORM_DATA"|"QUERY_PARAM"|"URL_ENCODED"

export function getAuthorizationUrl(url:string, params:any):string {
  let authorization_url = new URL(url);
  let search = authorization_url.searchParams;

  for(let param in params) {
    let value = params[param];
    search.append(param, value);
  }

  return authorization_url.href;
}

type Cred = {
  client_id: string
  client_secret: string
}

type TokenRequest = {
  url:string
  method:TokenRequestMethod
  data_type:TokenRequestDataType
  params:any
}

export async function requestToken(cred:Cred, token_request:TokenRequest, code:string, option:{ is_oauth_header: boolean }) {
  let axios_config:any = makeRequestTokenConfig(cred, token_request, code, option)
  return await axios(axios_config)
}

export function isOAuth2CallbackUrlValid(url:string):boolean {
  let _url = new URL(url)
  const lookup_value = _url.searchParams.get("code")
  const contains_invalid_value = [undefined, null, ""].includes(lookup_value)
  return ! contains_invalid_value
}

export function getCodeQueryParam(url:string):string {
  let _url = new URL(url)
  const lookup_value = <string> _url.searchParams.get("code")
  return lookup_value
}

export function makeRequestTokenConfig(cred:Cred, token_request:TokenRequest, code:string, option:{ is_oauth_header: boolean }):any {
  const { url, method, data_type, params:_params } = token_request
  let axios_config:any = {
    url, method
  }

  const params = Object.assign({}, _params, { code })

  /**
   * For some reason, oauth2 requests won't accept the 'normal body' type parameters.
   * 
   * Build data based on the 'data_type'. For example, url-encoded data_type
   * will not use the "data" property, but only use "url"
   * 
   * This requires modifying the `axios_config` variable, so it's a special case.
   */ 
  switch(data_type) {
    case "QUERY_PARAM":
      axios_config.params = params
      break;

    case "FORM_DATA":
      let form_data = new FormData();
      _appendPairs(form_data, params);
      axios_config["data"] = form_data;
      // https://github.com/axios/axios/issues/1006#issuecomment-320165427
      axios_config["headers"] = form_data.getHeaders();
      break;

    case "URL_ENCODED":
      let url_encoded = new URLSearchParams();
      _appendPairs(url_encoded, params)
      axios_config["data"] = url_encoded;
      break;
  }

  if(option.is_oauth_header) {
    axios_config.auth = {
      username: cred.client_id,
      password: cred.client_secret
    }
  }

  return axios_config
}

/**
 * Converts the `pairs` into `container` type.
 * @param container One of URLSearchParams or FormData
 * @param pairs The object to convert
 */
function _appendPairs(container:URLSearchParams|FormData, pairs:any) {
  for(let key in pairs) {
    let value = pairs[key];
    container.append(key, value);
  }
}