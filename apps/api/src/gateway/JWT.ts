import * as crypto from "crypto";

function base64urlEncode(str: string | Buffer): string {
  const buf = Buffer.isBuffer(str) ? str : Buffer.from(str);
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export class JWT {
  public static sign(payload: Record<string, any>, secret: string, expiresInSeconds: number = 3600): string {
    const header = { alg: "HS256", typ: "JWT" };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac("sha256", secret)
      .update(signatureInput)
      .digest();
    
    const encodedSignature = base64urlEncode(signature);
    return `${signatureInput}.${encodedSignature}`;
  }

  public static verify(token: string, secret: string): Record<string, any> | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      
      const expectedSignature = crypto.createHmac("sha256", secret)
        .update(signatureInput)
        .digest();
      const expectedEncodedSignature = base64urlEncode(expectedSignature);

      if (encodedSignature !== expectedEncodedSignature) {
        return null;
      }

      const payload = JSON.parse(base64urlDecode(encodedPayload));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        return null; // Expired
      }

      return payload;
    } catch {
      return null;
    }
  }
}
