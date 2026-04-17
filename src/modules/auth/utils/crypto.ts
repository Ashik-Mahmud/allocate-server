
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export class CryptoUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    console.log(bcrypt, 'bcrypt')
    
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  static generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}