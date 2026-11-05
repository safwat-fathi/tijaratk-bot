import { customType } from 'drizzle-orm/pg-core';
import { Fernet } from '../core/fernet.js';

let fernet: Fernet | undefined;
const getFernet = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY must be set to use encrypted columns');
  fernet ??= new Fernet(key);
  return fernet;
};

/** EncryptedString column type: legacy plaintext rows pass through on read. */
export const encryptedString = customType<{ data: string; driverData: string }>({
  dataType: () => 'varchar',
  toDriver: (value) => getFernet().encrypt(value),
  fromDriver: (value) => getFernet().decrypt(value) ?? value,
});
