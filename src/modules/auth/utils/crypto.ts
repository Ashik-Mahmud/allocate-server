
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
export class CryptoUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    if(bcrypt){
      return await bcrypt.hash(password, saltRounds);
    }
    return 'Bcrypt is not installed';
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  static generateRandomToken(count: number = 32): string {
    return crypto.randomBytes(count).toString('hex');
  }
}