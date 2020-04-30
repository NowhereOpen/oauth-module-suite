import axios from "axios"

async function getBearerToken(client_id:string, client_secret:string) {
  const { data } = await axios.post("https://api.twitter.com/oauth2/token",
    "grant_type=client_credentials", {
    auth: {
      username: client_id,
      password: client_secret
    }
  })

  return data
}

async function invalidateToken(access_token:string, client_id:string, client_secret:string) {
  const { data } = await axios.post("https://api.twitter.com/oauth2/invalidate_token",
    `access_token=${access_token}`, {
    auth: {
      username: client_id,
      password: client_secret
    }
  })

  return data
}

export default class TwitterOAuth2 {
  constructor(cilent_id:string, client_secret:string, redirect_uri:string) {}
}