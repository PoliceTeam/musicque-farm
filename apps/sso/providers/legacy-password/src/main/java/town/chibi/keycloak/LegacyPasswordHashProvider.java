package town.chibi.keycloak;

import org.keycloak.credential.hash.PasswordHashProvider;
import org.keycloak.models.PasswordPolicy;
import org.keycloak.models.credential.PasswordCredentialModel;

/** Verify-only: failing the policy check makes Keycloak rehash with the realm default after a successful login. */
public final class LegacyPasswordHashProvider implements PasswordHashProvider {

  @Override
  public boolean policyCheck(PasswordPolicy policy, PasswordCredentialModel credential) {
    return false;
  }

  @Override
  public PasswordCredentialModel encodedCredential(String rawPassword, int iterations) {
    throw new UnsupportedOperationException("Legacy password hashes are verify-only");
  }

  @Override
  public boolean verify(String rawPassword, PasswordCredentialModel credential) {
    return LegacyHashes.verify(rawPassword, credential.getPasswordSecretData().getValue());
  }

  @Override
  public void close() {}
}
