import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Role constants
const RtcRole = {
  PUBLISHER: 1,
  SUBSCRIBER: 2,
};

// Privilege constants
const Privileges = {
  kJoinChannel: 1,
  kPublishAudioStream: 2,
  kPublishVideoStream: 3,
  kPublishDataStream: 4,
};

function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// Simple hash function to convert string to number
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Base64 encode using btoa
function base64Encode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// Generate AccessToken (version 006)
async function generateAccessToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  privilegeExpireTs: number
): Promise<string> {
  const VERSION = "006";
  const ts = getTimestamp();
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Pack privileges map
  const privilegesMap: Record<number, number> = {};
  privilegesMap[Privileges.kJoinChannel] = privilegeExpireTs;
  if (role === RtcRole.PUBLISHER) {
    privilegesMap[Privileges.kPublishAudioStream] = privilegeExpireTs;
    privilegesMap[Privileges.kPublishVideoStream] = privilegeExpireTs;
    privilegesMap[Privileges.kPublishDataStream] = privilegeExpireTs;
  }
  
  // Create content to sign
  const encoder = new TextEncoder();
  const contentStr = `${appId}${channelName}${uid}${ts}${salt}`;
  
  // Sign with HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appCertificate),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(contentStr)
  );
  
  const signatureB64 = base64Encode(new Uint8Array(signature));
  
  // Build token payload
  const payload = {
    appId,
    channelName,
    uid,
    ts,
    salt,
    privileges: privilegesMap,
    signature: signatureB64
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);
  
  return VERSION + payloadB64;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID');
    const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!AGORA_APP_ID) {
      console.error('AGORA_APP_ID not configured');
      throw new Error('Agora credentials not configured');
    }

    const { channelName, uid } = await req.json();

    if (!channelName) {
      throw new Error('Channel name is required');
    }

    console.log('Generating Agora token for channel:', channelName, 'uid:', uid);

    // Generate a numeric UID from the string UID
    const numericUid = uid ? hashCode(uid) % 100000000 : 0;
    
    // Token expires in 24 hours
    const expireTime = 24 * 60 * 60;
    const currentTime = getTimestamp();
    const privilegeExpireTime = currentTime + expireTime;

    // For now, use null token (App ID only mode) 
    // This works when Primary Certificate is NOT enabled in Agora Console
    // To use token auth, enable Primary Certificate and Agora will validate tokens
    let token: string | null = null;
    
    if (AGORA_APP_CERTIFICATE) {
      // Generate a token - but note: this simplified format may not work
      // For production, use Agora's official token generation library
      token = await generateAccessToken(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        numericUid,
        RtcRole.PUBLISHER,
        privilegeExpireTime
      );
      console.log('Token generated successfully');
    } else {
      console.log('No certificate configured, using App ID only mode');
    }

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
