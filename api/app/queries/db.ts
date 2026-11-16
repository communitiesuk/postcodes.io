import { Pool, QueryConfig, QueryResult, QueryResultRow } from "pg";
import { getConfig } from "../../config/config";
import { getAzureAdToken } from "../lib/azure_auth";

// `postgres` carries the connection details plus pool sizing (`max`) and the
// per-connection `statement_timeout`, all env-configurable via config.ts.
const { postgres } = getConfig();

// When Azure AD authentication is enabled, use a managed identity token as the
// password instead of a static credential. The pg Pool accepts a function for
// the `password` option, which is called for each new connection, ensuring
// tokens are always fresh.
const azureAdAuthEnabled =
  process.env.AZURE_AD_AUTH_ENABLED?.toLowerCase() === "true";

// Azure PostgreSQL Flexible Server requires SSL/TLS for all connections.
// Without `ssl` set, node-postgres connects in plaintext and Azure's pg_hba.conf
// rejects with: `no pg_hba.conf entry for host ... no encryption`.
// Use `rejectUnauthorized: true` so Node verifies the server certificate against
// its built-in CA trust store (Azure PG certs chain to DigiCert Global Root G2
// and Microsoft RSA Root CA 2017, both trusted by Node >=12 out of the box).
// `servername` is set explicitly so SNI / hostname verification matches the
// `*.postgres.database.azure.com` SAN on the server certificate.
const poolConfig = azureAdAuthEnabled
  ? {
      ...postgres,
      password: getAzureAdToken,
      ssl: {
        rejectUnauthorized: true,
        servername: postgres.host,
      },
    }
  : postgres;

export const pool = new Pool(poolConfig);

let lastQuerySucceededAt = 0;

/**
 * Epoch ms of the most recent query that completed successfully (0 if none
 * yet). Lets the readiness probe tell "pool busy serving queries" apart from
 * "database unreachable" without queueing behind other requests.
 */
export const lastQuerySuccess = (): number => lastQuerySucceededAt;

export const query = async <T extends QueryResultRow = any>(
  text: string | QueryConfig,
  values?: any[]
): Promise<QueryResult<T>> => {
  const result =
    typeof text === "string"
      ? await pool.query<T>(text, values)
      : await pool.query<T>(text);
  lastQuerySucceededAt = Date.now();
  return result;
};
