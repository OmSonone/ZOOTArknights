/**
 * Yostar login + account-data flow for EN / JP / KR.
 *
 * This mirrors what the game client does when logging in, based on the flow
 * implemented by ak-roster (0BSD). Everything runs on the local machine; the
 * only remote endpoints contacted are the official Yostar/Hypergryph ones.
 */
import crypto from "node:crypto";

const SALT = "886c085e4a8d30a703367b120dd8353948405ec2";
const U8_KEY = "91240f70c09a08a6bc72af1a5c8d4670";
const CHANNEL_ID = "3"; // yostar
const TIMEOUT_MS = 25_000;

const SERVERS = {
  en: {
    pid: "US-ARKNIGHTS",
    lang: "en",
    sdk: "https://en-sdk-api.yostarplat.com",
    config: "https://ak-conf.arknights.global/config/prod/official/network_config",
  },
  jp: {
    pid: "JP-AK",
    lang: "jp",
    sdk: "https://jp-sdk-api.yostarplat.com",
    config: "https://ak-conf.arknights.jp/config/prod/official/network_config",
  },
  kr: {
    pid: "KR-ARKNIGHTS",
    lang: "ko",
    sdk: "https://jp-sdk-api.yostarplat.com",
    config: "https://ak-conf.arknights.kr/config/prod/official/network_config",
  },
};

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "X-Unity-Version": "2017.4.39f1",
  "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11; KB2000 Build/RP1A.201005.001)",
  Connection: "Keep-Alive",
};

export const SUPPORTED_SERVERS = Object.keys(SERVERS);

const assertServer = (server) => {
  if (!SERVERS[server]) {
    throw new Error(`Unsupported server "${server}". Use one of: ${SUPPORTED_SERVERS.join(", ")}`);
  }
  return SERVERS[server];
};

async function requestJson(url, { method = "GET", body, headers } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      error?.name === "TimeoutError"
        ? "The game server did not respond in time."
        : `Network error while contacting ${new URL(url).host}.`,
    );
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

function sdkHeaders(bodyString, server) {
  const config = assertServer(server);
  const head = {
    PID: config.pid,
    Channel: "googleplay",
    Platform: "android",
    Version: "4.10.0",
    GVersionNo: "2000112",
    GBuildNo: "",
    Lang: config.lang,
    DeviceID: crypto.randomUUID(),
    DeviceModel: "F9",
    UID: "",
    Token: "",
    Time: Math.floor(Date.now() / 1000),
  };
  const serialized = JSON.stringify(head);
  const sign = crypto.createHash("md5").update(serialized + bodyString + SALT).digest("hex").toUpperCase();
  return {
    ...BASE_HEADERS,
    Authorization: JSON.stringify({ Head: head, Sign: sign }),
  };
}

function u8Sign(payload) {
  const sorted = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  const query = new URLSearchParams(sorted).toString();
  return crypto.createHmac("sha1", U8_KEY).update(query).digest("hex").toLowerCase();
}

const networkConfigCache = new Map();

async function getNetworkConfig(server) {
  const cached = networkConfigCache.get(server);
  if (cached && cached.expires > Date.now()) return cached.value;

  const config = assertServer(server);
  const { ok, data } = await requestJson(config.config, { headers: BASE_HEADERS });
  if (!ok || !data?.content) throw new Error("Could not read the game network configuration.");

  const content = JSON.parse(data.content);
  const network = content?.configs?.[content.funcVer]?.network;
  if (!network) throw new Error("The game network configuration has an unexpected shape.");

  networkConfigCache.set(server, { value: network, expires: Date.now() + 5 * 60_000 });
  return network;
}

async function getVersionConfig(network) {
  if (!network.hv) throw new Error("The game network configuration is missing the version endpoint.");
  const url = String(network.hv).replace("{0}", "Android");
  const { ok, data } = await requestJson(url, { headers: BASE_HEADERS });
  if (!ok || !data?.clientVersion) throw new Error("Could not read the game client version.");
  return data;
}

async function requestU8Token({ uid, token, deviceId1, deviceId2, deviceId3, network }) {
  if (!network.u8) throw new Error("The game network configuration is missing the u8 endpoint.");
  const body = {
    appId: "1",
    platform: 1,
    channelId: CHANNEL_ID,
    subChannel: CHANNEL_ID,
    extension: JSON.stringify({ type: 1, uid, token }),
    worldId: CHANNEL_ID,
    deviceId: deviceId1,
    deviceId2,
    deviceId3,
  };
  body.sign = u8Sign(body);

  const { ok, data } = await requestJson(`${network.u8}/user/v1/getToken`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: BASE_HEADERS,
  });
  if (!ok || data?.result !== 0 || !data?.token) {
    throw new Error("The game server rejected the account token.");
  }
  return { uid: data.uid, token: data.token };
}

async function requestLoginSecret({ u8, deviceId1, deviceId2, deviceId3, network }) {
  if (!network.gs) throw new Error("The game network configuration is missing the gs endpoint.");
  const version = await getVersionConfig(network);
  const body = {
    platform: 1,
    networkVersion: "1",
    assetsVersion: version.resVersion,
    clientVersion: version.clientVersion,
    token: u8.token,
    uid: u8.uid,
    deviceId: deviceId1,
    deviceId2,
    deviceId3,
  };
  const { ok, data } = await requestJson(`${network.gs}/account/login`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { ...BASE_HEADERS, secret: "", seqnum: "1", uid: u8.uid },
  });
  if (!ok || data?.result !== 0 || !data?.secret) {
    throw new Error("The game server rejected the login.");
  }
  return { uid: data.uid ?? u8.uid, secret: data.secret };
}

async function requestSyncData(secret, uid, network) {
  const { ok, data } = await requestJson(`${network.gs}/account/syncData`, {
    method: "POST",
    body: JSON.stringify({ platform: 1 }),
    headers: { ...BASE_HEADERS, secret, uid, seqnum: "2" },
  });
  if (!ok || data?.result !== 0 || !data?.user) {
    throw new Error("The game server did not return account data.");
  }
  return data.user;
}

/** Step 1: ask Yostar to email a 6-digit code to the account. */
export async function sendAuthMail(email, server) {
  const config = assertServer(server);
  const body = JSON.stringify({ Account: email, Randstr: "", Ticket: "" });
  const { ok, data } = await requestJson(`${config.sdk}/yostar/send-code`, {
    method: "POST",
    body,
    headers: sdkHeaders(body, server),
  });
  if (!ok) throw new Error(data?.Msg || data?.message || "Yostar refused to send the code.");
  if (typeof data?.Code === "number" && data.Code !== 200) {
    throw new Error(data?.Msg || `Yostar returned code ${data.Code}.`);
  }
  return true;
}

async function exchangeYostarToken(email, code, server) {
  const config = assertServer(server);
  const body = JSON.stringify({ Account: email, Code: code });
  const { ok, data } = await requestJson(`${config.sdk}/yostar/get-auth`, {
    method: "POST",
    body,
    headers: sdkHeaders(body, server),
  });
  if (!ok || data?.Code !== 200 || !data?.Data?.Token) {
    throw new Error(data?.Msg || "That code was not accepted. Request a new one.");
  }
  const ticket = data.Data.Token;

  const loginBody = JSON.stringify({
    CheckAccount: 0,
    Geetest: {
      CaptchaID: null,
      CaptchaOutput: null,
      GenTime: null,
      LotNumber: null,
      PassToken: null,
    },
    OpenID: email,
    Secret: "",
    Token: ticket,
    Type: "yostar",
    UserName: email,
  });
  const login = await requestJson(`${config.sdk}/user/login`, {
    method: "POST",
    body: loginBody,
    headers: sdkHeaders(loginBody, server),
  });
  if (!login.ok || login.data?.Code !== 200 || !login.data?.Data?.UserInfo?.Token) {
    throw new Error(login.data?.Msg || "Yostar login failed.");
  }
  return {
    uid: String(login.data.Data.UserInfo.ID),
    token: String(login.data.Data.UserInfo.Token),
  };
}

async function finishLogin({ uid, token, deviceId1, deviceId2, deviceId3, server }) {
  const network = await getNetworkConfig(server);
  const u8 = await requestU8Token({ uid, token, deviceId1, deviceId2, deviceId3, network });
  const secret = await requestLoginSecret({ u8, deviceId1, deviceId2, deviceId3, network });
  const user = await requestSyncData(secret.secret, secret.uid, network);
  return {
    user,
    tokenData: {
      deviceId: deviceId1,
      token: { result: 0, uid, token },
    },
  };
}

/** Full login with email + emailed code. */
export async function fetchAccountWithCode({ email, code, server }) {
  assertServer(server);
  const yostar = await exchangeYostarToken(email, code, server);
  return finishLogin({
    ...yostar,
    deviceId1: crypto.randomUUID(),
    deviceId2: "",
    deviceId3: "",
    server,
  });
}

/** Reuse a previously saved Yostar token (must include the original device id). */
export async function fetchAccountWithToken(tokenData, server) {
  assertServer(server);
  if (!tokenData?.token?.token || !tokenData?.token?.uid) {
    throw new Error("The saved credentials are incomplete.");
  }
  return finishLogin({
    uid: String(tokenData.token.uid),
    token: String(tokenData.token.token),
    deviceId1: tokenData.deviceId || crypto.randomUUID(),
    deviceId2: "",
    deviceId3: "",
    server,
  });
}
