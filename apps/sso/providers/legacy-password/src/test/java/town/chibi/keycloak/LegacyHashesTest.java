package town.chibi.keycloak;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Vectors were produced by Farm's node:crypto scrypt and Musicque's bcryptjs. */
class LegacyHashesTest {

  private static final String PASSWORD = "Mật-khẩu cũ 1";

  private static final String FARM =
      "scrypt$lLS8RoOYx6qEu/CLzwQCLQ==$kRgXHN2oMQ79wbzm8qd2zU1naBogC55rRrJ8qNp2QX6MDDTSXvF6g5CrldTEsKkpWABaH4c028DG2O2nGzz8LQ==";
  private static final String MUSICQUE = "$2a$10$4GOYNCoSZ609XnPkQTt3dOFMSCQzLysCSNqhY.RKstedu07i459JW";
  private static final String MUSICQUE_2B = "$2b$10$mXcXQfiCYjl5UjoAdPDUfOECFPsjkBFcx5btT/dx9ryFzVfbQbmRK";

  @Test
  void verifiesFarmScrypt() {
    assertTrue(LegacyHashes.verify(PASSWORD, FARM));
    assertFalse(LegacyHashes.verify("Mật-khẩu cũ 2", FARM));
  }

  @Test
  void verifiesMusicqueBcrypt() {
    assertTrue(LegacyHashes.verify(PASSWORD, MUSICQUE));
    assertTrue(LegacyHashes.verify("pass word", MUSICQUE_2B));
    assertFalse(LegacyHashes.verify("pass words", MUSICQUE_2B));
  }

  @Test
  void rejectsMalformedOrMissingHashes() {
    assertFalse(LegacyHashes.verify(PASSWORD, null));
    assertFalse(LegacyHashes.verify(PASSWORD, ""));
    assertFalse(LegacyHashes.verify(PASSWORD, "scrypt$!!$!!"));
    assertFalse(LegacyHashes.verify(PASSWORD, "scrypt$$"));
    assertFalse(LegacyHashes.verify(PASSWORD, "$2a$10$short"));
    assertFalse(LegacyHashes.verify(PASSWORD, "plain"));
  }
}
