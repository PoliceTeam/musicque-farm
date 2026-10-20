package town.chibi.keycloak;

import org.keycloak.Config;
import org.keycloak.credential.hash.PasswordHashProvider;
import org.keycloak.credential.hash.PasswordHashProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public final class LegacyPasswordHashProviderFactory implements PasswordHashProviderFactory {

  /** Value of credentialData.algorithm for imported legacy passwords. */
  public static final String ID = "chibi-legacy";

  private static final LegacyPasswordHashProvider PROVIDER = new LegacyPasswordHashProvider();

  @Override
  public PasswordHashProvider create(KeycloakSession session) {
    return PROVIDER;
  }

  @Override
  public void init(Config.Scope config) {}

  @Override
  public void postInit(KeycloakSessionFactory factory) {}

  @Override
  public void close() {}

  @Override
  public String getId() {
    return ID;
  }
}
