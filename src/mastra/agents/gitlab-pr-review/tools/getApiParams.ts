import { Tool } from "@mastra/core/tools";
import { z } from "zod";

import { saveCookieToFile, loadCookieFromFile, isCookieExpired } from './cookieTools'

const inputSchema = z.object({
  apiUrl: z.string().describe("The url of the api"),
});

const DomainItemSchema = z.object({
  required: z.string(),
  _id: z.string(),
  name: z.string(),
  desc: z.string()
});

const outputSchema = z.array(DomainItemSchema);


export const getApiParams = new Tool({
  id: "getApiParams",
  description: "Retrieve parameter configuration from YAPI via the interface path.",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    let cookie = await loadCookieFromFile()
    if (isCookieExpired(cookie)) {
      try {
        const login = await fetch('http://10.17.207.71:3000/api/user/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
          },
          body: JSON.stringify({ email: "dev@finchina.com", password: "dev" }),
        });

        const { data } = await login.json();
        const setCookieHeader = login.headers.get('set-cookie');
        const uid = data.uid
        if (uid) {
          cookie = `${setCookieHeader};_yapi_uid=${uid}`
          await saveCookieToFile(cookie)
        }
      } catch (err) {
        return []
      }
    }
    try {
      const { apiUrl } = context
      const match = apiUrl.match(/\/v1\/(.*)/);
      const url = match ? match[1] : apiUrl
      if (url && cookie) {
        let headers = {
          'Cookie': cookie,
        }
        const idData = await fetch(`http://10.17.207.71:3000/api/project/search?q=${url}`, {
          method: 'get',
          headers
        });
        const { data } = await idData.json();
        const id = data.interface[0]["_id"]
        if (id) {
          const queryData = await fetch(`http://10.17.207.71:3000/api/interface/get?id=${id}`, {
            method: 'get',
            headers
          });
          const { data: _data } = await queryData.json();
          const query = _data["req_query"]
          return query
        }
      }
    } catch (err) {
      return []
    }

    return []
  }
})