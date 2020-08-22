import { encode } from "./../../src/utility/encode.ts";
import { JSONWebKey, RSAKey } from "./common.ts";
import { get_key_size, base64_to_binary } from "../helper.ts";
import { ber_decode, ber_simple } from "./basic_encoding_rule.ts";
import { os2ip } from "./primitives.ts";

type RSAImportKeyFormat = "auto" | "jwk" | "pem";
type RSAPublicKeyFormat = [[string, null], [[bigint, bigint]]];

/**
 * Automatically detect the key format
 * 
 * @param key
 */
function detect_format(key: string | JSONWebKey): RSAImportKeyFormat {
  if (typeof key === "object") {
    if (key.kty === "RSA") return "jwk";
  } else if (typeof key === "string") {
    if (key.substr(0, "-----".length) === "-----") return "pem";
  }

  throw new TypeError("Unsupported key format");
}

/**
 * Import from JSON Web Key
 * https://tools.ietf.org/html/rfc7517
 * 
 * @param key PEM encoded key format
 */
function rsa_import_jwk(key: JSONWebKey): RSAKey {
  if (typeof key !== "object") throw new TypeError("Invalid JWK format");
  if (!key.n) throw new TypeError("RSA key requires n");

  const n = os2ip(encode.base64url(key.n));

  return {
    e: key.e ? os2ip(encode.base64url(key.e)) : undefined,
    n: os2ip(encode.base64url(key.n)),
    d: key.d ? os2ip(encode.base64url(key.d)) : undefined,
    p: key.p ? os2ip(encode.base64url(key.p)) : undefined,
    q: key.q ? os2ip(encode.base64url(key.q)) : undefined,
    dp: key.dp ? os2ip(encode.base64url(key.dp)) : undefined,
    dq: key.dq ? os2ip(encode.base64url(key.dq)) : undefined,
    qi: key.qi ? os2ip(encode.base64url(key.qi)) : undefined,
    length: get_key_size(n),
  };
}

/**
 * Import private key from Privacy-Enhanced Mail (PEM) format
 * https://tools.ietf.org/html/rfc5208
 * 
 * @param key PEM encoded key format
 */
function rsa_import_pem_private(key: string): RSAKey {
  const trimmedKey = key.substr(31, key.length - 61);
  const parseKey = ber_simple(
    ber_decode(base64_to_binary(trimmedKey)),
  ) as bigint[];

  return {
    n: parseKey[1],
    d: parseKey[3],
    e: parseKey[2],
    p: parseKey[4],
    q: parseKey[5],
    dp: parseKey[6],
    dq: parseKey[7],
    qi: parseKey[8],
    length: get_key_size(parseKey[1]),
  };
}

/**
 * Import public key from Privacy-Enhanced Mail (PEM) format
 * https://tools.ietf.org/html/rfc5208
 * 
 * @param key PEM encoded key format
 */
function rsa_import_pem_public(key: string): RSAKey {
  const trimmedKey = key.substr(26, key.length - 51);
  const parseKey = ber_simple(
    ber_decode(base64_to_binary(trimmedKey)),
  ) as RSAPublicKeyFormat;

  return {
    length: get_key_size(parseKey[1][0][0]),
    n: parseKey[1][0][0],
    e: parseKey[1][0][1],
  };
}

/**
 * Import key from Privacy-Enhanced Mail (PEM) format
 * https://tools.ietf.org/html/rfc5208
 * 
 * @param key PEM encoded key format
 */
function rsa_import_pem(key: string): RSAKey {
  if (typeof key !== "string") throw new TypeError("PEM key must be string");

  if (
    key.indexOf("-----BEGIN RSA PRIVATE KEY-----") === 0
  ) {
    return rsa_import_pem_private(key);
  }
  if (
    key.indexOf("-----BEGIN PUBLIC KEY-----") === 0
  ) {
    return rsa_import_pem_public(key);
  }

  throw new TypeError("Unsupported key format");
}

/**
 * Import other RSA key format to our RSA key format
 * 
 * @param key 
 * @param format 
 */
export function rsa_import_key(
  key: string | JSONWebKey,
  format: RSAImportKeyFormat,
): RSAKey {
  const finalFormat = format === "auto" ? detect_format(key) : format;

  if (finalFormat === "jwk") return rsa_import_jwk(key as JSONWebKey);
  if (finalFormat === "pem") return rsa_import_pem(key as string);

  throw new TypeError("Unsupported key format");
}