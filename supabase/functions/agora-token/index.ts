import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agora token generation constants
const VERSION = "006";
const SERVICES = {
  RTC: 1,
  RTM: 2,
  CHAT: 3,
};

const PRIVILEGES = {
  JOIN_CHANNEL: 1,
  PUBLISH_AUDIO_STREAM: 2,
  PUBLISH_VIDEO_STREAM: 3,
  PUBLISH_DATA_STREAM: 4,
};

function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

function randomInt(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}

// Pack functions for token generation
function packUint16(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value, true);
  return new Uint8Array(buffer);
}

function packUint32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, value, true);
  return new Uint8Array(buffer);
}

function packString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(str);
  const lenBytes = packUint16(strBytes.length);
  const result = new Uint8Array(lenBytes.length + strBytes.length);
  result.set(lenBytes, 0);
  result.set(strBytes, lenBytes.length);
  return result;
}

function packMapUint32(map: Map<number, number>): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(packUint16(map.size));
  
  map.forEach((value, key) => {
    parts.push(packUint16(key));
    parts.push(packUint32(value));
  });
  
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HMAC-SHA256 using Web Crypto API
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const messageBuffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer;
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

// Base64 encode
function base64Encode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// Generate Agora RTC token
async function generateRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  expireTimestamp: number
): Promise<string> {
  const issueTs = getTimestamp();
  const salt = randomInt();
  
  // Build service RTC
  const privileges = new Map<number, number>();
  privileges.set(PRIVILEGES.JOIN_CHANNEL, expireTimestamp);
  privileges.set(PRIVILEGES.PUBLISH_AUDIO_STREAM, expireTimestamp);
  privileges.set(PRIVILEGES.PUBLISH_VIDEO_STREAM, expireTimestamp);
  privileges.set(PRIVILEGES.PUBLISH_DATA_STREAM, expireTimestamp);
  
  // Pack service content
  const serviceType = packUint16(SERVICES.RTC);
  const channelNamePacked = packString(channelName);
  const uidPacked = packUint32(uid);
  const privilegesPacked = packMapUint32(privileges);
  
  const serviceContent = concatUint8Arrays(
    serviceType,
    channelNamePacked,
    uidPacked,
    privilegesPacked
  );
  
  // Pack services map (only 1 service)
  const servicesCount = packUint16(1);
  const servicesPacked = concatUint8Arrays(servicesCount, serviceContent);
  
  // Build message
  const saltPacked = packUint32(salt);
  const issueTsPacked = packUint32(issueTs);
  const expirePacked = packUint16(24 * 3600); // 24 hours in seconds
  
  const message = concatUint8Arrays(
    saltPacked,
    issueTsPacked,
    expirePacked,
    servicesPacked
  );
  
  // Generate signature
  const encoder = new TextEncoder();
  const appIdBytes = encoder.encode(appId);
  
  // Sign with app certificate
  const certBytes = encoder.encode(appCertificate);
  const signature = await hmacSha256(certBytes, message);
  
  // Build final token
  const signaturePacked = packString(base64Encode(signature));
  const appIdPacked = packString(appId);
  
  const content = concatUint8Arrays(
    signaturePacked,
    appIdPacked,
    message
  );
  
  // Compress and encode (simple implementation without zlib)
  const token = VERSION + base64Encode(content);
  
  return token;
}

// Alternative simpler token generation using AccessToken2 format
async function generateSimpleRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  expireSeconds: number = 3600
): Promise<string> {
  const timestamp = getTimestamp();
  const expireTimestamp = timestamp + expireSeconds;
  const salt = randomInt();
  
  // Create the message to sign
  const message = `${appId}${channelName}${uid}${timestamp}${expireTimestamp}${salt}`;
  
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  const certBytes = encoder.encode(appCertificate);
  
  // Generate HMAC-SHA256 signature
  const signature = await hmacSha256(certBytes, messageBytes);
  const signatureBase64 = base64Encode(signature);
  
  // Build token in AccessToken format
  // This is a simplified version - for production, use the official Agora token builder
  const tokenData = {
    appId,
    channelName,
    uid,
    timestamp,
    expireTimestamp,
    salt,
    signature: signatureBase64
  };
  
  const tokenJson = JSON.stringify(tokenData);
  const tokenBase64 = btoa(tokenJson);
  
  return `006${tokenBase64}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID');
    const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      console.error('Agora credentials not configured');
      throw new Error('Agora credentials not configured');
    }

    const { channelName, uid } = await req.json();

    if (!channelName) {
      throw new Error('Channel name is required');
    }

    console.log('Generating Agora token for channel:', channelName, 'uid:', uid);

    // Generate a numeric UID from the string UID
    const numericUid = uid ? Math.abs(hashCode(uid)) % 100000000 : 0;
    
    // Token expires in 24 hours
    const expireTime = 24 * 60 * 60; // 24 hours in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Use the simpler token format
    const token = await generateSimpleRtcToken(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      String(numericUid),
      expireTime
    );

    console.log('Token generated successfully');

    return new Response(
      JSON.stringify({ 
        token, 
        appId: AGORA_APP_ID,
        uid: numericUid,
        channelName 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error generating Agora token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Simple hash function to convert string to number
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
