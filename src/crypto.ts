import { webcrypto } from "crypto";

// #############
// ### Utils ###
// #############

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};

export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return { 
    publicKey: keyPair.publicKey, 
    privateKey: keyPair.privateKey 
  };
}

export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

export async function exportPrvKey(
  key: webcrypto.CryptoKey | null
): Promise<string | null> {
  if (!key) return null;
  const exported = await webcrypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exported);
}

export async function importPubKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "spki",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrvKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// ######################
// ### Symmetric keys ###
// ######################

export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.generateKey(
    { name: "AES-CBC", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

export async function importSymKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-CBC" },
    true,
    ["encrypt", "decrypt"]
  );
}

// ########################
// ### Cryptage/Décryptage #
// ########################

export async function rsaDecrypt(
  data: string,
  privateKey: webcrypto.CryptoKey
): Promise<string> {
  try {
    const decrypted = await webcrypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToArrayBuffer(data)
    );
    // Conversion directe en UTF-8 pour les données utilisateur
    return new TextDecoder().decode(decrypted); // ✅ Correction cruciale
  } catch (err) {
    console.error("Erreur RSA détaillée:", err);
    throw new Error("Échec du déchiffrement RSA");
  }
}

export async function rsaEncrypt(
  plainText: string, // Renommé pour plus de clarté
  strPublicKey: string
): Promise<string> {
  const publicKey = await importPubKey(strPublicKey);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    new TextEncoder().encode(plainText) // ✅ Encodage UTF-8 correct
  );
  return arrayBufferToBase64(encrypted);
}

export async function symEncrypt(
  key: webcrypto.CryptoKey,
  data: string
): Promise<string> {
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    new TextEncoder().encode(data)
  );
  return JSON.stringify({
    iv: arrayBufferToBase64(iv),
    encrypted: arrayBufferToBase64(encrypted),
  });
}

export async function symDecrypt(
  strKey: string,
  encryptedData: string
): Promise<string> {
  const key = await importSymKey(strKey);
  const { iv, encrypted } = JSON.parse(encryptedData);
  const decrypted = await webcrypto.subtle.decrypt(
    { name: "AES-CBC", iv: base64ToArrayBuffer(iv) },
    key,
    base64ToArrayBuffer(encrypted)
  );
  return new TextDecoder().decode(decrypted);
}