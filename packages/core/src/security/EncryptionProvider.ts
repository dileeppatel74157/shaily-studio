export interface EncryptionProvider {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export class Base64EncryptionProvider implements EncryptionProvider {
  public async encrypt(plaintext: string): Promise<string> {
    if (plaintext === null || plaintext === undefined) {
      throw new Error("Plaintext cannot be null or undefined");
    }
    return Buffer.from(plaintext, "utf8").toString("base64");
  }

  public async decrypt(ciphertext: string): Promise<string> {
    if (ciphertext === null || ciphertext === undefined) {
      throw new Error("Ciphertext cannot be null or undefined");
    }
    return Buffer.from(ciphertext, "base64").toString("utf8");
  }
}
