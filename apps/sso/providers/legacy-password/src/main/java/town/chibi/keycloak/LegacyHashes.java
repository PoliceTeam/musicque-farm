package town.chibi.keycloak;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.bouncycastle.crypto.generators.OpenBSDBCrypt;
import org.bouncycastle.crypto.generators.SCrypt;

/** Verifies password hashes exported by the legacy Farm and Musicque accounts. */
public final class LegacyHashes {

  // Node's crypto.scrypt defaults used by Farm's hashPassword.
  private static final int SCRYPT_N = 16384;
  private static final int SCRYPT_R = 8;
  private static final int SCRYPT_P = 1;

  private LegacyHashes() {}

  public static boolean verify(String password, String stored) {
    if (password == null || stored == null) return false;
    if (stored.startsWith("scrypt$")) return verifyScrypt(password, stored);
    if (stored.matches("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$")) return verifyBcrypt(password, stored);
    return false;
  }

  /** Farm format: scrypt$<base64 salt>$<base64 key>. */
  private static boolean verifyScrypt(String password, String stored) {
    String[] parts = stored.split("\\$");
    if (parts.length != 3) return false;
    try {
      byte[] salt = Base64.getDecoder().decode(parts[1]);
      byte[] expected = Base64.getDecoder().decode(parts[2]);
      if (salt.length == 0 || expected.length == 0) return false;
      byte[] actual = SCrypt.generate(
          password.getBytes(StandardCharsets.UTF_8), salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, expected.length);
      return MessageDigest.isEqual(expected, actual);
    } catch (IllegalArgumentException error) {
      return false;
    }
  }

  /** Musicque format: bcryptjs $2a$/$2b$ strings. */
  private static boolean verifyBcrypt(String password, String stored) {
    try {
      return OpenBSDBCrypt.checkPassword(stored, password.toCharArray());
    } catch (IllegalArgumentException error) {
      return false;
    }
  }
}
